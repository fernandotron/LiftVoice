import FormData from 'form-data';

/**
 * Speech-to-Text (STT) Service for LiftVoice
 * Handles transcription of live audio buffers from the speaker with medical priming
 */

const CLINICAL_INITIAL_PROMPT =
  "Sesión clínica de medicina interna, cardiología, anestesia y farmacología. " +
  "Parámetros clínicos: ECG, EKG, SpO2 98%, TA 120/80 mmHg, FC 75 lpm, PVC, SatO2, FiO2, gasometría arterial. " +
  "Farmacología: amiodarona, enoxaparina sódica, noradrenalina, atropina, midazolam, fentanilo, propofol, levotiroxina, nitroglicerina. " +
  "Patologías CIE-11 y SNOMED CT: infarto agudo de miocardio, fibrilación auricular, EPOC descompensado, tromboembolismo pulmonar, shock cardiogénico.";

/**
 * Detecta el tipo MIME real de un buffer de audio examinando sus magic bytes.
 * Soporta: audio/webm, audio/mp4, audio/wav, audio/ogg.
 *
 * @param {Buffer|Uint8Array} rawBuffer - Buffer de audio binario
 * @param {string} [fallback='audio/webm'] - Tipo MIME de respaldo
 * @returns {string} Tipo MIME detectado ('audio/webm' | 'audio/mp4' | 'audio/wav' | 'audio/ogg')
 */
export function detectAudioMimeType(rawBuffer, fallback = 'audio/webm') {
  if (!rawBuffer) return fallback;
  const buf = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
  if (!buf || buf.length < 4) return fallback;

  // 1. WebM / Matroska (EBML ID: 0x1A 0x45 0xDF 0xA3)
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'audio/webm';
  }

  // 2. Ogg Container ('OggS' / 0x4F 0x67 0x67 0x53)
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    return 'audio/ogg';
  }

  // 3. RIFF WAV ('RIFF' en bytes 0..3 y 'WAVE' en bytes 8..11)
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45
  ) {
    return 'audio/wav';
  }

  // 4. MP4 / M4A (ISOBMFF 'ftyp', 'moov', 'moof', 'styp' en bytes 4..7 o 'ftyp' en 0..3)
  if (buf.length >= 8) {
    const boxType = buf.toString('ascii', 4, 8);
    if (boxType === 'ftyp' || boxType === 'moov' || boxType === 'moof' || boxType === 'styp') {
      return 'audio/mp4';
    }
  }
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'ftyp') {
    return 'audio/mp4';
  }
  // Tramas ADTS AAC (syncword 0xFFF)
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xf0) === 0xf0) {
    return 'audio/mp4';
  }

  return fallback;
}

export class STTService {
  constructor(config = {}) {
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY || '';
    this.deepgramApiKey = config.deepgramApiKey || process.env.DEEPGRAM_API_KEY || '';
    this.geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY || '';
    this.preferredSttEngine = config.preferredSttEngine || 'deepgram';
    this.sttLanguage = config.sttLanguage || 'auto';
    this.sttVad = config.sttVad || 'standard';
  }

  setApiKey(openaiKey, deepgramKey = null, geminiKey = null) {
    if (openaiKey !== undefined && openaiKey !== null) {
      this.openaiApiKey = openaiKey;
    }
    if (deepgramKey !== undefined && deepgramKey !== null) {
      this.deepgramApiKey = deepgramKey;
    }
    if (geminiKey !== undefined && geminiKey !== null) {
      this.geminiApiKey = geminiKey;
    }
  }

  setPreferredEngine(engine) {
    if (engine) this.preferredSttEngine = engine;
  }

  setLanguage(lang) {
    if (lang !== undefined) {
      this.sttLanguage = lang;
      console.log(`[STTService] 🎙️ Language configured: ${this.sttLanguage}`);
    }
  }

  setVad(vad) {
    if (vad !== undefined) {
      this.sttVad = vad;
      console.log(`[STTService] 🎙️ VAD sensitivity configured: ${this.sttVad}`);
    }
  }

