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
      const reapedRooms = new Set();
      for (const [id, room] of this.rooms.entries()) {
        if (!room || reapedRooms.has(room)) continue;
        const isAbandoned = !room.hostSocket && (!room.listeners || room.listeners.size === 0);
        const hasHistoryOrAttendees = (room.transcriptHistory && room.transcriptHistory.length > 0) || (room.registeredAttendees && room.registeredAttendees.size > 0);
        const maxIdleMs = hasHistoryOrAttendees ? 60 * 60 * 1000 : 20 * 60 * 1000;
        const isIdle = (now - (room.lastActivity || room.createdAt)) > maxIdleMs;
        if (isAbandoned && isIdle) {
          reapedRooms.add(room);
          console.log(`[RoomManager] Reaped inactive room ${id}`);

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
        }
      }
    }, 120 * 1000);
    if (reaperInterval && typeof reaperInterval.unref === 'function') {
      reaperInterval.unref();
    }
  }

  createRoom(customId = null, title = 'Conferencia Principal 2026', hostKey = null) {
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
      hostKey: hostKey || null,
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
        targetLanguages: ['es', 'en', 'it', 'pt'],
        autoDetectSource: true,
        defaultLanguage: 'es',
        decalageMode: 'natural',
        decalageValue: 50,
        vadSensitivity: 'standard',
        lazyCabins: true
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

  getActiveLanguages(roomId) {
    const room = this.getRoom(roomId);
    if (!room || !room.listeners) return [];
    const langs = new Set();
    for (const listener of room.listeners.values()) {
      if (listener.lang) langs.add(String(listener.lang).toLowerCase().trim());
    }
    if (room.monitoredBooth) {
      langs.add(String(room.monitoredBooth).toLowerCase().trim());
    }
    return Array.from(langs);
  }

  getOrCreateRoom(roomId, title = 'Conferencia Principal 2026', hostKey = null) {
    const existing = this.getRoom(roomId);
    if (existing) return existing;
    return this.createRoom(roomId, title, hostKey);
  }

  setHost(roomId, socket, socketId, hostKey = null) {
    const room = this.getOrCreateRoom(roomId, 'Conferencia Principal 2026', hostKey);
    if (room.hostKey && room.hostKey !== hostKey) {
      return { success: false, error: 'INVALID_HOST_KEY' };
    }
    if (room.hostSocket && room.hostSocket.readyState === 1 && room.hostSocketId !== socketId) {
      return { success: false, error: 'HOST_ALREADY_CONNECTED' };
    }
    if (!room.hostKey && hostKey) {
      room.hostKey = hostKey;
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
      userAgent: metadata.userAgent || ''
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
      joinedAt: existing ? existing.joinedAt : new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      reconnectCount: existing ? (existing.reconnectCount || 1) + 1 : 1,
      isKicked: existing ? Boolean(existing.isKicked) : false,
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
      const hasListener = room.listeners && room.listeners.has(socketId);
      const isActiveSpeaker = room.activeSpeaker && room.activeSpeaker.socketId === socketId;
      const isInQueue = room.qaQueue && room.qaQueue.some(q => q.socketId === socketId);

      if (hasListener || isActiveSpeaker || isInQueue) {
        if (hasListener) {
          room.listeners.delete(socketId);
        }
        // If queued question has a persistent attendeeId, keep it so reconnect restores socketId;
        // if anonymous without attendeeId, remove from queue
        if (room.qaQueue && room.qaQueue.length > 0) {
          room.qaQueue = room.qaQueue.map(q => {
            if (q.socketId === socketId) {
              return q.attendeeId ? { ...q, socketId: null } : null;
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

    return {
      roomId: room.id,
      title: room.title,
      isHostOnline: !!room.hostSocket,
      totalListeners: room.listeners.size,
      languageBreakdown: langCounts,
      qaQueueCount: (room.qaQueue || []).length,
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
      totalRegisteredLeads: room.registeredAttendees.size,
      attendees: Array.from(room.registeredAttendees.values()),
      kickedAttendees: Array.from((room.kickedAttendees || new Map()).values()),
      qaQueue: room.qaQueue || [],
      activeSpeaker: room.activeSpeaker || null
    };
  }


  addHandRaise(roomId, socketId, profile = {}) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    const attendeeId = profile.attendeeId || socketId;
    const name = profile.name || 'Asistente';
    const lang = (profile.lang || profile.nativeLang || profile.currentLang || 'es').toLowerCase();
    const questionText = (profile.questionText || '').trim();

    const existingIdx = room.qaQueue.findIndex(q => q.socketId === socketId || q.attendeeId === attendeeId);
    const item = {
      questionId: profile.questionId || (existingIdx >= 0 ? room.qaQueue[existingIdx].questionId : `q_${Math.random().toString(36).slice(2, 8)}`),
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

  broadcastStats(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return;

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

    for (const listener of room.listeners.values()) {
      if (listener.socket && listener.socket.readyState === 1) {
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

    // Defense against out-of-order playback: drop audio packets older than the latest broadcasted sequence
    if (!room.lastBroadcastSeqByLang) room.lastBroadcastSeqByLang = new Map();
    const lastSeq = room.lastBroadcastSeqByLang.get(targetLang) || 0;
    if (currentSeq > 0 && currentSeq < lastSeq) {
      console.warn(`[RoomManager] ⚠️ Dropping out-of-order audio packet for lang ${targetLang}: seq ${currentSeq} < lastSeq ${lastSeq}`);
      return;
    }
    if (currentSeq > 0) {
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
      latencyMs: audioPacket.latencyMs || 0
    };

    // Cache latest audio packet per language booth for Hot Channel Switching
    if (!room.lastAudioByLang) room.lastAudioByLang = new Map();
    room.lastAudioByLang.set(targetLang, {
      ...payloadData,
      broadcastAt: Date.now()
    });

    const payload = JSON.stringify(payloadData);

    const MAX_BUFFERED_BYTES = 512 * 1024; // 512 KB backpressure threshold
    let sentCount = 0;
    for (const listener of room.listeners.values()) {
      if (listener.lang === targetLang && listener.socket && listener.socket.readyState === 1) {
        // Backpressure defense against slow mobile clients
        if (listener.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
          console.warn(`[RoomManager] ⚠️ Client buffer saturated (${listener.socket.bufferedAmount} bytes). Skipping chunk to prevent buffer bloat.`);
          continue;
        }

        try {
          listener.socket.send(payload);
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
            room.hostSocket.send(JSON.stringify({
              ...payloadData,
              isBoothAudio: true
            }));
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

    this.broadcastToRoom(roomId, {
      type: 'TRANSCRIPT_EVENT',
      item: transcriptItem
    });
  }
}

export const roomManager = new RoomManager();
