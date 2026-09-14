import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

/**
 * Text-to-Speech (TTS) Service for LiftVoice
 * Generates low-latency voice audio streams for [EN, ES, IT, PT]
 */

export class TTSService {
  constructor(config = {}) {
    this._openaiApiKey = config.openaiApiKey || null;
    this._elevenLabsApiKey = config.elevenLabsApiKey || null;
    this._deepgramApiKey = config.deepgramApiKey || null;
    this._cartesiaApiKey = config.cartesiaApiKey || null;
    this._qwenApiKey = config.qwenApiKey || null;
    this._qwenTtsEndpoint = config.qwenTtsEndpoint || null;
    this.preferredTtsEngine = config.preferredTtsEngine || 'auto'; // 'auto' | 'edge' | 'deepgram' | 'cartesia' | 'google' | 'qwen_tts' | 'elevenlabs' | 'openai'

    // Voice mapping for natural multilingual personas
    this.voiceMap = {
      en: { openai: 'alloy', edge: 'en-US-JennyNeural', eleven: '21m00Tcm4TlvDq8ikWAM', deepgram: 'aura-2-thalia-en', cartesia: '794f9389-aac1-45b6-b726-9d9369183238', qwen_tts: 'qwen3-tts-en' },
      es: { openai: 'nova', edge: 'es-ES-ElviraNeural', eleven: 'AZnzlk1XvdvUeBnXmlld', deepgram: 'aura-2-carina-es', cartesia: 'a0e99841-438c-4a64-b679-ae501e7d6091', qwen_tts: 'qwen3-tts-es' },
      it: { openai: 'shimmer', edge: 'it-IT-ElsaNeural', eleven: 'EXAVITQu4vr4xnSDxMaL', deepgram: 'aura-2-diana-it', cartesia: '5345cf08-6fba-4089-a296-ee1a9673a726', qwen_tts: 'qwen3-tts-it' },
      pt: { openai: 'echo', edge: 'pt-BR-FranciscaNeural', eleven: 'pNInz6obpgDQGcFmaJgB', deepgram: 'aura-asteria-en', cartesia: '4c65db53-8417-48f8-8422-af1f26ec5809', qwen_tts: 'qwen3-tts-pt' },
      fr: { openai: 'shimmer', edge: 'fr-FR-DeniseNeural', eleven: '21m00Tcm4TlvDq8ikWAM', deepgram: 'aura-asteria-en' },
      de: { openai: 'alloy', edge: 'de-DE-KatjaNeural', eleven: 'pNInz6obpgDQGcFmaJgB', deepgram: 'aura-asteria-en' },
      zh: { openai: 'nova', edge: 'zh-CN-XiaoxiaoNeural', eleven: '21m00Tcm4TlvDq8ikWAM', deepgram: 'aura-asteria-en' },
      ja: { openai: 'shimmer', edge: 'ja-JP-NanamiNeural', eleven: 'AZnzlk1XvdvUeBnXmlld', deepgram: 'aura-asteria-en' },
      ar: { openai: 'echo', edge: 'ar-SA-ZariyahNeural', eleven: 'pNInz6obpgDQGcFmaJgB', deepgram: 'aura-asteria-en' },
      ru: { openai: 'onyx', edge: 'ru-RU-SvetlanaNeural', eleven: 'pNInz6obpgDQGcFmaJgB', deepgram: 'aura-asteria-en' },
      ko: { openai: 'nova', edge: 'ko-KR-SunHiNeural', eleven: 'AZnzlk1XvdvUeBnXmlld', deepgram: 'aura-asteria-en' },
      hi: { openai: 'alloy', edge: 'hi-IN-SwaraNeural', eleven: '21m00Tcm4TlvDq8ikWAM', deepgram: 'aura-asteria-en' }
    };

    // User-configured voice choices per language (Canonical Neural Defaults)
    this.voiceConfig = {
      es: 'es-ES-ElviraNeural',
      en: 'aura-2-thalia-en',
      it: 'it-IT-ElsaNeural',
      pt: 'pt-BR-FranciscaNeural',
      fr: 'fr-FR-DeniseNeural',
      de: 'de-DE-KatjaNeural',
      zh: 'zh-CN-XiaoxiaoNeural',
      ja: 'ja-JP-NanamiNeural',
      ar: 'ar-SA-ZariyahNeural',
      ru: 'ru-RU-SvetlanaNeural',
      ko: 'ko-KR-SunHiNeural',
      hi: 'hi-IN-SwaraNeural',
      ...(config.voiceConfig || {})
    };

    this.voiceGender = {
      en: 'female',
      es: 'female',
      it: 'female',
      pt: 'female',
      fr: 'female',
      de: 'female',
      zh: 'female',
      ja: 'female',
      ar: 'female',
      ru: 'female',
      ko: 'female',
      hi: 'female',
      ...(config.voiceGender || {})
    };

    // Bounded in-memory cache to prevent memory leaks (Max 120 entries)
    this.cache = new Map();
    this.maxCacheSize = 120;

    // Circuit Breakers for cloud TTS providers (ElevenLabs & OpenAI) to prevent timeout storms on 401, 402, 429
    this.circuitBreakers = new Map(); // provider -> timestamp ms when cooldown expires
  }

  isCircuitOpen(provider) {
    const cooldownUntil = this.circuitBreakers?.get(provider) || 0;
    return Date.now() < cooldownUntil;
  }

  tripCircuit(provider, status, durationMs = 4 * 60 * 1000) {
    const until = Date.now() + durationMs;
    if (!this.circuitBreakers) this.circuitBreakers = new Map();
    this.circuitBreakers.set(provider, until);
    console.warn(`[TTSService] 🚨 Circuit breaker tripped for ${provider} (HTTP ${status}). Cooling down for ${Math.round(durationMs / 60000)} minutes.`);
  }

  get openaiApiKey() {
    return (this._openaiApiKey !== null && this._openaiApiKey !== undefined) ? this._openaiApiKey : (process.env.OPENAI_API_KEY || '');
  }
  set openaiApiKey(val) {
    this._openaiApiKey = val;
  }

  get elevenLabsApiKey() {
    return (this._elevenLabsApiKey !== null && this._elevenLabsApiKey !== undefined) ? this._elevenLabsApiKey : (process.env.ELEVENLABS_API_KEY || '');
  }
  set elevenLabsApiKey(val) {
    this._elevenLabsApiKey = val;
  }

  get deepgramApiKey() {
    return (this._deepgramApiKey !== null && this._deepgramApiKey !== undefined) ? this._deepgramApiKey : (process.env.DEEPGRAM_API_KEY || '');
  }
  set deepgramApiKey(val) {
    this._deepgramApiKey = val;
  }

  get cartesiaApiKey() {
    return (this._cartesiaApiKey !== null && this._cartesiaApiKey !== undefined) ? this._cartesiaApiKey : (process.env.CARTESIA_API_KEY || '');
  }
  set cartesiaApiKey(val) {
    this._cartesiaApiKey = val;
  }

  get qwenApiKey() {
    return (this._qwenApiKey !== null && this._qwenApiKey !== undefined) ? this._qwenApiKey : (process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || '');
  }
  set qwenApiKey(val) {
    this._qwenApiKey = val;
  }

