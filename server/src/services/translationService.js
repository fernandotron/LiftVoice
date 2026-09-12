/**
 * Translation Service for LiftVoice
 * Handles ultra-low latency simultaneous translations into [EN, ES, IT, PT]
 */

// Fallback dictionary for instant offline testing and demo phrases
const DEMO_DICTIONARY = {
  // Spanish to others
  'bienvenidos a la conferencia': { en: 'Welcome to the conference', it: 'Benvenuti alla conferenza', pt: 'Bem-vindos à conferência', es: 'Bienvenidos a la conferencia' },
  'hola a todos es un placer estar aqui': { en: 'Hello everyone, it is a pleasure to be here', it: 'Ciao a tutti, è un piacere essere qui', pt: 'Olá a todos, é um prazer estar aqui', es: 'Hola a todos, es un placer estar aquí' },
  'hoy vamos a hablar sobre inteligencia artificial en tiempo real': { en: 'Today we are going to talk about real-time artificial intelligence', it: 'Oggi parleremo di intelligenza artificiale in tempo reale', pt: 'Hoje vamos falar sobre inteligência artificial em tempo real', es: 'Hoy vamos a hablar sobre inteligencia artificial en tiempo real' },
  'los asistentes pueden escuchar la traduccion en sus auriculares': { en: 'Attendees can listen to the translation in their headphones', it: 'I partecipanti possono ascoltare la traduzione nelle loro cuffie', pt: 'Os participantes podem ouvir a tradução em seus fones de ouvido', es: 'Los asistentes pueden escuchar la traducción en sus auriculares' },
  'pueden cambiar de idioma en cualquier momento': { en: 'You can change language at any time', it: 'Potete cambiare lingua in qualsiasi momento', pt: 'Você pode mudar de idioma a qualquer momento', es: 'Pueden cambiar de idioma en cualquier momento' },
  'muchas gracias por su atencion': { en: 'Thank you very much for your attention', it: 'Grazie mille per la vostra attenzione', pt: 'Muito obrigado pela sua atenção', es: 'Muchas gracias por su atención' },
  'tienen alguna pregunta': { en: 'Do you have any questions?', it: 'Avete qualche domanda?', pt: 'Vocês têm alguma pergunta?', es: '¿Tienen alguna pregunta?' },

  // English to others
  'welcome to the future of simultaneous translation': { es: 'Bienvenidos al futuro de la traducción simultánea', it: 'Benvenuti nel futuro della traduzione simultanea', pt: 'Bem-vindos ao futuro da tradução simultânea', en: 'Welcome to the future of simultaneous translation' },
  'this system allows instant multi-language audio streaming': { es: 'Este sistema permite streaming de audio multi-idioma instantáneo', it: 'Questo sistema consente lo streaming audio multilingue istantaneo', pt: 'Este sistema permite streaming de áudio multilíngue instantâneo', en: 'This system allows instant multi-language audio streaming' },
  'scan the qr code to choose your preferred language': { es: 'Escanea el código QR para elegir tu idioma preferido', it: 'Scansiona il codice QR per scegliere la tua lingua preferita', pt: 'Escaneie o código QR para escolher seu idioma preferido', en: 'Scan the QR code to choose your preferred language' }
};

/**
 * Ultra-fast Clinical Lexicon & DCI Pharmacology Dictionary (<0.5ms scan)
 * Mapped to standard ICD-11, SNOMED-CT and INN (International Nonproprietary Names)
 */
export const CLINICAL_LEXICON = {
  // Universal clinical abbreviations & parameters
  'spo2': { term: 'SpO2', en: 'SpO2', es: 'SpO2', it: 'SpO2', pt: 'SpO2' },
  'ecg': { term: 'ECG', en: 'ECG', es: 'ECG', it: 'ECG', pt: 'ECG' },
  'ekg': { term: 'EKG', en: 'ECG', es: 'ECG', it: 'ECG', pt: 'ECG' },
  'epoc': { term: 'EPOC', en: 'COPD', es: 'EPOC', it: 'BPCO', pt: 'DPOC' },
  'copd': { term: 'COPD', en: 'COPD', es: 'EPOC', it: 'BPCO', pt: 'DPOC' },
  'ta': { term: 'TA', en: 'BP', es: 'TA', it: 'PA', pt: 'PA' },
  'bp': { term: 'BP', en: 'BP', es: 'TA', it: 'PA', pt: 'PA' },
  'fc': { term: 'FC', en: 'HR', es: 'FC', it: 'FC', pt: 'FC' },
  'hr': { term: 'HR', en: 'HR', es: 'FC', it: 'FC', pt: 'FC' },
  'iam': { term: 'IAM', en: 'AMI', es: 'IAM', it: 'IMA', pt: 'IAM' },
  'ami': { term: 'AMI', en: 'AMI', es: 'IAM', it: 'IMA', pt: 'IAM' },
  'pvc': { term: 'PVC', en: 'PVC', es: 'CPV', it: 'CPV', pt: 'CPV' },
  'fio2': { term: 'FiO2', en: 'FiO2', es: 'FiO2', it: 'FiO2', pt: 'FiO2' },
  'uci': { term: 'UCI', en: 'ICU', es: 'UCI', it: 'TI', pt: 'UTI' },
  'icu': { term: 'ICU', en: 'ICU', es: 'UCI', it: 'TI', pt: 'UTI' },
  'rcp': { term: 'RCP', en: 'CPR', es: 'RCP', it: 'RCP', pt: 'RCP' },
  'cpr': { term: 'CPR', en: 'CPR', es: 'RCP', it: 'RCP', pt: 'RCP' },

  // Key Pharmacology (International Nonproprietary Names - INN / DCI)
  'amiodarona': { term: 'amiodarona', en: 'amiodarone', es: 'amiodarona', it: 'amiodarone', pt: 'amiodarona' },
  'enoxaparina': { term: 'enoxaparina', en: 'enoxaparin', es: 'enoxaparina', it: 'enoxaparina', pt: 'enoxaparina' },
  'levotiroxina': { term: 'levotiroxina', en: 'levothyroxine', es: 'levotiroxina', it: 'levotiroxina', pt: 'levotiroxina' },
  'noradrenalina': { term: 'noradrenalina', en: 'norepinephrine', es: 'noradrenalina', it: 'noradrenalina', pt: 'noradrenalina' },
  'norepinefrina': { term: 'norepinefrina', en: 'norepinephrine', es: 'noradrenalina', it: 'noradrenalina', pt: 'noradrenalina' },
  'adrenalina': { term: 'adrenalina', en: 'epinephrine', es: 'adrenalina', it: 'adrenalina', pt: 'adrenalina' },
  'fentanilo': { term: 'fentanilo', en: 'fentanyl', es: 'fentanilo', it: 'fentanil', pt: 'fentanil' },
  'propofol': { term: 'propofol', en: 'propofol', es: 'propofol', it: 'propofol', pt: 'propofol' },
  'midazolam': { term: 'midazolam', en: 'midazolam', es: 'midazolam', it: 'midazolam', pt: 'midazolam' },
  'atropina': { term: 'atropina', en: 'atropine', es: 'atropina', it: 'atropina', pt: 'atropina' },
  'nitroglicerina': { term: 'nitroglicerina', en: 'nitroglycerin', es: 'nitroglicerina', it: 'nitroglicerina', pt: 'nitroglicerina' },
  'metformina': { term: 'metformina', en: 'metformin', es: 'metformina', it: 'metformina', pt: 'metformina' },
  'ceftriaxona': { term: 'ceftriaxona', en: 'ceftriaxone', es: 'ceftriaxone', it: 'ceftriaxone', pt: 'ceftriaxona' },
  'amoxicilina': { term: 'amoxicilina', en: 'amoxicillin', es: 'amoxicilina', it: 'amoxicillina', pt: 'amoxicilina' },
  'clavulanico': { term: 'ácido clavulánico', en: 'clavulanic acid', es: 'ácido clavulánico', it: 'acido clavulanico', pt: 'ácido clavulánico' },
  'losartan': { term: 'losartán', en: 'losartan', es: 'losartán', it: 'losartan', pt: 'losartana' },

  // Key Clinical Pathologies (SNOMED-CT / ICD-11)
  'tromboembolismo': { term: 'tromboembolismo pulmonar', en: 'pulmonary thromboembolism', es: 'tromboembolismo pulmonar', it: 'tromboembolia polmonare', pt: 'tromboembolismo pulmonar' },
  'infarto': { term: 'infarto agudo de miocardio', en: 'acute myocardial infarction', es: 'infarto agudo de miocardio', it: 'infarto miocardico acuto', pt: 'infarto agudo do miocárdio' },
  'colecistectomia': { term: 'colecistectomía', en: 'cholecystectomy', es: 'colecistectomía', it: 'colecistectomia', pt: 'colecistectomia' },
  'apendicectomia': { term: 'apendicectomía', en: 'appendectomy', es: 'apendicectomía', it: 'appendicectomia', pt: 'appendicectomia' },
  'taquicardia': { term: 'taquicardia', en: 'tachycardia', es: 'taquicardia', it: 'tachicardia', pt: 'taquicardia' },
  'bradicardia': { term: 'bradicardia', en: 'bradycardia', es: 'bradicardia', it: 'bradicardia', pt: 'bradicardia' },
  'arritmia': { term: 'arritmia', en: 'arrhythmia', es: 'arritmia', it: 'aritmia', pt: 'arritmia' },
  'disnea': { term: 'disnea', en: 'dyspnea', es: 'disnea', it: 'dispnea', pt: 'dispneia' },
  'cefalea': { term: 'cefalea', en: 'headache', es: 'cefalea', it: 'cefalea', pt: 'cefaleia' },
  'isquemia': { term: 'isquemia', en: 'ischemia', es: 'isquemia', it: 'ischemia', pt: 'isquemia' }
};

