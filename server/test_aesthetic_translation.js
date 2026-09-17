/**
 * Aesthetic Medicine & Conference Interpretation Verification Suite
 * LiftVoice Real-Time AI Translation Engine
 * 
 * Verifies:
 * 1. Configuration of medicalMode: true, medicalSpecialty: 'dermatology', and customGlossary
 * 2. Live translation of realistic aesthetic medicine conference statements into [EN, IT, PT]
 * 3. Commercial brand preservation ('Radiesse', 'Sculptra')
 * 4. Technical acronym verbatim preservation ('SMAS', 'PDO', '25G')
 * 5. Pharmacological & clinical terminology accuracy across EN, IT, PT
 * 6. Post-processing normalization and Cache Partitioning for dermatology
 */

import 'dotenv/config';
import { translationService, extractDetectedMedicalTerms, postProcessClinicalTerms } from './src/services/translationService.js';

let totalAssertions = 0;
let passingAssertions = 0;
let failingAssertions = 0;
const failureDetails = [];

function assertTest(name, condition, details = '') {
  totalAssertions++;
  if (condition) {
    passingAssertions++;
    console.log(`  ✅ [PASS] ${name}${details ? ` (${details})` : ''}`);
  } else {
    failingAssertions++;
    const msg = `  ❌ [FAIL] ${name}${details ? ` (${details})` : ''}`;
    console.error(msg);
    failureDetails.push(msg);
  }
}

