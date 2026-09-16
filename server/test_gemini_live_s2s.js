/**
 * test_gemini_live_s2s.js
 * Automated Verification Suite for Google Gemini 3.8 Live Speech-to-Speech (S2S) Engine
 * September 2026 Edition
 */

import assert from 'assert';
import EventEmitter from 'events';

// Set isolated test port before server initialization
process.env.PORT = '3098';

import { pcm24kToWav, getSystemPromptForLang, geminiLiveBridge, DEFAULT_CABIN_VOICES } from './src/services/geminiLiveBridge.js';
import { roomManager } from './src/roomManager.js';
import { aiPipeline } from './src/services/aiPipeline.js';
import { createAdminSession } from './src/services/adminAuth.js';

const { app, server } = await import('./src/index.js');

console.log('========================================================================');
console.log('🚀 LIFTVOICE GEMINI 3.8 LIVE S2S ENGINE VERIFICATION SUITE (Sept 2026)');
console.log('========================================================================\n');

/**
 * Mock WebSocket implementing the minimal ws contract for testing Gemini Live
 */
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
    this.readyState = 3; // WebSocket.CLOSED
    this.emit('close', code, reason);
  }

  simulateServerMessage(msgObj) {
    this.emit('message', Buffer.from(JSON.stringify(msgObj)));
  }
}

