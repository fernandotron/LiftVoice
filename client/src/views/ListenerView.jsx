import React, { useState, useEffect, useRef } from 'react';
import { Headphones, Volume2, VolumeX, Radio, Sparkles, Activity, ShieldCheck, Zap, Sliders, Globe, AudioLines, ArrowRight, ArrowLeft, CheckCircle2, Edit3, Lock, RefreshCw, Home, Heart, Mail, Play, AlertCircle, Download, Check, X, User, Hand, Mic, MicOff, Send, MessageSquare, Sun, Moon, QrCode, Settings, Copy } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import LanguageSelector, { SUPPORTED_LANGUAGES } from '../components/LanguageSelector.jsx';
import LiveCaptions from '../components/LiveCaptions.jsx';
import AudioVisualizer from '../components/AudioVisualizer.jsx';
import BottomSheetModal from '../components/BottomSheetModal.jsx';
import MobileAudioDock from '../components/mobile/MobileAudioDock.jsx';
import LanguageBottomSheet from '../components/mobile/LanguageBottomSheet.jsx';
import MobileQAPill from '../components/mobile/MobileQAPill.jsx';
import { socketService } from '../services/socket.js';
import { audioPlayerService } from '../services/audioPlayer.js';

export default function ListenerView({
  roomId = 'MAIN',
  onLeave = () => {},
  onOpenSettings = () => {},
  onOpenQR = () => {}
}) {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const [isQASheetOpen, setIsQASheetOpen] = useState(false);

  const handleCopyMeetingLink = () => {
    if (!roomId) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/?room=${roomId}&lang=${selectedLanguage}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setHasCopiedLink(true);
        setTimeout(() => setHasCopiedLink(false), 2000);
      }).catch(() => {});
    }
  };
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
  const [isLanguageSheetOpen, setIsLanguageSheetOpen] = useState(false);
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
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center py-10 px-4 bg-white dark:bg-zinc-950 transition-colors">
        <div className="w-full max-w-md space-y-6 text-center">
          
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-zinc-800 text-white flex items-center justify-center mx-auto shadow-md">
            <Heart className="w-7 h-7 text-emerald-400 fill-emerald-400/20" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-700 dark:text-zinc-300">
              <span>Sala:</span>
              <b className="text-zinc-900 dark:text-zinc-100">{roomId}</b>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              ¡Gracias por asistir a la sesión!
            </h1>

            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
              Traducción simultánea en vivo con audio neuronal de alta fidelidad.
            </p>
          </div>

          {/* Session Summary Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-left space-y-3 shadow-2xs">
            <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
              Resumen de tu sesión
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Oyente:</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{profile.name || 'Invitado en Sala'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Canal de voz:</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>{currentLangObj.flag}</span>
                  <span>{currentLangObj.nativeName} ({currentLangObj.code})</span>
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Tiempo de escucha:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{minutesListened} minuto{minutesListened === 1 ? '' : 's'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Frases recibidas:</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-100">{transcriptHistory.length} subtítulos</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            {transcriptHistory.length > 0 && (
              <button
                onClick={handleDownloadTranscript}
                className="w-full h-11 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Transcripción Completa (.txt)</span>
              </button>
            )}

            <button
              onClick={() => setHasExitedSession(false)}
              className="w-full h-11 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Volver a Escuchar en Directo</span>
            </button>

            <button
              onClick={onLeave}
              className="w-full h-10 rounded-xl bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Volver al Inicio</span>
            </button>
          </div>

          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
            LiftVoice Studio 2026 &bull; Interpretación Neuronal
          </p>

        </div>
      </div>
    );
  }

  // 2. Main Live Audio Receiver UI
  return (
    <div className="h-dvh min-h-dvh w-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans select-none transition-colors">
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* CABECERA PRINCIPAL: FORMA DE SALA DE REUNIÓN (ELEVENLABS)      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="h-[calc(3.25rem+env(safe-area-inset-top,0px))] pt-safe border-b border-zinc-200 dark:border-zinc-800 px-3 sm:px-6 flex items-center justify-between bg-white dark:bg-zinc-900 flex-shrink-0 z-30">
        
        {/* Left: Mobile Exit vs Desktop Brand/Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleExitClick}
            className="sm:hidden flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1.5 -ml-1 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Salir de la sala"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Salir</span>
          </button>

          {/* Desktop Brand & Room Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <button
              type="button"
              onClick={onLeave}
              className="flex items-center gap-2 text-left cursor-pointer group"
              title="Volver al inicio"
            >
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="w-1.5 h-4 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                <div className="w-1.5 h-3 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
              </div>
              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 tracking-tight">
                LiftVoice
              </span>
            </button>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span>Cabina de Oyente</span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <button
              type="button"
              onClick={handleCopyMeetingLink}
              title="Copiar vínculo de la reunión"
              className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 rounded-md transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <span>{roomId}</span>
              {hasCopiedLink ? (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-medium flex items-center gap-0.5">
                  <Check className="w-3 h-3" />
                  <span>Copiado</span>
                </span>
              ) : (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans font-normal">
                  Copiar
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Center (Mobile Only): Cápsula de sala estilo Google Meet en una sola línea */}
        <div className="sm:hidden flex items-center justify-center flex-1 min-w-0 px-1.5">
          <button
            type="button"
            onClick={handleCopyMeetingLink}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 transition-all cursor-pointer truncate shadow-2xs active:scale-95"
            title="Toca para copiar vínculo de la reunión"
          >
            <span className="truncate">{roomId}</span>
            {hasCopiedLink ? (
              <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
            ) : (
              <Copy className="w-3 h-3 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
            )}
          </button>
        </div>

        {/* Right Controls: Theme, QR, Settings, Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            title={resolvedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {resolvedTheme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-zinc-600" />}
          </button>

          {/* QR Button */}
          <button
            type="button"
            onClick={onOpenQR}
            className="hidden sm:flex h-8 px-2.5 sm:px-3 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            title="Proyectar código QR"
          >
            <QrCode className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 flex-shrink-0" />
            <span className="hidden sm:inline">QR</span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Configuración de audio y voz"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Attendee Profile Pill */}
          {hasSavedProfile ? (
            <button
              type="button"
              onClick={() => setIsEditingProfile(true)}
              className="h-8 px-2.5 sm:px-3 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer max-w-[110px] sm:max-w-[150px] shadow-2xs"
              title="Editar mis datos de asistente"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="truncate">{profile.name}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCheckInModal(true)}
              className="h-8 px-2.5 sm:px-3 rounded-full bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer shadow-2xs"
            >
              Identificarme
            </button>
          )}

          {/* Desktop Exit Button */}
          <button
            type="button"
            onClick={handleExitClick}
            className="hidden sm:inline-flex text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Salir
          </button>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MÓVIL: STAGE BAR + LIENZO DE SUBTÍTULOS 100% INMERSIVO        */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="sm:hidden flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950 overflow-hidden">
        
        {/* Mobile Stage Bar */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
            <span>En directo · <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{currentLangObj.nativeName}</strong></span>
            <span>•</span>
            <span className="font-mono text-[11px] text-zinc-400">{socketLatency}ms</span>
          </div>
          <button
            type="button"
            onClick={() => setIsLanguageSheetOpen(true)}
            className="h-7 px-2.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <span>{currentLangObj.flag}</span>
            <span>Cambiar</span>
          </button>
        </div>

        {/* Audio Unlock Notification (móvil) */}
        {!isAudioUnlocked && (
          <div className="p-2.5 mx-3 mt-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 shadow-xs flex-shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="text-[11px] font-medium">Toca para activar audio en auriculares</span>
            </div>
            <button
              onClick={handleUnlockAudio}
              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-500 text-zinc-950 font-bold text-[11px] cursor-pointer"
            >
              Sintonizar
            </button>
          </div>
        )}

        {/* Canvas de Subtítulos a Pantalla Completa (100% de alto libre con pb-24 para el dock) */}
        <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden pb-24">
          <LiveCaptions
            transcriptHistory={transcriptHistory}
            currentLanguage={selectedLanguage}
            showOriginal={true}
            className="flex-1 flex flex-col h-full min-h-0 w-full"
            maxHeightClass="flex-1 h-full min-h-0"
          />
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ESCRITORIO: WORKSPACE 2 COLUMNAS (PLAYER + CABINAS + CAPTIONS) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <main className="hidden sm:flex flex-col flex-1 min-h-0 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-6">

          {/* Instant 1-Tap Audio Unlock Notification (Desktop) */}
          {!isAudioUnlocked && (
            <div className="p-4 rounded-2xl bg-zinc-900 dark:bg-zinc-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl border border-zinc-800">
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

          {/* iOS Safari Context Suspended Recovery Banner (Desktop) */}
          {isAudioUnlocked && isAudioSuspended && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-left">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 text-center space-y-4 sm:space-y-5 relative overflow-hidden shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                Cabina de interpretación
              </span>
              <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800/40">
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
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-4 ring-amber-100 dark:ring-amber-900/40 animate-pulse'
                    : isPlayingAudio
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-4 ring-emerald-100 dark:ring-emerald-900/40'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                }`}>
                  <span className="text-3xl sm:text-4xl">{currentLangObj.flag}</span>
                  <span className="text-[11px] sm:text-xs font-mono text-zinc-700 dark:text-zinc-300 mt-1 font-semibold">
                    {currentLangObj.code} &bull; {currentLangObj.nativeName}
                  </span>
                  {!isAudioUnlocked && (
                    <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 mt-0.5 animate-bounce">
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
                barColor="auto"
                isActive={isPlayingAudio}
                getFrequencyDataFn={audioPlayerService.getFrequencyData.bind(audioPlayerService)}
              />
            </div>

            <div className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {isPlayingAudio ? (
                <span className="text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-2 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Voz neuronal sintetizada sonando en vivo</span>
                </span>
              ) : !isAudioUnlocked ? (
                <button
                  onClick={handleUnlockAudio}
                  className="text-amber-700 dark:text-amber-400 font-semibold hover:underline inline-flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Pulsa aquí o en el círculo para activar el sonido</span>
                </button>
              ) : (
                <span className="text-zinc-500 dark:text-zinc-400">
                  Sintonizado &bull; Listo para reproducir voz en tiempo real
                </span>
              )}
            </div>
          </div>

          {/* Audio Controls: Volume & Playback Rate */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleMute}
                  className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isMuted
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />}
                  <span>{isMuted ? 'Silenciado' : 'Sonido Activo'}</span>
                </button>

                <button
                  onClick={handleTestAudio}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-all cursor-pointer"
                  title="Reproduce un tono breve para verificar tus auriculares"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden xs:inline sm:inline">Probar Sonido</span>
                  <span className="xs:hidden sm:hidden">Probar</span>
                </button>
              </div>

              {/* Playback Rate Selector */}
              <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-1 rounded-xl">
                <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 px-1.5">Vel:</span>
                {[0.9, 1.0, 1.1, 1.2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => handleSpeedChange(spd)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-medium transition-all cursor-pointer ${
                      playbackRate === spd
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    {spd.toFixed(1)}x
                  </button>
                ))}
              </div>
            </div>

            {/* Volume Slider */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                <span>Volumen auriculares</span>
                <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{Math.round(volume * 100)}%</span>
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
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3.5 shadow-2xs text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hand className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                  <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    Preguntar al ponente (Q&A)
                  </h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                  En vivo
                </span>
              </div>

              {qaState === 'idle' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    ¿Tienes una duda o comentario? Levanta la mano para pedir la palabra. Podrás hablar en tu idioma ({currentLangObj.nativeName}) y el ponente te escuchará traducido en tiempo real en su auricular.
                  </p>
                  <button
                    type="button"
                    onClick={handleRaiseHand}
                    className="w-full h-11 rounded-xl bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.99]"
                  >
                    <Hand className="w-4 h-4 text-amber-400" />
                    <span>Levantar la Mano / Pedir la Palabra</span>
                  </button>
                </div>
              )}

              {qaState === 'requested' && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2.5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200">Mano levantada enviada</span>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    El ponente ha recibido tu turno. Cuando te concedan la palabra se activará tu micrófono.
                  </p>
                  <button
                    type="button"
                    onClick={handleCancelRaiseHand}
                    className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    Bajar la mano / Cancelar
                  </button>
                </div>
              )}

              {qaState === 'speaking' && (
                <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 space-y-3 animate-fadeIn text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                        ¡Tienes la palabra! Micrófono abierto
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-200/80 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200 font-bold">
                      {currentLangObj.code}
                    </span>
                  </div>

                  <p className="text-xs text-emerald-900 dark:text-emerald-300">
                    Habla por el micrófono en tu idioma o escribe tu pregunta. El ponente la escuchará traducida a su auricular al instante.
                  </p>

                  <form onSubmit={handleSendQuestion} className="space-y-2.5">
                    <div className="relative">
                      <textarea
                        rows={2}
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        placeholder="Habla o escribe aquí tu pregunta para el ponente..."
                        className="w-full bg-white dark:bg-zinc-800 border border-emerald-300 dark:border-emerald-700 rounded-xl p-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-emerald-600 transition-colors shadow-2xs"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={isRecordingQuestion ? handleStopRecordingQuestion : handleStartRecordingQuestion}
                        className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          isRecordingQuestion
                            ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                            : 'bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200'
                        }`}
                      >
                        {isRecordingQuestion ? (
                          <>
                            <MicOff className="w-3.5 h-3.5" />
                            <span>Detener Dictado</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                            <span>Dictar con Voz</span>
                          </>
                        )}
                      </button>

                      <button
                        type="submit"
                        disabled={!questionText.trim()}
                        className="flex-1 h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Enviar al Ponente</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {qaState === 'completed' && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-center space-y-1 animate-fadeIn">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <div className="text-xs font-bold text-emerald-950 dark:text-emerald-100">¡Pregunta transmitida!</div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    Tu intervención ha sido traducida y transmitida al auricular del ponente y a los subtítulos de la sala.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Headphone & Screen Lock Tip */}
          <div className="text-center text-xs text-zinc-400 dark:text-zinc-500 py-1 flex items-center justify-center gap-2">
            <Headphones className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            <span>Puedes apagar la pantalla o cambiar de app y el audio continuará sonando.</span>
          </div>

        </div>

        {/* Right Column: Language Selector & Live Captions Feed (7 cols on LG/XL) */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          
          {/* Language Voice Selector (Desktop / Tablet) */}
          <div className="hidden sm:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-6 space-y-3 sm:space-y-4 shadow-2xs text-left">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
                <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                  Canal de idioma &bull; Cabina neuronal
                </h3>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Cambio instantáneo</span>
            </div>

            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onSelectLanguage={handleSelectLanguage}
              languageBreakdown={roomStats.languageBreakdown || {}}
              variant="grid"
            />
          </div>

          {/* Synchronized Captions Feed */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
            <LiveCaptions
              transcriptHistory={transcriptHistory}
              currentLanguage={selectedLanguage}
              showOriginal={true}
              maxHeightClass="min-h-[55vh] sm:min-h-[300px] max-h-[calc(100dvh-180px)] sm:max-h-[500px]"
            />
            </div>
          </div>
        </div>
      </div>
    </main>

      {/* Mobile Ergonomic Thumb Dock (Formato idéntico a MasterBroadcastDock) */}
      <MobileAudioDock
        currentLanguage={currentLangObj}
        isPlaying={isPlayingAudio}
        isUnlocked={isAudioUnlocked}
        isMuted={isMuted}
        latency={socketLatency}
        qaState={qaState}
        onTogglePlay={!isAudioUnlocked ? handleUnlockAudio : handleToggleMute}
        onToggleMute={handleToggleMute}
        onOpenLanguageSheet={() => setIsLanguageSheetOpen(true)}
        onOpenQA={() => {
          if (qaState === 'idle') handleRaiseHand();
          setIsQASheetOpen(true);
        }}
      />

      <LanguageBottomSheet
        isOpen={isLanguageSheetOpen}
        onClose={() => setIsLanguageSheetOpen(false)}
        selectedLanguage={selectedLanguage}
        onSelectLanguage={handleSelectLanguage}
        languageBreakdown={roomStats.languageBreakdown || {}}
      />

      <MobileQAPill
        isOpen={isQASheetOpen}
        onClose={() => setIsQASheetOpen(false)}
        showFloatingButton={false}
        qaState={qaState}
        currentLanguage={currentLangObj}
        questionText={questionText}
        setQuestionText={setQuestionText}
        isRecording={isRecordingQuestion}
        onRaiseHand={handleRaiseHand}
        onCancelRaiseHand={handleCancelRaiseHand}
        onStartRecord={handleStartRecordingQuestion}
        onStopRecord={handleStopRecordingQuestion}
        onSendQuestion={handleSendQuestion}
      />

      {/* Attendee Check-In / Registration Modal (Bottom Sheet on Mobile, Centered on Desktop) */}
      <BottomSheetModal
        isOpen={showCheckInModal || isEditingProfile}
        onClose={() => {
          if (isEditingProfile) setIsEditingProfile(false);
          else handleSkipCheckIn();
        }}
        title={isEditingProfile ? 'Editar mis datos' : 'Registro de Asistente'}
        subtitle={`Sala ${roomId} • Traducción simultánea`}
        icon={Headphones}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-left">
          <div className="space-y-1">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {isEditingProfile 
                ? 'Actualiza tu nombre o correo para la lista de asistencia y el resumen oficial.'
                : 'Indica tu nombre para identificarte en la conferencia y recibir el resumen con la transcripción al finalizar.'}
            </p>
            {!isEditingProfile && (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                ⚡ Si sales y vuelves a entrar, el sistema te reconocerá automáticamente sin tener que rellenar tus datos de nuevo.
              </p>
            )}
          </div>

          {/* Check-In Form */}
          <form onSubmit={handleCheckInSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 font-mono">
                Nombre y Apellido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="ej. Carlos Mendoza"
                className="w-full h-11 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors shadow-2xs"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 font-mono">
                Correo Electrónico (Para recibir transcripción)
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="ej. carlos@empresa.com"
                className="w-full h-11 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors shadow-2xs"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 font-mono">
                Teléfono / WhatsApp (Opcional)
              </label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="ej. +34 600 000 000"
                className="w-full h-11 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 transition-colors shadow-2xs"
              />
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={!profile.name.trim()}
                className="w-full h-11 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-40 active:scale-[0.99]"
              >
                <span>{isEditingProfile ? 'Guardar Cambios' : 'Entrar y Sintonizar Audio'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {!isEditingProfile && (
                <button
                  type="button"
                  onClick={handleSkipCheckIn}
                  className="w-full py-2 text-center text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Omitir y entrar como invitado anónimo
                </button>
              )}
            </div>
          </form>

          <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Tus datos se guardan en tu dispositivo y te reconocen al volver</span>
          </div>
        </div>
      </BottomSheetModal>

    </div>
  );
}
