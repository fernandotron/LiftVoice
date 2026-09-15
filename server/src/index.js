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
import { userManager } from './services/userManager.js';
import { detectAudioMimeType } from './services/sttService.js';
import { 
  createAdminSession, 
  invalidateAdminSession, 
  verifyAdminSession, 
  getAdminSession,
  validateAdminPassword, 
  requireAdminAuth,
  checkRateLimit,
  recordFailedAttempt,
  recordSuccessfulAttempt
} from './services/adminAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// Ensure AI pipeline and TTS services receive environment keys immediately after dotenv load
aiPipeline.setApiKeys({
  openaiApiKey: process.env.OPENAI_API_KEY,
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
  cartesiaApiKey: process.env.CARTESIA_API_KEY,
  deeplApiKey: process.env.DEEPL_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  qwenApiKey: process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY,
  qwenTtsEndpoint: process.env.QWEN_TTS_ENDPOINT
});

const clientDistPath = path.resolve(__dirname, '../../client/dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '512kb' }));

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

/**
 * SEC-01 / LOW-01: Extract client IP with trusted reverse proxy verification.
 * Normalizes IPv4-mapped IPv6 prefixes (::ffff:) and safely handles string or array x-forwarded-for.
 */
export function getClientIp(req) {
  let remoteAddress = req?.socket?.remoteAddress || '';
  if (remoteAddress.startsWith('::ffff:')) {
    remoteAddress = remoteAddress.replace(/^::ffff:/, '');
  }
  const trustedProxies = ['127.0.0.1', '::1'];
  if (trustedProxies.includes(remoteAddress) && req?.headers && req.headers['x-forwarded-for']) {
    const xForwardedFor = req.headers['x-forwarded-for'];
    const rawIp = Array.isArray(xForwardedFor) ? xForwardedFor[0] : String(xForwardedFor).split(',')[0];
    let ip = (rawIp || '').trim();
    if (ip.startsWith('::ffff:')) {
      ip = ip.replace(/^::ffff:/, '');
    }
    return ip || remoteAddress;
  }
  return remoteAddress;
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

// --- Admin Auth Endpoints (Protected by Rate Limiting & Timing Attack Shields) ---
app.post('/api/admin/login', (req, res) => {
  const ip = getClientIp(req);

  // 1. Anti-brute force / Rate limit check
  const rateLimitStatus = checkRateLimit(ip);
  if (rateLimitStatus.isLocked) {
    res.setHeader('Retry-After', rateLimitStatus.remainingSeconds);
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Acceso bloqueado temporalmente por seguridad. Reintente en ${rateLimitStatus.remainingSeconds} segundos.`,
      retryAfter: rateLimitStatus.remainingSeconds
    });
  }

  const { email, password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Contraseña requerida' });
  }

  // 2. Timing-safe constant-time validation
  if (validateAdminPassword(password)) {
    const adminEmail = (email && typeof email === 'string' && email.trim()) ? email.trim() : 'admin@liftvoice.ai';
    recordSuccessfulAttempt(ip);
    const token = createAdminSession({ email: adminEmail });
    return res.json({ 
      success: true, 
      token,
      user: {
        email: adminEmail,
        name: adminEmail.split('@')[0],
        role: 'admin_master'
      }
    });
  }

  // 3. Record failed attempt and evaluate lockout threshold
  const failure = recordFailedAttempt(ip);
  if (failure.isLocked) {
    res.setHeader('Retry-After', failure.remainingSeconds);
    return res.status(429).json({
      error: `Has superado el límite de 5 intentos fallidos. IP bloqueada durante 15 minutos.`,
      retryAfter: failure.remainingSeconds
    });
  }

  const remainingAttempts = failure.maxAttempts - failure.attemptsCount;
  return res.status(401).json({
    error: `Contraseña incorrecta. Te quedan ${remainingAttempts} intento${remainingAttempts === 1 ? '' : 's'} antes del bloqueo temporal.`,
    remainingAttempts
  });
});

app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  invalidateAdminSession(token);
  res.json({ success: true });
});

app.get('/api/admin/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const session = getAdminSession(token);
  if (session) {
    return res.json({ 
      authenticated: true, 
      role: 'admin_master', 
      user: session.user,
      permissions: ['ADMIN_PANEL', 'API_KEYS', 'MANAGE_ROOMS'] 
    });
  }
  return res.status(401).json({ authenticated: false });
});

// Admin Users Management
app.get('/api/admin/users', requireAdminAuth, (req, res) => {
  res.json(userManager.getAllUsers());
});

app.patch('/api/admin/users/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { role, status, name } = req.body;
  const user = userManager.updateUser(id, { role, status, name });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user });
});

app.get('/api/admin/export-csv', requireAdminAuth, (req, res) => {
  const users = userManager.getAllUsers();
  const headers = ['ID', 'Nombre', 'Email', 'Telefono', 'Rol', 'Estado', 'Registro', 'Ultima Sala'];
  
  const sanitizeCsvCell = (val) => {
    let str = val !== null && val !== undefined ? String(val) : '';
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = users.map(u => [
    sanitizeCsvCell(u.id),
    sanitizeCsvCell(u.name),
    sanitizeCsvCell(u.email),
    sanitizeCsvCell(u.phone),
    sanitizeCsvCell(u.role),
    sanitizeCsvCell(u.status),
    sanitizeCsvCell(u.registeredAt),
    sanitizeCsvCell(u.lastRoom)
  ]);

  const csvData = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="LiftVoice_Users_Report.csv"');
  res.status(200).send(csvData);
});

// Admin Rooms Management
app.get('/api/admin/rooms', requireAdminAuth, (req, res) => {
  // Deduplicar instancias de salas para evitar copias múltiples si están indexadas por diferentes claves
  const uniqueRooms = Array.from(new Set(roomManager.rooms.values()));
  const activeRooms = uniqueRooms
    .map(room => {
      if (room.title === 'Conferencia Principal 2026') room.title = 'Conferencia Principal';
      const stats = (typeof roomManager.getAdminStats === 'function' ? roomManager.getAdminStats(room.id) : roomManager.getPublicStats(room.id));
      if (stats && stats.title === 'Conferencia Principal 2026') stats.title = 'Conferencia Principal';
      return stats;
    })
    .filter(Boolean);
  res.json(activeRooms);
});

app.delete('/api/admin/rooms/:roomId', requireAdminAuth, (req, res) => {
  const { roomId } = req.params;
  const deleted = roomManager.deleteRoom(roomId);
  if (!deleted) return res.status(404).json({ error: 'Room not found or already deleted' });
  res.json({ success: true });
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

app.post('/api/tunnel/start', requireAdminAuth, async (req, res) => {
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

// CRIT-03: Middleware to protect host PII data and room configuration
export function requireHostAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const token = bearerToken || req.query.token || req.query.hostKey || req.headers['x-host-token'] || req.headers['x-admin-token'] || null;

  const roomId = req.params.roomId;
  const room = roomId ? roomManager.getRoom(roomId) : null;

  const validTokens = [
    process.env.ADMIN_TOKEN,
    process.env.HOST_SECRET,
    room?.hostKey
  ].filter(Boolean);

  if (validTokens.length > 0) {
    if (!token || !validTokens.includes(token)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing host authentication token' });
    }
  }
  next();
}

const ALLOWED_TTS_ENGINES = new Set(['auto', 'edge', 'azure', 'deepgram', 'cartesia', 'google', 'elevenlabs', 'openai', 'qwen_tts']);
const ALLOWED_DECALAGE_MODES = new Set(['fast', 'quick', 'natural', 'paused']);
const ALLOWED_GENDERS = new Set(['female', 'male', 'neutral']);

// Décalage / Pacing Configuration endpoint
app.post('/api/rooms/:roomId/decalage', requireHostAuth, (req, res) => {
  const { decalageMode, decalageValue } = req.body;
  const room = roomManager.getRoom(req.params.roomId);
  if (room) {
    if (decalageMode && ALLOWED_DECALAGE_MODES.has(decalageMode)) {
      room.config.decalageMode = decalageMode;
    }
    if (typeof decalageValue === 'number' && decalageValue >= 0 && decalageValue <= 100) {
      room.config.decalageValue = decalageValue;
    }
    return res.json({ success: true, decalageMode: room.config.decalageMode, decalageValue: room.config.decalageValue });
  }
  res.status(404).json({ error: 'Room not found' });
});

// Room-specific Voice Configuration endpoint
app.post('/api/rooms/:roomId/voices', requireHostAuth, (req, res) => {
  const { voiceConfig, voiceGender, preferredTtsEngine, decalageMode } = req.body;
  const room = roomManager.getRoom(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Input validation and sanitization
  if (voiceConfig && typeof voiceConfig === 'object') {
    const sanitizedVoices = {};
    for (const [lang, voice] of Object.entries(voiceConfig)) {
      if (typeof lang === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(lang) && typeof voice === 'string' && /^[a-zA-Z0-9_\-\.]{1,64}$/.test(voice)) {
        sanitizedVoices[lang] = voice;
      }
    }
    room.config.voiceConfig = { ...(room.config.voiceConfig || {}), ...sanitizedVoices };
  }

  if (voiceGender && typeof voiceGender === 'object') {
    const sanitizedGenders = {};
    for (const [lang, gender] of Object.entries(voiceGender)) {
      if (typeof lang === 'string' && typeof gender === 'string' && ALLOWED_GENDERS.has(gender)) {
        sanitizedGenders[lang] = gender;
      }
    }
    room.config.voiceGender = { ...(room.config.voiceGender || {}), ...sanitizedGenders };
  }

  if (preferredTtsEngine && typeof preferredTtsEngine === 'string' && ALLOWED_TTS_ENGINES.has(preferredTtsEngine)) {
    room.config.preferredTtsEngine = preferredTtsEngine;
  }

  if (decalageMode && typeof decalageMode === 'string' && ALLOWED_DECALAGE_MODES.has(decalageMode)) {
    room.config.decalageMode = decalageMode;
  }

  console.log(`[RoomManager] 🎙️ Updated booth voices for room ${room.id}:`, room.config.voiceConfig);

  // Broadcast voices update to all connected clients in the room
  roomManager.broadcastToRoom(room.id, {
    type: 'ROOM_VOICES_UPDATED',
    voiceConfig: room.config.voiceConfig,
    voiceGender: room.config.voiceGender,
    preferredTtsEngine: room.config.preferredTtsEngine,
    decalageMode: room.config.decalageMode
  });

  return res.json({
    success: true,
    voiceConfig: room.config.voiceConfig,
    voiceGender: room.config.voiceGender,
    preferredTtsEngine: room.config.preferredTtsEngine,
    decalageMode: room.config.decalageMode
  });
});

// Attendee Leads endpoints (CRIT-03)
app.get('/api/rooms/:roomId/attendees', requireHostAuth, (req, res) => {
  const attendees = roomManager.getAttendeesList(req.params.roomId);
  res.json({
    roomId: req.params.roomId.toUpperCase(),
    total: attendees.length,
    attendees
  });
});

app.get('/api/rooms/:roomId/export-csv', requireHostAuth, (req, res) => {
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
      sttLang: sttService.sttLanguage || 'auto',
      sttVad: sttService.sttVad || 'standard',
      preferredTtsEngine: ttsService.preferredTtsEngine || 'auto',
      decalageMode: aiPipeline.decalageMode || 'natural',
      googleNeuralMode: translationService.googleNeuralMode || 'universal',
      preferredTranslationEngine: translationService.preferredEngine || 'gemini',
      aiStrategy: translationService.aiStrategy || 'json_single',
      geminiModel: translationService.geminiModel || 'google/gemini-3.1-flash-lite',
      geminiTemp: String(translationService.geminiTemperature !== undefined ? translationService.geminiTemperature : '0.1'),
      qwenModel: translationService.qwenModel || 'qwen/qwen-3.8-27b',
      qwenTemp: String(translationService.qwenTemperature !== undefined ? translationService.qwenTemperature : '0.1'),
      qwenEndpoint: translationService.qwenEndpoint || '',
      qwenTtsEndpoint: ttsService.qwenTtsEndpoint || '',
      openaiModel: translationService.openaiModel || 'gpt-4o-mini',
      openaiTemp: String(translationService.openaiTemperature !== undefined ? translationService.openaiTemperature : '0.1'),
      voiceConfig: ttsService.voiceConfig,
      voiceGender: ttsService.voiceGender,
      medicalMode: translationService.medicalMode,
      medicalSpecialty: translationService.medicalSpecialty,
      customGlossary: translationService.customGlossary,
      hasGeminiKey: Boolean(translationService.geminiApiKey || sttService.geminiApiKey || process.env.GEMINI_API_KEY),
      hasQwenKey: Boolean(translationService.qwenApiKey || process.env.DASHSCOPE_API_KEY || process.env.OPENROUTER_API_KEY),
      hasDeepgramKey: Boolean(sttService.deepgramApiKey || ttsService.deepgramApiKey || process.env.DEEPGRAM_API_KEY),
      hasElevenLabsKey: Boolean(ttsService.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY),
      hasCartesiaKey: Boolean(ttsService.cartesiaApiKey || process.env.CARTESIA_API_KEY),
      hasOpenAiKey: Boolean(sttService.openaiApiKey || ttsService.openaiApiKey || process.env.OPENAI_API_KEY)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/config', requireAdminAuth, (req, res) => {
  const resolveKey = (val, alt, keyName) => {
    const raw = val !== undefined ? val : alt;
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.length > 0) return trimmed;
      // Only clear if client explicitly requested clearing this key
      if (raw === '__CLEAR__' || (Array.isArray(req.body.clearKeys) && req.body.clearKeys.includes(keyName))) {
        return '';
      }
      return undefined; // Untouched empty string -> do not overwrite
    }
    return undefined;
  };

  const sanitizeEndpoint = (urlStr) => {
    if (!urlStr || typeof urlStr !== 'string') return '';
    const trimmed = urlStr.trim();
    if (!trimmed) return '';
    try {
      const u = new URL(trimmed);
      if (!['http:', 'https:'].includes(u.protocol)) return '';
      const host = u.hostname.toLowerCase();
      // Block cloud metadata endpoints
      if (
        host === '169.254.169.254' ||
        host === '100.100.100.200' ||
        host === 'metadata.google.internal' ||
        host.endsWith('.internal')
      ) {
        return '';
      }
      // In production, block private IP address ranges (SSRF defense)
      if (process.env.NODE_ENV === 'production') {
        if (
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host === '::1' ||
          host === '0.0.0.0' ||
          /^10\./.test(host) ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
          /^192\.168\./.test(host) ||
          /^169\.254\./.test(host)
        ) {
          return '';
        }
      }
      return trimmed;
    } catch {
      return '';
    }
  };

  const openaiApiKey = resolveKey(req.body.openaiApiKey, req.body.openaiKey, 'openai');
  const deepgramApiKey = resolveKey(req.body.deepgramApiKey, req.body.deepgramKey, 'deepgram');
  const elevenLabsApiKey = resolveKey(req.body.elevenLabsApiKey, req.body.elevenLabsKey, 'elevenlabs');
  const cartesiaApiKey = resolveKey(req.body.cartesiaApiKey, req.body.cartesiaKey, 'cartesia');
  const deeplApiKey = resolveKey(req.body.deeplApiKey, req.body.deeplKey, 'deepl');
  const geminiApiKey = resolveKey(req.body.geminiApiKey, req.body.geminiKey, 'gemini');
  const qwenApiKey = resolveKey(req.body.qwenApiKey, req.body.qwenKey, 'qwen');
  const {
    geminiModel,
    geminiTemp,
    qwenModel,
    qwenTemp,
    openaiModel,
    openaiTemp,
    preferredEngine,
    preferredTranslationEngine,
    aiStrategy,
    medicalMode,
    medicalSpecialty,
    customGlossary,
    preferredTtsEngine,
    preferredSttEngine,
    sttEngine,
    sttLang,
    sttVad,
    decalageMode,
    googleNeuralMode,
    voiceConfig,
    voiceGender
  } = req.body;

  const qwenEndpoint = sanitizeEndpoint(req.body.qwenEndpoint);
  const qwenTtsEndpoint = sanitizeEndpoint(req.body.qwenTtsEndpoint);

  aiPipeline.setApiKeys({
    openaiApiKey,
    openaiModel,
    openaiTemp,
    deepgramApiKey,
    elevenLabsApiKey,
    cartesiaApiKey,
    deeplApiKey,
    geminiApiKey,
    geminiModel,
    geminiTemp,
    qwenApiKey,
    qwenModel,
    qwenTemp,
    qwenEndpoint,
    qwenTtsEndpoint,
    preferredEngine: preferredEngine || preferredTranslationEngine,
    aiStrategy,
    medicalMode,
    medicalSpecialty,
    customGlossary,
    preferredTtsEngine,
    preferredSttEngine: preferredSttEngine || sttEngine,
    sttLang,
    sttVad,
    decalageMode,
    googleNeuralMode,
    voiceConfig,
    voiceGender
  });
  cachedGrantTokens.clear();
  res.json({ success: true, message: 'API keys, STT, TTS and Translation settings updated successfully' });
});

// In-memory multi-tenant token cache for Deepgram Grant tokens (indexed by apiKey with LRU & TTL sweep)
const cachedGrantTokens = new Map(); // apiKey -> { token, expiresAt }
const grantTokenPromisesInFlight = new Map(); // apiKey -> Promise
const MAX_GRANT_CACHE_ENTRIES = 500;

// ASR Keyterm & Gateway Handshake Constraints (parity with App Salud ASR_KEYTERM_MAX_URL_CHARS)
// Deepgram and reverse proxies (ALB/Cloudflare/Envoy) reject or drop HTTP Upgrade requests with URL >2150 chars.
const ASR_KEYTERM_MAX_URL_CHARS = 1600;
const ASR_MAX_KEYTERMS_COUNT = 40;
const ASR_MAX_TERM_LENGTH = 50;
const ASR_TOKEN_CACHE_MIN_MARGIN_MS = 20000; // Require >=20s validity before reusing cached token

function storeGrantTokenInCache(key, tokenData) {
  if (cachedGrantTokens.size >= MAX_GRANT_CACHE_ENTRIES) {
    const oldestKey = cachedGrantTokens.keys().next().value;
    if (oldestKey) cachedGrantTokens.delete(oldestKey);
  }
  cachedGrantTokens.set(key, tokenData);
}

// Barrido periódico cada 60s para purgar tokens caducados y evitar fugas de memoria
const grantTokenSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of cachedGrantTokens.entries()) {
    if (!record || now >= record.expiresAt) {
      cachedGrantTokens.delete(key);
    }
  }
}, 60000);
if (grantTokenSweepInterval.unref) grantTokenSweepInterval.unref();

// Ephemeral ASR Token for Direct Deepgram Streaming WebSocket (Nova-3) (#ISSUE-01)
app.post('/api/asr-token', async (req, res) => {
  try {
    const { sttService } = await import('./services/sttService.js');
    const body = req.body || {};
    const apiKey = (body.deepgramApiKey && typeof body.deepgramApiKey === 'string' && body.deepgramApiKey.trim())
      || (body.apiKey && typeof body.apiKey === 'string' && body.apiKey.trim())
      || sttService.deepgramApiKey
      || process.env.DEEPGRAM_API_KEY
      || '';

    if (!apiKey) {
      return res.status(503).json({
        success: false,
        code: 'DEEPGRAM_NOT_CONFIGURED',
        error: 'Deepgram API key not configured on server'
      });
    }

    // Model selection: Default to nova-3, allow configurable fallback to nova-2
    const requestedModel = String(body.model || body.sttModel || process.env.DEEPGRAM_STT_MODEL || '').toLowerCase().trim();
    const forceNova2 = Boolean(body.forceNova2 || body.preferNova2 || process.env.DEEPGRAM_FORCE_NOVA2 === 'true' || requestedModel.includes('nova-2'));
    const effectiveModel = forceNova2 ? 'nova-2' : 'nova-3';

    const rawLang = (typeof body.language === 'string' && body.language) || (typeof body.lang === 'string' && body.lang) || 'auto';
    const langLower = rawLang.trim().toLowerCase();

    // Language resolution logic (homologous to toDeepgramLanguage in App Salud):
    // Nova-3 supports high-accuracy native monolingual streaming ('es', 'en', 'it', 'pt-BR').
    // Only route to 'multi' when the user explicitly requests auto-detection or multilingual code-switching.
    let deepgramLang;
    if (langLower.startsWith('en')) {
      deepgramLang = 'en';
    } else if (langLower.startsWith('es')) {
      deepgramLang = 'es';
    } else if (langLower.startsWith('it')) {
      deepgramLang = 'it';
    } else if (langLower.startsWith('pt')) {
      deepgramLang = langLower.includes('br') ? 'pt-BR' : 'pt';
    } else if (langLower === 'auto' || langLower === 'multi' || !langLower) {
      deepgramLang = effectiveModel === 'nova-3' ? 'multi' : 'es';
    } else {
      deepgramLang = langLower.length > 2 ? langLower.slice(0, 2) : langLower;
    }

    const rawTerms = Array.isArray(req.body.keyterms) ? [...req.body.keyterms] : [];
    if (req.body.medicalMode && req.body.customGlossary && Array.isArray(req.body.customGlossary)) {
      rawTerms.push(...req.body.customGlossary);
    }

    // Sanitize and case-insensitively deduplicate keyterms while preserving original casing
    const seenTermKeys = new Set();
    const cleanTerms = [];
    for (const t of rawTerms) {
      const termStr = typeof t === 'object' && t ? (t.term || t.text || t.word || String(t)) : String(t);
      const sanitized = termStr
        .replace(/[^a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑüÜ.,/_-]/g, '')
        .trim()
        .slice(0, ASR_MAX_TERM_LENGTH);
      if (sanitized.length < 2) continue;
      const termKey = sanitized.toLowerCase();
      if (!seenTermKeys.has(termKey)) {
        seenTermKeys.add(termKey);
        cleanTerms.push(sanitized);
      }
    }

    // Budget guard: Prevent WebSocket handshake hang / HTTP 414 / HTTP 431 on gateways with >2150 chars URL
    let totalKeytermsCharBudget = 0;
    const validKeyterms = [];
    for (const term of cleanTerms) {
      if (validKeyterms.length >= ASR_MAX_KEYTERMS_COUNT) break;
      const termEncodedLen = encodeURIComponent(term).length;
      const termUrlLen = (effectiveModel === 'nova-3' ? 9 : 13) + termEncodedLen;
      if (totalKeytermsCharBudget + termUrlLen > ASR_KEYTERM_MAX_URL_CHARS) {
        console.warn(`[ASR Token] ⚠️ Keyterms truncated by URL budget (${validKeyterms.length} retained, budget: ${totalKeytermsCharBudget}/${ASR_KEYTERM_MAX_URL_CHARS} chars)`);
        break;
      }
      validKeyterms.push(term);
      totalKeytermsCharBudget += termUrlLen;
    }

    const forceRefresh = Boolean(body.forceRefresh);
    const parsedTtl = Number(body.ttl || body.ttl_seconds || process.env.DEEPGRAM_GRANT_TTL || 60);
    const requestedTtl = Number.isFinite(parsedTtl) ? Math.min(Math.max(parsedTtl, 30), 600) : 60;
    let token = null;
    let expiresIn = requestedTtl;
    const now = Date.now();
    const cacheKey = apiKey.trim();
    const cachedToken = cachedGrantTokens.get(cacheKey);

    // Reuse cached token if not forced and at least ASR_TOKEN_CACHE_MIN_MARGIN_MS (20s) remain
    if (!forceRefresh && cachedToken && now < cachedToken.expiresAt - ASR_TOKEN_CACHE_MIN_MARGIN_MS) {
      token = cachedToken.token;
      expiresIn = Math.max(5, Math.round((cachedToken.expiresAt - now) / 1000));
    } else {
      if (forceRefresh) {
        cachedGrantTokens.delete(cacheKey);
      }

      // Single-flight mutex pattern por clave: compartir petición en vuelo con peticiones concurrentes de la misma clave
      let grantPromise = grantTokenPromisesInFlight.get(cacheKey);
      if (!grantPromise) {
        grantPromise = (async () => {
          try {
            const grantRes = await fetch('https://api.deepgram.com/v1/auth/grant', {
              method: 'POST',
              headers: {
                'Authorization': `Token ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ ttl_seconds: requestedTtl }),
              signal: AbortSignal.timeout(5000)
            });
            if (grantRes.ok) {
              const grantData = await grantRes.json();
              const newToken = grantData.access_token || grantData.key;
              const newExpiresIn = Number(grantData.expires_in) || requestedTtl;
              storeGrantTokenInCache(cacheKey, {
                token: newToken,
                expiresAt: Date.now() + (newExpiresIn * 1000)
              });
              return { success: true, token: newToken, expiresIn: newExpiresIn };
            } else {
              const errText = await grantRes.text().catch(() => '');
              let parsedErr = null;
              try { parsedErr = JSON.parse(errText); } catch (_) {}
              const deepgramMsg = parsedErr?.err_msg || parsedErr?.message || parsedErr?.error || errText.slice(0, 300);

              let userMsg = 'Deepgram Grant API authentication failed.';
              let errCode = 'GRANT_API_UNAVAILABLE';

              if (grantRes.status === 401) {
                userMsg = 'Invalid Deepgram API key. Please check your credentials in Settings.';
                errCode = 'DEEPGRAM_AUTH_INVALID';
              } else if (grantRes.status === 403) {
                userMsg = 'Deepgram API key lacks permissions to mint ephemeral tokens. A Project Admin or Member role with auth scope is required.';
                errCode = 'DEEPGRAM_GRANT_FORBIDDEN';
              } else if (grantRes.status === 429) {
                userMsg = 'Deepgram API rate limit exceeded. Please wait a moment before retrying.';
                errCode = 'DEEPGRAM_RATE_LIMITED';
              } else if (grantRes.status >= 500) {
                userMsg = `Deepgram Grant API upstream server error (${grantRes.status}).`;
                errCode = 'DEEPGRAM_UPSTREAM_ERROR';
              }

              console.warn(`[ASR Token] Deepgram grant failed (${grantRes.status}) [${errCode}]: ${deepgramMsg}`);
              return {
                success: false,
                status: grantRes.status,
                error: userMsg,
                code: errCode,
                details: deepgramMsg || undefined
              };
            }
          } catch (gErr) {
            const isTimeout = gErr.name === 'TimeoutError' || gErr.name === 'AbortError';
            console.warn('[ASR Token] Grant fetch exception:', gErr.message);
            return {
              success: false,
              status: isTimeout ? 504 : 502,
              error: isTimeout
                ? 'Timeout connecting to Deepgram Grant API (5000ms limit reached).'
                : `Failed to connect to Deepgram Grant API: ${gErr.message}`,
              code: isTimeout ? 'GRANT_API_TIMEOUT' : 'GRANT_API_NETWORK_ERROR'
            };
          } finally {
            grantTokenPromisesInFlight.delete(cacheKey);
          }
        })();
        grantTokenPromisesInFlight.set(cacheKey, grantPromise);
      }

      const grantResult = await grantPromise;
      if (!grantResult || !grantResult.success) {
        return res.status((grantResult && grantResult.status) || 502).json(grantResult || { error: 'Unknown grant error' });
      }
      token = grantResult.token;
      expiresIn = grantResult.expiresIn;
    }

    return res.json({
      success: true,
      token,
      expiresIn,
      listenUrl: 'wss://api.deepgram.com/v1/listen',
      model: effectiveModel,
      language: deepgramLang,
      keyterms: validKeyterms,
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

// Rate limiter in memory for voice previews (prevents abuse and upstream quota exhaustion)
const previewRateLimitMap = new Map();
const PREVIEW_LIMIT_WINDOW_MS = 60 * 1000;
const PREVIEW_MAX_REQUESTS = 40; // 40 previews per minute per IP

function checkPreviewRateLimit(clientIp) {
  const now = Date.now();
  const key = String(clientIp || 'unknown').trim();
  const record = previewRateLimitMap.get(key) || [];
  const recent = record.filter(time => now - time < PREVIEW_LIMIT_WINDOW_MS);
  if (recent.length >= PREVIEW_MAX_REQUESTS) {
    return false;
  }
  recent.push(now);
  previewRateLimitMap.set(key, recent);

  // Periodic bounded cleanup (capped at 500 entries)
  if (previewRateLimitMap.size > 500) {
    for (const [k, timestamps] of previewRateLimitMap.entries()) {
      if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] >= PREVIEW_LIMIT_WINDOW_MS) {
        previewRateLimitMap.delete(k);
      }
    }
  }
  return true;
}

