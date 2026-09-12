import crypto from 'crypto';
import { roomManager } from '../roomManager.js';
import { translationService } from './translationService.js';
import { ttsService } from './ttsService.js';
import { sttService } from './sttService.js';

/**
 * AI Pipeline Orchestrator for LiftVoice (2026 Edition)
 * Mic / Speech -> STT -> Multi-target Translation -> Parallel TTS -> Monotonic Serialized Broadcast
 */
export class AIPipeline {
  constructor() {
    this.activePipelines = new Set();
    this.roomQueues = new Map(); // roomId -> Promise chain
    this.roomSeqCounters = new Map(); // roomId -> integer
    this.roomContexts = new Map(); // roomId -> string of recent spoken words
    this.roomRecentEmissions = new Map(); // roomId -> Array of { text, norm, time }
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
  }

  setApiKeys({
    openaiApiKey,
    openaiModel,
    openaiTemp,
    deepgramApiKey,
    elevenLabsApiKey,
    deeplApiKey,
    geminiApiKey,
    geminiModel,
    geminiTemp,
    qwenApiKey,
    qwenModel,
    qwenTemp,
    qwenEndpoint,
    qwenTtsEndpoint,
    preferredEngine,
    aiStrategy,
    medicalMode,
    medicalSpecialty,
    customGlossary,
    preferredTtsEngine,
    voiceConfig,
    voiceGender,
    preferredSttEngine,
    sttEngine,
    sttLang,
    sttVad,
    decalageMode,
    googleNeuralMode
  }) {
    if (openaiApiKey !== undefined && openaiApiKey !== null) {
      this.openaiApiKey = openaiApiKey;
      translationService.setApiKey(openaiApiKey);
    }
    if (openaiModel !== undefined || openaiTemp !== undefined) {
      translationService.setOpenaiConfig({ model: openaiModel, temperature: openaiTemp });
    }
    if (deeplApiKey !== undefined && typeof translationService.setDeeplConfig === 'function') {
      translationService.setDeeplConfig({ apiKey: deeplApiKey });
    }
    if (geminiApiKey !== undefined || geminiModel !== undefined || geminiTemp !== undefined) {
      translationService.setGeminiConfig({ apiKey: geminiApiKey, model: geminiModel, preferredEngine, temperature: geminiTemp });
    }
    if (qwenApiKey !== undefined || qwenModel !== undefined || qwenEndpoint !== undefined || preferredEngine !== undefined || qwenTemp !== undefined) {
      translationService.setQwenConfig({ apiKey: qwenApiKey, model: qwenModel, endpoint: qwenEndpoint, preferredEngine, temperature: qwenTemp });
    }
    if (googleNeuralMode !== undefined && typeof translationService.setGoogleNeuralMode === 'function') {
      translationService.setGoogleNeuralMode(googleNeuralMode);
    }
    if (preferredEngine !== undefined) {
      translationService.preferredEngine = preferredEngine;
    }
    if (aiStrategy !== undefined) {
      translationService.setStrategy(aiStrategy);
    }
    if (medicalMode !== undefined || medicalSpecialty !== undefined || customGlossary !== undefined) {
      translationService.setMedicalConfig({ medicalMode, medicalSpecialty, customGlossary });
    }
    if (decalageMode !== undefined) {
      this.decalageMode = decalageMode;
    }
    ttsService.setConfig({
      openaiApiKey,
      elevenLabsApiKey,
      deepgramApiKey,
      qwenApiKey,
      qwenTtsEndpoint,
      preferredTtsEngine,
      voiceConfig,
      voiceGender
    });
    if (deepgramApiKey !== undefined || openaiApiKey !== undefined || geminiApiKey !== undefined) {
      sttService.setApiKey(this.openaiApiKey, deepgramApiKey, geminiApiKey);
    }
    const targetStt = preferredSttEngine || sttEngine;
    if (targetStt) {
      sttService.setPreferredEngine(targetStt);
    }
    if (sttLang !== undefined) {
      sttService.setLanguage(sttLang);
    }
    if (sttVad !== undefined) {
      sttService.setVad(sttVad);
    }
  }

  cleanupRoom(roomId) {
    const key = (roomId || 'MAIN').toUpperCase();
    this.roomQueues.delete(key);
    this.roomSeqCounters.delete(key);
    this.roomContexts.delete(key);
    this.roomRecentEmissions.delete(key);
  }

  getNextSeqId(roomId) {
    const key = (roomId || 'MAIN').toUpperCase();
    const current = this.roomSeqCounters.get(key) || 1;
    this.roomSeqCounters.set(key, current + 1);
    return current;
  }

