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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
  const { role, status } = req.body;
  const user = userManager.updateUser(id, { role, status });
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
  const activeRooms = Array.from(roomManager.rooms.values()).map(room => roomManager.getPublicStats(room.id));
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

// CRIT-03: Middleware to protect host PII data (attendees and CSV export)
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
      preferredTtsEngine: ttsService.preferredTtsEngine || 'deepgram',
      preferredTranslationEngine: translationService.preferredEngine || 'gemini',
      geminiModel: translationService.geminiModel || 'google/gemini-3.1-flash-lite',
      qwenModel: translationService.qwenModel || 'qwen/qwen-3.8-27b',
      qwenEndpoint: translationService.qwenEndpoint || '',
      qwenTtsEndpoint: ttsService.qwenTtsEndpoint || '',
      voiceConfig: ttsService.voiceConfig,
      voiceGender: ttsService.voiceGender,
      medicalMode: translationService.medicalMode,
      medicalSpecialty: translationService.medicalSpecialty,
      customGlossary: translationService.customGlossary,
      hasGeminiKey: Boolean(translationService.geminiApiKey || sttService.geminiApiKey || process.env.GEMINI_API_KEY),
      hasQwenKey: Boolean(translationService.qwenApiKey || process.env.DASHSCOPE_API_KEY || process.env.OPENROUTER_API_KEY),
      hasDeepgramKey: Boolean(sttService.deepgramApiKey || ttsService.deepgramApiKey || process.env.DEEPGRAM_API_KEY),
      hasElevenLabsKey: Boolean(ttsService.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY),
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
  const deeplApiKey = resolveKey(req.body.deeplApiKey, req.body.deeplKey, 'deepl');
  const geminiApiKey = resolveKey(req.body.geminiApiKey, req.body.geminiKey, 'gemini');
  const qwenApiKey = resolveKey(req.body.qwenApiKey, req.body.qwenKey, 'qwen');
  const {
    geminiModel,
    qwenModel,
    preferredEngine,
    preferredTranslationEngine,
    medicalMode,
    medicalSpecialty,
    customGlossary,
    preferredTtsEngine,
    preferredSttEngine,
    sttEngine,
    voiceConfig,
    voiceGender
  } = req.body;

  const qwenEndpoint = sanitizeEndpoint(req.body.qwenEndpoint);
  const qwenTtsEndpoint = sanitizeEndpoint(req.body.qwenTtsEndpoint);

  aiPipeline.setApiKeys({
    openaiApiKey,
    deepgramApiKey,
    elevenLabsApiKey,
    deeplApiKey,
    geminiApiKey,
    geminiModel,
    qwenApiKey,
    qwenModel,
    qwenEndpoint,
    qwenTtsEndpoint,
    preferredEngine: preferredEngine || preferredTranslationEngine,
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
  const targetLang = (lang || 'en').toLowerCase().slice(0, 5);
  const text = String(sampleText || req.body.text || 'Hello, this is a real-time simultaneous voice preview from LiftVoice.').slice(0, 300);
  try {
    const { ttsService } = await import('./services/ttsService.js');
    const result = await ttsService.synthesize(text, targetLang, { voice, gender, engine });
    res.json({
      success: true,
      audioBase64: result?.audioBase64,
      mimeType: result?.mimeType || 'audio/mpeg',
      lang: targetLang,
      provider: result?.provider || 'google'
    });
  } catch (err) {
    console.warn(`[Preview-Voice Error]: ${err.message}`);
    res.status(500).json({ error: 'No fue posible generar la muestra de voz en el servidor' });
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
          if (clientRole === 'LISTENER') {
            ws.send(JSON.stringify({
              type: 'HOST_JOIN_FAILED',
              reason: 'No puedes cambiar de rol a HOST en la misma conexión'
            }));
            break;
          }
          const targetRoom = (msg.roomId || 'MAIN').toUpperCase();
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
            const audioRes = await ttsService.synthesize(translatedToHost, hostTargetLang);

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
              customGlossary: msg.customGlossary
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