async function runVerificationSuite() {
  let passedTests = 0;

  // ----------------------------------------------------------------------------
  // TEST 1: pcm24kToWav - Standard 44-byte RIFF/WAV Header & Byte Alignment
  // ----------------------------------------------------------------------------
  console.log('▶ [Test 1] pcm24kToWav: Standard 44-byte RIFF/WAV Header Verification...');
  {
    const rawPcm = Buffer.alloc(480); // 240 samples of 16-bit PCM (10ms at 24kHz)
    for (let i = 0; i < rawPcm.length; i++) {
      rawPcm[i] = i % 256;
    }

    const wav = pcm24kToWav(rawPcm);
    assert.strictEqual(wav.length, 44 + rawPcm.length, 'Total WAV size must be 44 header bytes + PCM length');

    // Verify RIFF Chunk
    assert.strictEqual(wav.toString('ascii', 0, 4), 'RIFF', 'Magic header must be RIFF');
    assert.strictEqual(wav.readUInt32LE(4), 36 + rawPcm.length, 'RIFF chunk size must be 36 + PCM length');
    assert.strictEqual(wav.toString('ascii', 8, 12), 'WAVE', 'Format must be WAVE');

    // Verify fmt Subchunk
    assert.strictEqual(wav.toString('ascii', 12, 16), 'fmt ', 'Subchunk1 ID must be fmt ');
    assert.strictEqual(wav.readUInt32LE(16), 16, 'Subchunk1 size must be 16 for PCM');
    assert.strictEqual(wav.readUInt16LE(20), 1, 'AudioFormat must be 1 (linear PCM)');
    assert.strictEqual(wav.readUInt16LE(22), 1, 'NumChannels must be 1 (mono)');
    assert.strictEqual(wav.readUInt32LE(24), 24000, 'SampleRate must be 24000 Hz');
    assert.strictEqual(wav.readUInt32LE(28), 48000, 'ByteRate must be 48000 (24000 * 1 * 2)');
    assert.strictEqual(wav.readUInt16LE(32), 2, 'BlockAlign must be 2 (1 * 16 / 8)');
    assert.strictEqual(wav.readUInt16LE(34), 16, 'BitsPerSample must be 16');

    // Verify data Subchunk
    assert.strictEqual(wav.toString('ascii', 36, 40), 'data', 'Subchunk2 ID must be data');
    assert.strictEqual(wav.readUInt32LE(40), rawPcm.length, 'Subchunk2 size must match raw PCM length');

    // Verify payload matches exactly
    const extractedPcm = wav.subarray(44);
    assert.deepStrictEqual(extractedPcm, rawPcm, 'Extracted PCM data must match original raw input');

    passedTests++;
    console.log('  ✔ Passed: 24kHz mono 16-bit WAV header and byte alignment verified.\n');
  }

  // ----------------------------------------------------------------------------
  // TEST 2: Setup Frame & Prompt Generation for All Cabins
  // ----------------------------------------------------------------------------
  console.log('▶ [Test 2] Gemini Live Setup Frame & System Instruction Generation...');
  {
    const testLangs = ['en', 'it', 'pt', 'es'];
    for (const lang of testLangs) {
      const prompt = getSystemPromptForLang(lang);
      assert.ok(prompt.includes('elite real-time conference interpreter'), `Prompt for ${lang} must include elite interpreter role`);
      assert.ok(prompt.length > 50, `Prompt for ${lang} must be comprehensive`);

      const voice = DEFAULT_CABIN_VOICES[lang];
      assert.ok(voice, `Default voice for ${lang} must be defined`);

      const setupFrame = geminiLiveBridge.buildSetupFrame({
        model: 'models/gemini-3.8-live',
        voiceName: voice,
        systemPrompt: prompt
      });

      assert.strictEqual(setupFrame.setup.model, 'models/gemini-3.8-live');
      assert.deepStrictEqual(setupFrame.setup.generationConfig.responseModalities, ['AUDIO']);
      assert.strictEqual(setupFrame.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, voice);
      assert.strictEqual(setupFrame.setup.systemInstruction.parts[0].text, prompt);
    }

    passedTests++;
    console.log('  ✔ Passed: Setup frame structure and language cabin prompts validated.\n');
  }

  // ----------------------------------------------------------------------------
  // TEST 3: Cabin Session Life-Cycle, Setup Frame Dispatch & SetupComplete Handshake
  // ----------------------------------------------------------------------------
  console.log('▶ [Test 3] Cabin Session Connection & SetupComplete Handshake...');
  {
    const testRoomId = 'TEST-S2S-ROOM-3';
    const mockWs = new MockGeminiWebSocket();

    const sessionPromise = geminiLiveBridge.getOrCreateCabinSession(testRoomId, 'en', {
      mockWs,
      voice: 'Aoede'
    });

    // Verify setup frame was sent immediately upon open
    assert.strictEqual(mockWs.sentMessages.length, 1, 'Setup frame must be sent on connection');
    const sentSetup = JSON.parse(mockWs.sentMessages[0]);
    assert.strictEqual(sentSetup.setup.model, 'models/gemini-3.8-live');
    assert.strictEqual(sentSetup.setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Aoede');

    // Simulate setupComplete from Gemini Live
    mockWs.simulateServerMessage({ setupComplete: {} });

    const session = await sessionPromise;
    assert.strictEqual(session.isReady, true, 'Session must be marked ready after setupComplete');
    assert.strictEqual(session.lang, 'en');
    assert.strictEqual(session.roomId, testRoomId);

    geminiLiveBridge.closeRoom(testRoomId);
    passedTests++;
    console.log('  ✔ Passed: Setup frame dispatched and setupComplete handshake confirmed.\n');
  }

  // ----------------------------------------------------------------------------
  // TEST 4: serverContent Turn Handling: Text Accumulation & Audio WAV Playout
  // ----------------------------------------------------------------------------
  console.log('▶ [Test 4] serverContent Turn Handling (Incremental Text & 24kHz Audio)...');
  {
    const testRoomId = 'TEST-S2S-BROADCAST-4';
    const room = roomManager.getOrCreateRoom(testRoomId, 'Test Broadcast');
    room.config.pipelineMode = 'gemini_live_s2s';
    const mockWs = new MockGeminiWebSocket();

    let receivedAudioPacket = null;
    const originalBroadcast = roomManager.broadcastAudioToLanguageChannel;
    roomManager.broadcastAudioToLanguageChannel = (rId, lang, packet) => {
      if (rId === testRoomId && lang === 'en') {
        receivedAudioPacket = packet;
      }
      return originalBroadcast.call(roomManager, rId, lang, packet);
    };

    const session = await geminiLiveBridge.getOrCreateCabinSession(testRoomId, 'en', {
      mockWs,
      voice: 'Aoede'
    });
    mockWs.simulateServerMessage({ setupComplete: {} });

    // Simulate Gemini Live streaming: Part 1 (Text chunk)
    mockWs.simulateServerMessage({
      serverContent: {
        modelTurn: {
          parts: [
            { text: 'Welcome to ' }
          ]
        },
        turnComplete: false
      }
    });

    assert.strictEqual(session.currentText, 'Welcome to ');
    let transcriptItem = room.transcriptHistory.find(i => i.id === session.currentPacketId);
    assert.ok(transcriptItem, 'Transcript item must be recorded in room transcript history');
    assert.strictEqual(transcriptItem.translations['en'], 'Welcome to ');

    // Simulate Gemini Live streaming: Part 2 (Text chunk + Audio chunk)
    const fakePcm24k = Buffer.alloc(240, 0x12); // 120 samples
    const fakePcmBase64 = fakePcm24k.toString('base64');

    mockWs.simulateServerMessage({
      serverContent: {
        modelTurn: {
          parts: [
            { text: 'the conference.' },
            { inlineData: { mimeType: 'audio/pcm;rate=24000', data: fakePcmBase64 } }
          ]
        },
        turnComplete: false
      }
    });

    assert.strictEqual(session.currentText, 'Welcome to the conference.');
    assert.ok(receivedAudioPacket, 'Audio packet must be broadcast to language channel');
    assert.strictEqual(receivedAudioPacket.lang, 'en');
    assert.strictEqual(receivedAudioPacket.sampleRate, 24000);
    assert.strictEqual(receivedAudioPacket.mimeType, 'audio/wav');
    assert.strictEqual(receivedAudioPacket.text, 'Welcome to the conference.');
    assert.ok(Buffer.isBuffer(receivedAudioPacket.audioBuffer));
    assert.strictEqual(receivedAudioPacket.audioBuffer.length, 44 + fakePcm24k.length);

    // Simulate Turn Complete
    mockWs.simulateServerMessage({
      serverContent: {
        turnComplete: true
      }
    });

    assert.strictEqual(session.currentText, '', 'currentText must be reset on turnComplete');
    assert.strictEqual(session.seqId, 2, 'seqId must increment on turnComplete');

    // Restore original broadcast method & cleanup
    roomManager.broadcastAudioToLanguageChannel = originalBroadcast;
    geminiLiveBridge.closeRoom(testRoomId);
    roomManager.deleteRoom(testRoomId);

    passedTests++;
    console.log('  ✔ Passed: Incremental text and 24kHz WAV audio broadcast validated.\n');
  }

  // ----------------------------------------------------------------------------
  // TEST 5: Lazy Cabins & Speaker Feed (Audio & Text)
  // ----------------------------------------------------------------------------
  console.log('▶ [Test 5] Lazy Cabins: Only Active Channels Receive Audio/Text Chunks...');
  {
    const testRoomId = 'TEST-LAZY-CABIN-5';
    const room = roomManager.getOrCreateRoom(testRoomId);
    room.config.pipelineMode = 'gemini_live_s2s';

    // Clean any listeners
    room.listeners.clear();
    room.monitoredBooth = null;

    let getOrCreateCallCount = 0;
    const originalGetOrCreate = geminiLiveBridge.getOrCreateCabinSession;
    geminiLiveBridge.getOrCreateCabinSession = async (...args) => {
      getOrCreateCallCount++;
      return originalGetOrCreate.apply(geminiLiveBridge, args);
    };

    // 1. Feed audio with 0 listeners and no booth monitor -> Lazy Cabin skips completely
    await geminiLiveBridge.feedSpeakerAudio(testRoomId, Buffer.alloc(320), 'audio/pcm;rate=16000');
    assert.strictEqual(getOrCreateCallCount, 0, 'No cabin session should be created when 0 listeners are active');

    // 2. Add an Italian listener to the room
    const mockListenerWs = new MockGeminiWebSocket();
    roomManager.addListener(testRoomId, mockListenerWs, 'socket_it_5', 'it');

    // Feed audio now -> should spawn cabin for IT
    const mockWsIt = new MockGeminiWebSocket();
    let itAudioReceived = null;
    let itTextReceived = null;
    mockWsIt.send = (data) => {
      mockWsIt.sentMessages.push(data);
      const parsed = JSON.parse(data);
      if (parsed.realtimeInput) {
        itAudioReceived = parsed.realtimeInput;
      }
      if (parsed.clientContent) {
        itTextReceived = parsed.clientContent;
      }
    };

    // Pre-create session using mockWsIt so network is bypassed
    await geminiLiveBridge.getOrCreateCabinSession(testRoomId, 'it', {
      mockWs: mockWsIt
    });

    const testAudioBytes = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    await geminiLiveBridge.feedSpeakerAudio(testRoomId, testAudioBytes, 'audio/pcm;rate=16000');

    assert.ok(itAudioReceived, 'Active IT cabin must receive realtimeInput audio chunks');
    assert.strictEqual(itAudioReceived.mediaChunks[0].mimeType, 'audio/pcm;rate=16000');
    assert.strictEqual(itAudioReceived.mediaChunks[0].data, testAudioBytes.toString('base64'));

    // Feed speaker text
    await geminiLiveBridge.feedSpeakerText(testRoomId, 'Hello doctors');
    assert.ok(
      itTextReceived.turns[0].parts[0].text.includes('Hello doctors'),
      'Turn text must contain the sanitized utterance'
    );
    assert.match(
      itTextReceived.turns[0].parts[0].text,
      /<untrusted_speaker_utterance_[a-f0-9]+>/i,
      'Turn text must be framed in dynamic nonce delimiter tags'
    );

    // Restore
    geminiLiveBridge.getOrCreateCabinSession = originalGetOrCreate;
    geminiLiveBridge.closeRoom(testRoomId);
    roomManager.deleteRoom(testRoomId);

    passedTests++;
    console.log('  ✔ Passed: Lazy Cabins cost optimization and speaker feeding verified.\n');
  }

  // ----------------------------------------------------------------------------
  // TEST 6: Room Manager Default Configuration & Cleanup Delegation
  // ----------------------------------------------------------------------------
  console.log('▶ [Test 6] Room Manager Default Config & Cleanup Delegation...');
  {
    const testRoomId = 'TEST-CONFIG-ROOM-6';
    const room = roomManager.createRoom(testRoomId, 'Config Test Room');
    assert.strictEqual(room.config.pipelineMode, 'deepgram_gemini', 'Default pipelineMode must be deepgram_gemini');
    assert.deepStrictEqual(room.config.geminiLiveVoices, {
      en: 'Aoede',
      it: 'Kore',
      pt: 'Fenrir',
      es: 'Charon'
    }, 'Default geminiLiveVoices must match required prebuilt voices');

    // Verify cleanupRoom delegates to geminiLiveBridge.closeRoom
    let bridgeCloseRoomCalled = false;
    const originalCloseRoom = geminiLiveBridge.closeRoom;
    geminiLiveBridge.closeRoom = (id) => {
      if (id === testRoomId) {
        bridgeCloseRoomCalled = true;
      }
      return originalCloseRoom.call(geminiLiveBridge, id);
    };

    roomManager.cleanupRoom(testRoomId);
    assert.strictEqual(bridgeCloseRoomCalled, true, 'cleanupRoom must close geminiLiveBridge cabins');
    assert.strictEqual(roomManager.getRoom(testRoomId), null, 'Room must be deleted');

    geminiLiveBridge.closeRoom = originalCloseRoom;
    passedTests++;
    console.log('  ✔ Passed: RoomManager default config and cleanupRoom verified.\n');
  }

  // ----------------------------------------------------------------------------
  // TEST 7: AIPipeline Mode Switching (gemini_live_s2s vs deepgram_gemini)
  // ----------------------------------------------------------------------------
  console.log('▶ [Test 7] AIPipeline Mode Switching & Host Telemetry Emission...');
  {
    const testRoomId = 'TEST-PIPELINE-MODE-7';
    const room = roomManager.getOrCreateRoom(testRoomId);

    // Attach mock host socket
    const mockHostWs = new MockGeminiWebSocket();
    let hostTelemetryReceived = null;
    mockHostWs.send = (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'PIPELINE_METRIC') {
        hostTelemetryReceived = msg.metric;
      }
    };
    mockHostWs.isAdminSession = true;
    room.hostSocket = mockHostWs;

    // 1. Verify default mode is 'deepgram_gemini'
    assert.strictEqual(aiPipeline.pipelineMode, 'deepgram_gemini');

    // 2. Set mode to 'gemini_live_s2s'
    aiPipeline.setApiKeys({
      pipelineMode: 'gemini_live_s2s',
      geminiLiveVoices: { en: 'Aoede', it: 'Kore', pt: 'Fenrir', es: 'Charon' }
    });
    assert.strictEqual(aiPipeline.pipelineMode, 'gemini_live_s2s');

    let feedAudioCalled = false;
    const originalFeedAudio = geminiLiveBridge.feedSpeakerAudio;
    geminiLiveBridge.feedSpeakerAudio = async (...args) => {
      feedAudioCalled = true;
    };

    const dummyAudio = Buffer.alloc(160);
    const res = await aiPipeline.executeSpeechPipeline({
      roomId: testRoomId,
      audioBuffer: dummyAudio,
      mimeType: 'audio/webm'
    });

    assert.strictEqual(res.pipelineMode, 'gemini_live_s2s');
    assert.strictEqual(feedAudioCalled, true, 'feedSpeakerAudio must be invoked in gemini_live_s2s mode');
    assert.ok(hostTelemetryReceived, 'PIPELINE_METRIC telemetry must be emitted to host');
    assert.strictEqual(hostTelemetryReceived.sttModel, 'gemini-3.8-live');

    // 3. Reset back to deepgram_gemini
    aiPipeline.setApiKeys({ pipelineMode: 'deepgram_gemini' });
    assert.strictEqual(aiPipeline.pipelineMode, 'deepgram_gemini');

    // Restore
    geminiLiveBridge.feedSpeakerAudio = originalFeedAudio;
    roomManager.deleteRoom(testRoomId);

    passedTests++;
    console.log('  ✔ Passed: AIPipeline mode switching and host telemetry verified.\n');
  }

  // ----------------------------------------------------------------------------
  // TEST 8: GET /api/config includes pipelineMode and geminiLiveVoices
  // ----------------------------------------------------------------------------
  console.log('▶ [Test 8] GET /api/config: pipelineMode & geminiLiveVoices Verification...');
  {
    const res = await fetch(`http://127.0.0.1:3098/api/config`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.pipelineMode, 'deepgram_gemini');
    assert.deepStrictEqual(data.geminiLiveVoices, {
      en: 'Aoede',
      it: 'Kore',
      pt: 'Fenrir',
      es: 'Charon'
    });
    passedTests++;
    console.log('  ✔ Passed: GET /api/config contains pipelineMode and geminiLiveVoices.\n');
  }

  // ----------------------------------------------------------------------------
  // TEST 9: POST /api/config updates pipelineMode & geminiLiveVoices
  // ----------------------------------------------------------------------------
  console.log('▶ [Test 9] POST /api/config: Updates pipelineMode & geminiLiveVoices...');
  {
    const adminToken = createAdminSession({ email: 'admin@liftvoice.ai' });
    const res = await fetch(`http://127.0.0.1:3098/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        pipelineMode: 'gemini_live_s2s',
        geminiLiveVoices: { en: 'Puck', it: 'Kore', pt: 'Fenrir', es: 'Charon' }
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(aiPipeline.pipelineMode, 'gemini_live_s2s');
    assert.strictEqual(aiPipeline.geminiLiveVoices.en, 'Puck');

    // Reset back to deepgram_gemini
    await fetch(`http://127.0.0.1:3098/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        pipelineMode: 'deepgram_gemini',
        geminiLiveVoices: { en: 'Aoede', it: 'Kore', pt: 'Fenrir', es: 'Charon' }
      })
    });
    assert.strictEqual(aiPipeline.pipelineMode, 'deepgram_gemini');

    passedTests++;
    console.log('  ✔ Passed: POST /api/config successfully updates pipelineMode and voices.\n');
  }

  console.log('========================================================================');
  console.log(`🎉 ALL ${passedTests}/9 GEMINI 3.8 LIVE S2S TESTS PASSED (September 2026)`);
  console.log('========================================================================\n');
  process.exit(0);
}

runVerificationSuite().catch((err) => {
  console.error('❌ Verification suite encountered an unexpected failure:', err);
  process.exit(1);
});
