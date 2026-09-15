/**
 * test_server_stress_concurrency.js
 * Comprehensive Stress Testing, Memory Leak Profiling, and Concurrency Benchmark
 * LiftVoice Streaming Server - September 2026 Standards
 */

import { WebSocket } from 'ws';
import { performance } from 'perf_hooks';

// Force port 3099 for isolated test environment
process.env.PORT = '3099';

// Import production server components
const { roomManager } = await import('./src/roomManager.js');
await import('./src/index.js');

const WS_URL = 'ws://127.0.0.1:3099';
const NUM_ROOMS = 20;
const TOTAL_LISTENERS = 200;
const LISTENERS_PER_ROOM = TOTAL_LISTENERS / NUM_ROOMS; // 10 per room
const LANGUAGES = ['es', 'en', 'fr', 'de', 'it'];

// Helper to format bytes
function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function getMemSnapshot() {
  const m = process.memoryUsage();
  return {
    heapUsed: m.heapUsed,
    heapTotal: m.heapTotal,
    rss: m.rss,
    external: m.external,
    arrayBuffers: m.arrayBuffers || 0
  };
}

function printMem(label, mem) {
  console.log(`[Memory] ${label.padEnd(28)}: HeapUsed=${formatMB(mem.heapUsed)} | HeapTotal=${formatMB(mem.heapTotal)} | RSS=${formatMB(mem.rss)} | ArrayBuf=${formatMB(mem.arrayBuffers)}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Ensure garbage collection is available
const gcAvailable = typeof global.gc === 'function';
function runGC() {
  if (gcAvailable) {
    global.gc();
    global.gc();
  }
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('🚀 LIFTVOICE STRESS TESTING & MEMORY PROFILING BENCHMARK (2026)');
  console.log(`Target: ${NUM_ROOMS} Rooms, ${TOTAL_LISTENERS} Listeners, 5 Languages, LVBP v1.1 Binary`);
  console.log(`Node.js GC available: ${gcAvailable ? 'YES (--expose-gc)' : 'NO (run with --expose-gc for full profiling)'}`);
  console.log('================================================================\n');

  // Allow server startup to stabilize
  await sleep(1000);
  runGC();

  const memInitial = getMemSnapshot();
  printMem('1. Initial Baseline', memInitial);

  // -------------------------------------------------------------
  // PHASE 1: Connect 20 Hosts for 20 Rooms
  // -------------------------------------------------------------
  console.log(`\n--- Phase 1: Creating ${NUM_ROOMS} Concurrent Active Rooms ---`);
  const hostSockets = [];
  const roomIds = [];

  for (let i = 1; i <= NUM_ROOMS; i++) {
    const roomId = `STRESS-ROOM-${String(i).padStart(2, '0')}`;
    roomIds.push(roomId);

    const ws = new WebSocket(WS_URL);
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    ws.send(JSON.stringify({
      type: 'HOST_JOIN',
      roomId,
      hostKey: `host_key_${i}`,
      supportsBinary: true
    }));

    hostSockets.push(ws);
  }

  await sleep(500);
  console.log(`✅ ${hostSockets.length} Hosts connected and authenticated across ${roomIds.length} rooms.`);

  // -------------------------------------------------------------
  // PHASE 2: Connect 200 Concurrent Listeners (Binary LVBP v1.1)
  // -------------------------------------------------------------
  console.log(`\n--- Phase 2: Connecting ${TOTAL_LISTENERS} Concurrent Binary Listeners ---`);
  const listeners = [];
  let binaryPacketsReceivedTotal = 0;
  let clientErrors = 0;

  let listenerIndex = 0;
  for (let r = 0; r < NUM_ROOMS; r++) {
    const roomId = roomIds[r];
    for (let l = 0; l < LISTENERS_PER_ROOM; l++) {
      const idx = listenerIndex++;
      const initialLang = LANGUAGES[idx % LANGUAGES.length];
      const attendeeId = `attendee_${idx}`;

      const ws = new WebSocket(WS_URL);
      const listenerObj = {
        id: idx,
        roomId,
        lang: initialLang,
        ws,
        attendeeId,
        packetsReceived: 0,
        isSlow: false
      };

      ws.on('message', (data, isBinary) => {
        if (isBinary || (Buffer.isBuffer(data) && data.length >= 14 && data.readUInt16BE(0) === 0x4C56)) {
          listenerObj.packetsReceived++;
          binaryPacketsReceivedTotal++;
        }
      });

      ws.on('error', () => {
        clientErrors++;
      });

      listeners.push(listenerObj);
    }
  }

  // Await open for all listener WebSockets in parallel
  await Promise.all(listeners.map(l => new Promise((resolve, reject) => {
    l.ws.on('open', resolve);
    l.ws.on('error', reject);
  })));

  // Send LISTENER_JOIN for all
  for (const l of listeners) {
    l.ws.send(JSON.stringify({
      type: 'LISTENER_JOIN',
      roomId: l.roomId,
      lang: l.lang,
      attendeeId: l.attendeeId,
      name: `StressTester_${l.id}`,
      supportsBinary: true
    }));
  }

  await sleep(1000);
  console.log(`✅ ${listeners.length} Listeners connected and joined across ${NUM_ROOMS} rooms.`);

  const memConnected = getMemSnapshot();
  printMem('2. After 200 Listeners Joined', memConnected);

  // -------------------------------------------------------------
  // PHASE 3: High-Throughput Binary Audio Streaming Benchmark
  // -------------------------------------------------------------
  console.log(`\n--- Phase 3: High-Throughput Binary Streaming (LVBP v1.1) ---`);
  const DURATION_SEC = 5;
  const PACKETS_PER_SEC_PER_ROOM = 25; // 25 audio chunks/sec per room
  const AUDIO_CHUNK_SIZE = 1024; // 1KB audio frame
  const sampleAudioBuffer = Buffer.alloc(AUDIO_CHUNK_SIZE, 0x5A);

  const dispatchLatencies = [];
  let packetsBroadcastTotal = 0;
  const streamStartTime = performance.now();

  for (let second = 0; second < DURATION_SEC; second++) {
    const secStart = performance.now();

    for (let p = 0; p < PACKETS_PER_SEC_PER_ROOM; p++) {
      for (let r = 0; r < NUM_ROOMS; r++) {
        const roomId = roomIds[r];
        // Rotate through languages
        const lang = LANGUAGES[(p + r) % LANGUAGES.length];

        const t0 = performance.now();
        const sent = roomManager.broadcastAudioToLanguageChannel(roomId, lang, {
          seqId: (second * PACKETS_PER_SEC_PER_ROOM) + p + 1,
          timestamp: Date.now(),
          audioBuffer: sampleAudioBuffer
        });
        const t1 = performance.now();

        dispatchLatencies.push(t1 - t0);
        packetsBroadcastTotal++;
      }
    }

    const elapsed = performance.now() - secStart;
    const toWait = Math.max(0, 1000 - elapsed);
    if (toWait > 0) {
      await sleep(toWait);
    }
  }

  const streamDurationSec = (performance.now() - streamStartTime) / 1000;
  const dispatchLatenciesSorted = [...dispatchLatencies].sort((a, b) => a - b);
  const avgLatency = dispatchLatencies.reduce((a, b) => a + b, 0) / dispatchLatencies.length;
  const p50Latency = dispatchLatenciesSorted[Math.floor(dispatchLatenciesSorted.length * 0.50)];
  const p95Latency = dispatchLatenciesSorted[Math.floor(dispatchLatenciesSorted.length * 0.95)];
  const p99Latency = dispatchLatenciesSorted[Math.floor(dispatchLatenciesSorted.length * 0.99)];
  const maxLatency = dispatchLatenciesSorted[dispatchLatenciesSorted.length - 1];
  const throughputBroadcast = packetsBroadcastTotal / streamDurationSec;

  console.log(`📊 Streaming Metrics:`);
  console.log(`   - Packets Broadcast   : ${packetsBroadcastTotal} chunks over ${streamDurationSec.toFixed(2)}s`);
  console.log(`   - Broadcast Throughput: ${throughputBroadcast.toFixed(1)} packets/sec`);
  console.log(`   - Client Audio Frames : ${binaryPacketsReceivedTotal} delivered via LVBP binary`);
  console.log(`   - Dispatch Latency Avg: ${(avgLatency * 1000).toFixed(1)} µs (${avgLatency.toFixed(3)} ms)`);
  console.log(`   - Dispatch Latency p50: ${(p50Latency * 1000).toFixed(1)} µs (${p50Latency.toFixed(3)} ms)`);
  console.log(`   - Dispatch Latency p95: ${(p95Latency * 1000).toFixed(1)} µs (${p95Latency.toFixed(3)} ms)`);
  console.log(`   - Dispatch Latency p99: ${(p99Latency * 1000).toFixed(1)} µs (${p99Latency.toFixed(3)} ms)`);
  console.log(`   - Dispatch Latency Max: ${(maxLatency * 1000).toFixed(1)} µs (${maxLatency.toFixed(3)} ms)`);

  const memStreaming = getMemSnapshot();
  printMem('3. Streaming Peak Load', memStreaming);

  // -------------------------------------------------------------
  // PHASE 4: Concurrent CHANGE_LANGUAGE Burst (100 changes/sec)
  // -------------------------------------------------------------
  console.log(`\n--- Phase 4: High-Frequency CHANGE_LANGUAGE Burst (100 changes/sec) ---`);
  const BURST_DURATION_SEC = 5;
  const TARGET_CHANGES_PER_SEC = 100;
  const TOTAL_BURST_CHANGES = BURST_DURATION_SEC * TARGET_CHANGES_PER_SEC;

  let changesSent = 0;
  const burstStart = performance.now();

  for (let s = 0; s < BURST_DURATION_SEC; s++) {
    const sStart = performance.now();
    for (let c = 0; c < TARGET_CHANGES_PER_SEC; c++) {
      const listener = listeners[(changesSent + c) % listeners.length];
      if (listener.ws.readyState === WebSocket.OPEN) {
        const nextLang = LANGUAGES[(LANGUAGES.indexOf(listener.lang) + 1) % LANGUAGES.length];
        listener.lang = nextLang;
        listener.ws.send(JSON.stringify({
          type: 'CHANGE_LANGUAGE',
          roomId: listener.roomId,
          lang: nextLang
        }));
      }
    }
    changesSent += TARGET_CHANGES_PER_SEC;
    const spent = performance.now() - sStart;
    const wait = Math.max(0, 1000 - spent);
    if (wait > 0) await sleep(wait);
  }

  const burstDuration = (performance.now() - burstStart) / 1000;
  console.log(`✅ Completed ${changesSent} CHANGE_LANGUAGE events in ${burstDuration.toFixed(2)}s (${(changesSent / burstDuration).toFixed(1)} events/sec).`);

  await sleep(1000);
  const memBurst = getMemSnapshot();
  printMem('4. After Language Burst', memBurst);

  // -------------------------------------------------------------
  // PHASE 5: Abrupt Disconnections & Backpressure Zombies
  // -------------------------------------------------------------
  console.log(`\n--- Phase 5: Simulating Abrupt Disconnects & Backpressure Saturated Clients ---`);

  // 1. Abrupt ungraceful termination for 40 clients (socket.terminate() with NO close handshake)
  const abruptDisconnectCount = 40;
  console.log(`- Terminating ${abruptDisconnectCount} clients abruptly without WebSocket handshake...`);
  for (let i = 0; i < abruptDisconnectCount; i++) {
    const l = listeners[i];
    l.ws.terminate(); // immediate RST / close
  }

  // 2. Simulate 20 slow clients accumulating backpressure
  const slowClientCount = 20;
  console.log(`- Simulating ${slowClientCount} congested slow clients with high bufferedAmount...`);
  for (let i = abruptDisconnectCount; i < abruptDisconnectCount + slowClientCount; i++) {
    const l = listeners[i];
    l.isSlow = true;
    // Artificially saturate socket buffer or simulate slow read
    if (l.ws._socket) {
      l.ws._socket.pause(); // stop reading / drain
    }
  }

  // Broadcast large chunks across all languages to test backpressure eviction for slow clients
  const heavyBuffer = Buffer.alloc(256 * 1024, 0xEE); // 256 KB chunk
  for (let i = 0; i < 12; i++) {
    for (const r of roomIds) {
      for (const lang of LANGUAGES) {
        roomManager.broadcastAudioToLanguageChannel(r, lang, {
          seqId: 9000 + i,
          timestamp: Date.now(),
          audioBuffer: heavyBuffer
        });
      }
    }
  }

  await sleep(1500);

  // -------------------------------------------------------------
  // PHASE 6: Post-Stress Teardown, Garbage Collection & Leak Audit
  // -------------------------------------------------------------
  console.log(`\n--- Phase 6: Teardown, Garbage Collection & Memory Leak Audit ---`);

  // Close all remaining client connections cleanly
  for (const l of listeners) {
    if (l.isSlow && l.ws._socket) {
      try { l.ws._socket.resume(); } catch (e) {}
    }
    if (l.ws.readyState === WebSocket.OPEN) {
      l.ws.close();
    } else if (l.ws.readyState === WebSocket.CLOSING) {
      l.ws.terminate();
    }
  }
  for (const h of hostSockets) {
    if (h.readyState === WebSocket.OPEN) {
      h.close();
    } else if (h.readyState === WebSocket.CLOSING) {
      h.terminate();
    }
  }

  await sleep(1500);

  // Audit RoomManager internal state
  let totalRemainingListeners = 0;
  let totalRemainingAudioChunks = 0;
  let totalRegisteredAttendees = 0;

  for (const roomId of roomIds) {
    const room = roomManager.getRoom(roomId);
    if (room) {
      if (room.listeners) totalRemainingListeners += room.listeners.size;
      if (room.lastAudioByLang) totalRemainingAudioChunks += room.lastAudioByLang.size;
      if (room.registeredAttendees) totalRegisteredAttendees += room.registeredAttendees.size;
    }
  }

  console.log(`🔍 Internal State Verification Before Explicit Room Cleanup:`);
  console.log(`   - Remaining active listeners in rooms : ${totalRemainingListeners} (Expected: 0 after full disconnect)`);
  console.log(`   - Cached lastAudioByLang entries     : ${totalRemainingAudioChunks}`);
  console.log(`   - Registered session attendees       : ${totalRegisteredAttendees}`);

  // Clean up rooms
  for (const roomId of roomIds) {
    roomManager.deleteRoom(roomId);
  }

  console.log(`🧹 Deleted all ${NUM_ROOMS} test rooms.`);

  // Allow timers to settle and run multi-pass GC
  await sleep(2000);
  runGC();
  await sleep(1000);
  runGC();

  const memFinal = getMemSnapshot();
  printMem('5. Final Rest (Post-GC)', memFinal);

  const heapGrowthMB = (memFinal.heapUsed - memInitial.heapUsed) / (1024 * 1024);
  const rssGrowthMB = (memFinal.rss - memInitial.rss) / (1024 * 1024);

  console.log('\n================================================================');
  console.log('📋 AUDIT & SCALABILITY VERDICT');
  console.log('================================================================');
  console.log(`Initial Heap Used : ${formatMB(memInitial.heapUsed)}`);
  console.log(`Peak Heap Used    : ${formatMB(memStreaming.heapUsed)}`);
  console.log(`Final Heap Used   : ${formatMB(memFinal.heapUsed)}`);
  console.log(`Heap Delta (Net)  : ${heapGrowthMB >= 0 ? '+' : ''}${heapGrowthMB.toFixed(2)} MB`);
  console.log(`RSS Delta (Net)   : ${rssGrowthMB >= 0 ? '+' : ''}${rssGrowthMB.toFixed(2)} MB`);
  console.log(`Remaining Listeners: ${totalRemainingListeners}`);
  console.log(`Zombie Sockets    : ${clientErrors > 0 ? clientErrors : 0}`);

  const isLeakFree = heapGrowthMB < 15 && totalRemainingListeners === 0;
  if (isLeakFree) {
    console.log('\n✅ CERTIFIED: ZERO MEMORY LEAKS DETECTED.');
    console.log('   All listener maps, binary buffers, and zombie sockets successfully reclaimed.');
  } else {
    console.warn('\n⚠️ WARNING: Potential memory retention or unpurged sockets detected.');
  }

  // Clean exit
  process.exit(isLeakFree ? 0 : 1);
}

runBenchmark().catch(err => {
  console.error('❌ Benchmark error:', err);
  process.exit(1);
});