export const COMMON_COGNATES = new Set([
  'doctor', 'hospital', 'spo2', 'covid', 'covid-19', 'covid19', 'ecg', 'ekg', 'fio2',
  'pvc', 'ami', 'cpr', 'icu', 'uci', 'virus', 'shock', 'trauma', 'plasma',
  'diabetes', 'cancer', 'abdomen', 'colon', 'radio', 'monitor', 'propofol',
  'midazolam', 'hotel', 'motor', 'bar', 'club', 'idea', 'animal', 'area',
  'base', 'canal', 'central', 'general', 'natural', 'original', 'simple',
  'normal', 'total', 'crisis', 'gas', 'metro', 'taxi', 'clínica', 'clinica',
  'edema', 'sepsis', 'cateter', 'catéter', 'insulina', 'aspirina', 'morfina',
  'hematoma', 'biopsia', 'coma', 'fentanilo', 'atropina', 'metformina'
]);

export function isKnownCognateOrAcronym(text) {
  const clean = (text || '').trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¡¿]/g, '');
  if (!clean) return false;
  if (COMMON_COGNATES.has(clean)) return true;
  if (CLINICAL_LEXICON[clean]) return true;
  if (/^(spo2|fio2|ecg|ekg|pvc|ami|rcp|cpr|icu|uci|bp|hr|ta|fc|covid|covid-?19)$/i.test(clean)) return true;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.length <= 4 && words.every(w => COMMON_COGNATES.has(w) || CLINICAL_LEXICON[w])) {
    return true;
  }
  return false;
}

/**
 * Rapidly scans text for clinical terms and matches with custom glossaries (< 0.5ms)
 */
