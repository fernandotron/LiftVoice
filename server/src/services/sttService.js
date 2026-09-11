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
    this.preferredSttEngine = config.preferredSttEngine || 'deepgram';
  }

  setApiKey(openaiKey, deepgramKey = null) {
    if (openaiKey !== undefined && openaiKey !== null) {
      this.openaiApiKey = openaiKey;
    }
    if (deepgramKey !== undefined && deepgramKey !== null) {
      this.deepgramApiKey = deepgramKey;
    }
  }

  setPreferredEngine(engine) {
    if (engine) this.preferredSttEngine = engine;
  }

  async transcribeWithDeepgram(audioBuffer, mimeType = 'audio/webm', language = 'auto', options = {}) {
    const startTime = Date.now();
    const key = options.deepgramApiKey || this.deepgramApiKey;
    if (!key) throw new Error('No Deepgram API key configured');

    const cleanLang = (language && language !== 'auto') ? language.slice(0, 2).toLowerCase() : null;
    // Nova-2 is Deepgram's multi-lingual model supporting auto-detection across 30+ languages
    const model = (cleanLang === 'en') ? 'nova-3' : 'nova-2';
    let url = `https://api.deepgram.com/v1/listen?model=${model}&smart_format=true&punctuate=true`;
    if (cleanLang) {
      url += `&language=${cleanLang}`;
    } else {
      url += '&detect_language=true';
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
    const extension = mimeType.includes('wav') ? 'wav' : mimeType.includes('mp3') ? 'mp3' : 'webm';
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

    if (language && language !== 'auto') {
      formData.append('language', language);
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

  /**
   * Transcribes an audio buffer using Deepgram (default) or OpenAI Whisper
   */
  async transcribeAudio(audioBuffer, mimeType = 'audio/webm', language = 'auto', options = {}) {
    if (!audioBuffer || audioBuffer.length === 0) return null;

    const preferredEngine = options.preferredSttEngine || this.preferredSttEngine || 'deepgram';

    // 1. Deepgram (Default - ultra-low latency ~150ms)
    if (preferredEngine === 'deepgram' || !this.openaiApiKey) {
      if (this.deepgramApiKey || options.deepgramApiKey) {
        try {
          const result = await this.transcribeWithDeepgram(audioBuffer, mimeType, language, options);
          if (result && result.text) {
            return result;
          }
        } catch (err) {
          console.warn('[STTService] Deepgram STT failed, trying Whisper:', err.message);
        }
      }
    }

    // 2. OpenAI Whisper
    if (this.openaiApiKey || options.openaiApiKey) {
      try {
        const result = await this.transcribeWithWhisper(audioBuffer, mimeType, language, options);
        if (result && result.text) {
          return result;
        }
      } catch (err) {
        console.warn('[STTService] Whisper STT failed:', err.message);
      }
    }

    return null;
  }
}

export const sttService = new STTService();
