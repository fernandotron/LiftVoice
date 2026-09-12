/**
 * DeepgramStreamingService — Motor de Transcripción por Streaming en Vivo (LiftVoice)
 *
 * Basado en la arquitectura probada de alta fidelidad de app-salud-inteligente:
 *   - Captura en hilo de audio vía AudioWorklet (16 kHz mono linear16, VAD por RMS).
 *   - Conexión directa bidireccional por WebSocket a Deepgram Nova-3 con tokens efímeros.
 *   - Separación de ciclo de vida: audio graph vivo vs WebSocket reconnectable in-place.
 *   - Ring buffer PcmBacklog (~8s) para tolerancia a microcortes y backpressure de red.
 *   - KeepAlive cada 5s para evitar cortes por inactividad durante silencios.
 *   - Drenaje con CloseStream + grace timeout (1.5s) para evitar pérdida de palabras finales (tail-loss).
 *   - Telemetría de primer parcial y detección de modo degradado.
 */

import { PcmBacklog } from './pcmBacklog.js';

const WORKLET_MODULE_PATH = '/asr-audio-worklet.js';
const WORKLET_PROCESSOR_NAME = 'asr-audio-worklet';

const ASR_SAMPLE_RATE = 16000;
const ASR_ENDPOINTING_MS = 300;
const ASR_UTTERANCE_END_MS = 1000;
const ASR_KEEPALIVE_INTERVAL_MS = 5000;
const ASR_CHUNK_MS = 100;
const ASR_VAD_SILENCE_THRESHOLD = 0.008;
const ASR_VAD_HANGOVER_SECONDS = 0.6;
const ASR_MAX_WS_BUFFERED_BYTES = 262144; // 256 KB
const ASR_MAX_BACKLOG_BYTES = 524288; // 512 KB ≈ 16.4s de PCM a 16 kHz
const ASR_FIRST_PARTIAL_TIMEOUT_MS = 1500;
const ASR_CLOSE_DRAIN_TIMEOUT_MS = 1500;

export class DeepgramStreamingService {
  constructor() {
    this.ws = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.muteGain = null;
    this.keepAliveTimer = null;
    this.isActive = false;
    this.startSeq = 0;
    this.backlog = new PcmBacklog(ASR_MAX_BACKLOG_BYTES);

    this.tokenMetadata = {
      token: null,
      expiresAt: 0,
      listenUrl: null,
      model: null
    };

    this.lastConfig = null;
    this.lastCallbacks = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 15;
    this.wasActiveBeforeHidden = false;

    this.firstByteSentAt = null;
    this.firstPartialSeen = false;
    this.firstPartialTimer = null;
    this.onFirstPartialLatency = null;
    this.onFirstPartialTimeout = null;
    this.onVisibilityChange = null;
    this.onOnlineHandler = null;

    this.status = 'idle'; // 'idle' | 'connecting' | 'listening' | 'reconnecting' | 'degraded' | 'error'
    this.statusListeners = new Set();
    this.onStatusChange = null;
  }

  get active() {
    return this.isActive;
  }

  setStatus(newStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    if (this.onStatusChange) {
      try {
        this.onStatusChange(newStatus);
      } catch (e) {}
    }
    for (const cb of this.statusListeners) {
      try {
        cb(newStatus);
      } catch (e) {}
    }
  }

