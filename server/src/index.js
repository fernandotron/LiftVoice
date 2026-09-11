import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { roomManager } from './roomManager.js';
import { aiPipeline } from './services/aiPipeline.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Helper to get local Wi-Fi / Ethernet IPv4 address (prioritizing real physical adapters over WSL/Hyper-V/Docker)
function getNetworkInterfacesList() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const iface of addrs) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const isVirtual = /vethernet|wsl|hyper-v|virtual|vbox|vmware|docker|bluetooth|tailscale|loopback/i.test(name);
        const isWifiOrEth = /wi-fi|wifi|wireless|wlan|ethernet|lan/i.test(name) && !isVirtual;
        const is192 = iface.address.startsWith('192.168.');
        const is10 = iface.address.startsWith('10.');
        let score = 0;
        if (isWifiOrEth) score += 100;
        if (!isVirtual) score += 50;
        if (is192) score += 30;
        if (is10) score += 20;
        candidates.push({ name, address: iface.address, isVirtual, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function getLocalIpAddress() {
  const candidates = getNetworkInterfacesList();
  return candidates[0]?.address || '192.168.1.12';
}

import { tunnelService } from './tunnelService.js';

// Serve static client assets in production if built
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
} else {
  // REST API Endpoints / Dev splash
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>LiftVoice Server</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 480px; width: 90%; text-align: center; border: 1px solid #334155; }
          h1 { color: #38bdf8; margin-top: 0; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
          .btn { display: inline-block; background: #2563eb; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; margin-top: 1rem; transition: background 0.2s; }
          .btn:hover { background: #1d4ed8; }
          .badge { display: inline-block; background: #059669; color: #ecfdf5; font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 9999px; font-weight: bold; margin-bottom: 1rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">● SERVIDOR ONLINE</span>
          <h1>🎙️ LiftVoice Backend</h1>
          <p>El servidor API y WebSocket está funcionando correctamente en el puerto ${PORT}.</p>
          <p>Para ver y usar la aplicación completa (interfaz de usuario), abre el cliente frontend:</p>
          <a class="btn" href="http://localhost:5174">Abrir Aplicación LiftVoice (Puerto 5174)</a>
        </div>
      </body>
      </html>
    `);
  });
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: '1.0.0 (August 2026)',
    activeRooms: new Set(roomManager.rooms.values()).size
  });
});

app.get('/api/network-info', (req, res) => {
  const candidates = getNetworkInterfacesList();
  const localIp = candidates[0]?.address || '192.168.1.12';
  const publicUrl = tunnelService.getPublicUrl();
  const defaultClientPort = Number(process.env.CLIENT_PORT) || 5174;
  res.json({
    localIp,
    interfaces: candidates.map(c => ({ name: c.name, address: c.address, isVirtual: c.isVirtual })),
    publicUrl,
    port: PORT,
    clientPort: defaultClientPort,
    suggestedHostUrl: `http://${localIp}:${defaultClientPort}/?room=MAIN&host=true`,
    suggestedListenUrlTemplate: `http://${localIp}:${defaultClientPort}/?room={roomId}`,
    publicListenUrlTemplate: publicUrl ? `${publicUrl}/?room={roomId}` : null
  });
});

app.post('/api/tunnel/start', async (req, res) => {
  try {
    const defaultClientPort = Number(process.env.CLIENT_PORT) || 5174;
    const publicUrl = await tunnelService.startTunnel(defaultClientPort);
    res.json({ success: true, publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rooms', (req, res) => {
  const { roomId, title } = req.body;
  const room = roomManager.createRoom(roomId, title);
  res.json({
    success: true,
    room: {
      id: room.id,
      title: room.title,
      createdAt: room.createdAt
    }
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const stats = roomManager.getPublicStats(req.params.roomId);
  if (!stats) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(stats);
});

// Décalage / Pacing Configuration endpoint
app.post('/api/rooms/:roomId/decalage', (req, res) => {
  const { decalageMode, decalageValue } = req.body;
  const room = roomManager.getRoom(req.params.roomId);
  if (room) {
    if (decalageMode) room.config.decalageMode = decalageMode;
    if (decalageValue !== undefined) room.config.decalageValue = decalageValue;
    return res.json({ success: true, decalageMode, decalageValue });
  }
  res.json({ success: true });
});

// Attendee Leads endpoints
app.get('/api/rooms/:roomId/attendees', (req, res) => {
  const attendees = roomManager.getAttendeesList(req.params.roomId);
  res.json({
    roomId: req.params.roomId.toUpperCase(),
    total: attendees.length,
    attendees
  });
});

app.get('/api/rooms/:roomId/export-csv', (req, res) => {
  const roomId = req.params.roomId.toUpperCase();
  const csvData = roomManager.getAttendeesCsv(roomId);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="LiftVoice_Leads_${roomId}.csv"`);
  res.status(200).send(csvData);
});

app.get('/api/config', async (req, res) => {
  try {
    const { sttService } = await import('./services/sttService.js');
    const { ttsService } = await import('./services/ttsService.js');
    const { translationService } = await import('./services/translationService.js');

    res.json({
      success: true,
      preferredSttEngine: sttService.preferredSttEngine || 'deepgram',
      preferredTtsEngine: ttsService.preferredTtsEngine || 'auto',
      preferredTranslationEngine: translationService.preferredEngine || 'qwen',
      voiceConfig: ttsService.voiceConfig,
      voiceGender: ttsService.voiceGender,
      medicalMode: translationService.medicalMode,
      medicalSpecialty: translationService.medicalSpecialty,
      customGlossary: translationService.customGlossary,
      hasDeepgramKey: Boolean(sttService.deepgramApiKey || ttsService.deepgramApiKey),
      hasElevenLabsKey: Boolean(ttsService.elevenLabsApiKey),
      hasOpenAiKey: Boolean(sttService.openaiApiKey || ttsService.openaiApiKey)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', (req, res) => {
  const openaiApiKey = req.body.openaiApiKey || req.body.openaiKey;
  const deepgramApiKey = req.body.deepgramApiKey || req.body.deepgramKey;
  const elevenLabsApiKey = req.body.elevenLabsApiKey || req.body.elevenLabsKey;
  const deeplApiKey = req.body.deeplApiKey || req.body.deeplKey;
  const qwenApiKey = req.body.qwenApiKey || req.body.qwenKey;
  const {
    qwenModel,
    qwenEndpoint,
    preferredEngine,
    medicalMode,
    medicalSpecialty,
    customGlossary,
    preferredTtsEngine,
    preferredSttEngine,
    sttEngine,
    voiceConfig,
    voiceGender
  } = req.body;

  aiPipeline.setApiKeys({
    openaiApiKey,
    deepgramApiKey,
    elevenLabsApiKey,
    deeplApiKey,
    qwenApiKey,
    qwenModel,
    qwenEndpoint,
    preferredEngine,
    medicalMode,
    medicalSpecialty,
    customGlossary,
    preferredTtsEngine,
    preferredSttEngine: preferredSttEngine || sttEngine,
    voiceConfig,
    voiceGender
  });
  res.json({ success: true, message: 'API keys, STT, TTS and Translation settings updated successfully' });
});

// In-memory token cache for Deepgram Grant tokens (avoids roundtrips on rapid client reconnections)
let cachedGrantToken = null; // { token, expiresAt }

// Ephemeral ASR Token for Direct Deepgram Streaming WebSocket (Nova-3) (#ISSUE-01)
app.post('/api/asr-token', async (req, res) => {
  try {
    const { sttService } = await import('./services/sttService.js');
    const apiKey = sttService.deepgramApiKey || process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Deepgram API key not configured on server' });
    }

    const requestedLang = req.body.language || req.body.lang || 'auto';
    let deepgramLang = 'multi';
    if (requestedLang && requestedLang !== 'auto') {
      const short = requestedLang.slice(0, 2).toLowerCase();
      if (short === 'pt') {
        deepgramLang = requestedLang.toLowerCase().includes('br') ? 'pt-BR' : 'pt';
      } else {
        deepgramLang = short;
      }
    }

    const rawTerms = Array.isArray(req.body.keyterms) ? [...req.body.keyterms] : [];
    if (req.body.medicalMode && req.body.customGlossary && Array.isArray(req.body.customGlossary)) {
      rawTerms.push(...req.body.customGlossary);
    }
    const keyterms = rawTerms
      .map(t => (typeof t === 'object' && t ? (t.term || t.text || t.word || String(t)) : String(t)))
      .map(s => s.trim())
      .filter(Boolean);

    let token = null;
    let expiresIn = 60;
    const now = Date.now();

    // Reutilizar token en caché si aún restan al menos 15 segundos de validez
    if (cachedGrantToken && now < cachedGrantToken.expiresAt - 15000) {
      token = cachedGrantToken.token;
      expiresIn = Math.max(10, Math.round((cachedGrantToken.expiresAt - now) / 1000));
    } else {
      try {
        const grantRes = await fetch('https://api.deepgram.com/v1/auth/grant', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ttl_seconds: 60 }),
          signal: AbortSignal.timeout(5000)
        });
        if (grantRes.ok) {
          const grantData = await grantRes.json();
          token = grantData.access_token || grantData.key;
          expiresIn = grantData.expires_in || 60;
          cachedGrantToken = {
            token,
            expiresAt: now + (expiresIn * 1000)
          };
        } else {
          const errText = await grantRes.text().catch(() => '');
          console.warn(`[ASR Token] Deepgram grant failed (${grantRes.status}): ${errText.slice(0, 300)}`);
          return res.status(502).json({
            error: 'Deepgram Grant API error or insufficient permissions on configured key. Please check Deepgram project permissions.',
            code: 'GRANT_API_UNAVAILABLE',
            status: grantRes.status
          });
        }
      } catch (gErr) {
        console.warn('[ASR Token] Grant fetch exception:', gErr.message);
        return res.status(502).json({
          error: 'Failed to connect to Deepgram Grant API: ' + gErr.message,
          code: 'GRANT_API_NETWORK_ERROR'
        });
      }
    }

    return res.json({
      success: true,
      token,
      expiresIn,
      listenUrl: 'wss://api.deepgram.com/v1/listen',
      model: 'nova-3',
      language: deepgramLang,
      keyterms: [...new Set(keyterms)].slice(0, 50),
      mipOptOut: Boolean(req.body.medicalMode)
    });
  } catch (err) {
    console.error('[ASR Token] Error minting token:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Session Summary with AI
app.post('/api/rooms/:roomId/summary', async (req, res) => {
  try {
    const summary = await aiPipeline.generateSessionSummary(req.params.roomId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Consolidated Multi-Engine Voices Catalog
app.get('/api/voices', async (req, res) => {
  try {
    const { ttsService } = await import('./services/ttsService.js');
    const { lang, engine, configuredOnly } = req.query;
    let catalog = ttsService.getAvailableVoicesCatalog();

    if (lang) {
      catalog = catalog.filter(v => v.lang === 'all' || v.lang === lang.toLowerCase());
    }
    if (engine) {
      catalog = catalog.filter(v => v.engine === engine.toLowerCase());
    }
    if (configuredOnly === 'true') {
      catalog = catalog.filter(v => v.isConfigured);
    }

    const activeEngines = Array.from(new Set(catalog.filter(v => v.isConfigured).map(v => v.engine)));

    res.json({
      success: true,
      timestamp: Date.now(),
      summary: {
        total: catalog.length,
        configured: catalog.filter(v => v.isConfigured).length,
        free: catalog.filter(v => v.isFree).length,
        activeEngines
      },
      voices: catalog
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quick Voice Preview Sampler (for UI voice selector & demo)
app.post('/api/rooms/:roomId/preview-voice', async (req, res) => {
  const { lang, sampleText, voice, gender, engine } = req.body;
  const targetLang = (lang || 'en').toLowerCase();
  const text = sampleText || req.body.text || 'Hello, this is a real-time simultaneous voice preview from LiftVoice.';
  try {
    const { ttsService } = await import('./services/ttsService.js');
    const result = await ttsService.synthesize(text, targetLang, { voice, gender, engine });
    res.json({
      success: true,
      audioBase64: result?.audioBase64,
      mimeType: result?.mimeType || 'audio/mp3',
      lang: targetLang,
      provider: result?.provider || 'google'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Room Voice Configuration
app.post('/api/rooms/:roomId/voices', async (req, res) => {
  const { voiceConfig } = req.body;
  try {
    if (voiceConfig) {
      const { ttsService } = await import('./services/ttsService.js');
      ttsService.setConfig({ voiceConfig });
    }
    res.json({ success: true, voiceConfig });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA Fallback: for any non-API GET request, serve client index.html when built
if (fs.existsSync(clientDistPath)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Create HTTP and WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Active Heartbeat to terminate dead/half-open mobile connections
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('[WS] Terminating inactive zombie connection');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  let clientRole = null; // 'HOST' | 'LISTENER'
  let currentRoomId = null;
  const socketId = `sock_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const clientIp = req.socket.remoteAddress;

  console.log(`[WS] New connection: ${socketId} from ${clientIp}`);

  ws.on('message', async (rawMessage) => {
    try {
      if (typeof rawMessage !== 'string' && !(rawMessage instanceof String) && !Buffer.isBuffer(rawMessage)) {
        return;
      }

      let msg;
      try {
        msg = JSON.parse(rawMessage.toString());
      } catch (jsonErr) {
        if (clientRole === 'HOST' && currentRoomId) {
          const buffer = Buffer.from(rawMessage);
          await aiPipeline.processSpeech({
            roomId: currentRoomId,
            audioBuffer: buffer,
            mimeType: 'audio/webm'
          });
        }
        return;
      }

      console.log(`[WS] [${socketId}] Received event: ${msg.type}`);

      switch (msg.type) {
        case 'HOST_JOIN': {
          currentRoomId = (msg.roomId || 'MAIN').toUpperCase();
          clientRole = 'HOST';
          roomManager.setHost(currentRoomId, ws, socketId);
          
          ws.send(JSON.stringify({
            type: 'HOST_JOINED_SUCCESS',
            roomId: currentRoomId,
            socketId,
            stats: roomManager.getHostStats(currentRoomId)
          }));
          break;
        }

        case 'LISTENER_JOIN': {
          currentRoomId = (msg.roomId || 'MAIN').toUpperCase();
          clientRole = 'LISTENER';
          const lang = (msg.lang || 'en').toLowerCase();
          const attendeeId = msg.attendeeId || socketId;

          // Guard: If attendee is banned/kicked from this room, reject immediately
          if (roomManager.isAttendeeKicked(currentRoomId, attendeeId, msg.email, clientIp)) {
            ws.send(JSON.stringify({
              type: 'KICKED_BY_HOST',
              roomId: currentRoomId,
              reason: 'Has sido expulsado de esta sala por el anfitrión.'
            }));
            try { ws.close(4003, 'Kicked by host'); } catch (e) {}
            break;
          }
          
          const joinResult = roomManager.addListener(currentRoomId, ws, socketId, lang, {
            attendeeId,
            name: msg.name,
            email: msg.email,
            phone: msg.phone,
            ip: clientIp,
            userAgent: msg.userAgent
          });

          if (joinResult && joinResult.isKicked) {
            break;
          }

          // Send public stats (NO PII) to the listener
          ws.send(JSON.stringify({
            type: 'LISTENER_JOINED_SUCCESS',
            roomId: currentRoomId,
            socketId,
            currentLang: lang,
            stats: roomManager.getPublicStats(currentRoomId)
          }));
          break;
        }

        case 'HOST_KICK_ATTENDEE': {
          if (clientRole !== 'HOST') {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. Only host can moderate attendees.' }));
            break;
          }
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom && msg.attendeeId) {
            roomManager.kickAttendee(targetRoom, msg.attendeeId, msg.name, msg.reason);
          }
          break;
        }

        case 'HOST_UNBAN_ATTENDEE': {
          if (clientRole !== 'HOST') {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. Only host can unban attendees.' }));
            break;
          }
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom && msg.attendeeId) {
            roomManager.unbanAttendee(targetRoom, msg.attendeeId);
          }
          break;
        }

        case 'REGISTER_ATTENDEE_LEAD': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom && msg.profile) {
            roomManager.addListener(targetRoom, ws, socketId, msg.profile.lang || msg.profile.currentLang || 'es', {
              attendeeId: msg.profile.attendeeId,
              name: msg.profile.name,
              email: msg.profile.email,
              phone: msg.profile.phone,
              ip: clientIp
            });
            ws.send(JSON.stringify({
              type: 'ATTENDEE_LEAD_SAVED',
              success: true
            }));
          }
          break;
        }

        case 'AUDIENCE_RAISE_HAND': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom) {
            const item = roomManager.addHandRaise(targetRoom, socketId, msg.profile || {});
            const room = roomManager.getRoom(targetRoom);
            if (room && room.hostSocket && room.hostSocket.readyState === 1) {
              room.hostSocket.send(JSON.stringify({
                type: 'QA_QUESTION_REQUESTED',
                request: item,
                stats: roomManager.getHostStats(targetRoom)
              }));
            }
            ws.send(JSON.stringify({
              type: 'QA_HAND_RAISE_CONFIRMED',
              status: 'queued'
            }));
          }
          break;
        }

        case 'HOST_APPROVE_QUESTION': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom && msg.attendeeId) {
            const approved = roomManager.approveHandRaise(targetRoom, msg.attendeeId);
            if (approved) {
              const room = roomManager.getRoom(targetRoom);
              if (room) {
                const activeSpeakerPayload = JSON.stringify({
                  type: 'QA_ACTIVE_SPEAKER',
                  speaker: approved
                });
                for (const listener of room.listeners.values()) {
                  if (listener.socket && listener.socket.readyState === 1) {
                    listener.socket.send(activeSpeakerPayload);
                  }
                }
                if (room.hostSocket && room.hostSocket.readyState === 1) {
                  room.hostSocket.send(activeSpeakerPayload);
                }
              }
            }
          }
          break;
        }

        case 'AUDIENCE_AUDIO_QUESTION': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom) {
            let spokenText = msg.text;
            if (!spokenText && msg.audioBase64) {
              const buffer = Buffer.from(msg.audioBase64, 'base64');
              const { sttService } = await import('./services/sttService.js');
              const sttRes = await sttService.transcribeAudio(buffer, msg.mimeType || 'audio/webm', msg.lang || 'auto');
              if (sttRes && sttRes.text) spokenText = sttRes.text;
            }
            if (spokenText) {
              const { translationService } = await import('./services/translationService.js');
              const trans = await translationService.translateAll(spokenText, msg.lang || 'auto');
              const hostTargetLang = 'es';
              const translatedToHost = trans.translations[hostTargetLang] || trans.translations['en'] || spokenText;

              const { ttsService } = await import('./services/ttsService.js');
              const audioRes = await ttsService.synthesize(translatedToHost, hostTargetLang);

              const room = roomManager.getRoom(targetRoom);
              if (room) {
                if (room.hostSocket && room.hostSocket.readyState === 1) {
                  room.hostSocket.send(JSON.stringify({
                    type: 'HOST_EARPIECE_AUDIO',
                    isAudienceQuestion: true,
                    attendeeName: msg.attendeeName || 'Asistente',
                    originalText: spokenText,
                    translatedText: translatedToHost,
                    audioBase64: audioRes?.audioBase64,
                    mimeType: audioRes?.mimeType || 'audio/mp3',
                    lang: hostTargetLang
                  }));
                }
                roomManager.addTranscriptItem(targetRoom, {
                  id: `qa_${Date.now()}`,
                  seqId: 0,
                  timestamp: Date.now(),
                  originalText: `[Pregunta de ${msg.attendeeName || 'Audiencia'}]: "${spokenText}"`,
                  detectedLanguage: trans.detectedSource || msg.lang || 'auto',
                  engineUsed: 'Audience Backchannel Live',
                  translations: trans.translations,
                  isAudienceQuestion: true,
                  attendeeName: msg.attendeeName || 'Audiencia'
                });
              }
            }
          }
          break;
        }

        case 'HOST_CLOSE_QUESTION': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom) {
            roomManager.closeCurrentQuestion(targetRoom);
            roomManager.broadcastToRoom(targetRoom, {
              type: 'QA_QUESTION_CLOSED'
            });
          }
          break;
        }

        case 'CHANGE_LANGUAGE': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom && msg.lang) {
            roomManager.updateListenerLanguage(targetRoom, socketId, msg.lang);
            ws.send(JSON.stringify({
              type: 'LANGUAGE_CHANGED',
              lang: msg.lang
            }));

            // Hot Channel Switch: Send active audio of the new language immediately so listener doesn't hear silence!
            const recentAudio = roomManager.getRecentAudioForLang(targetRoom, msg.lang);
            if (recentAudio && recentAudio.audioBase64) {
              console.log(`[WS] ⚡ Hot-switching listener ${socketId} to active ${msg.lang} audio stream`);
              ws.send(JSON.stringify({
                ...recentAudio,
                type: 'AUDIO_CHUNK',
                isHotSwitch: true
              }));
            }
          }
          break;
        }

        case 'HOST_PREVIEW_CHANNEL': {
          // Host asks to preview/synthesize a test voice chunk in a specific channel
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom && msg.lang && msg.text) {
            const { ttsService } = await import('./services/ttsService.js');
            const result = await ttsService.synthesize(msg.text, msg.lang);
            if (result && result.audioBase64) {
              ws.send(JSON.stringify({
                type: 'AUDIO_CHUNK',
                lang: msg.lang,
                audioBase64: result.audioBase64,
                mimeType: result.mimeType || 'audio/mp3',
                id: `preview_${Date.now()}`,
                text: msg.text,
                duration: result.durationMs,
                latencyMs: result.latencyMs,
                timestamp: Date.now()
              }));
            }
          }
          break;
        }

        case 'host_broadcast_state': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom) {
            roomManager.touchRoomActivity(targetRoom);
            console.log(`[WS] Room ${targetRoom} broadcast state changed: ${msg.isBroadcasting ? 'ON AIR' : 'PAUSED'}`);
          }
          break;
        }

        case 'speaker_sentence':
        case 'SPEECH_CHUNK_TEXT': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom && msg.text) {
            await aiPipeline.processSpeech({
              roomId: targetRoom,
              text: msg.text,
              sourceLanguage: msg.sourceLanguage || msg.sourceLang || 'auto',
              forceLanguages: msg.forceLanguages || ['es', 'en', 'it', 'pt'],
              medicalMode: msg.medicalMode,
              medicalSpecialty: msg.medicalSpecialty,
              customGlossary: msg.customGlossary
            });
          }
          break;
        }

        case 'SPEECH_CHUNK_AUDIO': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom && msg.audioBase64) {
            const buffer = Buffer.from(msg.audioBase64, 'base64');
            await aiPipeline.processSpeech({
              roomId: targetRoom,
              audioBuffer: buffer,
              mimeType: msg.mimeType || 'audio/webm',
              sourceLanguage: msg.sourceLanguage || 'auto',
              forceLanguages: msg.forceLanguages || ['es', 'en', 'it', 'pt'],
              medicalMode: msg.medicalMode,
              medicalSpecialty: msg.medicalSpecialty,
              customGlossary: msg.customGlossary
            });
          }
          break;
        }

        case 'PING': {
          ws.isAlive = true;
          ws.send(JSON.stringify({
            type: 'PONG',
            timestamp: msg.timestamp || Date.now(),
            serverTime: Date.now()
          }));
          break;
        }

        default:
          console.log(`[WS] Unknown message type: ${msg.type}`);
      }
    } catch (err) {
      console.error('[WS] Error processing message:', err);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Connection closed: ${socketId} (${clientRole})`);
    if (clientRole === 'HOST') {
      roomManager.removeHost(socketId);
    } else if (clientRole === 'LISTENER') {
      roomManager.removeListener(socketId);
    }
  });

  ws.on('error', (err) => {
    console.error(`[WS] Socket error on ${socketId}:`, err);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log(`\n======================================================`);
  console.log(`🎙️  LiftVoice Real-time Audio Translation Server 2026`);
  console.log(`======================================================`);
  console.log(`📡 Primary Server listening on http://0.0.0.0:${PORT}`);
  console.log(`⚡ WebSocket Server ready on ws://${localIp}:${PORT}`);
  console.log(`======================================================\n`);
});

// Bind alternate common cloud ports (8080, 3001, 3000) so Railway connects regardless of domain port configuration
const altPorts = [8080, 3001, 3000].filter(p => p !== Number(PORT));
for (const altPort of altPorts) {
  try {
    const altServer = http.createServer(app);
    altServer.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });
    altServer.listen(altPort, '0.0.0.0', () => {
      console.log(`📡 Alternate listener active on http://0.0.0.0:${altPort}`);
    }).on('error', () => {
      // Ignored if port already in use
    });
  } catch (err) {}
}
