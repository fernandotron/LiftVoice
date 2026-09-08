/**
 * LiftVoice Low-Latency Web Audio API Player & Background Audio Keeper (2026 Edition)
 * Sequential FIFO Decode & Playout Queue with Jitter Buffer and Screen-Lock Support
 */

let cachedSilentUrl = null;
function getSilentAudioUrl() {
  if (cachedSilentUrl) return cachedSilentUrl;
  if (typeof window === 'undefined' || typeof Blob === 'undefined') return '';
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate; // exactly 1.0 second duration
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false); // 'RIFF'
    view.setUint32(4, 36 + numSamples, true);
    view.setUint32(8, 0x57415645, false); // 'WAVE'

    view.setUint32(12, 0x666d7420, false); // 'fmt '
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true); // BlockAlign
    view.setUint16(34, 8, true); // 8-bit

    view.setUint32(36, 0x64617461, false); // 'data'
    view.setUint32(40, numSamples, true);

    const bytes = new Uint8Array(buffer, 44);
    bytes.fill(128); // 8-bit PCM silence

    const blob = new Blob([buffer], { type: 'audio/wav' });
    cachedSilentUrl = URL.createObjectURL(blob);
    return cachedSilentUrl;
  } catch (e) {
    return '';
  }
}

class AudioPlayerService {
  constructor() {
    this.audioCtx = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.bgAudioElement = null; // Background HTML5 Audio keeper
    this.htmlAudioTag = null; // Dedicated HTML5 Audio element for screen-lock mobile playback
    this.mobileAudioQueue = [];
    this.isMobilePlaying = false;
    this.wakeLock = null;
    this.isUnlocked = false;
    this.isMuted = false;
    this.volume = 1.0;
    this.playbackRate = 1.0;
    this.nextStartTime = 0;
    this.activeSources = new Set();
    this.currentLanguage = 'es';
    this.currentRoomId = 'MAIN';
    this.isPlaying = false;
    this.onStateChangeCallbacks = new Set();

    // Playout Queue & Jitter Buffer
    this.decodeQueue = Promise.resolve();
    this.playoutLeadTime = 0.05; // 50ms smooth lead-time

    this.activeUtterances = new Set();

    this.speechLangs = {
      en: 'en-US',
      es: 'es-ES',
      it: 'it-IT',
      pt: 'pt-BR',
      fr: 'fr-FR',
      de: 'de-DE',
      zh: 'zh-CN',
      ja: 'ja-JP',
      ar: 'ar-SA',
      ru: 'ru-RU',
      ko: 'ko-KR',
      hi: 'hi-IN'
    };

    // Auto-resume audio context when tab visibility changes or device wakes up
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended' && this.isUnlocked && !this.isMuted) {
          this.audioCtx.resume().catch(() => {});
        }
        if (document.visibilityState === 'visible') {
          this.requestWakeLock();
        }
      });

      // iOS Safari / Android touch recovery: unlock and resume audio on first physical touch
      const handleUserGestureResume = () => {
        if (!this.isUnlocked) {
          this.unlockAudio(this.currentRoomId, this.currentLanguage).catch(() => {});
        } else if (this.audioCtx && this.audioCtx.state === 'suspended' && !this.isMuted) {
          this.audioCtx.resume().catch(() => {});
        }
      };
      window.addEventListener('touchstart', handleUserGestureResume, { passive: true });
      window.addEventListener('touchend', handleUserGestureResume, { passive: true });
      window.addEventListener('click', handleUserGestureResume, { passive: true });
    }
  }

  async resumeAudio() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
      this.notifyState();
    }
  }

  async resumeSuspendedContext() {
    return this.resumeAudio();
  }

  isContextSuspended() {
    return Boolean(this.audioCtx && this.audioCtx.state === 'suspended');
  }

  /**
   * Initialize background audio keeper and unlock Web Audio Context
   */
  async unlockAudio(roomId = 'MAIN', lang = 'es') {
    this.currentRoomId = roomId;
    this.currentLanguage = lang;

    // 1. Initialize Web Audio Context
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);

      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.analyserNode.smoothingTimeConstant = 0.8;

      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // 2. Initialize Dedicated HTML5 Audio Tag for Mobile Screen-Lock Playback
    if (!this.htmlAudioTag && typeof document !== 'undefined') {
      this.htmlAudioTag = document.createElement('audio');
      this.htmlAudioTag.setAttribute('playsinline', 'true');
      this.htmlAudioTag.setAttribute('webkit-playsinline', 'true');
      this.htmlAudioTag.style.display = 'none';
      document.body.appendChild(this.htmlAudioTag);

      const silentUrl = getSilentAudioUrl();
      if (silentUrl) {
        this.htmlAudioTag.src = silentUrl;
        this.htmlAudioTag.play().catch(() => {});
      }
    }

    // 3. Start HTML5 Background Audio Keeper for Screen-Lock Playback
    this.initBackgroundAudioKeeper();

    // 4. Register Native Lock Screen Controls via MediaSession API
    this.setupMediaSession();

    // 5. Request Screen WakeLock (optional, when in foreground)
    this.requestWakeLock();

    this.isUnlocked = true;
    this.notifyState();
    return true;
  }

  initBackgroundAudioKeeper() {
    // Keep an inaudible background audio loop running to preserve OS audio session on mobile
    if (typeof navigator === 'undefined' || !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      return;
    }

    if (!this.bgAudioElement && typeof document !== 'undefined') {
      const silentUrl = getSilentAudioUrl();
      if (!silentUrl) return;

      this.bgAudioElement = document.createElement('audio');
      this.bgAudioElement.src = silentUrl;
      this.bgAudioElement.loop = true;
      this.bgAudioElement.volume = 0.02; // Inaudible carrier
      this.bgAudioElement.setAttribute('playsinline', 'true');
      this.bgAudioElement.setAttribute('webkit-playsinline', 'true');
      this.bgAudioElement.style.display = 'none';
      document.body.appendChild(this.bgAudioElement);
    }

    if (this.bgAudioElement && this.bgAudioElement.paused) {
      this.bgAudioElement.play().catch(() => {});
    }
  }

  setupMediaSession() {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      const langNames = { en: 'English', es: 'Español', it: 'Italiano', pt: 'Português' };
      const currentName = langNames[this.currentLanguage] || this.currentLanguage.toUpperCase();

      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Traducción en Vivo (${currentName})`,
        artist: 'LiftVoice AI • Conferencia en Directo',
        album: `Sala ${this.currentRoomId}`
      });

      navigator.mediaSession.playbackState = 'playing';

      navigator.mediaSession.setActionHandler('play', () => {
        this.setMuted(false);
        if (this.htmlAudioTag && this.htmlAudioTag.paused) this.htmlAudioTag.play().catch(() => {});
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        this.setMuted(true);
        if (this.htmlAudioTag && !this.htmlAudioTag.paused) this.htmlAudioTag.pause();
      });
    }
  }

  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator && this.isUnlocked && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      }
    } catch (e) {
      // Wake lock not supported or failed (normal on low power mode)
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(2.0, val));
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime);
    }
    if (this.htmlAudioTag) {
      this.htmlAudioTag.volume = this.isMuted ? 0 : Math.min(1.0, this.volume);
    }
    this.notifyState();
  }

  setMasterVolume(val) {
    this.setVolume(val);
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime);
    }
    if (this.htmlAudioTag) {
      this.htmlAudioTag.volume = this.isMuted ? 0 : Math.min(1.0, this.volume);
    }
    this.notifyState();
  }

  setPlaybackRate(rate) {
    this.playbackRate = Math.max(0.8, Math.min(1.5, rate));
    if (this.htmlAudioTag) {
      this.htmlAudioTag.playbackRate = this.playbackRate;
    }
    for (const item of this.activeSources) {
      try {
        const src = item.sourceNode || item;
        if (src && src.playbackRate) {
          src.playbackRate.setValueAtTime(this.playbackRate, this.audioCtx.currentTime);
        }
      } catch (e) {}
    }
    this.notifyState();
  }

  setLanguage(lang) {
    if (this.currentLanguage !== lang) {
      this.currentLanguage = lang;
      this.stopAll();
      this.setupMediaSession();
      this.notifyState();
    }
  }

  isMobileDevice() {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
  }

  isBackgrounded() {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  }

  stopAll() {
    if (this.htmlAudioTag) {
      try {
        this.htmlAudioTag.pause();
        this.htmlAudioTag.currentTime = 0;
      } catch (e) {}
    }
    while (this.mobileAudioQueue && this.mobileAudioQueue.length > 0) {
      const it = this.mobileAudioQueue.shift();
      if (it && it.url) {
        try { URL.revokeObjectURL(it.url); } catch (e) {}
      }
    }
    this.isMobilePlaying = false;

    for (const item of this.activeSources) {
      try {
        const src = item.sourceNode || item;
        const gain = item.chunkGain;
        if (typeof src.stop === 'function') src.stop();
        if (typeof src.disconnect === 'function') src.disconnect();
        if (gain && typeof gain.disconnect === 'function') gain.disconnect();
      } catch (e) {}
    }
    this.activeSources.clear();
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    // Note: Do NOT pause this.bgAudioElement here.
    // The background audio keeper keeps mobile screen-lock playback active when switching languages.
    this.decodeQueue = Promise.resolve();
    this.isPlaying = false;
    this.notifyState();
  }

  /**
   * Queue and play incoming audio packet in strict sequential order
   */
  playAudioChunk(packet) {
    if (this.isMuted) return;

    if (packet.lang && !packet.isBoothAudio && !packet.isHostPreview && packet.lang !== this.currentLanguage) {
      if (packet.isListenerDirect) {
        this.currentLanguage = packet.lang;
      } else {
        return;
      }
    }

    // On mobile devices (iOS / Android) or when tab is backgrounded / screen is locked:
    // Route through dedicated HTML5 Audio element queue for resilient background playback!
    if (packet.audioBase64 && (this.isMobileDevice() || this.isBackgrounded())) {
      this.playMobileChunk(packet);
      return;
    }

    // Sequence through FIFO decode queue on desktop Web Audio API
    this.decodeQueue = this.decodeQueue
      .catch((err) => console.warn('[AudioPlayer] Previous decode error:', err))
      .then(async () => {
        if (packet.audioBase64) {
          try {
            await this.processAndScheduleBase64Chunk(packet);
          } catch (err) {
            console.warn('[AudioPlayer] Decode failed, falling back to Web Speech:', err);
            await this.playSpeechSynthesisAsync(packet.text, packet.lang);
          }
        } else if (packet.text) {
          await this.playSpeechSynthesisAsync(packet.text, packet.lang);
        }
      });
  }

  playMobileChunk(packet) {
    if (this.isMuted) return;
    try {
      const binaryStr = window.atob(packet.audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: packet.mimeType || 'audio/mp3' });
      const blobUrl = URL.createObjectURL(blob);

      this.mobileAudioQueue.push({
        url: blobUrl,
        text: packet.text,
        lang: packet.lang
      });

      if (!this.isMobilePlaying) {
        this.processNextMobileChunk();
      }
    } catch (err) {
      console.warn('[AudioPlayer] Mobile chunk queue error:', err);
    }
  }

  processNextMobileChunk() {
    if (this.mobileAudioQueue.length === 0) {
      this.isMobilePlaying = false;
      this.isPlaying = false;
      this.notifyState();
      return;
    }

    const currentItem = this.mobileAudioQueue.shift();
    if (!this.htmlAudioTag && typeof document !== 'undefined') {
      this.htmlAudioTag = document.createElement('audio');
      this.htmlAudioTag.setAttribute('playsinline', 'true');
      this.htmlAudioTag.setAttribute('webkit-playsinline', 'true');
      this.htmlAudioTag.style.display = 'none';
      document.body.appendChild(this.htmlAudioTag);
    }

    this.isMobilePlaying = true;
    this.isPlaying = true;
    this.notifyState();

    if (this.htmlAudioTag) {
      this.htmlAudioTag.src = currentItem.url;
      this.htmlAudioTag.volume = this.isMuted ? 0 : Math.min(1.0, this.volume);
      this.htmlAudioTag.playbackRate = this.playbackRate;

      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }

      const handleDone = () => {
        if (this.htmlAudioTag) {
          this.htmlAudioTag.onended = null;
          this.htmlAudioTag.onerror = null;
        }
        try {
          URL.revokeObjectURL(currentItem.url);
        } catch (e) {}
        this.processNextMobileChunk();
      };

      this.htmlAudioTag.onended = handleDone;
      this.htmlAudioTag.onerror = (e) => {
        console.warn('[AudioPlayer] Mobile HTML audio error:', e);
        handleDone();
      };

      const playPromise = this.htmlAudioTag.play();
      if (playPromise) {
        playPromise.catch((err) => {
          console.warn('[AudioPlayer] Mobile tag play rejected:', err);
          handleDone();
        });
      }
    }
  }

  async processAndScheduleBase64Chunk(packet) {
    if (!this.audioCtx) {
      await this.unlockAudio(this.currentRoomId, this.currentLanguage);
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const binaryStr = window.atob(packet.audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Decode audio data safely
    const audioBuffer = await this.audioCtx.decodeAudioData(bytes.buffer.slice(0));
    
    const sourceNode = this.audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.playbackRate.setValueAtTime(this.playbackRate, this.audioCtx.currentTime);

    // Micro cross-fade gain node to eliminate clicks at chunk boundaries
    const chunkGain = this.audioCtx.createGain();
    sourceNode.connect(chunkGain);
    chunkGain.connect(this.gainNode);

    const now = this.audioCtx.currentTime;
    // If starting a fresh speech stream, give 150ms lead time; if chaining, attach at nextStartTime
    const isChaining = this.activeSources.size > 0 && this.nextStartTime > now;
    const startTime = isChaining ? this.nextStartTime : Math.max(now + 0.15, this.nextStartTime);
    const duration = audioBuffer.duration / this.playbackRate;

    // Apply smooth 15ms fade-in and fade-out with collision prevention
    const fade = Math.min(0.015, duration / 4);
    if (fade > 0.002 && duration > fade * 2) {
      chunkGain.gain.setValueAtTime(0.001, startTime);
      chunkGain.gain.exponentialRampToValueAtTime(1.0, startTime + fade);
      const sustainEnd = Math.max(startTime + fade + 0.002, startTime + duration - fade);
      if (sustainEnd < startTime + duration) {
        chunkGain.gain.setValueAtTime(1.0, sustainEnd);
        chunkGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      }
    }

    sourceNode.start(startTime);
    this.nextStartTime = startTime + duration;
    const activeItem = { sourceNode, chunkGain };
    this.activeSources.add(activeItem);
    this.isPlaying = true;
    this.notifyState();

    sourceNode.onended = () => {
      this.activeSources.delete(activeItem);
      try {
        sourceNode.disconnect();
        chunkGain.disconnect();
      } catch (e) {}
      if (this.activeSources.size === 0 && this.audioCtx.currentTime >= this.nextStartTime) {
        this.isPlaying = false;
        this.notifyState();
      }
    };
  }

  /**
   * Instantly auditions a voice card like a music playlist.
   * Immediately stops any currently playing audio track and plays the new voice.
   */
  async playVoicePreview({ voiceId, voiceName, lang = 'es', text = '', audioBase64 = null, mimeType = 'audio/mp3', gender = 'female' }) {
    // 1. Immediately cut off any ongoing playback (playlist behavior)
    this.stopAll();

    const profile = VOICE_PROFILES[voiceId] || {
      pitch: gender === 'male' ? 0.80 : 1.08,
      rate: 1.0,
      detune: gender === 'male' ? -300 : 80,
      gender: gender || 'female'
    };

    // If server returned audio and it's from a configured cloud provider, or playable base64:
    if (audioBase64) {
      try {
        await this.playDetunedAudioBase64(audioBase64, profile.detune);
        return;
      } catch (err) {
        console.warn('[AudioPlayer] Preview base64 decode failed, falling back to Web Speech:', err);
      }
    }

    // High quality distinct Web Speech preview with narrator persona
    await this.playWebSpeechWithPersona(text, lang, profile);
  }

  async playDetunedAudioBase64(audioBase64, detuneCents = 0) {
    if (!this.audioCtx) {
      await this.unlockAudio(this.currentRoomId, this.currentLanguage);
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const binaryStr = window.atob(audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const audioBuffer = await this.audioCtx.decodeAudioData(bytes.buffer.slice(0));
    const sourceNode = this.audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    
    // Apply narrator detuning (pitch modulation)
    if (sourceNode.detune && detuneCents !== 0) {
      sourceNode.detune.setValueAtTime(detuneCents, this.audioCtx.currentTime);
    }
    sourceNode.playbackRate.setValueAtTime(this.playbackRate, this.audioCtx.currentTime);

    const chunkGain = this.audioCtx.createGain();
    sourceNode.connect(chunkGain);
    chunkGain.connect(this.gainNode);

    const now = this.audioCtx.currentTime;
    const duration = audioBuffer.duration / this.playbackRate;

    chunkGain.gain.setValueAtTime(0.001, now);
    chunkGain.gain.exponentialRampToValueAtTime(1.0, now + 0.02);
    chunkGain.gain.setValueAtTime(1.0, Math.max(now + 0.02, now + duration - 0.03));
    chunkGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    sourceNode.start(now);
    this.activeSources.add(sourceNode);
    this.isPlaying = true;
    this.notifyState();

    return new Promise((resolve) => {
      sourceNode.onended = () => {
        this.activeSources.delete(sourceNode);
        try {
          sourceNode.disconnect();
          chunkGain.disconnect();
        } catch (e) {}
        if (this.activeSources.size === 0) {
          this.isPlaying = false;
          this.notifyState();
        }
        resolve();
      };
    });
  }

  playWebSpeechWithPersona(text, lang = 'es', profile = {}) {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
        return resolve();
      }

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.speechLangs[lang] || lang;
        utterance.pitch = profile.pitch || 1.0;
        utterance.rate = (profile.rate || 1.0) * this.playbackRate;
        utterance.volume = this.isMuted ? 0 : Math.min(1.0, this.volume);

        const voices = window.speechSynthesis.getVoices();
        const langLower = (lang || 'es').toLowerCase();
        const matchingVoices = voices.filter(v => {
          const vl = v.lang.toLowerCase().replace('_', '-');
          return vl.startsWith(langLower) || vl.includes(langLower);
        });

        if (matchingVoices.length > 0) {
          let chosenVoice = null;
          // 1. Try preferred name
          if (profile.preferredName) {
            chosenVoice = matchingVoices.find(v => v.name.toLowerCase().includes(profile.preferredName.toLowerCase()));
          }
          // 2. Try gender matching
          if (!chosenVoice && profile.gender) {
            const isMale = profile.gender === 'male';
            chosenVoice = matchingVoices.find(v => {
              const name = v.name.toLowerCase();
              return isMale
                ? (name.includes('male') || name.includes('hombre') || name.includes('david') || name.includes('pablo') || name.includes('guy') || name.includes('mark') || name.includes('cosimo') || name.includes('antonio'))
                : (name.includes('female') || name.includes('mujer') || name.includes('elvira') || name.includes('helena') || name.includes('zira') || name.includes('jenny') || name.includes('elsa') || name.includes('francisca'));
            });
          }
          utterance.voice = chosenVoice || matchingVoices[0];
        }

        if (!this.activeUtterances) this.activeUtterances = new Set();
        this.activeUtterances.add(utterance);

        let resolved = false;
        const done = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          if (this.activeUtterances) this.activeUtterances.delete(utterance);
          this.isPlaying = false;
          this.notifyState();
          resolve();
        };

        // Watchdog timeout in case browser drops onend/onerror callbacks
        const timeoutId = setTimeout(done, Math.max(3000, text.length * 120));

        utterance.onstart = () => {
          this.isPlaying = true;
          this.notifyState();
        };

        utterance.onend = done;
        utterance.onerror = done;

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error('[AudioPlayer] Speech error:', e);
        resolve();
      }
    });
  }

  playSpeechSynthesisAsync(text, lang = 'en') {
    return this.playWebSpeechWithPersona(text, lang, { pitch: 1.0, rate: 1.0 });
  }

  getFrequencyData() {
    if (!this.analyserNode) return new Uint8Array(32);
    const array = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(array);
    return array;
  }

  onStateChange(cb) {
    this.onStateChangeCallbacks.add(cb);
    return () => this.onStateChangeCallbacks.delete(cb);
  }

  notifyState() {
    const state = {
      isUnlocked: this.isUnlocked,
      isMuted: this.isMuted,
      volume: this.volume,
      playbackRate: this.playbackRate,
      isPlaying: this.isPlaying,
      currentLanguage: this.currentLanguage
    };
    for (const cb of this.onStateChangeCallbacks) {
      try { cb(state); } catch (e) {}
    }
  }
}

export const VOICE_PROFILES = {
  // Deepgram Aura (English)
  'aura-orion-en': { pitch: 0.78, rate: 0.95, detune: -340, gender: 'male', preferredName: 'David' },
  'aura-asteria-en': { pitch: 1.05, rate: 1.02, detune: 60, gender: 'female', preferredName: 'Zira' },
  'aura-luna-en': { pitch: 1.18, rate: 0.94, detune: 180, gender: 'female', preferredName: 'Jenny' },
  'aura-stella-en': { pitch: 1.08, rate: 1.08, detune: 100, gender: 'female', preferredName: 'Aria' },
  'aura-athena-en': { pitch: 0.92, rate: 0.92, detune: -120, gender: 'female', preferredName: 'Sonia' },
  'aura-arcas-en': { pitch: 0.88, rate: 1.04, detune: -200, gender: 'male', preferredName: 'Guy' },
  'aura-angus-en': { pitch: 0.72, rate: 0.88, detune: -420, gender: 'male', preferredName: 'Mark' },
  'aura-perseus-en': { pitch: 0.98, rate: 1.10, detune: -40, gender: 'male', preferredName: 'George' },

  // Google Neural Universal
  'es-ES-ElviraNeural': { pitch: 1.05, rate: 1.00, detune: 60, gender: 'female', preferredName: 'Helena' },
  'es-ES-AlvaroNeural': { pitch: 0.80, rate: 0.98, detune: -300, gender: 'male', preferredName: 'Pablo' },
  'en-US-JennyNeural': { pitch: 1.05, rate: 1.02, detune: 50, gender: 'female', preferredName: 'Jenny' },
  'en-US-GuyNeural': { pitch: 0.82, rate: 0.98, detune: -300, gender: 'male', preferredName: 'Guy' },
  'it-IT-ElsaNeural': { pitch: 1.06, rate: 1.00, detune: 70, gender: 'female', preferredName: 'Elsa' },
  'it-IT-CosimoNeural': { pitch: 0.84, rate: 0.96, detune: -280, gender: 'male', preferredName: 'Cosimo' },
  'pt-BR-FranciscaNeural': { pitch: 1.08, rate: 1.02, detune: 80, gender: 'female', preferredName: 'Francisca' },
  'pt-BR-AntonioNeural': { pitch: 0.85, rate: 0.98, detune: -260, gender: 'male', preferredName: 'Antonio' },

  // OpenAI TTS
  'nova': { pitch: 1.12, rate: 1.04, detune: 140, gender: 'female', preferredName: 'Nova' },
  'alloy': { pitch: 1.00, rate: 1.00, detune: 0, gender: 'neutral', preferredName: 'Alloy' },
  'echo': { pitch: 0.84, rate: 0.96, detune: -280, gender: 'male', preferredName: 'Echo' },
  'onyx': { pitch: 0.70, rate: 0.92, detune: -450, gender: 'male', preferredName: 'Onyx' },
  'shimmer': { pitch: 1.16, rate: 1.05, detune: 200, gender: 'female', preferredName: 'Shimmer' },

  // ElevenLabs
  '21m00Tcm4TlvDq8ikWAM': { pitch: 1.02, rate: 0.98, detune: 30, gender: 'female', preferredName: 'Rachel' },
  'pNInz6obpgDQGcFmaJgB': { pitch: 0.80, rate: 0.96, detune: -320, gender: 'male', preferredName: 'Adam' },
  'AZnzlk1XvdvUeBnXmlld': { pitch: 1.14, rate: 1.08, detune: 160, gender: 'female', preferredName: 'Domi' },
  'ErXwobaYiN019PkySvjV': { pitch: 0.86, rate: 0.94, detune: -240, gender: 'male', preferredName: 'Antoni' }
};

export const audioPlayerService = new AudioPlayerService();

