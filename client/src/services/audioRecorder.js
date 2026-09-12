import { deepgramStreamingService } from './deepgramStreamingService.js';

const MULTILINGUAL_MEDICAL_LEXICONS = {
  es: [
    'anamnesis', 'cefalea', 'disnea', 'hipertensión', 'cardiopatía',
    'isquemia', 'auscultación', 'edema', 'eritrocitos', 'leucocitos',
    'taquicardia', 'bradicardia', 'hemoglobina', 'glucemia', 'electrocardiograma'
  ],
  en: [
    'anamnesis', 'headache', 'dyspnea', 'hypertension', 'heart disease',
    'ischemia', 'auscultation', 'edema', 'erythrocytes', 'leukocytes',
    'tachycardia', 'bradycardia', 'hemoglobin', 'glycemia', 'electrocardiogram'
  ],
  it: [
    'anamnesi', 'cefalea', 'dispnea', 'ipertensione', 'cardiopatia',
    'ischemia', 'auscultazione', 'edema', 'eritrociti', 'leucociti',
    'tachicardia', 'bradicardia', 'emoglobina', 'glicemia', 'elettrocardiogramma'
  ],
  pt: [
    'anamnese', 'cefaleia', 'dispneia', 'hipertensão', 'cardiopatia',
    'isquemia', 'ausculta', 'edema', 'eritrócitos', 'leucócitos',
    'taquicardia', 'bradicardia', 'hemoglobina', 'glicemia', 'eletrocardiograma'
  ]
};

function getLocalizedMedicalKeyterms(lang) {
  const code = (lang || 'es').slice(0, 2).toLowerCase();
  return MULTILINGUAL_MEDICAL_LEXICONS[code] || MULTILINGUAL_MEDICAL_LEXICONS.es;
}

/**
 * LiftVoice Natural Dictation & Continuous Speech Recognition Engine (2026 Edition)
 * Provides seamless dictation (word-by-word real-time display) and natural pause finalization.
 * Zero dropped words, zero redundant duplications.
 * Accurately extracts newly spoken continuation words from a cumulative recognition transcript.
 * Eliminates prefix repetition even across punctuation additions, casing shifts, and pauses.
 */
function extractContinuationDelta(committedText, rawSessionText) {
  if (!committedText || !committedText.trim()) {
    return (rawSessionText || '').trim();
  }
  if (!rawSessionText || !rawSessionText.trim()) {
    return '';
  }

  const cleanRaw = rawSessionText.trim();
  const cleanComm = committedText.trim();

  // Normalize: lower case, strip punctuation symbols, collapse whitespace
  const normalize = (str) =>
    str
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¡¿]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normRaw = normalize(cleanRaw);
  const normComm = normalize(cleanComm);

  // Exact match -> 0 uncommitted delta
  if (normRaw === normComm) {
    return '';
  }

  const commWords = normComm.split(' ').filter(Boolean);
  const normRawWords = normRaw.split(' ').filter(Boolean);
  const originalRawWords = cleanRaw.split(/\s+/).filter(Boolean);

  // 1. Direct case-insensitive prefix match (100% character accurate)
  if (cleanRaw.toLowerCase().startsWith(cleanComm.toLowerCase())) {
    const candidate = cleanRaw.slice(cleanComm.length).trim();
    return candidate.replace(/^[.,;:!?\s]+/, '').trim();
  }

  // 2. Normalized startsWith match with character alignment
  if (normRaw.startsWith(normComm)) {
    let rIdx = 0;
    let cIdx = 0;
    while (rIdx < cleanRaw.length && cIdx < normComm.length) {
      const rChar = cleanRaw[rIdx].toLowerCase();
      const cChar = normComm[cIdx];
      if (rChar === cChar) {
        rIdx++;
        cIdx++;
      } else if (/[.,/#!$%^&*;:{}=\-_`~()?"'¡¿\s]/.test(cleanRaw[rIdx])) {
        rIdx++;
      } else if (cChar === ' ') {
        cIdx++;
      } else {
        rIdx++;
      }
    }
    const delta = cleanRaw.slice(rIdx).replace(/^[.,;:!?\s]+/, '').trim();
    if (delta) return delta;
  }

  // 3. Direct word prefix match
  if (normRawWords.length > commWords.length) {
    let matchPrefix = true;
    for (let i = 0; i < commWords.length; i++) {
      if (normRawWords[i] !== commWords[i]) {
        matchPrefix = false;
        break;
      }
    }
    if (matchPrefix) {
      const firstDeltaWord = normRawWords[commWords.length];
      const normIdx = normRaw.indexOf(firstDeltaWord, Math.max(0, normComm.length - 10));
      if (normIdx >= 0) {
        const afterNorm = cleanRaw.slice(Math.max(0, cleanComm.length - 10));
        const matchDelta = afterNorm.toLowerCase().indexOf(firstDeltaWord);
        if (matchDelta >= 0) {
          return afterNorm.slice(matchDelta).replace(/^[.,;:!?\s]+/, '').trim();
        }
      }
      return originalRawWords.slice(commWords.length).join(' ').trim();
    }
  }

  // 4. Substring containment match: if normRaw contains normComm anywhere
  if (normRaw.includes(normComm)) {
    const idx = normRaw.indexOf(normComm);
    const after = cleanRaw.slice(idx + cleanComm.length).trim();
    const cleanDelta = after.replace(/^[.,;:!?\s]+/, '').trim();
    if (cleanDelta) return cleanDelta;
  }

  // 5. Fuzzy anchor suffix match (match the last 2-3 words of committed text)
  if (commWords.length >= 2) {
    const anchorLen = Math.min(3, commWords.length);
    const anchorWords = commWords.slice(-anchorLen);
    const anchorPhrase = anchorWords.join(' ');
    const normRawLower = normRaw.toLowerCase();
    const anchorIdx = normRawLower.lastIndexOf(anchorPhrase);
    
    if (anchorIdx >= 0) {
      const searchWindow = cleanRaw.slice(Math.max(0, cleanComm.length - 30));
      const windowIdx = searchWindow.toLowerCase().lastIndexOf(anchorWords[anchorWords.length - 1]);
      if (windowIdx >= 0) {
        const afterAnchor = searchWindow.slice(windowIdx + anchorWords[anchorWords.length - 1].length);
        const cleanDelta = afterAnchor.replace(/^[.,;:!?\s]+/, '').trim();
        if (cleanDelta) return cleanDelta;
      }
    }
  }

  // If neither prefix, substring nor anchor matched, it is a new distinct sentence
  return cleanRaw;
}

