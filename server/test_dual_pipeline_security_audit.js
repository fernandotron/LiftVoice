/**
 * test_dual_pipeline_security_audit.js
 * Comprehensive AppSec Audit Suite for Dual Pipeline Switching & Gemini Live S2S (LiftVoice 2026)
 *
 * Audit Coverage:
 * Area 1: Configuration Sanitization & Validation (pipelineMode & geminiLiveVoices allowlists, prototype pollution)
 * Area 2: Access Control (RBAC) & IDOR Defense (Fail-open fix, hostKey validation, admin token support)
 * Area 3: Secret Hygiene & Upstream Exposure (Gemini API key redaction in errors, close reasons, telemetry)
 */

import assert from 'assert';

// Set isolated test port before server initialization
const TEST_PORT = process.env.TEST_PORT || '3099';
process.env.PORT = TEST_PORT;

const { app, server } = await import('./src/index.js');
import { roomManager } from './src/roomManager.js';
import { aiPipeline } from './src/services/aiPipeline.js';
import {
  geminiLiveBridge,
  sanitizeApiKey,
  isValidGeminiLiveVoice,
  sanitizeGeminiLiveVoice,
  ALLOWED_GEMINI_LIVE_VOICES
} from './src/services/geminiLiveBridge.js';
import { createAdminSession } from './src/services/adminAuth.js';

const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

console.log('========================================================================');
console.log('🛡️  DUAL PIPELINE & GEMINI LIVE APPSEC AUDIT SUITE (September 2026)');
console.log('========================================================================\n');

let totalAssertions = 0;