async function runAestheticVerification() {
  console.log('================================================================================');
  console.log(' 💉 LiftVoice Aesthetic Medicine Conference Translation Verification');
  console.log('================================================================================\n');

  // ==========================================================================
  // AREA 1: CONFIGURATION & SETUP
  // ==========================================================================
  console.log('--- Area 1: Clinical Dermatology Configuration ---');
  const aestheticGlossary = [
    'ácido hialurónico',
    'toxina botulínica',
    'hialuronidasa',
    'Radiesse',
    'Sculptra',
    'SMAS',
    'PDO',
    'microcánula',
    '25G',
    'efecto Tyndall',
    'hidroxiapatita cálcica',
    'blanqueamiento cutáneo'
  ];

  translationService.setMedicalConfig({
    medicalMode: true,
    medicalSpecialty: 'dermatology',
    customGlossary: aestheticGlossary
  });

  assertTest('Medical mode activated', translationService.medicalMode === true, 'medicalMode: true');
  assertTest('Medical specialty set to dermatology', translationService.medicalSpecialty === 'dermatology', 'specialty: dermatology');
  assertTest('Aesthetic glossary populated', translationService.customGlossary.length === aestheticGlossary.length, `${aestheticGlossary.length} terms`);

  // ==========================================================================
  // AREA 2: LIVE CONFERENCE PHRASE 1 (Retroinyección, Ácido Hialurónico, 25G)
  // ==========================================================================
  console.log('\n--- Area 2: Live Conference Phrase 1 (Volumization / Temporal Fossa) ---');
  const phrase1 = 'Realizamos una retroinyección supraperióstica con ácido hialurónico de alta reticulación y microcánula 25G en la fosa temporal.';
  console.log(`  [Source ES]: "${phrase1}"`);

  try {
    const t0 = Date.now();
    const res1 = await translationService.translateAll(phrase1, 'es', {
      medicalMode: true,
      medicalSpecialty: 'dermatology',
      customGlossary: aestheticGlossary
    });
    const lat1 = Date.now() - t0;
    console.log(`  [Engine]: ${res1.engineUsed} (${lat1}ms)`);
    console.log(`    EN: "${res1.translations.en}"`);
    console.log(`    IT: "${res1.translations.it}"`);
    console.log(`    PT: "${res1.translations.pt}"`);

    // Pharmacology: ácido hialurónico
    assertTest('Phrase 1 [EN] translates "ácido hialurónico" -> "hyaluronic acid"',
      /hyaluronic acid/i.test(res1.translations.en), res1.translations.en);
    assertTest('Phrase 1 [IT] translates "ácido hialurónico" -> "acido ialuronico"',
      /acido ialuronico/i.test(res1.translations.it), res1.translations.it);
    assertTest('Phrase 1 [PT] translates "ácido hialurónico" -> "ácido hialurônico"',
      /ácido hialurônico/i.test(res1.translations.pt), res1.translations.pt);

    // Instrument: microcánula
    assertTest('Phrase 1 [EN] translates "microcánula" -> "microcannula"',
      /microcannula/i.test(res1.translations.en), res1.translations.en);
    assertTest('Phrase 1 [IT] translates "microcánula" -> "microcannula"',
      /microcannula/i.test(res1.translations.it), res1.translations.it);
    assertTest('Phrase 1 [PT] translates "microcánula" -> "microcânula"',
      /microcânula/i.test(res1.translations.pt), res1.translations.pt);

    // Technical Gauge: 25G verbatim preservation across all cabins
    for (const lang of ['en', 'it', 'pt']) {
      assertTest(`Phrase 1 [${lang.toUpperCase()}] preserves technical gauge "25G" verbatim`,
        /\b25G\b/.test(res1.translations[lang]), `Cabin ${lang.toUpperCase()}`);
    }
  } catch (err) {
    assertTest('Phrase 1 Execution', false, err.message);
  }

  // ==========================================================================
  // AREA 3: LIVE CONFERENCE PHRASE 2 (Radiesse, PDO, SMAS, Hidroxiapatita)
  // ==========================================================================
  console.log('\n--- Area 3: Live Conference Phrase 2 (Biostimulation & Vector Lifting) ---');
  const phrase2 = 'Para la estimulación de colágeno aplicamos hidroxiapatita cálcica Radiesse hiperdiluida y valoramos hilos de polidioxanona PDO en el plano del SMAS.';
  console.log(`  [Source ES]: "${phrase2}"`);

  try {
    const t0 = Date.now();
    const res2 = await translationService.translateAll(phrase2, 'es', {
      medicalMode: true,
      medicalSpecialty: 'dermatology',
      customGlossary: aestheticGlossary
    });
    const lat2 = Date.now() - t0;
    console.log(`  [Engine]: ${res2.engineUsed} (${lat2}ms)`);
    console.log(`    EN: "${res2.translations.en}"`);
    console.log(`    IT: "${res2.translations.it}"`);
    console.log(`    PT: "${res2.translations.pt}"`);

    // Commercial Brand Preservation: Radiesse
    for (const lang of ['en', 'it', 'pt']) {
      assertTest(`Phrase 2 [${lang.toUpperCase()}] preserves commercial brand "Radiesse" verbatim`,
        /\bRadiesse\b/.test(res2.translations[lang]), `Cabin ${lang.toUpperCase()}`);
    }

    // Technical Acronym Preservation: PDO & SMAS
    for (const lang of ['en', 'it', 'pt']) {
      assertTest(`Phrase 2 [${lang.toUpperCase()}] preserves acronym "PDO" verbatim`,
        /\bPDO\b/.test(res2.translations[lang]), `Cabin ${lang.toUpperCase()}`);
      assertTest(`Phrase 2 [${lang.toUpperCase()}] preserves anatomical acronym "SMAS" verbatim`,
        /\bSMAS\b/.test(res2.translations[lang]), `Cabin ${lang.toUpperCase()}`);
    }

    // Pharmacology / Biomaterial: hidroxiapatita cálcica / de calcio
    assertTest('Phrase 2 [EN] translates "hidroxiapatita cálcica" -> "calcium hydroxyapatite"',
      /calcium hydroxyapatite/i.test(res2.translations.en), res2.translations.en);
    assertTest('Phrase 2 [IT] translates "hidroxiapatita cálcica" -> "idrossiapatite di calcio"',
      /idrossiapatite di calcio/i.test(res2.translations.it), res2.translations.it);
    assertTest('Phrase 2 [PT] translates "hidroxiapatita cálcica" -> "hidroxiapatita de cálcio"',
      /hidroxiapatita de cálcio/i.test(res2.translations.pt), res2.translations.pt);

    // Suture Material: polidioxanona
    assertTest('Phrase 2 [EN] translates "polidioxanona" -> "polydioxanone"',
      /polydioxanone/i.test(res2.translations.en), res2.translations.en);
    assertTest('Phrase 2 [IT] translates "polidioxanona" -> "polidiossanone"',
      /polidiossanone/i.test(res2.translations.it), res2.translations.it);
    assertTest('Phrase 2 [PT] translates "polidioxanona" -> "polidioxanona"',
      /polidioxanona/i.test(res2.translations.pt), res2.translations.pt);
  } catch (err) {
    assertTest('Phrase 2 Execution', false, err.message);
  }

  // ==========================================================================
  // AREA 4: LIVE CONFERENCE PHRASE 3 (Vascular Occlusion Emergency & Hyaluronidase)
  // ==========================================================================
  console.log('\n--- Area 4: Live Conference Phrase 3 (Aesthetic Complications & Hyaluronidase) ---');
  const phrase3 = 'Ante una sospecha de oclusión vascular con blanqueamiento cutáneo, infiltramos de inmediato hialuronidasa a altas dosis.';
  console.log(`  [Source ES]: "${phrase3}"`);

  try {
    const t0 = Date.now();
    const res3 = await translationService.translateAll(phrase3, 'es', {
      medicalMode: true,
      medicalSpecialty: 'dermatology',
      customGlossary: aestheticGlossary
    });
    const lat3 = Date.now() - t0;
    console.log(`  [Engine]: ${res3.engineUsed} (${lat3}ms)`);
    console.log(`    EN: "${res3.translations.en}"`);
    console.log(`    IT: "${res3.translations.it}"`);
    console.log(`    PT: "${res3.translations.pt}"`);

    // Emergency Pharmacology: hialuronidasa
    assertTest('Phrase 3 [EN] translates "hialuronidasa" -> "hyaluronidase"',
      /hyaluronidase/i.test(res3.translations.en), res3.translations.en);
    assertTest('Phrase 3 [IT] translates "hialuronidasa" -> "ialuronidasi"',
      /ialuronidasi/i.test(res3.translations.it), res3.translations.it);
    assertTest('Phrase 3 [PT] translates "hialuronidasa" -> "hialuronidase"',
      /hialuronidase/i.test(res3.translations.pt), res3.translations.pt);

    // Clinical Sign: blanqueamiento cutáneo
    assertTest('Phrase 3 [EN] renders clinical blanching ("cutaneous blanching" / "skin blanching" / "blanching")',
      /(cutaneous blanching|skin blanching|blanching|whitening)/i.test(res3.translations.en), res3.translations.en);
    assertTest('Phrase 3 [IT] renders clinical blanching ("sbiancamento cutaneo")',
      /(sbiancamento cutaneo|sbiancamento)/i.test(res3.translations.it), res3.translations.it);
    assertTest('Phrase 3 [PT] renders clinical blanching ("branqueamento cutâneo")',
      /(branqueamento cutâneo|branqueamento)/i.test(res3.translations.pt), res3.translations.pt);
  } catch (err) {
    assertTest('Phrase 3 Execution', false, err.message);
  }

  // ==========================================================================
  // AREA 5: EXTENDED TEST CASES (Sculptra, Lidocaína, Efecto Tyndall)
  // ==========================================================================
  console.log('\n--- Area 5: Extended Aesthetic Test Cases (Sculptra, Lidocaine, Tyndall Effect) ---');
  const phrase4 = 'Para la bioestimulación profunda indicamos Sculptra reconstituido con lidocaína.';
  const phrase5 = 'Una inyección excesivamente superficial de ácido hialurónico puede producir efecto Tyndall.';

  try {
    const res4 = await translationService.translateAll(phrase4, 'es', {
      medicalMode: true,
      medicalSpecialty: 'dermatology',
      customGlossary: [...aestheticGlossary, 'lidocaína']
    });

    // Commercial brand Sculptra
    for (const lang of ['en', 'it', 'pt']) {
      assertTest(`Phrase 4 [${lang.toUpperCase()}] preserves commercial brand "Sculptra" verbatim`,
        /\bSculptra\b/.test(res4.translations[lang]), `Cabin ${lang.toUpperCase()}`);
    }

    // Pharmacology: lidocaína
    assertTest('Phrase 4 [EN] translates "lidocaína" -> "lidocaine"',
      /lidocaine/i.test(res4.translations.en), res4.translations.en);
    assertTest('Phrase 4 [IT] translates "lidocaína" -> "lidocaina"',
      /lidocaina/i.test(res4.translations.it), res4.translations.it);
    assertTest('Phrase 4 [PT] translates "lidocaína" -> "lidocaína"',
      /lidocaína/i.test(res4.translations.pt), res4.translations.pt);

    const res5 = await translationService.translateAll(phrase5, 'es', {
      medicalMode: true,
      medicalSpecialty: 'dermatology',
      customGlossary: aestheticGlossary
    });

    // Clinical sign: efecto Tyndall
    assertTest('Phrase 5 [EN] translates "efecto Tyndall" -> "Tyndall effect"',
      /Tyndall effect/i.test(res5.translations.en), res5.translations.en);
    assertTest('Phrase 5 [IT] translates "efecto Tyndall" -> "effetto Tyndall"',
      /effetto Tyndall/i.test(res5.translations.it), res5.translations.it);
    assertTest('Phrase 5 [PT] translates "efecto Tyndall" -> "efeito Tyndall"',
      /efeito Tyndall/i.test(res5.translations.pt), res5.translations.pt);
  } catch (err) {
    assertTest('Extended Area 5 Execution', false, err.message);
  }

  // ==========================================================================
  // AREA 6: MOCK POST-PROCESSING & LEXICON ROBUSTNESS
  // ==========================================================================
  console.log('\n--- Area 6: Direct Post-Processing & Lexicon Robustness ---');
  try {
    // 6.1 extractDetectedMedicalTerms detection verification
    const detectedP1 = extractDetectedMedicalTerms(phrase1, aestheticGlossary);
    const termsFoundP1 = detectedP1.map(t => t.term);
    assertTest('extractDetectedMedicalTerms detects "ácido hialurónico"', termsFoundP1.includes('ácido hialurónico'));
    assertTest('extractDetectedMedicalTerms detects "microcánula"', termsFoundP1.includes('microcánula'));
    assertTest('extractDetectedMedicalTerms detects "25G"', termsFoundP1.includes('25G'));

    // 6.2 postProcessClinicalTerms normalizes lowercased engine outputs
    const mockLowerEngineOutput = {
      en: 'we injected radiesse and sculptra into the smas plane using 25g needle and pdo threads',
      es: 'inyectamos radiesse y sculptra en el plano del smas usando aguja 25g e hilos pdo',
      it: 'abbiamo iniettato radiesse e sculptra nel piano dello smas usando ago 25g e fili pdo',
      pt: 'injetamos radiesse e sculptra no plano do smas usando agulha 25g e fios pdo'
    };

    const detectedMockTerms = extractDetectedMedicalTerms(
      'inyectamos radiesse y sculptra en el plano del smas usando aguja 25g e hilos pdo',
      aestheticGlossary
    );
    const normalized = postProcessClinicalTerms(mockLowerEngineOutput, detectedMockTerms);

    for (const lang of ['en', 'es', 'it', 'pt']) {
      assertTest(`postProcessClinicalTerms normalizes "smas" -> "SMAS" [${lang.toUpperCase()}]`,
        /\bSMAS\b/.test(normalized[lang]), normalized[lang]);
      assertTest(`postProcessClinicalTerms normalizes "pdo" -> "PDO" [${lang.toUpperCase()}]`,
        /\bPDO\b/.test(normalized[lang]), normalized[lang]);
      assertTest(`postProcessClinicalTerms normalizes "25g" -> "25G" [${lang.toUpperCase()}]`,
        /\b25G\b/.test(normalized[lang]), normalized[lang]);
      assertTest(`postProcessClinicalTerms normalizes "radiesse" -> "Radiesse" [${lang.toUpperCase()}]`,
        /\bRadiesse\b/.test(normalized[lang]), normalized[lang]);
      assertTest(`postProcessClinicalTerms normalizes "sculptra" -> "Sculptra" [${lang.toUpperCase()}]`,
        /\bSculptra\b/.test(normalized[lang]), normalized[lang]);
    }

    // 6.3 Cache key isolation for dermatology specialty
    const cache = translationService.cache;
    const testKeyStandard = cache._makeKey('Inyección subdérmica', 'es', 'general', [], 'ROOM_DERM', false);
    const testKeyDerm = cache._makeKey('Inyección subdérmica', 'es', 'dermatology', aestheticGlossary, 'ROOM_DERM', true);

    assertTest('Cache key generator isolates medicalMode: true from false', testKeyStandard !== testKeyDerm);
    assertTest('Clinical dermatology key contains specialty tag', testKeyDerm.includes('dermatology'));
    assertTest('Clinical dermatology key contains med:true tag', testKeyDerm.includes('med:true'));
  } catch (err) {
    assertTest('Area 6 Execution', false, err.message);
  }

  // ==========================================================================
  // SUMMARY REPORT
  // ==========================================================================
  console.log('\n================================================================================');
  console.log(' 📊 AESTHETIC TRANSLATION VERIFICATION REPORT');
  console.log('================================================================================');
  console.log(`Total Assertions Evaluated : ${totalAssertions}`);
  console.log(`Passing Assertions        : ${passingAssertions}`);
  console.log(`Failing Assertions        : ${failingAssertions}`);
  const passRate = ((passingAssertions / totalAssertions) * 100).toFixed(1);
  console.log(`Success Rate              : ${passRate}%`);
  console.log('================================================================================');

  if (failureDetails.length > 0) {
    console.error('\nFailures breakdown:');
    failureDetails.forEach(d => console.error(d));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL AESTHETIC MEDICINE TRANSLATION ASSERTIONS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runAestheticVerification().catch(err => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