export function extractDetectedMedicalTerms(text, customGlossary = []) {
  if (!text) return [];
  const found = new Map();

  // 1. Scan single words & terms in CLINICAL_LEXICON
  const words = text.match(/[\p{L}\p{N}]+/gu) || [];
  for (const word of words) {
    const lower = word.toLowerCase();
    const stripped = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const entry = CLINICAL_LEXICON[lower] || CLINICAL_LEXICON[stripped];
    if (entry) {
      found.set(entry.term, { ...entry });
    }
  }

  // Also check if any multi-word term in CLINICAL_LEXICON exists in text using word boundaries
  for (const [key, entry] of Object.entries(CLINICAL_LEXICON)) {
    if (key.includes(' ') || (entry.term && entry.term.includes(' '))) {
      const termToMatch = entry.term || key;
      const escaped = escapeRegExp(termToMatch);
      const regex = new RegExp(`(?<=^|[^\\p{L}\\p{N}])${escaped}(?=[^\\p{L}\\p{N}]|$)`, 'iu');
      if (regex.test(text)) {
        found.set(entry.term, { ...entry });
      }
    }
  }

  // 2. Also check custom conference terms if provided
  if (Array.isArray(customGlossary)) {
    for (const item of customGlossary) {
      const isString = typeof item === 'string';
      const termStr = (isString ? item : (item?.term || '')).trim();
      if (!termStr) continue;

      // Use Unicode word boundaries to prevent false positives for substrings
      const escaped = escapeRegExp(termStr);
      const wordBoundaryRegex = new RegExp(`(?<=^|[^\\p{L}\\p{N}])${escaped}(?=[^\\p{L}\\p{N}]|$)`, 'iu');
      if (!wordBoundaryRegex.test(text)) {
        continue;
      }

      // Check if term already exists in CLINICAL_LEXICON
      const lower = termStr.toLowerCase();
      const stripped = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const lexiconEntry = CLINICAL_LEXICON[lower] || CLINICAL_LEXICON[stripped];

      const hasMultilingual = !isString && Boolean(item.en || item.es || item.it || item.pt);

      if (lexiconEntry) {
        // If user provides custom multilingual translations, allow them to augment
        // Otherwise preserve the rich CLINICAL_LEXICON translations (so Spanish isn't forced to EN/IT/PT)
        if (hasMultilingual) {
          found.set(lexiconEntry.term, {
            ...lexiconEntry,
            term: item.term || lexiconEntry.term,
            en: item.en || lexiconEntry.en,
            es: item.es || lexiconEntry.es,
            it: item.it || lexiconEntry.it,
            pt: item.pt || lexiconEntry.pt,
            isTermHintOnly: false
          });
        } else {
          found.set(lexiconEntry.term, { ...lexiconEntry });
        }
      } else if (hasMultilingual) {
        found.set(termStr, {
          term: termStr,
          en: item.en || undefined,
          es: item.es || undefined,
          it: item.it || undefined,
          pt: item.pt || undefined,
          isTermHintOnly: false
        });
      } else {
        // String simple or object without translations: treat as term hint only
        // Do not degrade or force Spanish into EN/IT/PT cabins
        const existing = found.get(termStr);
        if (!existing) {
          found.set(termStr, {
            term: termStr,
            en: undefined,
            es: undefined,
            it: undefined,
            pt: undefined,
            isTermHintOnly: true
          });
        }
      }
    }
  }

  return Array.from(found.values());
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function makeDiacriticFlexiblePattern(string) {
  const diacriticMap = {
    'a': '[aáàâäãåā]',
    'e': '[eéèêëē]',
    'i': '[iíìîïī]',
    'o': '[oóòôöõō]',
    'u': '[uúùûüū]',
    'c': '[cç]',
    'n': '[nñ]'
  };
  const stripped = (string || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let pattern = '';
  for (const ch of stripped) {
    const lower = ch.toLowerCase();
    if (diacriticMap[lower]) {
      pattern += diacriticMap[lower];
    } else {
      pattern += escapeRegExp(ch);
    }
  }
  return pattern;
}

export function buildSecureGlossaryInstructions(detectedTerms = []) {
  if (!detectedTerms || detectedTerms.length === 0) return '';
  const formatted = [];
  for (const t of detectedTerms) {
    if (t.isTermHintOnly) {
      formatted.push(`- Term hint: ${JSON.stringify(t.term || '')}`);
      continue;
    }
    const term = JSON.stringify(t.term || '');
    const parts = [];
    if (t.en) parts.push(`EN=${JSON.stringify(t.en)}`);
    if (t.es) parts.push(`ES=${JSON.stringify(t.es)}`);
    if (t.it) parts.push(`IT=${JSON.stringify(t.it)}`);
    if (t.pt) parts.push(`PT=${JSON.stringify(t.pt)}`);
    if (parts.length > 0) {
      formatted.push(`- ${term}: ${parts.join(', ')}`);
    } else {
      formatted.push(`- Term hint: ${term}`);
    }
  }
  if (formatted.length === 0) return '';
  return `\nMANDATORY CLINICAL GLOSSARY RESTRICTIONS:\n` + formatted.join('\n');
}

/**
 * Lightweight LRU Translation Cache (Max 1000 entries, 20-minute TTL)
 */
export class TranslationLRUCache {
  constructor(maxSize = 1000, ttlMs = 20 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  _parseRoomAndMode(arg1, arg2) {
    let roomId = 'GLOBAL';
    let medicalMode = false;
    if (typeof arg1 === 'object' && arg1 !== null) {
      roomId = (arg1.roomId || 'GLOBAL').trim().toUpperCase();
      medicalMode = Boolean(arg1.medicalMode);
    } else {
      if (typeof arg1 === 'boolean') {
        medicalMode = arg1;
        if (typeof arg2 === 'string') roomId = (arg2 || 'GLOBAL').trim().toUpperCase();
      } else if (typeof arg1 === 'string') {
        roomId = (arg1 || 'GLOBAL').trim().toUpperCase();
        if (typeof arg2 === 'boolean') medicalMode = arg2;
      }
      if (typeof arg2 === 'boolean') medicalMode = arg2;
      else if (typeof arg2 === 'string') roomId = (arg2 || 'GLOBAL').trim().toUpperCase();
    }
    return { roomId: roomId || 'GLOBAL', medicalMode: Boolean(medicalMode) };
  }

  _makeKey(text, source, specialty, glossary = [], arg1 = 'global', arg2 = false) {
    const { roomId, medicalMode } = this._parseRoomAndMode(arg1, arg2);
    const safeRoomId = (roomId || 'global').trim().toUpperCase();
    const medFlag = `med:${Boolean(medicalMode)}`;
    const normText = (text || '').toLowerCase().trim();
    const glossaryKey = Array.isArray(glossary)
      ? glossary.map(g => typeof g === 'string' ? g : (g.term || '')).sort().join(',')
      : '';
    return `${safeRoomId}:${medFlag}:${source || 'auto'}:${specialty || 'general'}:${glossaryKey}:${normText}`;
  }

  get(text, source, specialty, glossary, arg1 = 'global', arg2 = false) {
    const { roomId, medicalMode } = this._parseRoomAndMode(arg1, arg2);
    const key = this._makeKey(text, source, specialty, glossary, roomId, medicalMode);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    // Refresh MRU position
    this.cache.delete(key);
    this.cache.set(key, entry);
    try {
      return JSON.parse(JSON.stringify(entry.value));
    } catch (e) {
      return entry.value;
    }
  }

  set(text, source, specialty, glossary, value, arg1 = 'global', arg2 = false) {
    const { roomId, medicalMode } = this._parseRoomAndMode(arg1, arg2);
    const key = this._makeKey(text, source, specialty, glossary, roomId, medicalMode);
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    let storedValue = value;
    try {
      storedValue = JSON.parse(JSON.stringify(value));
    } catch (e) {}
    this.cache.set(key, { value: storedValue, timestamp: Date.now() });
  }

  clear() {
    this.cache.clear();
  }
}

/**
 * Post-processes translations to guarantee that clinical abbreviations (SpO2, ECG, etc.)
 * maintain canonical formatting and DCI drug names are accurately matched
 */
export function postProcessClinicalTerms(translations, detectedTerms = []) {
  if (!translations) return translations;
  const processed = { ...translations };

  if (Array.isArray(detectedTerms) && detectedTerms.length > 0) {
    for (const item of detectedTerms) {
      if (item.isTermHintOnly) continue;

      for (const lang of Object.keys(processed)) {
        if (typeof processed[lang] !== 'string') continue;
        const targetReplacement = item[lang];
        if (!targetReplacement) continue;

        // Collect all variants of this clinical term (canonical term and translations in other languages)
        const variants = new Set();
        if (item.term) variants.add(item.term.trim());
        if (item.es) variants.add(item.es.trim());
        if (item.en) variants.add(item.en.trim());
        if (item.it) variants.add(item.it.trim());
        if (item.pt) variants.add(item.pt.trim());

        // Sort descending by length so longer phrases match before sub-parts
        const sortedVariants = Array.from(variants)
          .filter(v => typeof v === 'string' && v.trim().length > 0)
          .sort((a, b) => b.length - a.length);

        for (const variant of sortedVariants) {
          const diacriticPattern = makeDiacriticFlexiblePattern(variant);
          const regex = new RegExp(`(?<=^|[^\\p{L}\\p{N}])${diacriticPattern}(?=[^\\p{L}\\p{N}]|$)`, 'giu');

          processed[lang] = processed[lang].replace(regex, (match, offset, str) => {
            // Determine replacement preserving initial capitalization if match starts with uppercase
            let replacement = targetReplacement;
            if (/^\p{Lu}/u.test(match)) {
              replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
            }

            // If already exact replacement, keep it
            if (match === replacement) return match;

            // If replacement has a parenthetical suffix, e.g. "BP (blood pressure)"
            const parenMatch = replacement.match(/^(.+?)\s*(\([^)]+\))$/);
            if (parenMatch) {
              const [, baseTerm, parenPart] = parenMatch;
              const afterText = str.slice(offset + match.length).trimStart();
              if (afterText.toLowerCase().startsWith(parenPart.toLowerCase())) {
                // The subsequent text already has the parenthetical! Do not duplicate it
                return /^\p{Lu}/u.test(match) ? (baseTerm.charAt(0).toUpperCase() + baseTerm.slice(1)) : baseTerm;
              }
            }

            // Prevent duplicating parenthetical suffix if text already starts with replacement at offset
            if (str.slice(offset).toLowerCase().startsWith(replacement.toLowerCase())) {
              return match;
            }

            return replacement;
          });
        }
      }
    }
  }

  // Universal normalization for clinical acronyms across all cabins
  const universalAcronyms = [
    { regex: /(?<=^|[^\p{L}\p{N}])(?:spo2|sat\s*o2|sato2)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'SpO2' },
    { regex: /(?<=^|[^\p{L}\p{N}])fio2(?=[^\p{L}\p{N}]|$)/giu, replacement: 'FiO2' },
    { regex: /(?<=^|[^\p{L}\p{N}])(?:ecg|ekg)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'ECG' }
  ];

  // Cabin-specific concise clinical acronym normalization optimized for TTS
  const cabinAcronyms = {
    en: [
      { regex: /(?<=^|[^\p{L}\p{N}])(?:ta|bp)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'BP' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:fc|hr)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'HR' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:epoc|copd|bpco|dpoc)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'COPD' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:iam|ami|ima)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'AMI' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:rcp|cpr)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'CPR' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:uci|icu)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'ICU' }
    ],
    es: [
      { regex: /(?<=^|[^\p{L}\p{N}])(?:ta|bp|pa)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'TA' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:fc|hr)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'FC' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:epoc|copd|bpco|dpoc)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'EPOC' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:iam|ami|ima)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'IAM' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:rcp|cpr)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'RCP' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:uci|icu|uti)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'UCI' }
    ],
    it: [
      { regex: /(?<=^|[^\p{L}\p{N}])(?:ta|bp|pa)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'PA' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:fc|hr)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'FC' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:epoc|copd|bpco|dpoc)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'BPCO' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:iam|ami|ima)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'IMA' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:rcp|cpr)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'RCP' }
    ],
    pt: [
      { regex: /(?<=^|[^\p{L}\p{N}])(?:ta|bp|pa)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'PA' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:fc|hr)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'FC' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:epoc|copd|bpco|dpoc)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'DPOC' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:iam|ami|ima)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'IAM' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:rcp|cpr)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'RCP' },
      { regex: /(?<=^|[^\p{L}\p{N}])(?:uci|icu|uti)(?=[^\p{L}\p{N}]|$)/giu, replacement: 'UTI' }
    ]
  };

  for (const lang of Object.keys(processed)) {
    if (typeof processed[lang] === 'string') {
      // Apply universal acronyms
      for (const { regex, replacement } of universalAcronyms) {
        processed[lang] = processed[lang].replace(regex, replacement);
      }

      // Apply cabin-specific acronyms
      const langRules = cabinAcronyms[lang];
      if (langRules) {
        for (const { regex, replacement } of langRules) {
          processed[lang] = processed[lang].replace(regex, replacement);
        }
      }

      // Safeguard against duplicate parenthetical phrases like "BP (blood pressure) (blood pressure)"
      processed[lang] = processed[lang].replace(/(\([^)]+\))\s*\1+/giu, '$1');
      processed[lang] = processed[lang].replace(/\b(BP|TA|PA|HR|FC|AMI|IAM)\s*\(([^)]+)\)\s*\(\2\)/giu, '$1 ($2)');
    }
  }

  return processed;
}

