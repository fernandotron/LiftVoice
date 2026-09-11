/**
 * Text-to-Speech (TTS) Service for LiftVoice
 * Generates low-latency voice audio streams for [EN, ES, IT, PT]
 */

export class TTSService {
  constructor(config = {}) {
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY || '';
    this.elevenLabsApiKey = config.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY || '';
    this.deepgramApiKey = config.deepgramApiKey || process.env.DEEPGRAM_API_KEY || '';
    this.qwenApiKey = config.qwenApiKey || process.env.DASHSCOPE_API_KEY || '';
    this.qwenTtsEndpoint = config.qwenTtsEndpoint || process.env.QWEN_TTS_ENDPOINT || '';
    this.preferredTtsEngine = config.preferredTtsEngine || 'auto'; // 'auto' | 'deepgram' | 'google' | 'qwen_tts' | 'elevenlabs' | 'openai'
    
    // Voice mapping for natural multilingual personas
    this.voiceMap = {
      en: { openai: 'alloy', edge: 'en-US-JennyNeural', eleven: '21m00Tcm4TlvDq8ikWAM', deepgram: 'aura-asteria-en', qwen_tts: 'qwen3-tts-en' },
      es: { openai: 'nova', edge: 'es-ES-ElviraNeural', eleven: 'AZnzlk1XvdvUeBnXmlld', deepgram: 'aura-asteria-en', qwen_tts: 'qwen3-tts-es' },
      it: { openai: 'shimmer', edge: 'it-IT-ElsaNeural', eleven: 'EXAVITQu4vr4xnSDxMaL', deepgram: 'aura-asteria-en', qwen_tts: 'qwen3-tts-it' },
      pt: { openai: 'echo', edge: 'pt-BR-FranciscaNeural', eleven: 'ErXwobaYiN019PkySvjV', deepgram: 'aura-asteria-en', qwen_tts: 'qwen3-tts-pt' },
      fr: { openai: 'shimmer', edge: 'fr-FR-DeniseNeural', eleven: '21m00Tcm4TlvDq8ikWAM', deepgram: 'aura-asteria-en' },
      de: { openai: 'alloy', edge: 'de-DE-KatjaNeural', eleven: 'pNInz6obpgDQGcFmaJgB', deepgram: 'aura-asteria-en' },
      zh: { openai: 'nova', edge: 'zh-CN-XiaoxiaoNeural', eleven: '21m00Tcm4TlvDq8ikWAM', deepgram: 'aura-asteria-en' },
      ja: { openai: 'shimmer', edge: 'ja-JP-NanamiNeural', eleven: 'AZnzlk1XvdvUeBnXmlld', deepgram: 'aura-asteria-en' },
      ar: { openai: 'echo', edge: 'ar-SA-ZariyahNeural', eleven: 'ErXwobaYiN019PkySvjV', deepgram: 'aura-asteria-en' },
      ru: { openai: 'onyx', edge: 'ru-RU-SvetlanaNeural', eleven: 'pNInz6obpgDQGcFmaJgB', deepgram: 'aura-asteria-en' },
      ko: { openai: 'nova', edge: 'ko-KR-SunHiNeural', eleven: 'AZnzlk1XvdvUeBnXmlld', deepgram: 'aura-asteria-en' },
      hi: { openai: 'alloy', edge: 'hi-IN-SwaraNeural', eleven: '21m00Tcm4TlvDq8ikWAM', deepgram: 'aura-asteria-en' }
    };

    // User-configured voice choices per language
    this.voiceConfig = {
      en: 'alloy',
      es: 'nova',
      it: 'shimmer',
      pt: 'echo',
      fr: 'shimmer',
      de: 'alloy',
      zh: 'nova',
      ja: 'shimmer',
      ar: 'echo',
      ru: 'onyx',
      ko: 'nova',
      hi: 'alloy',
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

  resetCircuit(provider) {
    if (provider) {
      this.circuitBreakers?.delete(provider);
    } else {
      this.circuitBreakers?.clear();
    }
  }

  setConfig({ openaiApiKey, elevenLabsApiKey, deepgramApiKey, qwenApiKey, preferredTtsEngine, voiceConfig, voiceGender, qwenTtsEndpoint }) {
    if (openaiApiKey !== undefined) {
      this.openaiApiKey = openaiApiKey;
      this.resetCircuit('openai');
    }
    if (elevenLabsApiKey !== undefined) {
      this.elevenLabsApiKey = elevenLabsApiKey;
      this.resetCircuit('elevenlabs');
    }
    if (deepgramApiKey !== undefined) this.deepgramApiKey = deepgramApiKey;
    if (qwenApiKey !== undefined) this.qwenApiKey = qwenApiKey;
    if (qwenTtsEndpoint !== undefined) this.qwenTtsEndpoint = qwenTtsEndpoint;
    if (preferredTtsEngine !== undefined) this.preferredTtsEngine = preferredTtsEngine;
    if (voiceConfig !== undefined) this.voiceConfig = { ...this.voiceConfig, ...voiceConfig };
    if (voiceGender !== undefined) this.voiceGender = { ...this.voiceGender, ...voiceGender };
    console.log(`[TTSService] 🎙️ Config updated: Engine=${this.preferredTtsEngine}, Deepgram=${!!this.deepgramApiKey}, ElevenLabs=${!!this.elevenLabsApiKey}, OpenAI=${!!this.openaiApiKey}, QwenTTS=${!!this.qwenTtsEndpoint}`);
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

    // 1. Remove invisible zero-width and non-breaking space characters (\u200B-\u200D\uFEFF\u00A0)
    cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ');

    // 2. Remove direct URLs
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, ' ');

    // 3. Remove XML/HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');

    // 4. Remove markdown links [text](url) -> text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 5. Remove bracketed speaker or meta tags like [Speaker]:, [Audience]:, [Nota: ...], (Pausa), etc.
    cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ');
    cleaned = cleaned.replace(/\([^\)]*(?:pausa|silencio|nota|risas|aplausos)[^\)]*\)/gi, ' ');

