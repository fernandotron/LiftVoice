import WebSocket from 'ws';

async function testRoomIsolation() {
  console.log('--- Testing Multi-Room Concurrency & Strict Room Isolation ---');
  const WS_URL = 'ws://localhost:3001';
  const ROOM_A = 'ROOM-ALPHA-2026';
  const ROOM_B = 'ROOM-BETA-2026';

  // 1. Connect Host for Room A
  const hostA = new WebSocket(WS_URL);
  await new Promise(r => hostA.on('open', r));
  hostA.send(JSON.stringify({ type: 'HOST_JOIN', roomId: ROOM_A }));

  // 2. Connect Host for Room B
  const hostB = new WebSocket(WS_URL);
  await new Promise(r => hostB.on('open', r));
  hostB.send(JSON.stringify({ type: 'HOST_JOIN', roomId: ROOM_B }));

  // 3. Connect Listener in Room A (English)
  const listenerA = new WebSocket(WS_URL);
  await new Promise(r => listenerA.on('open', r));
  listenerA.send(JSON.stringify({ type: 'LISTENER_JOIN', roomId: ROOM_A, lang: 'en' }));

  // 4. Connect Listener in Room B (Italian)
  const listenerB = new WebSocket(WS_URL);
  await new Promise(r => listenerB.on('open', r));
  listenerB.send(JSON.stringify({ type: 'LISTENER_JOIN', roomId: ROOM_B, lang: 'it' }));

  const roomAPacketsReceivedByA = [];
  const roomAPacketsReceivedByB = [];
  const roomBPacketsReceivedByA = [];
  const roomBPacketsReceivedByB = [];

  listenerA.on('message', data => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'TRANSCRIPT_EVENT' || msg.type === 'AUDIO_CHUNK') {
        const text = msg.item?.originalText || msg.text || '';
        if (text.includes('ALPHA')) roomAPacketsReceivedByA.push(text);
        if (text.includes('BETA')) roomBPacketsReceivedByA.push(text);
      }
    } catch (e) {}
  });

  listenerB.on('message', data => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'TRANSCRIPT_EVENT' || msg.type === 'AUDIO_CHUNK') {
        const text = msg.item?.originalText || msg.text || '';
        if (text.includes('ALPHA')) roomAPacketsReceivedByB.push(text);
        if (text.includes('BETA')) roomBPacketsReceivedByB.push(text);
      }
    } catch (e) {}
  });

  await new Promise(r => setTimeout(r, 600));

  // Host A speaks message with "ALPHA"
  hostA.send(JSON.stringify({
    type: 'SPEECH_CHUNK_TEXT',
    roomId: ROOM_A,
    text: 'Mensaje exclusivo de la sala ALPHA',
    sourceLanguage: 'es'
  }));

  // Host B speaks message with "BETA"
  hostB.send(JSON.stringify({
    type: 'SPEECH_CHUNK_TEXT',
    roomId: ROOM_B,
    text: 'Mensaje confidencial de la sala BETA',
    sourceLanguage: 'es'
  }));

  await new Promise(r => setTimeout(r, 3500));

  console.log('Room A messages received by Listener A:', roomAPacketsReceivedByA.length);
  console.log('Room B messages leaked to Listener A:', roomBPacketsReceivedByA.length);
  console.log('Room B messages received by Listener B:', roomBPacketsReceivedByB.length);
  console.log('Room A messages leaked to Listener B:', roomAPacketsReceivedByB.length);

  let passed = true;
  if (roomAPacketsReceivedByA.length === 0) {
    console.error('❌ Listener A failed to receive Room A broadcast');
    passed = false;
  }
  if (roomBPacketsReceivedByB.length === 0) {
    console.error('❌ Listener B failed to receive Room B broadcast');
    passed = false;
  }
  if (roomBPacketsReceivedByA.length > 0) {
    console.error('❌ CRITICAL LEAK: Room B message was leaked to Listener A!');
    passed = false;
  }
  if (roomAPacketsReceivedByB.length > 0) {
    console.error('❌ CRITICAL LEAK: Room A message was leaked to Listener B!');
    passed = false;
  }

  hostA.close();
  hostB.close();
  listenerA.close();
  listenerB.close();

  if (passed) {
    console.log('✅ STRICT ROOM ISOLATION VERIFIED: Zero cross-talk and zero state contamination between rooms.');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

testRoomIsolation().catch(err => {
  console.error(err);
  process.exit(1);
});
