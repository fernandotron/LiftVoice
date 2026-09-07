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
  'ta': { term: 'TA', en: 'BP (blood pressure)', es: 'TA (tensión arterial)', it: 'PA (pressione arteriosa)', pt: 'PA (pressão arterial)' },
  'bp': { term: 'BP', en: 'BP', es: 'TA', it: 'PA', pt: 'PA' },
  'fc': { term: 'FC', en: 'HR (heart rate)', es: 'FC (frecuencia cardíaca)', it: 'FC (frequenza cardiaca)', pt: 'FC (frequência cardíaca)' },
  'hr': { term: 'HR', en: 'HR', es: 'FC', it: 'FC', pt: 'FC' },
  'iam': { term: 'IAM', en: 'AMI (acute myocardial infarction)', es: 'IAM (infarto agudo de miocardio)', it: 'IMA (infarto miocardico acuto)', pt: 'IAM (infarto agudo do miocárdio)' },
  'ami': { term: 'AMI', en: 'AMI', es: 'IAM', it: 'IMA', pt: 'IAM' },
  'pvc': { term: 'PVC', en: 'PVC (premature ventricular contraction)', es: 'CPV', it: 'CPV', pt: 'CPV' },
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
  'clavulanico': { term: 'ácido clavulánico', en: 'clavulanic acid', es: 'ácido clavulánico', it: 'acido clavulanico', pt: 'ácido clavulânico' },
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
  'cefalea': { term: 'cefalea', en: 'headache / cephalea', es: 'cefalea', it: 'cefalea', pt: 'cefaleia' },
  'isquemia': { term: 'isquemia', en: 'ischemia', es: 'isquemia', it: 'ischemia', pt: 'isquemia' }
};

/**
 * Rapidly scans text for clinical terms and matches with custom glossaries (< 0.5ms)
 */
