import crypto from 'crypto';
import { roomManager } from '../roomManager.js';
import { translationService } from './translationService.js';
import { ttsService } from './ttsService.js';
import { sttService } from './sttService.js';
import { geminiLiveBridge } from './geminiLiveBridge.js';

/**
 * Canonical ISO-639-1 language normalizer for LiftVoice AI Pipeline
 */
export function normalizePipelineLang(lang) {
  if (!lang || lang === 'auto' || lang === 'multi' || lang === 'none') return 'auto';
  const l = String(lang).toLowerCase().trim();
  if (l === 'none' || l === 'null' || l === 'undefined') return 'auto';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('it')) return 'it';
  if (l.startsWith('pt')) return 'pt';
  return l.slice(0, 2);
}

/**
 * Merges two consecutive speech segments, eliminating any overlapping suffix-prefix words.
 * E.g.:
 * prev: "Entonces, ¿qué podemos hacer con la suma de"
 * next: "¿qué podemos hacer con la suma de los números y la multiplicación?"
 * result: "Entonces, ¿qué podemos hacer con la suma de los números y la multiplicación?"
 */
export function mergeOverlappingSpeech(prevText, nextText) {
  if (!prevText || !prevText.trim()) return nextText ? nextText.trim() : '';
  if (!nextText || !nextText.trim()) return prevText ? prevText.trim() : '';

  const cleanPrev = prevText.trim();
  const cleanNext = nextText.trim();

  const normWord = (w) => (w || '').toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();

  const prevWords = cleanPrev.split(/\s+/).filter(Boolean);
  const nextWords = cleanNext.split(/\s+/).filter(Boolean);

  const normPrevWords = prevWords.map(normWord);
  const normNextWords = nextWords.map(normWord);

  const prevNormJoined = normPrevWords.join(' ');
  const nextNormJoined = normNextWords.join(' ');

  // 1. Full containment: next already includes prev
  if (nextNormJoined.startsWith(prevNormJoined)) {
    return cleanNext;
  }
  // Prev already includes next
  if (prevNormJoined.endsWith(nextNormJoined) || prevNormJoined === nextNormJoined) {
    return cleanPrev;
  }

  // 2. Find longest overlapping suffix of prev that matches prefix of next
  const maxOverlap = Math.min(prevWords.length, nextWords.length);
  for (let k = maxOverlap; k >= 1; k--) {
    let match = true;
    for (let i = 0; i < k; i++) {
      if (normPrevWords[normPrevWords.length - k + i] !== normNextWords[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      const nonOverlappingNext = nextWords.slice(k).join(' ');
      return nonOverlappingNext ? `${cleanPrev} ${nonOverlappingNext}`.trim() : cleanPrev;
    }
  }

  return `${cleanPrev} ${cleanNext}`.trim();
}

/**
 * Removes back-to-back repeating phrases of 2+ words within a single utterance.
 * E.g.: "hacer con la suma de ¿qué podemos hacer con la suma de los números"
 */
export function deduplicateRepeatedPhrases(text) {
  if (!text || typeof text !== 'string' || text.length < 10) return text || '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 4) return text.trim();

  const normWord = (w) => (w || '').toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
  const norm = words.map(normWord);

  // Check repeating phrase lengths from floor(N/2) down to 2 words
  for (let k = Math.floor(words.length / 2); k >= 2; k--) {
    for (let i = 0; i <= words.length - 2 * k; i++) {
      let isRepeat = true;
      for (let j = 0; j < k; j++) {
        if (!norm[i + j] || norm[i + j] !== norm[i + k + j]) {
          isRepeat = false;
          break;
        }
      }
      if (isRepeat) {
        words.splice(i + k, k);
        return deduplicateRepeatedPhrases(words.join(' '));
      }
    }
  }
  return words.join(' ');
}

/**
 * AI Pipeline Orchestrator for LiftVoice (2026 Edition)
 * Mic / Speech -> STT -> Multi-target Translation -> Parallel TTS -> Monotonic Serialized Broadcast
 */
export class AIPipeline {
  constructor() {
    this.activePipelines = new Set();
    this.roomQueues = new Map(); // roomId -> Promise chain
    this.roomQueueDepths = new Map(); // roomId -> count of pending chunks in flight (shed-load defense)
    this.roomSeqCounters = new Map(); // roomId -> integer
    this.roomContexts = new Map(); // roomId -> string of recent spoken words
    this.roomRecentEmissions = new Map(); // roomId -> Array of { text, norm, time }
    this.cabinQueues = new Map(); // `${roomId}:${lang}` -> Promise chain for sequential per-cabin TTS
    this.cabinQueueDepths = new Map(); // `${roomId}:${lang}` -> integer depth (shed-load defense)
    this.cabinPendingTexts = new Map(); // `${roomId}:${lang}` -> Coalesced pending texts waiting for current synthesis to finish
    this.roomDecalageBuffers = new Map(); // roomId -> { text, timer, opts }
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    this._pipelineMode = 'deepgram_gemini';
    this.geminiLiveVoices = { en: 'Aoede', it: 'Kore', pt: 'Fenrir', es: 'Charon' };
  }

  get pipelineMode() {
    return this._pipelineMode || 'deepgram_gemini';
  }

  set pipelineMode(mode) {
    const norm = (mode === 'gemini_live_s2s') ? 'gemini_live_s2s' : 'deepgram_gemini';
    this._pipelineMode = norm;
    if (norm !== 'gemini_live_s2s') {
      geminiLiveBridge.closeAllSessions();
    }
  }

  setApiKeys({
    openaiApiKey,
    openaiModel,
    openaiTemp,
    deepgramApiKey,
    elevenLabsApiKey,
    cartesiaApiKey,
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
    googleNeuralMode,
    pipelineMode,
    geminiLiveVoices
  }) {
    if (pipelineMode !== undefined) {
      if (typeof pipelineMode === 'string' && ['deepgram_gemini', 'gemini_live_s2s'].includes(pipelineMode.trim())) {
        const targetMode = pipelineMode.trim();
        if (this.pipelineMode === 'gemini_live_s2s' && targetMode !== 'gemini_live_s2s') {
          geminiLiveBridge.closeAllSessions();
        }
        this.pipelineMode = targetMode;
        geminiLiveBridge.pipelineMode = targetMode;
        roomManager.setDefaultPipelineMode(targetMode);
      }
    }
    if (geminiLiveVoices !== undefined && typeof geminiLiveVoices === 'object' && !Array.isArray(geminiLiveVoices)) {
      geminiLiveBridge.setGeminiLiveVoices(geminiLiveVoices);
      this.geminiLiveVoices = { ...geminiLiveBridge.geminiLiveVoices };
      roomManager.setDefaultGeminiLiveVoices(this.geminiLiveVoices);
    }
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
      if (geminiApiKey) geminiLiveBridge.setApiKey(geminiApiKey);
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
      cartesiaApiKey,
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
    geminiLiveBridge.closeRoom(key);
    this.roomQueues.delete(key);
    this.roomQueueDepths.delete(key);
    this.roomSeqCounters.delete(key);
    this.roomContexts.delete(key);
    this.roomRecentEmissions.delete(key);
    const buf = this.roomDecalageBuffers?.get(key);
    if (buf?.timer) clearTimeout(buf.timer);
    this.roomDecalageBuffers?.delete(key);
    for (const cKey of this.cabinQueues.keys()) {
      if (cKey.startsWith(`${key}:`)) {
        this.cabinQueues.delete(cKey);
      }
    }
    for (const cKey of this.cabinPendingTexts.keys()) {
      if (cKey.startsWith(`${key}:`)) {
        this.cabinPendingTexts.delete(cKey);
      }
    }
    for (const cKey of this.cabinQueueDepths.keys()) {
      if (cKey.startsWith(`${key}:`)) {
        this.cabinQueueDepths.delete(cKey);
      }
    }
  }

  flushDecalageBuffer(roomId) {
    const key = (roomId || 'MAIN').toUpperCase();
    if (!this.roomDecalageBuffers) this.roomDecalageBuffers = new Map();
    const entry = this.roomDecalageBuffers.get(key);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    this.roomDecalageBuffers.delete(key);
    if (entry.text && entry.text.trim()) {
      console.log(`[AIPipeline] 🚀 [Room: ${key}] Décalage window elapsed. Flushing accumulated clause: "${entry.text}"`);
      this.processSpeech({ ...entry.opts, roomId: key, text: entry.text.trim(), audioBuffer: null, bypassDecalage: true }).catch((err) => {
        console.warn(`[AIPipeline] Error executing flushed décalage clause in room ${key}:`, err);
      });
    }
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

    // SOTA 2026 Elastic Speech Queue: Allow rapid speech bursts up to 12 concurrent/chained items
    const currentDepth = this.roomQueueDepths.get(roomId) || 0;
    const MAX_ROOM_QUEUE_DEPTH = 12;
    if (currentDepth >= MAX_ROOM_QUEUE_DEPTH) {
      console.warn(`[AIPipeline] ⚠️ Extreme backpressure in room ${roomId} (queue depth: ${currentDepth} >= ${MAX_ROOM_QUEUE_DEPTH}). Soft-limiting input to protect heap.`);
      return { dropped: true, reason: 'BACKPRESSURE_LOAD_SHEDDING', seqId };
    }

    this.roomQueueDepths.set(roomId, currentDepth + 1);

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
        const nextDepth = Math.max(0, (this.roomQueueDepths.get(roomId) || 1) - 1);
        this.roomQueueDepths.set(roomId, nextDepth);
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
    let { roomId, text, audioBuffer, mimeType, sourceLanguage = 'auto', seqId = 1, forceLanguages = [], medicalMode, medicalSpecialty, customGlossary, sttEngine, sttModel } = opts;
    roomId = (roomId || 'MAIN').toUpperCase();
    sourceLanguage = normalizePipelineLang(sourceLanguage);
    const pipelineStart = Date.now();
    const packetId = `pkt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    let spokenText = (text || '').trim();
    let sttLatency = 0;
    let sttEngineUsed = sttEngine || null;
    let sttModelUsed = sttModel || null;

    const room = roomManager.getRoom(roomId);
    if (!room) {
      console.warn(`[AIPipeline] Room ${roomId} not found.`);
      return;
    }

    // Gemini 3.8 Live Speech-to-Speech (S2S) Engine Fast-Path with Resilient Cascade Fallback
    const isGeminiLiveMode = this.pipelineMode === 'gemini_live_s2s' || room?.config?.pipelineMode === 'gemini_live_s2s';
    if (isGeminiLiveMode) {
      let s2sSuccess = false;
      try {
        if (!spokenText && audioBuffer) {
          try {
            const hasDeepgram = Boolean(this.deepgramApiKey || process.env.DEEPGRAM_API_KEY);
            const sttResult = await sttService.transcribeAudio(audioBuffer, mimeType, sourceLanguage, {
              preferredSttEngine: hasDeepgram ? 'deepgram' : undefined,
              medicalMode
            });
            if (sttResult && sttResult.text) {
              spokenText = sttResult.text.trim();
              if (sttResult.detectedLanguage && sttResult.detectedLanguage !== 'auto') {
                sourceLanguage = normalizePipelineLang(sttResult.detectedLanguage);
              }
            }
          } catch (sttErr) {
            console.warn(`[AIPipeline] S2S transcribeAudio note:`, sttErr?.message);
          }
        }

        if (spokenText) {
          await geminiLiveBridge.feedSpeakerText(roomId, spokenText, {
            packetId,
            seqId,
            sourceLanguage,
            forceLanguages,
            originalText: spokenText
          });
          s2sSuccess = true;
        } else if (audioBuffer) {
          await geminiLiveBridge.feedSpeakerAudio(roomId, audioBuffer, mimeType, {
            packetId,
            seqId,
            sourceLanguage,
            forceLanguages,
            originalText: spokenText || text
          });
          s2sSuccess = true;
        }

        if (s2sSuccess) {
          // Emit pipeline telemetry for the host
          if (room.hostSocket && room.hostSocket.readyState === 1) {
            try {
              const isAdmin = Boolean(room.hostSocket.isAdminSession);
              const activeLangs = this.getActiveLanguages(roomId);
              room.hostSocket.send(JSON.stringify({
                type: 'PIPELINE_METRIC',
                metric: {
                  packetId,
                  seqId,
                  text: spokenText || text || 'Live Audio Stream',
                  detectedSource: sourceLanguage || 'auto',
                  engineUsed: isAdmin ? 'Gemini 3.8 Live S2S' : undefined,
                  sttEngine: isAdmin ? 'Gemini Live S2S' : undefined,
                  sttModel: isAdmin ? 'gemini-3.8-live' : undefined,
                  sttMs: 0,
                  transMs: 0,
                  ttsMs: 0,
                  activeChannels: activeLangs,
                  totalLatencyMs: Date.now() - pipelineStart,
                  timestamp: Date.now()
                }
              }));
            } catch (e) {}
          }
          return {
            id: packetId,
            seqId,
            pipelineMode: 'gemini_live_s2s'
          };
        }
      } catch (s2sErr) {
        console.warn(`[AIPipeline] ⚠️ Gemini Live S2S feed error in room ${roomId}: ${s2sErr.message}. Cascading to modular Deepgram/Gemini pipeline...`);
        // Fall through to standard STT -> Translation -> TTS pipeline below
      }
    }

    // Step 1: STT (if audio buffer provided and text is empty)
    if (!spokenText && audioBuffer) {
      const sttStart = Date.now();
      const sttResult = await sttService.transcribeAudio(audioBuffer, mimeType, sourceLanguage, { medicalMode });
      sttLatency = Date.now() - sttStart;
      if (sttResult && sttResult.text) {
        spokenText = sttResult.text;
        sttEngineUsed = sttResult.engine || 'Server STT';
        sttModelUsed = sttService.preferredSttEngine || 'whisper-1';
        if (sttResult.detectedLanguage && sttResult.detectedLanguage !== 'auto') {
          sourceLanguage = normalizePipelineLang(sttResult.detectedLanguage);
        }
      }
    } else if (spokenText && !sttEngineUsed) {
      sttEngineUsed = 'Deepgram Nova-3';
      sttModelUsed = 'nova-3';
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
    // Strip any intra-utterance repeated n-gram phrases (model stutter)
    let cleanUtterance = deduplicateRepeatedPhrases(cleanText);
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

    // Defense 2: Check if cleanUtterance repeats words from the most recently dispatched sentence
    const lastDispatched = roomHistory[roomHistory.length - 1];
    if (lastDispatched && (now - lastDispatched.time < 6000)) {
      const mergedDispatched = mergeOverlappingSpeech(lastDispatched.text, cleanUtterance);
      if (mergedDispatched === lastDispatched.text) {
        console.log(`[AIPipeline] 🛡️ [Room: ${roomId}] Suppressed redundant partial already dispatched: "${cleanUtterance}"`);
        return;
      }
      if (mergedDispatched.startsWith(lastDispatched.text)) {
        const remaining = mergedDispatched.slice(lastDispatched.text.length).trim();
        if (remaining && remaining !== cleanUtterance) {
          console.log(`[AIPipeline] 🛡️ [Room: ${roomId}] Stripped overlap with recent dispatch: "${cleanUtterance}" -> "${remaining}"`);
          cleanUtterance = remaining;
          normUtterance = normalizePipelineSpeech(cleanUtterance);
        }
      }
    }

    if (!cleanUtterance || cleanUtterance.length < 2) {
      return;
    }

    // --- DÉCALAGE / CLAUSE ACCUMULATION ENGINE (2026 Semantic SBD & Smart Tail Flush) ---
    const existingBuffer = this.roomDecalageBuffers?.get(roomId);
    const decalageMode = room?.config?.decalageMode || this.decalageMode || 'streaming';
    const isBypass = Boolean(opts.bypassDecalage || opts.isTerminalSilence || opts.endOfTurn);
    
    // Accumulate candidate text using intelligent overlap merging and deduplication
    const candidateRawText = existingBuffer ? mergeOverlappingSpeech(existingBuffer.text, cleanUtterance) : cleanUtterance;
    const candidateFullText = deduplicateRepeatedPhrases(candidateRawText);
    const isTerminal = /[.!?…]\s*$/.test(candidateFullText) || isBypass;
    const wordCount = cleanUtterance.split(/\s+/).filter(Boolean).length;
    const totalAccumulatedWords = candidateFullText.split(/\s+/).filter(Boolean).length;
    const isStreaming = decalageMode === 'streaming' || decalageMode === 'fast' || decalageMode === 'quick';

    // Despacho inteligente para traducción y TTS:
    // 1. Bypass explícito (fin de turno, silencio terminal de VAD o input manual)
    // 2. Oración terminal completa: tiene puntuación (. ? !) y al menos 4 palabras
    // 3. Ventana máxima de acumulación de palabras para evitar latencia excesiva (10 en streaming, 16 en paused)
    const shouldDispatch = isBypass ||
      (isTerminal && totalAccumulatedWords >= 4) ||
      (totalAccumulatedWords >= (isStreaming ? 10 : (decalageMode === 'paused' ? 16 : 8)));

    if (shouldDispatch) {
      if (existingBuffer) {
        if (existingBuffer.timer) clearTimeout(existingBuffer.timer);
        this.roomDecalageBuffers.delete(roomId);
      }
      cleanUtterance = candidateFullText;
      spokenText = cleanUtterance;
      normUtterance = normalizePipelineSpeech(cleanUtterance);
    } else {
      // Accumulate in buffer and schedule flush
      if (existingBuffer?.timer) clearTimeout(existingBuffer.timer);

      const waitMs = isStreaming ? 750 : (decalageMode === 'paused' ? 1800 : 900);
      const timer = setTimeout(() => {
        this.flushDecalageBuffer(roomId);
      }, waitMs);

      this.roomDecalageBuffers.set(roomId, {
        text: candidateFullText,
        timer,
        opts: { ...opts, audioBuffer: null, text: candidateFullText, seqId, sttEngineUsed, sttModelUsed, sttLatency, bypassDecalage: true }
      });
      console.log(`[AIPipeline] ⏳ [Room: ${roomId}] Décalage buffering clause (${totalAccumulatedWords} words, mode: ${decalageMode}): "${candidateFullText}"`);
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
    const rawTargetLangs = (forceLanguages && forceLanguages.length > 0)
      ? Array.from(new Set(forceLanguages))
      : activeLangs;
    const targetLangs = Array.from(new Set(
      rawTargetLangs.map(normalizePipelineLang).filter(l => l && l !== 'auto')
    ));

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
        sttEngineUsed: sttEngineUsed || 'Deepgram Nova-3',
        sttModel: sttModelUsed || 'nova-3',
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
          const isAdmin = Boolean(room.hostSocket.isAdminSession);
          room.hostSocket.send(JSON.stringify({
            type: 'PIPELINE_METRIC',
            metric: {
              packetId,
              seqId,
              text: spokenText,
              detectedSource: detectedLang,
              engineUsed: isAdmin ? 'Native Only (Lazy)' : undefined,
              sttEngine: isAdmin ? (sttEngineUsed || 'Deepgram Nova-3') : undefined,
              sttModel: isAdmin ? (sttModelUsed || 'nova-3') : undefined,
              sttMs: isAdmin ? sttLatency : undefined,
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
        contextHistory: prevContext,
        targets: targetLangs
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TRANSLATION_TIMEOUT')), 8500)
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
    const detectedLang = transResult.detectedSource ? normalizePipelineLang(transResult.detectedSource) : (sourceLanguage !== 'auto' ? sourceLanguage : 'es');

    const transcriptItem = {
      id: packetId,
      seqId,
      timestamp: Date.now(),
      originalText: spokenText,
      detectedLanguage: detectedLang,
      engineUsed: transResult.engineUsed || 'Google Neural',
      sttEngineUsed: sttEngineUsed || 'Deepgram Nova-3',
      sttModel: sttModelUsed || 'nova-3',
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
    const sourceShort = normalizePipelineLang(detectedLang || sourceLanguage || 'es');
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
      // Normalizar quitando signos de puntuación y símbolos Unicode (comillas curvas, guiones, etc.) para evitar falsos negativos
      const normTVal = tVal.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
      const normSpoken = cleanSpoken.replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
      if (normTVal === normSpoken && normSpoken.length > 5 && !isUniversalCognate(normSpoken)) return true;
      return false;
    };

    const healthyLangs = targetLangs.filter(l => !isOmittedOrUntranslated(l));
    const healingLangs = targetLangs.filter(l => isOmittedOrUntranslated(l));

    // Despacho de síntesis TTS por cabina desacoplado en colas independientes FIFO por idioma
    // SOTA 2026 Zero-Loss Cabin Dispatch with Adaptive Clause Coalescence
    const MAX_CABIN_TASK_AGE_MS = 25000; // 25s conference-grade décalage window

    for (const lang of healthyLangs) {
      const cabinKey = `${roomId}:${lang}`;
      const translatedText = transResult.translations[lang] || spokenText;
      if (!translatedText) continue;

      const currentDepth = this.cabinQueueDepths.get(cabinKey) || 0;
      if (currentDepth > 0) {
        // A synthesis task is already executing for this cabin: coalesce pending text into structured queue
        const existing = this.cabinPendingTexts.get(cabinKey) || {
          text: '',
          seqIds: [],
          packetIds: [],
          arrivedAt: Date.now(),
          count: 0
        };

        // Guard against unbounded allocation / cloud TTS limits (cap at 3,000 characters)
        if (existing.text.length + translatedText.length > 3000) {
          console.warn(`[AIPipeline] ⚠️ Cabin ${cabinKey} pending text exceeded 3000 chars. Trimming oldest clause.`);
          existing.text = existing.text.slice(-1500);
        }

        const sep = /[.!?…][\p{Pe}\p{Pf}"'”»\s]*$/u.test(existing.text.trim()) ? ' ' : '. ';
        existing.text = existing.text ? `${existing.text.trim()}${sep}${translatedText.trim()}` : translatedText.trim();
        existing.seqIds.push(seqId);
        existing.packetIds.push(packetId);
        existing.count++;
        existing.arrivedAt = Date.now();
        this.cabinPendingTexts.set(cabinKey, existing);
        console.log(`[AIPipeline] 🔗 [Cabin: ${cabinKey}] Coalescing rapid speech burst into pending queue (Count: ${existing.count}): "${existing.text}"`);
        continue;
      }

      this.cabinQueueDepths.set(cabinKey, 1);

      const prevTask = this.cabinQueues.get(cabinKey) || Promise.resolve();
      const nextTask = prevTask
        .catch(() => {})
        .then(async () => {
          let textToSynthesize = translatedText;
          let currentIterationSeq = seqId;
          let coalescedSeqIds = [seqId];
          let coalescedPacketIds = [packetId];
          let iterationIndex = 0;
          let lastBurstArrival = pipelineStart;

          while (textToSynthesize) {
            iterationIndex++;
            const subPacketId = iterationIndex === 1 ? `${packetId}_${lang}` : `${packetId}_${lang}_part${iterationIndex}`;

            const pendingExtra = this.cabinPendingTexts.get(cabinKey);
            if (pendingExtra) {
              const sep = /[.!?…][\p{Pe}\p{Pf}"'”»\s]*$/u.test(textToSynthesize.trim()) ? ' ' : '. ';
              textToSynthesize = `${textToSynthesize.trim()}${sep}${pendingExtra.text.trim()}`.trim();
              if (pendingExtra.seqIds && pendingExtra.seqIds.length > 0) {
                currentIterationSeq = Math.max(currentIterationSeq, ...pendingExtra.seqIds);
                coalescedSeqIds.push(...pendingExtra.seqIds);
              }
              if (pendingExtra.packetIds && pendingExtra.packetIds.length > 0) {
                coalescedPacketIds.push(...pendingExtra.packetIds);
              }
              lastBurstArrival = pendingExtra.arrivedAt || Date.now();
              this.cabinPendingTexts.delete(cabinKey);
            }

            if (Date.now() - lastBurstArrival > MAX_CABIN_TASK_AGE_MS) {
              console.warn(`[AIPipeline] ⏱️ Discarding expired TTS task (>25s) for cabin ${cabinKey}`);
              break;
            }

            try {
              const voiceOpt = {
                voice: room?.config?.voiceConfig?.[lang],
                gender: room?.config?.voiceGender?.[lang],
                engine: room?.config?.preferredTtsEngine
              };
              const audioResult = await ttsService.synthesize(textToSynthesize, lang, voiceOpt);
              if (audioResult) {
                let audioBuffer = audioResult.audioBuffer;
                if (!audioBuffer && audioResult.audioBase64) {
                  try { audioBuffer = Buffer.from(audioResult.audioBase64, 'base64'); } catch (e) {}
                }
                roomManager.broadcastAudioToLanguageChannel(roomId, lang, {
                  id: subPacketId,
                  seqId: currentIterationSeq,
                  coalescedSeqIds: Array.from(new Set(coalescedSeqIds)),
                  coalescedPacketIds: Array.from(new Set(coalescedPacketIds)),
                  lang,
                  text: textToSynthesize,
                  audioBase64: audioResult.audioBase64,
                  audioBuffer,
                  useClientWebSpeech: audioResult.useClientWebSpeech,
                  mimeType: audioResult.mimeType || 'audio/mpeg',
                  duration: audioResult.durationMs,
                  latencyMs: Date.now() - lastBurstArrival,
                  timestamp: Date.now()
                });
              }
            } catch (err) {
              console.error(`[AIPipeline] Error synthesizing TTS for healthy lang ${lang}:`, err.message);
            }

            // Drain any rapid speech bursts that queued while synthesizing
            if (this.cabinPendingTexts.has(cabinKey)) {
              const nextPending = this.cabinPendingTexts.get(cabinKey);
              textToSynthesize = nextPending.text;
              currentIterationSeq = Math.max(currentIterationSeq, ...(nextPending.seqIds || [currentIterationSeq]));
              coalescedSeqIds = nextPending.seqIds || [];
              coalescedPacketIds = nextPending.packetIds || [];
              lastBurstArrival = nextPending.arrivedAt || Date.now();
              this.cabinPendingTexts.delete(cabinKey);
              console.log(`[AIPipeline] 🔄 [Cabin: ${cabinKey}] Draining coalesced speech backlog: "${textToSynthesize}"`);
            } else {
              textToSynthesize = null;
            }
          }
        })
        .finally(() => {
          this.cabinQueueDepths.delete(cabinKey);
          if (this.cabinQueues.get(cabinKey) === nextTask) {
            this.cabinQueues.delete(cabinKey);
          }
        });
      this.cabinQueues.set(cabinKey, nextTask);
    }

    // VÍA DE AUTO-RECUPERACIÓN (Healing Lane): Auto-sanar cabinas omitidas con oyentes activos (<80ms)
    // Aislamiento Bulkhead estricto con espacio de nombres propio (:healing) para evitar colisiones lingüísticas
    if (healingLangs.length > 0) {
      console.log(`[AIPipeline] 🛡️ [Room: ${roomId}] Bulkhead activado para cabina(s) omitida(s): [${healingLangs.join(', ')}]. Auto-sanando en paralelo...`);
      for (const lang of healingLangs) {
        const healingKey = `${roomId}:${lang}:healing`;
        const currentDepth = this.cabinQueueDepths.get(healingKey) || 0;
        if (currentDepth > 0) {
          const existing = this.cabinPendingTexts.get(healingKey) || {
            text: '',
            seqIds: [],
            packetIds: [],
            arrivedAt: Date.now()
          };
          const sep = /[.!?…][\p{Pe}\p{Pf}"'”»\s]*$/u.test(existing.text.trim()) ? ' ' : '. ';
          existing.text = existing.text ? `${existing.text.trim()}${sep}${spokenText.trim()}` : spokenText.trim();
          existing.seqIds.push(seqId);
          existing.packetIds.push(packetId);
          this.cabinPendingTexts.set(healingKey, existing);
          continue;
        }
        this.cabinQueueDepths.set(healingKey, 1);

        const prevTask = this.cabinQueues.get(healingKey) || Promise.resolve();
        const nextTask = prevTask
          .catch(() => {})
          .then(async () => {
            let textToHeal = spokenText;
            let currentIterationSeq = seqId;
            let coalescedSeqIds = [seqId];
            let coalescedPacketIds = [packetId];
            let iterationIndex = 0;
            let lastBurstArrival = pipelineStart;

            while (textToHeal) {
              iterationIndex++;
              const subPacketId = iterationIndex === 1 ? `${packetId}_${lang}_healed` : `${packetId}_${lang}_healed_part${iterationIndex}`;

              if (Date.now() - lastBurstArrival > MAX_CABIN_TASK_AGE_MS) {
                console.warn(`[AIPipeline] ⏱️ Discarding expired healed TTS task (>25s) for cabin ${healingKey}`);
                break;
              }
              try {
                const pendingExtra = this.cabinPendingTexts.get(healingKey);
                if (pendingExtra) {
                  const sep = /[.!?…][\p{Pe}\p{Pf}"'”»\s]*$/u.test(textToHeal.trim()) ? ' ' : '. ';
                  textToHeal = `${textToHeal.trim()}${sep}${pendingExtra.text.trim()}`.trim();
                  if (pendingExtra.seqIds && pendingExtra.seqIds.length > 0) {
                    currentIterationSeq = Math.max(currentIterationSeq, ...pendingExtra.seqIds);
                    coalescedSeqIds.push(...pendingExtra.seqIds);
                  }
                  if (pendingExtra.packetIds && pendingExtra.packetIds.length > 0) {
                    coalescedPacketIds.push(...pendingExtra.packetIds);
                  }
                  lastBurstArrival = pendingExtra.arrivedAt || Date.now();
                  this.cabinPendingTexts.delete(healingKey);
                }
                const healedRes = await translationService.translateWithFreeEngine(textToHeal, detectedLang, [lang]);
                const healedText = (healedRes && healedRes.translations && healedRes.translations[lang]) || textToHeal;
                transResult.translations[lang] = healedText;
                transcriptItem.translations[lang] = healedText;

                // Actualizar el historial de la sala y notificar a los oyentes de esa cabina
                roomManager.updateTranscriptItem(roomId, transcriptItem);

                // Sintetizar y difundir audio TTS para la cabina sanada con configuración de la sala
                const voiceOpt = {
                  voice: room?.config?.voiceConfig?.[lang],
                  gender: room?.config?.voiceGender?.[lang],
                  engine: room?.config?.preferredTtsEngine
                };
                const audioResult = await ttsService.synthesize(healedText, lang, voiceOpt);
                if (audioResult) {
                  let audioBuffer = audioResult.audioBuffer;
                  if (!audioBuffer && audioResult.audioBase64) {
                    try { audioBuffer = Buffer.from(audioResult.audioBase64, 'base64'); } catch (e) {}
                  }
                  roomManager.broadcastAudioToLanguageChannel(roomId, lang, {
                    id: subPacketId,
                    seqId: currentIterationSeq,
                    coalescedSeqIds: Array.from(new Set(coalescedSeqIds)),
                    coalescedPacketIds: Array.from(new Set(coalescedPacketIds)),
                    lang,
                    text: healedText,
                    audioBase64: audioResult.audioBase64,
                    audioBuffer,
                    useClientWebSpeech: audioResult.useClientWebSpeech,
                    mimeType: audioResult.mimeType || 'audio/mpeg',
                    duration: audioResult.durationMs,
                    latencyMs: Date.now() - lastBurstArrival,
                    timestamp: Date.now(),
                    isHealed: true
                  });
                  console.log(`[AIPipeline] 🩹 [Room: ${roomId}] Cabina '${lang}' auto-sanada y difundida con éxito (<${Date.now() - lastBurstArrival}ms).`);
                }
              } catch (hErr) {
                console.error(`[AIPipeline] Auto-healing failed for ${lang}:`, hErr.message);
              }

              if (this.cabinPendingTexts.has(healingKey)) {
                const nextPending = this.cabinPendingTexts.get(healingKey);
                textToHeal = nextPending.text;
                currentIterationSeq = Math.max(currentIterationSeq, ...(nextPending.seqIds || [currentIterationSeq]));
                coalescedSeqIds = nextPending.seqIds || [];
                coalescedPacketIds = nextPending.packetIds || [];
                lastBurstArrival = nextPending.arrivedAt || Date.now();
                this.cabinPendingTexts.delete(healingKey);
              } else {
                textToHeal = null;
              }
            }
          })
          .finally(() => {
            this.cabinQueueDepths.delete(healingKey);
            if (this.cabinQueues.get(healingKey) === nextTask) {
              this.cabinQueues.delete(healingKey);
            }
          });
        this.cabinQueues.set(healingKey, nextTask);
      }
    }

    const totalPipelineLatency = Date.now() - pipelineStart;
    transcriptItem.metrics.totalMs = totalPipelineLatency;

    // Send pipeline telemetry event to host
    if (room.hostSocket && room.hostSocket.readyState === 1) {
      try {
        const isAdmin = Boolean(room.hostSocket.isAdminSession);
        room.hostSocket.send(JSON.stringify({
          type: 'PIPELINE_METRIC',
          metric: {
            packetId,
            seqId,
            text: spokenText,
            detectedSource: detectedLang,
            engineUsed: isAdmin ? (transResult.engineUsed || 'Google Neural') : undefined,
            sttEngine: isAdmin ? (sttEngineUsed || 'Deepgram Nova-3') : undefined,
            sttModel: isAdmin ? (sttModelUsed || 'nova-3') : undefined,
            sttMs: isAdmin ? sttLatency : undefined,
            transMs: isAdmin ? transLatency : undefined,
            ttsMs: isAdmin ? (Date.now() - ttsStart) : undefined,
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

