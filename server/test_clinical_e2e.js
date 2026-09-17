/**
 * Standalone Automated E2E Clinical Pipeline Verification Test
 * 
 * Verifies:
 * 1. Configuration API: POST /api/config with medicalMode, medicalSpecialty, customGlossary & GET /api/config.
 * 2. Lexical Verification of translationService: Real clinical cases in Spanish translated to EN, IT, PT
 *    with verbatim preservation of critical acronyms (ECG, SpO2, ST, IAM, TVP, Glasgow) and pharmacology.
 * 3. Cache Partitioning: Non-medical vs medical mode LRU cache key isolation and non-contamination.
 * 4. End-to-End WebSocket Pipeline: Emulates host & multi-channel listeners with medicalMode: true,
 *    verifying broadcast transcript events, audio packets with clinical flag, and latency metrics.
 */

import 'dotenv/config';
import WebSocket from 'ws';
import assert from 'assert';
import { translationService } from './src/services/translationService.js';

const BASE_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function reportTest(name, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✅ [PASS] ${name}${details ? ` (${details})` : ''}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name}${details ? ` (${details})` : ''}`);
  }
}

async function runAllClinicalTests() {
  console.log('================================================================');
  console.log(' 🩺 LiftVoice Clinical Mode & Medical AI Pipeline E2E Verification');
  console.log('================================================================\n');

  // ==========================================================================
  // AREA 1: CONFIGURATION API (/api/config)
  // ==========================================================================
  console.log('--- Area 1: Configuration API Verification (/api/config) ---');
  let adminToken = null;

  try {
    // 1.1 Admin Authentication
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || 'liftvoice_admin' })
    });
    const loginData = await loginRes.json();
    adminToken = loginData.token;
    reportTest('Admin Authentication for /api/config modification', Boolean(adminToken), `Token issued: ${adminToken ? 'OK' : 'NONE'}`);

    // 1.2 POST /api/config with medicalMode, cardiology, customGlossary
    const customGlossaryPayload = ['SpO2', 'ECG', 'amiodarona', 'enoxaparina', 'troponina', 'IAM'];
    const postConfigRes = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        medicalMode: true,
        medicalSpecialty: 'cardiology',
        customGlossary: customGlossaryPayload
      })
    });
    const postResult = await postConfigRes.json();
    reportTest('POST /api/config accepts clinical configuration', postConfigRes.status === 200 && postResult.success === true, `Status: ${postConfigRes.status}`);

    // 1.3 GET /api/config returns medicalMode, medicalSpecialty, customGlossary
    const getConfigRes = await fetch(`${BASE_URL}/api/config`);
    const configData = await getConfigRes.json();
    
    const medModeOk = configData.medicalMode === true;
    const specialtyOk = configData.medicalSpecialty === 'cardiology';
    const glossaryOk = Array.isArray(configData.customGlossary) &&
      customGlossaryPayload.every(term => configData.customGlossary.includes(term));

    reportTest('GET /api/config returns medicalMode: true', medModeOk, `Value: ${configData.medicalMode}`);
    reportTest('GET /api/config returns medicalSpecialty: "cardiology"', specialtyOk, `Specialty: ${configData.medicalSpecialty}`);
    reportTest('GET /api/config returns customGlossary correctly populated', glossaryOk, `Count: ${configData.customGlossary?.length || 0} terms`);

    // 1.4 Unauthorized access block on POST /api/config (Security Guard)
    const unauthorizedRes = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicalMode: false })
    });
    reportTest('POST /api/config rejects unauthenticated request (401)', unauthorizedRes.status === 401, `Status: ${unauthorizedRes.status}`);
  } catch (err) {
    reportTest('Area 1 Configuration API execution', false, err.message);
  }

  // ==========================================================================
  // AREA 2: LEXICAL VERIFICATION OF translationService (CLINICAL ACCURACY)
  // ==========================================================================
  console.log('\n--- Area 2: Lexical Accuracy & Medical Terminology Preservation ---');

  const customGlossary = ['SpO2', 'ECG', 'amiodarona', 'enoxaparina', 'troponina', 'IAM'];
  translationService.setMedicalConfig({
    medicalMode: true,
    medicalSpecialty: 'cardiology',
    customGlossary
  });

  // Clinical Phrase 1
  const phrase1 = 'Paciente de 62 años ingresa con dolor torácico opresivo, elevación del segmento ST en el ECG, SpO2 al 89% y sospecha de IAM. Se pauta enoxaparina sódica y amiodarona intravenosa.';
  console.log(`\n  [Case 1 Input (ES)]: "${phrase1}"`);

  try {
    const t0 = Date.now();
    const res1 = await translationService.translateAll(phrase1, 'es', {
      medicalMode: true,
      medicalSpecialty: 'cardiology',
      customGlossary
    });
    const lat1 = Date.now() - t0;
    console.log(`  [Case 1 Engine]: ${res1.engineUsed} (${lat1}ms)`);
    console.log(`    EN: "${res1.translations.en}"`);
    console.log(`    IT: "${res1.translations.it}"`);
    console.log(`    PT: "${res1.translations.pt}"`);

    // Acronym preservation checks for Phrase 1
    const acronymsP1 = ['ECG', 'SpO2', 'ST', 'IAM'];
    for (const targetLang of ['en', 'it', 'pt']) {
      const text = res1.translations[targetLang] || '';
      for (const acr of acronymsP1) {
        const hasAcr = new RegExp(`\\b${acr}\\b`).test(text);
        reportTest(`Case 1 [${targetLang.toUpperCase()}] preserves verbatim acronym "${acr}"`, hasAcr, `Matched in ${targetLang.toUpperCase()}`);
      }

      // Pharmacology checks
      if (targetLang === 'en') {
        const hasEnoxaparin = /enoxaparin/i.test(text);
        const hasAmiodarone = /amiodarone/i.test(text);
        reportTest('Case 1 [EN] preserves pharmacology "enoxaparin"', hasEnoxaparin);
        reportTest('Case 1 [EN] preserves pharmacology "amiodarone"', hasAmiodarone);
      } else if (targetLang === 'it') {
        const hasEnoxaparina = /enoxaparina/i.test(text);
        const hasAmiodaroneOrA = /amiodaron[ea]/i.test(text);
        reportTest('Case 1 [IT] preserves pharmacology "enoxaparina"', hasEnoxaparina);
        reportTest('Case 1 [IT] preserves pharmacology "amiodarone / amiodarona"', hasAmiodaroneOrA);
      } else if (targetLang === 'pt') {
        const hasEnoxaparina = /enoxaparina/i.test(text);
        const hasAmiodarona = /amiodarona/i.test(text);
        reportTest('Case 1 [PT] preserves pharmacology "enoxaparina"', hasEnoxaparina);
        reportTest('Case 1 [PT] preserves pharmacology "amiodarona"', hasAmiodarona);
      }
    }
  } catch (err) {
    reportTest('Case 1 Clinical Translation Execution', false, err.message);
  }

  // Clinical Phrase 2
  const phrase2 = 'Presenta shock cardiogénico refractario con escala de coma de Glasgow 11 y sospecha de TVP.';
  console.log(`\n  [Case 2 Input (ES)]: "${phrase2}"`);

  try {
    const t0 = Date.now();
    const res2 = await translationService.translateAll(phrase2, 'es', {
      medicalMode: true,
      medicalSpecialty: 'cardiology',
      customGlossary
    });
    const lat2 = Date.now() - t0;
    console.log(`  [Case 2 Engine]: ${res2.engineUsed} (${lat2}ms)`);
    console.log(`    EN: "${res2.translations.en}"`);
    console.log(`    IT: "${res2.translations.it}"`);
    console.log(`    PT: "${res2.translations.pt}"`);

    // Acronym & Eponym preservation checks for Phrase 2
    for (const targetLang of ['en', 'it', 'pt']) {
      const text = res2.translations[targetLang] || '';
      const hasGlasgow = /\bGlasgow\b/.test(text);
      const hasTVP = /\bTVP\b/.test(text);
      reportTest(`Case 2 [${targetLang.toUpperCase()}] preserves verbatim eponym "Glasgow"`, hasGlasgow);
      reportTest(`Case 2 [${targetLang.toUpperCase()}] preserves verbatim acronym "TVP"`, hasTVP);
    }
  } catch (err) {
    reportTest('Case 2 Clinical Translation Execution', false, err.message);
  }

  // ==========================================================================
  // AREA 3: CACHE PARTITIONING (medicalMode: false vs medicalMode: true)
  // ==========================================================================
  console.log('\n--- Area 3: Translation LRU Cache Key Partitioning ---');

  try {
    const testSentence = 'El paciente presenta estabilidad hemodinámica.';
    const cache = translationService.cache;

    // 3.1 Verify cache keys are distinct
    const keyStandard = cache._makeKey(testSentence, 'es', 'cardiology', [], 'ROOM_TEST', false);
    const keyClinical = cache._makeKey(testSentence, 'es', 'cardiology', [], 'ROOM_TEST', true);

    const keysDistinct = keyStandard !== keyClinical;
    const hasMedFalse = keyStandard.includes('med:false');
    const hasMedTrue = keyClinical.includes('med:true');

    reportTest('Cache key generator produces distinct keys for standard vs clinical', keysDistinct);
    reportTest('Standard cache key incorporates med:false partition flag', hasMedFalse, keyStandard);
    reportTest('Clinical cache key incorporates med:true partition flag', hasMedTrue, keyClinical);

    // 3.2 Verify no cross-contamination between partitions
    const mockStandardValue = {
      detectedSource: 'es',
      translations: { en: 'Standard translation output', it: 'Traduzione standard', pt: 'Tradução padrão' },
      engineUsed: 'Standard Engine',
      latencyMs: 12
    };

    const mockClinicalValue = {
      detectedSource: 'es',
      translations: { en: 'Clinical high-accuracy output', it: 'Traduzione clinica', pt: 'Tradução clínica' },
      engineUsed: 'Clinical Engine',
      latencyMs: 15
    };

    // Store both entries for the same sentence
    cache.set(testSentence, 'es', 'cardiology', [], mockStandardValue, 'ROOM_TEST', false);
    cache.set(testSentence, 'es', 'cardiology', [], mockClinicalValue, 'ROOM_TEST', true);

    // Retrieve both entries independently
    const retrievedStandard = cache.get(testSentence, 'es', 'cardiology', [], 'ROOM_TEST', false);
    const retrievedClinical = cache.get(testSentence, 'es', 'cardiology', [], 'ROOM_TEST', true);

    const standardIntact = retrievedStandard?.translations?.en === mockStandardValue.translations.en;
    const clinicalIntact = retrievedClinical?.translations?.en === mockClinicalValue.translations.en;
    const noOverwrite = retrievedStandard?.translations?.en !== retrievedClinical?.translations?.en;

    reportTest('Standard cache entry retrieved without clinical contamination', standardIntact);
    reportTest('Clinical cache entry retrieved without standard contamination', clinicalIntact);
    reportTest('Cache partitions remain strictly isolated without mutual overwrite', noOverwrite);
  } catch (err) {
    reportTest('Area 3 Cache Partitioning Execution', false, err.message);
  }

  // ==========================================================================
  // AREA 4: WEBSOCKET E2E PIPELINE WITH CLINICAL MODE
  // ==========================================================================
  console.log('\n--- Area 4: End-to-End WebSocket Real-Time Pipeline ---');

  const testRoomId = `CLINICAL-ROOM-${Date.now()}`;
  let hostSocket = null;
  const listenerSockets = {};
  const receivedTranscripts = { en: null, it: null, pt: null };
  const receivedAudioChunks = { en: null, it: null, pt: null };

  try {
    // 4.1 Host connects and joins with medicalMode: true
    hostSocket = new WebSocket(WS_URL);
    await new Promise((resolve, reject) => {
      hostSocket.on('open', resolve);
      hostSocket.on('error', reject);
    });

    let hostJoinedSuccess = false;
    let hostRoomMedicalMode = false;

    hostSocket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'HOST_JOINED_SUCCESS') {
          hostJoinedSuccess = true;
          hostRoomMedicalMode = msg.medicalMode;
        }
      } catch (e) {}
    });

    hostSocket.send(JSON.stringify({
      type: 'HOST_JOIN',
      roomId: testRoomId,
      medicalMode: true,
      medicalSpecialty: 'cardiology',
      customGlossary: ['SpO2', 'ECG', 'IAM', 'amiodarona', 'enoxaparina']
    }));

    // Wait for host connection confirmation
    const hostWaitStart = Date.now();
    while (!hostJoinedSuccess && Date.now() - hostWaitStart < 3000) {
      await new Promise(r => setTimeout(r, 100));
    }
    reportTest('Host connected and joined room with medicalMode: true', hostJoinedSuccess && hostRoomMedicalMode);

    // 4.2 Connect Listeners for EN, IT, PT
    const targetLangs = ['en', 'it', 'pt'];
    for (const lang of targetLangs) {
      const ws = new WebSocket(WS_URL);
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'TRANSCRIPT_EVENT' && msg.item) {
            receivedTranscripts[lang] = msg.item;
          } else if (msg.type === 'AUDIO_CHUNK') {
            receivedAudioChunks[lang] = msg;
          }
        } catch (e) {}
      });

      ws.send(JSON.stringify({
        type: 'LISTENER_JOIN',
        roomId: testRoomId,
        lang
      }));

      listenerSockets[lang] = ws;
    }

    await new Promise(r => setTimeout(r, 600));
    reportTest('All 3 listener channels (EN, IT, PT) connected and subscribed', Object.keys(listenerSockets).length === 3);

    // 4.3 Host broadcasts clinical speech utterance
    const clinicalUtterance = 'Paciente de 62 años ingresa con elevación del segmento ST en el ECG y sospecha de IAM.';
    console.log(`\n  🎙️ [Host WS] Broadcasting speech utterance: "${clinicalUtterance}"...`);

    const broadcastStart = Date.now();
    hostSocket.send(JSON.stringify({
      type: 'SPEECH_CHUNK_TEXT',
      roomId: testRoomId,
      text: clinicalUtterance,
      sourceLanguage: 'es',
      medicalMode: true,
      medicalSpecialty: 'cardiology',
      customGlossary: ['SpO2', 'ECG', 'IAM']
    }));

    // Wait for pipeline processing: Transcript Event & Audio Chunks
    console.log('  ⏳ Waiting for AI pipeline processing, multi-channel translation, and TTS broadcast...');
    const maxWait = 18000;
    while (Date.now() - broadcastStart < maxWait) {
      const allTranscripts = targetLangs.every(l => receivedTranscripts[l]);
      const allAudio = targetLangs.every(l => receivedAudioChunks[l]);
      if (allTranscripts && allAudio) break;
      await new Promise(r => setTimeout(r, 300));
    }

    const e2eLatency = Date.now() - broadcastStart;
    console.log(`  ⏱️ Total pipeline execution completed in ${e2eLatency}ms`);

    // 4.4 Verification of Received Packets
    for (const lang of targetLangs) {
      const trans = receivedTranscripts[lang];
      const audio = receivedAudioChunks[lang];

      // Transcript verification
      const transReceived = Boolean(trans);
      const transHasClinicalFlag = trans ? (trans.medicalMode === true || (trans.engineUsed && trans.engineUsed.includes('Clinical'))) : false;
      const transHasTranslation = trans?.translations?.[lang]?.length > 0;
      const transHasMetrics = Boolean(trans?.metrics && typeof trans.metrics.transMs === 'number');

      reportTest(`Listener [${lang.toUpperCase()}] received TRANSCRIPT_EVENT`, transReceived);
      reportTest(`Listener [${lang.toUpperCase()}] transcript flagged as Clinical Mode`, transHasClinicalFlag, `medicalMode=${trans?.medicalMode}, engine=${trans?.engineUsed}`);
      reportTest(`Listener [${lang.toUpperCase()}] transcript contains translation`, transHasTranslation, `Text: "${trans?.translations?.[lang]?.slice(0, 45)}..."`);
      reportTest(`Listener [${lang.toUpperCase()}] transcript includes latency metrics`, transHasMetrics, `transMs=${trans?.metrics?.transMs}ms`);

      // Audio packet verification
      const audioReceived = Boolean(audio);
      const audioHasClinicalFlag = audio ? (audio.medicalMode === true) : false;
      const audioHasData = audio ? Boolean(audio.audioBase64 || audio.useClientWebSpeech) : false;
      const audioHasLatency = audio ? (typeof audio.latencyMs === 'number') : false;

      reportTest(`Listener [${lang.toUpperCase()}] received AUDIO_CHUNK packet`, audioReceived);
      reportTest(`Listener [${lang.toUpperCase()}] audio packet has medicalMode flag`, audioHasClinicalFlag);
      reportTest(`Listener [${lang.toUpperCase()}] audio packet has valid payload data`, audioHasData);
      reportTest(`Listener [${lang.toUpperCase()}] audio packet includes synthesis latency`, audioHasLatency, `latencyMs=${audio?.latencyMs}ms`);
    }

  } catch (err) {
    reportTest('Area 4 WebSocket E2E Execution', false, err.message);
  } finally {
    // Teardown sockets
    if (hostSocket && hostSocket.readyState === 1) hostSocket.close();
    for (const ws of Object.values(listenerSockets)) {
      if (ws && ws.readyState === 1) ws.close();
    }
  }

  // ==========================================================================
  // TEST SUMMARY REPORT
  // ==========================================================================
  console.log('\n================================================================');
  console.log(' 📊 TEST EXECUTION SUMMARY');
  console.log('================================================================');
  console.log(`Total Assertions Evaluated : ${totalTests}`);
  console.log(`Passing Assertions        : ${passedTests}`);
  console.log(`Failing Assertions        : ${failedTests}`);
  console.log(`Success Rate              : ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error(`❌ VERIFICATION SUITE FAILED with ${failedTests} failure(s).`);
    process.exit(1);
  } else {
    console.log('🎉 ALL CLINICAL & REAL-TIME TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

runAllClinicalTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