export function extractDetectedMedicalTerms(text, customGlossary = []) {
  if (!text) return [];
  const normalized = text.toLowerCase().replace(/[,.?!;:()]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  const found = new Map();

  for (const word of words) {
    if (CLINICAL_LEXICON[word]) {
      found.set(CLINICAL_LEXICON[word].term, CLINICAL_LEXICON[word]);
    }
  }

  // Also check custom conference terms if provided
  if (Array.isArray(customGlossary)) {
    for (const item of customGlossary) {
      const termStr = typeof item === 'string' ? item.trim() : (item.term || '').trim();
      if (!termStr) continue;
      if (normalized.includes(termStr.toLowerCase())) {
        found.set(termStr, {
          term: termStr,
          en: typeof item === 'object' && item.en ? item.en : termStr,
          es: typeof item === 'object' && item.es ? item.es : termStr,
          it: typeof item === 'object' && item.it ? item.it : termStr,
          pt: typeof item === 'object' && item.pt ? item.pt : termStr
        });
      }
    }
  }

  return Array.from(found.values());
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Post-processes translations to guarantee that clinical abbreviations (SpO2, ECG, etc.)
 * maintain canonical uppercase formatting regardless of translation engine
 */
export function postProcessClinicalTerms(translations, detectedTerms = []) {
  if (!translations || detectedTerms.length === 0) return translations;
  const processed = { ...translations };

  for (const item of detectedTerms) {
    for (const lang of Object.keys(processed)) {
      if (processed[lang] && item[lang]) {
        // Enforce exact case on standard acronyms like SpO2, ECG, EPOC, IAM
        if (item[lang].toUpperCase() === item[lang] || item[lang] === 'SpO2' || item[lang] === 'FiO2') {
          const escaped = escapeRegExp(item[lang]);
          const regex = new RegExp(`(?<!\\w)${escaped}(?!\\w)`, 'gi');
          processed[lang] = processed[lang].replace(regex, item[lang]);
        }
      }
    }
  }

  return processed;
}

/**
 * Builds high-fidelity clinical prompt for Qwen 3.8 / 2.5
 */
export function buildQwenMedicalPrompt(speechText, detectedTerms = [], contextHistory = '', medicalSpecialty = 'general') {
  let glossaryRule = '';
  if (detectedTerms && detectedTerms.length > 0) {
    glossaryRule = `\nMANDATORY CLINICAL GLOSSARY RESTRICTIONS:\n` +
      detectedTerms.map(t => `- "${t.term}": EN="${t.en}", ES="${t.es}", IT="${t.it}", PT="${t.pt}"`).join('\n');
  }

  let contextSnippet = '';
  if (contextHistory) {
    contextSnippet = `\nPREVIOUS SPOKEN CONTEXT (for coreference, pronoun resolution, and clinical continuity):\n"${contextHistory}"\n`;
  }

  return `You are Alibaba Qwen 3.8 (Sept 2026), the world's leading open-weights simultaneous medical interpreter specialized in clinical medicine (${medicalSpecialty}), pharmacology, ICD-11, and SNOMED-CT.
Accurately and idiomatically translate the live spoken text into English (en), Spanish (es), Italian (it), and Portuguese (pt).

CRITICAL MEDICAL & CLINICAL RULES:
1. Standardized Clinical Acronyms: Preserve critical medical acronyms (e.g. ECG, SpO2, BP/TA, HR/FC, COPD/EPOC, AMI/IAM, FiO2, CPR/RCP) according to target clinical conventions. Do NOT expand acronyms into full sentences unless required.
2. Pharmacological Accuracy: Translate all drugs using the official International Nonproprietary Name (INN / DCI).
3. ICD-11 & SNOMED-CT Fidelity: Maintain clinical nomenclature (e.g. "dyspnea", "acute myocardial infarction", "cholecystectomy"). Do not trivialize into overly colloquial slang.
4. Natural Spoken Rhythm: Ensure fluent phrasing suitable for real-time Text-to-Speech audio streaming.${glossaryRule}${contextSnippet}

Input text: "${speechText}"

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
    this.qwenApiKey = config.qwenApiKey || process.env.DASHSCOPE_API_KEY || process.env.OPENROUTER_API_KEY || '';
    this.qwenModel = config.qwenModel || 'qwen/qwen-3.8-27b';
    this.qwenEndpoint = config.qwenEndpoint || process.env.QWEN_ENDPOINT || '';
    this.preferredEngine = config.preferredEngine || 'auto'; // 'qwen' | 'openai' | 'google' | 'auto'

    // Medical Mode & Clinical Glossary configuration
    this.medicalMode = Boolean(config.medicalMode || process.env.MEDICAL_MODE === 'true');
    this.medicalSpecialty = config.medicalSpecialty || 'general'; // 'general' | 'cardiology' | 'pharmacology' | 'surgery'
    this.customGlossary = Array.isArray(config.customGlossary) ? config.customGlossary : [];
  }

  setApiKey(key) {
    this.openaiApiKey = key;
  }

  setMedicalConfig({ medicalMode, medicalSpecialty, customGlossary }) {
    if (medicalMode !== undefined) this.medicalMode = Boolean(medicalMode);
    if (medicalSpecialty !== undefined) this.medicalSpecialty = medicalSpecialty;
    if (customGlossary !== undefined) {
      this.customGlossary = Array.isArray(customGlossary) ? customGlossary : [];
    }
    console.log(`[TranslationService] 🩺 Clinical Mode updated: ${this.medicalMode ? 'ACTIVE' : 'OFF'} (Specialty: ${this.medicalSpecialty}, Custom Terms: ${this.customGlossary.length})`);
  }

  setQwenConfig({ apiKey, model, endpoint, preferredEngine }) {
    if (apiKey !== undefined) this.qwenApiKey = apiKey;
    if (model !== undefined) this.qwenModel = model;
    if (endpoint !== undefined) this.qwenEndpoint = endpoint;
    if (preferredEngine !== undefined) this.preferredEngine = preferredEngine;
    console.log(`[TranslationService] 🤖 Alibaba Qwen 3.8 configured (Model: ${this.qwenModel || 'qwen-3.8-27b'}, Endpoint: ${this.qwenEndpoint || 'cloud'}, Engine: ${this.preferredEngine})`);
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

    const isMedical = options.medicalMode !== undefined ? Boolean(options.medicalMode) : this.medicalMode;
    const specialty = options.medicalSpecialty || this.medicalSpecialty || 'general';
    const customGlossary = options.customGlossary || this.customGlossary || [];
    const contextHistory = options.contextHistory || '';

    // Extract clinical terms & custom abbreviations in <0.5ms
    const detectedTerms = extractDetectedMedicalTerms(cleanText, customGlossary);
    if (detectedTerms.length > 0) {
      console.log(`[TranslationService] 🩺 Detected ${detectedTerms.length} clinical term(s): ${detectedTerms.map(t => t.term).join(', ')}`);
    }

    const engine = this.preferredEngine || 'auto';
    let result = null;

    // Route A: User explicitly chose Google Neural (Instant, free, no API key needed)
    if (engine === 'google') {
      try {
        result = await this.translateWithFreeEngine(cleanText, detectedSource);
        result.latencyMs = Date.now() - startTime;
        result.engineUsed = 'Google Neural Universal';
      } catch (err) {
        console.warn('[TranslationService] Google engine failed, falling back:', err.message);
      }
    }

    // Route B: User chose Alibaba Qwen 3.8 OR auto with Qwen key
    if (!result && (engine === 'qwen' || (engine === 'auto' && this.qwenApiKey))) {
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

    // Route C: User chose OpenAI GPT-4o-mini OR auto with OpenAI key
    if (!result && (engine === 'openai' || (engine === 'auto' && this.openaiApiKey))) {
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

    // Default Fallback: Ultra-Fast Free Web Translation Engine (Google Neural with sl=auto)
    if (!result) {
      try {
        result = await this.translateWithFreeEngine(cleanText, detectedSource);
        result.latencyMs = Date.now() - startTime;
        result.engineUsed = 'Google Neural Universal';
      } catch (err) {
        console.warn('[TranslationService] Free engine fallback failed, using built-in matcher:', err.message);
      }
    }

    if (!result) {
      result = this.fallbackTranslate(cleanText, detectedSource);
      result.latencyMs = Date.now() - startTime;
      result.engineUsed = 'Offline Fallback';
    }

    // Post-process to guarantee canonical uppercase for medical acronyms
    if (detectedTerms.length > 0 && result && result.translations) {
      result.translations = postProcessClinicalTerms(result.translations, detectedTerms);
    }

    return result;
  }

  async translateWithQwen(text, detectedSource, options = {}) {
    const customEndpoint = (this.qwenEndpoint || process.env.QWEN_ENDPOINT || '').trim();
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

    let systemPrompt;
    if (medicalMode || detectedTerms.length > 0) {
      systemPrompt = buildQwenMedicalPrompt(text, detectedTerms, contextHistory, medicalSpecialty);
    } else {
      let contextLine = contextHistory ? `\nContext: "${contextHistory}"\n` : '';
      systemPrompt = `You are Alibaba Qwen 3.8 (Sept 2026), the world's leading open-weights simultaneous conference interpreter.
Accurately and idiomatically translate the spoken text into English (en), Spanish (es), Italian (it), and Portuguese (pt).
Maintain natural conversational spoken rhythm.${contextLine}

Input text: "${text}"

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
        temperature: 0.2,
        max_tokens: 300
      }),
      signal: AbortSignal.timeout(5500)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Qwen API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const rawContent = data.choices[0]?.message?.content || '{}';
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const jsonClean = jsonMatch ? jsonMatch[0] : rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed = {};
    try {
      parsed = JSON.parse(jsonClean);
    } catch (e) {
      console.warn('[TranslationService] Qwen JSON parsing error:', e.message);
    }

    const defaultTranslations = {
      en: text, es: text, it: text, pt: text, fr: text, de: text, zh: text, ja: text, ar: text, ru: text, ko: text, hi: text
    };

    return {
      detectedSource: parsed.detectedSource || detectedSource || 'auto',
      translations: {
        ...defaultTranslations,
        ...(parsed.translations || {})
      }
    };
  }

  async translateWithOpenAI(text, detectedSource, options = {}) {
    const { detectedTerms = [], medicalMode = false, medicalSpecialty = 'general', contextHistory = '' } = options;

    let prompt;
    if (medicalMode || detectedTerms.length > 0) {
      let glossaryRule = '';
      if (detectedTerms.length > 0) {
        glossaryRule = `\nMANDATORY CLINICAL GLOSSARY RESTRICTIONS:\n` +
          detectedTerms.map(t => `- "${t.term}": EN="${t.en}", ES="${t.es}", IT="${t.it}", PT="${t.pt}"`).join('\n');
      }
      let contextSnippet = contextHistory ? `\nPREVIOUS SPOKEN CONTEXT: "${contextHistory}"\n` : '';

      prompt = `You are an elite simultaneous medical conference interpreter specialized in clinical medicine (${medicalSpecialty}), pharmacology, ICD-11, and SNOMED-CT.
Accurately translate the spoken text into English (en), Spanish (es), Italian (it), and Portuguese (pt).
Preserve standardized clinical acronyms (e.g. ECG, SpO2, BP/TA, HR/FC, COPD/EPOC, AMI/IAM).
Translate all drugs using the official International Nonproprietary Name (INN / DCI).
Maintain spoken rhythm suitable for immediate Text-to-Speech audio streaming.${glossaryRule}${contextSnippet}

Input text: "${text}"

Respond ONLY with valid JSON in this exact structure:
{
  "detectedSource": "es" (or "en", "it", "pt"),
  "translations": {
    "en": "English translation",
    "es": "Spanish translation",
    "it": "Italian translation",
    "pt": "Portuguese translation"
  }
}`;
    } else {
      let contextLine = contextHistory ? `\nContext: "${contextHistory}"\n` : '';
      prompt = `You are a real-time conference simultaneous interpreter. Translate the following speech text accurately and naturally into English (en), Spanish (es), Italian (it), and Portuguese (pt).
Maintain tone, context, and brevity suitable for immediate speech-to-speech audio synthesis.${contextLine}

Input text: "${text}"

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
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 300
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data.choices[0]?.message?.content;
    const parsed = JSON.parse(content);
    return {
      detectedSource: parsed.detectedSource || detectedSource || 'auto',
      translations: {
        en: parsed.translations?.en || text,
        es: parsed.translations?.es || text,
        it: parsed.translations?.it || text,
        pt: parsed.translations?.pt || text
      }
    };
  }

  /**
   * Fast free multi-language translator using public translation API
   */
  async translateWithFreeEngine(text, detectedSource, customTargets = null) {
    const targets = customTargets || ['en', 'es', 'it', 'pt', 'fr', 'de', 'zh', 'ja', 'ar', 'ru', 'ko', 'hi'];
    const translations = {};
    let realDetectedSource = (detectedSource && detectedSource !== 'auto') ? detectedSource.slice(0, 2).toLowerCase() : null;

    // Parallel fetch for all target languages using sl=auto for universal detection
    await Promise.all(
      targets.map(async (targetLang) => {
        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
          const response = await fetch(url, { signal: AbortSignal.timeout(2400) });
          if (response.ok) {
            const data = await response.json();
            if (data && data[0] && Array.isArray(data[0])) {
              const translatedStr = data[0].map(item => item[0]).join('').trim();
              if (translatedStr) {
                translations[targetLang] = translatedStr;
              }
              if (data[2] && (!realDetectedSource || realDetectedSource === 'auto')) {
                realDetectedSource = data[2].toLowerCase();
              }
              return;
            }
          }
        } catch (e) {
          // ignore error and fallback
        }

        // Fallback if fetch timed out or failed
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
      detectedSource: realDetectedSource || this.detectRoughLanguage(text) || 'auto',
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
