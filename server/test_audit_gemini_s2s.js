import assert from 'assert';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import EventEmitter from 'events';
import {
  pcm24kToWav,
  getSystemPromptForLang,
  geminiLiveBridge,
  DEFAULT_CABIN_VOICES,
  DEFAULT_CABIN_SYSTEM_PROMPTS
} from './src/services/geminiLiveBridge.js';
import { roomManager } from './src/roomManager.js';
import { aiPipeline } from './src/services/aiPipeline.js';

class MockGeminiWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1; // WebSocket.OPEN
    this.sentMessages = [];
  }

  send(data) {
    this.sentMessages.push(data);
  }

  close(code = 1000, reason = '') {
    this.readyState = 3;
    this.emit('close', code, reason);
  }

  simulateServerMessage(msgObj) {
    this.emit('message', Buffer.from(JSON.stringify(msgObj)));
  }
}

async function runS2SAuditSuite() {
  console.log('========================================================================');
  console.log('🔬 AUDIT SUITE: GEMINI 3.8 LIVE S2S & DUAL PIPELINE ARCHITECTURE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  // ----------------------------------------------------------------------------
  // SECTION 1: PROTOCOL CONFORMANCE & VOICE/PROMPT MAPPINGS
  // ----------------------------------------------------------------------------
  console.log('--- SECTION 1: S2S WebSocket Protocol & Voice/Prompt Mapping ---');

  // 1.1 Voice mappings
  {
    total++;
    const voices = {
      en: 'Aoede',
      it: 'Kore',
      pt: 'Fenrir',
      es: 'Charon'
    };
    for (const [lang, voice] of Object.entries(voices)) {
      assert.strictEqual(DEFAULT_CABIN_VOICES[lang], voice, `Voice for ${lang} must be ${voice}`);
    }
    console.log('  ✔ [1.1] Prebuilt voice mappings (Aoede, Kore, Fenrir, Charon): VERIFIED');
    passed++;
  }

  // 1.2 Setup Frame Structure
  {
    total++;
    const frame = geminiLiveBridge.buildSetupFrame({
      model: 'models/gemini-3.8-live',
      voiceName: 'Puck',
      systemPrompt: getSystemPromptForLang('en')
    });

    assert.strictEqual(frame.setup.model, 'models/gemini-3.8-live');
    assert.deepStrictEqual(frame.setup.generationConfig.responseModalities, ['AUDIO', 'TEXT']);
    assert.strictEqual(frame.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Puck');
    assert.ok(frame.setup.systemInstruction.parts[0].text.includes('elite real-time conference interpreter'));
    console.log('  ✔ [1.2] Setup frame responseModalities [AUDIO, TEXT] & Puck voice: VERIFIED');
    passed++;
  }

  // ----------------------------------------------------------------------------
  // SECTION 2: AUDIO PROCESSING & RIFF/WAV COMPLIANCE
  // ----------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Audio Processing (pcm24kToWav) Specification ---');

  // 2.1 RIFF/WAV Header & Sizing
  {
    total++;
    const sampleRate = 24000;
    const channels = 1;
    const bitsPerSample = 16;
    const pcmData = Buffer.alloc(960, 0x55); // 480 samples = 20ms of audio

    const wav = pcm24kToWav(pcmData);

    // Exact field validations per RIFF/WAV specification
    assert.strictEqual(wav.toString('ascii', 0, 4), 'RIFF');
    assert.strictEqual(wav.readUInt32LE(4), 36 + pcmData.length);
    assert.strictEqual(wav.toString('ascii', 8, 12), 'WAVE');
    assert.strictEqual(wav.toString('ascii', 12, 16), 'fmt ');
    assert.strictEqual(wav.readUInt32LE(16), 16); // Subchunk1Size
    assert.strictEqual(wav.readUInt16LE(20), 1); // AudioFormat: PCM (1)
    assert.strictEqual(wav.readUInt16LE(22), channels); // NumChannels: 1
    assert.strictEqual(wav.readUInt32LE(24), sampleRate); // SampleRate: 24000
    assert.strictEqual(wav.readUInt32LE(28), sampleRate * channels * (bitsPerSample / 8)); // ByteRate: 48000
    assert.strictEqual(wav.readUInt16LE(32), channels * (bitsPerSample / 8)); // BlockAlign: 2
    assert.strictEqual(wav.readUInt16LE(34), bitsPerSample); // BitsPerSample: 16
    assert.strictEqual(wav.toString('ascii', 36, 40), 'data');
    assert.strictEqual(wav.readUInt32LE(40), pcmData.length);
    assert.deepStrictEqual(wav.subarray(44), pcmData);

    console.log('  ✔ [2.1] 24kHz 16-bit Mono RIFF/WAV header fields (ByteRate 48000, BlockAlign 2): VERIFIED');
    passed++;
  }

  // 2.2 Benchmarking pcm24kToWav memory and throughput
  {
    total++;
    const chunk = Buffer.alloc(960);
    const start = process.hrtime.bigint();
    const iterations = 5000;
    for (let i = 0; i < iterations; i++) {
      pcm24kToWav(chunk);
    }
    const end = process.hrtime.bigint();
    const totalMs = Number(end - start) / 1e6;
    const perCallUs = (totalMs / iterations) * 1000;

    assert.ok(perCallUs < 50, `pcm24kToWav must take <50µs per invocation (actual: ${perCallUs.toFixed(2)}µs)`);
    console.log(`  ✔ [2.2] Performance: ${iterations} WAV encodings in ${totalMs.toFixed(2)}ms (~${perCallUs.toFixed(2)}µs/call): VERIFIED`);
    passed++;
  }

  // ----------------------------------------------------------------------------
  // SECTION 3: SERVERCONTENT HANDLING & STREAMING
  // ----------------------------------------------------------------------------
  console.log('\n--- SECTION 3: serverContent Turn & State Handling ---');

  // 3.1 Text Accumulation and Turn Completion
  {
    total++;
    const testRoom = 'AUDIT-ROOM-S3';
    const mockWs = new MockGeminiWebSocket();
    const session = await geminiLiveBridge.getOrCreateCabinSession(testRoom, 'en', { mockWs });
    mockWs.simulateServerMessage({ setupComplete: {} });

    // Stream text part 1
    mockWs.simulateServerMessage({
      serverContent: {
        modelTurn: { parts: [{ text: 'Good morning ' }] }
      }
    });
    assert.strictEqual(session.currentText, 'Good morning ');

    // Stream text part 2
    mockWs.simulateServerMessage({
      serverContent: {
        modelTurn: { parts: [{ text: 'delegates.' }] }
      }
    });
    assert.strictEqual(session.currentText, 'Good morning delegates.');

    // Turn complete
    mockWs.simulateServerMessage({
      serverContent: { turnComplete: true }
    });
    assert.strictEqual(session.currentText, '', 'currentText must be reset on turnComplete');
    assert.strictEqual(session.seqId, 2, 'seqId must increment to 2');

    geminiLiveBridge.closeRoom(testRoom);
    console.log('  ✔ [3.1] serverContent text accumulation and turnComplete sequence reset: VERIFIED');
    passed++;
  }

  // ----------------------------------------------------------------------------
  // SECTION 4: RESOURCE MANAGEMENT, VACANT CABINS & GHOST CONNECTIONS
  // ----------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Resource Management, Lazy Cabins & Vacant Sessions ---');

  // 4.1 Lazy Cabins: No creation when 0 listeners
  {
    total++;
    const testRoom = 'AUDIT-LAZY-S4';
    roomManager.getOrCreateRoom(testRoom);
    let sessionCountBefore = geminiLiveBridge.sessions.size;

    await geminiLiveBridge.feedSpeakerAudio(testRoom, Buffer.alloc(160));
    assert.strictEqual(geminiLiveBridge.sessions.size, sessionCountBefore, 'Must not create sessions without active listeners');

    roomManager.deleteRoom(testRoom);
    console.log('  ✔ [4.1] Lazy Cabins cost defense (0 listeners -> 0 live WebSockets): VERIFIED');
    passed++;
  }

  // 4.2 Room Deletion Cleanup
  {
    total++;
    const testRoom = 'AUDIT-CLEANUP-S4';
    const mockWs = new MockGeminiWebSocket();
    await geminiLiveBridge.getOrCreateCabinSession(testRoom, 'es', { mockWs });

    assert.ok(geminiLiveBridge.sessions.has(`${testRoom}:es`));
    roomManager.cleanupRoom(testRoom);

    assert.strictEqual(geminiLiveBridge.sessions.has(`${testRoom}:es`), false, 'Room cleanup must terminate cabin sessions');
    assert.strictEqual(mockWs.readyState, 3, 'WebSocket must be CLOSED on cleanupRoom');

    console.log('  ✔ [4.2] Room cleanup delegation & WebSocket termination: VERIFIED');
    passed++;
  }

  // 4.3 AUDIT FINDING TEST: Vacant Cabin Leak when Listener Leaves
  {
    total++;
    const testRoom = 'AUDIT-LEAK-TEST';
    roomManager.getOrCreateRoom(testRoom);

    // 1 listener joins in IT
    const mockListener = new MockGeminiWebSocket();
    roomManager.addListener(testRoom, mockListener, 'sock_leak_it', 'it');

    // Cabin is created
    const mockCabinWs = new MockGeminiWebSocket();
    await geminiLiveBridge.getOrCreateCabinSession(testRoom, 'it', { mockWs: mockCabinWs });
    assert.ok(geminiLiveBridge.sessions.has(`${testRoom}:it`));

    // Listener leaves room
    roomManager.removeListener('sock_leak_it');

    // Check if cabin is still in geminiLiveBridge.sessions:
    const isLeaked = geminiLiveBridge.sessions.has(`${testRoom}:it`);
    console.log(`  ⚠️ [4.3 Finding] Cabin session retained in memory after listener left? ${isLeaked ? 'YES (Vacant Cabin Leak)' : 'NO'}`);
    assert.strictEqual(isLeaked, true, 'Confirmed finding: vacant cabin remains open in memory');

    geminiLiveBridge.closeRoom(testRoom);
    roomManager.deleteRoom(testRoom);
    passed++;
  }

  console.log('\n========================================================================');
  console.log(`🏆 ALL ${passed}/${total} AUDIT CHECKS EXECUTED SUCCESSFULLY`);
  console.log('========================================================================\n');
}

runS2SAuditSuite().catch(err => {
  console.error('Audit suite error:', err);
  process.exit(1);
});
