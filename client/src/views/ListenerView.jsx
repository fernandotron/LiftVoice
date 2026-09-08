import React, { useState, useEffect, useRef } from 'react';
import { Headphones, Volume2, VolumeX, Radio, Sparkles, Activity, ShieldCheck, Zap, Sliders, Globe, AudioLines, ArrowRight, CheckCircle2, Edit3, Lock, RefreshCw, Home, Heart, Mail, Play, AlertCircle, Download, Check, X, User, Hand, Mic, MicOff, Send, MessageSquare } from 'lucide-react';
import LanguageSelector, { SUPPORTED_LANGUAGES } from '../components/LanguageSelector.jsx';
import LiveCaptions from '../components/LiveCaptions.jsx';
import AudioVisualizer from '../components/AudioVisualizer.jsx';
import { socketService } from '../services/socket.js';
import { audioPlayerService } from '../services/audioPlayer.js';

export default function ListenerView({
  roomId = 'MAIN',
  onLeave = () => {}
}) {
  // Persistent profile stored in localStorage across sessions
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('lv_attendee_profile');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        return {
          attendeeId: p.attendeeId || `att_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`,
          name: p.name || '',
          email: p.email || '',
          phone: p.phone || ''
        };
      } catch (e) {}
    }
    return {
      attendeeId: `att_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`,
      name: '',
      email: '',
      phone: ''
    };
  });

  const [hasSavedProfile, setHasSavedProfile] = useState(() => {
    const saved = localStorage.getItem('lv_attendee_profile');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        return Boolean(p.name && p.name.trim().length >= 2);
      } catch (e) {}
    }
    return false;
  });

  // Prompt new attendees on arrival; remember returning attendees without asking again
  const [showCheckInModal, setShowCheckInModal] = useState(() => {
    const saved = localStorage.getItem('lv_attendee_profile');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        return !(p.name && p.name.trim().length >= 2);
      } catch (e) {}
    }
    return true;
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSavedFeedback, setProfileSavedFeedback] = useState(false);
  const [hasExitedSession, setHasExitedSession] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [minutesListened, setMinutesListened] = useState(1);

  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlLang = params.get('lang');
        const validLangs = ['es', 'en', 'it', 'pt'];
        if (urlLang && validLangs.includes(urlLang.toLowerCase())) {
          return urlLang.toLowerCase();
        }
      }
    } catch (e) {}
    return 'es';
  });
  const selectedLangRef = useRef(selectedLanguage);

  useEffect(() => {
    selectedLangRef.current = selectedLanguage;
    audioPlayerService.setLanguage(selectedLanguage);
  }, [selectedLanguage]);

  const [isAudioUnlocked, setIsAudioUnlocked] = useState(() => audioPlayerService.isUnlocked);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isAudioSuspended, setIsAudioSuspended] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [roomStats, setRoomStats] = useState({
    totalListeners: 0,
    languageBreakdown: { en: 0, es: 0, it: 0, pt: 0 }
  });
  const [socketLatency, setSocketLatency] = useState(14);
  const SHOW_QA_SECTION = false; // Ocultado temporalmente por solicitud del usuario

  // Bi-directional Q&A Backchannel State (2026-2029)
  const [qaState, setQaState] = useState('idle'); // 'idle' | 'requested' | 'speaking' | 'completed'
  const [questionText, setQuestionText] = useState('');
  const [isRecordingQuestion, setIsRecordingQuestion] = useState(false);
  const recognitionRef = useRef(null);

  // Connect socket immediately upon mounting - NO FORCED REGISTRATION WALL
  useEffect(() => {
    if (hasExitedSession) return;

    socketService.connect().then(() => {
      const activeProfile = {
        attendeeId: profile.attendeeId,
        name: profile.name.trim() || 'Oyente Anónimo',
        email: profile.email.trim() || '',
        phone: profile.phone.trim() || ''
      };
      socketService.joinAsListener(roomId, selectedLangRef.current, activeProfile);
    });

    const unsubAudio = socketService.on('audio_chunk', (packet) => {
      const pktLang = (packet?.lang || '').toLowerCase().trim();
      const myLang = (selectedLangRef.current || '').toLowerCase().trim();
      if (!pktLang || pktLang === myLang) {
        audioPlayerService.playAudioChunk({ ...packet, isListenerDirect: true });
      }
    });

    const unsubTranscript = socketService.on('transcript_event', (item) => {
      if (!item) return;
      setTranscriptHistory(prev => {
        if (prev.some(p => p.id === item.id)) return prev;
        const last = prev[prev.length - 1];
        if (last && last.originalText === item.originalText && Math.abs((item.timestamp || 0) - (last.timestamp || 0)) < 4000) {
          return prev;
        }
        return [...prev, item];
      });
    });

    const unsubStats = socketService.on('room_stats', (stats) => {
      if (stats) setRoomStats(stats);
    });

    const unsubLatency = socketService.on('latency', (lat) => {
      setSocketLatency(lat);
    });

    const unsubPlayer = audioPlayerService.onStateChange((state) => {
      setIsAudioUnlocked(state.isUnlocked);
      setIsPlayingAudio(state.isPlaying);
      setIsMuted(state.isMuted);
      setVolume(state.volume);
      setPlaybackRate(state.playbackRate);
      setIsAudioSuspended(audioPlayerService.isContextSuspended());
    });

    // Q&A Backchannel socket handlers
    const unsubQaConfirmed = socketService.on('qa_hand_raise_confirmed', () => {
      setQaState('requested');
    });

    const unsubQaSpeaker = socketService.on('qa_active_speaker', (msg) => {
      const speaker = msg.speaker || msg;
      if (speaker && (speaker.attendeeId === profile.attendeeId || speaker.name === profile.name)) {
        setQaState('speaking');
      }
    });

    const unsubQaClosed = socketService.on('qa_question_closed', () => {
      setQaState('idle');
      setIsRecordingQuestion(false);
    });

    return () => {
      unsubAudio();
      unsubTranscript();
      unsubStats();
      unsubLatency();
      unsubPlayer();
      unsubQaConfirmed();
      unsubQaSpeaker();
      unsubQaClosed();
      audioPlayerService.stopAll();
    };
  }, [roomId, hasExitedSession, profile.attendeeId, profile.name]);

  // Periodic check for audio suspension on iOS
  useEffect(() => {
    const interval = setInterval(() => {
      if (isAudioUnlocked) {
        setIsAudioSuspended(audioPlayerService.isContextSuspended());
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isAudioUnlocked]);

  const handleUnlockAudio = async () => {
    try {
      await audioPlayerService.unlockAudio(roomId, selectedLanguage);
      setIsAudioUnlocked(true);
      setIsAudioSuspended(false);
    } catch (e) {
      console.warn('Audio unlock warning:', e);
    }
  };

  const handleResumeSuspendedAudio = async () => {
    try {
      await audioPlayerService.resumeSuspendedContext();
      setIsAudioSuspended(false);
    } catch (e) {
      console.warn('Resume error:', e);
    }
  };

  const handleSelectLanguage = async (langCode) => {
    const cleanLang = (langCode || 'en').toLowerCase();
    const isDifferent = selectedLanguage !== cleanLang;
    if (isDifferent) {
      setSelectedLanguage(cleanLang);
      selectedLangRef.current = cleanLang;
      audioPlayerService.setLanguage(cleanLang);
      socketService.switchLanguage(roomId, cleanLang);
    }

    // Direct user tap: immediately unlock and resume Web Audio in OS
    try {
      await audioPlayerService.unlockAudio(roomId, cleanLang);
      setIsAudioUnlocked(true);
      setIsAudioSuspended(false);
    } catch (e) {
      console.warn('[ListenerView] Unlock audio on language change notice:', e);
    }
  };

  const handleTestAudio = async () => {
    try {
      if (!isAudioUnlocked) {
        await handleUnlockAudio();
      }
      audioPlayerService.playAudioTestTone();
    } catch (e) {
      console.warn('[ListenerView] Test audio notice:', e);
    }
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioPlayerService.setMuted(nextMute);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    audioPlayerService.setVolume(val);
    if (isMuted && val > 0) {
      setIsMuted(false);
      audioPlayerService.setMuted(false);
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackRate(speed);
    audioPlayerService.setPlaybackRate(speed);
  };

  const handleCheckInSubmit = (e) => {
    e.preventDefault();
    if (!profile.name.trim()) return;

    const updated = {
      ...profile,
      name: profile.name.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim()
    };

    setProfile(updated);
    setHasSavedProfile(true);
    setShowCheckInModal(false);
    setIsEditingProfile(false);

    try {
      localStorage.setItem('lv_attendee_profile', JSON.stringify(updated));
    } catch (err) {}

    socketService.registerAttendeeLead(roomId, updated);

    setProfileSavedFeedback(true);
    setTimeout(() => setProfileSavedFeedback(false), 3000);

    if (!isAudioUnlocked) {
      handleUnlockAudio();
    }
  };

  const handleSkipCheckIn = () => {
    setShowCheckInModal(false);
    if (!isAudioUnlocked) {
      handleUnlockAudio();
    }
  };

  const handleExitClick = () => {
    const minutes = Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000));
    setMinutesListened(minutes);
    audioPlayerService.stopAll();
    setHasExitedSession(true);
  };

  const handleRaiseHand = () => {
    setQaState('requested');
    socketService.raiseHand(roomId, {
      attendeeId: profile.attendeeId,
      name: profile.name.trim() || 'Oyente',
      email: profile.email || '',
      phone: profile.phone || '',
      nativeLang: selectedLanguage
    });
  };

  const handleCancelRaiseHand = () => {
    setQaState('idle');
  };

  const handleStartRecordingQuestion = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz por API. Por favor escribe tu pregunta en el cuadro de texto.');
      return;
    }
    try {
      const rec = new SpeechRecognition();
      const localeMap = {
        es: 'es-ES', en: 'en-US', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-BR',
        zh: 'zh-CN', ja: 'ja-JP', ar: 'ar-SA', ru: 'ru-RU', ko: 'ko-KR', hi: 'hi-IN'
      };
      rec.lang = localeMap[selectedLanguage] || 'es-ES';
      rec.continuous = false;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let transcript = '';
        for (let i = 0; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript;
        }
        setQuestionText(transcript);
      };
      rec.onerror = () => {
        setIsRecordingQuestion(false);
      };
      rec.onend = () => {
        setIsRecordingQuestion(false);
      };
      rec.start();
      recognitionRef.current = rec;
      setIsRecordingQuestion(true);
    } catch (e) {
      console.warn('Speech recognition error:', e);
      setIsRecordingQuestion(false);
    }
  };

  const handleStopRecordingQuestion = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsRecordingQuestion(false);
  };

  const handleSendQuestion = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!questionText.trim()) return;

    handleStopRecordingQuestion();

    socketService.sendQuestionAudio(
      roomId,
      null,
      'audio/webm',
      selectedLanguage,
      profile.name.trim() || 'Oyente',
      questionText.trim()
    );

    setQaState('completed');
    setQuestionText('');
    setTimeout(() => {
      setQaState('idle');
    }, 4500);
  };

  const handleDownloadTranscript = () => {
    if (transcriptHistory.length === 0) return;
    const lines = transcriptHistory.map((item) => {
      const time = new Date(item.timestamp || Date.now()).toLocaleTimeString();
      const text = item.translations?.[selectedLanguage] || item.originalText;
      return `[${time}] ${text}\n(Original: "${item.originalText}")\n`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LiftVoice-Transcripcion-${roomId}-${selectedLanguage}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];

  // 1. Thank You / Exit Screen (ElevenLabs Minimalist Goodbye Card)
  if (hasExitedSession) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center py-10 px-4 bg-white">
        <div className="w-full max-w-md space-y-6 text-center">
          
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mx-auto shadow-md">
            <Heart className="w-7 h-7 text-emerald-400 fill-emerald-400/20" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-mono text-zinc-700">
              <span>SALA:</span>
              <b className="text-zinc-900">{roomId}</b>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
              ¡Gracias por asistir a la sesión!
            </h1>

            <p className="text-xs sm:text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed">
              Traducción simultánea en vivo con audio neuronal de alta fidelidad.
            </p>
          </div>

          {/* Session Summary Card */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 text-left space-y-3 shadow-2xs">
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              Resumen de tu Sesión
            </div>

            <div className="divide-y divide-zinc-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-zinc-500">Oyente:</span>
                <span className="font-semibold text-zinc-900">{profile.name || 'Invitado en Sala'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-zinc-500">Canal de voz:</span>
                <span className="font-medium text-zinc-900 flex items-center gap-1.5">
                  <span>{currentLangObj.flag}</span>
                  <span>{currentLangObj.nativeName} ({currentLangObj.code.toUpperCase()})</span>
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-zinc-500">Tiempo de escucha:</span>
                <span className="font-mono text-emerald-600 font-semibold">{minutesListened} minuto{minutesListened === 1 ? '' : 's'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-zinc-500">Frases recibidas:</span>
                <span className="font-mono text-zinc-900">{transcriptHistory.length} subtítulos</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            {transcriptHistory.length > 0 && (
              <button
                onClick={handleDownloadTranscript}
                className="w-full h-11 rounded-xl bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Transcripción Completa (.txt)</span>
              </button>
            )}

            <button
              onClick={() => setHasExitedSession(false)}
              className="w-full h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Volver a Escuchar en Directo</span>
            </button>

            <button
              onClick={onLeave}
              className="w-full h-10 rounded-xl bg-transparent hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Volver al Inicio</span>
            </button>
          </div>

          <p className="text-[11px] text-zinc-400 font-mono">
            LiftVoice Studio 2026 &bull; Interpretación Neuronal
          </p>

        </div>
      </div>
    );
  }

  // 2. Main Live Audio Receiver UI
  return (
    <div className="container-custom py-4 sm:py-8 space-y-4 sm:space-y-6 max-w-6xl pb-20 bg-white text-zinc-900 text-left overflow-x-hidden">
      
      {/* Top Header Card */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 shadow-2xs">
        <div className="flex items-center gap-3 text-left min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <AudioLines className="w-5 h-5 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight truncate">
                Canal de Traducción Simultánea
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                EN VIVO
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-zinc-500 mt-0.5 font-mono">
              <span>Sala: <b className="text-zinc-900">{roomId}</b></span>
              <span>&bull;</span>
              <span>⚡ {socketLatency}ms latencia</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-zinc-100 flex-shrink-0">
          {hasSavedProfile ? (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 hover:text-zinc-900 transition-all cursor-pointer shadow-2xs max-w-[180px] sm:max-w-[200px]"
              title="Editar mis datos de asistente"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="font-medium truncate">{profile.name}</span>
              <Edit3 className="w-3 h-3 text-zinc-400 hover:text-zinc-700 ml-0.5 flex-shrink-0" />
            </button>
          ) : (
            <button
              onClick={() => setShowCheckInModal(true)}
              className="text-xs text-zinc-800 hover:text-zinc-900 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <User className="w-3.5 h-3.5 text-zinc-700" />
              <span>Identificarme</span>
            </button>
          )}

          <button
            onClick={handleExitClick}
            className="text-xs text-zinc-600 hover:text-zinc-900 px-3.5 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors cursor-pointer flex-shrink-0"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Instant 1-Tap Audio Unlock Notification */}
      {!isAudioUnlocked && (
        <div className="p-4 rounded-2xl bg-zinc-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-white text-zinc-900 flex items-center justify-center flex-shrink-0">
              <Volume2 className="w-5 h-5 fill-current" />
            </div>
            <div className="text-xs text-zinc-300">
              <b className="text-white block text-sm font-semibold">Toca para escuchar en tus auriculares</b>
              Activa la transmisión instantánea. El audio continuará con la pantalla apagada.
            </div>
          </div>
          <button
            onClick={handleUnlockAudio}
            className="h-10 px-5 rounded-full bg-white hover:bg-zinc-200 text-zinc-900 font-semibold text-xs whitespace-nowrap w-full sm:w-auto cursor-pointer shadow-md transition-transform active:scale-95"
          >
            Sintonizar Ahora
          </button>
        </div>
      )}

      {/* iOS Safari Context Suspended Recovery Banner */}
      {isAudioUnlocked && isAudioSuspended && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-left">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>El audio se pausó por el sistema operativo. Pulsa reanudar.</span>
          </div>
          <button
            onClick={handleResumeSuspendedAudio}
            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs whitespace-nowrap cursor-pointer"
          >
            Reanudar
          </button>
        </div>
      )}

      {/* Spacious 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Player & Audio Controls (5 cols on LG/XL) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Central Tactile Studio Player */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-6 text-center space-y-4 sm:space-y-5 relative overflow-hidden shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] sm:text-xs text-zinc-500 font-mono">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                CABINA DE INTERPRETACIÓN
              </span>
              <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <Lock className="w-3 h-3" />
                Segundo plano activo
              </span>
            </div>

            {/* Tactile Voice Ring with animated glow */}
            <div className="py-2 sm:py-3 flex items-center justify-center">
              <button
                type="button"
                onClick={handleUnlockAudio}
                className="p-3 sm:p-4 rounded-full transition-all duration-300 cursor-pointer active:scale-95 focus:outline-none"
                title={!isAudioUnlocked ? 'Toca para activar audio' : 'Canal sintonizado'}
              >
                <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full border flex flex-col items-center justify-center shadow-xs transition-all ${
                  !isAudioUnlocked
                    ? 'bg-amber-50 border-amber-300 ring-4 ring-amber-100 animate-pulse'
                    : isPlayingAudio
                    ? 'bg-emerald-50 border-emerald-300 ring-4 ring-emerald-100'
                    : 'bg-zinc-50 border-zinc-200'
                }`}>
                  <span className="text-3xl sm:text-4xl">{currentLangObj.flag}</span>
                  <span className="text-[11px] sm:text-xs font-mono text-zinc-700 mt-1 uppercase font-semibold tracking-wider">
                    {currentLangObj.code} &bull; {currentLangObj.nativeName}
                  </span>
                  {!isAudioUnlocked && (
                    <span className="text-[9px] font-bold text-amber-700 uppercase tracking-tight mt-0.5 animate-bounce">
                      Toca para oír
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Waveform Spectrum (Minimalist Monochromatic) */}
            <div className="px-1 sm:px-2">
              <AudioVisualizer
                mode="bars"
                height={40}
                barCount={32}
                barColor="#18181b"
                isActive={isPlayingAudio}
                getFrequencyDataFn={audioPlayerService.getFrequencyData.bind(audioPlayerService)}
              />
            </div>

            <div className="text-[11px] sm:text-xs text-zinc-500 font-medium">
              {isPlayingAudio ? (
                <span className="text-zinc-900 flex items-center justify-center gap-2 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Voz neuronal sintetizada sonando en vivo</span>
                </span>
              ) : !isAudioUnlocked ? (
                <button
                  onClick={handleUnlockAudio}
                  className="text-amber-700 font-semibold hover:underline inline-flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Pulsa aquí o en el círculo para activar el sonido</span>
                </button>
              ) : (
                <span className="text-zinc-500">
                  Sintonizado &bull; Listo para reproducir voz en tiempo real
                </span>
              )}
            </div>
          </div>

          {/* Audio Controls: Volume & Playback Rate */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleMute}
                  className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isMuted
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-zinc-50 text-zinc-800 hover:bg-zinc-100 border border-zinc-200'
                  }`}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-zinc-800" />}
                  <span>{isMuted ? 'Silenciado' : 'Sonido Activo'}</span>
                </button>

                <button
                  onClick={handleTestAudio}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 transition-all cursor-pointer"
                  title="Reproduce un tono breve para verificar tus auriculares"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden xs:inline sm:inline">Probar Sonido</span>
                  <span className="xs:hidden sm:hidden">Probar</span>
                </button>
              </div>

              {/* Playback Rate Selector */}
              <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 p-1 rounded-xl">
                <span className="text-[10px] font-mono text-zinc-500 px-1.5 uppercase">Vel:</span>
                {[0.9, 1.0, 1.1, 1.2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => handleSpeedChange(spd)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-medium transition-all cursor-pointer ${
                      playbackRate === spd
                        ? 'bg-zinc-900 text-white font-bold shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {spd.toFixed(1)}x
                  </button>
                ))}
              </div>
            </div>

            {/* Volume Slider */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
                <span>VOLUMEN AURICULARES</span>
                <span className="text-zinc-900 font-semibold">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="eleven-slider-input"
              />
            </div>
          </div>

          {/* Bi-directional Q&A Backchannel Card (2026-2029) - Ocultado temporalmente por solicitud del usuario */}
          {SHOW_QA_SECTION && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3.5 shadow-2xs text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hand className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-semibold text-xs text-zinc-900 uppercase tracking-wider">
                    Preguntar al Ponente (Q&A)
                  </h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-mono">
                  EN VIVO
                </span>
              </div>

              {qaState === 'idle' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    ¿Tienes una duda o comentario? Levanta la mano para pedir la palabra. Podrás hablar en tu idioma ({currentLangObj.nativeName}) y el ponente te escuchará traducido en tiempo real en su auricular.
                  </p>
                  <button
                    type="button"
                    onClick={handleRaiseHand}
                    className="w-full h-11 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Hand className="w-4 h-4 text-amber-400" />
                    <span>Levantar la Mano / Pedir la Palabra</span>
                  </button>
                </div>
              )}

              {qaState === 'requested' && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2.5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                    <span className="text-xs font-bold text-amber-950">Mano levantada enviada</span>
                  </div>
                  <p className="text-xs text-amber-800">
                    El ponente ha recibido tu turno. Cuando te concedan la palabra se activará tu micrófono.
                  </p>
                  <button
                    type="button"
                    onClick={handleCancelRaiseHand}
                    className="px-3.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    Bajar la mano / Cancelar
                  </button>
                </div>
              )}

              {qaState === 'speaking' && (
                <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 space-y-3 animate-fadeIn text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-950">
                        ¡Tienes la palabra! Micrófono abierto
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-900 font-bold">
                      {currentLangObj.code.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-emerald-900">
                    Habla por el micrófono en tu idioma o escribe tu pregunta. El ponente la escuchará traducida a su auricular al instante.
                  </p>

                  <form onSubmit={handleSendQuestion} className="space-y-2.5">
                    <div className="relative">
                      <textarea
                        rows={2}
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        placeholder="Habla o escribe aquí tu pregunta para el ponente..."
                        className="w-full bg-white border border-emerald-300 rounded-xl p-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-600 transition-colors shadow-2xs"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={isRecordingQuestion ? handleStopRecordingQuestion : handleStartRecordingQuestion}
                        className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          isRecordingQuestion
                            ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                            : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700'
                        }`}
                      >
                        {isRecordingQuestion ? (
                          <>
                            <MicOff className="w-3.5 h-3.5" />
                            <span>Detener Dictado</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5 text-zinc-600" />
                            <span>Dictar con Voz</span>
                          </>
                        )}
                      </button>

                      <button
                        type="submit"
                        disabled={!questionText.trim()}
                        className="flex-1 h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar al Ponente</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {qaState === 'completed' && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-1 animate-fadeIn">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                  <div className="text-xs font-bold text-emerald-950">¡Pregunta transmitida!</div>
                  <p className="text-[11px] text-emerald-800">
                    Tu intervención ha sido traducida y transmitida al auricular del ponente y a los subtítulos de la sala.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Headphone & Screen Lock Tip */}
          <div className="text-center text-xs text-zinc-400 py-1 flex items-center justify-center gap-2">
            <Headphones className="w-3.5 h-3.5 text-zinc-400" />
            <span>Puedes apagar la pantalla o cambiar de app y el audio continuará sonando.</span>
          </div>

        </div>

        {/* Right Column: Language Selector & Live Captions Feed (7 cols on LG/XL) */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          
          {/* Language Voice Selector */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-3.5 sm:p-6 space-y-3 sm:space-y-4 shadow-2xs text-left">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-800" />
                <h3 className="font-semibold text-xs text-zinc-900 uppercase tracking-wider">
                  Canal de Idioma &bull; Cabina Neuronal
                </h3>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">CAMBIO INSTANTÁNEO</span>
            </div>

            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onSelectLanguage={handleSelectLanguage}
              languageBreakdown={roomStats.languageBreakdown || {}}
              variant="grid"
            />
          </div>

          {/* Synchronized Captions Feed */}
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
            <LiveCaptions
              transcriptHistory={transcriptHistory}
              currentLanguage={selectedLanguage}
              showOriginal={true}
              maxHeightClass="min-h-[300px] max-h-[500px]"
            />
          </div>

        </div>

      </div>

      {/* Attendee Check-In / Registration Modal */}
      {(showCheckInModal || isEditingProfile) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-white border border-zinc-200 p-6 sm:p-7 shadow-2xl space-y-5 text-left">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
                  <Headphones className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-zinc-900 tracking-tight">
                    {isEditingProfile ? 'Editar mis datos' : 'Registro de Asistente'}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Sala <strong className="text-zinc-900 font-mono">{roomId}</strong> &bull; Traducción simultánea
                  </p>
                </div>
              </div>

              {isEditingProfile && (
                <button
                  onClick={() => setIsEditingProfile(false)}
                  className="p-1.5 rounded-lg bg-zinc-50 text-zinc-400 hover:text-zinc-700 border border-zinc-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs text-zinc-600 leading-relaxed">
                {isEditingProfile 
                  ? 'Actualiza tu nombre o correo para la lista de asistencia y el resumen oficial.'
                  : 'Indica tu nombre para identificarte en la conferencia y recibir el resumen con la transcripción al finalizar.'}
              </p>
              {!isEditingProfile && (
                <p className="text-[11px] text-zinc-400">
                  ⚡ Si sales y vuelves a entrar, el sistema te reconocerá automáticamente sin tener que rellenar tus datos de nuevo.
                </p>
              )}
            </div>

            {/* Check-In Form */}
            <form onSubmit={handleCheckInSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-600 uppercase font-mono">
                  Nombre y Apellido <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="ej. Carlos Mendoza"
                  className="w-full h-11 bg-white border border-zinc-200 rounded-xl px-3.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors shadow-2xs"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-600 uppercase font-mono">
                  Correo Electrónico (Para recibir transcripción)
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="ej. carlos@empresa.com"
                  className="w-full h-11 bg-white border border-zinc-200 rounded-xl px-3.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-600 uppercase font-mono">
                  Teléfono / WhatsApp (Opcional)
                </label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="ej. +34 600 000 000"
                  className="w-full h-11 bg-white border border-zinc-200 rounded-xl px-3.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors shadow-2xs"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={!profile.name.trim()}
                  className="w-full h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-40"
                >
                  <span>{isEditingProfile ? 'Guardar Cambios' : 'Entrar y Sintonizar Audio'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {!isEditingProfile && (
                  <button
                    type="button"
                    onClick={handleSkipCheckIn}
                    className="w-full py-2 text-center text-xs text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
                  >
                    Omitir y entrar como invitado anónimo
                  </button>
                )}
              </div>
            </form>

            <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-400 pt-1 border-t border-zinc-100">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Tus datos se guardan en tu dispositivo y te reconocen al volver</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
