/**
 * LiftVoice Natural Dictation & Continuous Speech Recognition Engine (2026 Edition)
 * Provides seamless dictation (word-by-word real-time display) and natural pause finalization.
 * Zero dropped words, zero redundant duplications.
/**
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
  }

  setDecalageMode(modeOrVal) {
    if (typeof modeOrVal === 'number') {
      // 650ms (quick) to 1400ms (natural keynote)
      this.silenceThresholdMs = Math.round(650 + (modeOrVal / 100) * 750);
    } else if (modeOrVal === 'fast') {
      this.silenceThresholdMs = 700;
    } else if (modeOrVal === 'natural') {
      this.silenceThresholdMs = 950;
    }
  }

  async getAudioInputDevices() {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audioinput');
    } catch (e) {
      console.warn('[AudioRecorder] Could not enumerate devices:', e);
      return [];
    }
  }

  setDevice(deviceId) {
    this.selectedDeviceId = deviceId;
  }

  setLanguage(lang) {
    const targetLang = lang || 'es-ES';
    if (this.sourceLanguage === targetLang) return;
    this.sourceLanguage = targetLang;

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

    this.sttEngine = options.sttEngine || 'deepgram';
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

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Web Audio Analyser for VU meter
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === 'suspended') {
        try { await this.audioCtx.resume(); } catch (e) {}
      }
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.5;
      source.connect(this.analyserNode);

      // Initialize MediaRecorder for streaming Deepgram / Whisper STT
      if (typeof MediaRecorder !== 'undefined') {
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

      this.isRecording = true;
      this.startLevelMeter();

      // Start recognition after hardware settling pause
      setTimeout(() => {
        if (this.isRecording) {
          this.initSpeechRecognition();
        }
      }, 100);

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
      console.warn('[AudioRecorder] Web Speech Recognition API not supported in this browser.');
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
    } else if (this.sttEngine === 'webspeech' && this.onSpeechTextCallback) {
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
    setTimeout(() => {
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
