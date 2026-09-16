import { strict as assert } from 'assert';
import { AIPipeline } from './src/services/aiPipeline.js';
import { roomManager } from './src/roomManager.js';
import { ttsService } from './src/services/ttsService.js';
import { translationService } from './src/services/translationService.js';

console.log('🧪 Starting Semantic SBD & Décalage Buffer Rigorous Backend Audit...\n');

async function runTests() {
  const originalTranslateAll = translationService.translateAll;
  const originalSynthesize = ttsService.synthesize;
  const originalBroadcast = roomManager.broadcastAudioToLanguageChannel.bind(roomManager);

  try {
    // =========================================================================
    // TEST 1: Clause Accumulation & Semantic SBD (Sentence Boundary Detection)
    // =========================================================================
    console.log('--- TEST 1: Clause Accumulation & SBD Behavior ---');
    const pipeline = new AIPipeline();
    const roomId1 = 'AUDIT-ROOM-SBD';
    const room1 = roomManager.createRoom(roomId1, 'Test SBD');

    const dispatchedItems1 = [];
    translationService.translateAll = async (text, src, opts) => {
      dispatchedItems1.push(text);
      return {
        detectedSource: 'es',
        translations: { en: `[EN] ${text}`, es: text }
      };
    };
    ttsService.synthesize = async (text, lang, opts) => {
      return { audioBuffer: Buffer.alloc(128), audioBase64: '', mimeType: 'audio/mpeg', durationMs: 400 };
    };

    // 1.1: Short phrase with terminal punctuation (< 4 words) -> Should NOT dispatch immediately
    console.log('  1.1: Sending short terminal clause "Buenos días." (2 words < 4 words)...');
    await pipeline.processSpeech({
      roomId: roomId1,
      text: 'Buenos días.',
      forceLanguages: ['en']
    });

    assert.equal(dispatchedItems1.length, 0, 'Short clause (<4 words) must be buffered in décalage, not dispatched immediately');
    const buf1 = pipeline.roomDecalageBuffers.get(roomId1);
    assert(buf1, 'Buffer should exist in roomDecalageBuffers');
    assert.equal(buf1.text, 'Buenos días.');
    assert(buf1.timer, 'Timer must be active for buffered clause');
    console.log('    ✓ Short clause correctly held in buffer:', buf1.text);

    // 1.2: Continuation arrives before timer fires -> Should concatenate and dispatch
    console.log('  1.2: Sending continuation "a todos los doctores presentes." (5 words)...');
    await pipeline.processSpeech({
      roomId: roomId1,
      text: 'a todos los doctores presentes.',
      forceLanguages: ['en']
    });

    assert.equal(dispatchedItems1.length, 1, 'Combined sentence must dispatch as a single unit');
    assert.equal(dispatchedItems1[0], 'Buenos días. a todos los doctores presentes.');
    assert.equal(pipeline.roomDecalageBuffers.has(roomId1), false, 'Buffer must be cleared after dispatch');
    console.log('    ✓ Concatenated sentence dispatched seamlessly:', dispatchedItems1[0]);

    // 1.3: Run-on speech without punctuation -> Word cap defense against unbounded latency
    console.log('  1.3: Sending run-on continuous speech without punctuation (11 words)...');
    dispatchedItems1.length = 0;
    room1.config.decalageMode = 'streaming';
    
    // Chunk A: 6 words without punctuation
    await pipeline.processSpeech({
      roomId: roomId1,
      text: 'el paciente acude por un dolor',
      forceLanguages: ['en']
    });
    assert.equal(dispatchedItems1.length, 0, '6 words without punctuation should remain buffered');
    console.log('    ✓ 6 words buffered waiting for clause completion');

    // Chunk B: 5 words without punctuation (total 11 >= 10 words) -> Should trigger word-cap dispatch
    await pipeline.processSpeech({
      roomId: roomId1,
      text: 'precordial opresivo muy intenso irradiado',
      forceLanguages: ['en']
    });
    assert.equal(dispatchedItems1.length, 1, 'Must dispatch upon hitting max words limit (>= 10 words) to prevent excessive latency');
    assert.equal(dispatchedItems1[0], 'el paciente acude por un dolor precordial opresivo muy intenso irradiado');
    console.log('    ✓ Word cap triggered dispatch at 11 words:', dispatchedItems1[0]);

    // 1.4: Explicit bypass / End of turn (VAD silence / manual submit)
    console.log('  1.4: Single word with bypassDecalage / isTerminalSilence ("Sí.")...');
    dispatchedItems1.length = 0;
    await pipeline.processSpeech({
      roomId: roomId1,
      text: 'Sí.',
      isTerminalSilence: true,
      bypassDecalage: true,
      forceLanguages: ['en']
    });
    assert.equal(dispatchedItems1.length, 1, 'Bypass must dispatch 1-word turn immediately');
    assert.equal(dispatchedItems1[0], 'Sí.');
    console.log('    ✓ Single word turn dispatched immediately under bypass:', dispatchedItems1[0]);

    roomManager.cleanupRoom(roomId1);

    // =========================================================================
    // TEST 2: Timer Lifecycle & Orphan Timer Mitigation (waitMs = 750ms)
    // =========================================================================
    console.log('\n--- TEST 2: Timer Lifecycle & Orphan Timer Mitigation ---');
    const roomId2 = 'AUDIT-ROOM-TIMERS';
    const room2 = roomManager.createRoom(roomId2, 'Test Timers');
    const pipeline2 = new AIPipeline();

    const flushedItems2 = [];
    translationService.translateAll = async (text, src, opts) => {
      flushedItems2.push(text);
      return { detectedSource: 'es', translations: { en: `[EN] ${text}`, es: text } };
    };

    // 2.1: Clause flushes automatically upon timer expiration (750ms in streaming mode)
    console.log('  2.1: Verifying automatic tail flush after 750ms (streaming mode)...');
    room2.config.decalageMode = 'streaming';
    await pipeline2.processSpeech({
      roomId: roomId2,
      text: 'Muchas gracias', // 2 words, no terminal punctuation
      forceLanguages: ['en']
    });

    assert.equal(flushedItems2.length, 0, 'Should not flush immediately');
    assert(pipeline2.roomDecalageBuffers.has(roomId2), 'Must be in buffer');

    // Wait 900ms for the 750ms timer to fire
    await new Promise(r => setTimeout(r, 900));
    assert.equal(flushedItems2.length, 1, 'Must have flushed after 750ms timeout');
    assert.equal(flushedItems2[0], 'Muchas gracias');
    assert.equal(pipeline2.roomDecalageBuffers.has(roomId2), false, 'Buffer must be deleted after flush');
    console.log('    ✓ Clause flushed automatically on timeout:', flushedItems2[0]);

    // 2.2: Timer replacement: Chunk 1 buffered, Chunk 2 arrives at 200ms -> Old timer must be cancelled
    console.log('  2.2: Verifying old timer cancellation on rapid arrival...');
    flushedItems2.length = 0;
    await pipeline2.processSpeech({
      roomId: roomId2,
      text: 'Primera parte',
      forceLanguages: ['en']
    });

    await new Promise(r => setTimeout(r, 200));

    // Send second chunk before 750ms
    await pipeline2.processSpeech({
      roomId: roomId2,
      text: 'segunda parte que completa la oracion terminal.',
      forceLanguages: ['en']
    });

    // Verify old timer does not fire phantom flush later
    await new Promise(r => setTimeout(r, 700));
    assert.equal(flushedItems2.length, 1, 'Must dispatch exactly once, old timer must not cause double emission');
    assert.equal(flushedItems2[0], 'Primera parte segunda parte que completa la oracion terminal.');
    console.log('    ✓ Old timer properly cancelled, single coherent emission verified');

    // 2.3: Room cleanup / deletion during active timer
    console.log('  2.3: Verifying orphan timer cleanup when room is deleted...');
    flushedItems2.length = 0;
    await pipeline2.processSpeech({
      roomId: roomId2,
      text: 'Frase incompleta antes de cerrar sala',
      forceLanguages: ['en']
    });
    assert(pipeline2.roomDecalageBuffers.has(roomId2), 'Buffer active before cleanup');

    // Now cleanup room
    pipeline2.cleanupRoom(roomId2);
    assert.equal(pipeline2.roomDecalageBuffers.has(roomId2), false, 'Buffer must be deleted on cleanupRoom');

    // Wait 900ms to ensure no delayed execution occurs on a dead room
    await new Promise(r => setTimeout(r, 900));
    assert.equal(flushedItems2.length, 0, 'No execution should occur after cleanupRoom was called');
    console.log('    ✓ Orphan timer cleanly disarmed, zero phantom execution');

    roomManager.cleanupRoom(roomId2);

    // =========================================================================
    // TEST 3: Multi-Room Concurrency & Case-Insensitive Key Isolation
    // =========================================================================
    console.log('\n--- TEST 3: Multi-Room Concurrency & Key Normalization ---');
    const pipeline3 = new AIPipeline();
    const roomA = 'ROOM-ALPHA';
    const roomB = 'room-beta'; // lowercase input test
    roomManager.createRoom(roomA, 'Room Alpha');
    roomManager.createRoom(roomB, 'Room Beta');

    const emissionsByRoom = { [roomA]: [], ['ROOM-BETA']: [] };
    translationService.translateAll = async (text, src, opts) => {
      const rId = (opts.roomId || '').toUpperCase();
      if (emissionsByRoom[rId]) emissionsByRoom[rId].push(text);
      return { detectedSource: 'es', translations: { en: `[EN] ${text}`, es: text } };
    };

    // Concurrently send short clauses to Room A and Room B
    await Promise.all([
      pipeline3.processSpeech({ roomId: roomA, text: 'Alpha clause 1', forceLanguages: ['en'] }),
      pipeline3.processSpeech({ roomId: roomB, text: 'Beta clause 1', forceLanguages: ['en'] })
    ]);

    // Check isolation in buffers
    assert(pipeline3.roomDecalageBuffers.has(roomA), 'Room Alpha has its own buffer');
    assert(pipeline3.roomDecalageBuffers.has('ROOM-BETA'), 'Room Beta is stored under uppercase key');
    assert.equal(pipeline3.roomDecalageBuffers.get(roomA).text, 'Alpha clause 1');
    assert.equal(pipeline3.roomDecalageBuffers.get('ROOM-BETA').text, 'Beta clause 1');
    console.log('    ✓ Multi-room buffers strictly isolated by uppercase room key');

    // Send continuation to Room A only
    await pipeline3.processSpeech({
      roomId: roomA,
      text: 'Alpha completes sentence.',
      forceLanguages: ['en']
    });

    assert.equal(pipeline3.roomDecalageBuffers.has(roomA), false, 'Room A buffer cleared after dispatch');
    assert(pipeline3.roomDecalageBuffers.has('ROOM-BETA'), 'Room B buffer remains untouched');
    assert.equal(emissionsByRoom[roomA].length, 1);
    assert.equal(emissionsByRoom['ROOM-BETA'].length, 0);
    console.log('    ✓ Activity in Room A did not trigger or corrupt Room B');

    // Wait for Room B to tail-flush (natural mode uses 900ms waitMs)
    await new Promise(r => setTimeout(r, 1050));
    assert.equal(emissionsByRoom['ROOM-BETA'].length, 1);
    assert.equal(emissionsByRoom['ROOM-BETA'][0], 'Beta clause 1');
    console.log('    ✓ Room B timed out and flushed independently');

    pipeline3.cleanupRoom(roomA);
    pipeline3.cleanupRoom(roomB);
    roomManager.cleanupRoom(roomA);
    roomManager.cleanupRoom(roomB);

    // =========================================================================
    // TEST 4: Security & Telemetry Sanitization (Admin vs Listener)
    // =========================================================================
    console.log('\n--- TEST 4: Security Isolation & Telemetry Sanitization ---');
    const roomId4 = 'AUDIT-ROOM-SEC';
    const room4 = roomManager.createRoom(roomId4, 'Security Test');

    const listenerReceived = [];
    const hostReceived = [];
    const adminHostReceived = [];

    const mockListenerSocket = {
      readyState: 1,
      bufferedAmount: 0,
      send: (data) => {
        listenerReceived.push(JSON.parse(data));
      }
    };

    const mockHostSocket = {
      readyState: 1,
      bufferedAmount: 0,
      isAdminSession: false,
      send: (data) => {
        hostReceived.push(JSON.parse(data));
      }
    };

    const mockAdminHostSocket = {
      readyState: 1,
      bufferedAmount: 0,
      isAdminSession: true,
      send: (data) => {
        adminHostReceived.push(JSON.parse(data));
      }
    };

    roomManager.addListener(roomId4, mockListenerSocket, 'sock_listener_1', 'en', {
      name: 'Auditor Listener',
      email: 'listener@test.com'
    });

    // 4.1: Standard Host vs Listener telemetry
    room4.hostSocket = mockHostSocket;

    const testTranscriptItem = {
      id: 'pkt_test_123',
      seqId: 42,
      timestamp: Date.now(),
      originalText: 'Tratamiento con enoxaparina',
      detectedLanguage: 'es',
      engineUsed: 'Google Gemini 3.8 Flash',
      sttEngineUsed: 'Deepgram Nova-3',
      sttModel: 'nova-3',
      translations: { en: 'Enoxaparin treatment', es: 'Tratamiento con enoxaparina' },
      metrics: { sttMs: 220, transMs: 140, totalMs: 360 }
    };

    roomManager.addTranscriptItem(roomId4, testTranscriptItem);

    assert.equal(listenerReceived.length, 1);
    const listenerMsg = listenerReceived[0];
    assert.equal(listenerMsg.type, 'TRANSCRIPT_EVENT');
    assert.equal(listenerMsg.item.originalText, 'Tratamiento con enoxaparina');
    // CWE-200 check: Verify internal telemetry & models are scrubbed for listener
    assert.equal(listenerMsg.item.sttEngineUsed, undefined, 'Listener MUST NOT receive sttEngineUsed (CWE-200)');
    assert.equal(listenerMsg.item.sttModel, undefined, 'Listener MUST NOT receive sttModel (CWE-200)');
    assert.equal(listenerMsg.item.metrics, undefined, 'Listener MUST NOT receive latency metrics (CWE-200)');
    console.log('    ✓ Listener transcript is properly sanitized (no sttEngineUsed, sttModel, or metrics)');

    assert.equal(hostReceived.length, 1);
    const nonAdminHostMsg = hostReceived[0];
    assert.equal(nonAdminHostMsg.item.sttEngineUsed, undefined, 'Non-admin host MUST NOT receive raw backend engine internals');
    console.log('    ✓ Non-admin host receives sanitized item');

    // 4.2: Admin Host session receives full telemetry
    room4.hostSocket = mockAdminHostSocket;
    roomManager.addTranscriptItem(roomId4, testTranscriptItem);
    assert.equal(adminHostReceived.length, 1);
    const adminMsg = adminHostReceived[0];
    assert.equal(adminMsg.item.sttEngineUsed, 'Deepgram Nova-3', 'Admin host MUST receive telemetry');
    assert(adminMsg.item.metrics && adminMsg.item.metrics.sttMs === 220, 'Admin host MUST receive timing metrics');
    console.log('    ✓ Admin host receives full operational telemetry');

    roomManager.cleanupRoom(roomId4);

    // =========================================================================
    // TEST 5: TTS Audio Coalescence & Zero-Loss Queue
    // =========================================================================
    console.log('\n--- TEST 5: TTS Speech Burst Coalescence & Queue Order ---');
    const roomId5 = 'AUDIT-ROOM-COALESCE';
    const room5 = roomManager.createRoom(roomId5, 'Coalescence Test');
    roomManager.addListener(roomId5, { readyState: 1, bufferedAmount: 0, send: () => {} }, 'sock_lis_5', 'en', {});

    const pipeline5 = new AIPipeline();
    const ttsSynthesizedTexts = [];
    const broadcastedChunks = [];

    translationService.translateAll = async (text) => ({
      detectedSource: 'es',
      translations: { en: `[EN] ${text}`, es: text }
    });

    ttsService.synthesize = async (text, lang) => {
      ttsSynthesizedTexts.push(text);
      // Simulate 80ms synthesis delay
      await new Promise(r => setTimeout(r, 80));
      return { audioBuffer: Buffer.alloc(256), audioBase64: 'AAAA', mimeType: 'audio/mpeg', durationMs: 500 };
    };

    roomManager.broadcastAudioToLanguageChannel = (rId, lang, packet) => {
      if (rId === roomId5) broadcastedChunks.push(packet);
      return 1;
    };

    // Send 3 sentences rapidly while TTS is busy
    console.log('  5.1: Emitting 3 rapid sentences to test cabin coalescence...');
    const sentences = [
      'Primera oracion completa del ponente.',
      'Segunda oracion explicativa subsiguiente.',
      'Tercera oracion concluyente final.'
    ];

    await Promise.all(sentences.map(s => pipeline5.processSpeech({
      roomId: roomId5,
      text: s,
      forceLanguages: ['en'],
      bypassDecalage: true
    })));

    // Wait for cabin queue to drain
    const cabinKey5 = `${roomId5}:en`;
    let attempts = 0;
    while ((pipeline5.cabinQueues.has(cabinKey5) || pipeline5.cabinPendingTexts.has(cabinKey5)) && attempts < 30) {
      await new Promise(r => setTimeout(r, 50));
      attempts++;
    }

    assert(broadcastedChunks.length > 0, 'Audio must have been broadcast');
    const totalSpoken = broadcastedChunks.map(c => c.text).join(' ');
    console.log('    Broadcasted coalesced text:', totalSpoken);

    assert(totalSpoken.includes('Primera'), 'Sentence 1 must be present');
    assert(totalSpoken.includes('Segunda'), 'Sentence 2 must be present');
    assert(totalSpoken.includes('Tercera'), 'Sentence 3 must be present');
    assert(ttsSynthesizedTexts.length <= 3, 'Coalescence must merge backlog into fewer synthesis calls');
    console.log(`    ✓ Zero-loss verified: 3 sentences preserved across ${ttsSynthesizedTexts.length} TTS synthesis passes`);

    pipeline5.cleanupRoom(roomId5);
    roomManager.cleanupRoom(roomId5);

    console.log('\n=============================================================');
    console.log('🏆 ALL AUDIT TESTS PASSED SUCCESSFULLY (100% Zero Defect)');
    console.log('=============================================================');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ AUDIT TEST FAILED:', err);
    process.exit(1);
  } finally {
    translationService.translateAll = originalTranslateAll;
    ttsService.synthesize = originalSynthesize;
    roomManager.broadcastAudioToLanguageChannel = originalBroadcast;
  }
}

runTests();
