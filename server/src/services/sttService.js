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
    const key = options.deepgramApiKey || this.deepgramApiKey;
    if (!key) throw new Error('No Deepgram API key configured');

    const effectiveLang = (language && language !== 'auto') ? language : (this.sttLanguage && this.sttLanguage !== 'auto' ? this.sttLanguage : null);
    const cleanLang = effectiveLang ? effectiveLang.slice(0, 2).toLowerCase() : null;
    // Nova-2 is Deepgram's multi-lingual model supporting auto-detection across 30+ languages
    const model = (cleanLang === 'en') ? 'nova-3' : 'nova-2';
    let url = `https://api.deepgram.com/v1/listen?model=${model}&smart_format=true&punctuate=true`;
    if (cleanLang) {
      url += `&language=${cleanLang}`;
    } else {
      url += '&detect_language=true';
    }

    const vadSensitivity = options.sttVad || this.sttVad || 'standard';
    if (vadSensitivity === 'aggressive') {
      url += '&utterance_end_ms=1500&vad_turnoff=800';
    } else if (vadSensitivity === 'high') {
      url += '&utterance_end_ms=800&vad_turnoff=400';
    } else {
      url += '&utterance_end_ms=1000';
    }

    if (options.medicalMode) {
      url += '&keywords=ECG:2&keywords=arritmia:2&keywords=infarto:2&keywords=fentanilo:2';
    }

    const cleanMime = mimeType ? mimeType.split(';')[0].trim() : 'audio/webm';

    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${key}`,
        'Content-Type': cleanMime
      },
      body: audioBuffer,
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok && url.includes('nova-3')) {
      const fallbackUrl = url.replace('nova-3', 'nova-2');
      res = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${key}`,
          'Content-Type': cleanMime
        },
        body: audioBuffer,
        signal: AbortSignal.timeout(8000)
      });
    }

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

    const formData = new FormData();
    const extension = mimeType.includes('wav') ? 'wav'
      : mimeType.includes('mp3') ? 'mp3'
      : (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) ? 'm4a'
      : mimeType.includes('ogg') ? 'ogg'
      : 'webm';
    formData.append('file', audioBuffer, {
      filename: `speech.${extension}`,
      contentType: mimeType
    });
    formData.append('model', 'whisper-1');

    const isMedical = Boolean(options.medicalMode);
    const prompt = options.prompt || (isMedical ? CLINICAL_INITIAL_PROMPT : '');
    if (prompt) {
      formData.append('prompt', prompt);
    }
    formData.append('temperature', isMedical ? '0.0' : '0.2');

    const effectiveLang = (language && language !== 'auto') ? language : (this.sttLanguage && this.sttLanguage !== 'auto' ? this.sttLanguage : null);
    if (effectiveLang) {
      formData.append('language', effectiveLang.slice(0, 2).toLowerCase());
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        ...formData.getHeaders()
      },
      body: formData,
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Whisper HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return {
      text: (data.text || '').trim(),
      detectedLanguage: language !== 'auto' ? language : 'auto',
      latencyMs: Date.now() - startTime,
      engine: 'OpenAI Whisper'
    };
  }

  async transcribeWithGeminiLive(audioBuffer, mimeType = 'audio/webm', language = 'auto', options = {}) {
    const startTime = Date.now();
    const key = options.geminiApiKey || this.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('No Google Gemini API key configured for Transcribe Live');

    const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim();
    const base64Audio = audioBuffer.toString('base64');

    const promptText = options.medicalMode
      ? `${CLINICAL_INITIAL_PROMPT}\nTranscribe exactly what was spoken in this audio in real time. Return only verbatim transcribed text.`
      : 'Transcribe verbatim what is spoken in this audio. Return only the transcription without any introductory or concluding remarks.';

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
          temperature: 0.1,
          maxOutputTokens: 250
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
      engine: 'Google Gemini 3.5 Transcribe Live'
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
          const result = await this.transcribeWithDeepgram(audioBuffer, mimeType, language, options);
          if (result && result.text) return result;
        } catch (err) {
          console.warn('[STTService] Deepgram STT failed, falling back:', err.message);
        }
      } else if (eng === 'whisper' && hasWhisper) {
        try {
          const result = await this.transcribeWithWhisper(audioBuffer, mimeType, language, options);
          if (result && result.text) return result;
        } catch (err) {
          console.warn('[STTService] Whisper STT failed, falling back:', err.message);
        }
      } else if (eng === 'gemini_live' && hasGemini) {
        try {
          const result = await this.transcribeWithGeminiLive(audioBuffer, mimeType, language, options);
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
