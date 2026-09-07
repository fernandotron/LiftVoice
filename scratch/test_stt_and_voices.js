import { sttService } from '../server/src/services/sttService.js';
import { ttsService } from '../server/src/services/ttsService.js';

async function runTests() {
  console.log('=== TEST 1: STT & TTS Service Initialization ===');
  console.log('STT default preferred engine:', sttService.preferredSttEngine);
  if (sttService.preferredSttEngine !== 'deepgram') {
    throw new Error('STT default engine should be deepgram');
  }
  console.log('✅ STT preferred engine is deepgram');

  console.log('\n=== TEST 2: Voice Models Clean Reading Defense ===');
  const testPreamble = '***Traducción:*** Bienvenidos al congreso médico internacional 2026. [aplausos]';
  const clean = ttsService.cleanTextForTTS(testPreamble);
  console.log('Original:', testPreamble);
  console.log('Cleaned:', clean);
  if (clean.toLowerCase().includes('traducción') || clean.includes('***') || clean.includes('[aplausos]')) {
    throw new Error('TTS did not clean preamble or markdown!');
  }
  console.log('✅ Voice model sanitization verified (clean text reading only)');

  console.log('\n=== TEST 3: Deepgram Live STT Transcription ===');
  const ttsAudio = await ttsService.synthesize('Bienvenidos a la sala de conferencias LiftVoice', 'es');
  const audioBuf = Buffer.from(ttsAudio.audioBase64, 'base64');
  console.log('Synthesized test audio buffer size:', audioBuf.length, 'bytes');

  const sttRes = await sttService.transcribeAudio(audioBuf, 'audio/mp3', 'es');
  console.log('Deepgram STT Result:', JSON.stringify(sttRes));
  if (!sttRes || !sttRes.text) {
    throw new Error('Deepgram STT failed to transcribe!');
  }
  console.log(`✅ Deepgram STT transcription passed: "${sttRes.text}" (${sttRes.engine})`);

  console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
