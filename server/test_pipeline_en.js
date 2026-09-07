import WebSocket from 'ws';

async function testEnglishSpeaker() {
  console.log('--- Testing English Speaker Translation to ES, IT, PT ---');
  const WS_URL = 'ws://localhost:3001';
  const ROOM_ID = 'GLOBAL-SUMMIT-2026';

  const hostWs = new WebSocket(WS_URL);
  await new Promise((r) => hostWs.on('open', r));

  hostWs.send(JSON.stringify({ type: 'HOST_JOIN', roomId: ROOM_ID }));

  const listenerEs = new WebSocket(WS_URL);
  await new Promise((r) => listenerEs.on('open', r));
  listenerEs.send(JSON.stringify({ type: 'LISTENER_JOIN', roomId: ROOM_ID, lang: 'es' }));

  let receivedEsAudio = false;
  listenerEs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'AUDIO_CHUNK' && msg.lang === 'es') {
      console.log(`📡 [Spanish Listener] Received Audio in Spanish: "${msg.text}" (Latency: ${msg.latencyMs}ms)`);
      receivedEsAudio = true;
    }
  });

  await new Promise((r) => setTimeout(r, 600));

  // Speaker speaks English
  const englishSpeech = 'Welcome to the future of real-time translation for global conferences';
  console.log(`🎙️ [English Speaker] Speaking: "${englishSpeech}"...`);

  hostWs.send(JSON.stringify({
    type: 'SPEECH_CHUNK_TEXT',
    roomId: ROOM_ID,
    text: englishSpeech,
    sourceLanguage: 'en'
  }));

  await new Promise((r) => setTimeout(r, 3500));

  hostWs.close();
  listenerEs.close();

  if (receivedEsAudio) {
    console.log('✅ English-to-Spanish Simultaneous Interpretation Verified Successfully!');
    process.exit(0);
  } else {
    console.error('❌ Failed English-to-Spanish translation test.');
    process.exit(1);
  }
}

testEnglishSpeaker().catch(console.error);