export function sanitizeMedicalSpecialty(specialty) {
  if (!specialty || typeof specialty !== 'string') return 'general';
  const clean = specialty.trim().toLowerCase();
  const ALLOWED_SPECIALTIES = new Set([
    'general', 'cardiology', 'pharmacology', 'surgery', 'neurology',
    'pediatrics', 'oncology', 'intensive_care', 'icu', 'emergency',
    'anesthesiology', 'radiology', 'psychiatry', 'internal_medicine',
    'orthopedics', 'pulmonology', 'nephrology', 'gastroenterology', 'dermatology'
  ]);
  if (ALLOWED_SPECIALTIES.has(clean)) return clean;
  if (/^[a-z0-9_-]{2,30}$/i.test(clean)) return clean;
  return 'general';
}

/**
 * Builds high-fidelity clinical prompt for Qwen 3.8 / 2.5
 */
export function buildQwenMedicalPrompt(speechText, detectedTerms = [], contextHistory = '', medicalSpecialty = 'general') {
  const safeSpecialty = sanitizeMedicalSpecialty(medicalSpecialty);

  const glossaryRule = buildSecureGlossaryInstructions(detectedTerms);
  const safeContextHistory = typeof contextHistory === 'string' ? contextHistory.trim() : '';
  const contextSnippet = safeContextHistory
    ? `\nPREVIOUS SPOKEN CONTEXT (for coreference, pronoun resolution, and clinical continuity):\n${JSON.stringify(safeContextHistory)}\n`
    : '';

  return `You are Alibaba Qwen 3.8 (Sept 2026), the world's leading open-weights simultaneous medical interpreter specialized in clinical medicine (${safeSpecialty}), pharmacology, ICD-11, and SNOMED-CT.
Accurately and idiomatically translate the live spoken text into English (en), Spanish (es), Italian (it), and Portuguese (pt).

CRITICAL MEDICAL & CLINICAL RULES:
1. Standardized Clinical Acronyms: Preserve critical medical acronyms (e.g. ECG, SpO2, BP/TA, HR/FC, COPD/EPOC, AMI/IAM, FiO2, CPR/RCP) according to target clinical conventions. Do NOT expand acronyms into full sentences unless required.
2. Pharmacological Accuracy: Translate all drugs using the official International Nonproprietary Name (INN / DCI).
3. ICD-11 & SNOMED-CT Fidelity: Maintain clinical nomenclature (e.g. "dyspnea", "acute myocardial infarction", "cholecystectomy"). Do not trivialize into overly colloquial slang.
4. Natural Spoken Rhythm: Ensure fluent phrasing suitable for real-time Text-to-Speech audio streaming.${glossaryRule}${contextSnippet}

Input text: ${JSON.stringify(speechText)}

Respond ONLY with valid JSON in this exact structure:
{
  "detectedSource": "en" (or "es", "it", "pt"),
  "translations": {
    "en": "English translation",
    "es": "Spanish translation",
    "it": "Italian translation",
    "pt": "Portuguese translation"
  }
}`;
}

export class TranslationService {
  constructor(config = {}) {
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY || '';
    this.deeplApiKey = config.deeplApiKey || process.env.DEEPL_API_KEY || '';
    this.geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || '';
    this.geminiModel = config.geminiModel || 'google/gemini-3.1-flash-lite';
    this.qwenApiKey = config.qwenApiKey || process.env.DASHSCOPE_API_KEY || process.env.OPENROUTER_API_KEY || '';
    this.qwenModel = config.qwenModel || 'qwen/qwen-3.8-27b';
    this.qwenEndpoint = config.qwenEndpoint || process.env.QWEN_ENDPOINT || '';
    this.preferredEngine = config.preferredEngine || 'gemini'; // 'gemini' | 'qwen' | 'openai' | 'google' | 'auto'

    this.openaiModel = config.openaiModel || 'gpt-4o-mini';
    this.openaiTemperature = config.openaiTemperature !== undefined ? parseFloat(config.openaiTemperature) : 0.1;
    this.geminiTemperature = config.geminiTemperature !== undefined ? parseFloat(config.geminiTemperature) : 0.1;
    this.qwenTemperature = config.qwenTemperature !== undefined ? parseFloat(config.qwenTemperature) : 0.1;
    this.aiStrategy = config.aiStrategy || 'json_single'; // 'json_single' | 'parallel' | 'fallback'
    this.googleNeuralMode = config.googleNeuralMode || 'universal';

    // Medical Mode & Clinical Glossary configuration
    this.medicalMode = Boolean(config.medicalMode || process.env.MEDICAL_MODE === 'true');
    this.medicalSpecialty = config.medicalSpecialty || 'general'; // 'general' | 'cardiology' | 'pharmacology' | 'surgery'
    this.customGlossary = Array.isArray(config.customGlossary) ? config.customGlossary : [];

    // High-performance LRU cache (1000 entries, 20 min TTL)
    this.cache = new TranslationLRUCache(1000, 20 * 60 * 1000);
  }

  setApiKey(key) {
    this.openaiApiKey = key;
  }

  setOpenaiConfig({ model, temperature }) {
    if (model !== undefined) this.openaiModel = model;
    if (temperature !== undefined) this.openaiTemperature = parseFloat(temperature) || 0.1;
    console.log(`[TranslationService] 🤖 OpenAI configured (Model: ${this.openaiModel}, Temp: ${this.openaiTemperature})`);
  }

  setStrategy(strategy) {
    if (strategy !== undefined) this.aiStrategy = strategy;
    console.log(`[TranslationService] 🎯 AI Strategy configured: ${this.aiStrategy}`);
  }

  setDeeplConfig({ apiKey }) {
    if (apiKey !== undefined) this.deeplApiKey = apiKey;
    console.log(`[TranslationService] 🌐 DeepL configured (Key: ${this.deeplApiKey ? 'SET' : 'NONE'})`);
  }

