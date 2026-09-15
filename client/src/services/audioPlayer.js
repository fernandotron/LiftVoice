/**
 * LiftVoice Low-Latency Web Audio API Player & Background Audio Keeper (2026 Edition)
 * Sequential FIFO Decode & Playout Queue with Jitter Buffer, AudioWorklet Playout & Screen-Lock Support
 */

import { WsolaTimeStretcher } from './audio/wsolaEngine.js';
import { AdaptiveJitterBuffer } from './audio/adaptiveJitterBuffer.js';

let cachedSilentUrl = null;
function getSilentAudioUrl() {
  if (cachedSilentUrl) return cachedSilentUrl;
  if (typeof window === 'undefined' || typeof Blob === 'undefined') return '';
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate; // exactly 1.0 second duration
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false); // 'RIFF'
    view.setUint32(4, 36 + numSamples, true);
    view.setUint32(8, 0x57415645, false); // 'WAVE'

    view.setUint32(12, 0x666d7420, false); // 'fmt '
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true); // BlockAlign
    view.setUint16(34, 8, true); // 8-bit

    view.setUint32(36, 0x64617461, false); // 'data'
    view.setUint32(40, numSamples, true);

    const bytes = new Uint8Array(buffer, 44);
    bytes.fill(128); // 8-bit PCM silence

    const blob = new Blob([buffer], { type: 'audio/wav' });
    cachedSilentUrl = URL.createObjectURL(blob);
    return cachedSilentUrl;
  } catch (e) {
    return '';
  }
}

class AudioPlayerService {
  constructor() {
    this.audioCtx = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.lowCutFilter = null;
    this.deEsserFilter = null;
    this.limiterNode = null;
    this.playbackEpoch = 0;
    this.comfortAudioEnabled = true;
    this.bgAudioElement = null; // Background HTML5 Audio keeper
    this.htmlAudioTag = null; // Dedicated HTML5 Audio element for screen-lock mobile playback
    this.mobileAudioQueue = [];
    this.isMobilePlaying = false;
    this.wakeLock = null;
    this.isUnlocked = false;
    this.isMuted = false;
    this.volume = 1.0;
    this.playbackRate = 1.0;
    this.basePlaybackRate = 1.0;
    this.nextStartTime = 0;
    this.activeSources = new Set();
    this.currentLanguage = 'es';
    this.currentRoomId = 'MAIN';
    this.isPlaying = false;
    this.onStateChangeCallbacks = new Set();

    // Playout Queue & Jitter Buffer
    this.decodeQueue = Promise.resolve();
    this.decodeQueueDepth = 0;
    this.playoutLeadTime = 0.05; // 50ms smooth lead-time
    this.suspendedChunks = [];
    this.pendingWorkletChunks = [];
    this.isUnlocking = false;

    // Control de secuencia determinista para evitar reproducción desordenada
    this.lastProcessedSeqByLang = new Map();

    // AudioWorklet Continuous Playout & WSOLA (2026 Edition)
    this.workletNode = null;
    this.workletReady = false;
    this.workletLoading = false;
    this.stretcher = null;
    this.jitterController = new AdaptiveJitterBuffer({ targetLatencyMs: 80 });
    this.currentBufferedSamples = 0;
    this.mediaStreamDest = null;
    this.carrierAudioElement = null;

    this.activeUtterances = new Set();

    this.speechLangs = {
      en: 'en-US',
      es: 'es-ES',
      it: 'it-IT',
      pt: 'pt-BR',
      fr: 'fr-FR',
      de: 'de-DE',
      zh: 'zh-CN',
      ja: 'ja-JP',
      ar: 'ar-SA',
      ru: 'ru-RU',
      ko: 'ko-KR',
      hi: 'hi-IN'
    };

    this.isDisposed = false;
    this._listenersBound = false;
    this._recoveryTimer = null;
    this._recoveryAttempts = 0;
    this.handleWakeResume = null;
    this.handleUserGestureResume = null;

    this._bindGlobalListeners();
  }