  get qwenTtsEndpoint() {
    return (this._qwenTtsEndpoint !== null && this._qwenTtsEndpoint !== undefined) ? this._qwenTtsEndpoint : (process.env.QWEN_TTS_ENDPOINT || '');
  }
  set qwenTtsEndpoint(val) {
    this._qwenTtsEndpoint = val;
  }

  resetCircuit(provider) {
    if (provider) {
      this.circuitBreakers?.delete(provider);
    } else {
      this.circuitBreakers?.clear();
    }
  }

  setConfig({ openaiApiKey, elevenLabsApiKey, deepgramApiKey, cartesiaApiKey, qwenApiKey, preferredTtsEngine, voiceConfig, voiceGender, qwenTtsEndpoint }) {
    if (openaiApiKey !== undefined) {
      this.openaiApiKey = openaiApiKey;
      this.resetCircuit('openai');
      this.cache?.clear();
    }
    if (elevenLabsApiKey !== undefined) {
      this.elevenLabsApiKey = elevenLabsApiKey;
      this.resetCircuit('elevenlabs');
    }
    if (deepgramApiKey !== undefined) {
      this.deepgramApiKey = deepgramApiKey;
      this.resetCircuit('deepgram');
    }
    if (cartesiaApiKey !== undefined) {
      this.cartesiaApiKey = cartesiaApiKey;
      this.resetCircuit('cartesia');
    }
    if (qwenApiKey !== undefined) {
      this.qwenApiKey = qwenApiKey;
      this.resetCircuit('qwen_tts');
    }
    if (qwenTtsEndpoint !== undefined) {
      this.qwenTtsEndpoint = qwenTtsEndpoint;
      this.resetCircuit('qwen_tts');
    }
    if (preferredTtsEngine !== undefined) this.preferredTtsEngine = preferredTtsEngine;
    if (voiceConfig !== undefined) this.voiceConfig = { ...this.voiceConfig, ...voiceConfig };
    if (voiceGender !== undefined) this.voiceGender = { ...this.voiceGender, ...voiceGender };
    console.log(`[TTSService] 🎙️ Config updated: Engine=${this.preferredTtsEngine}, Deepgram=${!!this.deepgramApiKey}, Cartesia=${!!this.cartesiaApiKey}, ElevenLabs=${!!this.elevenLabsApiKey}, OpenAI=${!!this.openaiApiKey}, QwenTTS=${!!this.qwenTtsEndpoint}`);
  }

  setApiKey(openaiKey, elevenLabsKey = null) {
    if (openaiKey !== undefined && openaiKey !== null) {
      this.openaiApiKey = openaiKey;
      this.resetCircuit('openai');
    }
    if (elevenLabsKey !== undefined && elevenLabsKey !== null) {
      this.elevenLabsApiKey = elevenLabsKey;
      this.resetCircuit('elevenlabs');
    }
  }

  setElevenLabsApiKey(key) {
    this.elevenLabsApiKey = key;
    this.resetCircuit('elevenlabs');
  }

  setDeepgramApiKey(key) {
    this.deepgramApiKey = key;
  }

