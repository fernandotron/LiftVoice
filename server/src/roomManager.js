import crypto from 'crypto';
import { geminiLiveBridge } from './services/geminiLiveBridge.js';

export function generateMeetCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const getRand = (len) => {
    let s = '';
    for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  };
  return `${getRand(3)}-${getRand(4)}-${getRand(3)}`;
}

export function normalizeRoomId(rawId) {
  if (!rawId) return '';
  const s = String(rawId).trim().toLowerCase();
  const m = s.match(/room=([a-z0-9\-]+)/i);
  const clean = (m ? m[1] : s).replace(/\s+/g, '');
  if (/^[a-z]{10}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7, 10)}`;
  }
  return clean;
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.defaultPipelineMode = 'deepgram_gemini';
    this.defaultGeminiLiveVoices = {
      en: 'Aoede',
      it: 'Kore',
      pt: 'Fenrir',
      es: 'Charon'
    };

    // Inactive room reaper (runs every 2 minutes, cleans rooms idle for > 20 mins)
    const reaperInterval = setInterval(() => {
      const now = Date.now();
      const reapedRooms = new Set();
      for (const [id, room] of this.rooms.entries()) {
        if (reapedRooms.has(room)) continue;
        const isAbandoned = !room.hostSocket && (!room.listeners || room.listeners.size === 0);
        const hasHistoryOrAttendees = (room.transcriptHistory && room.transcriptHistory.length > 0) || (room.registeredAttendees && room.registeredAttendees.size > 0);
        const maxIdleMs = hasHistoryOrAttendees ? 60 * 60 * 1000 : 20 * 60 * 1000;
        const isIdle = (now - (room.lastActivity || room.createdAt)) > maxIdleMs;
        // Purga de salas fantasma: si el ponente se marchó y no hay actividad de voz durante > 35 min, cerrar sala aunque haya oyentes pasivos
        const isHostGone = !room.hostSocket;
        const isGhostRoom = isHostGone && ((now - (room.lastActivity || room.createdAt)) > 35 * 60 * 1000);
        if ((isAbandoned && isIdle) || isGhostRoom) {
          reapedRooms.add(room);
          console.log(`[RoomManager] Reaped inactive room ${id}`);

          if (room._statsDebounceTimer) {
            clearTimeout(room._statsDebounceTimer);
            room._statsDebounceTimer = null;
          }

          // MEM-02: Close all sockets with code 1000 ('Room closed')
          if (room.hostSocket && room.hostSocket.readyState === 1) {
            try { room.hostSocket.close(1000, 'Room closed'); } catch (e) {}
          }
          room.hostSocket = null;
          room.hostSocketId = null;

          if (room.listeners) {
            for (const listener of room.listeners.values()) {
              if (listener.socket && listener.socket.readyState === 1) {
                try { listener.socket.close(1000, 'Room closed'); } catch (e) {}
              }
            }
            room.listeners.clear();
          }

          // MEM-02: Empty arrays and state
          if (room.transcriptHistory) room.transcriptHistory.length = 0;
          if (room.qaQueue) room.qaQueue.length = 0;
          room.activeSpeaker = null;
          room.monitoredBooth = null;

          if (room.registeredAttendees) room.registeredAttendees.clear();
          if (room.kickedAttendees) room.kickedAttendees.clear();
          if (room.kickedIps) room.kickedIps.clear();
          if (room.lastBroadcastSeqByLang) room.lastBroadcastSeqByLang.clear();
          if (room.lastAudioByLang) room.lastAudioByLang.clear();

          for (const [key, r] of this.rooms.entries()) {
            if (r === room) {
              this.rooms.delete(key);
            }
          }
          import('./services/aiPipeline.js').then(m => m.aiPipeline.cleanupRoom(id)).catch(() => {});
          try { geminiLiveBridge.closeRoom(id); } catch (e) {}
        }
      }
    }, 120 * 1000);
    if (reaperInterval && typeof reaperInterval.unref === 'function') {
      reaperInterval.unref();
    }
  }

  createRoom(customId = null, title = 'Conferencia Principal', hostKey = null) {
    const rawId = customId ? String(customId).trim() : generateMeetCode();
    const normalizedKey = normalizeRoomId(rawId);

    const existing = this.getRoom(rawId);
    if (existing) {
      if (existing.title === 'Conferencia Principal 2026') existing.title = 'Conferencia Principal';
      return existing;
    }

    const roomId = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(normalizedKey)
      ? normalizedKey
      : rawId.toUpperCase();

    const cleanTitle = (title === 'Conferencia Principal 2026') ? 'Conferencia Principal' : (title || 'Conferencia Principal');

    // SEC-02: Generar clave criptográficamente segura si no se proporcionó una
    const secureHostKey = (hostKey && String(hostKey).trim()) || crypto.randomBytes(16).toString('hex');

    const room = {
      id: roomId,
      title: cleanTitle,
      hostKey: secureHostKey,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      hostSocket: null,
      hostSocketId: null,
      monitoredBooth: null, // Track which language booth the host is monitoring in headphones
      listeners: new Map(), // socketId -> { socket, name, email, phone, lang, joinedAt, ip, userAgent }
      registeredAttendees: new Map(), // email or socketId -> { id, name, email, phone, initialLang, currentLang, joinedAt, ip, isKicked }
      kickedAttendees: new Map(), // attendeeId -> { attendeeId, name, email, kickedAt, reason, ip }
      kickedIps: new Set(), // Set of IP addresses banned from this room
      qaQueue: [], // [ { socketId, attendeeId, name, lang, timestamp } ]
      activeSpeaker: null, // { socketId, attendeeId, name, lang, startedAt }
      metrics: {
        totalSpokenSeconds: 0,
        sentencesProcessed: 0,
        audioPacketsBroadcast: 0,
        averageLatencyMs: 240,
      },
      transcriptHistory: [],
      config: {
        pipelineMode: this.defaultPipelineMode || 'deepgram_gemini',
        geminiLiveVoices: { ...(this.defaultGeminiLiveVoices || {
          en: 'Aoede',
          it: 'Kore',
          pt: 'Fenrir',
          es: 'Charon'
        }) },
        sttEngine: 'deepgram',
        targetLanguages: ['es', 'en', 'it', 'pt'],
        autoDetectSource: true,
        defaultLanguage: 'es',
        preferredTtsEngine: 'deepgram',
        voiceConfig: {
          es: 'aura-2-carina-es',
          en: 'aura-2-thalia-en',
          it: 'aura-2-diana-it',
          pt: 'pt-BR-FranciscaNeural'
        },
        voiceGender: {
          es: 'female',
          en: 'female',
          it: 'female',
          pt: 'female'
        },
        decalageMode: 'natural',
        decalageValue: 50,
        vadSensitivity: 'standard',
        lazyCabins: true,
        qaMode: 'host_controlled',
        qaEnabled: false
      }
    };

    this.rooms.set(normalizedKey, room);
    if (roomId !== normalizedKey) {
      this.rooms.set(roomId, room);
      this.rooms.set(roomId.toUpperCase(), room);
    }
    console.log(`[RoomManager] Room created: ${roomId} ("${title}")`);
    return room;
  }

  deleteRoom(roomId) {
    if (!roomId) return false;
    const room = this.getRoom(roomId);
    if (room) {
      if (room._statsDebounceTimer) {
        clearTimeout(room._statsDebounceTimer);
        room._statsDebounceTimer = null;
      }

      // MEM-02: Close all sockets with code 1000 ('Room closed')
      if (room.hostSocket && room.hostSocket.readyState === 1) {
        try { room.hostSocket.close(1000, 'Room closed'); } catch (e) {}
      }
      room.hostSocket = null;
      room.hostSocketId = null;

      if (room.listeners) {
        for (const listener of room.listeners.values()) {
          if (listener.socket && listener.socket.readyState === 1) {
            try { listener.socket.close(1000, 'Room closed'); } catch (e) {}
          }
        }
        room.listeners.clear();
      }

      // MEM-02: Empty arrays and state
      if (room.transcriptHistory) room.transcriptHistory.length = 0;
      if (room.qaQueue) room.qaQueue.length = 0;
      room.activeSpeaker = null;
      room.monitoredBooth = null;

      if (room.registeredAttendees) room.registeredAttendees.clear();
      if (room.kickedAttendees) room.kickedAttendees.clear();
      if (room.kickedIps) room.kickedIps.clear();
      if (room.lastBroadcastSeqByLang) room.lastBroadcastSeqByLang.clear();
      if (room.lastAudioByLang) room.lastAudioByLang.clear();
    }

    let deleted = false;
    if (room) {
      for (const [key, r] of this.rooms.entries()) {
        if (r === room) {
          this.rooms.delete(key);
          deleted = true;
        }
      }
    } else {
      const normalized = normalizeRoomId(roomId);
      if (this.rooms.has(normalized)) {
        this.rooms.delete(normalized);
        deleted = true;
      }
      const upper = String(roomId).toUpperCase();
      if (this.rooms.has(upper)) {
        this.rooms.delete(upper);
        deleted = true;
      }
      if (this.rooms.has(roomId)) {
        this.rooms.delete(roomId);
        deleted = true;
      }
    }
    if (deleted) {
      console.log(`[RoomManager] Room deleted: ${roomId}`);
      import('./services/aiPipeline.js').then(m => m.aiPipeline.cleanupRoom(roomId)).catch(() => {});
      try { geminiLiveBridge.closeRoom(roomId); } catch (e) {}
    }
    return deleted;
  }

  cleanupRoom(id) {
    try { geminiLiveBridge.closeRoom(id); } catch (e) {}
    return this.deleteRoom(id);
  }

  setDefaultPipelineMode(mode) {
    if (typeof mode === 'string' && ['deepgram_gemini', 'gemini_live_s2s'].includes(mode.trim())) {
      this.defaultPipelineMode = mode.trim();
      for (const room of this.rooms.values()) {
        if (room && room.config) {
          room.config.pipelineMode = this.defaultPipelineMode;
        }
      }
    }
  }

  setDefaultGeminiLiveVoices(voices) {
    if (voices && typeof voices === 'object' && !Array.isArray(voices)) {
      this.defaultGeminiLiveVoices = { ...this.defaultGeminiLiveVoices, ...voices };
      for (const room of this.rooms.values()) {
        if (room && room.config) {
          room.config.geminiLiveVoices = { ...(room.config.geminiLiveVoices || {}), ...voices };
        }
      }
    }
  }

  getRoom(roomId) {
    if (!roomId) return null;
    const normalized = normalizeRoomId(roomId);
    if (this.rooms.has(normalized)) return this.rooms.get(normalized);
    const upper = String(roomId).toUpperCase();
    if (this.rooms.has(upper)) return this.rooms.get(upper);
    return this.rooms.get(roomId) || null;
  }

  touchRoomActivity(roomId) {
    const room = this.getRoom(roomId);
    if (room) room.lastActivity = Date.now();
  }

  addTranscriptItem(roomId, transcriptItem) {
    const room = this.getRoom(roomId);
    if (!room) return;

    room.transcriptHistory.push(transcriptItem);
    if (room.transcriptHistory.length > 100) {
      room.transcriptHistory.shift();
    }
    room.metrics.sentencesProcessed++;

    const MAX_BUFFERED_BYTES = 512 * 1024;

    // Sanitized item for non-admin viewers (zero telemetry/model leakage - CWE-200)
    const publicItem = {
      id: transcriptItem.id,
      seqId: transcriptItem.seqId,
      timestamp: transcriptItem.timestamp,
      originalText: transcriptItem.originalText,
      detectedLanguage: transcriptItem.detectedLanguage,
      translations: transcriptItem.translations,
      isFinal: transcriptItem.isFinal !== undefined ? Boolean(transcriptItem.isFinal) : true,
      engineUsed: transcriptItem.engineUsed || null,
      medicalMode: Boolean(transcriptItem.medicalMode)
    };

    // 1. Send to host: complete telemetry if admin session, sanitized if standard host
    if (room.hostSocket && room.hostSocket.readyState === 1) {
      if (room.hostSocket.bufferedAmount <= MAX_BUFFERED_BYTES) {
        try {
          const itemToSend = room.hostSocket.isAdminSession ? transcriptItem : publicItem;
          room.hostSocket.send(JSON.stringify({
            type: 'TRANSCRIPT_EVENT',
            item: itemToSend
          }));
        } catch (e) {}
      }
    }

    // 2. Send sanitized transcript to listeners (zero telemetry/model leakage - CWE-200)
    const publicPayload = JSON.stringify({
      type: 'TRANSCRIPT_EVENT',
      item: publicItem
    });

    for (const listener of room.listeners.values()) {
      if (listener.socket && listener.socket.readyState === 1) {
        if (listener.socket.bufferedAmount <= MAX_BUFFERED_BYTES) {
          try { listener.socket.send(publicPayload); } catch (e) {}
        }
      }
    }
  }

  updateTranscriptItem(roomId, transcriptItem) {
    const room = this.getRoom(roomId);
    if (!room || !transcriptItem) return;

    const idx = room.transcriptHistory.findIndex(i => i.id === transcriptItem.id);
    if (idx !== -1) {
      room.transcriptHistory[idx] = {
        ...room.transcriptHistory[idx],
        ...transcriptItem,
        translations: {
          ...(room.transcriptHistory[idx].translations || {}),
          ...(transcriptItem.translations || {})
        }
      };
    }

    const MAX_BUFFERED_BYTES = 512 * 1024;
    const fullItem = idx !== -1 ? room.transcriptHistory[idx] : transcriptItem;

    const publicItem = {
      id: fullItem.id,
      seqId: fullItem.seqId,
      timestamp: fullItem.timestamp,
      originalText: fullItem.originalText,
      detectedLanguage: fullItem.detectedLanguage,
      translations: fullItem.translations,
      isFinal: fullItem.isFinal !== undefined ? Boolean(fullItem.isFinal) : true,
      engineUsed: fullItem.engineUsed || null,
      medicalMode: Boolean(fullItem.medicalMode)
    };

    if (room.hostSocket && room.hostSocket.readyState === 1) {
      if (room.hostSocket.bufferedAmount <= MAX_BUFFERED_BYTES) {
        try {
          const itemToSend = room.hostSocket.isAdminSession ? fullItem : publicItem;
          room.hostSocket.send(JSON.stringify({
            type: 'TRANSCRIPT_EVENT',
            item: itemToSend
          }));
        } catch (e) {}
      }
    }

    const publicPayload = JSON.stringify({
      type: 'TRANSCRIPT_EVENT',
      item: publicItem
    });

    for (const listener of room.listeners.values()) {
      if (listener.socket && listener.socket.readyState === 1) {
        if (listener.socket.bufferedAmount <= MAX_BUFFERED_BYTES) {
          try { listener.socket.send(publicPayload); } catch (e) {}
        }
      }
    }
  }

  getActiveLanguages(roomId) {
    const room = this.getRoom(roomId);
    if (!room || !room.listeners) return [];
    
    // SEC-06: Lista negra estricta de valores inválidos / centinela
    const INVALID_LANGS = new Set(['none', 'auto', 'null', 'undefined', '']);
    const langs = new Set();

    for (const listener of room.listeners.values()) {
      if (listener.lang) {
        const clean = String(listener.lang).toLowerCase().trim();
        if (clean && !INVALID_LANGS.has(clean)) {
          langs.add(clean);
        }
      }
    }

    if (room.monitoredBooth) {
      const cleanBooth = String(room.monitoredBooth).toLowerCase().trim();
      if (cleanBooth && !INVALID_LANGS.has(cleanBooth)) {
        langs.add(cleanBooth);
      }
    }

    return Array.from(langs);
  }

  setMonitoredBooth(roomId, lang) {
    const room = this.getRoom(roomId);
    if (!room) return false;
    
    // SEC-06: Sanear valor asignado a monitoredBooth
    const INVALID_LANGS = new Set(['none', 'auto', 'null', 'undefined', '']);
    const rawLang = lang ? String(lang).toLowerCase().trim() : '';
    const cleanLang = (rawLang && !INVALID_LANGS.has(rawLang)) ? rawLang : null;
    
    room.monitoredBooth = cleanLang;
    return true;
  }

  getOrCreateRoom(roomId, title = 'Conferencia Principal', hostKey = null) {
    const existing = this.getRoom(roomId);
    if (existing) {
      if (existing.title === 'Conferencia Principal 2026') existing.title = 'Conferencia Principal';
      return existing;
    }
    return this.createRoom(roomId, title, hostKey);
  }

  setHost(roomId, socket, socketId, hostKey = null) {
    const isNewRoom = !this.getRoom(roomId);
    const room = this.getOrCreateRoom(roomId, 'Conferencia Principal', hostKey);
    if (room.title === 'Conferencia Principal 2026') {
      room.title = 'Conferencia Principal';
    }

    const hasActiveHost = Boolean(room.hostSocket && room.hostSocket.readyState === 1 && room.hostSocketId !== socketId);

    // SEC-02: Protección contra Host Takeover no autorizado:
    // Si la sala ya existe y tiene un hostKey configurado, exigir que coincida estrictamente
    if (!isNewRoom && room.hostKey && room.hostKey !== hostKey) {
      console.warn(`[RoomManager] [SEC-02] Intento no autorizado de HOST_JOIN en sala ${room.id} (socket: ${socketId})`);
      return { success: false, error: 'INVALID_HOST_KEY' };
    }

    if (hasActiveHost) {
      console.log(`[RoomManager] Host takeover autorizado en sala ${room.id}: reemplazando socket ${room.hostSocketId} con ${socketId}`);
      try {
        room.hostSocket.close(4001, 'Host session replaced by authenticated connection');
      } catch (e) {}
    }

    if (!room.hostKey) {
      room.hostKey = hostKey || crypto.randomBytes(16).toString('hex');
    }
    room.hostSocket = socket;
    room.hostSocketId = socketId;
    room.lastActivity = Date.now();
    console.log(`[RoomManager] Host connected to room ${room.id} (socket: ${socketId})`);
    this.broadcastStats(room.id);
    return { success: true, room };
  }

  removeHost(socketId) {
    for (const room of this.rooms.values()) {
      if (room.hostSocketId === socketId) {
        room.hostSocket = null;
        room.hostSocketId = null;
        room.monitoredBooth = null; // Reset monitored booth so lazy cabins sleep immediately (MEM-01)
        room.lastActivity = Date.now();
        console.log(`[RoomManager] Host disconnected from room ${room.id}`);
        this.broadcastToRoom(room.id, {
          type: 'HOST_STATUS',
          isOnline: false,
          message: 'El ponente se ha desconectado temporalmente'
        });
        this.broadcastStats(room.id);
        break;
      }
    }
  }

  isAttendeeKicked(roomId, attendeeId, email = '', ip = '') {
    const room = this.getRoom(roomId);
    if (!room) return false;
    const attId = attendeeId ? String(attendeeId) : '';
    const attEmail = email ? String(email).toLowerCase() : '';
    const attIp = ip ? String(ip).trim() : '';

    if (attIp && room.kickedIps && room.kickedIps.has(attIp)) return true;
    if (attId && room.kickedAttendees && room.kickedAttendees.has(attId)) return true;
    if (attEmail && room.kickedAttendees && room.kickedAttendees.has(attEmail)) return true;
    if (room.kickedAttendees) {
      for (const record of room.kickedAttendees.values()) {
        if (attId && record.attendeeId === attId) return true;
        if (attEmail && record.email && record.email.toLowerCase() === attEmail) return true;
        if (attIp && record.ip && record.ip === attIp) return true;
      }
    }
    return false;
  }

  kickAttendee(roomId, attendeeId, name = '', reason = 'Expulsado por el anfitrión') {
    const room = this.getRoom(roomId);
    if (!room) return false;
    if (!room.kickedAttendees) room.kickedAttendees = new Map();
    if (!room.kickedIps) room.kickedIps = new Set();

    const kickedKey = String(attendeeId);
    let foundEmail = '';
    let foundName = name;
    let foundIp = '';

    for (const [key, att] of room.registeredAttendees.entries()) {
      if (att.id === attendeeId || key === attendeeId || (att.email && att.email.toLowerCase() === attendeeId.toLowerCase())) {
        att.isKicked = true;
        foundEmail = att.email || foundEmail;
        foundName = att.name || foundName;
        foundIp = att.ip || foundIp;
        break;
      }
    }

    // Terminate matching listener sockets and extract IP
    for (const [socketId, listener] of room.listeners.entries()) {
      const match = (listener.attendeeId === attendeeId) || (socketId === attendeeId) || (foundEmail && listener.email && listener.email.toLowerCase() === foundEmail.toLowerCase());
      if (match) {
        if (listener.ip && listener.ip !== 'unknown') {
          foundIp = listener.ip;
          room.kickedIps.add(listener.ip);
        }
        if (listener.socket && listener.socket.readyState === 1) {
          try {
            listener.socket.send(JSON.stringify({
              type: 'KICKED_BY_HOST',
              roomId: room.id,
              reason
            }));
            listener.socket.close(4003, 'Kicked by host');
          } catch (e) {}
        }
        room.listeners.delete(socketId);
      }
    }

    if (foundIp && foundIp !== 'unknown') {
      room.kickedIps.add(foundIp);
    }

    room.kickedAttendees.set(kickedKey, {
      attendeeId: kickedKey,
      name: foundName || 'Asistente',
      email: foundEmail,
      ip: foundIp,
      kickedAt: new Date().toISOString(),
      reason
    });

    this.removeHandRaise(roomId, attendeeId);
    console.log(`[RoomManager] Attendee ${attendeeId} (${foundName}) kicked from room ${room.id} (IP: ${foundIp || 'unknown'})`);
    this.broadcastStats(room.id);
    return true;
  }

  unbanAttendee(roomId, attendeeId) {
    const room = this.getRoom(roomId);
    if (!room || !room.kickedAttendees) return false;

    const idStr = String(attendeeId);
    const existing = room.kickedAttendees.get(idStr);
    if (existing && existing.ip && room.kickedIps) {
      room.kickedIps.delete(existing.ip);
    }

    room.kickedAttendees.delete(idStr);
    for (const [key, record] of room.kickedAttendees.entries()) {
      if (record.attendeeId === idStr || key === idStr) {
        if (record.ip && room.kickedIps) room.kickedIps.delete(record.ip);
        room.kickedAttendees.delete(key);
      }
    }

    for (const [key, att] of room.registeredAttendees.entries()) {
      if (att.id === idStr || key === idStr) {
        att.isKicked = false;
        if (att.ip && room.kickedIps) room.kickedIps.delete(att.ip);
      }
    }

    console.log(`[RoomManager] Attendee ${idStr} unbanned in room ${room.id}`);
    this.broadcastStats(room.id);
    return true;
  }

  addListener(roomId, socket, socketId, lang = 'en', metadata = {}) {
    const room = this.getOrCreateRoom(roomId);
    let targetLang = 'en';
    let safeMetadata = metadata || {};
    if (typeof lang === 'string') {
      targetLang = lang.toLowerCase();
    } else if (typeof lang === 'object' && lang !== null) {
      safeMetadata = lang;
      targetLang = (safeMetadata.lang || safeMetadata.language || 'en').toLowerCase();
    }
    const name = safeMetadata.name || 'Asistente Anónimo';
    const email = safeMetadata.email || '';
    const phone = safeMetadata.phone || '';
    const attendeeId = safeMetadata.attendeeId || socketId;
    const ip = safeMetadata.ip || 'unknown';

    // Check if attendee is kicked/banned from this room (by ID, email, or IP)
    if (this.isAttendeeKicked(room.id, attendeeId, email, ip)) {
      console.log(`[RoomManager] Connection rejected: Attendee ${attendeeId} (${name}) is banned from room ${room.id} (IP: ${ip})`);
      if (socket && socket.readyState === 1) {
        try {
          socket.send(JSON.stringify({
            type: 'KICKED_BY_HOST',
            roomId: room.id,
            reason: 'Has sido expulsado de esta sala por el anfitrión.'
          }));
          socket.close(4003, 'Kicked by host');
        } catch (e) {}
      }
      return { isKicked: true };
    }

    // Purge any preexisting socket for the same attendeeId to prevent ghost/zombie duplication
    for (const [sId, l] of room.listeners.entries()) {
      if (l.attendeeId === attendeeId && sId !== socketId) {
        try {
          if (l.socket && l.socket.readyState === 1) {
            l.socket.close(4001, 'Reconnected with new socket');
          }
        } catch (e) {}
        room.listeners.delete(sId);
      }
    }

    const listenerObj = {
      socket,
      socketId,
      attendeeId,
      name,
      email,
      phone,
      lang: targetLang,
      joinedAt: Date.now(),
      ip,
      userAgent: metadata.userAgent || '',
      supportsBinary: Boolean(metadata.supportsBinary || safeMetadata.supportsBinary)
    };

    room.listeners.set(socketId, listenerObj);

    // MEM-01: If attendee is reconnecting and was already in Q&A queue, update socketId to keep queue valid
    if (room.qaQueue && room.qaQueue.length > 0) {
      for (const q of room.qaQueue) {
        if (q.attendeeId === attendeeId || (email && q.email && q.email.toLowerCase() === email.toLowerCase())) {
          q.socketId = socketId;
        }
      }
    }
    if (room.activeSpeaker && (room.activeSpeaker.attendeeId === attendeeId || (email && room.activeSpeaker.email && room.activeSpeaker.email.toLowerCase() === email.toLowerCase()))) {
      room.activeSpeaker.socketId = socketId;
    }

    // Save/Update in persistent registered leads list for this session
    const leadKey = email ? email.toLowerCase() : attendeeId;
    const existing = room.registeredAttendees.get(leadKey);
    room.registeredAttendees.set(leadKey, {
      id: attendeeId,
      name,
      email,
      phone,
      initialLang: existing ? existing.initialLang : targetLang,
      currentLang: targetLang,
      lang: targetLang,
      joinedAt: existing ? existing.joinedAt : new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      reconnectCount: existing ? (existing.reconnectCount || 1) + 1 : 1,
      isKicked: existing ? Boolean(existing.isKicked) : false,
      isOnline: true,
      ip
    });

    // MED-03: Limit registered attendees to 3000 max
    if (room.registeredAttendees.size > 3000) {
      const oldestKey = room.registeredAttendees.keys().next().value;
      if (oldestKey !== undefined) {
        room.registeredAttendees.delete(oldestKey);
      }
    }

    console.log(`[RoomManager] Listener joined room ${room.id} (${name}, ${email}) [Lang: ${lang}] (Total: ${room.listeners.size})`);
    this.broadcastStats(room.id);
    return room;
  }

  updateListenerLanguage(roomId, socketId, newLang) {
    const room = this.getRoom(roomId);
    if (!room) return false;

    const listener = room.listeners.get(socketId);
    if (listener) {
      const oldLang = listener.lang;
      listener.lang = newLang.toLowerCase();

      const leadKey = listener.email ? listener.email.toLowerCase() : (listener.attendeeId || socketId);
      if (room.registeredAttendees && room.registeredAttendees.has(leadKey)) {
        const att = room.registeredAttendees.get(leadKey);
        att.currentLang = listener.lang;
        att.lang = listener.lang;
      }

      console.log(`[RoomManager] Listener ${socketId} in room ${roomId} switched lang from ${oldLang} to ${newLang}`);
      const activeLangs = this.getActiveLanguages(roomId);
      if (!activeLangs.includes(oldLang)) {
        import('./services/geminiLiveBridge.js').then(m => m.geminiLiveBridge.closeCabin(roomId, oldLang)).catch(() => {});
      }
      this.broadcastStats(room.id);
      return true;
    }
    return false;
  }

  removeListener(socketId) {
    for (const room of this.rooms.values()) {
      const hasListener = room.listeners && room.listeners.has(socketId);
      const isActiveSpeaker = room.activeSpeaker && room.activeSpeaker.socketId === socketId;
      const isInQueue = room.qaQueue && room.qaQueue.some(q => q.socketId === socketId);

      if (hasListener || isActiveSpeaker || isInQueue) {
        if (hasListener) {
          const listener = room.listeners.get(socketId);
          const oldLang = listener?.lang;
          if (listener) {
            const leadKey = listener.email ? listener.email.toLowerCase() : (listener.attendeeId || socketId);
            if (room.registeredAttendees && room.registeredAttendees.has(leadKey)) {
              room.registeredAttendees.get(leadKey).isOnline = false;
            }
          }
          room.listeners.delete(socketId);
          if (oldLang) {
            const activeLangs = this.getActiveLanguages(room.id);
            if (!activeLangs.includes(oldLang)) {
              import('./services/geminiLiveBridge.js').then(m => m.geminiLiveBridge.closeCabin(room.id, oldLang)).catch(() => {});
            }
          }
        }
        // If queued question has a persistent attendeeId, keep it so reconnect restores socketId;
        // if anonymous without attendeeId, remove from queue
        if (room.qaQueue && room.qaQueue.length > 0) {
          room.qaQueue = room.qaQueue.map(q => {
            if (q.socketId === socketId) {
              const isAnonymous = !q.attendeeId || q.attendeeId === socketId;
              return isAnonymous ? null : { ...q, socketId: null };
            }
            return q;
          }).filter(Boolean);
        }
        // MEM-01: If disconnected listener was activeSpeaker, reset and broadcast qa_question_closed
        if (isActiveSpeaker) {
          room.activeSpeaker = null;
          this.broadcastToRoom(room.id, {
            type: 'QA_QUESTION_CLOSED'
          });
        }
        console.log(`[RoomManager] Listener ${socketId} left room ${room.id} (Remaining: ${room.listeners.size})`);
        this.broadcastStats(room.id);
        break;
      }
    }
  }

  getAttendeesList(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return [];
    return Array.from(room.registeredAttendees.values());
  }

  getAttendeesCsv(roomId) {
    const attendees = this.getAttendeesList(roomId);
    const headers = ['Nombre', 'Email', 'Telefono', 'Idioma Inicial', 'Idioma Actual', 'Fecha Registro', 'IP'];

    const sanitizeCsvCell = (val) => {
      let str = val !== null && val !== undefined ? String(val) : '';
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = attendees.map(a => [
      sanitizeCsvCell(a.name),
      sanitizeCsvCell(a.email),
      sanitizeCsvCell(a.phone),
      sanitizeCsvCell((a.initialLang || '').toUpperCase()),
      sanitizeCsvCell((a.currentLang || '').toUpperCase()),
      sanitizeCsvCell(a.joinedAt),
      sanitizeCsvCell(a.ip)
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  getRoomStats(roomId) {
    // Kept for backward compatibility - returns host-level stats
    return this.getHostStats(roomId);
  }

  getPublicStats(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const langCounts = {};
    const sanitizedAttendees = [];

    // 1. Host presence (if connected)
    if (room.hostSocket) {
      sanitizedAttendees.push({
        id: 'host',
        name: room.hostName || 'Ponente Principal',
        lang: room.sourceLang || 'es',
        isHost: true
      });
    }

    // 2. Connected Listeners (Strictly GDPR compliant: NO email, NO phone, NO IP)
    const seenAttendeeIds = new Set();
    for (const listener of room.listeners.values()) {
      const l = listener.lang || 'en';
      langCounts[l] = (langCounts[l] || 0) + 1;

      const attId = listener.attendeeId || listener.socketId;
      if (!seenAttendeeIds.has(attId)) {
        seenAttendeeIds.add(attId);
        sanitizedAttendees.push({
          id: attId,
          name: listener.name || 'Oyente',
          lang: l,
          isHost: false
        });
      }
    }

    const activeListenersCount = room.listeners ? room.listeners.size : 0;
    const registeredOnlineCount = room.registeredAttendees 
      ? Array.from(room.registeredAttendees.values()).filter(a => !a.isKicked && a.isOnline !== false).length 
      : 0;
    const effectiveTotal = Math.max(activeListenersCount, registeredOnlineCount);

    return {
      roomId: room.id,
      title: (room.title === 'Conferencia Principal 2026') ? 'Conferencia Principal' : (room.title || 'Conferencia Principal'),
      isHostOnline: !!room.hostSocket,
      totalListeners: effectiveTotal,
      languageBreakdown: langCounts,
      qaQueueCount: (room.qaQueue || []).length,
      qaMode: room.config?.qaMode || 'host_controlled',
      qaEnabled: Boolean(room.config?.qaEnabled),
      isQAAllowed: (room.config?.qaMode === 'always') || Boolean(room.config?.qaEnabled),
      activeSpeaker: room.activeSpeaker ? { attendeeId: room.activeSpeaker.attendeeId, name: room.activeSpeaker.name, lang: room.activeSpeaker.lang } : null,
      attendees: sanitizedAttendees,
      metrics: room.metrics
    };
  }

  getHostStats(roomId) {
    const publicStats = this.getPublicStats(roomId);
    if (!publicStats) return null;
    const room = this.getRoom(roomId);

    return {
      ...publicStats,
      totalRegisteredLeads: room.registeredAttendees ? room.registeredAttendees.size : 0,
      attendees: Array.from(room.registeredAttendees ? room.registeredAttendees.values() : []),
      kickedAttendees: Array.from((room.kickedAttendees || new Map()).values()),
      qaQueue: room.qaQueue || [],
      activeSpeaker: room.activeSpeaker || null
    };
  }

  getAdminStats(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const targetLangs = room.config?.targetLanguages || ['es', 'en', 'it', 'pt'];

    // 1. Telemetría completa de cabinas (asegurando todas las cabinas objetivo aunque tengan 0)
    const langCounts = {};
    for (const lang of targetLangs) {
      langCounts[lang] = 0;
    }
    if (room.listeners) {
      for (const listener of room.listeners.values()) {
        const l = (listener.lang || 'en').toLowerCase().trim();
        langCounts[l] = (langCounts[l] || 0) + 1;
      }
    }

    // 2. Detección de Habla en Directo (Voice Activity en los últimos 12s)
    const lastTranscript = room.transcriptHistory?.length > 0
      ? room.transcriptHistory[room.transcriptHistory.length - 1]
      : null;
    const lastSpeechAt = lastTranscript ? lastTranscript.timestamp : null;
    const isSpeaking = lastSpeechAt ? (Date.now() - lastSpeechAt < 12000) : false;

    // 3. Totales de Asistencia
    const activeListenersCount = room.listeners ? room.listeners.size : 0;
    const registeredOnlineCount = room.registeredAttendees
      ? Array.from(room.registeredAttendees.values()).filter(a => !a.isKicked && a.isOnline !== false).length
      : 0;
    const effectiveTotal = Math.max(activeListenersCount, registeredOnlineCount);

    return {
      roomId: room.id,
      title: room.title || 'Conferencia sin título',
      createdAt: room.createdAt || Date.now(),
      lastActivity: room.lastActivity || room.createdAt || Date.now(),
      uptimeSeconds: Math.floor((Date.now() - (room.createdAt || Date.now())) / 1000),
      isHostOnline: !!(room.hostSocket && room.hostSocket.readyState === 1),
      hostName: room.hostName || 'Ponente Principal',
      sourceLanguage: room.sourceLang || 'es',
      totalListeners: effectiveTotal,
      activeListenersCount,
      languageBreakdown: langCounts,
      targetLanguages: targetLangs,
      isSpeaking,
      lastSpeechAt,
      monitoredBooth: room.monitoredBooth || null,
      qaQueueCount: (room.qaQueue || []).length,
      activeSpeaker: room.activeSpeaker || null,
      pipelineHealth: {
        averageLatencyMs: room.metrics?.averageLatencyMs || 240,
        totalSpokenSeconds: room.metrics?.totalSpokenSeconds || 0,
        sentencesProcessed: room.transcriptHistory?.length || 0,
      }
    };
  }


  isQAAllowed(roomIdOrRoom) {
    const room = typeof roomIdOrRoom === 'string' ? this.getRoom(roomIdOrRoom) : roomIdOrRoom;
    if (!room || !room.config) return false;
    const mode = room.config.qaMode || 'host_controlled';
    if (mode === 'always') return true;
    return Boolean(room.config.qaEnabled);
  }

  addHandRaise(roomId, socketId, profile = {}) {
    const room = this.getRoom(roomId);
    if (!room || !this.isQAAllowed(room)) return null;
    const attendeeId = profile.attendeeId || socketId;
    const name = typeof profile.name === 'string' ? profile.name.trim().slice(0, 80) : 'Asistente';
    const rawLang = typeof profile.lang === 'string' ? profile.lang : (typeof profile.nativeLang === 'string' ? profile.nativeLang : (typeof profile.currentLang === 'string' ? profile.currentLang : 'es'));
    const lang = rawLang.trim().toLowerCase().slice(0, 10);
    const questionText = typeof profile.questionText === 'string' ? profile.questionText.trim().slice(0, 500) : '';

    const existingIdx = room.qaQueue.findIndex(q => q.socketId === socketId || q.attendeeId === attendeeId);
    const serverGenId = `q_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const assignedId = (existingIdx >= 0 && room.qaQueue[existingIdx].questionId) ? room.qaQueue[existingIdx].questionId : serverGenId;
    const item = {
      questionId: assignedId,
      socketId,
      attendeeId,
      name,
      nativeLang: lang,
      lang,
      questionText,
      status: 'pending',
      timestamp: Date.now()
    };

    if (existingIdx >= 0) {
      room.qaQueue[existingIdx] = item;
    } else {
      room.qaQueue.push(item);
      // SEC-04: Límite superior estricto de 100 preguntas pendientes (FIFO drop)
      while (room.qaQueue.length > 100) {
        room.qaQueue.shift();
      }
    }
    this.broadcastStats(roomId);
    return item;
  }

  approveHandRaise(roomId, attendeeIdOrSocketId) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    const idx = room.qaQueue.findIndex(q => q.questionId === attendeeIdOrSocketId || q.attendeeId === attendeeIdOrSocketId || q.socketId === attendeeIdOrSocketId);
    if (idx >= 0) {
      const item = room.qaQueue.splice(idx, 1)[0];
      room.activeSpeaker = { ...item, status: 'speaking', startedAt: Date.now() };
      this.broadcastStats(roomId);
      return room.activeSpeaker;
    }
    return null;
  }

  closeCurrentQuestion(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    const prev = room.activeSpeaker;
    room.activeSpeaker = null;
    this.broadcastStats(roomId);
    return prev;
  }

  removeHandRaise(roomId, attendeeIdOrSocketId) {
    const room = this.getRoom(roomId);
    if (!room) return false;
    const initialLen = room.qaQueue.length;
    const hadActiveSpeaker = !!room.activeSpeaker && (room.activeSpeaker.attendeeId === attendeeIdOrSocketId || room.activeSpeaker.socketId === attendeeIdOrSocketId);
    room.qaQueue = room.qaQueue.filter(q => q.attendeeId !== attendeeIdOrSocketId && q.socketId !== attendeeIdOrSocketId);
    if (hadActiveSpeaker) {
      room.activeSpeaker = null;
    }
    if (room.qaQueue.length !== initialLen || hadActiveSpeaker) {
      this.broadcastStats(roomId);
      return true;
    }
    return false;
  }

  setQAMode(roomId, qaMode) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    if (!room.config) room.config = {};
    const normalizedMode = qaMode === 'always' ? 'always' : 'host_controlled';
    room.config.qaMode = normalizedMode;
    this.broadcastStats(roomId, true);
    return {
      qaMode: room.config.qaMode,
      qaEnabled: Boolean(room.config.qaEnabled),
      isQAAllowed: this.isQAAllowed(room)
    };
  }

  setQAEnabled(roomId, enabled) {
    const room = this.getRoom(roomId);
    if (!room) return false;
    if (!room.config) room.config = {};
    room.config.qaEnabled = Boolean(enabled);
    this.broadcastStats(roomId, false);
    return room.config.qaEnabled;
  }

  broadcastStats(roomId, immediate = false) {
    const room = this.getRoom(roomId);
    if (!room) return;

    if (!immediate) {
      if (room._statsDebounceTimer) return;
      room._statsDebounceTimer = setTimeout(() => {
        room._statsDebounceTimer = null;
        this._dispatchStats(room);
      }, 250);
      if (room._statsDebounceTimer.unref) room._statsDebounceTimer.unref();
      return;
    }

    if (room._statsDebounceTimer) {
      clearTimeout(room._statsDebounceTimer);
      room._statsDebounceTimer = null;
    }
    this._dispatchStats(room);
  }

  _dispatchStats(room) {
    if (!room) return;
    const roomId = room.id;
    const MAX_BUFFERED_STATS = 256 * 1024; // 256 KB backpressure limit (RES-01)

    // 1. Send private stats (with attendees) ONLY to the host
    if (room.hostSocket && room.hostSocket.readyState === 1) {
      if (room.hostSocket.bufferedAmount <= MAX_BUFFERED_STATS) {
        const hostStats = this.getHostStats(roomId);
        try {
          room.hostSocket.send(JSON.stringify({
            type: 'ROOM_STATS',
            stats: hostStats
          }));
        } catch (e) { /* ignore */ }
      }
    }

    // 2. Send sanitized public stats (NO PII) to all listeners
    const publicStats = this.getPublicStats(roomId);
    if (!publicStats) return;

    const publicPayload = JSON.stringify({
      type: 'ROOM_STATS',
      stats: publicStats
    });

    for (const [socketId, listener] of room.listeners.entries()) {
      if (!listener.socket || listener.socket.readyState > 1) {
        room.listeners.delete(socketId);
        continue;
      }
      if (listener.socket.readyState === 1) {
        if (listener.socket.bufferedAmount <= MAX_BUFFERED_STATS) {
          try {
            listener.socket.send(publicPayload);
          } catch (e) { /* ignore */ }
        }
      }
    }
  }

  broadcastToRoom(roomId, data) {
    const room = this.getRoom(roomId);
    if (!room) return;

    const payload = JSON.stringify(data);
    const MAX_BUFFERED_BYTES = 512 * 1024;
    
    // Send to host with backpressure check
    if (room.hostSocket && room.hostSocket.readyState === 1) {
      if (room.hostSocket.bufferedAmount <= MAX_BUFFERED_BYTES) {
        try { room.hostSocket.send(payload); } catch (e) { /* ignore */ }
      }
    }

    // Send to all listeners with backpressure check
    for (const listener of room.listeners.values()) {
      if (listener.socket && listener.socket.readyState === 1) {
        if (listener.socket.bufferedAmount <= MAX_BUFFERED_BYTES) {
          try { listener.socket.send(payload); } catch (e) { /* ignore */ }
        }
      }
    }
  }

  broadcastAudioToLanguageChannel(roomId, lang, audioPacket) {
    const room = this.getRoom(roomId);
    if (!room) return;

    const targetLang = lang.toLowerCase();
    const currentSeq = audioPacket.seqId || 0;

    // Defense against out-of-order playback: RFC-1982 modular sequence arithmetic
    if (!room.lastBroadcastSeqByLang) room.lastBroadcastSeqByLang = new Map();
    const lastSeq = room.lastBroadcastSeqByLang.get(targetLang) || 0;
    if (lastSeq > 0 && currentSeq > 0 && !audioPacket.isHealed && !audioPacket.isHotSwitch) {
      const diff = (currentSeq - lastSeq) & 0xFFFF;
      const isOlder = diff > 0x8000;
      const stepBack = (lastSeq - currentSeq) & 0xFFFF;
      // Drop only if genuinely older within a reasonable window (< 250 packets)
      // If stepBack is large, it indicates a sequence restart/new session
      if (isOlder && stepBack < 250) {
        console.warn(`[RoomManager] ⚠️ Dropping out-of-order audio packet for lang ${targetLang}: seq ${currentSeq} < lastSeq ${lastSeq}`);
        return;
      }
    }
    if (currentSeq > 0 && !audioPacket.isHealed) {
      room.lastBroadcastSeqByLang.set(targetLang, currentSeq);
    }

    const payloadData = {
      type: 'AUDIO_CHUNK',
      lang: targetLang,
      audioBase64: audioPacket.audioBase64,
      useClientWebSpeech: audioPacket.useClientWebSpeech,
      mimeType: audioPacket.mimeType || 'audio/mpeg',
      id: audioPacket.id,
      seqId: currentSeq || 1,
      text: audioPacket.text,
      timestamp: audioPacket.timestamp || Date.now(),
      duration: audioPacket.duration || 0,
      latencyMs: audioPacket.latencyMs || 0,
      isHealed: Boolean(audioPacket.isHealed),
      isHotSwitch: Boolean(audioPacket.isHotSwitch),
      medicalMode: Boolean(audioPacket.medicalMode)
    };

    // Cache latest audio packet per language booth for Hot Channel Switching with auto-expiration
    if (!room.lastAudioByLang) room.lastAudioByLang = new Map();
    room.lastAudioByLang.set(targetLang, {
      ...payloadData,
      broadcastAt: Date.now()
    });

    // Purgar entradas antiguas en lastAudioByLang (>12s) para no retener Base64 en memoria
    const nowTs = Date.now();
    for (const [lKey, entry] of room.lastAudioByLang.entries()) {
      if (nowTs - (entry.broadcastAt || 0) > 12000) {
        room.lastAudioByLang.delete(lKey);
      }
    }

    // Lazy JSON stringification to save Node.js CPU when all clients use binary
    let cachedJsonPayload = null;
    const getJsonPayload = () => {
      if (!cachedJsonPayload) {
        cachedJsonPayload = JSON.stringify(payloadData);
      }
      return cachedJsonPayload;
    };

    // LVBP v1.1 (LiftVoice Binary Protocol v1.1 - 2026 Edition)
    // Packaging 14-byte fixed header: [0x4C56, 0x01, langCode, seqId, timestamp, payloadLen(UInt32), audioBytes]
    const LANG_CODES = { es: 1, en: 2, it: 3, pt: 4, fr: 5, de: 6, zh: 7, ja: 8, ru: 9 };
    const langCodeNum = LANG_CODES[targetLang] || 1;

    let binaryPayloadBuf = null;
    if (audioPacket.audioBuffer && Buffer.isBuffer(audioPacket.audioBuffer)) {
      binaryPayloadBuf = audioPacket.audioBuffer;
    } else if (audioPacket.audioBase64) {
      try {
        binaryPayloadBuf = Buffer.from(audioPacket.audioBase64, 'base64');
      } catch (e) {}
    }

    let binaryPacket = null;
    if (binaryPayloadBuf && binaryPayloadBuf.length > 0) {
      const header = Buffer.alloc(14); // Memoria limpia garantizada
      header.writeUInt16BE(0x4C56, 0);                                      // Magic 'LV'
      header.writeUInt8(0x01, 2);                                            // Type: AUDIO_FRAME
      header.writeUInt8(langCodeNum, 3);                                     // Lang ID
      header.writeUInt16BE(currentSeq & 0xFFFF, 4);                          // Sequence ID (16-bit)
      header.writeUInt32BE((audioPacket.timestamp || Date.now()) >>> 0, 6);  // Timestamp (ms)
      header.writeUInt32BE(binaryPayloadBuf.length >>> 0, 10);               // Payload Length (UInt32BE: eliminates 64KB limit)

      binaryPacket = Buffer.concat([header, binaryPayloadBuf]);
    }

    const MAX_BUFFERED_BYTES = 256 * 1024; // 256 KB backpressure threshold
    const KILL_BUFFERED_BYTES = 1024 * 1024; // 1 MB: zombie connection, terminate to protect server heap
    let sentCount = 0;
    for (const [socketId, listener] of room.listeners.entries()) {
      // 1. Proactively evict any closing or dead sockets
      if (!listener.socket || listener.socket.readyState > 1) {
        room.listeners.delete(socketId);
        continue;
      }

      if (listener.lang === targetLang && listener.socket.readyState === 1) {
        // Immediate termination if buffer exceeded 1MB (zombie protection)
        if (listener.socket.bufferedAmount > KILL_BUFFERED_BYTES) {
          console.warn(`[RoomManager] 🛑 Saturated zombie socket (${listener.socket.bufferedAmount} bytes). Terminating.`);
          try {
            listener.socket.terminate();
          } catch (e) {}
          const leadKey = listener.email ? listener.email.toLowerCase() : (listener.attendeeId || socketId);
          if (room.registeredAttendees && room.registeredAttendees.has(leadKey)) {
            room.registeredAttendees.get(leadKey).isOnline = false;
          }
          room.listeners.delete(socketId);
          continue;
        }

        // Backpressure check with congested consecutive skips timeout
        if (listener.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
          listener.congestedSkips = (listener.congestedSkips || 0) + 1;
          if (listener.congestedSkips >= 10) {
            console.warn(`[RoomManager] 🛑 Unresponsive client stalled for ${listener.congestedSkips} chunks (${listener.socket.bufferedAmount} bytes). Evicting.`);
            try {
              listener.socket.terminate();
            } catch (e) {}
            const leadKey = listener.email ? listener.email.toLowerCase() : (listener.attendeeId || socketId);
            if (room.registeredAttendees && room.registeredAttendees.has(leadKey)) {
              room.registeredAttendees.get(leadKey).isOnline = false;
            }
            room.listeners.delete(socketId);
            continue;
          }
          continue;
        }

        // Reset congested counter on healthy delivery
        listener.congestedSkips = 0;

        try {
          if (binaryPacket && listener.supportsBinary) {
            listener.socket.send(binaryPacket, { binary: true });
          } else {
            listener.socket.send(getJsonPayload());
          }
          sentCount++;
        } catch (err) {
          console.error(`Error sending audio to listener:`, err);
        }
      }
    }

    // Send to host ONLY if host is actively monitoring this specific booth or if it's preview
    if (room.hostSocket && room.hostSocket.readyState === 1) {
      const isMonitoredByHost = room.monitoredBooth && room.monitoredBooth.toLowerCase() === targetLang;
      if (isMonitoredByHost || audioPacket.isHostPreview) {
        if (room.hostSocket.bufferedAmount <= MAX_BUFFERED_BYTES) {
          try {
            if (binaryPacket && room.hostSocket.supportsBinary) {
              room.hostSocket.send(binaryPacket, { binary: true });
            } else {
              room.hostSocket.send(JSON.stringify({
                ...payloadData,
                isBoothAudio: true
              }));
            }
          } catch (err) {}
        }
      }
    }

    room.metrics.audioPacketsBroadcast += sentCount;
    return sentCount;
  }

  /**
   * Retrieves the currently active/recent audio chunk for a language booth.
   * Enables seamless hot-switching when a listener changes channels.
   */
  getRecentAudioForLang(roomId, lang) {
    const room = this.getRoom(roomId);
    if (!room || !room.lastAudioByLang) return null;
    const targetLang = (lang || '').toLowerCase();
    const packet = room.lastAudioByLang.get(targetLang);
    if (!packet) return null;

    const elapsedMs = Date.now() - (packet.broadcastAt || 0);
    // Grace window: audio duration + 3500ms
    const validWindow = (packet.duration && packet.duration > 0) ? (packet.duration + 3500) : 7500;
    if (elapsedMs <= validWindow) {
      return packet;
    }
    // Eagerly delete expired audio chunk to prevent heap retention
    room.lastAudioByLang.delete(targetLang);
    return null;
  }
}

export const roomManager = new RoomManager();
export default roomManager;
