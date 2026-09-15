/**
 * LiftVoice WebSocket Client
 * Connects to the real-time room and audio channel dispatcher
 */

class SocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.isConnected = false;
    this.currentRoomId = null;
    this.currentRole = null;
    this.pingInterval = null;
    this.latencyMs = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.connectingPromise = null;
    this.isKicked = false;
    this.outboxQueue = [];
    this.currentHostKey = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[Socket] Conexión de red restablecida (Wi-Fi <-> 4G/5G). Reconectando al vuelo...');
        this.reconnectAttempts = 0;
        this.connect().then(() => {
          if (this.currentRoomId) {
            if (this.currentRole === 'HOST') {
              this.joinAsHost(this.currentRoomId);
            } else if (this.currentRole === 'LISTENER') {
              this.joinAsListener(this.currentRoomId, this.currentLang || 'es', this.userProfile || {});
            }
          }
        }).catch(() => {});
      });

      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.isConnected && this.currentRoomId) {
          console.log('[Socket] Pantalla desbloqueada o pestaña activa. Verificando socket...');
          this.attemptReconnect();
        }
      });
    }
  }

  getSocketUrls() {
    const host = window.location.hostname || 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // If running in Vite dev server (port 5174 or 5173), connect to backend on port 3001, fallback to Vite /ws proxy
    if (window.location.port === '5174' || window.location.port === '5173') {
      return [
        `${protocol}//${host}:3001`,
        `${protocol}//${host}:${window.location.port}/ws`
      ];
    }

    // If running under a custom port (e.g. Portless :1355 or custom port)
    if (window.location.port) {
      return [
        `${protocol}//${host}:${window.location.port}/ws`,
        `${protocol}//${host}:${window.location.port}`
      ];
    }

    // Public domain / LocalTunnel / HTTPS default port 443
    return [
      `${protocol}//${host}/ws`,
      `${protocol}//${host}`
    ];
  }

  getSocketUrl() {
    return this.getSocketUrls()[0];
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    const candidateUrls = this.getSocketUrls();
    let urlIndex = 0;

    this.connectingPromise = new Promise((resolve, reject) => {
      const tryNextUrl = () => {
        if (urlIndex >= candidateUrls.length) {
          return reject(new Error('All WebSocket connection endpoints failed'));
        }
        const url = candidateUrls[urlIndex++];
        console.log(`[Socket] Connecting to ${url}...`);

        try {
          this.ws = new WebSocket(url);
          this.ws.binaryType = 'arraybuffer';
        } catch (err) {
          console.warn(`[Socket] Instantiation error for ${url}:`, err);
          return tryNextUrl();
        }

        let isOpened = false;
        let stepHandled = false;
        const advanceOnce = () => {
          if (stepHandled || isOpened) return;
          stepHandled = true;
          clearTimeout(connectTimeout);
          tryNextUrl();
        };

        const connectTimeout = setTimeout(() => {
          if (!isOpened && this.ws && this.ws.readyState !== WebSocket.OPEN) {
            console.warn(`[Socket] Timeout connecting to ${url}, trying fallback...`);
            try { this.ws.close(); } catch (e) {}
            advanceOnce();
          }
        }, 2500);

        this.ws.onopen = () => {
          isOpened = true;
          stepHandled = true;
          clearTimeout(connectTimeout);
          console.log(`[Socket] Connected successfully via ${url}`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connection_status', { connected: true });
          this.startPingLoop();
          // SEC-01: NO ejecutar flushOutbox() aquí. Debe esperar a la confirmación
          // de rol en sala (HOST_JOINED_SUCCESS / LISTENER_JOINED_SUCCESS).
          resolve();
        };

        this.ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            try {
              this.handleBinaryMessage(event.data);
            } catch (binErr) {
              console.warn('[Socket] Corrupted binary packet dropped:', binErr);
            }
            return;
          }
          try {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch (err) {
            console.error('[Socket] Failed to parse message:', err);
          }
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectTimeout);
          if (!isOpened) {
            advanceOnce();
            return;
          }
          console.warn('[Socket] Connection closed.', event?.code);
          this.isConnected = false;
          this.stopPingLoop();
          this.emit('connection_status', { connected: false });
          if (this.isKicked || (event && event.code === 4003)) {
            console.warn('[Socket] Suppression of reconnect: attendee was kicked by host.');
            return;
          }
          this.attemptReconnect();
        };

        this.ws.onerror = (err) => {
          if (!isOpened) {
            clearTimeout(connectTimeout);
            advanceOnce();
          } else {
            console.error('[Socket] Error:', err);
          }
        };
      };

      tryNextUrl();
    }).finally(() => {
      this.connectingPromise = null;
    });

    return this.connectingPromise;
  }

  attemptReconnect() {
    if (this.isKicked) {
      console.warn('[Socket] Reconnect aborted: client was kicked by host.');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[Socket] Max reconnect attempts reached.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000);
    console.log(`[Socket] Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts})...`);

    setTimeout(() => {
      this.connect().then(() => {
        // Re-join previous room if any
        if (this.currentRoomId) {
          if (this.currentRole === 'HOST') {
            this.joinAsHost(this.currentRoomId);
            if (this.currentMonitoredBooth && this.currentMonitoredBooth !== 'none') {
              this.setMonitoredBooth(this.currentRoomId, this.currentMonitoredBooth);
            }
          } else if (this.currentRole === 'LISTENER') {
            this.joinAsListener(this.currentRoomId, this.currentLang || 'es', this.userProfile || {});
          }
        }
      }).catch(() => {});
    }, delay);
  }

  startPingLoop() {
    this.stopPingLoop();
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'PING', timestamp: Date.now() });
      }
    }, 3000);
  }

  stopPingLoop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    // Si la conexión está temporalmente reconectando, encolar mensajes críticos (voz, transcripción, Q&A)
    const CRITICAL_TYPES = new Set(['SPEECH_CHUNK_TEXT', 'SPEECH_CHUNK_AUDIO', 'AUDIENCE_AUDIO_QUESTION', 'AUDIENCE_RAISE_HAND']);
    if (data && CRITICAL_TYPES.has(data.type)) {
      if (this.outboxQueue.length < 50) {
        this.outboxQueue.push({ type: 'json', data });
        console.log(`[Socket] 📬 Encolado mensaje de voz en outbox (${this.outboxQueue.length} pendientes): ${data.type}`);
      }
    }
    return false;
  }

  sendBinary(buffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(buffer);
      return true;
    }
    if (buffer && this.outboxQueue.length < 50) {
      this.outboxQueue.push({ type: 'binary', data: buffer });
      console.log(`[Socket] 📬 Encolado paquete binario de audio en outbox (${this.outboxQueue.length} pendientes)`);
    }
    return false;
  }

  flushOutbox() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.outboxQueue.length === 0) return;
    console.log(`[Socket] 🚀 Vaciando outbox con ${this.outboxQueue.length} mensaje(s) encolados durante la reconexión...`);
    const queue = [...this.outboxQueue];
    this.outboxQueue = [];
    for (const item of queue) {
      try {
        if (item.type === 'json') {
          this.ws.send(JSON.stringify(item.data));
        } else if (item.type === 'binary') {
          this.ws.send(item.data);
        }
      } catch (e) {
        console.warn('[Socket] Error al vaciar elemento del outbox:', e);
      }
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'PONG': {
        const now = Date.now();
        this.latencyMs = Math.max(1, Math.round((now - (msg.timestamp || now)) / 2));
        this.emit('latency', this.latencyMs);
        break;
      }
      case 'KICKED_BY_HOST':
        this.isKicked = true;
        this.outboxQueue = []; // SEC-01: Evitar retransmisión si el usuario fue vetado
        this.stopPingLoop();
        this.emit('kicked_by_host', msg);
        break;
      case 'AUDIO_CHUNK':
        this.emit('audio_chunk', msg);
        break;
      case 'TRANSCRIPT_EVENT':
        this.emit('transcript_event', msg.item);
        break;
      case 'ROOM_STATS':
        this.emit('room_stats', msg.stats);
        break;
      case 'PIPELINE_METRIC':
        this.emit('pipeline_metric', msg.metric);
        break;
      case 'HOST_JOINED_SUCCESS':
        if (msg.hostKey) {
          this.currentHostKey = msg.hostKey;
          try {
            if (typeof localStorage !== 'undefined' && msg.roomId) {
              localStorage.setItem(`lv_hostkey_${msg.roomId}`, msg.hostKey);
              localStorage.setItem(`lv_hostkey_${msg.roomId.toUpperCase()}`, msg.hostKey);
            }
          } catch (e) {}
        }
        this.emit('joined_success', msg);
        if (msg.stats) {
          this.emit('room_stats', msg.stats);
        }
        this.flushOutbox(); // SEC-01: Ahora el socket tiene clientRole y room autenticados en el servidor
        break;
      case 'LISTENER_JOINED_SUCCESS':
        this.emit('joined_success', msg);
        if (msg.stats) {
          this.emit('room_stats', msg.stats);
        }
        this.flushOutbox(); // SEC-01: Oyente autenticado en sala, vaciar preguntas o eventos encolados
        break;
      case 'LANGUAGE_CHANGED':
        this.emit('language_changed', msg.lang);
        break;
      default:
        this.emit(msg.type, msg);
        if (typeof msg.type === 'string') {
          this.emit(msg.type.toLowerCase(), msg);
        }
    }
  }

  handleBinaryMessage(buffer) {
    if (!buffer || !(buffer instanceof ArrayBuffer) || buffer.byteLength < 12) return;
    const view = new DataView(buffer);
    const magic = view.getUint16(0);
    if (magic !== 0x4C56) {
      console.warn('[Socket] LVBP magic mismatch: 0x' + magic.toString(16));
      return; // Descartar si no coincide con 'LV'
    }

    const type = view.getUint8(2);
    if (type !== 0x01) {
      console.warn('[Socket] Unknown or unsupported LVBP frame type:', type);
      return; // Descartar tipos desconocidos (solo 0x01 AUDIO_FRAME soportado)
    }

    const langCodeNum = view.getUint8(3);
    const seqId = view.getUint16(4);
    const timestamp = view.getUint32(6);

    let headerSize = 14;
    let payloadLen = 0;

    // Detectar LVBP v1.1 (cabecera de 14 bytes con longitud UInt32BE) vs v1.0 legado (12 bytes)
    if (buffer.byteLength >= 14) {
      const v11Len = view.getUint32(10);
      if (14 + v11Len === buffer.byteLength && v11Len > 0) {
        headerSize = 14;
        payloadLen = v11Len;
      } else {
        const v10Len = view.getUint16(10);
        if (12 + v10Len === buffer.byteLength && v10Len > 0) {
          headerSize = 12;
          payloadLen = v10Len;
        } else {
          console.warn(`[Socket] Malformed LVBP packet: length mismatch (byteLength: ${buffer.byteLength}, v11Len: ${v11Len})`);
          return; // Descartar paquete truncado o corrupto
        }
      }
    } else {
      headerSize = 12;
      payloadLen = view.getUint16(10);
      if (12 + payloadLen !== buffer.byteLength || payloadLen <= 0) {
        return; // Descartar paquete corrupto
      }
    }

    const CODE_TO_LANG = { 1: 'es', 2: 'en', 3: 'it', 4: 'pt', 5: 'fr', 6: 'de', 7: 'zh', 8: 'ja', 9: 'ru' };
    const lang = CODE_TO_LANG[langCodeNum];
    if (!lang) {
      console.warn('[Socket] Invalid LVBP langCode received:', langCodeNum);
      return; // Descartar para evitar contaminación cruzada
    }

    const binaryPayload = buffer.slice(headerSize, headerSize + payloadLen);

    this.emit('audio_chunk', {
      type: 'AUDIO_CHUNK',
      lang,
      seqId,
      timestamp,
      binaryPayload,
      isBinary: true,
      isBoothAudio: this.currentRole === 'HOST'
    });
  }

  joinAsHost(roomId, token = null) {
    this.currentRoomId = roomId;
    this.currentRole = 'HOST';
    let storedHostKey = null;
    try {
      if (typeof localStorage !== 'undefined' && roomId) {
        storedHostKey = localStorage.getItem(`lv_hostkey_${roomId}`) || localStorage.getItem(`lv_hostkey_${roomId.toUpperCase()}`);
      }
    } catch (e) {}
    let adminToken = token || this.currentHostKey || storedHostKey;
    if (!adminToken && typeof localStorage !== 'undefined') {
      adminToken = localStorage.getItem('liftvoice_admin_token') || localStorage.getItem('lv_admin_token') || localStorage.getItem('adminToken') || null;
    }
    const resolvedHostKey = this.currentHostKey || storedHostKey || adminToken || null;
    return this.send({
      type: 'HOST_JOIN',
      roomId,
      hostKey: resolvedHostKey,
      token: adminToken,
      supportsBinary: true
    });
  }

  joinAsListener(roomId, lang = 'es', userProfile = {}) {
    this.isKicked = false;
    this.currentRoomId = roomId;
    this.currentRole = 'LISTENER';
    this.currentLang = lang;
    this.userProfile = userProfile;
    return this.send({
      type: 'LISTENER_JOIN',
      roomId,
      lang,
      attendeeId: userProfile.attendeeId || null,
      name: userProfile.name || 'Asistente',
      email: userProfile.email || '',
      phone: userProfile.phone || '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      supportsBinary: true
    });
  }

  registerAttendeeLead(roomId, profile) {
    this.userProfile = { ...(this.userProfile || {}), ...profile };
    return this.send({
      type: 'REGISTER_ATTENDEE_LEAD',
      roomId: (roomId || this.currentRoomId || 'MAIN').toUpperCase(),
      profile: this.userProfile
    });
  }

  raiseHand(roomId, profile) {
    return this.send({
      type: 'AUDIENCE_RAISE_HAND',
      roomId: (roomId || this.currentRoomId || 'MAIN').toUpperCase(),
      profile: profile || this.userProfile || {}
    });
  }

  lowerHand(roomId, attendeeId) {
    return this.send({
      type: 'AUDIENCE_LOWER_HAND',
      roomId: (roomId || this.currentRoomId || 'MAIN').toUpperCase(),
      attendeeId
    });
  }

  approveQuestion(roomId, attendeeId, attendeeName = 'Asistente') {
    return this.send({
      type: 'HOST_APPROVE_QUESTION',
      roomId: (roomId || this.currentRoomId || 'MAIN').toUpperCase(),
      attendeeId,
      attendeeName
    });
  }

  sendQuestionAudio(roomId, audioBase64 = null, mimeType = 'audio/webm', lang = 'auto', attendeeName = 'Asistente', text = null) {
    return this.send({
      type: 'AUDIENCE_AUDIO_QUESTION',
      roomId: (roomId || this.currentRoomId || 'MAIN').toUpperCase(),
      audioBase64,
      mimeType,
      lang,
      attendeeName,
      text
    });
  }

  closeQuestion(roomId, questionId = null) {
    return this.send({
      type: 'HOST_CLOSE_QUESTION',
      roomId: (roomId || this.currentRoomId || 'MAIN').toUpperCase(),
      questionId
    });
  }

  kickAttendee(roomId, attendeeId, name = '', reason = '') {
    return this.send({
      type: 'HOST_KICK_ATTENDEE',
      roomId: (roomId || this.currentRoomId || 'MAIN').toUpperCase(),
      attendeeId,
      name,
      reason
    });
  }

  unbanAttendee(roomId, attendeeId) {
    return this.send({
      type: 'HOST_UNBAN_ATTENDEE',
      roomId: (roomId || this.currentRoomId || 'MAIN').toUpperCase(),
      attendeeId
    });
  }

  changeLanguage(newLang, roomId = null) {
    this.currentLang = newLang;
    return this.send({
      type: 'CHANGE_LANGUAGE',
      roomId: roomId || this.currentRoomId,
      lang: newLang
    });
  }

  switchLanguage(roomId, newLang) {
    return this.changeLanguage(newLang, roomId);
  }

  previewChannel(roomId, lang, text) {
    return this.send({
      type: 'HOST_PREVIEW_CHANNEL',
      roomId,
      lang,
      text
    });
  }

  setMonitoredBooth(roomId, lang) {
    this.currentMonitoredBooth = lang || 'none';
    return this.send({
      type: 'HOST_MONITOR_BOOTH',
      roomId: (roomId || this.currentRoomId || 'MAIN').toUpperCase(),
      lang: lang || 'none'
    });
  }

  leaveRoom(roomId) {
    const rId = (roomId || this.currentRoomId || 'MAIN').toUpperCase();
    if (this.currentRole === 'HOST') {
      this.send({
        type: 'HOST_LEAVE',
        roomId: rId
      });
    } else {
      this.send({
        type: 'LISTENER_LEAVE',
        roomId: rId
      });
    }
    this.currentRoomId = null;
    this.currentRole = null;
  }

  sendSpeechText(text, sourceLanguage = 'auto', forceLanguages = [], options = {}) {
    return this.send({
      type: 'SPEECH_CHUNK_TEXT',
      roomId: (this.currentRoomId || 'MAIN').toUpperCase(),
      text,
      sourceLanguage,
      forceLanguages,
      medicalMode: options.medicalMode,
      medicalSpecialty: options.medicalSpecialty,
      customGlossary: options.customGlossary,
      sttEngine: options.sttEngine,
      sttModel: options.sttModel,
      inputSource: options.inputSource || 'voice'
    });
  }

  sendSpeechAudio(audioBase64, mimeType = 'audio/webm', sourceLanguage = 'auto', options = {}) {
    return this.send({
      type: 'SPEECH_CHUNK_AUDIO',
      roomId: (this.currentRoomId || 'MAIN').toUpperCase(),
      audioBase64,
      mimeType,
      sourceLanguage,
      medicalMode: options.medicalMode,
      medicalSpecialty: options.medicalSpecialty,
      customGlossary: options.customGlossary,
      sttEngine: options.sttEngine,
      sttModel: options.sttModel
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[Socket] Listener error on event "${event}":`, err);
        }
      }
    }
  }
}

export const socketService = new SocketService();