  getActiveLanguages(roomId) {
    return (roomManager.getActiveLanguages && roomManager.getActiveLanguages(roomId)) || [];
  }

  /**
   * Process speech chunk through a FIFO room queue to guarantee strict chronological delivery
   * @param {Object} params
   * @param {string} params.roomId
   * @param {string} [params.text] - Direct transcribed text
   * @param {Buffer} [params.audioBuffer] - Raw audio buffer from mic
   * @param {string} [params.mimeType]
   * @param {string} [params.sourceLanguage] - 'auto' or 'es'/'en'/'it'/'pt'
   * @param {string[]} [params.forceLanguages] - Optional forced languages to synthesize (e.g. preview)
   */
  async processSpeech(params) {
    const roomId = (params.roomId || 'MAIN').toUpperCase();
    const seqId = this.getNextSeqId(roomId);
    roomManager.touchRoomActivity(roomId);

    // Chain to ensure FIFO sequential completion per room
    const currentQueue = this.roomQueues.get(roomId) || Promise.resolve();

    const taskPromise = currentQueue
      .catch((err) => {
        console.warn(`[AIPipeline] Previous chunk error in room ${roomId}:`, err);
      })
      .then(() => {
        return this.executeSpeechPipeline({ ...params, roomId, seqId });
      })
      .finally(() => {
        if (this.roomQueues.get(roomId) === taskPromise) {
          this.roomQueues.set(roomId, Promise.resolve());
        }
      });

    this.roomQueues.set(roomId, taskPromise);
    return taskPromise;
  }

