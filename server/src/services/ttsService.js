/**
 * Text-to-Speech (TTS) Service for LiftVoice
 * Generates low-latency voice audio streams for [EN, ES, IT, PT]
 */

export class TTSService {
  constructor(config = {}) {
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY || '';
    this.elevenLabsApiKey = config.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY || '';
    this.deepgramApiKey = config.deepgramApiKey || process.env.DEEPGRAM_API_KEY || '1f057415ec50bb496a86ec8d8bc9e4f627a57f7d';
    this.preferredTtsEngine = config.preferredTtsEngine || 'auto'; // 'auto' | 'deepgram' | 'elevenlabs' | 'openai' | 'google'
    
    // Voice mapping for natural multilingual personas
    this.voiceMap = {
      en: { openai: 'alloy', edge: 'en-US-JennyNeural', eleven: '21m00Tcm4TlvDq8ikWAM', deepgram: 'aura-asteria-en' },
      es: { openai: 'nova', edge: 'es-ES-ElviraNeural', eleven: 'AZnzlk1XvdvUeBnXmlld', deepgram: 'aura-asteria-en' },
      it: { openai: 'shimmer', edge: 'it-IT-ElsaNeural', eleven: 'EXAVITQu4vr4xnSDxMaL', deepgram: 'aura-asteria-en' },
      pt: { openai: 'echo', edge: 'pt-BR-FranciscaNeural', eleven: 'ErXwobaYiN019PkySvjV', deepgram: 'aura-asteria-en' },
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
  }

  setConfig({ openaiApiKey, elevenLabsApiKey, deepgramApiKey, preferredTtsEngine, voiceConfig, voiceGender }) {
    if (openaiApiKey !== undefined) this.openaiApiKey = openaiApiKey;
    if (elevenLabsApiKey !== undefined) this.elevenLabsApiKey = elevenLabsApiKey;
    if (deepgramApiKey !== undefined) this.deepgramApiKey = deepgramApiKey;
    if (preferredTtsEngine !== undefined) this.preferredTtsEngine = preferredTtsEngine;
    if (voiceConfig !== undefined) this.voiceConfig = { ...this.voiceConfig, ...voiceConfig };
    if (voiceGender !== undefined) this.voiceGender = { ...this.voiceGender, ...voiceGender };
    console.log(`[TTSService] 🎙️ Config updated: Engine=${this.preferredTtsEngine}, Deepgram=${!!this.deepgramApiKey}, ElevenLabs=${!!this.elevenLabsApiKey}, OpenAI=${!!this.openaiApiKey}`);
  }

  setApiKey(openaiKey, elevenLabsKey = null) {
    if (openaiKey !== undefined && openaiKey !== null) {
      this.openaiApiKey = openaiKey;
    }
    if (elevenLabsKey !== undefined && elevenLabsKey !== null) {
      this.elevenLabsApiKey = elevenLabsKey;
    }
  }

  setElevenLabsApiKey(key) {
    this.elevenLabsApiKey = key;
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

    // 1. Remove XML/HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, ' ');

    // 2. Remove markdown links [text](url) -> text
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 3. Remove bracketed speaker or meta tags like [Speaker]:, [Audience]:, [Nota: ...], (Pausa), etc.
    cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ');
    cleaned = cleaned.replace(/\([^\)]*(?:pausa|silencio|nota|risas|aplausos)[^\)]*\)/gi, ' ');

    // 4. Remove markdown syntax: asterisks (*bold*, **bold**), underscores (_italic_), hashtags (### header), backticks (`code`)
    cleaned = cleaned.replace(/[*_#`~]/g, '');

    // 5. Strip emojis and non-standard symbols that TTS engines read out phonetically
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    // 6. Strip typical translation, conversational preambles or speaker tags (iterative)
    const preambleRegex = /^(?:[:\s\-–—]*)(?:traducci[oó]n|translation|traduzione|tradu[cç][aã]o|en espa[nñ]ol|in english|in italiano|em portugu[eê]s|here is the translation|respuesta|speaker|host|asistente|ponente)\s*:\s*/i;
    while (preambleRegex.test(cleaned)) {
      cleaned = cleaned.replace(preambleRegex, '');
    }

    // 7. Strip any remaining leading punctuation
    cleaned = cleaned.replace(/^[:\s\-–—]+/, '');

    // 8. Collapse spaces and normalize punctuation
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
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

    // 1. Try Deepgram Aura TTS (Ultra-low latency <150ms, English acoustic model)
    if ((engine === 'deepgram' || (engine === 'auto' && this.deepgramApiKey)) && this.deepgramApiKey && lang === 'en') {
      try {
        const result = await this.synthesizeWithDeepgram(cleanText, lang, { voice, gender });
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        console.warn(`[TTSService] Deepgram Aura synthesis failed for ${lang}:`, err.message);
      }
    }

    // 2. Try ElevenLabs TTS if API key is configured or requested
    if ((engine === 'elevenlabs' || (engine === 'auto' && this.elevenLabsApiKey)) && this.elevenLabsApiKey) {
      try {
        const result = await this.synthesizeWithElevenLabs(cleanText, lang, { voice, gender });
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        console.warn(`[TTSService] ElevenLabs synthesis failed for ${lang}:`, err.message);
      }
    }

    // 3. Try OpenAI TTS if API key is provided or requested
    if ((engine === 'openai' || (engine === 'auto' && this.openaiApiKey)) && this.openaiApiKey) {
      try {
        const result = await this.synthesizeWithOpenAI(cleanText, lang, { voice, gender });
        if (result && result.audioBase64) {
          result.latencyMs = Date.now() - startTime;
          this.setCache(cacheKey, result);
          return result;
        }
      } catch (err) {
        console.warn(`[TTSService] OpenAI TTS failed for lang ${lang}:`, err.message);
      }
    }

    // 4. Try Google Translate TTS / public rapid audio generator
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

    // 5. Fallback client-synthesized indicator packet
    const fallback = this.generateFallbackPayload(cleanText, lang);
    fallback.latencyMs = Date.now() - startTime;
    return fallback;
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
      signal: AbortSignal.timeout(6000)
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
      mimeType: 'audio/mp3',
      text,
      lang,
      provider: 'deepgram',
      model,
      durationMs: Math.round((text.length / 15) * 1000)
    };
  }

  async synthesizeWithElevenLabs(text, lang, options = {}) {
    const requestedVoice = (options.voice && options.voice.length > 15) ? options.voice : null;
    const configuredVoice = (this.voiceConfig[lang] && this.voiceConfig[lang].length > 15) ? this.voiceConfig[lang] : null;
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
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs HTTP ${response.status}: ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioBase64 = buffer.toString('base64');

    return {
      audioBase64,
      mimeType: 'audio/mp3',
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
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI TTS Error ${response.status}: ${err}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioBase64 = buffer.toString('base64');

    return {
      audioBase64,
      mimeType: 'audio/mp3',
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
    const audioBuffers = [];

    for (const chunk of textChunks) {
      const encoded = encodeURIComponent(chunk);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${code}&client=tw-ob`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(3500)
      });

      if (!response.ok) {
        throw new Error(`Public TTS error ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      audioBuffers.push(Buffer.from(arrayBuffer));
    }

    const combinedBuffer = Buffer.concat(audioBuffers);
    const audioBase64 = combinedBuffer.toString('base64');

    return {
      audioBase64,
      mimeType: 'audio/mp3',
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
