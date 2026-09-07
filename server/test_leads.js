import WebSocket from 'ws';

async function testWithAttendeeLeads() {
  console.log('--- Testing Pipeline with Attendee Registration & Leads Export ---');

  const WS_URL = 'ws://localhost:3001';
  const ROOM_ID = 'LEADS-EVENT-2026';

  // 1. Host Connects
  const hostWs = new WebSocket(WS_URL);
  await new Promise((r) => hostWs.on('open', r));
  hostWs.send(JSON.stringify({ type: 'HOST_JOIN', roomId: ROOM_ID }));

  // 2. Attendee Joins with Name, Email, Phone
  const attendeeWs = new WebSocket(WS_URL);
  await new Promise((r) => attendeeWs.on('open', r));
  attendeeWs.send(JSON.stringify({
    type: 'LISTENER_JOIN',
    roomId: ROOM_ID,
    lang: 'es',
    name: 'Carlos Mendoza',
    email: 'carlos@empresa.com',
    phone: '+34 612 345 678'
  }));

  await new Promise((r) => setTimeout(r, 600));

  // 3. Test REST CSV Export Endpoint
  const res = await fetch(`http://localhost:3001/api/rooms/${ROOM_ID}/export-csv`);
  const csvText = await res.text();
  console.log('\n📄 Downloaded CSV Lead Sheet Content:\n' + csvText);

  if (csvText.includes('Carlos Mendoza') && csvText.includes('carlos@empresa.com')) {
    console.log('\n✅ Attendee Lead Capture & CSV Export Verified Successfully!');
  } else {
    console.error('❌ Lead data not found in CSV.');
    process.exit(1);
  }

  hostWs.close();
  attendeeWs.close();
  process.exit(0);
}

testWithAttendeeLeads().catch((err) => {
  console.error(err);
  process.exit(1);
});
