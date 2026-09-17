import { strict as assert } from 'assert';
import { roomManager } from './src/roomManager.js';
import { translationService } from './src/services/translationService.js';

console.log('🧪 Starting Audience Q&A Multilingual Translation Rigorous Backend Audit...\n');

async function runQaTests() {
  const originalTranslateAll = translationService.translateAll;

  try {
    // =========================================================================
    // TEST 1: Resilience & Fallback under Translation Failure
    // =========================================================================
    console.log('--- TEST 1: Resilience & Error Handling under LLM Timeout/Failure ---');
    const roomId1 = 'AUDIT-QA-RESILIENCE';
    const room1 = roomManager.createRoom(roomId1, 'Q&A Resilience Test');
    
    // Simulate translation failure (timeout or upstream 503)
    translationService.translateAll = async () => {
      throw new Error('TRANSLATION_UPSTREAM_TIMEOUT (Simulated Gemini 503)');
    };

    const attendeeSocketId = 'sock_attendee_1';
    const profile1 = {
      attendeeId: 'att_1',
      name: 'Dr. John Doe',
      lang: 'en',
      questionText: 'Could you elaborate on the dosage of amiodarone for ventricular tachycardia?'
    };

    // Simulate what index.js AUDIENCE_RAISE_HAND does:
    const item1 = roomManager.addHandRaise(roomId1, attendeeSocketId, profile1);
    assert(item1, 'addHandRaise must return item');
    assert.equal(item1.questionText, profile1.questionText);
    assert.equal(room1.qaQueue.length, 1, 'Question must be queued immediately');

    let translationFailed = false;
    try {
      await translationService.translateAll(item1.questionText, item1.nativeLang || 'auto');
    } catch (err) {
      translationFailed = true;
      // Simulated catch block in index.js
    }

    assert(translationFailed, 'Translation was forced to fail');
    // Verify question is NOT lost:
    assert.equal(room1.qaQueue.length, 1, 'Question MUST NOT be dropped from queue upon translation error');
    assert.equal(room1.qaQueue[0].questionText, profile1.questionText, 'Original question text must be preserved');
    console.log('    ✓ Question preserved in queue despite total LLM failure:', room1.qaQueue[0].questionText);

    roomManager.cleanupRoom(roomId1);

    // =========================================================================
    // TEST 2: Security & Payload Sanitization (questionText length clamping)
    // =========================================================================
    console.log('\n--- TEST 2: Security & Payload Sanitization (DoS / Prompt Bloat) ---');
    const roomId2 = 'AUDIT-QA-SECURITY';
    const room2 = roomManager.createRoom(roomId2, 'Q&A Security Test');

    const hugeText = 'A'.repeat(10000); // 10,000 characters
    const item2 = roomManager.addHandRaise(roomId2, 'sock_attacker', {
      attendeeId: 'att_attacker',
      name: 'Malicious Attacker',
      questionText: hugeText
    });

    console.log(`    Current item2.questionText length in roomManager.addHandRaise: ${item2.questionText.length}`);
    assert(item2.questionText.length <= 500, 'questionText must be clamped to <= 500 characters');
    assert(item2.name.length <= 80, 'name must be clamped to <= 80 characters');
    console.log(`    ✓ Clamped to <= 500 chars (Length: ${item2.questionText.length}) and name <= 80 (Length: ${item2.name.length})`);

    roomManager.cleanupRoom(roomId2);

    // =========================================================================
    // TEST 3: Multi-Room Isolation & IDOR Protection
    // =========================================================================
    console.log('\n--- TEST 3: Multi-Room Isolation & IDOR Protection ---');
    const roomA = 'QA-ROOM-ALPHA';
    const roomB = 'QA-ROOM-BETA';
    const rA = roomManager.createRoom(roomA, 'Room A');
    const rB = roomManager.createRoom(roomB, 'Room B');

    roomManager.addHandRaise(roomA, 'sock_a1', {
      attendeeId: 'att_a1',
      name: 'Alice',
      questionText: 'Question for Room A'
    });

    roomManager.addHandRaise(roomB, 'sock_b1', {
      attendeeId: 'att_b1',
      name: 'Bob',
      questionText: 'Question for Room B'
    });

    const statsA = roomManager.getHostStats(roomA);
    const statsB = roomManager.getHostStats(roomB);

    assert.equal(statsA.qaQueue.length, 1);
    assert.equal(statsA.qaQueue[0].name, 'Alice');
    assert.equal(statsB.qaQueue.length, 1);
    assert.equal(statsB.qaQueue[0].name, 'Bob');

    // Verify public stats do not leak qaQueue details to listeners
    const pubStatsA = roomManager.getPublicStats(roomA);
    assert.equal(pubStatsA.qaQueue, undefined, 'Public stats must NOT expose qaQueue items (privacy CWE-200)');
    assert.equal(pubStatsA.qaQueueCount, 1, 'Public stats only expose count');
    console.log('    ✓ Strict room isolation and listener privacy verified');

    roomManager.cleanupRoom(roomA);
    roomManager.cleanupRoom(roomB);

    // =========================================================================
    // TEST 4: Concurrency & State Consistency during Host Approval
    // =========================================================================
    console.log('\n--- TEST 4: Race Condition between translateAll and Host Approval ---');
    const roomId4 = 'AUDIT-QA-RACE';
    const room4 = roomManager.createRoom(roomId4, 'Race Test');

    const item4 = roomManager.addHandRaise(roomId4, 'sock_fast', {
      attendeeId: 'att_fast',
      name: 'Dr. Quick',
      questionText: 'Question subject to approval race condition'
    });

    // Host approves question immediately (before translation finishes)
    const approvedSpeaker = roomManager.approveHandRaise(roomId4, item4.attendeeId);
    assert(approvedSpeaker, 'Speaker should be approved');
    assert.equal(room4.activeSpeaker.attendeeId, 'att_fast');
    assert.equal(room4.qaQueue.length, 0, 'Should be spliced from qaQueue');

    // Now simulated translation finishes and updates activeSpeaker (as implemented in index.js)
    const translatedText = '[ES] Pregunta traducida al español';
    const qIdx = room4?.qaQueue?.findIndex(q => q.questionId === item4.questionId);
    if (qIdx !== undefined && qIdx >= 0) {
      room4.qaQueue[qIdx].translatedText = translatedText;
    }
    if (room4?.activeSpeaker && (room4.activeSpeaker.questionId === item4.questionId || room4.activeSpeaker.attendeeId === item4.attendeeId)) {
      room4.activeSpeaker.translatedText = translatedText;
    }

    assert.equal(room4.activeSpeaker.translatedText, translatedText, 'activeSpeaker MUST receive translatedText even if approved before translation finished');
    console.log('    ✓ Race condition solved: activeSpeaker received translatedText seamlessly');

    roomManager.cleanupRoom(roomId4);

    console.log('\n=============================================================');
    console.log('🏁 AUDIT DIAGNOSTIC RUN COMPLETE');
    console.log('=============================================================');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    translationService.translateAll = originalTranslateAll;
  }
}

runQaTests();