// Consolidated Multi-Engine Voices Catalog
app.get('/api/voices', async (req, res) => {
  try {
    const { ttsService } = await import('./services/ttsService.js');
    const { lang, engine, tier, gender, configuredOnly } = req.query;
    let catalog = ttsService.getAvailableVoicesCatalog();

    if (lang) {
      const targetLang = lang.toLowerCase();
      catalog = catalog.filter(v =>
        v.lang === 'all' ||
        v.lang === targetLang ||
        (Array.isArray(v.languages) && v.languages.some(l => l.toLowerCase() === targetLang))
      );
    }
    if (engine) {
      const eng = engine.toLowerCase();
      catalog = catalog.filter(v => v.engine === eng || (eng === 'google' && v.engine === 'edge'));
    }
    if (tier) {
      catalog = catalog.filter(v => v.tier === tier.toLowerCase());
    }
    if (gender) {
      catalog = catalog.filter(v => v.gender === gender.toLowerCase());
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
        zeroCostCount: catalog.filter(v => v.tier === 'zero_cost').length,
        premiumCount: catalog.filter(v => v.tier === 'premium_studio').length,
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
  const clientIp = getClientIp(req);

  if (!checkPreviewRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Límite de preescuchas alcanzado (máx. 12/min). Por favor espera un momento antes de generar más muestras.'
    });
  }

  const { lang, sampleText, voice, gender, engine } = req.body;
  const targetLang = (lang || 'en').toLowerCase().slice(0, 5);
  const text = String(sampleText || req.body.text || 'Hello, this is a real-time simultaneous voice preview from LiftVoice.').trim().slice(0, 200);

  try {
    const { ttsService } = await import('./services/ttsService.js');

    // 1. Muestras pre-grabadas de ElevenLabs según el idioma solicitado (ES, IT, PT, EN)
    if (voice && (engine === 'elevenlabs' || /^[a-zA-Z0-9]{20,22}$/.test(String(voice).trim())) && !ttsService.elevenLabsApiKey) {
      const candidateFiles = targetLang === 'en'
        ? [`${voice}_en.mp3`, `${voice}.mp3`]
        : [`${voice}_${targetLang}.mp3`];

      for (const fileName of candidateFiles) {
        const candidatePaths = [
          path.join(clientDistPath, 'audio', 'samples', 'elevenlabs', fileName),
          path.resolve(clientDistPath, '..', 'public', 'audio', 'samples', 'elevenlabs', fileName),
          path.resolve(process.cwd(), 'client', 'public', 'audio', 'samples', 'elevenlabs', fileName),
          path.resolve(process.cwd(), 'client', 'dist', 'audio', 'samples', 'elevenlabs', fileName)
        ];
        for (const sp of candidatePaths) {
          if (fs.existsSync(sp)) {
            const audioBuffer = fs.readFileSync(sp);
            return res.json({
              success: true,
              audioBase64: audioBuffer.toString('base64'),
              mimeType: 'audio/mpeg',
              lang: targetLang,
              provider: 'elevenlabs',
              isOfficialSample: true
            });
          }
        }
      }
    }

    let result = null;
    try {
      result = await ttsService.synthesize(text, targetLang, { voice, gender, engine });
    } catch (synthErr) {
      console.warn(`[Preview-Voice Engine Warning]: ${synthErr.message}, falling back to Edge TTS`);
      result = await ttsService.synthesize(text, targetLang, { voice, gender, engine: 'edge' });
    }

    res.json({
      success: true,
      audioBase64: result?.audioBase64,
      mimeType: result?.mimeType || 'audio/mpeg',
      lang: targetLang,
      provider: result?.provider || 'edge'
    });
  } catch (err) {
    console.warn(`[Preview-Voice Error]: ${err.message}`);
    res.status(500).json({ error: 'No fue posible generar la muestra de voz en el servidor' });
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
const wss = new WebSocketServer({ server, maxPayload: 4 * 1024 * 1024 });
wss.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error('[WSS] WebSocketServer error:', err);
  }
});

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
  const clientIp = getClientIp(req);

  console.log(`[WS] New connection: ${socketId} from ${clientIp}`);

  ws.on('message', async (rawMessage, isBinary) => {
    try {
      // 1. Direct handling of binary audio buffers (avoids rawMessage.toString() overhead and SyntaxError exceptions)
      if (isBinary || (Buffer.isBuffer(rawMessage) && rawMessage.length > 0 && rawMessage[0] !== 0x7B /* '{' */)) {
        if (clientRole === 'HOST' && currentRoomId) {
          if (rawMessage.length > 2.5 * 1024 * 1024) {
            console.warn(`[WS] ⚠️ Audio chunk exceeds 2.5MB from host in room ${currentRoomId}`);
            return;
          }
          const audioBuffer = Buffer.isBuffer(rawMessage) ? rawMessage : Buffer.from(rawMessage);
          const detectedMime = detectAudioMimeType(audioBuffer, 'audio/webm');
          await aiPipeline.processSpeech({
            roomId: currentRoomId,
            audioBuffer,
            mimeType: detectedMime
          });
        }
        return;
      }

      // 2. Control and audio chunk payload message size check (up to 2.5 MB to accommodate SPEECH_CHUNK_AUDIO Base64)
      const textLen = Buffer.byteLength(rawMessage);
      if (textLen > 2.5 * 1024 * 1024) {
        console.warn(`[WS] 🚨 Dropped oversized JSON payload (${textLen} bytes) from ${socketId}`);
        return;
      }

      let msg;
      try {
        msg = JSON.parse(rawMessage.toString('utf8'));
      } catch (jsonErr) {
        return;
      }

      if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
        return;
      }

      console.log(`[WS] [${socketId}] Received event: ${msg.type}`);

      switch (msg.type) {
        case 'HOST_JOIN': {
          if (clientRole === 'LISTENER') {
            ws.send(JSON.stringify({
              type: 'HOST_JOIN_FAILED',
              reason: 'No puedes cambiar de rol a HOST en la misma conexión'
            }));
            break;
          }
          const targetRoom = typeof msg.roomId === 'string' ? msg.roomId.trim().toUpperCase().slice(0, 30) : (currentRoomId || 'MAIN');
          const hostKey = msg.hostKey || msg.token || null;
          const result = roomManager.setHost(targetRoom, ws, socketId, hostKey);
          if (!result.success) {
            ws.send(JSON.stringify({
              type: 'HOST_JOIN_FAILED',
              reason: result.error || 'Autenticación como HOST fallida'
            }));
            break;
          }
          currentRoomId = targetRoom;
          clientRole = 'HOST';

          const adminToken = msg.token || msg.adminToken || null;
          if (adminToken) {
            try {
              const { getAdminSession } = await import('./services/adminAuth.js');
              ws.isAdminSession = Boolean(getAdminSession(adminToken));
            } catch (e) {
              ws.isAdminSession = false;
            }
          } else {
            ws.isAdminSession = false;
          }
          
          ws.send(JSON.stringify({
            type: 'HOST_JOINED_SUCCESS',
            roomId: currentRoomId,
            socketId,
            isAdmin: Boolean(ws.isAdminSession),
            stats: roomManager.getHostStats(currentRoomId)
          }));
          break;
        }

        case 'LISTENER_JOIN': {
          currentRoomId = (msg.roomId || 'MAIN').toUpperCase();
          clientRole = 'LISTENER';
          const lang = (msg.lang || 'en').toLowerCase();
          const attendeeId = msg.attendeeId || socketId;

          const user = userManager.getOrCreateUser(attendeeId, { name: msg.name, email: msg.email, phone: msg.phone });
          if (user && user.status === 'Suspendido') {
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Tu cuenta ha sido suspendida por un administrador.'
            }));
            try { ws.close(4003, 'Account Suspended'); } catch (e) {}
            break;
          }
          if (user) {
            userManager.updateUserLastRoom(user.id, currentRoomId);
          }

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
            console.warn(`[WS] [RBAC] Unauthorized HOST_KICK_ATTENDEE attempt from socket ${socketId} (role: ${clientRole})`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. Only host can moderate attendees.' }));
            break;
          }
          if (!currentRoomId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. No active room joined.' }));
            break;
          }
          if (msg.roomId && msg.roomId.toUpperCase() !== currentRoomId) {
            console.warn(`[WS] [IDOR] Host attempted to manage room ${msg.roomId} but active room is ${currentRoomId}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Forbidden. You can only manage your own active room' }));
            break;
          }
          const targetRoom = currentRoomId;
          if (targetRoom && msg.attendeeId) {
            roomManager.kickAttendee(targetRoom, msg.attendeeId, msg.name, msg.reason);
          }
          break;
        }

        case 'HOST_UNBAN_ATTENDEE': {
          if (clientRole !== 'HOST') {
            console.warn(`[WS] [RBAC] Unauthorized HOST_UNBAN_ATTENDEE attempt from socket ${socketId} (role: ${clientRole})`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. Only host can unban attendees.' }));
            break;
          }
          if (!currentRoomId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. No active room joined.' }));
            break;
          }
          if (msg.roomId && msg.roomId.toUpperCase() !== currentRoomId) {
            console.warn(`[WS] [IDOR] Host attempted to manage room ${msg.roomId} but active room is ${currentRoomId}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Forbidden. You can only manage your own active room' }));
            break;
          }
          const targetRoom = currentRoomId;
          if (targetRoom && msg.attendeeId) {
            roomManager.unbanAttendee(targetRoom, msg.attendeeId);
          }
          break;
        }

        case 'REGISTER_ATTENDEE_LEAD': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom && msg.profile) {
            const user = userManager.getOrCreateUser(msg.profile.attendeeId, { name: msg.profile.name, email: msg.profile.email, phone: msg.profile.phone });
            if (user && user.status === 'Suspendido') {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Cuenta suspendida' }));
              try { ws.close(4003, 'Account Suspended'); } catch(e) {}
              break;
            }
            if (user) {
              userManager.updateUserLastRoom(user.id, targetRoom);
            }

            clientRole = 'LISTENER';
            currentRoomId = targetRoom;
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

        case 'AUDIENCE_LOWER_HAND': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom) {
            const attId = msg.attendeeId || socketId;
            roomManager.removeHandRaise(targetRoom, attId);
            const room = roomManager.getRoom(targetRoom);
            if (room && room.hostSocket && room.hostSocket.readyState === 1) {
              room.hostSocket.send(JSON.stringify({
                type: 'QA_HAND_LOWERED',
                attendeeId: attId,
                stats: roomManager.getHostStats(targetRoom)
              }));
            }
            ws.send(JSON.stringify({
              type: 'QA_HAND_LOWERED',
              status: 'idle'
            }));
          }
          break;
        }

        case 'HOST_APPROVE_QUESTION': {
          if (clientRole !== 'HOST') {
            console.warn(`[WS] [RBAC] Unauthorized HOST_APPROVE_QUESTION attempt from socket ${socketId} (role: ${clientRole})`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. Only host can approve questions.' }));
            break;
          }
          if (!currentRoomId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. No active room joined.' }));
            break;
          }
          if (msg.roomId && msg.roomId.toUpperCase() !== currentRoomId) {
            console.warn(`[WS] [IDOR] Host attempted to manage room ${msg.roomId} but active room is ${currentRoomId}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Forbidden. You can only manage your own active room' }));
            break;
          }
          const targetRoom = currentRoomId;
          if (targetRoom && msg.attendeeId) {
            const approved = roomManager.approveHandRaise(targetRoom, msg.attendeeId);
            if (approved) {
              roomManager.broadcastToRoom(targetRoom, {
                type: 'QA_ACTIVE_SPEAKER',
                speaker: approved
              });
            }
          }
          break;
        }

        case 'AUDIENCE_AUDIO_QUESTION': {
          const targetRoom = currentRoomId;
          if (!targetRoom) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'No estás unido a ninguna sala activa' }));
            break;
          }

          const room = roomManager.getRoom(targetRoom);
          if (!room || !room.activeSpeaker || room.activeSpeaker.socketId !== socketId) {
            console.warn(`[WS] [RBAC] Unauthorized AUDIENCE_AUDIO_QUESTION attempt from socket ${socketId} in room ${targetRoom}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'No estás autorizado para hablar' }));
            break;
          }

          let spokenText = typeof msg.text === 'string' ? msg.text.trim().slice(0, 500) : '';
          if (!spokenText && msg.audioBase64) {
            if (typeof msg.audioBase64 !== 'string' || msg.audioBase64.length > 2 * 1024 * 1024) {
              console.warn(`[WS] [SECURITY] audioBase64 invalid or exceeds 2MB limit from socket ${socketId}`);
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Payload de audio inválido o excede 2MB' }));
              break;
            }
            const buffer = Buffer.from(msg.audioBase64, 'base64');
            const { sttService } = await import('./services/sttService.js');
            const sttRes = await sttService.transcribeAudio(buffer, msg.mimeType || 'audio/webm', msg.lang || 'auto');
            if (sttRes && sttRes.text) spokenText = sttRes.text.trim().slice(0, 500);
          }

          if (spokenText) {
            const { translationService } = await import('./services/translationService.js');
            const trans = await translationService.translateAll(spokenText, msg.lang || 'auto');
            const hostTargetLang = 'es';
            const translatedToHost = trans.translations[hostTargetLang] || trans.translations['en'] || spokenText;

            const { ttsService } = await import('./services/ttsService.js');
            const voiceOpt = {
              voice: room?.config?.voiceConfig?.[hostTargetLang],
              gender: room?.config?.voiceGender?.[hostTargetLang],
              engine: room?.config?.preferredTtsEngine
            };
            const audioRes = await ttsService.synthesize(translatedToHost, hostTargetLang, voiceOpt);

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
          break;
        }

        case 'HOST_CLOSE_QUESTION': {
          if (clientRole !== 'HOST') {
            console.warn(`[WS] [RBAC] Unauthorized HOST_CLOSE_QUESTION attempt from socket ${socketId} (role: ${clientRole})`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. Only host can close questions.' }));
            break;
          }
          if (!currentRoomId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. No active room joined.' }));
            break;
          }
          if (msg.roomId && msg.roomId.toUpperCase() !== currentRoomId) {
            console.warn(`[WS] [IDOR] Host attempted to manage room ${msg.roomId} but active room is ${currentRoomId}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Forbidden. You can only manage your own active room' }));
            break;
          }
          const targetRoom = currentRoomId;
          if (targetRoom) {
            if (msg.questionId || msg.attendeeId) {
              roomManager.removeHandRaise(targetRoom, msg.questionId || msg.attendeeId);
            }
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
          if (clientRole !== 'HOST') {
            console.warn(`[WS] [RBAC] Unauthorized HOST_PREVIEW_CHANNEL attempt from socket ${socketId} (role: ${clientRole})`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. Only host can preview channels.' }));
            break;
          }
          if (!currentRoomId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. No active room joined.' }));
            break;
          }
          if (msg.roomId && msg.roomId.toUpperCase() !== currentRoomId) {
            console.warn(`[WS] [IDOR] Host attempted to manage room ${msg.roomId} but active room is ${currentRoomId}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Forbidden. You can only manage your own active room' }));
            break;
          }
          // Host asks to preview/synthesize a test voice chunk in a specific channel
          const targetRoom = currentRoomId;
          if (targetRoom && msg.lang && msg.text) {
            const { ttsService } = await import('./services/ttsService.js');
            const room = roomManager.getRoom(targetRoom);
            const voiceOpt = room?.config?.voices?.[msg.lang];
            const result = await ttsService.synthesize(msg.text, msg.lang, voiceOpt);
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
                timestamp: Date.now(),
                isHostPreview: true
              }));
            }
          }
          break;
        }

        case 'host_broadcast_state': {
          if (clientRole !== 'HOST') {
            console.warn(`[WS] [RBAC] Unauthorized host_broadcast_state attempt from socket ${socketId} (role: ${clientRole})`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. Only host can change broadcast state.' }));
            break;
          }
          if (!currentRoomId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. No active room joined.' }));
            break;
          }
          if (msg.roomId && msg.roomId.toUpperCase() !== currentRoomId) {
            console.warn(`[WS] [IDOR] Host attempted to manage room ${msg.roomId} but active room is ${currentRoomId}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Forbidden. You can only manage your own active room' }));
            break;
          }
          const targetRoom = currentRoomId;
          if (targetRoom) {
            roomManager.touchRoomActivity(targetRoom);
            console.log(`[WS] Room ${targetRoom} broadcast state changed: ${msg.isBroadcasting ? 'ON AIR' : 'PAUSED'}`);
          }
          break;
        }

        case 'HOST_MONITOR_BOOTH': {
          if (clientRole !== 'HOST') {
            console.warn(`[WS] [RBAC] Unauthorized HOST_MONITOR_BOOTH attempt from socket ${socketId} (role: ${clientRole})`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. Only host can monitor booths.' }));
            break;
          }
          if (!currentRoomId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. No active room joined.' }));
            break;
          }
          if (msg.roomId && msg.roomId.toUpperCase() !== currentRoomId) {
            console.warn(`[WS] [IDOR] Host attempted to manage room ${msg.roomId} but active room is ${currentRoomId}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Forbidden. You can only manage your own active room' }));
            break;
          }
          const targetRoom = currentRoomId;
          if (targetRoom) {
            const room = roomManager.getRoom(targetRoom);
            if (room) {
              const cleanLang = (msg.lang && msg.lang !== 'none') ? String(msg.lang).toLowerCase().trim() : null;
              room.monitoredBooth = cleanLang;
              console.log(`[WS] 🎧 Host monitoring booth updated to: "${cleanLang || 'none'}" in room ${targetRoom}`);
              roomManager.broadcastStats(targetRoom);
            }
          }
          break;
        }

        case 'HOST_LEAVE': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (clientRole === 'HOST' || (targetRoom && roomManager.getRoom(targetRoom)?.hostSocketId === socketId)) {
            roomManager.removeHost(socketId);
            clientRole = null;
            currentRoomId = null;
            console.log(`[WS] 🚪 Host ${socketId} explicitly left room ${targetRoom}`);
          }
          break;
        }

        case 'LISTENER_LEAVE':
        case 'LEAVE_ROOM': {
          const targetRoom = msg.roomId ? msg.roomId.toUpperCase() : currentRoomId;
          if (targetRoom) {
            roomManager.removeListener(socketId);
            console.log(`[WS] 🚪 Listener ${socketId} explicitly left room ${targetRoom}`);
          }
          break;
        }

        case 'speaker_sentence':
        case 'SPEECH_CHUNK_TEXT': {
          if (clientRole !== 'HOST') {
            console.warn(`[WS] [RBAC] Unauthorized ${msg.type} attempt from socket ${socketId} (role: ${clientRole})`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. Only host can broadcast speech text.' }));
            break;
          }
          if (!currentRoomId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. No active room joined.' }));
            break;
          }
          if (msg.roomId && msg.roomId.toUpperCase() !== currentRoomId) {
            console.warn(`[WS] [IDOR] Host attempted to manage room ${msg.roomId} but active room is ${currentRoomId}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Forbidden. You can only manage your own active room' }));
            break;
          }
          const targetRoom = currentRoomId;
          if (targetRoom && msg.text) {
            await aiPipeline.processSpeech({
              roomId: targetRoom,
              text: msg.text,
              sourceLanguage: msg.sourceLanguage || msg.sourceLang || 'auto',
              forceLanguages: (Array.isArray(msg.forceLanguages) && msg.forceLanguages.length > 0) ? msg.forceLanguages : [],
              medicalMode: msg.medicalMode,
              medicalSpecialty: msg.medicalSpecialty,
              customGlossary: msg.customGlossary,
              sttEngine: msg.sttEngine,
              sttModel: msg.sttModel
            });
          }
          break;
        }

        case 'SPEECH_CHUNK_AUDIO': {
          if (clientRole !== 'HOST') {
            console.warn(`[WS] [RBAC] Unauthorized SPEECH_CHUNK_AUDIO attempt from socket ${socketId} (role: ${clientRole})`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. Only host can broadcast speech audio.' }));
            break;
          }
          if (!currentRoomId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized. No active room joined.' }));
            break;
          }
          if (msg.roomId && msg.roomId.toUpperCase() !== currentRoomId) {
            console.warn(`[WS] [IDOR] Host attempted to manage room ${msg.roomId} but active room is ${currentRoomId}`);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Forbidden. You can only manage your own active room' }));
            break;
          }
          const targetRoom = currentRoomId;
          if (targetRoom && msg.audioBase64) {
            const buffer = Buffer.from(msg.audioBase64, 'base64');
            await aiPipeline.processSpeech({
              roomId: targetRoom,
              audioBuffer: buffer,
              mimeType: msg.mimeType || 'audio/webm',
              sourceLanguage: msg.sourceLanguage || 'auto',
              forceLanguages: (Array.isArray(msg.forceLanguages) && msg.forceLanguages.length > 0) ? msg.forceLanguages : [],
              medicalMode: msg.medicalMode,
              medicalSpecialty: msg.medicalSpecialty,
              customGlossary: msg.customGlossary,
              sttEngine: msg.sttEngine,
              sttModel: msg.sttModel
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
    console.log(`[WS] Connection closed: ${socketId} (${clientRole || 'UNSPECIFIED'})`);
    if (clientRole === 'HOST') {
      roomManager.removeHost(socketId);
    }
    // Unconditionally remove listener reference to avoid any socket memory leak
    roomManager.removeListener(socketId);
  });

  ws.on('error', (err) => {
    console.error(`[WS] Socket error on ${socketId}:`, err);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Server] Port ${PORT} already in use. Primary listener skipped or running in test mode.`);
  } else {
    console.error('[Server] Server error:', err);
  }
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