  async executeSpeechPipeline(arg1, arg2, arg3, ...rest) {
    let opts = {};
    if (typeof arg1 === 'object' && arg1 !== null && !Array.isArray(arg1)) {
      opts = arg1;
    } else {
      opts = {
        roomId: arg1,
        text: arg2,
        sourceLanguage: arg3 || 'auto'
      };
    }
    let { roomId, text, audioBuffer, mimeType, sourceLanguage = 'auto', seqId = 1, forceLanguages = [], medicalMode, medicalSpecialty, customGlossary } = opts;
    const pipelineStart = Date.now();
    const packetId = `pkt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    let spokenText = (text || '').trim();
    let sttLatency = 0;

    const room = roomManager.getRoom(roomId);
    if (!room) {
      console.warn(`[AIPipeline] Room ${roomId} not found.`);
      return;
    }

    // Step 1: STT (if audio buffer provided and text is empty)
    if (!spokenText && audioBuffer) {
      const sttStart = Date.now();
      const sttResult = await sttService.transcribeAudio(audioBuffer, mimeType, sourceLanguage, { medicalMode });
      sttLatency = Date.now() - sttStart;
      if (sttResult && sttResult.text) {
        spokenText = sttResult.text;
        if (sttResult.detectedLanguage && sttResult.detectedLanguage !== 'auto') {
          sourceLanguage = sttResult.detectedLanguage;
        }
      }
    }

    if (!spokenText) {
      return;
    }

    // --- SERVER-SIDE DEDUPLICATION & OVERLAP SHIELD (2026) ---
    const now = Date.now();
    let roomHistory = this.roomRecentEmissions.get(roomId) || [];
    // Keep sliding window of last 45 seconds
    roomHistory = roomHistory.filter(item => now - item.time < 45000);

    const normalizePipelineSpeech = (s) =>
      (s || '')
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¡¿]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    let cleanText = spokenText.trim();
    if (cleanText.length > 1500) cleanText = cleanText.slice(0, 1500);
    let cleanUtterance = cleanText;
    let normUtterance = normalizePipelineSpeech(cleanUtterance);

    // Defense 1: Exact duplicate of recent utterance within 4 seconds (protects against rapid double socket packet events)
    const isDuplicate = roomHistory.some(item => {
      if (now - item.time > 4000) return false;
      return item.norm === normUtterance;
    });

    if (isDuplicate) {
      console.log(`[AIPipeline] 🛡️ [Room: ${roomId}] Suppressed rapid duplicate emission: "${cleanUtterance}"`);
      return;
    }

    if (!cleanUtterance || cleanUtterance.length < 2) {
      return;
    }

    spokenText = cleanUtterance;

    // Record verified speech in room history
    roomHistory.push({
      text: cleanUtterance,
      norm: normUtterance,
      time: now
    });
    this.roomRecentEmissions.set(roomId, roomHistory);

    console.log(`[AIPipeline] [Room: ${roomId}] [Seq: #${seqId}] Spoken text: "${spokenText}"`);

    // Retrieve previous context for coherent pronouns and clinical resolution
    const prevContext = this.roomContexts.get(roomId) || '';

    // Update room context (sliding window of last ~25 words)
    const newContext = (prevContext ? prevContext + ' ' : '') + spokenText;
    const contextWords = newContext.split(/\s+/).slice(-25).join(' ');
    this.roomContexts.set(roomId, contextWords);

    // FIN-01: Cost Protection / Lazy Cabins
    // Obtain active listening languages BEFORE LLM translation to avoid wasting tokens/quota
    const activeLangs = this.getActiveLanguages(roomId);
    const targetLangs = (forceLanguages && forceLanguages.length > 0)
      ? Array.from(new Set(forceLanguages))
      : activeLangs;

    // If 0 active listeners and host is not monitoring any booth: skip LLM translation & TTS completely
    if (targetLangs.length === 0) {
      console.log(`[AIPipeline] 💤 [Room: ${roomId}] 0 active listeners or monitored booths. Skipping LLM translation & TTS.`);
      const detectedLang = sourceLanguage || 'auto';
      const transcriptItem = {
        id: packetId,
        seqId,
        timestamp: Date.now(),
        originalText: spokenText,
        detectedLanguage: detectedLang,
        engineUsed: 'Native Only (Lazy)',
        translations: {
          [detectedLang !== 'auto' ? detectedLang : 'es']: spokenText
        },
        metrics: {
          sttMs: sttLatency,
          transMs: 0,
          ttsMs: 0,
          totalMs: Date.now() - pipelineStart
        }
      };

      // Broadcast transcript immediately for native captions (<500ms)
      roomManager.addTranscriptItem(roomId, transcriptItem);

      if (room.hostSocket && room.hostSocket.readyState === 1) {
        try {
          room.hostSocket.send(JSON.stringify({
            type: 'PIPELINE_METRIC',
            metric: {
              packetId,
              seqId,
              text: spokenText,
              detectedSource: detectedLang,
              engineUsed: 'Native Only (Lazy)',
              sttMs: sttLatency,
              transMs: 0,
              ttsMs: 0,
              activeChannels: [],
              totalLatencyMs: Date.now() - pipelineStart,
              timestamp: Date.now()
            }
          }));
        } catch (e) {}
      }
      return transcriptItem;
    }

    // Step 2: Multi-Language Translation (Parallel to EN, ES, IT, PT)
    const transStart = Date.now();
    let transResult;
    try {
      const transPromise = translationService.translateAll(spokenText, sourceLanguage, {
        roomId,
        medicalMode,
        medicalSpecialty,
        customGlossary,
        contextHistory: prevContext
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TRANSLATION_TIMEOUT')), 5000)
      );
      transResult = await Promise.race([transPromise, timeoutPromise]);
    } catch (err) {
      console.warn(`[AIPipeline] ⚠️ Translation error or timeout in room ${roomId}: ${err.message}. Using Emergency Verbatim Fallback.`);
      const fallbackTranslations = {};
      for (const lang of targetLangs) {
        fallbackTranslations[lang] = spokenText;
      }
      fallbackTranslations[sourceLanguage !== 'auto' ? sourceLanguage : 'es'] = spokenText;
      transResult = {
        originalText: spokenText,
        detectedSource: sourceLanguage !== 'auto' ? sourceLanguage : 'auto',
        engineUsed: 'Emergency Verbatim Fallback',
        translations: fallbackTranslations
      };
    }
    const transLatency = Date.now() - transStart;
    const detectedLang = transResult.detectedSource || sourceLanguage || 'auto';

    const transcriptItem = {
      id: packetId,
      seqId,
      timestamp: Date.now(),
      originalText: spokenText,
      detectedLanguage: detectedLang,
      engineUsed: transResult.engineUsed || 'Google Neural',
      translations: transResult.translations,
      metrics: {
        sttMs: sttLatency,
        transMs: transLatency,
        totalMs: 0
      }
    };

    // Broadcast transcript immediately for ultra-fast live captions (<500ms)
    roomManager.addTranscriptItem(roomId, transcriptItem);

    // Step 3: Bulkhead Orchestration: Fast Lane for healthy cabins + Healing Lane for omitted cabins
    const ttsStart = Date.now();
    const cleanSpoken = spokenText.trim().toLowerCase();
    const sourceShort = (detectedLang || sourceLanguage || 'es').slice(0, 2).toLowerCase();
    const reportedOmitted = new Set(transResult.omittedKeys || []);

    const isUniversalCognate = (txt) => {
      const COGNATES = new Set([
        'doctor', 'hospital', 'covid', 'covid-19', 'diabetes', 'hepatitis', 'shock',
        'parkinson', 'alzheimer', 'ecg', 'ekg', 'icu', 'uci', 'dna', 'arn', 'adn'
      ]);
      return COGNATES.has(txt.toLowerCase().trim());
    };

    const isOmittedOrUntranslated = (lang) => {
      if (lang === sourceShort) return false;
      if (reportedOmitted.has(lang)) return true;
      const tVal = (transResult.translations[lang] || '').trim();
      if (!tVal) return true;
      // Si el texto es idéntico palabra por palabra al texto de origen en idioma distinto, es un fallback no traducido
      // salvo que se trate de un término médico internacional o acrónimo universal
      if (tVal.toLowerCase() === cleanSpoken && cleanSpoken.length > 5 && !isUniversalCognate(cleanSpoken)) return true;
      return false;
    };

    const healthyLangs = targetLangs.filter(l => !isOmittedOrUntranslated(l));
    const healingLangs = targetLangs.filter(l => isOmittedOrUntranslated(l));

    // VÍA RÁPIDA (Fast Lane): Sintetizar y difundir de inmediato las cabinas sanas sin demora (<180ms)
    const fastLanePromises = healthyLangs.map(async (lang) => {
      const translatedText = transResult.translations[lang] || spokenText;
      if (!translatedText) return;

      try {
        const audioResult = await ttsService.synthesize(translatedText, lang);
        if (audioResult) {
          roomManager.broadcastAudioToLanguageChannel(roomId, lang, {
            id: `${packetId}_${lang}`,
            seqId,
            lang,
            text: translatedText,
            audioBase64: audioResult.audioBase64,
            useClientWebSpeech: audioResult.useClientWebSpeech,
            mimeType: audioResult.mimeType || 'audio/mpeg',
            duration: audioResult.durationMs,
            latencyMs: Date.now() - pipelineStart,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        console.error(`[AIPipeline] Error synthesizing TTS for healthy lang ${lang}:`, err.message);
      }
    });

    // VÍA DE AUTO-RECUPERACIÓN (Healing Lane): Auto-sanar cabinas omitidas con oyentes activos (<80ms)
    // Se ejecuta en paralelo sin bloquear la vía rápida (Aislamiento Bulkhead)
    if (healingLangs.length > 0) {
      console.log(`[AIPipeline] 🛡️ [Room: ${roomId}] Bulkhead activado para cabina(s) omitida(s): [${healingLangs.join(', ')}]. Auto-sanando en paralelo...`);
      for (const lang of healingLangs) {
        (async () => {
          try {
            const healedRes = await translationService.translateWithFreeEngine(spokenText, detectedLang, [lang]);
            const healedText = (healedRes && healedRes.translations && healedRes.translations[lang]) || spokenText;
            transResult.translations[lang] = healedText;
            transcriptItem.translations[lang] = healedText;

            // Actualizar el historial de la sala y notificar a los oyentes de esa cabina
            roomManager.updateTranscriptItem(roomId, transcriptItem);

            // Sintetizar y difundir audio TTS para la cabina sanada
            const audioResult = await ttsService.synthesize(healedText, lang);
            if (audioResult) {
              roomManager.broadcastAudioToLanguageChannel(roomId, lang, {
                id: `${packetId}_${lang}_healed`,
                seqId,
                lang,
                text: healedText,
                audioBase64: audioResult.audioBase64,
                useClientWebSpeech: audioResult.useClientWebSpeech,
                mimeType: audioResult.mimeType || 'audio/mpeg',
                duration: audioResult.durationMs,
                latencyMs: Date.now() - pipelineStart,
                timestamp: Date.now()
              });
              console.log(`[AIPipeline] 🩹 [Room: ${roomId}] Cabina '${lang}' auto-sanada y difundida con éxito (<${Date.now() - pipelineStart}ms).`);
            }
          } catch (hErr) {
            console.warn(`[AIPipeline] Micro-fallback de auto-sanación falló para cabina '${lang}':`, hErr.message);
          }
        })();
      }
    }

    // Esperar síntesis de la vía rápida para mantener métricas de latencia de ultra-baja demora
    try {
      await Promise.race([
        Promise.all(fastLanePromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('TTS_TIMEOUT')), 4500))
      ]);
    } catch (ttsErr) {
      if (ttsErr?.message === 'TTS_TIMEOUT') {
        console.warn(`[AIPipeline] ⏱️ Síntesis TTS de vía rápida excedió tiempo límite para paquete ${packetId} (seq ${seqId})`);
      } else {
        console.warn('[AIPipeline] Error en TTS de vía rápida:', ttsErr);
      }
    }

    const totalPipelineLatency = Date.now() - pipelineStart;
    transcriptItem.metrics.totalMs = totalPipelineLatency;

    // Send pipeline telemetry event to host
    if (room.hostSocket && room.hostSocket.readyState === 1) {
      try {
        room.hostSocket.send(JSON.stringify({
          type: 'PIPELINE_METRIC',
          metric: {
            packetId,
            seqId,
            text: spokenText,
            detectedSource: detectedLang,
            engineUsed: transResult.engineUsed || 'Google Neural',
            sttMs: sttLatency,
            transMs: transLatency,
            ttsMs: Date.now() - ttsStart,
            activeChannels: targetLangs,
            totalLatencyMs: totalPipelineLatency,
            timestamp: Date.now()
          }
        }));
      } catch (e) {}
    }

    return transcriptItem;
  }

  /**
   * Generate AI Session Summary and Key Takeaways
   */
  async generateSessionSummary(roomId) {
    const room = roomManager.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const transcripts = room.transcriptHistory || [];
    if (transcripts.length === 0) {
      return {
        success: true,
        isEmpty: true,
        title: room.title || `Conferencia ${room.id}`,
        summaryEs: 'No se detectaron discursos durante esta sesión para resumir.',
        summaryEn: 'No speech was recorded during this session to summarize.',
        keyTakeawaysEs: [],
        keyTakeawaysEn: [],
        conclusions: 'Sin contenido registrado.',
        attendeeCount: room.listeners.size,
        totalSentences: 0
      };
    }

    const fullDialogue = transcripts.map(t => t.originalText).join(' ');

    if (this.openaiApiKey) {
      try {
        const prompt = `Eres un asistente ejecutivo especializado en conferencias internacionales.
A continuación tienes la transcripción completa de una conferencia o keynote:
"${fullDialogue.slice(0, 8000)}"

Genera un informe profesional con esta estructura JSON exacta:
{
  "title": "Título representativo de la conferencia",
  "summaryEs": "Resumen ejecutivo en español (2 párrafos concisos)",
  "summaryEn": "Executive summary in English (2 concise paragraphs)",
  "keyTakeawaysEs": ["Punto clave 1", "Punto clave 2", "Punto clave 3", "Punto clave 4"],
  "keyTakeawaysEn": ["Key point 1", "Key point 2", "Key point 3", "Key point 4"],
  "conclusions": "Conclusiones y próximos pasos recomendados"
}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openaiApiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.3
          }),
          signal: AbortSignal.timeout(12000)
        });

        if (response.ok) {
          const data = await response.json();
          const content = JSON.parse(data.choices[0]?.message?.content || '{}');
          return {
            success: true,
            ...content,
            executiveSummary: content.summaryEs || content.summaryEn || '',
            keyPoints: content.keyTakeawaysEs || content.keyTakeawaysEn || [],
            actionItems: content.conclusions ? [content.conclusions] : [],
            totalSentences: transcripts.length,
            attendeeCount: room.registeredAttendees.size || room.listeners.size,
            generatedAt: new Date().toISOString()
          };
        }
      } catch (err) {
        console.warn('[AIPipeline] OpenAI summary failed, using heuristic fallback:', err.message);
      }
    }

    // Heuristic summary fallback (Out-of-the-Box mode without API keys)
    const sentences = transcripts.map(t => t.originalText);
    const keyTakeaways = sentences.slice(0, Math.min(5, sentences.length));
    const summaryEs = `Durante la sesión de la sala ${room.id} se procesaron ${transcripts.length} intervenciones de voz en tiempo real con interpretación simultánea a múltiples idiomas. Los asistentes pudieron sintonizar los canales de voz desde sus teléfonos móviles.`;

    return {
      success: true,
      title: room.title || `Conferencia ${room.id}`,
      summaryEs,
      summaryEn: `During the session in room ${room.id}, ${transcripts.length} speech turns were translated in real time with simultaneous multi-channel voice interpretation.`,
      executiveSummary: summaryEs,
      keyPoints: keyTakeaways,
      keyTakeawaysEs: keyTakeaways,
      keyTakeawaysEn: keyTakeaways.map(s => `Key discussion: ${s}`),
      actionItems: ['La sesión se completó exitosamente con distribución multicanal.'],
      conclusions: 'La sesión se completó exitosamente con distribución multicanal.',
      totalSentences: transcripts.length,
      attendeeCount: room.registeredAttendees.size || room.listeners.size,
      generatedAt: new Date().toISOString()
    };
  }
}

export const aiPipeline = new AIPipeline();