    // 6. Remove markdown syntax: asterisks (*bold*, **bold**), underscores (_italic_), hashtags (### header), backticks (`code`)
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

    const engine = options.engine || this.preferredTtsEngine || 'auto';
    const voice = options.voice || this.voiceConfig[lang] || '';
    const gender = options.gender || this.voiceGender[lang] || 'female';

    const cacheKey = `${lang}:${engine}:${voice}:${gender}:${cleanText}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        latencyMs: Date.now() - startTime,
        fromCache: true
      };
    }

    // 1. Google Neural Universal (Selected directly by admin)
    if (engine === 'google') {
      try {
        const result = await this.synthesizeWithFastEngine(cleanText, lang);
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          result.provider = 'google';
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        console.warn(`[TTSService] Google Neural TTS failed for ${lang}:`, err.message);
      }
    }

    // 2. Qwen3-TTS / CosyVoice (Alibaba Speech API or OpenAI-compatible endpoint)
    if (engine === 'qwen_tts') {
      try {
        const result = await this.synthesizeWithQwenTTS(cleanText, lang, { voice, gender });
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        console.warn(`[TTSService] Qwen3-TTS synthesis failed for ${lang}:`, err.message);
      }
    }

    // 3. Deepgram Aura / Aura-2 TTS (Ultra-low latency <150ms, consumes user's $200 free credit)
    if ((engine === 'deepgram' || (engine === 'auto' && this.deepgramApiKey)) && this.deepgramApiKey) {
      if (lang !== 'en') {
        // Deepgram Aura v1 models are native English. For non-English cabins (es, it, pt),
        // synthesize instantly with Google Neural without 400 failure or penalty latency
        try {
          const result = await this.synthesizeWithFastEngine(cleanText, lang);
          if (result && result.audioBase64) {
            result.latencyMs = Date.now() - startTime;
            result.provider = 'deepgram-companion-google';
            this.setCache(cacheKey, result);
            return result;
          }
        } catch (e) {}
      } else {
        try {
          // Deepgram Aura has native high-fidelity English models (aura-asteria-en / aura-orion-en)
          const result = await this.synthesizeWithDeepgram(cleanText, lang, { voice, gender });
          if (result && result.audioBase64) {
            result.latencyMs = Date.now() - startTime;
            this.setCache(cacheKey, result);
            return result;
          }
        } catch (err) {
          console.warn(`[TTSService] Deepgram Aura synthesis warning for ${lang} (${err.message}), falling back to Google Neural`);
          try {
            const result = await this.synthesizeWithFastEngine(cleanText, lang);
            if (result && result.audioBase64) {
              result.latencyMs = Date.now() - startTime;
              result.provider = 'deepgram-fallback-google';
              this.setCache(cacheKey, result);
              return result;
            }
          } catch (e2) {}
        }
      }
    }

    // 4. ElevenLabs TTS if API key is configured or requested and circuit is closed
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

    // 5. OpenAI TTS if API key is provided or requested and circuit is closed
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

    // 6. Fast engine fallback (Google Neural Universal)
    try {
      const result = await this.synthesizeWithFastEngine(cleanText, lang);
      if (result && result.audioBase64) {
        result.latencyMs = Date.now() - startTime;
        result.provider = 'google';
        this.setCache(cacheKey, result);
        return result;
      }
    } catch (err) {
      console.warn(`[TTSService] Fast engine TTS failed for lang ${lang}:`, err.message);
    }

    // 7. Fallback client-synthesized indicator packet
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
      throw new Error(`Qwen3-TTS error HTTP ${response.status}: ${err}`);
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

    let model = options.voice || this.voiceConfig[lang];
    if (!model || !model.startsWith('aura-')) {
      const gender = options.gender || this.voiceGender[lang] || 'female';
      model = gender === 'male' ? 'aura-orion-en' : 'aura-asteria-en';
    }

    const url = `https://api.deepgram.com/v1/speak?model=${model}&encoding=mp3`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.deepgramApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(2200)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Deepgram Aura HTTP ${response.status}: ${err}`);
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
        model_id: 'eleven_turbo_v2_5',
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
    if (!voice || !['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice)) {
      const gender = options.gender || this.voiceGender[lang] || 'female';
      if (gender === 'male') {
        voice = lang === 'en' ? 'onyx' : 'echo';
      } else {
        voice = lang === 'es' ? 'nova' : (lang === 'it' ? 'shimmer' : 'alloy');
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
      signal: AbortSignal.timeout(2800)
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
   * Get consolidated multi-engine voices catalog with active key status
   */
  getAvailableVoicesCatalog() {
    const hasDeepgram = Boolean(this.deepgramApiKey);
    const hasEleven = Boolean(this.elevenLabsApiKey);
    const hasOpenAI = Boolean(this.openaiApiKey);

    return [
      // --- DEEPGRAM AURA (Ultra-Low Latency ~170ms) ---
      {
        id: 'aura-orion-en',
        engine: 'deepgram',
        name: 'Orion',
        gender: 'male',
        tone: 'Resonante, Confiado',
        desc: 'Barítono cálido con dicción clara para conferencias y ponencias.',
        lang: 'en',
        languages: ['en'],
        latency: '~150ms',
        badge: 'Deepgram Aura ⚡',
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
        desc: 'Voz ejecutiva institucional ideal para presentaciones corporativas.',
        lang: 'en',
        languages: ['en'],
        latency: '~150ms',
        badge: 'Deepgram Aura ⚡',
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
        latency: '~160ms',
        badge: 'Deepgram Aura ⚡',
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
        latency: '~150ms',
        badge: 'Deepgram Aura ⚡',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-athena-en',
        engine: 'deepgram',
        name: 'Athena',
        gender: 'female',
        tone: 'Autoritario, Elegante',
        desc: 'Tono solemne y formal para ceremonias y eventos académicos.',
        lang: 'en',
        languages: ['en'],
        latency: '~160ms',
        badge: 'Deepgram Aura ⚡',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-arcas-en',
        engine: 'deepgram',
        name: 'Arcas',
        gender: 'male',
        tone: 'Amigable, Cercano',
        desc: 'Locución cálida y natural para talleres y sesiones de networking.',
        lang: 'en',
        languages: ['en'],
        latency: '~155ms',
        badge: 'Deepgram Aura ⚡',
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
        latency: '~165ms',
        badge: 'Deepgram Aura ⚡',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },
      {
        id: 'aura-perseus-en',
        engine: 'deepgram',
        name: 'Perseus',
        gender: 'male',
        tone: 'Casual, Ágil',
        desc: 'Estilo fresco y juvenil para startups y debates dinámicos.',
        lang: 'en',
        languages: ['en'],
        latency: '~150ms',
        badge: 'Deepgram Aura ⚡',
        isFree: false,
        requiresKey: true,
        isConfigured: hasDeepgram
      },

      // --- GOOGLE NEURAL UNIVERSAL (100% Gratuito & Ilimitado) ---
      {
        id: 'es-ES-ElviraNeural',
        engine: 'google',
        name: 'Google Elvira',
        gender: 'female',
        tone: 'Natural, Fluido',
        desc: 'Voz neuronal estándar de alta velocidad en español europeo/neutro.',
        lang: 'es',
        languages: ['es'],
        latency: '~90ms',
        badge: 'Universal Gratuito 🌐',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'es-ES-AlvaroNeural',
        engine: 'google',
        name: 'Google Álvaro',
        gender: 'male',
        tone: 'Claro, Dinámico',
        desc: 'Locución masculina clara y neutra sin coste ni límite de API.',
        lang: 'es',
        languages: ['es'],
        latency: '~90ms',
        badge: 'Universal Gratuito 🌐',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'en-US-JennyNeural',
        engine: 'google',
        name: 'Google Jenny',
        gender: 'female',
        tone: 'Crisp, Professional',
        desc: 'Excelente inteligibilidad y articulación en inglés americano.',
        lang: 'en',
        languages: ['en'],
        latency: '~85ms',
        badge: 'Universal Gratuito 🌐',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'en-US-GuyNeural',
        engine: 'google',
        name: 'Google Guy',
        gender: 'male',
        tone: 'Seguro, Cálido',
        desc: 'Voz masculina estadounidense con gran naturalidad y dicción.',
        lang: 'en',
        languages: ['en'],
        latency: '~85ms',
        badge: 'Universal Gratuito 🌐',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'it-IT-ElsaNeural',
        engine: 'google',
        name: 'Google Elsa',
        gender: 'female',
        tone: 'Cálido, Expresivo',
        desc: 'Voz italiana fluida ideal para traducción simultánea al italiano.',
        lang: 'it',
        languages: ['it'],
        latency: '~90ms',
        badge: 'Universal Gratuito 🌐',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'it-IT-CosimoNeural',
        engine: 'google',
        name: 'Google Cosimo',
        gender: 'male',
        tone: 'Elegante, Sereno',
        desc: 'Tono pausado y refinado para la cabina de audio en italiano.',
        lang: 'it',
        languages: ['it'],
        latency: '~90ms',
        badge: 'Universal Gratuito 🌐',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'pt-BR-FranciscaNeural',
        engine: 'google',
        name: 'Google Francisca',
        gender: 'female',
        tone: 'Suave, Claro',
        desc: 'Voz neuronal en portugués brasileño con acento natural.',
        lang: 'pt',
        languages: ['pt'],
        latency: '~95ms',
        badge: 'Universal Gratuito 🌐',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },
      {
        id: 'pt-BR-AntonioNeural',
        engine: 'google',
        name: 'Google Antonio',
        gender: 'male',
        tone: 'Enérgico, Amigable',
        desc: 'Locución masculina clara y atractiva para la cabina de portugués.',
        lang: 'pt',
        languages: ['pt'],
        latency: '~95ms',
        badge: 'Universal Gratuito 🌐',
        isFree: true,
        requiresKey: false,
        isConfigured: true
      },

      // --- OPENAI TTS-1 ---
      {
        id: 'nova',
        engine: 'openai',
        name: 'Nova',
        gender: 'female',
        tone: 'Enérgico, Cálido',
        desc: 'Modulación natural con gran expresividad para todo tipo de eventos.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~250ms',
        badge: 'OpenAI TTS 🤖',
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
        latency: '~250ms',
        badge: 'OpenAI TTS 🤖',
        isFree: false,
        requiresKey: true,
        isConfigured: hasOpenAI
      },
      {
        id: 'echo',
        engine: 'openai',
        name: 'Echo',
        gender: 'male',
        tone: 'Suave, Redondo',
        desc: 'Barítono sereno sin estridencias para audición confortable.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~260ms',
        badge: 'OpenAI TTS 🤖',
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
        latency: '~260ms',
        badge: 'OpenAI TTS 🤖',
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
        desc: 'Articulación nítida y timbre luminoso para auditorios amplios.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~250ms',
        badge: 'OpenAI TTS 🤖',
        isFree: false,
        requiresKey: true,
        isConfigured: hasOpenAI
      },

      // --- ELEVENLABS TURBO V2.5 ---
      {
        id: '21m00Tcm4TlvDq8ikWAM',
        engine: 'elevenlabs',
        name: 'Rachel',
        gender: 'female',
        tone: 'Calmo, Profesional',
        desc: 'Fotorrealismo insignia de ElevenLabs con micro-expresión humana.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~300ms',
        badge: 'ElevenLabs 🌟',
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
        latency: '~310ms',
        badge: 'ElevenLabs 🌟',
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
        desc: 'Voz asertiva y dinámica para paneles de discusión.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~300ms',
        badge: 'ElevenLabs 🌟',
        isFree: false,
        requiresKey: true,
        isConfigured: hasEleven
      },
      {
        id: 'ErXwobaYiN019PkySvjV',
        engine: 'elevenlabs',
        name: 'Antoni',
        gender: 'male',
        tone: 'Modular, Suave',
        desc: 'Modulación cinematográfica con ritmo oratorio pausado.',
        lang: 'all',
        languages: ['es', 'en', 'it', 'pt'],
        latency: '~310ms',
        badge: 'ElevenLabs 🌟',
        isFree: false,
        requiresKey: true,
        isConfigured: hasEleven
      }
    ];
  }
}

export const ttsService = new TTSService();