async function runAuditSuite() {
  const adminToken = createAdminSession({ email: 'security_auditor@liftvoice.ai' });

  // ----------------------------------------------------------------------------
  // AUDIT AREA 1: Configuration Sanitization & Validation
  // ----------------------------------------------------------------------------
  console.log('▶ [Area 1] Configuration Sanitization & Allowlist Validation...');
  {
    // 1A: Unit level voice validation and normalization
    assert.strictEqual(isValidGeminiLiveVoice('Aoede'), true);
    assert.strictEqual(isValidGeminiLiveVoice('aoede'), true); // Case-insensitive
    assert.strictEqual(isValidGeminiLiveVoice('Charon'), true);
    assert.strictEqual(isValidGeminiLiveVoice('Fenrir'), true);
    assert.strictEqual(isValidGeminiLiveVoice('Kore'), true);
    assert.strictEqual(isValidGeminiLiveVoice('Puck'), true);
    assert.strictEqual(isValidGeminiLiveVoice('gemini-live-custom-1'), true);
    assert.strictEqual(isValidGeminiLiveVoice('malicious_injection'), false);
    assert.strictEqual(isValidGeminiLiveVoice('<script>'), false);
    assert.strictEqual(isValidGeminiLiveVoice(''), false);
    assert.strictEqual(isValidGeminiLiveVoice(null), false);
    totalAssertions += 11;

    assert.strictEqual(sanitizeGeminiLiveVoice('kore'), 'Kore');
    assert.strictEqual(sanitizeGeminiLiveVoice('invalid_voice'), 'Aoede');
    totalAssertions += 2;

    // 1B: Prototype pollution defense in geminiLiveBridge.setGeminiLiveVoices
    const polluterObj = JSON.parse('{"__proto__": {"polluted": "yes"}, "constructor": {"evil": true}, "es": "charon", "pt": "invalid_voice"}');
    geminiLiveBridge.setGeminiLiveVoices(polluterObj);
    assert.strictEqual(Object.prototype.polluted, undefined, 'Prototype pollution vector must be blocked');
    assert.strictEqual(geminiLiveBridge.geminiLiveVoices.es, 'Charon', 'Valid voice must be normalized');
    assert.notStrictEqual(geminiLiveBridge.geminiLiveVoices.pt, 'invalid_voice', 'Invalid voice must be rejected');
    totalAssertions += 3;

    // 1C: POST /api/config rejects malicious pipelineMode and protects current setting
    aiPipeline.setApiKeys({ pipelineMode: 'deepgram_gemini' });
    const resBadMode = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        pipelineMode: '<script>alert("xss")</script>'
      })
    });
    assert.strictEqual(resBadMode.status, 200);
    assert.strictEqual(aiPipeline.pipelineMode, 'deepgram_gemini', 'Malicious pipelineMode must NOT overwrite active pipeline mode');
    totalAssertions += 2;

    // 1D: POST /api/config accepts only valid pipeline modes
    const resGoodMode = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        pipelineMode: 'gemini_live_s2s'
      })
    });
    assert.strictEqual(resGoodMode.status, 200);
    assert.strictEqual(aiPipeline.pipelineMode, 'gemini_live_s2s');
    totalAssertions += 2;

    // Reset back to default
    aiPipeline.setApiKeys({ pipelineMode: 'deepgram_gemini' });

    // 1E: POST /api/rooms/:roomId/voices validates pipelineMode and geminiLiveVoices
    const testRoom = roomManager.createRoom('AUDIT-ROOM-1', 'Audit Validation Room');
    const resRoomVoices = await fetch(`${BASE_URL}/api/rooms/${testRoom.id}/voices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testRoom.hostKey}`
      },
      body: JSON.stringify({
        pipelineMode: 'unsupported_mode_xyz',
        geminiLiveVoices: {
          es: 'kore',
          en: 'evil_unregistered_voice',
          __proto__: { admin: true }
        }
      })
    });
    assert.strictEqual(resRoomVoices.status, 200);
    const roomData = await resRoomVoices.json();
    assert.strictEqual(testRoom.config.pipelineMode, 'deepgram_gemini', 'Invalid pipelineMode must be ignored');
    assert.strictEqual(testRoom.config.geminiLiveVoices.es, 'Kore', 'Valid voice must be normalized');
    assert.strictEqual(testRoom.config.geminiLiveVoices.en, 'Aoede', 'Invalid voice must NOT overwrite default voice');
    assert.notStrictEqual(testRoom.config.geminiLiveVoices.en, 'evil_unregistered_voice', 'Invalid voice must be rejected');
    assert.strictEqual(Object.prototype.admin, undefined, 'Prototype pollution must not succeed');
    roomManager.deleteRoom(testRoom.id);
    totalAssertions += 5;

    console.log('  ✔ Passed: Strict allowlist validation and prototype pollution defenses verified.\n');
  }

  // ----------------------------------------------------------------------------
  // AUDIT AREA 2: Access Control (RBAC) & IDOR Defense
  // ----------------------------------------------------------------------------
  console.log('▶ [Area 2] Access Control (RBAC) & IDOR Defense...');
  {
    const roomA = roomManager.createRoom('AUDIT-ROOM-A', 'Room A');
    const roomB = roomManager.createRoom('AUDIT-ROOM-B', 'Room B');

    // 2A: Unauthenticated user calling POST /api/rooms/:roomId/voices -> 401
    const resUnauth = await fetch(`${BASE_URL}/api/rooms/${roomA.id}/voices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineMode: 'gemini_live_s2s' })
    });
    assert.strictEqual(resUnauth.status, 401, 'Unauthenticated voice update must be rejected with 401');
    totalAssertions++;

    // 2B: Attendee with invalid token calling POST /api/rooms/:roomId/voices -> 401
    const resBadToken = await fetch(`${BASE_URL}/api/rooms/${roomA.id}/voices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake_attendee_token_123'
      },
      body: JSON.stringify({ pipelineMode: 'gemini_live_s2s' })
    });
    assert.strictEqual(resBadToken.status, 401, 'Invalid token must be rejected with 401');
    totalAssertions++;

    // 2C: IDOR Defense - Host of Room A attempts to modify Room B -> 401
    const resIdor = await fetch(`${BASE_URL}/api/rooms/${roomB.id}/voices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${roomA.hostKey}` // Host key of room A sent to room B
      },
      body: JSON.stringify({ pipelineMode: 'gemini_live_s2s' })
    });
    assert.strictEqual(resIdor.status, 401, 'Host of Room A MUST NOT be permitted to modify Room B (IDOR)');
    assert.notStrictEqual(roomB.config.pipelineMode, 'gemini_live_s2s', 'Room B config must remain untouched');
    totalAssertions += 2;

    // 2D: Authorized Host of Room A modifies Room A -> 200
    const resLegitHost = await fetch(`${BASE_URL}/api/rooms/${roomA.id}/voices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${roomA.hostKey}`
      },
      body: JSON.stringify({ pipelineMode: 'gemini_live_s2s' })
    });
    assert.strictEqual(resLegitHost.status, 200);
    assert.strictEqual(roomA.config.pipelineMode, 'gemini_live_s2s');
    totalAssertions += 2;

    // 2E: Platform Admin session modifies room voices (RBAC privilege) -> 200
    const resAdmin = await fetch(`${BASE_URL}/api/rooms/${roomA.id}/voices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ pipelineMode: 'deepgram_gemini' })
    });
    assert.strictEqual(resAdmin.status, 200, 'Admin session token should be authorized to manage room voices');
    assert.strictEqual(roomA.config.pipelineMode, 'deepgram_gemini');
    totalAssertions += 2;

    // 2F: Unauthenticated call to POST /api/config -> 401
    const resConfigUnauth = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineMode: 'gemini_live_s2s' })
    });
    assert.strictEqual(resConfigUnauth.status, 401, 'Unauthenticated POST /api/config must be rejected with 401');
    totalAssertions++;

    roomManager.deleteRoom(roomA.id);
    roomManager.deleteRoom(roomB.id);

    console.log('  ✔ Passed: Fail-open prevention, IDOR protection, and RBAC enforcement verified.\n');
  }

  // ----------------------------------------------------------------------------
  // AUDIT AREA 3: Secret Hygiene & Upstream Exposure
  // ----------------------------------------------------------------------------
  console.log('▶ [Area 3] Secret Hygiene & Upstream Exposure Verification...');
  {
    const TEST_GEMINI_KEY = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';

    // 3A: URL query parameter key redaction in sanitizeApiKey
    const urlWithError = `Error: WebSocket handshake failed at wss://generativelanguage.googleapis.com/ws/...BidiGenerateContent?key=${TEST_GEMINI_KEY}`;
    const sanitizedUrl = sanitizeApiKey(urlWithError, TEST_GEMINI_KEY);
    assert(!sanitizedUrl.includes(TEST_GEMINI_KEY), 'Query parameter Gemini API key MUST be redacted');
    assert(sanitizedUrl.includes('[REDACTED_QUERY_KEY]'), 'Redaction tag must be present');
    totalAssertions += 2;

    // 3B: Standalone Google API Key pattern redaction
    const rawKeyError = `Google API rejected authorization for key ${TEST_GEMINI_KEY} with status 403`;
    const sanitizedRawKey = sanitizeApiKey(rawKeyError);
    assert(!sanitizedRawKey.includes(TEST_GEMINI_KEY), 'Standalone AIzaSy key MUST be redacted even without explicit key parameter');
    assert(sanitizedRawKey.includes('[REDACTED_GEMINI_KEY]'), 'Gemini key pattern redaction tag must be present');
    totalAssertions += 2;

    // 3C: WebSocket Close Reason hygiene
    const closeReason = `Handshake dropped: ?key=${TEST_GEMINI_KEY}&model=gemini-3.8-live`;
    const sanitizedClose = sanitizeApiKey(closeReason, TEST_GEMINI_KEY);
    assert(!sanitizedClose.includes(TEST_GEMINI_KEY), 'Close reason MUST NOT leak API key');
    totalAssertions++;

    // 3D: Broadcast Telemetry & Packet Hygiene
    // Inspect room broadcasts to guarantee zero API key exposure
    const teleRoom = roomManager.createRoom('AUDIT-TELEMETRY-ROOM', 'Telemetry Audit');
    let capturedBroadcasts = [];
    const origBroadcast = roomManager.broadcastToRoom;
    roomManager.broadcastToRoom = (rId, data) => {
      if (rId === teleRoom.id) {
        capturedBroadcasts.push(JSON.stringify(data));
      }
      return origBroadcast.call(roomManager, rId, data);
    };

    // Update room voices and inspect broadcasted payload
    await fetch(`${BASE_URL}/api/rooms/${teleRoom.id}/voices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teleRoom.hostKey}`
      },
      body: JSON.stringify({
        pipelineMode: 'gemini_live_s2s',
        geminiLiveVoices: { es: 'Charon', it: 'Kore' }
      })
    });

    assert(capturedBroadcasts.length > 0, 'Broadcast must occur upon voice update');
    for (const bCast of capturedBroadcasts) {
      assert(!bCast.includes('AIzaSy'), 'Broadcast payload must NEVER contain Google API key');
      assert(!bCast.includes('key='), 'Broadcast payload must NEVER contain key query param');
    }
    totalAssertions += 3;

    roomManager.broadcastToRoom = origBroadcast;
    roomManager.deleteRoom(teleRoom.id);

    console.log('  ✔ Passed: Secret hygiene verifies zero exposure in error logs, close events, and broadcast telemetry.\n');
  }

  // ----------------------------------------------------------------------------
  // TEARDOWN
  // ----------------------------------------------------------------------------
  console.log('========================================================================');
  console.log(`🎉 ALL ${totalAssertions} DUAL PIPELINE APPSEC AUDIT ASSERTIONS PASSED (September 2026)`);
  console.log('========================================================================\n');

  try {
    server.close();
  } catch (_) {}

  process.exit(0);
}

runAuditSuite().catch((err) => {
  console.error('\n❌ FATAL AUDIT SUITE FAILURE:', err);
  try {
    server.close();
  } catch (_) {}
  process.exit(1);
});
