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

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[Socket] Conexión de red restablecida (Wi-Fi <-> 4G/5G). Reconectando al vuelo...');
        this.reconnectAttempts = 0;
        this.connect().then(() => {
          if (this.currentRoomId) {
            if (this.currentRole === 'HOST') {
              this.joinAsHost(this.currentRoomId);
            } else if (this.currentRole === 'LISTENER') {
              this.joinAsListener(this.currentRoomId, this.currentLang || 'en', this.userProfile || {});
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
    
    // If running in Vite dev server on port 5173, connect to backend on port 3001, fallback to Vite /ws proxy
    if (window.location.port === '5173') {
      return [
        `${protocol}//${host}:3001`,
        `${protocol}//${host}:5173/ws`
      ];
    }

    // If a custom port is present (e.g. localhost:3001)
    if (window.location.port) {
      return [
        `${protocol}//${host}:${window.location.port}`,
        `${protocol}//${host}:${window.location.port}/ws`
      ];
    }

    // Public domain / LocalTunnel / HTTPS default port 443
    return [
      `${protocol}//${host}`,
      `${protocol}//${host}/ws`
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
        } catch (err) {
          console.warn(`[Socket] Instantiation error for ${url}:`, err);
          return tryNextUrl();
        }

        let isOpened = false;
        const connectTimeout = setTimeout(() => {
          if (!isOpened && this.ws && this.ws.readyState !== WebSocket.OPEN) {
            console.warn(`[Socket] Timeout connecting to ${url}, trying fallback...`);
            try { this.ws.close(); } catch (e) {}
            tryNextUrl();
          }
        }, 2500);

        this.ws.onopen = () => {
          isOpened = true;
          clearTimeout(connectTimeout);
          console.log(`[Socket] Connected successfully via ${url}`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connection_status', { connected: true });
          this.startPingLoop();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch (err) {
            console.error('[Socket] Failed to parse message:', err);
          }
        };

        this.ws.onclose = () => {
          clearTimeout(connectTimeout);
          if (!isOpened) {
            tryNextUrl();
            return;
          }
          console.warn('[Socket] Connection closed.');
          this.isConnected = false;
          this.stopPingLoop();
          this.emit('connection_status', { connected: false });
          this.attemptReconnect();
        };

        this.ws.onerror = (err) => {
          if (!isOpened) {
            clearTimeout(connectTimeout);
            tryNextUrl();
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
          } else if (this.currentRole === 'LISTENER') {
            this.joinAsListener(this.currentRoomId, this.currentLang || 'en', this.userProfile || {});
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
    return false;
  }

  sendBinary(buffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(buffer);
      return true;
    }
    return false;
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'PONG': {
        const now = Date.now();
        this.latencyMs = Math.max(1, Math.round((now - (msg.timestamp || now)) / 2));
        this.emit('latency', this.latencyMs);
        break;
      }
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
      case 'LISTENER_JOINED_SUCCESS':
        this.emit('joined_success', msg);
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

  joinAsHost(roomId) {
    this.currentRoomId = roomId;
    this.currentRole = 'HOST';
    return this.send({
      type: 'HOST_JOIN',
      roomId
    });
  }

  joinAsListener(roomId, lang = 'en', userProfile = {}) {
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
      userAgent: navigator.userAgent
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

  // Q&A Backchannel Protocol Methods (2026-2029)
  raiseHand(roomId, profile) {
    return this.send({
      type: 'AUDIENCE_RAISE_HAND',
      roomId: (roomId || this.currentRoomId || 'MAIN').toUpperCase(),
      profile: profile || this.userProfile || {}
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

  closeQuestion(roomId) {
    return this.send({
      type: 'HOST_CLOSE_QUESTION',
      roomId: (roomId || this.currentRoomId || 'MAIN').toUpperCase()
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

  sendSpeechText(text, sourceLanguage = 'auto', forceLanguages = [], options = {}) {
    return this.send({
      type: 'SPEECH_CHUNK_TEXT',
      text,
      sourceLanguage,
      forceLanguages,
      medicalMode: options.medicalMode,
      medicalSpecialty: options.medicalSpecialty,
      customGlossary: options.customGlossary
    });
  }

  sendSpeechAudio(audioBase64, mimeType = 'audio/webm', sourceLanguage = 'auto', options = {}) {
    return this.send({
      type: 'SPEECH_CHUNK_AUDIO',
      audioBase64,
      mimeType,
      sourceLanguage,
      medicalMode: options.medicalMode,
      medicalSpecialty: options.medicalSpecialty,
      customGlossary: options.customGlossary
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
