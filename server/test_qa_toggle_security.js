import WebSocket from 'ws';
import { strict as assert } from 'assert';

const SERVER_HTTP = 'http://localhost:3001';
const SERVER_WS = 'ws://localhost:3001';
const TEST_ROOM = 'TEST-QA-TOGGLE-' + Date.now();

console.log('🧪 Running LiftVoice E2E Q&A Toggle & Security Test for Room:', TEST_ROOM);

async function run() {
  const hostWs = new WebSocket(SERVER_WS);
  const listenerWs = new WebSocket(SERVER_WS);

  await Promise.all([
    new Promise(r => hostWs.on('open', r)),
    new Promise(r => listenerWs.on('open', r))
  ]);

  let hostToken = null;
  const listenerMessages = [];
  const hostMessages = [];

  hostWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      hostMessages.push(msg);
      if (msg.type === 'HOST_JOINED_SUCCESS' && msg.hostKey) {
        hostToken = msg.hostKey;
      }
    } catch (e) {}
  });

  listenerWs.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      listenerMessages.push(msg);
    } catch (e) {}
  });

  // 1. Host joins and creates room
  hostWs.send(JSON.stringify({
    type: 'HOST_JOIN',
    roomId: TEST_ROOM,
    title: 'Test Q&A Studio'
  }));

  // Wait for HOST_CONNECTED and token
  await new Promise(r => setTimeout(r, 400));
  assert(hostToken, 'Host must receive hostToken');
  console.log('  ✓ Host joined and authenticated with hostToken');

  // 2. Listener joins
  listenerWs.send(JSON.stringify({
    type: 'LISTENER_JOIN',
    roomId: TEST_ROOM,
    lang: 'es',
    attendeeId: 'att_tester_1',
    name: 'Oyente de Prueba'
  }));

  await new Promise(r => setTimeout(r, 400));
  console.log('  ✓ Listener joined room');

  // Check initial stats delivered to listener has qaEnabled: false
  const joinSuccess = listenerMessages.find(m => m.type === 'LISTENER_JOINED_SUCCESS');
  assert(joinSuccess, 'Listener must receive LISTENER_JOINED_SUCCESS');
  assert.equal(joinSuccess.stats?.qaEnabled, false, 'Initial qaEnabled in LISTENER_JOINED_SUCCESS must be false');
  console.log('  ✓ Initial listener stats confirm qaEnabled: false');

  // 3. Listener attempts to raise hand when qaEnabled is false
  listenerWs.send(JSON.stringify({
    type: 'AUDIENCE_RAISE_HAND',
    roomId: TEST_ROOM,
    attendeeId: 'att_tester_1',
    name: 'Oyente de Prueba',
    lang: 'es',
    questionText: '¿Puedo hacer una pregunta?'
  }));

  await new Promise(r => setTimeout(r, 400));
  const qaDisabledError = listenerMessages.find(m => m.type === 'ERROR' && m.code === 'QA_DISABLED');
  assert(qaDisabledError, 'Listener must receive ERROR with code QA_DISABLED');
  assert.equal(qaDisabledError.message, 'El ponente no ha habilitado todavía la opción de preguntas');
  console.log('  ✓ Listener hand raise blocked with QA_DISABLED and exact prompt message:', qaDisabledError.message);

  // 4. Host enables QA via WebSocket HOST_TOGGLE_QA
  hostWs.send(JSON.stringify({
    type: 'HOST_TOGGLE_QA',
    roomId: TEST_ROOM,
    enabled: true
  }));

  await new Promise(r => setTimeout(r, 400));
  const listenerQAConfigUpdated = listenerMessages.find(m => m.type === 'QA_CONFIG_UPDATED' && m.qaEnabled === true);
  assert(listenerQAConfigUpdated, 'Listener must receive QA_CONFIG_UPDATED event with qaEnabled: true');
  console.log('  ✓ Host enabled Q&A; Listener received instantaneous QA_CONFIG_UPDATED');

  // 5. Listener raises hand now that qaEnabled is true
  listenerWs.send(JSON.stringify({
    type: 'AUDIENCE_RAISE_HAND',
    roomId: TEST_ROOM,
    profile: {
      attendeeId: 'att_tester_1',
      name: 'Oyente de Prueba',
      lang: 'es',
      questionText: '¿Cuál es la dosis recomendada?'
    }
  }));

  await new Promise(r => setTimeout(r, 400));
  const handRaisedEvent = listenerMessages.find(m => m.type === 'QA_HAND_RAISE_CONFIRMED');
  assert(handRaisedEvent, 'Listener must receive QA_HAND_RAISE_CONFIRMED confirmation');
  console.log('  ✓ Listener successfully submitted question after host enabled Q&A');

  // 6. Test REST API endpoint POST /api/rooms/:roomId/qa-toggle
  // 6a. Without token -> 401
  const unauthRes = await fetch(`${SERVER_HTTP}/api/rooms/${TEST_ROOM}/qa-toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false })
  });
  assert.equal(unauthRes.status, 401, 'Unauthorized request must be 401');
  console.log('  ✓ REST security: Unauthenticated qa-toggle rejected with 401');

  // 6b. With host token -> 200
  const authRes = await fetch(`${SERVER_HTTP}/api/rooms/${TEST_ROOM}/qa-toggle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-token': hostToken
    },
    body: JSON.stringify({ enabled: false })
  });
  assert.equal(authRes.status, 200, 'Authorized request must return 200');
  const authData = await authRes.json();
  assert.equal(authData.success, true);
  assert.equal(authData.qaEnabled, false);
  console.log('  ✓ REST security: Authenticated host toggled Q&A to false');

  // 7. Verify listener hand raise is blocked again
  listenerWs.send(JSON.stringify({
    type: 'AUDIENCE_RAISE_HAND',
    roomId: TEST_ROOM,
    profile: {
      attendeeId: 'att_tester_2',
      name: 'Oyente 2',
      lang: 'es',
      questionText: 'Pregunta tardía'
    }
  }));

  await new Promise(r => setTimeout(r, 400));
  const errorsAfterPause = listenerMessages.filter(m => m.type === 'ERROR' && m.code === 'QA_DISABLED');
  assert.equal(errorsAfterPause.length, 2, 'Listener must receive second QA_DISABLED error');
  console.log('  ✓ Listener blocked again after host paused Q&A via REST');

  // Clean up
  hostWs.close();
  listenerWs.close();

  console.log('\n🎉 ALL E2E Q&A TOGGLE & SECURITY TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ E2E TEST FAILED:', err);
  process.exit(1);
});