  /**
   * Idempotently constructs and connects the complete Web Audio DSP graph.
   * Signal chain: source -> chunkGain -> lowCutFilter -> deEsserFilter -> gainNode -> limiterNode -> analyserNode -> destination
   */
  _ensureAudioGraph() {
    const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!AudioContextClass) return null;

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContextClass();
      this._attachAudioContextListeners();
    }

    // 1-5. Construir y asegurar nodos DSP principales si no existen
    if (!this.gainNode) {
      // 1. High-pass filter calibrado a 75 Hz (Butterworth Q=0.7071) para preservar fundamentales masculinos a 80-85 Hz
      this.lowCutFilter = this.audioCtx.createBiquadFilter();
      this.lowCutFilter.type = 'highpass';
      this.lowCutFilter.frequency.setValueAtTime(75, this.audioCtx.currentTime);
      this.lowCutFilter.Q.setValueAtTime(0.7071, this.audioCtx.currentTime);

      // 2. High-shelf de-esser a 6.5 kHz (-2.0 dB) para suprimir sibilancias neuronales
      this.deEsserFilter = this.audioCtx.createBiquadFilter();
      this.deEsserFilter.type = 'highshelf';
      this.deEsserFilter.frequency.setValueAtTime(6500, this.audioCtx.currentTime);
      this.deEsserFilter.gain.setValueAtTime(this.comfortAudioEnabled ? -2.0 : 0.0, this.audioCtx.currentTime);

      // 3. Master gain node (control de volumen hasta 2.0x)
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime);

      // 4. Brickwall Peak Limiter (EBU R128 calibrado: -2.5 dBFS threshold, attack ultra-rápido 1ms, release 220ms, ratio 20:1)
      this.limiterNode = this.audioCtx.createDynamicsCompressor();
      this.limiterNode.threshold.setValueAtTime(-2.5, this.audioCtx.currentTime);
      this.limiterNode.knee.setValueAtTime(3.0, this.audioCtx.currentTime);
      this.limiterNode.ratio.setValueAtTime(20.0, this.audioCtx.currentTime);
      this.limiterNode.attack.setValueAtTime(0.001, this.audioCtx.currentTime);
      this.limiterNode.release.setValueAtTime(0.220, this.audioCtx.currentTime);

      // 5. Analyser node para visualizadores
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Conexión del grafo DSP maestro
      this.lowCutFilter.connect(this.deEsserFilter);
      this.deEsserFilter.connect(this.gainNode);
      this.gainNode.connect(this.limiterNode);
      this.limiterNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);
    }

    // 6. Mobile Background Audio Bridge: Recrear si fue destruido en disposeSession
    // Conectado POST-LIMITADOR (limiterNode) para evitar recorte en segundo plano al subir volumen
    if (!this.mediaStreamDest && typeof this.audioCtx.createMediaStreamDestination === 'function') {
      try {
        this.mediaStreamDest = this.audioCtx.createMediaStreamDestination();
        if (this.limiterNode) {
          this.limiterNode.connect(this.mediaStreamDest);
        } else if (this.gainNode) {
          this.gainNode.connect(this.mediaStreamDest);
        }
        if (!this.carrierAudioElement && typeof document !== 'undefined') {
          this.carrierAudioElement = document.createElement('audio');
          this.carrierAudioElement.srcObject = this.mediaStreamDest.stream;
          this.carrierAudioElement.setAttribute('playsinline', 'true');
          this.carrierAudioElement.setAttribute('webkit-playsinline', 'true');
          this.carrierAudioElement.style.display = 'none';
          document.body.appendChild(this.carrierAudioElement);
        }
      } catch (e) {
        console.warn('[AudioPlayer] MediaStreamDestination setup fallback:', e);
      }
    }

    // 7. Inicializar AudioWorklet Continuous Playout Processor si no existe
    if (this.audioCtx.audioWorklet && !this.workletLoading && !this.workletReady && !this.workletNode) {
      this.workletLoading = true;
      this.audioCtx.audioWorklet.addModule('/stream-playout-worklet.js')
        .then(() => {
          if (!this.audioCtx || this.audioCtx.state === 'closed' || this.isDisposed) return;
          this.workletNode = new AudioWorkletNode(this.audioCtx, 'stream-playout-processor', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2]
          });
          this.stretcher = new WsolaTimeStretcher(this.audioCtx.sampleRate || 48000);
          this.workletNode.port.onmessage = (e) => {
            if (e.data && e.data.type === 'status') {
              this.currentBufferedSamples = e.data.bufferedSamples || 0;
              const isPlayingWorklet = this.currentBufferedSamples > 128;
              if (this.isPlaying !== isPlayingWorklet && this.activeSources.size === 0) {
                this.isPlaying = isPlayingWorklet;
                this.notifyState();
              }
            }
          };
          this.workletNode.connect(this.lowCutFilter || this.gainNode);
          this.workletReady = true;
          this.workletLoading = false;
          console.log('[AudioPlayer] 🚀 Ultra-low latency Stream Playout Worklet initialized.');
          this._drainPendingWorkletChunks();
        })
        .catch((err) => {
          console.warn('[AudioPlayer] AudioWorklet load fallback to scheduled buffer:', err);
          this.workletLoading = false;
          this.workletReady = false;
          this._drainPendingWorkletChunks();
        });
    }

    return this.audioCtx;
  }

  _attachAudioContextListeners() {
    if (!this.audioCtx) return;
    this.audioCtx.onstatechange = () => {
      const state = this.audioCtx ? this.audioCtx.state : 'closed';
      console.log(`[AudioPlayer] 🔊 AudioContext onstatechange: ${state}`);
      if (state === 'running') {
        if (this.carrierAudioElement && this.carrierAudioElement.paused) {
          this.carrierAudioElement.play().catch(() => {});
        }
        if (this.bgAudioElement && this.bgAudioElement.paused && this.isMobileDevice()) {
          this.bgAudioElement.play().catch(() => {});
        }
        this.flushSuspendedChunks();
      } else if (state === 'interrupted' || state === 'suspended') {
        if (!this.isDisposed && this.isUnlocked && !this.isMuted) {
          this._attemptCallHangupRecovery();
        }
      }
      this.notifyState();
    };
  }

  _attemptCallHangupRecovery() {
    if (this._recoveryTimer) clearTimeout(this._recoveryTimer);
    const recover = async () => {
      if (this.isDisposed || !this.isUnlocked || this.isMuted) return;
      if (this.audioCtx && (this.audioCtx.state === 'interrupted' || this.audioCtx.state === 'suspended')) {
        try {
          await this.audioCtx.resume();
          if (this.audioCtx.state === 'running') {
            console.log('[AudioPlayer] 📞 AudioContext recuperado tras interrupción/llamada.');
            if (this.carrierAudioElement && this.carrierAudioElement.paused) {
              this.carrierAudioElement.play().catch(() => {});
            }
            if (this.bgAudioElement && this.bgAudioElement.paused && this.isMobileDevice()) {
              this.bgAudioElement.play().catch(() => {});
            }
            this.flushSuspendedChunks();
            this.notifyState();
            return;
          }
        } catch (e) {}
        if (this._recoveryAttempts < 6) {
          this._recoveryAttempts++;
          this._recoveryTimer = setTimeout(recover, 350 * this._recoveryAttempts);
        }
      }
    };
    this._recoveryAttempts = 0;
    this._recoveryTimer = setTimeout(recover, 300);
  }

  _drainPendingWorkletChunks() {
    if (!this.pendingWorkletChunks || this.pendingWorkletChunks.length === 0) return;
    const queue = [...this.pendingWorkletChunks];
    this.pendingWorkletChunks = [];
    for (const chunk of queue) {
      this.playAudioChunk(chunk);
    }
  }

  _bindGlobalListeners() {
    if (typeof window === 'undefined' || typeof document === 'undefined' || this._listenersBound) return;

    // Auto-resume audio context when tab visibility changes or device wakes up
    this.handleWakeResume = () => {
      if (this.isDisposed) return;
      if (this.audioCtx && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted') && this.isUnlocked && !this.isMuted) {
        this.audioCtx.resume().catch(() => {});
      }
      if (document.visibilityState === 'visible' && !this.isDisposed && this.isUnlocked) {
        this.requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', this.handleWakeResume);
    window.addEventListener('pageshow', this.handleWakeResume);
    window.addEventListener('focus', this.handleWakeResume);

    // iOS Safari / Android touch recovery: unlock and resume audio on first physical touch
    this.handleUserGestureResume = () => {
      if (this.isDisposed) return;
      if (!this.isUnlocked) {
        this.unlockAudio(this.currentRoomId, this.currentLanguage).catch(() => {});
      } else if (this.audioCtx && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted') && !this.isMuted) {
        this.audioCtx.resume().then(() => this.flushSuspendedChunks()).catch(() => {});
      }
    };
    window.addEventListener('touchstart', this.handleUserGestureResume, { passive: true });
    window.addEventListener('touchend', this.handleUserGestureResume, { passive: true });
    window.addEventListener('click', this.handleUserGestureResume, { passive: true });

    this._listenersBound = true;
  }

  _unbindGlobalListeners() {
    if (typeof window === 'undefined' || !this._listenersBound) return;

    if (this.handleWakeResume) {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.handleWakeResume);
      }
      window.removeEventListener('pageshow', this.handleWakeResume);
      window.removeEventListener('focus', this.handleWakeResume);
      this.handleWakeResume = null;
    }

    if (this.handleUserGestureResume) {
      window.removeEventListener('touchstart', this.handleUserGestureResume);
      window.removeEventListener('touchend', this.handleUserGestureResume);
      window.removeEventListener('click', this.handleUserGestureResume);
      this.handleUserGestureResume = null;
    }

    this._listenersBound = false;
  }

  async resumeAudio() {
    if (this.audioCtx && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted')) {
      await this.audioCtx.resume();
      this.flushSuspendedChunks();
      this.notifyState();
    }
  }

  async resumeSuspendedContext() {
    return this.resumeAudio();
  }

  isContextSuspended() {
    return Boolean(this.audioCtx && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted'));
  }

  flushSuspendedChunks() {
    if (this.suspendedChunks && this.suspendedChunks.length > 0) {
      const chunks = [...this.suspendedChunks];
      this.suspendedChunks = [];
      for (const pkt of chunks) {
        this.playAudioChunk(pkt);
      }
    }
  }

  setComfortAudio(enabled) {
    this.comfortAudioEnabled = Boolean(enabled);
    if (this.deEsserFilter && this.audioCtx) {
      const gainVal = this.comfortAudioEnabled ? -2.0 : 0.0;
      this.deEsserFilter.gain.setTargetAtTime(gainVal, this.audioCtx.currentTime, 0.05);
    }
  }

  /**
   * Universal Web Audio decoder supporting legacy and modern Safari / WebKit and Android
   */
  decodeAudioDataSafe(arrayBuffer) {
    return new Promise((resolve, reject) => {
      if (!this.audioCtx) {
        return reject(new Error('No AudioContext initialized'));
      }
      // Clone buffer to avoid detachment issues in WebKit
      const bufferCopy = arrayBuffer.slice(0);
      let settled = false;

      const onSuccess = (decoded) => {
        if (!settled) {
          settled = true;
          resolve(decoded);
        }
      };

      const onError = (err) => {
        if (!settled) {
          settled = true;
          reject(err || new Error('decodeAudioData failed'));
        }
      };

      try {
        const promise = this.audioCtx.decodeAudioData(bufferCopy, onSuccess, onError);
        if (promise && typeof promise.then === 'function') {
          promise.then(onSuccess).catch(onError);
        }
      } catch (e) {
        onError(e);
      }
    });
  }

  /**
   * Plays a pleasant brief chime to test audio output on headphones/speakers
   */
  playAudioTestTone() {
    this._ensureAudioGraph();
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted') {
        this.audioCtx.resume().catch(() => {});
      }
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const testGain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      testGain.gain.setValueAtTime(0.001, now);
      testGain.gain.linearRampToValueAtTime(0.12, now + 0.03);
      testGain.gain.linearRampToValueAtTime(0.001, now + 0.38);
      osc.connect(testGain);
      testGain.connect(this.lowCutFilter || this.gainNode || this.audioCtx.destination);
      osc.onended = () => {
        try {
          osc.disconnect();
          testGain.disconnect();
        } catch (e) {}
      };
      osc.start(now);
      osc.stop(now + 0.38);
    }
  }

  /**
   * Initialize background audio keeper and unlock Web Audio Context
   */
  async unlockAudio(roomId = 'MAIN', lang = 'es') {
    this.isDisposed = false;
    this._bindGlobalListeners();
    if (this.isUnlocking) return true;
    this.isUnlocking = true;
    this.currentRoomId = roomId;
    this.currentLanguage = lang;

    try {
      // 1. Initialize Web Audio Context & DSP graph
      this._ensureAudioGraph();

      // 2. Hardware Output Priming (Wakes up iOS Safari / Android media hardware routes synchronously within user gesture token)
      if (this.audioCtx) {
        try {
          const silentBuf = this.audioCtx.createBuffer(1, 1, 22050);
          const dummySource = this.audioCtx.createBufferSource();
          dummySource.buffer = silentBuf;
          dummySource.connect(this.audioCtx.destination);
          dummySource.start(0);
        } catch (e) {}
      }

      if (this.carrierAudioElement && this.carrierAudioElement.paused) {
        this.carrierAudioElement.play().catch(() => {});
      }

      if (this.audioCtx && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted')) {
        await this.audioCtx.resume();
      }

      // 3. Start HTML5 Background Audio Keeper for Screen-Lock Playback
      this.initBackgroundAudioKeeper();

      // 4. Register Native Lock Screen Controls via MediaSession API
      this.setupMediaSession();

      // 5. Request Screen WakeLock (optional, when in foreground)
      this.requestWakeLock();

      this.isUnlocked = true;
      this.flushSuspendedChunks();
      this.notifyState();
      return true;
    } catch (err) {
      console.warn('[AudioPlayer] unlockAudio error:', err);
      return false;
    } finally {
      this.isUnlocking = false;
    }
  }

  initBackgroundAudioKeeper() {
    if (this.isDisposed) return;
    // Keep an inaudible background audio loop running to preserve OS audio session on mobile
    if (!this.isMobileDevice()) {
      return;
    }

    if (!this.bgAudioElement && typeof document !== 'undefined') {
      const silentUrl = getSilentAudioUrl();
      if (!silentUrl) return;

      this.bgAudioElement = document.createElement('audio');
      this.bgAudioElement.src = silentUrl;
      this.bgAudioElement.loop = true;
      this.bgAudioElement.volume = 0.02; // Inaudible carrier
      this.bgAudioElement.setAttribute('playsinline', 'true');
      this.bgAudioElement.setAttribute('webkit-playsinline', 'true');
      this.bgAudioElement.style.display = 'none';
      document.body.appendChild(this.bgAudioElement);
    }

    if (this.bgAudioElement && this.bgAudioElement.paused) {
      this.bgAudioElement.play().catch(() => {});
    }
  }

  setupMediaSession() {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      const langNames = { en: 'English', es: 'Español', it: 'Italiano', pt: 'Português' };
      const currentName = langNames[this.currentLanguage] || this.currentLanguage.toUpperCase();

      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Traducción en Vivo (${currentName})`,
        artist: 'LiftVoice AI • Conferencia en Directo',
        album: `Sala ${this.currentRoomId}`
      });

      navigator.mediaSession.playbackState = 'playing';

      navigator.mediaSession.setActionHandler('play', () => {
        this.setMuted(false);
        if (this.htmlAudioTag && this.htmlAudioTag.paused) this.htmlAudioTag.play().catch(() => {});
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        this.setMuted(true);
        if (this.htmlAudioTag && !this.htmlAudioTag.paused) this.htmlAudioTag.pause();
      });
    }
  }

  async requestWakeLock() {
    if (this.isDisposed) return;
    try {
      if ('wakeLock' in navigator && this.isUnlocked && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      }
    } catch (e) {
      // Wake lock not supported or failed (normal on low power mode)
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(2.0, val));
    if (this.gainNode && this.audioCtx) {
      const targetGain = this.isMuted ? 0 : this.volume;
      try {
        this.gainNode.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.015);
      } catch (e) {
        this.gainNode.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
      }
    }
    if (this.htmlAudioTag) {
      this.htmlAudioTag.volume = this.isMuted ? 0 : Math.min(1.0, this.volume);
    }
    this.notifyState();
  }

  setMasterVolume(val) {
    this.setVolume(val);
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    if (this.gainNode && this.audioCtx) {
      const targetGain = this.isMuted ? 0 : this.volume;
      try {
        this.gainNode.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.015);
      } catch (e) {
        this.gainNode.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
      }
    }
    if (this.htmlAudioTag) {
      this.htmlAudioTag.volume = this.isMuted ? 0 : Math.min(1.0, this.volume);
    }
    this.notifyState();
  }

  setPlaybackRate(rate) {
    const cleanRate = Math.max(0.8, Math.min(1.5, rate));
    this.basePlaybackRate = cleanRate;
    this.playbackRate = cleanRate;
    if (this.htmlAudioTag) {
      this.htmlAudioTag.playbackRate = this.playbackRate;
    }
    for (const item of this.activeSources) {
      try {
        const src = item.sourceNode || item;
        if (src && src.playbackRate) {
          src.playbackRate.setValueAtTime(this.playbackRate, this.audioCtx.currentTime);
        }
      } catch (e) {}
    }
    this.notifyState();
  }

  setLanguage(lang) {
    if (this.currentLanguage !== lang) {
      this.currentLanguage = lang;
      this.stopAll();
      this.setupMediaSession();
      this.notifyState();
    }
  }

  isMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    const isMobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return Boolean(isMobileUA || isIPadOS);
  }

  isBackgrounded() {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  }

  stopAll() {
    this.playbackEpoch++;
    if (this.htmlAudioTag) {
      try {
        this.htmlAudioTag.pause();
        this.htmlAudioTag.currentTime = 0;
      } catch (e) {}
    }
    while (this.mobileAudioQueue && this.mobileAudioQueue.length > 0) {
      const it = this.mobileAudioQueue.shift();
      if (it && it.url) {
        try { URL.revokeObjectURL(it.url); } catch (e) {}
      }
    }
    this.isMobilePlaying = false;

    const now = this.audioCtx ? this.audioCtx.currentTime : 0;
    for (const item of this.activeSources) {
      try {
        const src = item.sourceNode || item;
        const gain = item.chunkGain;
        if (src) src.onended = null;
        if (gain && this.audioCtx) {
          try {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.linearRampToValueAtTime(0.0001, now + 0.008); // 8ms micro-fade to prevent DC pop
          } catch (e) {}
        }
        setTimeout(() => {
          try {
            if (typeof src.stop === 'function') src.stop();
            if (typeof src.disconnect === 'function') src.disconnect();
            if (src) src.buffer = null;
            if (gain && typeof gain.disconnect === 'function') gain.disconnect();
          } catch (e) {}
        }, 10);
      } catch (e) {
      } finally {
        if (typeof item.resolvePromise === 'function') {
          item.resolvePromise();
          item.resolvePromise = null;
        }
      }
    }
    if (this.workletNode && this.workletReady) {
      try {
        this.workletNode.port.postMessage({ command: 'flush' });
      } catch (e) {}
    }
    if (this.stretcher) {
      this.stretcher.reset();
    }
    if (this.jitterController) {
      this.jitterController.reset();
    }
    this.currentBufferedSamples = 0;

    this.activeSources.clear();
    this.suspendedChunks = [];
    this.pendingWorkletChunks = [];
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    // Note: Do NOT pause this.bgAudioElement here.
    // The background audio keeper keeps mobile screen-lock playback active when switching languages.
    this.decodeQueue = Promise.resolve();
    this.decodeQueueDepth = 0;
    this.isPlaying = false;
    this.notifyState();
  }

  /**
   * Resamples Float32 audio samples when incoming rate differs from AudioContext rate
   */
  _resampleFloat32(sourceSamples, srcRate, dstRate) {
    if (!srcRate || !dstRate || srcRate === dstRate || !sourceSamples || sourceSamples.length === 0) {
      return sourceSamples;
    }
    const ratio = srcRate / dstRate;
    const newLen = Math.round(sourceSamples.length / ratio);
    const result = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const srcPos = i * ratio;
      const index = Math.floor(srcPos);
      const frac = srcPos - index;
      const s1 = sourceSamples[index] || 0;
      const s2 = sourceSamples[index + 1] !== undefined ? sourceSamples[index + 1] : s1;
      result[i] = s1 + frac * (s2 - s1); // Interpolación lineal continua
    }
    return result;
  }

  /**
   * Continuous Playout: pushes PCM samples into WSOLA time-stretcher and AudioWorklet Ring Buffer
   */
  pushToWorklet(floatSamples, timestamp) {
    if (!floatSamples || floatSamples.length === 0 || !this.workletReady || !this.workletNode || !this.stretcher) {
      return false;
    }
    this.jitterController.onPacketArrival(timestamp);
    this.stretcher.writeInput(floatSamples);

    // Amortiguación combinada: muestras en ring buffer del Worklet + cola interna de WSOLA
    const totalBuffered = this.currentBufferedSamples + (this.stretcher.samplesAvailable || 0);
    const rate = this.jitterController.computeOptimalPlaybackRate(
      totalBuffered,
      this.audioCtx ? this.audioCtx.sampleRate : 48000
    );
    const stretched = this.stretcher.process(rate);
    if (stretched && stretched.length > 0) {
      this.workletNode.port.postMessage(
        { type: 'push', samples: stretched },
        [stretched.buffer]
      );
      this.isPlaying = true;
      this.notifyState();
      return true;
    }
    return false;
  }

  _enqueueDecodeTask(taskFn) {
    // Si la cadena de promesas supera 25 ejecuciones continuas, regenerar la raíz para liberar GC
    if (this.decodeQueueDepth > 25) {
      this.decodeQueue = Promise.resolve();
      this.decodeQueueDepth = 0;
    }
    this.decodeQueueDepth++;
    this.decodeQueue = this.decodeQueue
      .catch(() => {})
      .then(taskFn)
      .finally(() => {
        this.decodeQueueDepth = Math.max(0, this.decodeQueueDepth - 1);
      });
  }

  /**
   * Queue and play incoming audio packet in strict sequential order (Universal Web Audio API)
   */
  playAudioChunk(packet) {
    if (this.isMuted || !packet) return;

    if (packet.lang && !packet.isBoothAudio && !packet.isHostPreview && packet.lang !== this.currentLanguage) {
      return;
    }

    // Comprobación de secuencia determinista: descartar paquetes residuales u obsoletos
    const packetLang = packet.lang || this.currentLanguage;
    const seq = Number(packet.seqId) || 0;
    if (seq > 0) {
      const lastSeq = this.lastProcessedSeqByLang.get(packetLang) || 0;
      if (lastSeq > 0) {
        const diff = (seq - lastSeq) & 0xFFFF;
        const isOlder = diff > 0x8000;
        const stepBack = (lastSeq - seq) & 0xFFFF;
        // Descartar si es estrictamente anterior en la ventana actual
        if (isOlder && stepBack < 300) {
          console.warn(`[AudioPlayer] 🛑 Descartado paquete obsoleto: seq ${seq} < lastSeq ${lastSeq}`);
          return;
        }
      }
      this.lastProcessedSeqByLang.set(packetLang, seq);
    }

    // Si el Worklet se está descargando en red, encolar para evitar colisión de doble reproducción
    if (this.workletLoading) {
      this.pendingWorkletChunks.push(packet);
      return;
    }

    // Direct path 1: Raw Float32 PCM samples (Zero decode latency)
    if (packet.pcmFloat32 && this.workletReady) {
      let samples = packet.pcmFloat32;
      if (packet.sampleRate && this.audioCtx && packet.sampleRate !== this.audioCtx.sampleRate) {
        samples = this._resampleFloat32(samples, packet.sampleRate, this.audioCtx.sampleRate);
      }
      const ok = this.pushToWorklet(samples, packet.timestamp);
      if (ok) return;
    }

    // Direct path 2: Raw Int16 PCM samples
    if (packet.pcmInt16 && this.workletReady) {
      const i16 = packet.pcmInt16;
      let f32 = new Float32Array(i16.length);
      for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768.0;
      if (packet.sampleRate && this.audioCtx && packet.sampleRate !== this.audioCtx.sampleRate) {
        f32 = this._resampleFloat32(f32, packet.sampleRate, this.audioCtx.sampleRate);
      }
      const ok = this.pushToWorklet(f32, packet.timestamp);
      if (ok) return;
    }

    // Direct path 3: Binary ArrayBuffer payload from LVBP v1.1 (Zero Base64 overhead)
    if (packet.binaryPayload instanceof ArrayBuffer) {
      this._enqueueDecodeTask(async () => {
        try {
          const startEpoch = this.playbackEpoch;
          const audioBuffer = await this.decodeAudioDataSafe(packet.binaryPayload);
          if (!audioBuffer || startEpoch !== this.playbackEpoch) return;

          // Descartar si el oyente cambió de canal o idioma durante la decodificación
          if (packet.lang && !packet.isBoothAudio && !packet.isHostPreview && packet.lang !== this.currentLanguage) {
            return;
          }

          if (this.workletReady && this.stretcher) {
            const channelData = audioBuffer.getChannelData(0);
            this.pushToWorklet(channelData, packet.timestamp);
            return;
          }
          await this.processAndScheduleDecodedBuffer(audioBuffer, packet);
        } catch (e) {
          console.warn('[AudioPlayer] Direct binary decode fallback:', e);
        }
      });
      return;
    }

    // Sequence through FIFO decode queue on Web Audio API (Universal for Desktop, iOS Safari & Android)
    this._enqueueDecodeTask(async () => {
      const rawBase64 = packet.audioBase64 || packet.audio;
      if (rawBase64) {
        try {
          await this.processAndScheduleBase64Chunk({ ...packet, audioBase64: rawBase64 });
        } catch (err) {
          console.warn('[AudioPlayer] Decode failed, falling back to Web Speech:', err);
          if (packet.text) {
            await this.playSpeechSynthesisAsync(packet.text, packet.lang);
          }
        }
      } else if (packet.text) {
        await this.playSpeechSynthesisAsync(packet.text, packet.lang);
      }
    });
  }

  async processAndScheduleBase64Chunk(packet) {
    this._ensureAudioGraph();

    if (this.audioCtx && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted')) {
      try {
        await this.audioCtx.resume();
      } catch (e) {}
    }

    // If context is still suspended (waiting for user gesture on mobile), buffer packet so it plays when touched
    if (this.isContextSuspended()) {
      if (!this.suspendedChunks) this.suspendedChunks = [];
      this.suspendedChunks.push(packet);
      if (this.suspendedChunks.length > 10) this.suspendedChunks.shift();
      return;
    }

    // Clean whitespace/newlines from base64
    const cleanBase64 = String(packet.audioBase64).replace(/\s/g, '');
    const binaryStr = window.atob(cleanBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const currentEpoch = this.playbackEpoch;
    // Decode audio data safely across all browsers
    const audioBuffer = await this.decodeAudioDataSafe(bytes.buffer);
    if (!audioBuffer || currentEpoch !== this.playbackEpoch) return;

    // Discard chunk if language changed while decoding was asynchronously running
    if (packet.lang && !packet.isBoothAudio && !packet.isHostPreview && packet.lang !== this.currentLanguage) {
      return;
    }

    // Worklet Playout & WSOLA path: pipe decoded channel data directly into ring buffer
    if (this.workletReady && this.stretcher) {
      try {
        const channelData = audioBuffer.getChannelData(0);
        if (channelData && channelData.length > 0) {
          const ok = this.pushToWorklet(channelData, packet.timestamp);
          if (ok) return;
        }
      } catch (e) {
        console.warn('[AudioPlayer] Worklet push error, falling back to scheduled source:', e);
      }
    }

    await this.processAndScheduleDecodedBuffer(audioBuffer, packet);
  }

  async processAndScheduleDecodedBuffer(audioBuffer, packet) {
    const now = this.audioCtx.currentTime;
    // Clean up stale nextStartTime if it drifted into the past or wildly ahead
    if (this.activeSources.size === 0 && (this.nextStartTime < now || this.nextStartTime > now + 1.0)) {
      this.nextStartTime = now;
    }

    // Adaptive catch-up rate calculation: anti-chipmunk curve with Hard Resync
    const baseRate = this.basePlaybackRate || this.playbackRate || 1.0;
    const queueLeadTime = Math.max(0, this.nextStartTime - now);
    let effectiveRate = baseRate;
    if (queueLeadTime > 4.8) {
      // Hard Resync: latency is excessive (network stutter/tab sleep); purge stale active sources and snap to live stream
      for (const item of this.activeSources) {
        try {
          const src = item.sourceNode || item;
          if (src) src.onended = null;
          if (typeof src.stop === 'function') src.stop();
          if (typeof src.disconnect === 'function') src.disconnect();
          if (item.chunkGain && typeof item.chunkGain.disconnect === 'function') item.chunkGain.disconnect();
        } catch (e) {}
      }
      this.activeSources.clear();
      this.nextStartTime = now;
      effectiveRate = baseRate;
    } else if (queueLeadTime > 3.2) {
      effectiveRate = Math.min(1.025, baseRate * 1.025); // Cap at +42 cents max to eliminate chipmunk effect
    } else if (queueLeadTime > 1.8) {
      effectiveRate = Math.min(1.015, baseRate * 1.015); // Smooth imperceptible drift recovery
    }

    const sourceNode = this.audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.setValueAtTime(effectiveRate, this.audioCtx.currentTime);

    // Micro cross-fade gain node to eliminate clicks at chunk boundaries
    const chunkGain = this.audioCtx.createGain();
    sourceNode.connect(chunkGain);
    chunkGain.connect(this.lowCutFilter || this.gainNode);

    // If chaining onto an existing active stream, start precisely at nextStartTime; otherwise give 60ms lead time
    const isChaining = this.activeSources.size > 0 && this.nextStartTime > now;
    const startTime = isChaining ? this.nextStartTime : Math.max(now + 0.06, this.nextStartTime);
    const duration = audioBuffer.duration / effectiveRate;

    // Apply smooth linear 8ms equal-power cross-fade
    const fade = Math.min(0.008, duration / 4);
    if (fade > 0.002 && duration > fade * 2) {
      chunkGain.gain.setValueAtTime(0.001, startTime);
      chunkGain.gain.linearRampToValueAtTime(1.0, startTime + fade);
      const sustainEnd = Math.max(startTime + fade + 0.002, startTime + duration - fade);
      if (sustainEnd < startTime + duration) {
        chunkGain.gain.setValueAtTime(1.0, sustainEnd);
        chunkGain.gain.linearRampToValueAtTime(0.001, startTime + duration);
      }
    }

    sourceNode.start(startTime);
    // Overlap consecutive chunks by 8ms to eliminate gaps and baches between utterances
    this.nextStartTime = Math.max(now, startTime + duration - 0.008);
    const activeItem = { sourceNode, chunkGain };
    this.activeSources.add(activeItem);
    this.isPlaying = true;
    this.notifyState();

    sourceNode.onended = () => {
      sourceNode.onended = null; // Break circular closure immediately to allow GC
      this.activeSources.delete(activeItem);
      try {
        sourceNode.disconnect();
        chunkGain.disconnect();
        sourceNode.buffer = null; // Free decompressed PCM audio buffer immediately for V8 GC
      } catch (e) {}
      if (this.activeSources.size === 0) {
        this.decodeQueue = Promise.resolve(); // Break indefinite promise chaining during pauses
        if (this.audioCtx && this.audioCtx.currentTime >= this.nextStartTime) {
          this.isPlaying = false;
          this.notifyState();
        }
      }
    };
  }

  /**
   * Instantly auditions a voice card like a music playlist.
   * Immediately stops any currently playing audio track and plays the new voice.
   */
  async playVoicePreview({ voiceId, voiceName, lang = 'es', text = '', audioBase64 = null, mimeType = 'audio/mp3', gender = 'female' }) {
    // 1. Immediately cut off any ongoing playback (playlist behavior)
    this.stopAll();

    const profile = VOICE_PROFILES[voiceId] || {
      pitch: gender === 'male' ? 0.80 : 1.08,
      rate: 1.0,
      detune: gender === 'male' ? -300 : 80,
      gender: gender || 'female'
    };

    // If server returned audio and it's from a configured cloud provider, or playable base64:
    if (audioBase64) {
      try {
        // Afinación natural pura (detune = 0) para garantizar fidelidad 1:1 idéntica a la emisión en directo
        await this.playDetunedAudioBase64(audioBase64, 0);
        return;
      } catch (err) {
        console.warn('[AudioPlayer] Preview base64 decode failed, falling back to Web Speech:', err);
      }
    }

    // High quality distinct Web Speech preview with narrator persona
    await this.playWebSpeechWithPersona(text, lang, profile);
  }

  async playDetunedAudioBase64(audioBase64, detuneCents = 0) {
    this._ensureAudioGraph();
    if (this.audioCtx && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted')) {
      await this.audioCtx.resume();
    }

    const cleanBase64 = String(audioBase64).replace(/\s/g, '');
    const binaryStr = window.atob(cleanBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const currentEpoch = this.playbackEpoch;
    const audioBuffer = await this.decodeAudioDataSafe(bytes.buffer);
    if (!audioBuffer || currentEpoch !== this.playbackEpoch) return;
    const sourceNode = this.audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    
    // Apply narrator detuning (pitch modulation)
    if (sourceNode.detune && detuneCents !== 0) {
      sourceNode.detune.setValueAtTime(detuneCents, this.audioCtx.currentTime);
    }
    sourceNode.playbackRate.setValueAtTime(this.playbackRate, this.audioCtx.currentTime);

    const chunkGain = this.audioCtx.createGain();
    sourceNode.connect(chunkGain);
    chunkGain.connect(this.lowCutFilter || this.gainNode);

    const now = this.audioCtx.currentTime;
    const duration = Math.max(0.01, audioBuffer.duration / this.playbackRate);

    const rampIn = Math.min(0.02, duration * 0.25);
    const rampOut = Math.min(0.03, duration * 0.25);
    const rampInTime = now + rampIn;
    const sustainTime = Math.max(rampInTime, now + duration - rampOut);
    const rampEndTime = Math.max(sustainTime + 0.001, now + Math.max(0.01, duration));

    chunkGain.gain.setValueAtTime(0.001, now);
    chunkGain.gain.exponentialRampToValueAtTime(1.0, rampInTime);
    chunkGain.gain.setValueAtTime(1.0, sustainTime);
    chunkGain.gain.exponentialRampToValueAtTime(0.001, rampEndTime);

    let resolvePromise;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    const activeItem = { sourceNode, chunkGain, resolvePromise };

    sourceNode.start(now);
    this.activeSources.add(activeItem);
    this.isPlaying = true;
    this.notifyState();

    sourceNode.onended = () => {
      sourceNode.onended = null;
      this.activeSources.delete(activeItem);
      try {
        sourceNode.disconnect();
        chunkGain.disconnect();
      } catch (e) {}
      if (this.activeSources.size === 0) {
        this.isPlaying = false;
        this.notifyState();
      }
      if (resolvePromise) {
        resolvePromise();
        resolvePromise = null;
      }
    };

    return promise;
  }

  playWebSpeechWithPersona(text, lang = 'es', profile = {}) {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
        return resolve();
      }

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.speechLangs[lang] || lang;
        utterance.pitch = profile.pitch || 1.0;
        utterance.rate = (profile.rate || 1.0) * this.playbackRate;
        utterance.volume = this.isMuted ? 0 : Math.min(1.0, (this.volume || 1.0) * 0.55); // Normalización (-6 dB) para igualar sonoridad EBU R128 de TTS neuronales

        const voices = window.speechSynthesis.getVoices();
        const langLower = (lang || 'es').toLowerCase();
        const matchingVoices = voices.filter(v => {
          const vl = v.lang.toLowerCase().replace('_', '-');
          return vl.startsWith(langLower) || vl.includes(langLower);
        });

        if (matchingVoices.length > 0) {
          let chosenVoice = null;
          // 1. Try preferred name
          if (profile.preferredName) {
            chosenVoice = matchingVoices.find(v => v.name.toLowerCase().includes(profile.preferredName.toLowerCase()));
          }
          // 2. Try gender matching
          if (!chosenVoice && profile.gender) {
            const isMale = profile.gender === 'male';
            chosenVoice = matchingVoices.find(v => {
              const name = v.name.toLowerCase();
              return isMale
                ? (name.includes('male') || name.includes('hombre') || name.includes('david') || name.includes('pablo') || name.includes('guy') || name.includes('mark') || name.includes('cosimo') || name.includes('antonio'))
                : (name.includes('female') || name.includes('mujer') || name.includes('elvira') || name.includes('helena') || name.includes('zira') || name.includes('jenny') || name.includes('elsa') || name.includes('francisca'));
            });
          }
          utterance.voice = chosenVoice || matchingVoices[0];
        }

        if (!this.activeUtterances) this.activeUtterances = new Set();
        this.activeUtterances.add(utterance);

        let resolved = false;
        const done = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          if (this.activeUtterances) this.activeUtterances.delete(utterance);
          this.isPlaying = false;
          this.notifyState();
          resolve();
        };

        // Watchdog timeout in case browser drops onend/onerror callbacks
        const timeoutId = setTimeout(done, Math.max(3000, text.length * 120));

        utterance.onstart = () => {
          this.isPlaying = true;
          this.notifyState();
        };

        utterance.onend = done;
        utterance.onerror = done;

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error('[AudioPlayer] Speech error:', e);
        resolve();
      }
    });
  }

  playSpeechSynthesisAsync(text, lang = 'en') {
    return this.playWebSpeechWithPersona(text, lang, { pitch: 1.0, rate: 1.0 });
  }

  getFrequencyData() {
    if (!this.analyserNode) return new Uint8Array(32);
    const array = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(array);
    return array;
  }

  onStateChange(cb) {
    this.onStateChangeCallbacks.add(cb);
    return () => this.onStateChangeCallbacks.delete(cb);
  }

  async disposeSession() {
    this.isDisposed = true;
    this._unbindGlobalListeners();
    this.stopAll();
    this.suspendedChunks = [];
    if (this._recoveryTimer) {
      clearTimeout(this._recoveryTimer);
      this._recoveryTimer = null;
    }
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch (e) {}
      this.wakeLock = null;
    }
    if (this.bgAudioElement) {
      try {
        this.bgAudioElement.pause();
        this.bgAudioElement.src = '';
        if (this.bgAudioElement.parentNode) {
          this.bgAudioElement.parentNode.removeChild(this.bgAudioElement);
        }
      } catch (e) {}
      this.bgAudioElement = null;
    }
    if (this.carrierAudioElement) {
      try {
        this.carrierAudioElement.pause();
        this.carrierAudioElement.srcObject = null;
        if (this.carrierAudioElement.parentNode) {
          this.carrierAudioElement.parentNode.removeChild(this.carrierAudioElement);
        }
      } catch (e) {}
      this.carrierAudioElement = null;
    }
    if (this.mediaStreamDest) {
      try {
        if (this.limiterNode) this.limiterNode.disconnect(this.mediaStreamDest);
        if (this.gainNode) this.gainNode.disconnect(this.mediaStreamDest);
      } catch (e) {}
      this.mediaStreamDest = null;
    }
    if (this.workletNode) {
      try {
        if (this.workletNode.port) {
          this.workletNode.port.onmessage = null;
          if (typeof this.workletNode.port.close === 'function') this.workletNode.port.close();
        }
        this.workletNode.disconnect();
      } catch (e) {}
      this.workletNode = null;
      this.workletReady = false;
      this.workletLoading = false;
    }
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.metadata = null;
        const actions = ['play', 'pause', 'stop', 'seekbackward', 'seekforward'];
        for (const action of actions) {
          try {
            navigator.mediaSession.setActionHandler(action, null);
          } catch (e) {}
        }
      } catch (e) {}
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        await this.audioCtx.suspend();
      } catch (e) {}
    }
    this.isUnlocked = false;
    this.notifyState();
  }

  notifyState() {
    const state = {
      isUnlocked: this.isUnlocked,
      isMuted: this.isMuted,
      volume: this.volume,
      playbackRate: this.playbackRate,
      isPlaying: this.isPlaying,
      currentLanguage: this.currentLanguage
    };
    for (const cb of this.onStateChangeCallbacks) {
      try { cb(state); } catch (e) {}
    }
  }
}

export const VOICE_PROFILES = {
  // Deepgram Aura (English)
  'aura-orion-en': { pitch: 0.78, rate: 0.95, detune: -340, gender: 'male', preferredName: 'David' },
  'aura-asteria-en': { pitch: 1.05, rate: 1.02, detune: 60, gender: 'female', preferredName: 'Zira' },
  'aura-luna-en': { pitch: 1.18, rate: 0.94, detune: 180, gender: 'female', preferredName: 'Jenny' },
  'aura-stella-en': { pitch: 1.08, rate: 1.08, detune: 100, gender: 'female', preferredName: 'Aria' },
  'aura-athena-en': { pitch: 0.92, rate: 0.92, detune: -120, gender: 'female', preferredName: 'Sonia' },
  'aura-arcas-en': { pitch: 0.88, rate: 1.04, detune: -200, gender: 'male', preferredName: 'Guy' },
  'aura-angus-en': { pitch: 0.72, rate: 0.88, detune: -420, gender: 'male', preferredName: 'Mark' },
  'aura-perseus-en': { pitch: 0.98, rate: 1.10, detune: -40, gender: 'male', preferredName: 'George' },

  // Google Neural Universal
  'es-ES-ElviraNeural': { pitch: 1.05, rate: 1.00, detune: 60, gender: 'female', preferredName: 'Helena' },
  'es-ES-AlvaroNeural': { pitch: 0.80, rate: 0.98, detune: -300, gender: 'male', preferredName: 'Pablo' },
  'en-US-JennyNeural': { pitch: 1.05, rate: 1.02, detune: 50, gender: 'female', preferredName: 'Jenny' },
  'en-US-GuyNeural': { pitch: 0.82, rate: 0.98, detune: -300, gender: 'male', preferredName: 'Guy' },
  'it-IT-ElsaNeural': { pitch: 1.06, rate: 1.00, detune: 70, gender: 'female', preferredName: 'Elsa' },
  'it-IT-CosimoNeural': { pitch: 0.84, rate: 0.96, detune: -280, gender: 'male', preferredName: 'Cosimo' },
  'pt-BR-FranciscaNeural': { pitch: 1.08, rate: 1.02, detune: 80, gender: 'female', preferredName: 'Francisca' },
  'pt-BR-AntonioNeural': { pitch: 0.85, rate: 0.98, detune: -260, gender: 'male', preferredName: 'Antonio' },

  // OpenAI TTS
  'nova': { pitch: 1.12, rate: 1.04, detune: 140, gender: 'female', preferredName: 'Nova' },
  'alloy': { pitch: 1.00, rate: 1.00, detune: 0, gender: 'neutral', preferredName: 'Alloy' },
  'echo': { pitch: 0.84, rate: 0.96, detune: -280, gender: 'male', preferredName: 'Echo' },
  'onyx': { pitch: 0.70, rate: 0.92, detune: -450, gender: 'male', preferredName: 'Onyx' },
  'shimmer': { pitch: 1.16, rate: 1.05, detune: 200, gender: 'female', preferredName: 'Shimmer' },

  // ElevenLabs
  '21m00Tcm4TlvDq8ikWAM': { pitch: 1.02, rate: 0.98, detune: 30, gender: 'female', preferredName: 'Rachel' },
  'pNInz6obpgDQGcFmaJgB': { pitch: 0.80, rate: 0.96, detune: -320, gender: 'male', preferredName: 'Adam' },
  'AZnzlk1XvdvUeBnXmlld': { pitch: 1.14, rate: 1.08, detune: 160, gender: 'female', preferredName: 'Domi' }
};

export const audioPlayerService = new AudioPlayerService();

