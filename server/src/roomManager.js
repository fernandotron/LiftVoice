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

    // Inactive room reaper (runs every 2 minutes, cleans rooms idle for > 20 mins)
    const reaperInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, room] of this.rooms.entries()) {
        const isAbandoned = !room.hostSocket && room.listeners.size === 0;
        const isIdle = (now - (room.lastActivity || room.createdAt)) > 20 * 60 * 1000;
        if (isAbandoned && isIdle) {
          console.log(`[RoomManager] Reaped inactive room ${id}`);
          this.rooms.delete(id);
          import('./services/aiPipeline.js').then(m => m.aiPipeline.cleanupRoom(id)).catch(() => {});
        }
      }
    }, 120 * 1000);
    if (reaperInterval && typeof reaperInterval.unref === 'function') {
      reaperInterval.unref();
    }
  }

  createRoom(customId = null, title = 'Conferencia Principal 2026') {
    const rawId = customId ? String(customId).trim() : generateMeetCode();
    const normalizedKey = normalizeRoomId(rawId);

    const existing = this.getRoom(rawId);
    if (existing) {
      return existing;
    }

    const roomId = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(normalizedKey)
      ? normalizedKey
      : rawId.toUpperCase();

    const room = {
      id: roomId,
      title,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      hostSocket: null,
      hostSocketId: null,
      listeners: new Map(), // socketId -> { socket, name, email, phone, lang, joinedAt, ip, userAgent }
      registeredAttendees: new Map(), // email or socketId -> { id, name, email, phone, initialLang, currentLang, joinedAt, ip }
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
        targetLanguages: ['es', 'en', 'it', 'pt'],
        autoDetectSource: true,
        defaultLanguage: 'es',
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
    const normalized = normalizeRoomId(roomId);
    let deleted = false;
    if (this.rooms.has(normalized)) {
      this.rooms.delete(normalized);
      deleted = true;
    }
    const upper = String(roomId).toUpperCase();
    if (this.rooms.has(upper)) {
      this.rooms.delete(upper);
      deleted = true;
    }
    if (deleted) {
      console.log(`[RoomManager] Room deleted: ${roomId}`);
      import('./services/aiPipeline.js').then(m => m.aiPipeline.cleanupRoom(roomId)).catch(() => {});
    }
    return deleted;
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

  getOrCreateRoom(roomId, title) {
    const existing = this.getRoom(roomId);
    if (existing) return existing;
    return this.createRoom(roomId, title);
  }

  setHost(roomId, socket, socketId) {
    const room = this.getOrCreateRoom(roomId);
    room.hostSocket = socket;
    room.hostSocketId = socketId;
    room.lastActivity = Date.now();
    console.log(`[RoomManager] Host connected to room ${room.id} (socket: ${socketId})`);
    this.broadcastStats(room.id);
    return room;
  }

  removeHost(socketId) {
    for (const room of this.rooms.values()) {
      if (room.hostSocketId === socketId) {
        room.hostSocket = null;
        room.hostSocketId = null;
        room.lastActivity = Date.now();
        console.log(`[RoomManager] Host disconnected from room ${room.id}`);
        this.broadcastToRoom(room.id, {
          type: 'HOST_STATUS',
          isOnline: false,
          message: 'El ponente se ha desconectado temporalmente'
        });
        break;
      }
    }
  }

  addListener(roomId, socket, socketId, lang = 'en', metadata = {}) {
    const room = this.getOrCreateRoom(roomId);
    const targetLang = (lang || 'en').toLowerCase();
    const name = metadata.name || 'Asistente Anónimo';
    const email = metadata.email || '';
    const phone = metadata.phone || '';

    const listenerObj = {
      socket,
      name,
      email,
      phone,
      lang: targetLang,
      joinedAt: Date.now(),
      ip: metadata.ip || 'unknown',
      userAgent: metadata.userAgent || ''
    };

    room.listeners.set(socketId, listenerObj);

    // Save/Update in persistent registered leads list for this session
    const leadKey = email ? email.toLowerCase() : (metadata.attendeeId || socketId);
    const existing = room.registeredAttendees.get(leadKey);
    room.registeredAttendees.set(leadKey, {
      id: metadata.attendeeId || socketId,
      name,
      email,
      phone,
      initialLang: existing ? existing.initialLang : targetLang,
      currentLang: targetLang,
      joinedAt: existing ? existing.joinedAt : new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      reconnectCount: existing ? (existing.reconnectCount || 1) + 1 : 1,
      ip: metadata.ip || 'unknown'
    });

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

      const leadKey = listener.email ? listener.email.toLowerCase() : socketId;
      if (room.registeredAttendees.has(leadKey)) {
        room.registeredAttendees.get(leadKey).currentLang = listener.lang;
      }

      console.log(`[RoomManager] Listener ${socketId} in room ${roomId} switched lang from ${oldLang} to ${newLang}`);
      this.broadcastStats(room.id);
      return true;
    }
    return false;
  }

  removeListener(socketId) {
    for (const room of this.rooms.values()) {
      if (room.listeners.has(socketId)) {
        room.listeners.delete(socketId);
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
    const rows = attendees.map(a => [
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${(a.email || '').replace(/"/g, '""')}"`,
      `"${(a.phone || '').replace(/"/g, '""')}"`,
      `"${(a.initialLang || '').toUpperCase()}"`,
      `"${(a.currentLang || '').toUpperCase()}"`,
      `"${a.joinedAt || ''}"`,
      `"${a.ip || ''}"`
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
    for (const listener of room.listeners.values()) {
      const l = listener.lang || 'en';
      langCounts[l] = (langCounts[l] || 0) + 1;
    }

    return {
      roomId: room.id,
      title: room.title,
      isHostOnline: !!room.hostSocket,
      totalListeners: room.listeners.size,
      languageBreakdown: langCounts,
      qaQueueCount: (room.qaQueue || []).length,
      activeSpeaker: room.activeSpeaker ? { attendeeId: room.activeSpeaker.attendeeId, name: room.activeSpeaker.name, lang: room.activeSpeaker.lang } : null,
      metrics: room.metrics
    };
  }

  getHostStats(roomId) {
    const publicStats = this.getPublicStats(roomId);
    if (!publicStats) return null;
    const room = this.getRoom(roomId);

    return {
      ...publicStats,
      totalRegisteredLeads: room.registeredAttendees.size,
      attendees: Array.from(room.registeredAttendees.values()),
      qaQueue: room.qaQueue || [],
      activeSpeaker: room.activeSpeaker || null
    };
  }

  /**
   * Returns an array of language codes currently active in the room (at least 1 listener or preview)
   */
  getActiveLanguages(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return ['es', 'en'];

    const activeSet = new Set();
    for (const listener of room.listeners.values()) {
      if (listener.lang) activeSet.add(listener.lang.toLowerCase());
    }

    // Always keep all 4 primary cabins warm so hot-switching and host headphone monitoring is instantaneous
    activeSet.add('en');
    activeSet.add('es');
    activeSet.add('it');
    activeSet.add('pt');

    return Array.from(activeSet);
  }

  addHandRaise(roomId, socketId, profile = {}) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    const attendeeId = profile.attendeeId || socketId;
    const name = profile.name || 'Asistente';
    const lang = (profile.lang || profile.currentLang || 'es').toLowerCase();

    const existingIdx = room.qaQueue.findIndex(q => q.socketId === socketId || q.attendeeId === attendeeId);
    const item = {
      socketId,
      attendeeId,
      name,
      lang,
      timestamp: Date.now()
    };

    if (existingIdx >= 0) {
      room.qaQueue[existingIdx] = item;
    } else {
      room.qaQueue.push(item);
    }
    this.broadcastStats(roomId);
    return item;
  }

  approveHandRaise(roomId, attendeeIdOrSocketId) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    const idx = room.qaQueue.findIndex(q => q.attendeeId === attendeeIdOrSocketId || q.socketId === attendeeIdOrSocketId);
    if (idx >= 0) {
      const item = room.qaQueue.splice(idx, 1)[0];
      room.activeSpeaker = { ...item, startedAt: Date.now() };
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
    room.qaQueue = room.qaQueue.filter(q => q.attendeeId !== attendeeIdOrSocketId && q.socketId !== attendeeIdOrSocketId);
    if (room.activeSpeaker && (room.activeSpeaker.attendeeId === attendeeIdOrSocketId || room.activeSpeaker.socketId === attendeeIdOrSocketId)) {
      room.activeSpeaker = null;
    }
    if (room.qaQueue.length !== initialLen) {
      this.broadcastStats(roomId);
      return true;
    }
    return false;
  }

  broadcastStats(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    // 1. Send private stats (with attendees) ONLY to the host
    if (room.hostSocket && room.hostSocket.readyState === 1) {
      const hostStats = this.getHostStats(roomId);
      try {
        room.hostSocket.send(JSON.stringify({
          type: 'ROOM_STATS',
          stats: hostStats
        }));
      } catch (e) { /* ignore */ }
    }

    // 2. Send sanitized public stats (NO PII) to all listeners
    const publicStats = this.getPublicStats(roomId);
    if (!publicStats) return;

    const publicPayload = JSON.stringify({
      type: 'ROOM_STATS',
      stats: publicStats
    });

    for (const listener of room.listeners.values()) {
      if (listener.socket && listener.socket.readyState === 1) {
        try {
          listener.socket.send(publicPayload);
        } catch (e) { /* ignore */ }
      }
    }
  }

  broadcastToRoom(roomId, data) {
    const room = this.getRoom(roomId);
    if (!room) return;

    const payload = JSON.stringify(data);
    
    // Send to host
    if (room.hostSocket && room.hostSocket.readyState === 1) {
      try { room.hostSocket.send(payload); } catch (e) { /* ignore */ }
    }

    // Send to all listeners
    for (const listener of room.listeners.values()) {
      if (listener.socket && listener.socket.readyState === 1) {
        try { listener.socket.send(payload); } catch (e) { /* ignore */ }
      }
    }
  }

  broadcastAudioToLanguageChannel(roomId, lang, audioPacket) {
    const room = this.getRoom(roomId);
    if (!room) return;

    const targetLang = lang.toLowerCase();
    const payloadData = {
      type: 'AUDIO_CHUNK',
      lang: targetLang,
      audioBase64: audioPacket.audioBase64,
      useClientWebSpeech: audioPacket.useClientWebSpeech,
      mimeType: audioPacket.mimeType || 'audio/mp3',
      id: audioPacket.id,
      seqId: audioPacket.seqId || 1,
      text: audioPacket.text,
      timestamp: audioPacket.timestamp || Date.now(),
      duration: audioPacket.duration || 0,
      latencyMs: audioPacket.latencyMs || 0
    };

    // Cache latest audio packet per language booth for Hot Channel Switching
    if (!room.lastAudioByLang) room.lastAudioByLang = new Map();
    room.lastAudioByLang.set(targetLang, {
      ...payloadData,
      broadcastAt: Date.now()
    });

    const payload = JSON.stringify(payloadData);

    let sentCount = 0;
    for (const listener of room.listeners.values()) {
      if (listener.lang === targetLang && listener.socket && listener.socket.readyState === 1) {
        try {
          listener.socket.send(payload);
          sentCount++;
        } catch (err) {
          console.error(`Error sending audio to listener:`, err);
        }
      }
    }

    // Also send to host for headphone booth monitoring & live telemetry
    if (room.hostSocket && room.hostSocket.readyState === 1) {
      try {
        room.hostSocket.send(JSON.stringify({
          ...payloadData,
          isBoothAudio: true
        }));
      } catch (err) {}
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
    return null;
  }

  addTranscriptItem(roomId, transcriptItem) {
    const room = this.getRoom(roomId);
    if (!room) return;

    room.transcriptHistory.push(transcriptItem);
    if (room.transcriptHistory.length > 100) {
      room.transcriptHistory.shift();
    }
    room.metrics.sentencesProcessed++;

    this.broadcastToRoom(roomId, {
      type: 'TRANSCRIPT_EVENT',
      item: transcriptItem
    });
  }
}

export const roomManager = new RoomManager();
