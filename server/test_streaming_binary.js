/**
 * test_streaming_binary.js
 * Verification of LVBP v1.1 Binary Protocol, Large Payloads, and RFC-1982 Sequence Logic (September 2026 Consensus)
 */

import assert from 'assert';
import { roomManager } from './src/roomManager.js';

console.log('🧪 Starting Streaming & Binary Protocol Tests (Post-Audit Consensus)...');

// Test 1: Verify LVBP v1.1 Binary Packet Generation (14-byte header with UInt32BE length)
{
  const roomId = 'TEST_STREAMING_ROOM';
  const room = roomManager.getOrCreateRoom(roomId);

  let binaryMessageSent = null;
  const mockListenerSocket = {
    readyState: 1,
    bufferedAmount: 0,
    supportsBinary: true,
    send: (data, opts) => {
      if (opts && opts.binary) {
        binaryMessageSent = data;
      }
    }
  };

  roomManager.addListener(roomId, mockListenerSocket, 'test_socket_123', 'es', {
    attendeeId: 'test_att_123',
    supportsBinary: true
  });

  const testPayload = Buffer.from('FAKE_OPUS_PCM_AUDIO_DATA_FOR_VERIFICATION_2026');
  const seqId = 42;
  const timestamp = 1789500000;

  roomManager.broadcastAudioToLanguageChannel(roomId, 'es', {
    seqId,
    timestamp,
    audioBuffer: testPayload
  });

  assert(binaryMessageSent !== null, 'Binary message should be sent to supportsBinary listener');
  assert(Buffer.isBuffer(binaryMessageSent), 'Binary message must be a Buffer');
  assert.strictEqual(binaryMessageSent.length, 14 + testPayload.length, 'Packet length must equal 14-byte header + payload');

  // Verify Header Structure
  const magic = binaryMessageSent.readUInt16BE(0);
  assert.strictEqual(magic, 0x4C56, 'Magic bytes must be 0x4C56 ("LV")');

  const type = binaryMessageSent.readUInt8(2);
  assert.strictEqual(type, 0x01, 'Type must be 0x01 (AUDIO_FRAME)');

  const langId = binaryMessageSent.readUInt8(3);
  assert.strictEqual(langId, 1, 'Lang ID for "es" must be 1');

  const parsedSeq = binaryMessageSent.readUInt16BE(4);
  assert.strictEqual(parsedSeq, 42, 'Sequence ID must match input');

  const parsedTimestamp = binaryMessageSent.readUInt32BE(6);
  assert.strictEqual(parsedTimestamp, timestamp, 'Timestamp must match input');

  const payloadLen = binaryMessageSent.readUInt32BE(10);
  assert.strictEqual(payloadLen, testPayload.length, 'Payload length must match input payload length');

  const extractedPayload = binaryMessageSent.subarray(14);
  assert.strictEqual(extractedPayload.toString(), testPayload.toString(), 'Payload contents must match exactly');

  console.log('✅ Test 1 Passed: LVBP v1.1 Binary Header (14 bytes) and payload verified.');

  // Cleanup
  roomManager.deleteRoom(roomId);
}

// Test 2: Fallback for Legacy JSON Listeners and Lazy Serialization
{
  const roomId = 'TEST_LEGACY_ROOM';
  const room = roomManager.getOrCreateRoom(roomId);

  let jsonMessageSent = null;
  const mockLegacySocket = {
    readyState: 1,
    bufferedAmount: 0,
    supportsBinary: false, // Legacy listener
    send: (data) => {
      jsonMessageSent = data;
    }
  };

  roomManager.addListener(roomId, mockLegacySocket, 'legacy_socket_456', 'en', {
    attendeeId: 'legacy_att_456',
    supportsBinary: false
  });

  const testPayload = Buffer.from('TEST_AUDIO_CHUNK');
  roomManager.broadcastAudioToLanguageChannel(roomId, 'en', {
    seqId: 10,
    timestamp: Date.now(),
    audioBuffer: testPayload
  });

  assert(jsonMessageSent !== null, 'JSON fallback message should be sent to legacy listener');
  const parsed = JSON.parse(jsonMessageSent);
  assert.strictEqual(parsed.type, 'AUDIO_CHUNK', 'Type must be AUDIO_CHUNK');
  assert.strictEqual(parsed.lang, 'en', 'Lang must be en');
  assert.strictEqual(parsed.seqId, 10, 'SeqId must match');

  console.log('✅ Test 2 Passed: Legacy JSON fallback and lazy serialization verified.');

  // Cleanup
  roomManager.deleteRoom(roomId);
}