  setGeminiConfig({ apiKey, model, preferredEngine, temperature }) {
    if (apiKey !== undefined) this.geminiApiKey = apiKey;
    if (model !== undefined) this.geminiModel = model;
    if (preferredEngine !== undefined) this.preferredEngine = preferredEngine;
    if (temperature !== undefined) this.geminiTemperature = parseFloat(temperature) || 0.1;
    console.log(`[TranslationService] ⚡ Google Gemini configured (Model: ${this.geminiModel || 'google/gemini-3.1-flash-lite'}, Temp: ${this.geminiTemperature}, Engine: ${this.preferredEngine})`);
  }

  setGoogleNeuralMode(mode) {
    if (mode !== undefined) this.googleNeuralMode = mode;
    console.log(`[TranslationService] 🌐 Google Neural Mode configured: ${this.googleNeuralMode}`);
  }

  setMedicalConfig({ medicalMode, medicalSpecialty, customGlossary }) {
    if (medicalMode !== undefined) this.medicalMode = Boolean(medicalMode);
    if (medicalSpecialty !== undefined) this.medicalSpecialty = medicalSpecialty;
    if (customGlossary !== undefined) {
      this.customGlossary = Array.isArray(customGlossary) ? customGlossary : [];
    }
    console.log(`[TranslationService] 🩺 Clinical Mode updated: ${this.medicalMode ? 'ACTIVE' : 'OFF'} (Specialty: ${this.medicalSpecialty}, Custom Terms: ${this.customGlossary.length})`);
  }

  setQwenConfig({ apiKey, model, endpoint, preferredEngine, temperature }) {
    if (apiKey !== undefined) this.qwenApiKey = apiKey;
    if (model !== undefined) this.qwenModel = model;
    if (endpoint !== undefined) this.qwenEndpoint = endpoint;
    if (preferredEngine !== undefined) this.preferredEngine = preferredEngine;
    if (temperature !== undefined) this.qwenTemperature = parseFloat(temperature) || 0.1;
    console.log(`[TranslationService] 🤖 Alibaba Qwen 3.8 configured (Model: ${this.qwenModel || 'qwen-3.8-27b'}, Temp: ${this.qwenTemperature}, Endpoint: ${this.qwenEndpoint || 'cloud'}, Engine: ${this.preferredEngine})`);
  }

  /**
   * Translates source text into all target languages: [en, es, it, pt]
   * @param {string} text - Spoken text from speaker
   * @param {string} detectedSource - Optional detected source language code
   * @param {Object} options - Medical mode, specialty, custom glossary, context history
   * @returns {Promise<{ detectedSource: string, translations: { en: string, es: string, it: string, pt: string }, latencyMs: number, engineUsed: string }>}
   */
  async translateAll(text, detectedSource = null, options = {}) {
    const startTime = Date.now();
    const cleanText = (text || '').trim();

    if (!cleanText) {
      return {
        detectedSource: detectedSource || 'es',
        translations: { en: '', es: '', it: '', pt: '' },
        latencyMs: 0,
        engineUsed: 'none'
      };
    }

    const roomId = options.roomId || 'global';
    const isMedical = options.medicalMode !== undefined ? Boolean(options.medicalMode) : this.medicalMode;
    const specialty = options.medicalSpecialty || this.medicalSpecialty || 'general';
    const customGlossary = options.customGlossary || this.customGlossary || [];
    const contextHistory = options.contextHistory || '';

    // Check LRU cache first for instant hits (<0.2ms)
    const cached = this.cache.get(cleanText, detectedSource, specialty, customGlossary, roomId, isMedical);
    if (cached) {
      return {
        ...cached,
        latencyMs: Date.now() - startTime,
        engineUsed: `${cached.engineUsed} (Cached)`
      };
    }

    // Extract clinical terms & custom abbreviations in <0.5ms
    const detectedTerms = extractDetectedMedicalTerms(cleanText, customGlossary);
    if (detectedTerms.length > 0) {
      console.log(`[TranslationService] 🩺 Detected ${detectedTerms.length} clinical term(s): ${detectedTerms.map(t => t.term).join(', ')}`);
    }

    const engine = this.preferredEngine || 'auto';
    let result = null;

    const hasDeeplKey = Boolean(this.deeplApiKey || process.env.DEEPL_API_KEY);
    const hasGeminiKey = Boolean(this.geminiApiKey || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY);
    const hasQwenKey = Boolean(this.qwenApiKey || (this.qwenEndpoint && (this.qwenEndpoint.includes('localhost') || this.qwenEndpoint.includes('127.0.0.1'))));
    const hasOpenaiKey = Boolean(this.openaiApiKey || process.env.OPENAI_API_KEY);

    // Build hierarchical execution order: based on aiStrategy and preferredEngine
    const candidateEngines = [];
    if (this.aiStrategy === 'fallback') {
      // Fallback mode: Gemini primary with immediate OpenAI backup
      candidateEngines.push('gemini', 'openai', 'qwen', 'google');
    } else {
      if (engine && engine !== 'auto') {
        candidateEngines.push(engine);
      }
      ['deepl', 'gemini', 'qwen', 'openai', 'google'].forEach(eng => {
        if (!candidateEngines.includes(eng)) {
          candidateEngines.push(eng);
        }
      });
    }

    for (const eng of candidateEngines) {
      if (result) break;

      // 1. DeepL API
      if (eng === 'deepl' && hasDeeplKey) {
        try {
          result = await this.translateWithDeepL(cleanText, detectedSource, {
            detectedTerms,
            medicalMode: isMedical,
            medicalSpecialty: specialty,
            contextHistory
          });
          result.latencyMs = Date.now() - startTime;
          result.engineUsed = 'DeepL API';
          console.log(`[TranslationService] ⚡ Translated with DeepL in ${result.latencyMs}ms`);
        } catch (err) {
          console.warn('[TranslationService] DeepL translation error, falling back:', err.message);
        }
      }

      // 2. Google Gemini 3.1 Flash-Lite
      else if (eng === 'gemini' && hasGeminiKey) {
        try {
          result = await this.translateWithGemini(cleanText, detectedSource, {
            detectedTerms,
            medicalMode: isMedical,
            medicalSpecialty: specialty,
            contextHistory
          });
          result.latencyMs = Date.now() - startTime;
          result.engineUsed = isMedical ? 'Google Gemini 3.1 Flash-Lite (Clinical)' : 'Google Gemini 3.1 Flash-Lite';
          console.log(`[TranslationService] ⚡ Translated with Gemini 3.1 Flash-Lite in ${result.latencyMs}ms`);
        } catch (err) {
          console.warn('[TranslationService] Gemini 3.1 Flash-Lite translation error, falling back:', err.message);
        }
      }

      // 3. Alibaba Qwen 3.8
      else if (eng === 'qwen' && hasQwenKey) {
        try {
          result = await this.translateWithQwen(cleanText, detectedSource, {
            detectedTerms,
            medicalMode: isMedical,
            medicalSpecialty: specialty,
            contextHistory
          });
          result.latencyMs = Date.now() - startTime;
          result.engineUsed = isMedical ? 'Alibaba Qwen 3.8 (Clinical)' : 'Alibaba Qwen 3.8 (Sept 2026)';
          console.log(`[TranslationService] ⚡ Translated with Alibaba Qwen in ${result.latencyMs}ms`);
        } catch (err) {
          console.warn('[TranslationService] Alibaba Qwen 3.8 translation error, falling back:', err.message);
        }
      }

      // 4. OpenAI GPT-4o-mini
      else if (eng === 'openai' && hasOpenaiKey) {
        try {
          result = await this.translateWithOpenAI(cleanText, detectedSource, {
            detectedTerms,
            medicalMode: isMedical,
            medicalSpecialty: specialty,
            contextHistory
          });
          result.latencyMs = Date.now() - startTime;
          result.engineUsed = isMedical ? 'OpenAI GPT-4o-mini (Clinical)' : 'OpenAI GPT-4o-mini';
        } catch (err) {
          console.warn('[TranslationService] OpenAI translation failed, falling back:', err.message);
        }
      }

      // 5. Google Neural Universal (Instant, free, no API key required)
      else if (eng === 'google' || eng === 'google_free') {
        try {
          result = await this.translateWithFreeEngine(cleanText, detectedSource);
          result.latencyMs = Date.now() - startTime;
          result.engineUsed = 'Google Neural Universal';
        } catch (err) {
          console.warn('[TranslationService] Google Neural translation failed, falling back:', err.message);
        }
      }
    }

    if (!result) {
      result = this.fallbackTranslate(cleanText, detectedSource);
      result.latencyMs = Date.now() - startTime;
      result.engineUsed = 'Offline Fallback';
    }

    // Identity short-circuit: speaker's source language must match the cleanText verbatim
    const realSource = (result.detectedSource || detectedSource || 'es').slice(0, 2).toLowerCase();
    if (result && result.translations && result.translations[realSource] !== undefined) {
      result.translations[realSource] = cleanText;
    }

    // Post-process to guarantee canonical uppercase for medical acronyms
    if (detectedTerms.length > 0 && result && result.translations) {
      result.translations = postProcessClinicalTerms(result.translations, detectedTerms);
    }

    // Save to LRU Cache for subsequent calls
    if (result && result.translations) {
      this.cache.set(cleanText, detectedSource, specialty, customGlossary, result, roomId, isMedical);
    }

    return result;
  }