  onStatus(cb) {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  /**
   * Inicia el pipeline completo: obtiene token efímero, monta el grafo de audio y abre el WebSocket
   */
  async start(stream, config = {}, callbacks = {}) {
    if (this.isActive) {
      await this.stop();
    }
    const seq = ++this.startSeq;
    this.isActive = true;
    this.setStatus('connecting');

    this.tokenMetadata = {
      token: null,
      expiresAt: 0,
      listenUrl: null,
      model: null
    };

    this.lastConfig = config;
    this.lastCallbacks = callbacks;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Escucha de reanudación de red para reconexión instantánea al recuperar Wi-Fi
    if (typeof window !== 'undefined' && !this.onOnlineHandler) {
      this.onOnlineHandler = () => {
        if (this.isActive && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          console.log('[DeepgramStreaming] 🌐 Conectividad restaurada (online): reconectando inmediatamente...');
          this.reconnect(this.lastConfig, this.lastCallbacks).catch(() => {});
        }
      };
      window.addEventListener('online', this.onOnlineHandler);
    }

    // Desbloqueo síncrono de AudioContext para cumplir políticas de Autoplay en iOS Safari / Android
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass && (!this.audioContext || this.audioContext.state === 'closed')) {
      try {
        this.audioContext = new AudioContextClass();
      } catch (e) {}
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    try {
      // 1. Obtener o resolver token efímero y URL
      let transportConfig = { ...config };
      if (!transportConfig.token || !transportConfig.listenUrl) {
        const tokenRes = await this.mintToken(config);
        transportConfig = { ...transportConfig, ...tokenRes };
      }

      // 2. Montar grafo de audio con AudioWorklet
      await this.setupAudioGraph(stream, transportConfig, seq);
      if (seq !== this.startSeq) return;

      // 3. Abrir WebSocket a Deepgram
      this.openWebSocket(transportConfig, callbacks);
    } catch (err) {
      console.error('[DeepgramStreaming] Start failed:', err);
      this.isActive = false;
      await this.stop();
      this.setStatus('error');
      if (callbacks.onError) callbacks.onError(err);
    }
  }

  /**
   * Reconexión in-place: reabre únicamente el canal WebSocket reutilizando el grafo de audio vivo
   */
  async reconnect(config = {}, callbacks = {}, forceRefreshToken = false) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.audioContext || !this.workletNode) {
      throw new Error('reconnect() sin grafo de audio activo — usar start()');
    }
    this.isActive = true;
    const seq = this.startSeq;
    this.setStatus('reconnecting');
    this.lastConfig = { ...(this.lastConfig || {}), ...config };
    this.lastCallbacks = { ...(this.lastCallbacks || {}), ...callbacks };

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {}
    }
    if (seq !== this.startSeq) return;

    this.closeSocketOnly();

    let transportConfig = { ...this.lastConfig };
    const now = Date.now();
    const tokenIsFresh = this.tokenMetadata.token && (now < this.tokenMetadata.expiresAt - 10000);

    if (!tokenIsFresh || forceRefreshToken || !transportConfig.listenUrl) {
      try {
        const tokenRes = await this.mintToken({ ...this.lastConfig, forceRefresh: Boolean(forceRefreshToken) });
        transportConfig = { ...transportConfig, ...tokenRes };
      } catch (tokenErr) {
        console.warn('[DeepgramStreaming] Error al mintear token en reconexión:', tokenErr);
        throw tokenErr;
      }
    } else {
      transportConfig.token = this.tokenMetadata.token;
      transportConfig.listenUrl = this.tokenMetadata.listenUrl || transportConfig.listenUrl;
      transportConfig.model = this.tokenMetadata.model || transportConfig.model;
    }

    if (seq !== this.startSeq || !this.isActive) return;

    this.openWebSocket(transportConfig, this.lastCallbacks);
  }

  async stop() {
    this.isActive = false;
    this.startSeq++;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Drenaje final del backlog antes de enviar CloseStream (zero tail-loss)
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.backlog.size > 0) {
      try {
        this.drainBacklog(this.ws);
      } catch (e) {}
    }
    this.closeSocketOnly();
    this.backlog.clear();
    this.clearFirstPartialTimer();
    this.setStatus('idle');
    this.tokenMetadata = { token: null, expiresAt: 0, listenUrl: null, model: null };

    if (this.onVisibilityChange && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.onVisibilityChange = null;
    }

    if (this.onOnlineHandler && typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnlineHandler);
      this.onOnlineHandler = null;
    }

    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.muteGain) {
      this.muteGain.disconnect();
      this.muteGain = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch (e) {}
    }
    this.audioContext = null;
  }

  /**
   * Conmuta la pista de entrada de audio en caliente sin reiniciar
   * el AudioContext, el AudioWorklet ni la conexión WebSocket abierta.
   * @param {MediaStream} newStream - Nuevo stream obtenido de getUserMedia
   */
  async switchStream(newStream) {
    if (!this.audioContext || !this.workletNode) {
      throw new Error('[DeepgramStreaming] No hay grafo de audio activo para conmutar');
    }
    if (!newStream || !newStream.getAudioTracks().length) {
      throw new Error('[DeepgramStreaming] El nuevo stream no contiene pistas de audio válidas');
    }

    const newSourceNode = this.audioContext.createMediaStreamSource(newStream);
    newSourceNode.connect(this.workletNode);

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
    }

    this.sourceNode = newSourceNode;
    console.log('[DeepgramStreaming] 🎙️ Micrófono conmutado en caliente en el grafo de audio (WebSocket intacto).');
  }

  async mintToken(config = {}) {
    const res = await fetch('/api/asr-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: config.language || config.lang || 'es',
        medicalMode: Boolean(config.medicalMode),
        customGlossary: config.customGlossary || [],
        keyterms: config.keyterms || [],
        forceRefresh: Boolean(config.forceRefresh)
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Token minting failed (${res.status}): ${errText}`);
    }
    const data = await res.json();
    this.tokenMetadata = {
      token: data.token,
      expiresAt: Date.now() + ((data.expiresIn || 60) * 1000),
      listenUrl: data.listenUrl,
      model: data.model
    };
    return data;
  }

  // --- Montaje del Grafo de Audio: Mic -> Worklet -> Gain(0) -> Destination ---
  async setupAudioGraph(stream, config, seq) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContextClass();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    await this.audioContext.audioWorklet.addModule(WORKLET_MODULE_PATH);

    if (seq !== this.startSeq) {
      if (this.audioContext.state !== 'closed') await this.audioContext.close();
      this.audioContext = null;
      return;
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.workletNode = new AudioWorkletNode(this.audioContext, WORKLET_PROCESSOR_NAME, {
      processorOptions: {
        targetSampleRate: config.sampleRate || ASR_SAMPLE_RATE,
        chunkMs: ASR_CHUNK_MS,
        silenceThreshold: ASR_VAD_SILENCE_THRESHOLD,
        hangoverSeconds: ASR_VAD_HANGOVER_SECONDS
      }
    });

    // Mute gain en 0 para mantener el pipeline de Web Audio procesando sin feedback de altavoces
    this.muteGain = this.audioContext.createGain();
    this.muteGain.gain.value = 0;

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.muteGain);
    this.muteGain.connect(this.audioContext.destination);

    this.workletNode.port.onmessage = (event) => {
      this.handlePcm(event.data);
    };

    // Reanudar contexto y reconectar socket si la pestaña vuelve a ser visible
    if (typeof document !== 'undefined') {
      this.onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          this.wasActiveBeforeHidden = this.isActive;
        } else if (document.visibilityState === 'visible' && this.wasActiveBeforeHidden) {
          if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
          }
          if (this.isActive && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
            console.log('[DeepgramStreaming] Pestaña visible y socket cerrado: reconectando...');
            this.reconnect(this.lastConfig, this.lastCallbacks).catch(() => {});
          }
        }
      };
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  handlePcm(buffer) {
    if (!buffer) return;
    if (buffer.byteLength % 2 !== 0) {
      buffer = buffer.slice(0, buffer.byteLength - 1);
    }
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (this.backlog.size > 0) {
        this.drainBacklog(ws);
      }
      if (ws.bufferedAmount > ASR_MAX_WS_BUFFERED_BYTES) {
        this.backlog.push(buffer);
        return;
      }
      ws.send(buffer);
      this.markFirstByteSent();
      return;
    }
    this.backlog.push(buffer);
  }

  drainBacklog(ws) {
    this.backlog.drain((buf) => {
      if (ws.bufferedAmount > ASR_MAX_WS_BUFFERED_BYTES) return false;
      ws.send(buf);
      this.markFirstByteSent();
      return true;
    });
  }

  markFirstByteSent() {
    if (this.firstByteSentAt !== null) return;
    this.firstByteSentAt = performance.now();
    this.firstPartialTimer = setTimeout(() => {
      if (!this.firstPartialSeen) {
        this.setStatus('degraded');
        if (this.onFirstPartialTimeout) this.onFirstPartialTimeout();
      }
    }, ASR_FIRST_PARTIAL_TIMEOUT_MS);
  }

  clearFirstPartialTimer() {
    if (this.firstPartialTimer) {
      clearTimeout(this.firstPartialTimer);
      this.firstPartialTimer = null;
    }
  }

  // --- Conexión WebSocket a Deepgram ---
  openWebSocket(config, callbacks) {
    this.firstByteSentAt = null;
    this.firstPartialSeen = false;
    this.clearFirstPartialTimer();
    this.onFirstPartialLatency = callbacks.onFirstPartialLatency;
    const isEnglish = (config.language === 'en' || (typeof config.language === 'string' && config.language.startsWith('en-')));
    const fallbackModel = isEnglish ? 'nova-3' : 'nova-2';

    const params = new URLSearchParams({
      model: config.model || fallbackModel,
      language: config.language || 'multi',
      encoding: 'linear16',
      sample_rate: String(config.sampleRate || ASR_SAMPLE_RATE),
      channels: '1',
      interim_results: 'true',
      smart_format: 'true',
      endpointing: String(ASR_ENDPOINTING_MS),
      utterance_end_ms: String(ASR_UTTERANCE_END_MS)
    });

    for (const term of config.keyterms || []) {
      params.append('keyterm', term);
    }

    if (config.mipOptOut || config.medicalMode) {
      params.append('mip_opt_out', 'true');
    }

    const listenUrl = config.listenUrl || 'wss://api.deepgram.com/v1/listen';
    const subprotocol = ['bearer', config.token];

    const ws = new WebSocket(`${listenUrl}?${params.toString()}`, subprotocol);
    this.ws = ws;

    const connectTimer = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn('[DeepgramStreaming] WebSocket connection timed out after 8000ms');
        try {
          ws.close();
        } catch (e) {}
      }
    }, 8000);

    ws.onopen = () => {
      clearTimeout(connectTimer);
      this.setStatus('listening');
      this.reconnectAttempts = 0;
      if (callbacks.onOpen) callbacks.onOpen();
      this.drainBacklog(ws);

      this.keepAliveTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      }, ASR_KEEPALIVE_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (!this.isActive || this.ws !== ws) return;
      if (typeof event.data !== 'string') return;
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        return;
      }

      if (data.type && data.type !== 'Results') return;
      const transcript = data.channel?.alternatives?.[0]?.transcript ?? '';
      if (!transcript) return;

      if (!this.firstPartialSeen && this.firstByteSentAt !== null) {
        this.firstPartialSeen = true;
        this.clearFirstPartialTimer();
        const latency = performance.now() - this.firstByteSentAt;
        if (this.onFirstPartialLatency) this.onFirstPartialLatency(latency);
        this.setStatus('listening');
      }

      const isFinal = Boolean(data.is_final);
      if (callbacks.onTranscript) {
        callbacks.onTranscript({
          transcript: transcript.trim(),
          isFinal,
          detectedLanguage: data.channel?.detected_language || config.language
        });
      }
    };

    ws.onerror = () => {
      clearTimeout(connectTimer);
      // ws.onclose maneja la reconexión
    };

    ws.onclose = (event) => {
      clearTimeout(connectTimer);
      this.clearKeepAlive();
      this.clearFirstPartialTimer();
      const isAuthFailure = event.code === 1008 || event.code === 4401 || event.code === 4403 ||
        (typeof event.reason === 'string' && /auth|token|unauthorized|expired/i.test(event.reason));

      if (this.isActive) {
        this.setStatus('reconnecting');
        const reasonMsg = isAuthFailure
          ? `Token de concesión caducado o rechazado (${event.code})`
          : (event.code !== 1000 ? `Cierre anormal (${event.code}: ${event.reason || 'red'})` : 'Cierre de socket (1000)');
        this.scheduleReconnect(reasonMsg, isAuthFailure);
      }
      if (callbacks.onClose) {
        callbacks.onClose({ code: event.code, wasClean: event.wasClean });
      }
    };
  }

  scheduleReconnect(reason = '', forceRefreshToken = false) {
    if (!this.isActive) return;
    const maxAttempts = this.maxReconnectAttempts || 15;

    if (this.reconnectAttempts < maxAttempts) {
      this.reconnectAttempts++;
      // Fase 1 (intentos 1 a 4): retroceso rápido (1s, 1.4s, 2s, 2.8s) para microcortes
      // Fase 2 (intentos 5 a 15): intervalo sostenido de 5s para migraciones de red / roaming Wi-Fi
      const delay = this.reconnectAttempts <= 4
        ? Math.min(1000 * Math.pow(1.4, this.reconnectAttempts - 1), 3500)
        : 5000;
      console.warn(`[DeepgramStreaming] ${reason}. Auto-reconexión #${this.reconnectAttempts}/${maxAttempts} en ${Math.round(delay)}ms`);

      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        if (!this.isActive) return;
        this.reconnect(this.lastConfig, this.lastCallbacks, forceRefreshToken).catch((err) => {
          console.error(`[DeepgramStreaming] Intento de reconexión #${this.reconnectAttempts} falló:`, err);
          this.scheduleReconnect(err.message || 'Error en reconexión', forceRefreshToken);
        });
      }, delay);
    } else {
      console.error(`[DeepgramStreaming] Máximo de reintentos alcanzado (${maxAttempts}). Activando fallback de emergencia.`);
      this.isActive = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.setStatus('error');
      if (this.lastCallbacks && this.lastCallbacks.onError) {
        this.lastCallbacks.onError(new Error(`Deepgram reconnection exhausted after ${maxAttempts} attempts`));
      }
    }
  }

  closeSocketOnly() {
    this.clearKeepAlive();
    this.clearFirstPartialTimer();
    const ws = this.ws;
    if (!ws) return;

    this.ws = null;
    ws.onopen = null;
    ws.onerror = null;

    if (ws.readyState !== WebSocket.OPEN) {
      ws.onmessage = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch (e) {}
      return;
    }

    // Grace de drenaje (#852): enviar CloseStream y esperar recepción de últimos finales
    let drainTimer = null;
    let finalized = false;

    const finalize = () => {
      if (finalized) return;
      finalized = true;
      if (drainTimer) {
        clearTimeout(drainTimer);
        drainTimer = null;
      }
      ws.onmessage = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch (e) {}
    };

    try {
      ws.send(JSON.stringify({ type: 'CloseStream' }));
      ws.onclose = () => finalize();
      drainTimer = setTimeout(finalize, ASR_CLOSE_DRAIN_TIMEOUT_MS);
    } catch (e) {
      finalize();
    }
  }

  clearKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}

export const deepgramStreamingService = new DeepgramStreamingService();