const DANGLING_CONNECTORS = new Set([
  // Spanish conjunctions, prepositions & hesitations
  'y', 'e', 'o', 'u', 'ni', 'pero', 'sino', 'aunque', 'porque', 'pues',
  'de', 'del', 'a', 'al', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'hacia', 'desde', 'hasta', 'entre',
  'que', 'si', 'como', 'cuando', 'donde', 'quien', 'cual',
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
  'eh', 'em', 'um', 'uh',
  
  // English connectors
  'and', 'or', 'but', 'nor', 'so', 'yet', 'because', 'although', 'if', 'that', 'which',
  'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about', 'as', 'into', 'like',
  'the', 'a', 'an', 'this', 'that', 'these', 'those',

  // Italian connectors
  'e', 'ed', 'o', 'ma', 'però', 'perché', 'se', 'che', 'cui',
  'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'questo', 'questa',

  // Portuguese connectors
  'e', 'ou', 'mas', 'porém', 'porque', 'se', 'que',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'por', 'pelo', 'pela', 'para', 'com',
  'o', 'a', 'os', 'as', 'um', 'uma', 'este', 'esta'
]);

const COMPOUND_CONNECTORS = [
  'en realidad', 'la verdad', 'es decir', 'o sea', 'por ejemplo', 'sin embargo', 'no obstante', 'por lo tanto',
  'as well as', 'in fact', 'that is', 'such as', 'even if',
  'in realtà', 'vale a dire',
  'na verdade', 'ou seja', 'por exemplo'
];