  getCache(key) {
    if (!this.cache.has(key)) return null;
    const item = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, item);
    return item;
  }

  setCache(key, value) {
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  /**
   * Sanitizes speech text so voice models ONLY read the pure utterance cleanly,
   * with zero preambles, no bracketed notes, no markdown symbols, and no emojis.
   */
  cleanTextForTTS(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text.trim();

    // 1. Remove ANSI escape sequences (terminal control codes)
    cleaned = cleaned.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, ' ');

    // 2. Remove XML 1.0 disallowed C0 and C1 control characters (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F-0x9F)
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');

    // 3. Remove invisible zero-width characters, Trojan Source and Bidi Overrides (\u200B-\u200F, \u202A-\u202E, \u2060-\u2069, etc.)
    cleaned = cleaned.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u00A0\u180E\uFFF9-\uFFFB]/gu, ' ');

    // 2. Unescape common HTML entities so engines don't read "&amp;" as "ampersand a m p punto y coma"
    cleaned = cleaned
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'");

    // 3. Remove direct URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, ' ');

    // 4. Remove XML/HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');

    // 5. Remove markdown links [text](url) -> text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 6. Remove bracketed speaker or meta tags like [Speaker]:, [Audience]:, [Nota: ...], (Pausa), etc.
    cleaned = cleaned.replace(/\[[^\]]*(?:speaker|audience|asistente|ponente|host|nota|pausa|silencio|risas|aplausos)[^\]]*\]/gi, ' ');
    cleaned = cleaned.replace(/\([^\)]*(?:pausa|silencio|nota|risas|aplausos)[^\)]*\)/gi, ' ');

    // 7. Strip isolated brackets leaving inner text intact
    cleaned = cleaned.replace(/[\[\]]/g, ' ');

    // 8. Remove markdown syntax: asterisks (*bold*, **bold**), underscores (_italic_), hashtags (### header), backticks (`code`)
    cleaned = cleaned.replace(/[*_#`~]/g, '');

    // 7. Strip emojis and non-standard symbols that TTS engines read out phonetically
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    // 8. Replace mathematical symbols, bullets and redundant slashes (e.g. "headache / cephalea" -> "headache, cephalea")
    cleaned = cleaned.replace(/(?<=\p{L})\s*\/\s*(?=\p{L})/gu, ', ');
    cleaned = cleaned.replace(/\s+\/\s+/g, ', ');
    cleaned = cleaned.replace(/[±≠≈×÷∑√≤≥=<>\u2022•§©®™|\\^~]/g, ' ');

    // 9. Strip typical translation, conversational preambles or speaker tags (iterative)
    const preambleRegex = /^(?:[:\s\-–—]*)(?:traducci[oó]n|translation|traduzione|tradu[cç][aã]o|en espa[nñ]ol|in english|in italiano|em portugu[eê]s|here is the translation|respuesta|speaker|host|asistente|ponente)\s*:\s*/i;
    while (preambleRegex.test(cleaned)) {
      cleaned = cleaned.replace(preambleRegex, '');
    }

    // 10. Strip any remaining leading punctuation
    cleaned = cleaned.replace(/^[:\s\-–—,]+/, '');

    // 11. Normalize commas and collapse spaces
    cleaned = cleaned.replace(/,\s*,+/g, ',');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // 12. Must have at least 2 alphanumeric characters, otherwise return empty string
    const alphaNumMatches = cleaned.match(/[\p{L}\p{N}]/gu);
    if (!alphaNumMatches || alphaNumMatches.length < 2) {
      return '';
    }

    return cleaned;
  }

  /**
   * Synthesize audio for text in specified language
   * @param {string} text - Text to speak
   * @param {string} lang - 'en' | 'es' | 'it' | 'pt'
   * @param {Object} [options] - Optional voice, gender, and engine overrides
   * @returns {Promise<{ audioBase64: string, mimeType: string, durationMs: number, latencyMs: number }>}
   */
  async synthesize(text, lang = 'en', options = {}) {
    const startTime = Date.now();
    const cleanText = this.cleanTextForTTS(text);
    if (!cleanText) return null;

    let engine = options.engine || this.preferredTtsEngine || 'auto';
    const voice = options.voice || this.voiceConfig[lang] || '';
    const gender = options.gender || this.voiceGender[lang] || 'female';

    // Auto-detect engine from voice identifier when engine is auto
    if ((engine === 'auto' || !options.engine) && voice) {
      if (typeof voice === 'string' && voice.startsWith('aura-')) {
        engine = 'deepgram';
      } else if (['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'sage', 'coral', 'ash'].includes(voice)) {
        engine = 'openai';
      } else if (typeof voice === 'string' && /^[a-zA-Z0-9]{20,22}$/.test(voice.trim())) {
        engine = 'elevenlabs';
      } else if (typeof voice === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(voice.trim())) {
        engine = 'cartesia';
      } else if (typeof voice === 'string' && (voice.includes('Neural') || /^[a-z]{2}-[A-Z]{2}-/.test(voice))) {
        engine = 'edge';
      }
    }

    const cacheKey = `${lang}:${engine}:${voice}:${gender}:${cleanText}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        latencyMs: Date.now() - startTime,
        fromCache: true
      };
    }

    // 1. Edge TTS / Azure Neural (Universal Zero-Cost Tier, also handles 'google' backward-compat)
    if (engine === 'edge' || engine === 'google') {
      try {
        const result = await this.synthesizeWithEdgeTTS(cleanText, lang, { voice, gender });
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          result.provider = engine === 'edge' ? 'edge' : 'google';
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        console.warn(`[TTSService] Edge TTS failed for ${lang} (${err.message}), falling back to public engine`);
        try {
          const result = await this.synthesizeWithFastEngine(cleanText, lang);
          if (result && result.audioBase64) {
            result.latencyMs = Date.now() - startTime;
            result.provider = 'google';
            this.setCache(cacheKey, result);
            return result;
          }
        } catch (e2) {}
      }
    }

    // 2. Cartesia Sonic (Ultra-Low Latency SSM <100ms)
    if ((engine === 'cartesia' || (engine === 'auto' && this.cartesiaApiKey)) && this.cartesiaApiKey && !this.isCircuitOpen('cartesia')) {
      try {
        const result = await this.synthesizeWithCartesia(cleanText, lang, { voice, gender });
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        if (err.status === 401 || err.status === 402 || err.status === 429) {
          this.tripCircuit('cartesia', err.status);
        }
        console.warn(`[TTSService] Cartesia Sonic failed for ${lang}:`, err.message);
      }
    }

    // 3. Qwen3-TTS / CosyVoice (Alibaba Speech API or OpenAI-compatible endpoint)
    if (engine === 'qwen_tts' && !this.isCircuitOpen('qwen_tts')) {
      try {
        const result = await this.synthesizeWithQwenTTS(cleanText, lang, { voice, gender });
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        if (err.status === 401 || err.status === 402 || err.status === 429 || (err.status && err.status >= 500)) {
          this.tripCircuit('qwen_tts', err.status);
        }
        console.warn(`[TTSService] Qwen3-TTS synthesis failed for ${lang}:`, err.message);
      }
    }

    // 4. Deepgram Aura / Aura-2 TTS (Native multilingual ES, EN, IT with ~120ms latency)
    if ((engine === 'deepgram' || (engine === 'auto' && this.deepgramApiKey)) && this.deepgramApiKey && !this.isCircuitOpen('deepgram')) {
      try {
        const result = await this.synthesizeWithDeepgram(cleanText, lang, { voice, gender });
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        if (err.status === 401 || err.status === 402 || err.status === 429) {
          this.tripCircuit('deepgram', err.status);
        }
        console.warn(`[TTSService] Deepgram Aura synthesis warning for ${lang} (${err.message}), falling back to Edge TTS`);
        try {
          const result = await this.synthesizeWithEdgeTTS(cleanText, lang, { voice, gender });
          if (result && result.audioBase64) {
            result.latencyMs = Date.now() - startTime;
            result.provider = 'deepgram-fallback-edge';
            this.setCache(cacheKey, result);
            return result;
          }
        } catch (e2) {
          try {
            const result = await this.synthesizeWithFastEngine(cleanText, lang);
            if (result && result.audioBase64) {
              result.latencyMs = Date.now() - startTime;
              result.provider = 'deepgram-fallback-google';
              this.setCache(cacheKey, result);
              return result;
            }
          } catch (e3) {}
        }
      }
    }

    // 5. ElevenLabs Flash v2.5 if API key is configured or requested and circuit is closed
    if ((engine === 'elevenlabs' || (engine === 'auto' && this.elevenLabsApiKey)) && this.elevenLabsApiKey && !this.isCircuitOpen('elevenlabs')) {
      try {
        const result = await this.synthesizeWithElevenLabs(cleanText, lang, { voice, gender });
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        if (err.status === 401 || err.status === 402 || err.status === 429) {
          this.tripCircuit('elevenlabs', err.status);
        }
        console.warn(`[TTSService] ElevenLabs synthesis failed for ${lang}:`, err.message);
      }
    }

    // 6. OpenAI TTS if API key is provided or requested and circuit is closed
    if ((engine === 'openai' || (engine === 'auto' && this.openaiApiKey)) && this.openaiApiKey && !this.isCircuitOpen('openai')) {
      try {
        const result = await this.synthesizeWithOpenAI(cleanText, lang, { voice, gender });
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        if (err.status === 401 || err.status === 402 || err.status === 429) {
          this.tripCircuit('openai', err.status);
        }
        console.warn(`[TTSService] OpenAI TTS failed for lang ${lang}:`, err.message);
      }
    }

    // 7. Resilient Universal Zero-Cost Fallback (Edge TTS -> Fast Engine)
    try {
      const result = await this.synthesizeWithEdgeTTS(cleanText, lang, { voice, gender });
      if (result && result.audioBase64) {
        result.latencyMs = Date.now() - startTime;
        result.provider = 'edge';
        this.setCache(cacheKey, result);
        return result;
      }
    } catch (err) {
      try {
        const result = await this.synthesizeWithFastEngine(cleanText, lang);
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          result.provider = 'google';
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (e2) {}
    }

    // 8. Fallback client-synthesized indicator packet
    const fallback = this.generateFallbackPayload(cleanText, lang);
    fallback.latencyMs = Date.now() - startTime;
    return fallback;
  }

  async synthesizeWithQwenTTS(text, lang, options = {}) {
    const endpoint = (this.qwenTtsEndpoint || process.env.QWEN_TTS_ENDPOINT || 'http://localhost:8000/v1/audio/speech').trim();
    if (endpoint) {
      try {
        const u = new URL(endpoint);
        if (!['http:', 'https:'].includes(u.protocol)) {
          throw new Error('Protocol must be http: or https:');
        }
        const host = u.hostname.toLowerCase();
        if (host === '169.254.169.254' || host === 'metadata.google.internal' || host.endsWith('.internal')) {
          throw new Error('Cloud metadata endpoints are prohibited');
        }
      } catch (e) {
        throw new Error(`Invalid Qwen TTS endpoint: ${e.message}`);
      }
    }
    const apiKey = this.qwenApiKey || this.openaiApiKey || process.env.DASHSCOPE_API_KEY || '';

    // Sanitize voice ID: if voice belongs to another engine, fall back to language default
    let voice = options.voice;
    if (!voice || voice.startsWith('aura-') || voice.includes('Neural') || (typeof voice === 'string' && voice.length >= 18 && !voice.includes('-'))) {
      voice = this.voiceMap[lang]?.qwen_tts || (options.gender === 'male' ? 'cosyvoice-male' : 'cosyvoice-female');
    }

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'qwen3-tts',
        input: text,
        voice: voice,
        response_format: 'mp3'
      }),
      signal: AbortSignal.timeout(2800)
    });

    if (!response.ok) {
      const err = await response.text();
      const error = new Error(`Qwen3-TTS error HTTP ${response.status}: ${err}`);
      error.status = response.status;
      throw error;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioBase64 = buffer.toString('base64');

    return {
      audioBase64,
      mimeType: 'audio/mpeg',
      text,
      lang,
      provider: 'qwen_tts',
      model: 'qwen3-tts',
      durationMs: Math.round((text.length / 15) * 1000)
    };
  }

  async synthesizeWithDeepgram(text, lang, options = {}) {
    if (!this.deepgramApiKey) throw new Error('No Deepgram API key configured');

    const auraModelMap = {
      es: options.gender === 'male' ? 'aura-2-javier-es' : 'aura-2-carina-es',
      en: options.gender === 'male' ? 'aura-orion-en' : 'aura-2-thalia-en',
      it: options.gender === 'male' ? 'aura-2-marcos-it' : 'aura-2-diana-it',
      fr: options.gender === 'male' ? 'aura-2-orion-fr' : 'aura-2-asteria-fr',
      de: options.gender === 'male' ? 'aura-2-orion-de' : 'aura-2-asteria-de'
    };

    let model = options.voice || this.voiceConfig[lang];
    if (!model || !model.startsWith('aura-')) {
      model = auraModelMap[lang] || (options.gender === 'male' ? 'aura-orion-en' : 'aura-asteria-en');
    }

    const url = `https://api.deepgram.com/v1/speak?model=${model}&encoding=mp3`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.deepgramApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(2800)
    });

    if (!response.ok) {
      const errText = await response.text();
      const err = new Error(`Deepgram Aura HTTP ${response.status}: ${errText}`);
      err.status = response.status;
      throw err;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioBase64 = buffer.toString('base64');

    return {
      audioBase64,
      mimeType: 'audio/mpeg',
      text,
      lang,
      provider: 'deepgram',
      model,
      durationMs: Math.round((text.length / 15) * 1000)
    };
  }

  async synthesizeWithElevenLabs(text, lang, options = {}) {
    // ElevenLabs voice IDs are 20-21 character alphanumeric base58 strings (e.g. 21m00Tcm4TlvDq8ikWAM, AZnzlk1XvdvUeBnXmlld)
    const isElevenId = (id) => typeof id === 'string' && /^[a-zA-Z0-9]{20,22}$/.test(id.trim());
    const requestedVoice = (options.voice && isElevenId(options.voice)) ? options.voice.trim() : null;
    const configuredVoice = (this.voiceConfig[lang] && isElevenId(this.voiceConfig[lang])) ? this.voiceConfig[lang].trim() : null;
    const voiceId = requestedVoice || configuredVoice || this.voiceMap[lang]?.eleven || '21m00Tcm4TlvDq8ikWAM';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.elevenLabsApiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      }),
      signal: AbortSignal.timeout(3500)
    });

    if (!response.ok) {
      if (response.status === 404 && voiceId !== '21m00Tcm4TlvDq8ikWAM') {
        console.warn(`[TTSService] Voice ID "${voiceId}" not found in ElevenLabs (HTTP 404). Auto-recovering with default Rachel...`);
        return this.synthesizeWithElevenLabs(text, lang, { ...options, voice: '21m00Tcm4TlvDq8ikWAM' });
      }
      const errText = await response.text();
      const err = new Error(`ElevenLabs HTTP ${response.status}: ${errText}`);
      err.status = response.status;
      throw err;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioBase64 = buffer.toString('base64');

    return {
      audioBase64,
      mimeType: 'audio/mpeg',
      text,
      lang,
      provider: 'elevenlabs',
      durationMs: Math.round((text.length / 14) * 1000)
    };
  }

  async synthesizeWithOpenAI(text, lang, options = {}) {
    let voice = options.voice || this.voiceConfig[lang];
    const validOpenAIVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'sage', 'coral', 'ash'];
    if (!voice || !validOpenAIVoices.includes(voice)) {
      const gender = options.gender || this.voiceGender[lang] || 'female';
      if (gender === 'male') {
        voice = lang === 'en' ? 'ash' : (lang === 'es' ? 'echo' : 'onyx');
      } else {
        voice = lang === 'es' ? 'nova' : (lang === 'it' ? 'shimmer' : (lang === 'pt' ? 'coral' : 'sage'));
      }
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: 1.05
      }),
      signal: AbortSignal.timeout(options.timeoutMs || 5000)
    });

    if (!response.ok) {
      const errText = await response.text();
      const err = new Error(`OpenAI TTS Error ${response.status}: ${errText}`);
      err.status = response.status;
      throw err;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioBase64 = buffer.toString('base64');

    return {
      audioBase64,
      mimeType: 'audio/mpeg',
      text,
      lang,
      provider: 'openai',
      durationMs: Math.round((text.length / 15) * 1000)
    };
  }

  /**
   * High-fidelity zero-cost synthesis using Microsoft Edge TTS (Azure Neural voices)
   */
  async synthesizeWithEdgeTTS(text, lang, options = {}) {
    const startTime = Date.now();
    const edgeVoiceMap = {
      es: options.gender === 'male' ? 'es-ES-AlvaroNeural' : 'es-ES-ElviraNeural',
      en: options.gender === 'male' ? 'en-US-GuyNeural' : 'en-US-JennyNeural',
      it: options.gender === 'male' ? 'it-IT-DiegoNeural' : 'it-IT-ElsaNeural',
      pt: options.gender === 'male' ? 'pt-BR-AntonioNeural' : 'pt-BR-FranciscaNeural',
      fr: options.gender === 'male' ? 'fr-FR-HenriNeural' : 'fr-FR-DeniseNeural',
      de: options.gender === 'male' ? 'de-DE-ConradNeural' : 'de-DE-KatjaNeural',
      zh: 'zh-CN-XiaoxiaoNeural',
      ja: 'ja-JP-NanamiNeural',
      ar: 'ar-SA-ZariyahNeural',
      ru: 'ru-RU-SvetlanaNeural',
      ko: 'ko-KR-SunHiNeural',
      hi: 'hi-IN-SwaraNeural'
    };

    let targetVoice = edgeVoiceMap[lang] || 'es-ES-ElviraNeural';
    if (typeof options.voice === 'string') {
      const candidate = options.voice.trim();
      // Whitelist estricta: Previene inyección SSML en el atributo <voice name="...">
      if (/^[a-z]{2,3}-[A-Z]{2,3}-[a-zA-Z0-9]+Neural$/.test(candidate)) {
        targetVoice = candidate;
      }
    }

    // 1. Strict XML escaping and control character purge to guarantee well-formed SSML in Azure/Bing Speech
    const escapedText = String(text || '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    if (this.isCircuitOpen('edge')) {
      throw new Error('Edge TTS circuit breaker is open (cooling down). Falling back to fast engine.');
    }

    const tts = new MsEdgeTTS();
    let currentStream = null;
    let timer = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (currentStream) {
        try {
          currentStream.removeAllListeners('data');
          currentStream.removeAllListeners('end');
          // Attach no-op error handler to prevent Unhandled 'error' event when tts.close() destroys the stream
          currentStream.on('error', () => {});
        } catch (e) {}
      }
      try {
        tts.close();
      } catch (e) {}
    };

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Edge TTS timed out after 3500ms for ${targetVoice}`));
      }, 3500);
    });

    const synthesisPromise = (async () => {
      // Both handshake and stream reception are covered within this promise
      await tts.setMetadata(targetVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      return new Promise((resolve, reject) => {
        try {
          const { audioStream } = tts.toStream(escapedText);
          if (!audioStream) {
            return reject(new Error('Edge TTS did not return an audio stream'));
          }
          currentStream = audioStream;

          const audioChunks = [];

          audioStream.on('data', (chunk) => {
            audioChunks.push(chunk);
          });

          audioStream.on('end', () => {
            currentStream = null;
            try {
              audioStream.removeAllListeners('data');
              audioStream.removeAllListeners('end');
              audioStream.on('error', () => {});
            } catch (e) {}
            const fullBuffer = Buffer.concat(audioChunks);
            if (fullBuffer.length === 0) {
              return reject(new Error('Edge TTS stream finished with empty buffer'));
            }
            resolve({
              audioBase64: fullBuffer.toString('base64'),
              mimeType: 'audio/mpeg',
              text,
              lang,
              provider: 'edge',
              voice: targetVoice,
              latencyMs: Date.now() - startTime,
              durationMs: Math.round((text.length / 15) * 1000)
            });
          });

          audioStream.on('error', (err) => {
            currentStream = null;
            try {
              audioStream.removeAllListeners('data');
              audioStream.removeAllListeners('end');
              audioStream.on('error', () => {});
            } catch (e) {}
            reject(err);
          });
        } catch (err) {
          reject(err);
        }
      });
    })();

    try {
      const result = await Promise.race([synthesisPromise, timeoutPromise]);
      cleanup();
      this.edgeConsecutiveFailures = 0;
      return result;
    } catch (err) {
      cleanup();
      this.edgeConsecutiveFailures = (this.edgeConsecutiveFailures || 0) + 1;
      if (this.edgeConsecutiveFailures >= 3 || err?.message?.includes('429') || err?.message?.includes('timed out')) {
        this.tripCircuit('edge', 429, 2 * 60 * 1000);
      }
      throw err;
    }
  }

  /**
   * Ultra-low latency synthesis with Cartesia Sonic (SSM architecture)
   */
  async synthesizeWithCartesia(text, lang, options = {}) {
    if (!this.cartesiaApiKey) throw new Error('No Cartesia API key configured');

    const cartesiaVoiceMap = {
      es: options.gender === 'male' ? '846d3575-01e4-4d89-94ae-34f3c7ae01d9' : 'a0e99841-438c-4a64-b679-ae501e7d6091',
      en: options.gender === 'male' ? 'c45bc5ec-5968-4f0b-88b0-ae6d05910801' : '794f9389-aac1-45b6-b726-9d9369183238',
      it: '5345cf08-6fba-4089-a296-ee1a9673a726',
      pt: '4c65db53-8417-48f8-8422-af1f26ec5809',
      fr: '638ef904-807d-419b-a05e-f9c3f3eb8644',
      de: '156fb8d2-335b-4950-9cb3-a2d33befec77'
    };

    const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
    const voiceId = (options.voice && isUUID(options.voice))
      ? options.voice.trim()
      : (cartesiaVoiceMap[lang] || 'a0e99841-438c-4a64-b679-ae501e7d6091');

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2024-06-10',
        'X-API-Key': this.cartesiaApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_id: 'sonic-multilingual',
        transcript: text,
        voice: {
          mode: 'id',
          id: voiceId
        },
        output_format: {
          container: 'mp3',
          sample_rate: 44100,
          bit_rate: 128000
        }
      }),
      signal: AbortSignal.timeout(2400)
    });

    if (!response.ok) {
      const errText = await response.text();
      const err = new Error(`Cartesia Sonic HTTP ${response.status}: ${errText}`);
      err.status = response.status;
      throw err;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      audioBase64: buffer.toString('base64'),
      mimeType: 'audio/mpeg',
      text,
      lang,
      provider: 'cartesia',
      voice: voiceId,
      durationMs: Math.round((text.length / 15) * 1000)
    };
  }

  splitTextIntoChunks(text, maxLen = 160) {
    if (!text || text.length <= maxLen) return [text];
    
    const clauses = text.match(/[^.!?,;:]+[.!?,;:]*/g) || [text];
    const chunks = [];
    let current = '';

    for (const clause of clauses) {
      const trimmedClause = clause.trim();
      if (!trimmedClause) continue;

      if ((current ? current + ' ' + trimmedClause : trimmedClause).length <= maxLen) {
        current = current ? current + ' ' + trimmedClause : trimmedClause;
      } else {
        if (current) chunks.push(current);
        if (trimmedClause.length <= maxLen) {
          current = trimmedClause;
        } else {
          const words = trimmedClause.split(/\s+/);
          let wordChunk = '';
          for (const w of words) {
            if ((wordChunk ? wordChunk + ' ' + w : w).length <= maxLen) {
              wordChunk = wordChunk ? wordChunk + ' ' + w : w;
            } else {
              if (wordChunk) chunks.push(wordChunk);
              wordChunk = w;
            }
          }
          current = wordChunk;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Fast free audio synthesis endpoint for instant streaming without API keys
   */
  async synthesizeWithFastEngine(text, lang) {
    const langCodes = {
      en: 'en',
      es: 'es',
      it: 'it',
      pt: 'pt'
    };
    const code = langCodes[lang] || 'en';
    const textChunks = this.splitTextIntoChunks(text, 160);

    const audioBuffers = await Promise.all(
      textChunks.map(async (chunk) => {
        const encoded = encodeURIComponent(chunk);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${code}&client=tw-ob`;

        let chunkBuffer = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              },
              signal: AbortSignal.timeout(3500)
            });

            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              chunkBuffer = Buffer.from(arrayBuffer);
              break;
            } else if (attempt === 2) {
              console.warn(`[TTSService] Public TTS chunk attempt ${attempt} returned HTTP ${response.status}`);
            }
          } catch (e) {
            if (attempt === 2) {
              console.warn(`[TTSService] Public TTS chunk attempt ${attempt} failed for lang ${lang}:`, e.message);
            }
          }
        }
        return chunkBuffer;
      })
    );

    const validBuffers = audioBuffers.filter(b => b && Buffer.isBuffer(b) && b.length > 0);
    if (validBuffers.length === 0) {
      throw new Error(`All public TTS chunks failed for ${lang}`);
    }

    const combinedBuffer = Buffer.concat(validBuffers);
    const audioBase64 = combinedBuffer.toString('base64');

    return {
      audioBase64,
      mimeType: 'audio/mpeg',
      text,
      lang,
      durationMs: Math.round((text.length / 15) * 1000)
    };
  }

  generateFallbackPayload(text, lang) {
    // Return a lightweight speech instruction payload for Web Speech API client synthesis
    return {
      audioBase64: null,
      useClientWebSpeech: true,
      mimeType: 'client-speech',
      text,
      lang,
      durationMs: Math.round((text.length / 15) * 1000)
    };
  }

  /**
   * Get consolidated multi-engine voices catalog with active key status and tier classification
   */
  getAvailableVoicesCatalog() {
    const hasDeepgram = Boolean(this.deepgramApiKey);
    const hasEleven = Boolean(this.elevenLabsApiKey);
    const hasOpenAI = Boolean(this.openaiApiKey);
    const hasCartesia = Boolean(this.cartesiaApiKey);

    return [
      // =========================================================================
      // --- 1. MICROSOFT EDGE TTS / AZURE NEURAL (Universal Zero-Cost Tier $0) ---
      // =========================================================================
      {
        id: 'es-ES-ElviraNeural',
        engine: 'edge',
        name: 'Elvira Neural',
        gender: 'female',
        tone: 'Institucional, Fluido',
        desc: 'Voz neuronal estándar de alta definición en español europeo e internacional.',
        lang: 'es',
        languages: ['es'],
        latency: '~130ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'keynote',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'es-ES-AlvaroNeural',
        engine: 'edge',
        name: 'Álvaro Neural',
        gender: 'male',
        tone: 'Claro, Dinámico',
        desc: 'Locución masculina clara y enérgica para conferencias técnicas y paneles.',
        lang: 'es',
        languages: ['es'],
        latency: '~130ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'panel',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'es-MX-DaliaNeural',
        engine: 'edge',
        name: 'Dalia Neural (México)',
        gender: 'female',
        tone: 'Cálido, Suave',
        desc: 'Acento neutro latinoamericano suave y fluido para foros panamericanos.',
        lang: 'es',
        languages: ['es'],
        latency: '~135ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'conversational',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'es-MX-JorgeNeural',
        engine: 'edge',
        name: 'Jorge Neural (México)',
        gender: 'male',
        tone: 'Confiable, Cercano',
        desc: 'Español neutro latinoamericano con dicción limpia y cadencia médica/corporativa.',
        lang: 'es',
        languages: ['es'],
        latency: '~135ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'medical',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'en-US-JennyNeural',
        engine: 'edge',
        name: 'Jenny Neural',
        gender: 'female',
        tone: 'Crisp, Professional',
        desc: 'Referente mundial de inteligibilidad y articulación en inglés americano.',
        lang: 'en',
        languages: ['en'],
        latency: '~125ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'keynote',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'en-US-GuyNeural',
        engine: 'edge',
        name: 'Guy Neural',
        gender: 'male',
        tone: 'Seguro, Cálido',
        desc: 'Voz masculina estadounidense con gran naturalidad y dicción equilibrada.',
        lang: 'en',
        languages: ['en'],
        latency: '~125ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'panel',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'en-US-AriaNeural',
        engine: 'edge',
        name: 'Aria Neural',
        gender: 'female',
        tone: 'Expresivo, Dinámico',
        desc: 'Locución versátil con gran rango dinámico para auditorios amplios.',
        lang: 'en',
        languages: ['en'],
        latency: '~130ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'panel',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'it-IT-ElsaNeural',
        engine: 'edge',
        name: 'Elsa Neural',
        gender: 'female',
        tone: 'Cálido, Expresivo',
        desc: 'Voz italiana fluida con musicalidad natural para interpretación al italiano.',
        lang: 'it',
        languages: ['it'],
        latency: '~130ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'keynote',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'it-IT-DiegoNeural',
        engine: 'edge',
        name: 'Diego Neural',
        gender: 'male',
        tone: 'Elegante, Sereno',
        desc: 'Tono formal y refinado para la cabina de audio en italiano.',
        lang: 'it',
        languages: ['it'],
        latency: '~130ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'medical',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'it-IT-CosimoNeural',
        engine: 'edge',
        name: 'Cosimo Neural',
        gender: 'male',
        tone: 'Pausado, Institucional',
        desc: 'Dicción solemne y pausada para foros diplomáticos y debates.',
        lang: 'it',
        languages: ['it'],
        latency: '~130ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'keynote',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'pt-BR-FranciscaNeural',
        engine: 'edge',
        name: 'Francisca Neural',
        gender: 'female',
        tone: 'Suave, Claro',
        desc: 'Voz neuronal en portugués brasileño con apertura fonética natural.',
        lang: 'pt',
        languages: ['pt'],
        latency: '~135ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'keynote',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'pt-BR-AntonioNeural',
        engine: 'edge',
        name: 'Antonio Neural',
        gender: 'male',
        tone: 'Enérgico, Amigable',
        desc: 'Locución masculina clara y atractiva para la cabina de portugués.',
        lang: 'pt',
        languages: ['pt'],
        latency: '~135ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'panel',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'es-CO-SalomeNeural',
        engine: 'edge',
        name: 'Salomé Neural (Colombia)',
        gender: 'female',
        tone: 'Cálido, Melódico',
        desc: 'Acento andino muy claro y modulado para conferencias latinoamericanas.',
        lang: 'es',
        languages: ['es'],
        latency: '~130ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'conversational',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'es-AR-ElenaNeural',
        engine: 'edge',
        name: 'Elena Neural (Argentina)',
        gender: 'female',
        tone: 'Enérgico, Cultivado',
        desc: 'Cadencia rioplatense profesional para eventos del cono sur.',
        lang: 'es',
        languages: ['es'],
        latency: '~135ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'panel',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'es-US-AlonsoNeural',
        engine: 'edge',
        name: 'Alonso Neural (EE.UU./Neutro)',
        gender: 'male',
        tone: 'Autoridad, Firme',
        desc: 'Voz masculina hispana neutra de gran inteligibilidad internacional.',
        lang: 'es',
        languages: ['es'],
        latency: '~130ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'keynote',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'en-US-ChristopherNeural',
        engine: 'edge',
        name: 'Christopher Neural',
        gender: 'male',
        tone: 'Autoridad, Solemne',
        desc: 'Barítono institucional de gran peso para plenarias corporativas.',
        lang: 'en',
        languages: ['en'],
        latency: '~130ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'keynote',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'en-GB-RyanNeural',
        engine: 'edge',
        name: 'Ryan Neural (UK)',
        gender: 'male',
        tone: 'Británico, Formal',
        desc: 'Inglés británico Received Pronunciation para cumbres internacionales.',
        lang: 'en',
        languages: ['en'],
        latency: '~135ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'medical',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'it-IT-IsabellaNeural',
        engine: 'edge',
        name: 'Isabella Neural',
        gender: 'female',
        tone: 'Articulada, Brillante',
        desc: 'Dicción italiana nítida y ritmo constante para cabinas de traducción.',
        lang: 'it',
        languages: ['it'],
        latency: '~130ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'conversational',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'pt-PT-RaquelNeural',
        engine: 'edge',
        name: 'Raquel Neural (Portugal)',
        gender: 'female',
        tone: 'Europeo, Claro',
        desc: 'Portugués europeo institucional para eventos transatlánticos.',
        lang: 'pt',
        languages: ['pt'],
        latency: '~135ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'keynote',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'pt-PT-DuarteNeural',
        engine: 'edge',
        name: 'Duarte Neural (Portugal)',
        gender: 'male',
        tone: 'Sobrio, Directo',
        desc: 'Locución masculina en portugués europeo para ponencias técnicas.',
        lang: 'pt',
        languages: ['pt'],
        latency: '~135ms',
        badge: 'Azure Neural • Gratuito ⚡',
        tier: 'zero_cost',
        tierLabel: 'Universal Gratuito',
        scenario: 'panel',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },

      // =========================================================================
      // --- 2. CARTESIA SONIC (Ultra-Low Latency State Space Model <100ms) ---
      // =========================================================================
      {
        id: 'a0e99841-438c-4a64-b679-ae501e7d6091',
        engine: 'cartesia',
        name: 'Sonic Carla (Español)',
        gender: 'female',
        tone: 'Expresivo, Fluido',
        desc: 'Síntesis SSM en streaming con TTFB <100ms para traducción simultánea inmediata.',
        lang: 'es',
        languages: ['es'],
        latency: '~85ms',
        badge: 'Cartesia Sonic ⚡⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasCartesia
      },
      {
        id: '846d3575-01e4-4d89-94ae-34f3c7ae01d9',
        engine: 'cartesia',
        name: 'Sonic Diego (Español)',
        gender: 'male',
        tone: 'Seguro, Dinámico',
        desc: 'Acento neutro hispanoamericano de respuesta ultra-rápida.',
        lang: 'es',
        languages: ['es'],
        latency: '~85ms',
        badge: 'Cartesia Sonic ⚡⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasCartesia
      },
      {
        id: '794f9389-aac1-45b6-b726-9d9369183238',
        engine: 'cartesia',
        name: 'Sonic Sarah (Inglés)',
        gender: 'female',
        tone: 'Cálido, Rápido',
        desc: 'Inglés americano con entonación natural y latencia récord.',
        lang: 'en',
        languages: ['en'],
        latency: '~80ms',
        badge: 'Cartesia Sonic ⚡⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasCartesia
      },
      {
        id: 'c45bc5ec-5968-4f0b-88b0-ae6d05910801',
        engine: 'cartesia',
        name: 'Sonic Marcus (Inglés)',
        gender: 'male',
        tone: 'Resonante, Directo',
        desc: 'Locución masculina ágil para conferencias técnicas y debates.',
        lang: 'en',
        languages: ['en'],
        latency: '~80ms',
        badge: 'Cartesia Sonic ⚡⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasCartesia
      },
      {
        id: '5345cf08-6fba-4089-a296-ee1a9673a726',
        engine: 'cartesia',
        name: 'Sonic Chiara (Italiano)',
        gender: 'female',
        tone: 'Melódico, Expresivo',
        desc: 'Modelo Sonic nativo en italiano con modulación natural y latencia récord <90ms.',
        lang: 'it',
        languages: ['it'],
        latency: '~85ms',
        badge: 'Cartesia Sonic ⚡⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasCartesia
      },
      {
        id: '4c65db53-8417-48f8-8422-af1f26ec5809',
        engine: 'cartesia',
        name: 'Sonic Beatriz (Portugués)',
        gender: 'female',
        tone: 'Cálido, Dinámico',
        desc: 'Pronunciación fluida en portugués con procesamiento SSM de ultra-baja latencia.',
        lang: 'pt',
        languages: ['pt'],
        latency: '~85ms',
        badge: 'Cartesia Sonic ⚡⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasCartesia
      },

      // =========================================================================
      // --- 3. DEEPGRAM AURA-2 & AURA (Ultra-Low Latency ~110-150ms) ---
      // =========================================================================
      {
        id: 'aura-2-thalia-en',
        engine: 'deepgram',
        name: 'Thalia (Aura-2)',
        gender: 'female',
        tone: 'Natural, Articulado',
        desc: 'Nueva generación Aura-2 con prosodia humana avanzada y menor respiración sintética.',
        lang: 'en',
        languages: ['en'],
        latency: '~115ms',
        badge: 'Deepgram Aura-2 ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-2-zeus-en',
        engine: 'deepgram',
        name: 'Zeus (Aura-2)',
        gender: 'male',
        tone: 'Autoritario, Claro',
        desc: 'Locutor masculino para conferencias magistrales con máxima inteligibilidad.',
        lang: 'en',
        languages: ['en'],
        latency: '~115ms',
        badge: 'Deepgram Aura-2 ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-2-carina-es',
        engine: 'deepgram',
        name: 'Carina (Aura-2 Español)',
        gender: 'female',
        tone: 'Cálido, Expresivo',
        desc: 'Modelo nativo en español con ritmo fluido para conferencias e interpretación.',
        lang: 'es',
        languages: ['es'],
        latency: '~115ms',
        badge: 'Deepgram Aura-2 ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-2-javier-es',
        engine: 'deepgram',
        name: 'Javier (Aura-2 Español)',
        gender: 'male',
        tone: 'Seguro, Dinámico',
        desc: 'Voz masculina hispana moderna ideal para paneles y eventos en vivo.',
        lang: 'es',
        languages: ['es'],
        latency: '~115ms',
        badge: 'Deepgram Aura-2 ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-2-celeste-es',
        engine: 'deepgram',
        name: 'Celeste (Aura-2 Español)',
        gender: 'female',
        tone: 'Sereno, Académico',
        desc: 'Entonación pausada para congresos científicos y médicos en español.',
        lang: 'es',
        languages: ['es'],
        latency: '~120ms',
        badge: 'Deepgram Aura-2 ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'medical',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-2-diana-it',
        engine: 'deepgram',
        name: 'Diana (Aura-2 Italiano)',
        gender: 'female',
        tone: 'Melódico, Expresivo',
        desc: 'Modelo nativo en italiano con entonación natural para cabinas de interpretación.',
        lang: 'it',
        languages: ['it'],
        latency: '~120ms',
        badge: 'Deepgram Aura-2 ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-2-marcos-it',
        engine: 'deepgram',
        name: 'Marcos (Aura-2 Italiano)',
        gender: 'male',
        tone: 'Cálido, Directo',
        desc: 'Locución masculina italiana para conferencias y debates dinámicos.',
        lang: 'it',
        languages: ['it'],
        latency: '~120ms',
        badge: 'Deepgram Aura-2 ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-asteria-en',
        engine: 'deepgram',
        name: 'Asteria',
        gender: 'female',
        tone: 'Expresivo, Cálido',
        desc: 'Voz ejecutiva institucional con alta inteligibilidad en 2–4 kHz.',
        lang: 'en',
        languages: ['en'],
        latency: '~140ms',
        badge: 'Deepgram Aura ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-orion-en',
        engine: 'deepgram',
        name: 'Orion',
        gender: 'male',
        tone: 'Resonante, Confiado',
        desc: 'Barítono cálido con dicción clara para conferencias y ponencias.',
        lang: 'en',
        languages: ['en'],
        latency: '~140ms',
        badge: 'Deepgram Aura ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-luna-en',
        engine: 'deepgram',
        name: 'Luna',
        gender: 'female',
        tone: 'Suave, Sereno',
        desc: 'Prosodia relajada y narrativa perfecta para oratoria prolongada.',
        lang: 'en',
        languages: ['en'],
        latency: '~150ms',
        badge: 'Deepgram Aura ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'medical',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-stella-en',
        engine: 'deepgram',
        name: 'Stella',
        gender: 'female',
        tone: 'Profesional, Directo',
        desc: 'Modulación ágil y contemporánea para eventos en vivo.',
        lang: 'en',
        languages: ['en'],
        latency: '~140ms',
        badge: 'Deepgram Aura ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-angus-en',
        engine: 'deepgram',
        name: 'Angus',
        gender: 'male',
        tone: 'Profundo, Académico',
        desc: 'Voz madura y docta para ponencias médicas y científicas.',
        lang: 'en',
        languages: ['en'],
        latency: '~155ms',
        badge: 'Deepgram Aura ⚡',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'medical',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },

      // =========================================================================
      // --- 4. OPENAI TTS-1 & REALTIME VOICES (Studio Standard 🤖) ---
      // =========================================================================
      {
        id: 'nova',
        engine: 'openai',
        name: 'Nova',
        gender: 'female',
        tone: 'Enérgico, Cálido',
        desc: 'Modulación vibrante y gran expresividad para auditorios amplios y eventos.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~220ms',
        badge: 'OpenAI TTS 🤖',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasOpenAI
      },
      {
        id: 'sage',
        engine: 'openai',
        name: 'Sage',
        gender: 'female',
        tone: 'Sereno, Articulado',
        desc: 'Tono reflexivo y pausado; máxima reducción de fatiga auditiva en sesiones largas.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~220ms',
        badge: 'OpenAI TTS 🤖',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'medical',
        isFree: false,
        requiresKey: true,
        isConfigured: hasOpenAI
      },
      {
        id: 'coral',
        engine: 'openai',
        name: 'Coral',
        gender: 'female',
        tone: 'Cálido, Melódico',
        desc: 'Locución contemporánea fluida, excelente en español y portugués.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~220ms',
        badge: 'OpenAI TTS 🤖',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasOpenAI
      },
      {
        id: 'echo',
        engine: 'openai',
        name: 'Echo',
        gender: 'male',
        tone: 'Suave, Aterciopelado',
        desc: 'Barítono relajado sin estridencias para audición confortable en auriculares.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~230ms',
        badge: 'OpenAI TTS 🤖',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasOpenAI
      },
      {
        id: 'ash',
        engine: 'openai',
        name: 'Ash',
        gender: 'male',
        tone: 'Ágil, Dinámico',
        desc: 'Estilo fresco y reactivo ideal para mesas redondas y debates.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~220ms',
        badge: 'OpenAI TTS 🤖',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasOpenAI
      },
      {
        id: 'onyx',
        engine: 'openai',
        name: 'Onyx',
        gender: 'male',
        tone: 'Profundo, Convincente',
        desc: 'Voz grave de gran presencia escénica y peso argumental.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~240ms',
        badge: 'OpenAI TTS 🤖',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasOpenAI
      },
      {
        id: 'alloy',
        engine: 'openai',
        name: 'Alloy',
        gender: 'neutral',
        tone: 'Equilibrado, Neutro',
        desc: 'Voz corporativa y contemporánea altamente versátil.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~220ms',
        badge: 'OpenAI TTS 🤖',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasOpenAI
      },
      {
        id: 'shimmer',
        engine: 'openai',
        name: 'Shimmer',
        gender: 'female',
        tone: 'Claro, Brillante',
        desc: 'Articulación nítida y timbre luminoso para cabinas italiana y portuguesa.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~220ms',
        badge: 'OpenAI TTS 🤖',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasOpenAI
      },

      // =========================================================================
      // --- 5. ELEVENLABS FLASH V2.5 (High-Fidelity Studio 🌟) ---
      // =========================================================================
      {
        id: '21m00Tcm4TlvDq8ikWAM',
        engine: 'elevenlabs',
        name: 'Rachel',
        gender: 'female',
        tone: 'Fotorrealista, Cálido',
        desc: 'Micro-expresión humana y naturalidad insignia de ElevenLabs.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~100ms',
        badge: 'ElevenLabs Flash 🌟',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasEleven
      },
      {
        id: 'nPczCjzI2devNBz1zQrb',
        engine: 'elevenlabs',
        name: 'Brian',
        gender: 'male',
        tone: 'Profundo, Narrativo',
        desc: 'Barítono magistral para cumbres diplomáticas y plenarias de alto nivel.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~100ms',
        badge: 'ElevenLabs Flash 🌟',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasEleven
      },
      {
        id: 'pNInz6obpgDQGcFmaJgB',
        engine: 'elevenlabs',
        name: 'Adam',
        gender: 'male',
        tone: 'Dominante, Firme',
        desc: 'Locución profunda y enérgica para keynotes magistrales.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~110ms',
        badge: 'ElevenLabs Flash 🌟',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasEleven
      },
      {
        id: 'Xb7hH8MSUJpSbSDYk0k2',
        engine: 'elevenlabs',
        name: 'Alice',
        gender: 'female',
        tone: 'Clara, Confiable',
        desc: 'Dicción ejecutiva impecable para eventos corporativos y médicos.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~100ms',
        badge: 'ElevenLabs Flash 🌟',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'medical',
        isFree: false,
        requiresKey: true,
        isConfigured: hasEleven
      },
      {
        id: 'JBFqnCBsd6RMkjVDRZzb',
        engine: 'elevenlabs',
        name: 'George',
        gender: 'male',
        tone: 'Refinado, Británico',
        desc: 'Acento internacional cultivado para foros globales.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~110ms',
        badge: 'ElevenLabs Flash 🌟',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'keynote',
        isFree: false,
        requiresKey: true,
        isConfigured: hasEleven
      },
      {
        id: 'AZnzlk1XvdvUeBnXmlld',
        engine: 'elevenlabs',
        name: 'Domi',
        gender: 'female',
        tone: 'Fuerte, Directo',
        desc: 'Voz asertiva y dinámica para paneles de discusión interactivos.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~100ms',
        badge: 'ElevenLabs Flash 🌟',
        tier: 'premium_studio',
        tierLabel: 'Studio Pro',
        scenario: 'panel',
        isFree: false,
        requiresKey: true,
        isConfigured: hasEleven
      }
    ];
  }
}

export const ttsService = new TTSService();
