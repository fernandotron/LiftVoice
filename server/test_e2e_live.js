import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { roomManager } from './src/roomManager.js';
import { aiPipeline } from './src/services/aiPipeline.js';

async function runLiveE2ETest() {
  console.log('===============================================================');
  console.log('🚀 LIFTVOICE E2E VERIFICATION & STRICT SEQUENCING TEST');
  console.log('===============================================================\n');

  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    let clientRole = null;
    let currentRoomId = null;
    const socketId = `sock_test_${Math.random().toString(36).substr(2, 6)}`;

    ws.on('message', async (rawMessage) => {
      try {
        const msg = JSON.parse(rawMessage.toString());
        switch (msg.type) {
          case 'HOST_JOIN':
            currentRoomId = (msg.roomId || 'TEST').toUpperCase();
            clientRole = 'HOST';
            roomManager.setHost(currentRoomId, ws, socketId);
            ws.send(JSON.stringify({ type: 'HOST_JOINED_SUCCESS', roomId: currentRoomId }));
            break;
          case 'LISTENER_JOIN':
            currentRoomId = (msg.roomId || 'TEST').toUpperCase();
            clientRole = 'LISTENER';
            roomManager.addListener(currentRoomId, ws, socketId, msg.lang || 'en');
            ws.send(JSON.stringify({ type: 'LISTENER_JOINED_SUCCESS', roomId: currentRoomId }));
            break;
          case 'CHANGE_LANGUAGE':
            if (currentRoomId && msg.lang) {
              roomManager.updateListenerLanguage(currentRoomId, socketId, msg.lang);
            }
            break;
          case 'SPEECH_CHUNK_TEXT':
            if (currentRoomId && msg.text) {
              await aiPipeline.processSpeech({
                roomId: currentRoomId,
                text: msg.text,
                sourceLanguage: msg.sourceLanguage || 'auto'
              });
            }
            break;
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    });

    ws.on('close', () => {
      if (clientRole === 'HOST') roomManager.removeHost(socketId);
      else if (clientRole === 'LISTENER') roomManager.removeListener(socketId);
    });
  });

  const TEST_PORT = 3099;
  await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));
  console.log(`✅ Test WebSocket server running on port ${TEST_PORT}`);

  const ROOM_ID = 'E2E_ROOM_2026';
  const WS_URL = `ws://127.0.0.1:${TEST_PORT}`;

  // 1. Host Connects
  const hostWs = new WebSocket(WS_URL);
  await new Promise((r) => hostWs.on('open', r));
  hostWs.send(JSON.stringify({ type: 'HOST_JOIN', roomId: ROOM_ID }));
  console.log('✅ Host connected to room:', ROOM_ID);

  // 2. Listeners Connect for EN, ES, IT, PT
  const languages = ['en', 'es', 'it', 'pt'];
  const listenerSockets = {};
  const receivedPackets = { en: [], es: [], it: [], pt: [] };

  for (const lang of languages) {
    const ws = new WebSocket(WS_URL);
    await new Promise((r) => ws.on('open', r));
    ws.send(JSON.stringify({ type: 'LISTENER_JOIN', roomId: ROOM_ID, lang }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'AUDIO_CHUNK') {
          receivedPackets[lang].push(msg);
          console.log(`📡 [Listener ${lang.toUpperCase()}] Received seqId #${msg.seqId}: "${msg.text}" (duration: ${msg.duration}ms)`);
        }
      } catch (e) {}
    });

    listenerSockets[lang] = ws;
  }
  console.log('✅ All 4 listeners subscribed to multi-channel streams');

  await new Promise((r) => setTimeout(r, 500));

  // 3. Send a burst of 3 speech chunks with varying lengths:
  // Chunk 1: Very long sentence
  // Chunk 2: Very short sentence
  // Chunk 3: Medium sentence
  console.log('\n🎙️ Emitting 3 speech chunks in rapid succession...');

  hostWs.send(JSON.stringify({
    type: 'SPEECH_CHUNK_TEXT',
    roomId: ROOM_ID,
    text: 'Bienvenidos a la conferencia magistral de inteligencia artificial y traducción en tiempo real 2026.',
    sourceLanguage: 'es'
  }));

  hostWs.send(JSON.stringify({
    type: 'SPEECH_CHUNK_TEXT',
    roomId: ROOM_ID,
    text: 'Gracias por asistir.',
    sourceLanguage: 'es'
  }));

  hostWs.send(JSON.stringify({
    type: 'SPEECH_CHUNK_TEXT',
    roomId: ROOM_ID,
    text: 'Los participantes pueden escuchar la traducción en sus auriculares sin interrupciones.',
    sourceLanguage: 'es'
  }));

  console.log('⏳ Waiting for sequential processing and audio broadcast...');
  await new Promise((r) => setTimeout(r, 6000));

  // 4. Verification Check
  console.log('\n--- Sequence & Order Verification ---');
  let testPassed = true;

  for (const lang of languages) {
    const packets = receivedPackets[lang];
    console.log(`\nChannel [${lang.toUpperCase()}]: Total packets received = ${packets.length}`);
    if (packets.length < 3) {
      console.error(`❌ Channel [${lang.toUpperCase()}] received fewer than 3 packets!`);
      testPassed = false;
      continue;
    }

    const seqIds = packets.map(p => p.seqId);
    console.log(`Received sequence IDs: [${seqIds.join(', ')}]`);

    // Verify strict sequential ordering: seqId must be strictly increasing: [1, 2, 3]
    if (seqIds[0] === 1 && seqIds[1] === 2 && seqIds[2] === 3) {
      console.log(`✅ Channel [${lang.toUpperCase()}] packets delivered in PERFECT CHRONOLOGICAL ORDER!`);
    } else {
      console.error(`❌ Channel [${lang.toUpperCase()}] out of order! Received: [${seqIds.join(', ')}]`);
      testPassed = false;
    }
  }

  // Cleanup
  hostWs.close();
  for (const lang of languages) listenerSockets[lang].close();
  server.close();

  if (testPassed) {
    console.log('\n🎉 ALL E2E SEQUENCING TESTS PASSED! Strict FIFO delivery verified.');
    process.exit(0);
  } else {
    console.error('\n❌ E2E test failed.');
    process.exit(1);
  }
}

runLiveE2ETest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
