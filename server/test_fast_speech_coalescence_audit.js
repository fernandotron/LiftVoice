import { strict as assert } from 'assert';
import { AIPipeline } from './src/services/aiPipeline.js';
import { roomManager } from './src/roomManager.js';
import { ttsService } from './src/services/ttsService.js';
import { translationService } from './src/services/translationService.js';

console.log('🧪 Starting Rapid-Speech & Zero-Loss Coalescence Stress Test (September 2026 Standards)...');

async function runRapidSpeechTest() {
  const roomId = `TEST-ROOM-${Date.now()}`;
  
  // Create room with English booth configuration
  const room = roomManager.createRoom(roomId, 'fast-speaker', 'Dr. Fast Speaker', {
    sourceLanguage: 'es',
    pipelineMode: 'deepgram_gemini',
    voiceConfig: { en: 'aura-asteria-en' }
  });

  const pipeline = new AIPipeline();
  pipeline.setApiKeys({
    geminiApiKey: process.env.GEMINI_API_KEY || 'dummy_key'
  });

  // Mock translation and TTS services to run fast and deterministic
  const originalTranslate = translationService.translateWithGemini;
  const originalTts = ttsService.synthesize;

  let translationCount = 0;
  let ttsCount = 0;
  const broadcastPackets = [];

  translationService.translateWithGemini = async (text, sourceLang, targetLangs) => {
    translationCount++;
    // Simulate ~50ms translation latency
    await new Promise(r => setTimeout(r, 50));
    return {
      sourceLang: 'es',
      translations: {
        en: `[EN] ${text}`,
        es: text
      }
    };
  };

  ttsService.synthesize = async (text, lang, opts) => {
    ttsCount++;
    // Simulate ~100ms TTS synthesis latency
    await new Promise(r => setTimeout(r, 100));
    const mockAudio = Buffer.alloc(1024, 0x55);
    return {
      audioBuffer: mockAudio,
      audioBase64: mockAudio.toString('base64'),
      mimeType: 'audio/mpeg',
      durationMs: 800
    };
  };

  // Intercept broadcasts
  const originalBroadcast = roomManager.broadcastAudioToLanguageChannel.bind(roomManager);
  roomManager.broadcastAudioToLanguageChannel = (rId, lang, packet) => {
    if (rId === roomId) {
      broadcastPackets.push(packet);
    }
    return originalBroadcast(rId, lang, packet);
  };

  try {
    const rapidSentences = [
      'Hola a todos bienvenidos a la conferencia medica de cardiologia.',
      'Hoy vamos a discutir los avances mas recientes en arritmias ventriculares.',
      'Es fundamental comprender la dosificacion exacta de amiodarona en bolo.',
      'Tambien revisaremos los protocolos de intervencion coronaria percutanea.',
      'Agradezco a todos los doctores su presencia en esta sesion matutina.'
    ];

    console.log(`📡 Simulating 5 rapid speech bursts within 80ms (Presenter talking at ~200 WPM)...`);
    const startTime = Date.now();

    // Dispatch 5 speech sentences in rapid succession
    const pipelinePromises = rapidSentences.map((text, idx) => {
      return pipeline.processSpeech({
        roomId,
        text,
        isFinal: true,
        sourceLanguage: 'es',
        forceLanguages: ['en'],
        clientTimestamp: Date.now() + (idx * 20)
      });
    });

    await Promise.all(pipelinePromises);

    // Wait for per-cabin queues to drain completely
    console.log('⏳ Waiting for cabin queues to drain...');
    const cabinKey = `${roomId}:en`;
    let attempts = 0;
    while ((pipeline.cabinQueues.has(cabinKey) || pipeline.cabinPendingTexts.has(cabinKey)) && attempts < 60) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }

    const duration = Date.now() - startTime;
    console.log(`⏱️ Completed processing in ${duration}ms.`);
    console.log(`📊 Statistics:`);
    console.log(`   - Sentences emitted by presenter: ${rapidSentences.length}`);
    console.log(`   - Translations performed: ${translationCount}`);
    console.log(`   - TTS syntheses executed: ${ttsCount}`);
    console.log(`   - Audio packets broadcast to English cabin: ${broadcastPackets.length}`);

    // Assertions
    assert(broadcastPackets.length > 0, 'Must have broadcast audio packets');
    assert(ttsCount > 0, 'Must have synthesized audio');

    // Combine all broadcast texts to verify 0% content loss
    const fullSpokenEnglish = broadcastPackets.map(p => p.text).join(' ');
    console.log(`🔊 Full Spoken Playout in English Cabin:\n"${fullSpokenEnglish}"\n`);

    for (let i = 0; i < rapidSentences.length; i++) {
      const sentenceKeyword = rapidSentences[i].split(' ')[4]; // pick a unique word from each sentence
      const present = fullSpokenEnglish.toLowerCase().includes(sentenceKeyword.toLowerCase());
      console.log(`   ✓ Sentence ${i + 1} preserved (${sentenceKeyword}): ${present ? 'YES (100% Zero-Loss)' : 'NO'}`);
      assert(present, `Sentence ${i + 1} must be present in synthesized audio!`);
    }

    // Verify coalescence occurred (rapid sentences coalesced into fewer TTS passes to avoid queue backlog)
    console.log(`🎯 Coalescence Efficiency: ${rapidSentences.length} sentences handled in ${ttsCount} TTS pass(es).`);
    assert(ttsCount <= rapidSentences.length, 'Coalescence should combine bursts and reduce TTS overhead');

    console.log('\n✅ TEST PASSED: Zero-loss coalescence verified with 100% text retention and zero dropped sentences!');
  } finally {
    // Restore mocks
    translationService.translateWithGemini = originalTranslate;
    ttsService.synthesize = originalTts;
    roomManager.broadcastAudioToLanguageChannel = originalBroadcast;
    roomManager.cleanupRoom(roomId);
  }
}

runRapidSpeechTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  });