function normalizeSpeech(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¡¿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDanglingClause(text) {
  if (!text) return false;
  const clean = normalizeSpeech(text);
  if (!clean) return false;

  const words = clean.split(' ').filter(Boolean);
  if (words.length === 0) return false;

  for (const compound of COMPOUND_CONNECTORS) {
    if (clean === compound || clean.endsWith(' ' + compound)) {
      return true;
    }
  }

  const lastWord = words[words.length - 1];
  if (DANGLING_CONNECTORS.has(lastWord)) {
    return true;
  }

  // If utterance has fewer than 3 words, verify if it is an accepted complete standalone phrase
  if (words.length < 3) {
    const COMPLETE_STANDALONE = new Set([
      'sí', 'si', 'no', 'gracias', 'muchas gracias', 'hola', 'adiós', 'chao',
      'correcto', 'exacto', 'claro', 'bien', 'muy bien', 'entendido', 'de acuerdo',
      'perfecto', 'excelente', 'buenos días', 'buenas tardes', 'buenas noches',
      'yes', 'thanks', 'thank you', 'hello', 'hi', 'bye', 'goodbye', 'ok', 'okay', 'sure', 'agreed',
      'sì', 'grazie', 'ciao', 'esatto', 'daccordo',
      'sim', 'não', 'obrigado', 'obrigada', 'olá', 'certo', 'concordo'
    ]);
    if (!COMPLETE_STANDALONE.has(clean)) {
      return true;
    }
  }

  return false;
}

class AudioRecorderService {
  constructor() {
    this.mediaStream = null;
    this.audioCtx = null;
    this.analyserNode = null;
    this.recognition = null;
    this.isRecording = false;
    this.audioLevel = 0; // 0 to 100
    this.onLevelCallbacks = new Set();
    this.onInterimCallbacks = new Set();
    this.animationFrame = null;
    this.selectedDeviceId = 'default';
    this.sourceLanguage = 'es-ES';
    this.silenceThresholdMs = 950;

    // Natural Dictation Accumulators & Real-Time Delta Engine
    this.accumulatedDictation = '';
    this.currentInterim = '';
    this.committedSessionTranscript = '';
    this.currentPendingText = '';
    this.currentRawSessionText = '';
    this.committedResultIndex = 0;
    this.latestResultCount = 0;
    this.silenceTimer = null;
    this.lastCommittedText = '';
    this.lastCommittedTime = 0;
    this.onSpeechTextCallback = null;
    this.onSpeechAudioCallback = null;
    this.sttEngine = 'deepgram';
    this.mediaRecorder = null;
    this.mediaRecorderMimeType = 'audio/webm';
    this.audioChunks = [];
    this.restartTimeout = null;
    this.restartCount = 0;
    this.lastRestartTime = 0;
    this.lastSpeechActivityTime = Date.now();
    this.isCommitting = false;
    this.acousticResetTimer = null;

    this.sourceNode = null;
    this.onDeviceAutoSwitched = null;
    this.vadInterval = null;

    // Deepgram Ultra-Low Latency Streaming Service Integration
    this.deepgramStreamingService = deepgramStreamingService;
    this.onStreamingStatusCallbacks = new Set();
    deepgramStreamingService.onStatus((status) => {
      for (const cb of this.onStreamingStatusCallbacks) {
        try { cb(status); } catch (e) {}
      }
    });
  }

  onStreamingStatus(cb) {
    this.onStreamingStatusCallbacks.add(cb);
    return () => this.onStreamingStatusCallbacks.delete(cb);
  }

  getStreamingStatus() {
    return this.deepgramStreamingService.status;
  }

  setDecalageMode(modeOrVal) {
    if (typeof modeOrVal === 'number') {
      // 650ms (quick) to 1400ms (natural keynote)
      this.silenceThresholdMs = Math.round(650 + (modeOrVal / 100) * 750);
    } else if (modeOrVal === 'fast' || modeOrVal === 'quick') {
      this.silenceThresholdMs = 700;
    } else if (modeOrVal === 'paused') {
      this.silenceThresholdMs = 1400;
    } else if (modeOrVal === 'natural') {
      this.silenceThresholdMs = 950;
    }
  }

  setVadSensitivity(level) {
    this.vadSensitivity = level || 'standard';
    if (level === 'high') {
      this.silenceThresholdMs = 600;
      this.vadThreshold = 0.012;
    } else if (level === 'aggressive') {
      this.silenceThresholdMs = 1300;
      this.vadThreshold = 0.035;
    } else {
      this.silenceThresholdMs = 950;
      this.vadThreshold = 0.02;
    }
  }

  async getAudioInputDevices() {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const rawDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = rawDevices.filter(d => d.kind === 'audioinput');

      // Filtrar alias virtuales del SO ('default', 'communications') y deduplicar por etiqueta
      const sanitized = [];
      const seenLabels = new Set();
      const seenDeviceIds = new Set(['default', 'communications']);

      for (const d of audioInputs) {
        if (!d.deviceId || seenDeviceIds.has(d.deviceId)) continue;

        let cleanLabel = (d.label || '').trim();
        // Limpiar prefijos de Windows como "Predeterminado - ", "Default - ", "Comunicaciones - "
        cleanLabel = cleanLabel.replace(/^(Predeterminado|Default|Comunicaciones)\s*-\s*/i, '').trim();

        if (cleanLabel && seenLabels.has(cleanLabel)) {
          continue;
        }

        if (cleanLabel) seenLabels.add(cleanLabel);
        seenDeviceIds.add(d.deviceId);

        sanitized.push({
          deviceId: d.deviceId,
          groupId: d.groupId,
          label: cleanLabel || `Micrófono ${sanitized.length + 1}`
        });
      }

      return sanitized;
    } catch (e) {
      console.warn('[AudioRecorder] Could not enumerate devices:', e);
      return [];
    }
  }

  setDevice(deviceId) {
    this.selectedDeviceId = deviceId || 'default';
  }

  /**
   * Conmuta el hardware de captura de audio en caliente sin interrumpir
   * la sesión de grabación ni reiniciar el WebSocket a Deepgram.
   */
  async switchDevice(newDeviceId) {
    this.selectedDeviceId = newDeviceId || 'default';
    if (!this.isRecording) {
      return;
    }

    console.log(`[AudioRecorder] 🔄 Iniciando conmutación en caliente de micrófono hacia: ${this.selectedDeviceId}`);
    const oldStream = this.mediaStream;

    const constraints = {
      audio: {
        deviceId: this.selectedDeviceId !== 'default' ? { exact: this.selectedDeviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100
      }
    };

    let newStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('[AudioRecorder] Conmutación con restricción exacta falló, reintentando con audio predeterminado:', err);
      newStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    }

    // 1. Conmutar en el AudioContext del analizador (VU meter)
    if (this.audioCtx && this.analyserNode) {
      try {
        const newSource = this.audioCtx.createMediaStreamSource(newStream);
        newSource.connect(this.analyserNode);
        if (this.sourceNode) {
          try { this.sourceNode.disconnect(); } catch (e) {}
        }
        this.sourceNode = newSource;
      } catch (nodeErr) {
        console.warn('[AudioRecorder] Error al enlazar nuevo MediaStreamAudioSourceNode al analizador:', nodeErr);
      }
    }

    // 2. Conmutar en Deepgram Streaming Service si está activo (Web Audio Node Swap sin reconexión de WebSocket)
    if (this.deepgramStreamingService && this.deepgramStreamingService.active) {
      try {
        await this.deepgramStreamingService.switchStream(newStream);
      } catch (e) {
        console.error('[AudioRecorder] Error en switchStream de Deepgram:', e);
      }
    }

    // 3. Reiniciar MediaRecorder para chunks si está activo (Firefox / Server Chunk fallback)
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
      this.initMediaRecorderForChunks(newStream);
    }

    // 4. Detener pistas del stream anterior para apagar físicamente el hardware
    if (oldStream) {
      oldStream.getTracks().forEach(track => {
        try {
          track.onended = null;
          track.stop();
        } catch (e) {}
      });
    }

    this.mediaStream = newStream;
    this.attachTrackEndedListener(newStream);
    console.log('[AudioRecorder] ✅ Conmutación de micrófono completada con éxito.');
  }

  /**
   * Monitor de desconexión física de hardware (ej: USB o Bluetooth desconectado en plena charla)
   */
  attachTrackEndedListener(stream) {
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;

    track.onended = async () => {
      if (!this.isRecording) return;
      console.warn('[AudioRecorder] ⚠️ El micrófono activo se ha desconectado físicamente. Auto-conmutando a default.');
      try {
        await this.switchDevice('default');
        if (this.onDeviceAutoSwitched) {
          this.onDeviceAutoSwitched('default');
        }
      } catch (e) {
        console.error('[AudioRecorder] Fallo al auto-recuperar micrófono por defecto tras desconexión física:', e);
      }
    };
  }

  /**
   * Red de Seguridad para navegadores sin Web Speech API (Firefox / Safari sin dictado nativo)
   * o cuando los servicios de streaming primarios se degradan.
   */
  startServerChunkPipeline() {
    this.sttEngine = 'server_chunk';
    console.log('[AudioRecorder] 🛡️ Activando Red de Seguridad de Transcripción por Chunks en Servidor (Server-Side ASR).');
    this.initMediaRecorderForChunks(this.mediaStream);
    this.setupVadChunkTrigger();
  }

  initMediaRecorderForChunks(stream) {
    if (typeof MediaRecorder === 'undefined' || !stream) return;

    let mimeType = 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      mimeType = 'audio/webm';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4'; // Safari macOS / iOS
    } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      mimeType = 'audio/ogg;codecs=opus'; // Firefox
    }

    this.mediaRecorderMimeType = mimeType;
    this.audioChunks = [];

    try {
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.start(250);
    } catch (e) {
      console.error('[AudioRecorder] Error al inicializar MediaRecorder de chunks:', e);
    }
  }

  setupVadChunkTrigger() {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    let speechActive = false;
    let silenceStart = 0;
    let chunkSpeechStart = 0;
    const SILENCE_COMMIT_MS = this.silenceThresholdMs || 950;
    const MAX_CHUNK_DURATION_MS = 6500; // Corte máximo para mantener latencia acotada

    this.vadInterval = setInterval(() => {
      if (!this.isRecording || this.sttEngine !== 'server_chunk') {
        if (this.vadInterval) clearInterval(this.vadInterval);
        this.vadInterval = null;
        return;
      }

      const isVoiced = this.audioLevel > 18; // Umbral RMS del analizador Web Audio
      const now = Date.now();

      if (isVoiced) {
        if (!speechActive) {
          speechActive = true;
          chunkSpeechStart = now;
          this.notifyInterim('🎙️ Escuchando ponencia...');
        }
        silenceStart = 0;

        if (now - chunkSpeechStart > MAX_CHUNK_DURATION_MS) {
          this.flushAndEmitChunk();
          chunkSpeechStart = now;
        }
      } else if (speechActive) {
        if (!silenceStart) {
          silenceStart = now;
        } else if (now - silenceStart >= SILENCE_COMMIT_MS) {
          speechActive = false;
          silenceStart = 0;
          this.flushAndEmitChunk();
        }
      }
    }, 100);
  }

  flushAndEmitChunk() {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') return;
    const recorder = this.mediaRecorder;

    recorder.onstop = () => {
      const chunks = [...this.audioChunks];
      this.audioChunks = [];

      if (this.isRecording && this.mediaRecorder) {
        try { this.mediaRecorder.start(250); } catch (e) {}
      }

      const blob = new Blob(chunks, { type: this.mediaRecorderMimeType });
      if (blob.size > 800) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result || '').split(',')[1];
          if (base64 && this.onSpeechAudioCallback) {
            this.notifyInterim('⚡ Procesando voz con IA...');
            this.onSpeechAudioCallback(base64, this.mediaRecorderMimeType, this.sourceLanguage);
          }
        };
        reader.readAsDataURL(blob);
      }
    };

    try {
      recorder.stop();
    } catch (e) {}
  }

  setLanguage(lang) {
    const targetLang = lang || 'es-ES';
    if (this.sourceLanguage === targetLang) return;
    this.sourceLanguage = targetLang;

    if (this.sttEngine === 'deepgram' && this.isRecording && this.deepgramStreamingService.active) {
      const targetLower = (targetLang || '').toLowerCase();
      const langCode = (targetLang && targetLang !== 'auto')
        ? (targetLower.startsWith('pt') && targetLower.includes('br') ? 'pt-BR' : (targetLang.length > 2 ? targetLang.slice(0, 2) : targetLang))
        : 'multi';
      const opts = this.recordingOptions || {};
      
      let keyterms = [];
      if (opts.medicalMode) {
        keyterms.push(...getLocalizedMedicalKeyterms(langCode));
      }
      if (Array.isArray(opts.customGlossary)) {
        keyterms.push(...opts.customGlossary);
      }
      this.currentKeyterms = keyterms;

      this.deepgramStreamingService.reconnect({
        language: langCode,
        medicalMode: opts.medicalMode,
        medicalSpecialty: opts.medicalSpecialty,
        customGlossary: opts.customGlossary,
        keyterms: this.currentKeyterms || []
      }, {
        onTranscript: ({ transcript, isFinal, detectedLanguage }) => {
          if (this.recognition) {
            try {
              this.recognition.onend = null;
              this.recognition.onerror = null;
              this.recognition.onresult = null;
              this.recognition.abort();
            } catch (e) {}
            this.recognition = null;
          }
          if (!this.isRecording && !isFinal) return;
          const clean = (transcript || '').trim();
          if (!clean) return;

          if (isFinal) {
            console.log(`[AudioRecorder] ⚡ Deepgram Stream is_final: "${clean}" (detected: ${detectedLanguage || langCode})`);
            this.currentPendingText = '';
            this.notifyInterim('');
            if (this.onSpeechTextCallback) {
              this.onSpeechTextCallback(clean, detectedLanguage || langCode);
            }
          } else {
            this.currentPendingText = clean;
            this.notifyInterim(clean);
          }
        },
        onError: (err) => {
          console.warn('[AudioRecorder] Deepgram reconnect error, falling back to WebSpeech:', err);
          this.deepgramStreamingService.stop().catch(() => {});
          this.sttEngine = 'webspeech';
          if (this.isRecording && !this.recognition) {
            this.initSpeechRecognition();
          }
        },
        onClose: ({ code, wasClean }) => {
          console.log('[AudioRecorder] Deepgram reconnect stream closed:', code, wasClean);
        }
      }).catch(e => {
        console.warn('[AudioRecorder] Error reconnecting Deepgram on language change:', e);
      });
      return;
    }

    if (this.recognition && this.isRecording) {
      // Cleanly stop existing instance before re-initializing with new language
      try {
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.abort();
      } catch (e) {}
      this.recognition = null;

      setTimeout(() => {
        if (this.isRecording) {
          this.initSpeechRecognition();
        }
      }, 300);
    }
  }

  /**
   * Start microphone capture and continuous natural dictation
   */
  async startRecording(options = {}) {
    if (this.isRecording) {
      return true;
    }

    this.stopRecording();

    const onSpeech = options.onSpeechText || options.onSentenceFinalized;
    const onAudio = options.onSpeechAudio;
    const onInterim = options.onInterimSpeech || options.onInterimText;
    const lang = options.language || options.lang || 'es-ES';
    if (options.deviceId) this.selectedDeviceId = options.deviceId;

    this.sttEngine = options.sttEngine || localStorage.getItem('lv_stt_engine') || 'deepgram';
    this.onSpeechTextCallback = onSpeech;
    this.onSpeechAudioCallback = onAudio;
    if (onInterim) this.onInterim(onInterim);
    this.sourceLanguage = lang || 'es-ES';
    this.accumulatedDictation = '';
    this.currentInterim = '';
    this.committedSessionTranscript = '';
    this.currentPendingText = '';
    this.currentRawSessionText = '';
    this.committedResultIndex = 0;
    this.latestResultCount = 0;
    this.lastCommittedText = '';
    this.lastCommittedTime = 0;
    this.recordingOptions = options;

    try {
      const constraints = {
        audio: {
          deviceId: this.selectedDeviceId && this.selectedDeviceId !== 'default' ? { exact: this.selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      };

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (deviceErr) {
        if (
          (deviceErr.name === 'OverconstrainedError' || deviceErr.name === 'NotFoundError') &&
          this.selectedDeviceId &&
          this.selectedDeviceId !== 'default'
        ) {
          console.warn(`[AudioRecorder] Dispositivo "${this.selectedDeviceId}" no disponible (${deviceErr.name}). Reintentando con default:`, deviceErr);
          this.selectedDeviceId = 'default';
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } else {
          throw deviceErr;
        }
      }

      // Web Audio Analyser for VU meter
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === 'suspended') {
        try { await this.audioCtx.resume(); } catch (e) {}
      }
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.sourceNode = source;
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.5;
      source.connect(this.analyserNode);

      this.attachTrackEndedListener(this.mediaStream);

      this.isRecording = true;
      this.startLevelMeter();

      if (this.sttEngine === 'deepgram') {
        // High-fidelity direct WebSocket streaming via Nova-2/Nova-3 and AudioWorklet
        const srcLower = (this.sourceLanguage || '').toLowerCase();
        const langCode = (this.sourceLanguage && this.sourceLanguage !== 'auto')
          ? (srcLower.startsWith('pt') && srcLower.includes('br') ? 'pt-BR' : (this.sourceLanguage.length > 2 ? this.sourceLanguage.slice(0, 2) : this.sourceLanguage))
          : 'multi';

        let keyterms = [];
        if (options.medicalMode) {
          keyterms.push(...getLocalizedMedicalKeyterms(langCode));
        }
        if (Array.isArray(options.customGlossary)) {
          keyterms.push(...options.customGlossary);
        }
        this.currentKeyterms = keyterms;

        try {
          await this.deepgramStreamingService.start(
            this.mediaStream,
            {
              language: langCode,
              medicalMode: options.medicalMode,
              medicalSpecialty: options.medicalSpecialty,
              customGlossary: options.customGlossary,
              keyterms
            },
            {
              onTranscript: ({ transcript, isFinal, detectedLanguage }) => {
                if (this.recognition) {
                  try {
                    this.recognition.onend = null;
                    this.recognition.onerror = null;
                    this.recognition.onresult = null;
                    this.recognition.abort();
                  } catch (e) {}
                  this.recognition = null;
                }

                // Allow final transcript during CloseStream drain even after stopRecording()
                if (!this.isRecording && !isFinal) return;
                const clean = (transcript || '').trim();
                if (!clean) return;

                if (isFinal) {
                  console.log(`[AudioRecorder] ⚡ Deepgram Stream is_final: "${clean}" (detected: ${detectedLanguage || langCode})`);
                  this.currentPendingText = '';
                  this.notifyInterim('');
                  if (this.onSpeechTextCallback) {
                    this.onSpeechTextCallback(clean, detectedLanguage || langCode);
                  }
                } else {
                  this.currentPendingText = clean;
                  this.notifyInterim(clean);
                }
              },
              onError: (err) => {
                console.warn('[AudioRecorder] Deepgram streaming error, falling back to WebSpeech:', err);
                this.deepgramStreamingService.stop().catch(() => {});
                this.sttEngine = 'webspeech';
                if (this.isRecording && !this.recognition) {
                  this.initSpeechRecognition();
                }
              },
              onClose: ({ code, wasClean }) => {
                console.log('[AudioRecorder] Deepgram streaming closed:', code, wasClean);
              }
            }
          );
        } catch (dgErr) {
          console.warn('[AudioRecorder] Failed to start Deepgram streaming, falling back to WebSpeech:', dgErr);
          this.deepgramStreamingService.stop().catch(() => {});
          this.sttEngine = 'webspeech';
          this.initSpeechRecognition();
        }
      } else {
        // Fallback for Whisper / WebSpeech
        if (typeof MediaRecorder !== 'undefined' && this.sttEngine === 'whisper') {
          let mimeType = 'audio/webm;codecs=opus';
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          }
          this.mediaRecorderMimeType = mimeType;
          this.audioChunks = [];
          try {
            this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
            this.mediaRecorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                this.audioChunks.push(event.data);
              }
            };
            this.mediaRecorder.start(250);
          } catch (mErr) {
            console.warn('[AudioRecorder] MediaRecorder init notice:', mErr);
          }
        }

        // Start WebSpeech for webspeech or whisper interim preview
        setTimeout(() => {
          if (this.isRecording) {
            this.initSpeechRecognition();
          }
        }, 100);
      }

      return true;
    } catch (err) {
      console.error('[AudioRecorder] Failed to start microphone:', err);
      this.stopRecording();
      throw err;
    }
  }

  initSpeechRecognition(retryCount = 0) {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn('[AudioRecorder] Web Speech Recognition API no soportada en este navegador (Firefox/Safari). Activando Red de Seguridad de Transcripción por Chunks en Servidor.');
      this.startServerChunkPipeline();
      return;
    }

    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        this.recognition.abort();
      } catch (e) {}
      this.recognition = null;
    }

    const rec = new SpeechRecognitionClass();
    this.recognition = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = (this.sourceLanguage && this.sourceLanguage !== 'auto') ? this.sourceLanguage : 'es-ES';

    rec.onresult = (event) => {
      if (this.recognition !== rec || !this.isRecording) return;
      this.lastSpeechActivityTime = Date.now();

      // Collect transcript ONLY for uncommitted results in the current recognition session
      let rawSessionText = '';
      const startIdx = Math.min(this.committedResultIndex || 0, event.results.length);
      for (let i = startIdx; i < event.results.length; ++i) {
        const item = event.results[i];
        const transcript = (item[0]?.transcript || '').trim();
        if (transcript) {
          rawSessionText += (rawSessionText ? ' ' : '') + transcript;
        }
      }

      this.currentRawSessionText = rawSessionText;
      this.latestResultCount = event.results.length;

      // Extract ONLY the uncommitted delta using robust multi-pass continuation extraction
      const uncommitted = extractContinuationDelta(this.committedSessionTranscript, rawSessionText);

      // If buffer restarted completely, clear committed tracker
      if (this.committedSessionTranscript && uncommitted === rawSessionText.trim() && rawSessionText.trim().length > 0) {
        const normComm = (this.committedSessionTranscript || '').toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¡¿]/g, ' ').trim();
        const normRaw = rawSessionText.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¡¿]/g, ' ').trim();
        if (!normRaw.includes(normComm) && !normComm.includes(normRaw)) {
          this.committedSessionTranscript = '';
        }
      }

      this.currentPendingText = uncommitted;

      // Real-time dictation text on screen (shows only the uncommitted active words)
      this.notifyInterim(uncommitted);

      // Smart clause pause detection:
      // If the pending speech ends in a dangling connector word ("y", "este", "en realidad", etc.)
      // or is an incomplete short clause (< 3 words without being an affirmative response),
      // we extend the silence window to ~1600ms - 2000ms so the speaker can finish their thought!
      this.clearSilenceTimer();
      if (uncommitted) {
        const isDangling = isDanglingClause(uncommitted);
        const timeoutMs = isDangling
          ? Math.max(1600, Math.round((this.silenceThresholdMs || 950) * 1.85))
          : (this.silenceThresholdMs || 950);

        this.silenceTimer = setTimeout(() => {
          this.commitDictation();
        }, timeoutMs);
      }
    };

    rec.onerror = (err) => {
      if (this.recognition !== rec) return;
      console.warn('[AudioRecorder] Speech recognition notice:', err.error);
      if (this.isRecording && err.error !== 'not-allowed' && err.error !== 'aborted') {
        const backoff = err.error === 'no-speech' ? 600 : 400;
        this.scheduleRestart(backoff);
      }
    };

    rec.onend = () => {
      if (this.recognition !== rec) return;
      this.committedSessionTranscript = '';
      this.currentPendingText = '';
      this.currentRawSessionText = '';
      this.committedResultIndex = 0;
      this.latestResultCount = 0;
      if (this.isRecording) {
        this.scheduleRestart(300);
      }
    };

    try {
      rec.start();
    } catch (e) {
      console.warn(`[AudioRecorder] Could not start speech recognition (attempt ${retryCount}):`, e);
      if (this.isRecording && retryCount < 3) {
        setTimeout(() => {
          if (this.isRecording) {
            this.initSpeechRecognition(retryCount + 1);
          }
        }, 350 * (retryCount + 1));
      }
    }
  }

  commitDictation() {
    this.clearSilenceTimer();
    if (this.isCommitting) {
      return;
    }

    const text = (this.currentPendingText || '').trim();
    if (!text) return;

    this.isCommitting = true;
    const releaseLock = () => {
      this.isCommitting = false;
    };
    // Auto-release lock after 2500ms safety watchdog
    const commitTimeout = setTimeout(releaseLock, 2500);

    const now = Date.now();
    const normText = normalizeSpeech(text);
    const normLast = normalizeSpeech(this.lastCommittedText);

    // Suppress immediate duplicate emissions within 8 seconds with normalized comparison
    if (normLast && normText === normLast && (now - this.lastCommittedTime < 8000)) {
      console.log(`[AudioRecorder] 🛡️ Suppressed duplicate emission: "${text}"`);
      this.currentPendingText = '';
      this.notifyInterim('');
      clearTimeout(commitTimeout);
      releaseLock();
      return;
    }

    // Advance committed index so past results can never be re-read
    this.committedResultIndex = this.latestResultCount || 0;
    this.committedSessionTranscript = '';
    this.currentPendingText = '';
    this.currentRawSessionText = '';
    this.lastCommittedText = text;
    this.lastCommittedTime = now;
    this.notifyInterim('');

    console.log(`[AudioRecorder] 🎙️ Dictation committed (${text.split(/\s+/).length} words): "${text}" (Engine: ${this.sttEngine})`);

    // If STT engine is Deepgram or Whisper, capture audio slice and emit strictly via onSpeechAudioCallback
    if (this.sttEngine !== 'webspeech' && this.onSpeechAudioCallback && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      const recorder = this.mediaRecorder;
      recorder.onstop = () => {
        clearTimeout(commitTimeout);
        const chunks = [...this.audioChunks];
        this.audioChunks = [];
        if (this.isRecording && this.mediaRecorder) {
          try {
            this.mediaRecorder.start(250);
          } catch (e) {}
        }
        const blob = new Blob(chunks, { type: this.mediaRecorderMimeType });
        if (blob.size > 500) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result || '').split(',')[1];
            if (base64 && this.onSpeechAudioCallback) {
              this.onSpeechAudioCallback(base64, this.mediaRecorderMimeType, this.sourceLanguage);
            }
            releaseLock();
          };
          reader.readAsDataURL(blob);
        } else if (text && this.onSpeechTextCallback) {
          this.onSpeechTextCallback(text);
          releaseLock();
        } else {
          releaseLock();
        }
      };
      try {
        recorder.stop();
      } catch (e) {
        if (text && this.onSpeechTextCallback) {
          this.onSpeechTextCallback(text);
        }
        clearTimeout(commitTimeout);
        releaseLock();
      }
    } else if (this.onSpeechTextCallback) {
      this.onSpeechTextCallback(text);
      clearTimeout(commitTimeout);
      releaseLock();
    } else {
      clearTimeout(commitTimeout);
      releaseLock();
    }

    // Reset acoustic window during silence pause to clear browser buffers and prevent cumulative memory leaks
    this.resetAcousticWindow();
  }

  resetAcousticWindow() {
    if (!this.isRecording) return;
    if (this.acousticResetTimer) {
      clearTimeout(this.acousticResetTimer);
      this.acousticResetTimer = null;
    }
    this.acousticResetTimer = setTimeout(() => {
      this.acousticResetTimer = null;
      if (!this.isRecording || this.currentPendingText) return;
      try {
        if (this.recognition) {
          this.recognition.onend = null;
          this.recognition.onerror = null;
          this.recognition.onresult = null;
          this.recognition.abort();
        }
      } catch (e) {}
      this.recognition = null;
      this.committedResultIndex = 0;
      this.latestResultCount = 0;
      this.initSpeechRecognition();
    }, 120);
  }

  clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  scheduleRestart(delayMs = 350) {
    if (!this.isRecording || this.restartTimeout) return;

    const now = Date.now();
    if (!this.lastRestartTime || now - this.lastRestartTime > 3000) {
      this.restartCount = 0;
      this.lastRestartTime = now;
    }
    this.restartCount = (this.restartCount || 0) + 1;
    const safeDelay = this.restartCount > 3 ? Math.max(delayMs, 1000) : Math.max(delayMs, 350);

    this.restartTimeout = setTimeout(() => {
      this.restartTimeout = null;
      if (!this.isRecording) return;
      try {
        if (this.recognition) {
          try {
            this.recognition.onend = null;
            this.recognition.onerror = null;
            this.recognition.abort();
          } catch (e) {}
          this.recognition = null;
        }
        this.initSpeechRecognition();
      } catch (err) {
        console.warn('[AudioRecorder] Restart exception:', err);
      }
    }, safeDelay);
  }

  stopRecording() {
    this.isRecording = false;
    this.clearSilenceTimer();

    if (this.acousticResetTimer) {
      clearTimeout(this.acousticResetTimer);
      this.acousticResetTimer = null;
    }

    if (this.deepgramStreamingService && this.deepgramStreamingService.active) {
      this.deepgramStreamingService.stop().catch(() => {});
    }

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    // Flush any pending dictation on stop ONLY if it contains new words not yet committed
    const pending = (this.currentPendingText || '').trim();
    if (pending) {
      const normPending = normalizeSpeech(pending);
      const normLast = normalizeSpeech(this.lastCommittedText);

      if (normPending && normPending !== normLast) {
        this.lastCommittedText = pending;
        this.lastCommittedTime = Date.now();
        if (this.onSpeechTextCallback) {
          this.onSpeechTextCallback(pending);
        }
      }
    }

    this.accumulatedDictation = '';
    this.currentInterim = '';
    this.committedSessionTranscript = '';
    this.currentPendingText = '';
    this.currentRawSessionText = '';
    this.notifyInterim('');
    this.onInterimCallbacks.clear();

    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        this.recognition.abort();
      } catch (e) {}
      this.recognition = null;
    }

    if (this.mediaRecorder) {
      try {
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.ondataavailable = null;
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (e) {}
      this.mediaRecorder = null;
    }
    this.audioChunks = [];

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) {}
        });
      } catch (e) {}
      this.mediaStream = null;
    }

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
      this.sourceNode = null;
    }

    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch (e) {}
      this.audioCtx = null;
    }
    this.analyserNode = null;

    this.audioLevel = 0;
    this.notifyLevel(0);
  }

  startLevelMeter() {
    if (!this.analyserNode) return;
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    let lastNotifyTime = 0;
    let lastLevel = 0;

    const update = () => {
      if (!this.isRecording || !this.analyserNode) return;

      this.analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const newLevel = Math.min(100, Math.round((avg / 120) * 100));

      const now = performance.now();
      if (newLevel > 35) {
        if (!this.loudVoiceStartTime) this.loudVoiceStartTime = Date.now();
      } else if (newLevel < 20) {
        this.loudVoiceStartTime = null;
      }

      // Throttle React notification to at most ~16 fps (every 60ms) and require significant delta
      if (now - lastNotifyTime >= 60 && Math.abs(newLevel - lastLevel) >= 3) {
        lastNotifyTime = now;
        lastLevel = newLevel;
        this.audioLevel = newLevel;
        this.notifyLevel(newLevel);
      } else if (newLevel === 0 && lastLevel !== 0 && now - lastNotifyTime >= 60) {
        lastNotifyTime = now;
        lastLevel = 0;
        this.audioLevel = 0;
        this.notifyLevel(0);
      }

      this.animationFrame = requestAnimationFrame(update);
    };

    this.animationFrame = requestAnimationFrame(update);
  }

  getFrequencyData() {
    if (!this.analyserNode || !this.isRecording) return new Uint8Array(32);
    try {
      const array = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.analyserNode.getByteFrequencyData(array);
      return array;
    } catch (e) {
      return new Uint8Array(32);
    }
  }

  onAudioLevel(cb) {
    this.onLevelCallbacks.add(cb);
    return () => this.onLevelCallbacks.delete(cb);
  }

  notifyLevel(level) {
    for (const cb of this.onLevelCallbacks) {
      try { cb(level); } catch (e) {}
    }
  }

  onInterim(cb) {
    this.onInterimCallbacks.add(cb);
    return () => this.onInterimCallbacks.delete(cb);
  }

  notifyInterim(text) {
    for (const cb of this.onInterimCallbacks) {
      try { cb(text); } catch (e) {}
    }
  }
}

export const audioRecorderService = new AudioRecorderService();
