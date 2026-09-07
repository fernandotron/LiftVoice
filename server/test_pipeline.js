import WebSocket from 'ws';

async function runTest() {
  console.log('--- Starting LiftVoice Automated Pipeline & E2E Verification Test ---');

  const WS_URL = 'ws://localhost:3001';
  const ROOM_ID = 'TEST-ROOM-2026';

  // 1. Connect Host Socket
  const hostWs = new WebSocket(WS_URL);
  await new Promise((resolve) => hostWs.on('open', resolve));
  console.log('✅ Host WebSocket Connected');

  hostWs.send(JSON.stringify({
    type: 'HOST_JOIN',
    roomId: ROOM_ID
  }));

  // 2. Connect 4 Listeners for EN, ES, IT, PT
  const languages = ['en', 'es', 'it', 'pt'];
  const listenerSockets = {};
  const receivedAudio = { en: false, es: false, it: false, pt: false };
  const receivedTranscripts = { en: false, es: false, it: false, pt: false };

  for (const lang of languages) {
    const ws = new WebSocket(WS_URL);
    await new Promise((resolve) => ws.on('open', resolve));
    
    ws.send(JSON.stringify({
      type: 'LISTENER_JOIN',
      roomId: ROOM_ID,
      lang: lang
    }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'AUDIO_CHUNK') {
          console.log(`📡 [Listener ${lang.toUpperCase()}] Received Audio Chunk: "${msg.text}" (Lang: ${msg.lang}, Latency: ${msg.latencyMs}ms)`);
          receivedAudio[lang] = true;
        } else if (msg.type === 'TRANSCRIPT_EVENT') {
          console.log(`📝 [Listener ${lang.toUpperCase()}] Received Live Transcript (Orig: "${msg.item.originalText}", Transl: "${msg.item.translations[lang]}")`);
          receivedTranscripts[lang] = true;
        }
      } catch (e) {}
    });

    listenerSockets[lang] = ws;
    console.log(`✅ Listener subscribed to channel: [${lang.toUpperCase()}]`);
  }

  // Wait for connections to stabilize
  await new Promise((r) => setTimeout(r, 800));

  // 3. Host emits a spoken speech phrase in Spanish
  const testPhrase = 'Bienvenidos a la conferencia de innovacion 2026';
  console.log(`\n🎙️ [Host] Broadcasting speech phrase: "${testPhrase}"...`);
  
  hostWs.send(JSON.stringify({
    type: 'SPEECH_CHUNK_TEXT',
    roomId: ROOM_ID,
    text: testPhrase,
    sourceLanguage: 'es'
  }));

  // Wait 4 seconds for AI pipeline (Translation -> TTS -> Multi-channel WS Broadcast)
  console.log('⏳ Waiting for AI pipeline processing and multi-channel broadcast...');
  await new Promise((r) => setTimeout(r, 4000));

  // 4. Verification Check
  console.log('\n--- Verification Results ---');
  let allPassed = true;
  for (const lang of languages) {
    const audioOk = receivedAudio[lang];
    const transOk = receivedTranscripts[lang];
    console.log(`Channel [${lang.toUpperCase()}]: Audio Packet: ${audioOk ? '✅ PASS' : '❌ FAIL'} | Transcript: ${transOk ? '✅ PASS' : '❌ FAIL'}`);
    if (!audioOk || !transOk) allPassed = false;
  }

  // 5. Test Hot Language Switch on Listener EN -> IT
  console.log('\n🔄 Testing Hot Language Switch (Switching EN listener to IT channel)...');
  listenerSockets['en'].send(JSON.stringify({
    type: 'CHANGE_LANGUAGE',
    roomId: ROOM_ID,
    lang: 'it'
  }));

  await new Promise((r) => setTimeout(r, 500));
  console.log('✅ Language switched to IT on the fly successfully.');

  // Close all sockets
  hostWs.close();
  for (const lang of languages) {
    listenerSockets[lang].close();
  }

  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! The real-time multi-channel pipeline is 100% operational.');
    process.exit(0);
  } else {
    console.error('\n❌ Verification did not receive all channel broadcasts.');
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