// Test 3: Large Audio Payloads (>65,535 bytes) No Truncation
{
  const roomId = 'TEST_LARGE_PAYLOAD_ROOM';
  const room = roomManager.getOrCreateRoom(roomId);

  let binaryMessageSent = null;
  const mockListenerSocket = {
    readyState: 1,
    bufferedAmount: 0,
    supportsBinary: true,
    send: (data, opts) => {
      if (opts && opts.binary) binaryMessageSent = data;
    }
  };

  roomManager.addListener(roomId, mockListenerSocket, 'test_socket_large', 'it', {
    attendeeId: 'test_att_large',
    supportsBinary: true
  });

  // 80 KB audio buffer (exceeds the old 64 KB uint16 limit)
  const largeAudioBuffer = Buffer.alloc(80000, 0xAB);
  roomManager.broadcastAudioToLanguageChannel(roomId, 'it', {
    seqId: 100,
    timestamp: Date.now(),
    audioBuffer: largeAudioBuffer
  });

  assert(binaryMessageSent !== null, 'Binary message sent');
  assert.strictEqual(binaryMessageSent.length, 14 + 80000, 'Full 80KB + 14-byte header delivered');
  const parsedLen = binaryMessageSent.readUInt32BE(10);
  assert.strictEqual(parsedLen, 80000, 'Payload length accurately reports 80,000 bytes without truncation');

  console.log('✅ Test 3 Passed: Large audio payloads (>64KB) handled perfectly via UInt32 header.');

  // Cleanup
  roomManager.deleteRoom(roomId);
}

// Test 4: RFC-1982 Modular Sequence Arithmetic & Out-of-Order Drop
{
  const roomId = 'TEST_SEQ_ROOM';
  const room = roomManager.getOrCreateRoom(roomId);

  let sentPackets = [];
  const mockListenerSocket = {
    readyState: 1,
    bufferedAmount: 0,
    supportsBinary: true,
    send: (data, opts) => {
      if (opts && opts.binary) {
        sentPackets.push(data);
      }
    }
  };

  roomManager.addListener(roomId, mockListenerSocket, 'test_seq_socket', 'es', {
    attendeeId: 'test_att_seq',
    supportsBinary: true
  });

  // Send packet 10
  roomManager.broadcastAudioToLanguageChannel(roomId, 'es', { seqId: 10, audioBuffer: Buffer.from('seq10') });
  assert.strictEqual(sentPackets.length, 1, 'Packet 10 sent');

  // Send packet 8 (out-of-order, older than 10 within window -> should be dropped)
  roomManager.broadcastAudioToLanguageChannel(roomId, 'es', { seqId: 8, audioBuffer: Buffer.from('seq8') });
  assert.strictEqual(sentPackets.length, 1, 'Packet 8 dropped as out-of-order');

  // Send packet 11 (newer -> should be delivered)
  roomManager.broadcastAudioToLanguageChannel(roomId, 'es', { seqId: 11, audioBuffer: Buffer.from('seq11') });
  assert.strictEqual(sentPackets.length, 2, 'Packet 11 delivered');

  console.log('✅ Test 4 Passed: RFC-1982 sequence filtering and late packet defense verified.');

  // Cleanup
  roomManager.deleteRoom(roomId);
}

// Test 5: Fuzzing & Corrupted Packet Rejection
{
  // Test simulated client parser with corrupted buffers
  const parseLVBP = (buffer) => {
    if (!buffer || !(buffer instanceof ArrayBuffer) || buffer.byteLength < 12) return null;
    const view = new DataView(buffer);
    const magic = view.getUint16(0);
    if (magic !== 0x4C56) return null; // Magic mismatch
    const type = view.getUint8(2);
    if (type !== 0x01) return null; // Unknown type
    const langCodeNum = view.getUint8(3);
    const CODE_TO_LANG = { 1: 'es', 2: 'en', 3: 'it', 4: 'pt', 5: 'fr', 6: 'de', 7: 'zh', 8: 'ja', 9: 'ru' };
    const lang = CODE_TO_LANG[langCodeNum];
    if (!lang) return null; // Invalid langCode

    let headerSize = 14;
    let payloadLen = 0;
    if (buffer.byteLength >= 14) {
      const v11Len = view.getUint32(10);
      if (14 + v11Len === buffer.byteLength && v11Len > 0) {
        headerSize = 14;
        payloadLen = v11Len;
      } else {
        return null; // Truncated / malformed
      }
    } else {
      return null;
    }
    return { lang, payloadLen };
  };

  // Fuzz 1: Corrupted Magic
  const badMagic = new ArrayBuffer(20);
  new DataView(badMagic).setUint16(0, 0x1234);
  assert.strictEqual(parseLVBP(badMagic), null, 'Corrupted magic rejected');

  // Fuzz 2: Truncated Payload (Declared 100 bytes, buffer only has 20 bytes)
  const truncated = new ArrayBuffer(20);
  const truncView = new DataView(truncated);
  truncView.setUint16(0, 0x4C56);
  truncView.setUint8(2, 0x01);
  truncView.setUint8(3, 1);
  truncView.setUint32(10, 100);
  assert.strictEqual(parseLVBP(truncated), null, 'Truncated payload rejected');

  // Fuzz 3: Invalid LangCode 99
  const badLang = new ArrayBuffer(15);
  const badLangView = new DataView(badLang);
  badLangView.setUint16(0, 0x4C56);
  badLangView.setUint8(2, 0x01);
  badLangView.setUint8(3, 99); // Invalid
  badLangView.setUint32(10, 1);
  assert.strictEqual(parseLVBP(badLang), null, 'Invalid langCode rejected');

  console.log('✅ Test 5 Passed: Protocol fuzzing and corrupted packets safely rejected without exception.');
}

console.log('🎉 ALL SEPTEMBER 2026 POST-AUDIT CONSENSUS PROTOCOL TESTS PASSED!');