  /**
   * DeepL Simultaneous Translation Engine (api.deepl.com or api-free.deepl.com)
   * High-accuracy translations into [EN-US, ES, IT, PT-BR] with 2800ms timeout
   */
  async translateWithDeepL(text, detectedSource, options = {}) {
    const key = (this.deeplApiKey || process.env.DEEPL_API_KEY || '').trim();
    if (!key) {
      throw new Error('No API key configured for DeepL. Please configure your key in Settings.');
    }

    const isFreeKey = key.endsWith(':fx') || key.endsWith(':FX');
    const endpoint = isFreeKey
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const targetLangMap = {
      en: 'EN-US',
      es: 'ES',
      it: 'IT',
      pt: 'PT-BR'
    };

    const sourceLangMap = {
      en: 'EN',
      es: 'ES',
      it: 'IT',
      pt: 'PT'
    };

    const targets = options.targets || ['en', 'es', 'it', 'pt'];
    const translations = {};
    let realDetectedSource = (detectedSource && detectedSource !== 'auto')
      ? detectedSource.slice(0, 2).toLowerCase()
      : null;

    const normSourceCode = realDetectedSource ? sourceLangMap[realDetectedSource] : null;

    await Promise.all(
      targets.map(async (target) => {
        // Identity short-circuit if target matches detected source
        if (realDetectedSource && target === realDetectedSource) {
          translations[target] = text;
          return;
        }

        const deepLTarget = targetLangMap[target];
        if (!deepLTarget) {
          translations[target] = text;
          return;
        }

        const payload = {
          text: [text],
          target_lang: deepLTarget
        };
        if (normSourceCode) {
          payload.source_lang = normSourceCode;
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(2800)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`DeepL API error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const translatedText = data.translations?.[0]?.text;
        const detected = data.translations?.[0]?.detected_source_language?.toLowerCase();
        if (detected && !realDetectedSource) {
          realDetectedSource = detected;
        }

        translations[target] = translatedText || text;
      })
    );

    // Fallback for any missing targets
    for (const t of targets) {
      if (!translations[t]) translations[t] = text;
    }

    return {
      detectedSource: realDetectedSource || detectedSource || 'auto',
      translations
    };
  }

  normalizeTranslationKeys(rawTranslations = {}) {
    if (!rawTranslations || typeof rawTranslations !== 'object') return {};
    const normalized = {};
    for (const [key, val] of Object.entries(rawTranslations)) {
      if (!val || typeof val !== 'string') continue;
      const k = key.toLowerCase().trim().replace(/[-_]/g, '');
      let targetKey = key.toLowerCase().trim();
      if (k.startsWith('pt') || k === 'portuguese' || k === 'portugues') {
        targetKey = 'pt';
      } else if (k.startsWith('es') || k === 'spanish' || k === 'espanol') {
        targetKey = 'es';
      } else if (k.startsWith('it') || k === 'italian' || k === 'italiano') {
        targetKey = 'it';
      } else if (k.startsWith('en') || k === 'english' || k === 'ingles') {
        targetKey = 'en';
      } else if (targetKey.length > 2) {
        targetKey = targetKey.slice(0, 2);
      }
      normalized[targetKey] = val.trim();
    }
    return normalized;
  }

  async translateWithGemini(text, detectedSource, options = {}) {
    const key = this.geminiApiKey || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || '';
    if (!key) {
      throw new Error('No API key provided for Google Gemini (Google AI Studio or OpenRouter). Please configure in Settings.');
    }

    const { detectedTerms = [], medicalMode = false, medicalSpecialty = 'general', contextHistory = '' } = options;

    const safeSpecialty = sanitizeMedicalSpecialty(medicalSpecialty);

    const glossaryRule = buildSecureGlossaryInstructions(detectedTerms);
    const safeContextHistory = typeof contextHistory === 'string' ? contextHistory.trim() : '';
    const contextSnippet = safeContextHistory
      ? `\nPREVIOUS SPOKEN CONTEXT:\n${JSON.stringify(safeContextHistory)}\n`
      : '';

    const systemPrompt = `You are Google Gemini 3.1 Flash-Lite (Sept 2026), an ultra-low latency simultaneous conference interpreter${medicalMode ? ` specialized in clinical medicine (${safeSpecialty})` : ''}.
Translate the live spoken text accurately and naturally into English (en), Spanish (es), Italian (it), and Portuguese (pt).
Maintain natural conversational rhythm suitable for real-time speech synthesis.${glossaryRule}${contextSnippet}

Input text: ${JSON.stringify(text)}

Respond ONLY with valid JSON in this exact structure:
{
  "detectedSource": "en" (or "es", "it", "pt"),
  "translations": {
    "en": "English translation",
    "es": "Spanish translation",
    "it": "Italian translation",
    "pt": "Portuguese translation"
  }
}`;

    const isGoogleStudio = key.startsWith('AIza');
    let endpoint;
    let headers = { 'Content-Type': 'application/json' };
    let body;

    if (isGoogleStudio) {
      let studioModel = this.geminiModel ? this.geminiModel.replace(/^google\//, '') : 'gemini-2.0-flash';
      if (!studioModel.startsWith('gemini-')) studioModel = 'gemini-2.0-flash';
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${studioModel}:generateContent?key=${key}`;
      body = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: this.geminiTemperature !== undefined ? this.geminiTemperature : 0.1,
          maxOutputTokens: 500
        }
      });
    } else {
      endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      headers['Authorization'] = `Bearer ${key}`;
      headers['HTTP-Referer'] = 'https://liftvoice.ai';
      headers['X-Title'] = 'LiftVoice Simultaneous';
      body = JSON.stringify({
        model: this.geminiModel || 'google/gemini-3.1-flash-lite',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: this.geminiTemperature !== undefined ? this.geminiTemperature : 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(2800)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    let rawContent = '{}';
    if (isGoogleStudio) {
      rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    } else {
      rawContent = data.choices?.[0]?.message?.content || '{}';
    }

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const jsonClean = jsonMatch ? jsonMatch[0] : rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonClean);
    } catch (e) {
      throw new Error(`[TranslationService] Gemini JSON parsing failed: ${e.message}`);
    }

    if (!parsed || typeof parsed.translations !== 'object' || Object.keys(parsed.translations).length === 0) {
      throw new Error('[TranslationService] Gemini returned no translations in JSON');
    }

    const normalizedTranslations = this.normalizeTranslationKeys(parsed.translations);
    const standardKeys = ['en', 'es', 'it', 'pt'];
    const omittedKeys = standardKeys.filter(k => !normalizedTranslations[k] || !normalizedTranslations[k].trim());

    const defaultTranslations = {
      en: text, es: text, it: text, pt: text
    };

    return {
      detectedSource: parsed.detectedSource || detectedSource || 'auto',
      translations: {
        ...defaultTranslations,
        ...normalizedTranslations
      },
      omittedKeys
    };
  }

  async translateWithQwen(text, detectedSource, options = {}) {
    const customEndpoint = (this.qwenEndpoint || process.env.QWEN_ENDPOINT || '').trim();
    if (customEndpoint) {
      try {
        const u = new URL(customEndpoint);
        if (!['http:', 'https:'].includes(u.protocol)) {
          throw new Error('Protocol must be http: or https:');
        }
        const host = u.hostname.toLowerCase();
        if (host === '169.254.169.254' || host === 'metadata.google.internal' || host.endsWith('.internal')) {
          throw new Error('Cloud metadata endpoints are prohibited');
        }
      } catch (e) {
        throw new Error(`Invalid Qwen endpoint: ${e.message}`);
      }
    }
    const key = this.qwenApiKey || process.env.DASHSCOPE_API_KEY || process.env.OPENROUTER_API_KEY || '';
    const isLocal = customEndpoint && (customEndpoint.includes('localhost') || customEndpoint.includes('127.0.0.1'));

    if (!key && !isLocal) {
      throw new Error('No API key provided for Alibaba Qwen (DashScope / OpenRouter). Please configure your key or local endpoint in Settings.');
    }

    let endpoint = customEndpoint;
    let model = this.qwenModel || 'qwen/qwen-3.8-27b';

    if (endpoint) {
      if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
      }
    } else {
      const isOpenRouter = key.startsWith('sk-or-') || !key.startsWith('sk-');
      if (isOpenRouter || key.startsWith('sk-or-')) {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        if (!this.qwenModel || this.qwenModel.includes('2.5')) {
          model = 'qwen/qwen-3.8-27b';
        } else {
          model = this.qwenModel;
        }
      } else {
        endpoint = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
        model = this.qwenModel || 'qwen-3.8-27b';
      }
    }

    const { detectedTerms = [], medicalMode = false, medicalSpecialty = 'general', contextHistory = '' } = options;

    const safeSpecialty = sanitizeMedicalSpecialty(medicalSpecialty);

    let systemPrompt;
    if (medicalMode || detectedTerms.length > 0) {
      systemPrompt = buildQwenMedicalPrompt(text, detectedTerms, contextHistory, safeSpecialty);
    } else {
      const safeContext = typeof contextHistory === 'string' ? contextHistory.trim() : '';
      const contextLine = safeContext ? `\nContext: ${JSON.stringify(safeContext)}\n` : '';
      systemPrompt = `You are Alibaba Qwen 3.8 (Sept 2026), the world's leading open-weights simultaneous conference interpreter.
Accurately and idiomatically translate the spoken text into English (en), Spanish (es), Italian (it), and Portuguese (pt).
Maintain natural conversational spoken rhythm.${contextLine}

Input text: ${JSON.stringify(text)}

Respond ONLY with valid JSON in this exact structure:
{
  "detectedSource": "en" (or "es", "it", "pt"),
  "translations": {
    "en": "English translation",
    "es": "Spanish translation",
    "it": "Italian translation",
    "pt": "Portuguese translation"
  }
}`;
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }
    if (endpoint.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://liftvoice.ai';
      headers['X-Title'] = 'LiftVoice Simultaneous';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: this.qwenTemperature !== undefined ? this.qwenTemperature : 0.1,
        max_tokens: 500,
        ...(endpoint.includes('openrouter.ai') ? { response_format: { type: 'json_object' } } : {})
      }),
      signal: AbortSignal.timeout(2800)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Qwen API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || data.output?.text || '{}';
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const jsonClean = jsonMatch ? jsonMatch[0] : rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonClean);
    } catch (e) {
      throw new Error(`[TranslationService] Qwen JSON parsing failed: ${e.message}`);
    }

    if (!parsed || typeof parsed.translations !== 'object' || Object.keys(parsed.translations).length === 0) {
      throw new Error('[TranslationService] Qwen returned no translations in JSON');
    }

    const normalizedTranslations = this.normalizeTranslationKeys(parsed.translations);
    const standardKeys = ['en', 'es', 'it', 'pt'];
    const omittedKeys = standardKeys.filter(k => !normalizedTranslations[k] || !normalizedTranslations[k].trim());

    const defaultTranslations = {
      en: text, es: text, it: text, pt: text
    };

    return {
      detectedSource: parsed.detectedSource || detectedSource || 'auto',
      translations: {
        ...defaultTranslations,
        ...normalizedTranslations
      },
      omittedKeys
    };
  }

  async translateWithOpenAI(text, detectedSource, options = {}) {
    const { detectedTerms = [], medicalMode = false, medicalSpecialty = 'general', contextHistory = '' } = options;
    const safeSpecialty = sanitizeMedicalSpecialty(medicalSpecialty);
    const safeContext = typeof contextHistory === 'string' ? contextHistory.trim() : '';

    let prompt;
    if (medicalMode || detectedTerms.length > 0) {
      const glossaryRule = buildSecureGlossaryInstructions(detectedTerms);
      const contextSnippet = safeContext ? `\nPREVIOUS SPOKEN CONTEXT:\n${JSON.stringify(safeContext)}\n` : '';

      prompt = `You are an elite simultaneous medical conference interpreter specialized in clinical medicine (${safeSpecialty}), pharmacology, ICD-11, and SNOMED-CT.
Accurately translate the spoken text into English (en), Spanish (es), Italian (it), and Portuguese (pt).
Preserve standardized clinical acronyms (e.g. ECG, SpO2, BP/TA, HR/FC, COPD/EPOC, AMI/IAM).
Translate all drugs using the official International Nonproprietary Name (INN / DCI).
Maintain spoken rhythm suitable for immediate Text-to-Speech audio streaming.${glossaryRule}${contextSnippet}

Input text: ${JSON.stringify(text)}

Respond ONLY with valid JSON in this exact structure:
{
  "detectedSource": "es" (or "en", "it", "pt"),
  "translations": {
    "en": "English translation",
    "es": "Spanish translation",
    "it": "Italian translation",
    "pt": "Portuguese translation"
  }
} `;
    } else {
      const contextLine = safeContext ? `\nContext: ${JSON.stringify(safeContext)}\n` : '';
      prompt = `You are a real-time conference simultaneous interpreter. Translate the following speech text accurately and naturally into English (en), Spanish (es), Italian (it), and Portuguese (pt).
Maintain tone, context, and brevity suitable for immediate speech-to-speech audio synthesis.${contextLine}

Input text: ${JSON.stringify(text)}

Respond ONLY with valid JSON in this exact structure:
{
  "detectedSource": "es" (or "en", "it", "pt", etc.),
  "translations": {
    "en": "English translation",
    "es": "Spanish translation",
    "it": "Italian translation",
    "pt": "Portuguese translation"
  }
}`;
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`
      },
      body: JSON.stringify({
        model: this.openaiModel || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: this.openaiTemperature !== undefined ? this.openaiTemperature : 0.1,
        max_tokens: 300
      }),
      signal: AbortSignal.timeout(2800)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonClean = jsonMatch ? jsonMatch[0] : content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonClean);
    } catch (e) {
      throw new Error(`[TranslationService] OpenAI JSON parsing failed: ${e.message}`);
    }

    if (!parsed || typeof parsed.translations !== 'object' || Object.keys(parsed.translations).length === 0) {
      throw new Error('[TranslationService] OpenAI returned no translations in JSON');
    }

    const normalizedTranslations = this.normalizeTranslationKeys(parsed.translations);
    const standardKeys = ['en', 'es', 'it', 'pt'];
    const omittedKeys = standardKeys.filter(k => !normalizedTranslations[k] || !normalizedTranslations[k].trim());

    return {
      detectedSource: parsed.detectedSource || detectedSource || 'auto',
      translations: {
        en: normalizedTranslations.en || text,
        es: normalizedTranslations.es || text,
        it: normalizedTranslations.it || text,
        pt: normalizedTranslations.pt || text
      },
      omittedKeys
    };
  }

  /**
   * High-resilience multi-tier translator:
   * Tier 1: Google Chrome dict-chrome-ex API (<120ms, cloud datacenter friendly)
   * Tier 2: Google GTX with real browser headers (4000ms timeout)
   * Tier 3: Demo dictionary / clinical glossary matcher
   */
  async translateWithFreeEngine(text, detectedSource, customTargets = null) {
    const targets = customTargets || ['en', 'es', 'it', 'pt'];
    const translations = {};
    let realDetectedSource = (detectedSource && detectedSource !== 'auto')
      ? detectedSource.slice(0, 2).toLowerCase()
      : (this.detectRoughLanguage(text) || 'es');

    const BROWSER_HEADERS = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'es,en;q=0.9,it;q=0.8,pt;q=0.7'
    };

    // Pre-execution short-circuit: if targets include the detected source language, assign text immediately
    if (targets.includes(realDetectedSource)) {
      translations[realDetectedSource] = text;
    }

    const pendingTargets = targets.filter(t => t !== realDetectedSource);

    // Parallel fetch for pending target languages only
    await Promise.all(
      pendingTargets.map(async (targetLang) => {
        const normSource = (realDetectedSource || '').toLowerCase();

        // Tier 1: Google Chrome Extension API (ultra-low latency <120ms, works from cloud IPs)
        try {
          const slParam = normSource || 'auto';
          const url1 = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${slParam}&tl=${targetLang}&q=${encodeURIComponent(text)}`;
          const res1 = await fetch(url1, {
            headers: BROWSER_HEADERS,
            signal: AbortSignal.timeout(1200)
          });
          if (res1.ok) {
            const data1 = await res1.json();
            if (data1 && Array.isArray(data1) && data1[0]) {
              const item = data1[0];
              const translatedStr = (Array.isArray(item) ? item[0] : (typeof item === 'string' ? item : '')).trim();
              const detectedIn1 = Array.isArray(item) && item[1] ? item[1].toLowerCase() : null;
              if (detectedIn1 && (!realDetectedSource || realDetectedSource === 'auto')) {
                realDetectedSource = detectedIn1;
              }

              // Verify translation actually translated (not just echoed original Spanish into English/Italian)
              // Allow recognized cognates ("Doctor", "Hospital", "SpO2", "COVID") to be accepted in Tier 1
              const isDifferentFromInput = translatedStr.toLowerCase() !== text.trim().toLowerCase();
              const isSameLangAsSource = realDetectedSource && realDetectedSource === targetLang;
              const isCognate = isKnownCognateOrAcronym(text);

              if (translatedStr && (isDifferentFromInput || isSameLangAsSource || isCognate)) {
                translations[targetLang] = translatedStr;
                return;
              }
            }
          }
        } catch (e) {
          // Tier 1 failed or timed out, proceed to Tier 2
        }

        // Tier 2: Google GTX with real browser headers and 1.8s timeout
        try {
          const slParam = normSource || 'auto';
          const url2 = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${slParam}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
          const res2 = await fetch(url2, {
            headers: BROWSER_HEADERS,
            signal: AbortSignal.timeout(1800)
          });
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2 && data2[0] && Array.isArray(data2[0])) {
              const translatedStr = data2[0].map(item => item[0]).join('').trim();
              if (data2[2] && (!realDetectedSource || realDetectedSource === 'auto')) {
                realDetectedSource = data2[2].toLowerCase();
              }
              if (translatedStr) {
                translations[targetLang] = translatedStr;
                return;
              }
            }
          }
        } catch (e) {
          // Tier 2 failed
        }

        // Tier 3: Demo dictionary check for common phrases
        const lowerText = text.toLowerCase().trim();
        for (const [dictKey, dictVal] of Object.entries(DEMO_DICTIONARY)) {
          if ((lowerText.includes(dictKey) || dictKey.includes(lowerText)) && dictVal[targetLang]) {
            translations[targetLang] = dictVal[targetLang];
            return;
          }
        }

        // Final fallback if all failed
        if (!translations[targetLang]) {
          translations[targetLang] = text;
        }
      })
    );

    // Ensure all target languages have a value
    for (const t of targets) {
      if (!translations[t]) translations[t] = text;
    }

    return {
      detectedSource: realDetectedSource || this.detectRoughLanguage(text) || 'es',
      translations
    };
  }

  detectRoughLanguage(text) {
    const lower = text.toLowerCase();
    if (/\b(the|and|is|in|to|we|are|you|today|welcome|please)\b/.test(lower)) return 'en';
    if (/\b(el|la|los|las|de|que|en|es|hoy|bienvenidos|gracias|auriculares)\b/.test(lower)) return 'es';
    if (/\b(il|la|di|che|in|sono|oggi|benvenuti|grazie|cuffie)\b/.test(lower)) return 'it';
    if (/\b(o|a|os|as|do|da|que|em|hoje|bem-vindos|obrigado|fones)\b/.test(lower)) return 'pt';
    if (/\b(le|la|les|de|et|est|un|une|pour|dans|merci)\b/.test(lower)) return 'fr';
    if (/\b(der|die|das|und|ist|in|den|von|zu|mit|danke)\b/.test(lower)) return 'de';
    if (/[\u4e00-\u9fa5]/.test(lower)) return 'zh';
    if (/[\u3040-\u30ff]/.test(lower)) return 'ja';
    if (/[\u0600-\u06ff]/.test(lower)) return 'ar';
    if (/[\u0400-\u04ff]/.test(lower)) return 'ru';
    if (/[\uac00-\ud7af]/.test(lower)) return 'ko';
    if (/[\u0900-\u097f]/.test(lower)) return 'hi';
    return 'es'; // default
  }

  fallbackTranslate(text, detectedSource, customTargets = null) {
    const targets = customTargets || ['en', 'es', 'it', 'pt', 'fr', 'de', 'zh', 'ja', 'ar', 'ru', 'ko', 'hi'];
    const lower = text.toLowerCase().trim();
    const source = detectedSource || this.detectRoughLanguage(text);
    const translations = {};

    for (const t of targets) {
      translations[t] = t === source ? text : `[${t.toUpperCase()}] ${text}`;
    }

    // Check demo dictionary
    for (const [key, value] of Object.entries(DEMO_DICTIONARY)) {
      if (lower.includes(key) || key.includes(lower)) {
        return {
          detectedSource: source,
          translations: { ...translations, ...value }
        };
      }
    }

    return {
      detectedSource: source,
      translations
    };
  }

  simpleMockTranslate(text, targetLang) {
    const translationsMap = {
      en: text,
      es: text,
      it: text,
      pt: text
    };
    return translationsMap[targetLang] || text;
  }
}

export const translationService = new TranslationService();