  async transcribeWithDeepgram(audioBuffer, mimeType = 'audio/webm', language = 'auto', options = {}) {
    const startTime = Date.now();
    const key = options.deepgramApiKey || this.deepgramApiKey || process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error('No Deepgram API key configured');

    const cleanMime = detectAudioMimeType(audioBuffer, mimeType ? mimeType.split(';')[0].trim() : 'audio/webm');

    const effectiveLang = (language && language !== 'auto') ? language : (this.sttLanguage && this.sttLanguage !== 'auto' ? this.sttLanguage : null);
    let cleanLang = null;
    if (effectiveLang) {
      const lower = effectiveLang.toLowerCase().trim();
      if (lower.startsWith('es') || ['es', 'es-es', 'es-419', 'es-mx'].includes(lower)) {
        cleanLang = 'es';
      } else if (lower.startsWith('pt')) {
        cleanLang = lower.includes('br') ? 'pt-BR' : 'pt';
      } else if (lower.startsWith('en')) {
        cleanLang = 'en';
      } else if (lower.startsWith('it')) {
        cleanLang = 'it';
      } else if (lower === 'multi') {
        cleanLang = 'multi';
      } else if (lower !== 'auto') {
        cleanLang = lower.slice(0, 2);
      }
    }

    // Optimización Nova-3: Cuando se define idioma explícito usarlo directamente;
    // si language === 'auto', delegar en detect_language=true para auto-clasificación acústica
    const model = options.model || 'nova-3';
    let langParam = '';
    if (cleanLang === 'multi') {
      langParam = '&language=multi';
    } else if (cleanLang && cleanLang !== 'auto') {
      langParam = `&language=${cleanLang}`;
    } else {
      langParam = '&detect_language=true';
    }
    let url = `https://api.deepgram.com/v1/listen?model=${model}&smart_format=true&punctuate=true${langParam}`;

    if (options.medicalMode) {
      if (model === 'nova-3') {
        url += '&keyterm=ECG&keyterm=arritmia&keyterm=infarto&keyterm=fentanilo';
      } else {
        url += '&keywords=ECG:2&keywords=arritmia:2&keywords=infarto:2&keywords=fentanilo:2';
      }
    }

    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${key}`,
        'Content-Type': cleanMime
      },
      body: audioBuffer,
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Deepgram HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const alt = data.results?.channels?.[0]?.alternatives?.[0];
    const transcript = (alt?.transcript || '').trim();
    const detected = data.results?.channels?.[0]?.detected_language || cleanLang || 'es';

    return {
      text: transcript,
      detectedLanguage: detected,
      confidence: alt?.confidence || 0.95,
      latencyMs: Date.now() - startTime,
      engine: 'Deepgram Nova'
    };
  }

  async transcribeWithWhisper(audioBuffer, mimeType = 'audio/webm', language = 'auto', options = {}) {
    const startTime = Date.now();
    const key = options.openaiApiKey || this.openaiApiKey;
    if (!key) throw new Error('No OpenAI API key configured');

    const resolvedMime = detectAudioMimeType(audioBuffer, mimeType);
    const formData = new FormData();
    const extension = resolvedMime.includes('wav') ? 'wav'
      : resolvedMime.includes('mp3') ? 'mp3'
      : (resolvedMime.includes('mp4') || resolvedMime.includes('m4a') || resolvedMime.includes('aac')) ? 'm4a'
      : resolvedMime.includes('ogg') ? 'ogg'
      : 'webm';
    formData.append('file', audioBuffer, {
      filename: `speech.${extension}`,
      contentType: resolvedMime
    });
    formData.append('model', 'whisper-1');

    const isMedical = Boolean(options.medicalMode);
    const prompt = options.prompt || (isMedical ? CLINICAL_INITIAL_PROMPT : '');
    if (prompt) {
      formData.append('prompt', prompt);
    }
    formData.append('temperature', isMedical ? '0.0' : '0.2');

    // Forzado monolingüe en Whisper cuando se define un idioma explícito; si es 'auto', omitir para auto-detección nativa
    const candidateLang = (language && language !== 'auto')
      ? language
      : (options.language && options.language !== 'auto'
          ? options.language
          : (this.sttLanguage && this.sttLanguage !== 'auto' ? this.sttLanguage : null));

    if (candidateLang) {
      const lower = String(candidateLang).toLowerCase().trim();
      let whisperLang = null;
      if (lower.startsWith('es') || ['es', 'es-es', 'es-419', 'es-mx', 'spanish'].includes(lower)) {
        whisperLang = 'es';
      } else if (lower.startsWith('pt')) {
        whisperLang = 'pt';
      } else if (lower.startsWith('en')) {
        whisperLang = 'en';
      } else if (lower.startsWith('it')) {
        whisperLang = 'it';
      } else if (lower.startsWith('fr')) {
        whisperLang = 'fr';
      } else if (lower.startsWith('de')) {
        whisperLang = 'de';
      } else if (lower !== 'auto' && lower !== 'multi') {
        whisperLang = lower.slice(0, 2);
      }
      if (whisperLang) {
        formData.append('language', whisperLang);
      }
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        ...formData.getHeaders()
      },
      body: formData.getBuffer(),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Whisper HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return {
      text: (data.text || '').trim(),
      detectedLanguage: whisperLang,
      confidence: 0.96,
      latencyMs: Date.now() - startTime,
      engine: 'OpenAI Whisper-1'
    };
  }

  async transcribeWithGeminiLive(audioBuffer, mimeType = 'audio/webm', language = 'auto', options = {}) {
    const startTime = Date.now();
    const key = options.geminiApiKey || this.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('No Google Gemini API key configured for Transcribe Live');

    const cleanMime = detectAudioMimeType(audioBuffer, (mimeType || 'audio/webm').split(';')[0].trim());
    const base64Audio = audioBuffer.toString('base64');

    const isMedical = Boolean(options.medicalMode);
    const strictSpanishPrompt =
      "Transcribe de forma estrictamente literal todo lo que se dice en este audio en español.\n" +
      "REGLAS OBLIGATORIAS:\n" +
      "1. NO traduzcas al inglés ni a ningún otro idioma bajo ninguna circunstancia. El texto DEBE permanecer en español exacto.\n" +
      "2. Devuelve ÚNICAMENTE el texto literal pronunciado por el hablante.\n" +
      "3. NO incluyas introducciones, ni comentarios, ni formato markdown, ni prefijos como 'Transcripción:', ni comillas.";

    const promptText = isMedical
      ? `${CLINICAL_INITIAL_PROMPT}\n\n${strictSpanishPrompt}`
      : strictSpanishPrompt;

    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-live:generateContent';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptText },
              {
                inline_data: {
                  mime_type: cleanMime,
                  data: base64Audio
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.0,
          maxOutputTokens: 300
        }
      }),
      signal: AbortSignal.timeout(7000)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini Transcribe Live error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    const effectiveLang = (language && language !== 'auto') ? language : (this.sttLanguage && this.sttLanguage !== 'auto' ? this.sttLanguage : 'es');

    return {
      text: transcript,
      detectedLanguage: effectiveLang,
      confidence: 0.98,
      latencyMs: Date.now() - startTime,
      engine: 'Google Gemini 3.8 Transcribe Live'
    };
  }

  /**
   * Transcribes an audio buffer using Deepgram (Nova-3), Google Gemini Live, or OpenAI Whisper
   * Supports resilient cascading fallbacks across configured keys
   */
  async transcribeAudio(rawBuffer, mimeType = 'audio/webm', language = 'auto', options = {}) {
    if (!rawBuffer) return null;
    const audioBuffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer);
    if (!audioBuffer || audioBuffer.length < 400) {
      return null;
    }

    const resolvedMime = detectAudioMimeType(audioBuffer, mimeType || 'audio/webm');
    const preferredEngine = options.preferredSttEngine || this.preferredSttEngine || 'deepgram';

    const hasDeepgram = Boolean(options.deepgramApiKey || this.deepgramApiKey || process.env.DEEPGRAM_API_KEY);
    const hasWhisper = Boolean(options.openaiApiKey || this.openaiApiKey || process.env.OPENAI_API_KEY);
    const hasGemini = Boolean(options.geminiApiKey || this.geminiApiKey || process.env.GEMINI_API_KEY);

    // Build hierarchical cascade order based on preferredEngine and available keys
    const candidateEngines = [];
    if (preferredEngine === 'whisper') {
      candidateEngines.push('whisper', 'deepgram', 'gemini_live');
    } else if (preferredEngine === 'gemini_live') {
      candidateEngines.push('gemini_live', 'deepgram', 'whisper');
    } else {
      // Default: deepgram first
      candidateEngines.push('deepgram', 'whisper', 'gemini_live');
    }

    for (const eng of candidateEngines) {
      if (eng === 'deepgram' && hasDeepgram) {
        try {
          const result = await this.transcribeWithDeepgram(audioBuffer, resolvedMime, language, options);
          if (result && result.text) return result;
        } catch (err) {
          console.warn('[STTService] Deepgram STT failed, falling back:', err.message);
        }
      } else if (eng === 'whisper' && hasWhisper) {
        try {
          const result = await this.transcribeWithWhisper(audioBuffer, resolvedMime, language, options);
          if (result && result.text) return result;
        } catch (err) {
          console.warn('[STTService] Whisper STT failed, falling back:', err.message);
        }
      } else if (eng === 'gemini_live' && hasGemini) {
        try {
          const result = await this.transcribeWithGeminiLive(audioBuffer, resolvedMime, language, options);
          if (result && result.text) return result;
        } catch (err) {
          console.warn('[STTService] Gemini Live STT failed, falling back:', err.message);
        }
      }
    }

    return null;
  }
}

export const sttService = new STTService();
