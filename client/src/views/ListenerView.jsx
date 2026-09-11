import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Check,
  Hand,
  Mic,
  MicOff,
  Send,
  Copy,
  X,
  Type,
  PanelRight,
  ChevronDown,
  Sparkles,
  Menu,
  Sun,
  Moon,
  Pencil,
  Users,
  Search
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import LanguageSelector, { SUPPORTED_LANGUAGES } from '../components/LanguageSelector.jsx';
import LiveCaptions from '../components/LiveCaptions.jsx';
import CountryFlag from '../components/shared/CountryFlag.jsx';
import GeminiFluidWave from '../components/shared/GeminiFluidWave.jsx';
import MobileAudioDock from '../components/mobile/MobileAudioDock.jsx';
import LanguageBottomSheet from '../components/mobile/LanguageBottomSheet.jsx';
import MobileQAPill from '../components/mobile/MobileQAPill.jsx';
import Banner from '../components/shared/Banner.jsx';
import DesktopHeaderMenu from '../components/shared/DesktopHeaderMenu.jsx';
import { socketService } from '../services/socket.js';
import { audioPlayerService } from '../services/audioPlayer.js';

export default function ListenerView({
  roomId = 'MAIN',
  onLeave = () => {}
}) {
  const { resolvedTheme, toggleTheme } = useTheme();
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

  // Anonymous attendee profile by default (retrieves stored profile if previously saved)
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('lv_attendee_profile');
      if (saved) {
        const p = JSON.parse(saved);
        return {
          attendeeId: p.attendeeId || `att_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`,
          name: p.name || 'Oyente',
          email: p.email || '',
          phone: p.phone || ''
        };
      }
    } catch (e) {}
    return {
      attendeeId: `att_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`,
      name: 'Oyente',
      email: '',
      phone: ''
    };
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(profile.name || 'Oyente');
  const [isProfilePopoverOpen, setIsProfilePopoverOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const profilePopoverRef = useRef(null);
  const profileNameRef = useRef(profile.name);
  useEffect(() => {
    profileNameRef.current = profile.name;
  }, [profile.name]);

  useEffect(() => {
    if (!isProfilePopoverOpen) return;
    const handleClickOutside = (e) => {
      if (profilePopoverRef.current && !profilePopoverRef.current.contains(e.target)) {
        setIsProfilePopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfilePopoverOpen]);

  const handleSaveProfileName = () => {
    const trimmed = editName.trim() || 'Oyente';
    profileNameRef.current = trimmed;
    const updated = { ...profile, name: trimmed };
    setProfile(updated);
    setEditName(trimmed);
    setIsEditingName(false);
    try {
      localStorage.setItem('lv_attendee_profile', JSON.stringify(updated));
    } catch (e) {}
    socketService.registerAttendeeLead(roomId, updated);
  };

  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlLang = params.get('lang');
        const validLangs = ['es', 'en', 'it', 'pt'];
        if (urlLang && validLangs.includes(urlLang.toLowerCase())) {
          return urlLang.toLowerCase();
        }
        const savedLang = localStorage.getItem('lv_preferred_lang');
        if (savedLang && validLangs.includes(savedLang.toLowerCase())) {
          return savedLang.toLowerCase();
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
    try {
      localStorage.setItem('lv_preferred_lang', selectedLanguage);
    } catch (e) {}
  }, [selectedLanguage]);

  const [isAudioUnlocked, setIsAudioUnlocked] = useState(() => audioPlayerService.isUnlocked);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioSuspended, setIsAudioSuspended] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [roomStats, setRoomStats] = useState({
    totalListeners: 0,
    languageBreakdown: { en: 0, es: 0, it: 0, pt: 0 }
  });
  const [socketLatency, setSocketLatency] = useState(14);

  // Bi-directional Q&A Backchannel State
  const [qaState, setQaState] = useState('idle'); // 'idle' | 'requested' | 'speaking' | 'completed'
  const [questionText, setQuestionText] = useState('');
  const [isRecordingQuestion, setIsRecordingQuestion] = useState(false);
  const recognitionRef = useRef(null);

  // Dynamic Caption Size for Audience Reading Comfort ('sm' | 'md' | 'lg' | 'xl')
  const [captionSize, setCaptionSize] = useState(() => {
    try {
      return localStorage.getItem('lv_caption_size') || 'md';
    } catch (e) {
      return 'md';
    }
  });
  const [isInitializing, setIsInitializing] = useState(true);

  const handleCycleCaptionSize = () => {
    const order = ['sm', 'md', 'lg', 'xl'];
    setCaptionSize((prev) => {
      const idx = order.indexOf(prev);
      const next = order[(idx + 1) % order.length];
      try {
        localStorage.setItem('lv_caption_size', next);
      } catch (e) {}
      return next;
    });
  };

  // Connect socket immediately upon mounting - Instant entry without registration popups
  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();

    socketService.connect().then(() => {
      const activeProfile = {
        attendeeId: profile.attendeeId,
        name: (profileNameRef.current || profile.name || '').trim() || 'Oyente',
        email: profile.email.trim() || '',
        phone: profile.phone.trim() || ''
      };
      socketService.joinAsListener(roomId, selectedLangRef.current, activeProfile);

      const elapsed = Date.now() - startTime;
      const minWait = Math.max(0, 500 - elapsed);
      setTimeout(() => {
        if (isMounted) setIsInitializing(false);
      }, minWait);
    }).catch(() => {
      if (isMounted) setIsInitializing(false);
    });

    const fallbackTimer = setTimeout(() => {
      if (isMounted) setIsInitializing(false);
    }, 1500);

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
      setIsAudioSuspended(audioPlayerService.isContextSuspended());
    });

    // Q&A Backchannel socket handlers
    const unsubQaConfirmed = socketService.on('qa_hand_raise_confirmed', () => {
      setQaState('requested');
    });

    const unsubQaSpeaker = socketService.on('qa_active_speaker', (msg) => {
      const speaker = msg.speaker || msg;
      if (speaker && (speaker.attendeeId === profile.attendeeId || speaker.name === profileNameRef.current || speaker.name === profile.name)) {
        setQaState('speaking');
      }
    });

    const unsubQaClosed = socketService.on('qa_question_closed', () => {
      setQaState('idle');
      setIsRecordingQuestion(false);
    });

    const unsubKicked = socketService.on('kicked_by_host', (data) => {
      console.warn('[ListenerView] Attendee was kicked by host.');
      audioPlayerService.stopAll();
      audioPlayerService.disposeSession();
      onLeave({
        reason: 'kicked',
        message: data?.reason || 'Has sido expulsado de la sala por el anfitrión.'
      });
    });

    try {
      if (roomId) localStorage.setItem('lv_last_room_id', roomId);
    } catch (e) {}

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch (e) {}
        recognitionRef.current = null;
      }
      socketService.leaveRoom(roomId);
      unsubAudio();
      unsubTranscript();
      unsubStats();
      unsubLatency();
      unsubPlayer();
      unsubQaConfirmed();
      unsubQaSpeaker();
      unsubQaClosed();
      unsubKicked();
      audioPlayerService.stopAll();
      audioPlayerService.disposeSession();
    };
  }, [roomId, profile.attendeeId]);

  // Periodic check for audio suspension on iOS Safari
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
    const cleanLang = (langCode || 'es').toLowerCase();
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

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioPlayerService.setMuted(nextMute);
  };

  const handleExit = (isDesktopMode = false) => {
    audioPlayerService.stopAll();
    socketService.leaveRoom(roomId);
    onLeave({
      reason: 'voluntary',
      selectedLanguage,
      isDesktop: isDesktopMode || (typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches),
      isMobile: !isDesktopMode && (typeof window !== 'undefined' && !window.matchMedia('(min-width: 640px)').matches)
    });
  };

  const handleRaiseHand = (overrideText = null) => {
    const textToSend = (overrideText !== null ? overrideText : questionText).trim();
    if (!textToSend) return;

    handleStopRecordingQuestion();

    socketService.raiseHand(roomId, {
      attendeeId: profile.attendeeId,
      name: profile.name.trim() || 'Oyente',
      email: profile.email || '',
      phone: profile.phone || '',
      nativeLang: selectedLanguage,
      questionText: textToSend
    });

    socketService.sendQuestionAudio(
      roomId,
      null,
      'audio/webm',
      selectedLanguage,
      profile.name.trim() || 'Oyente',
      textToSend
    );

    setQaState('requested');
  };

  const handleCancelRaiseHand = () => {
    setQaState('idle');
    socketService.lowerHand(roomId, profile.attendeeId);
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
        es: 'es-ES', en: 'en-US', it: 'it-IT', pt: 'pt-BR'
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
    handleRaiseHand();
  };

  // Desktop Studio Layout States
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(true);
  const [activeInspectorTab, setActiveInspectorTab] = useState('actions'); // 'actions' | 'suggestions' | 'room'



  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];

  if (isInitializing) {
    return (
      <div className="h-dvh min-h-dvh w-full flex flex-col items-center justify-center bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 space-y-4 text-center select-none animate-fadeIn">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 dark:border-t-zinc-100 animate-spin" />
          <Volume2 className="w-5 h-5 text-zinc-600 dark:text-zinc-400 absolute" />
        </div>
        <div className="space-y-1 max-w-xs">
          <h3 className="font-semibold text-xs sm:text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
            Sintonizando sala <span className="font-mono text-zinc-600 dark:text-zinc-400">{roomId}</span>
          </h3>
          <p className="text-[11px] sm:text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
            Conectando con la cabina de audio e interpretación en directo...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh min-h-dvh w-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans select-none transition-colors">

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CABECERA MÓVIL: SALA Y CONTROLES ESENCIALES                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="sm:hidden h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-safe border-b border-zinc-200 dark:border-zinc-800/80 px-4 flex items-center justify-between bg-white dark:bg-zinc-950 flex-shrink-0 z-30">

        {/* Left: Mobile Exit */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExit(false)}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Salir de la sala"
            aria-label="Salir de la sala"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Mobile Room Capsule */}
        <div className="flex items-center justify-center flex-1 min-w-0 px-1.5">
          <button
            type="button"
            onClick={handleCopyMeetingLink}
            className="flex items-center gap-1.5 px-3.5 py-1.5 min-h-[44px] rounded-full bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 transition-all cursor-pointer truncate shadow-xs active:scale-95"
            title="Toca para copiar vínculo de la reunión"
          >
            <span className="truncate">{roomId}</span>
            {hasCopiedLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
            )}
          </button>
        </div>

        {/* Right: Theme Toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-xs active:scale-95"
            title={resolvedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label={resolvedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-zinc-600 dark:text-zinc-400" /> : <Moon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />}
          </button>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MÓVIL: STAGE BAR + LIENZO DE SUBTÍTULOS INMERSIVO             */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="sm:hidden flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950 overflow-hidden">

        {/* Mobile Stage Bar: unificado con el canvas de subtítulos sin línea divisoria */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:py-3 bg-white dark:bg-zinc-950 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
            <span>En directo · <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{currentLangObj.nativeName}</strong></span>
          </div>
          <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/70 px-2.5 py-1 rounded-full">
            {socketLatency}ms
          </span>
        </div>

        {/* Audio Unlock Notification (móvil estilo Reness) */}
        {!isAudioUnlocked && (
          <div className="px-4 pt-2.5 pb-1 flex-shrink-0">
            <Banner
              icon={<Volume2 className="w-4 h-4 text-white" strokeWidth={2.4} />}
              color="#3b82f6"
              title="Activar audio en directo"
              desc="Toca para sincronizar y escuchar la traducción en tus auriculares."
              action={
                <button
                  type="button"
                  onClick={handleUnlockAudio}
                  className="min-h-[44px] px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  Sintonizar
                </button>
              }
            />
          </div>
        )}

        {/* Canvas de Subtítulos a Pantalla Completa con espacio inferior para el dock */}
        <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden pb-24">
          <LiveCaptions
            transcriptHistory={transcriptHistory}
            currentLanguage={selectedLanguage}
            showOriginal={true}
            captionSize={captionSize}
            className="flex-1 flex flex-col h-full min-h-0 w-full"
            maxHeightClass="flex-1 h-full min-h-0"
          />
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ESCRITORIO: HEADER GLOBAL + ARQUITECTURA DE 4 ZONAS           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="hidden sm:flex flex-col flex-1 min-h-0 w-full overflow-hidden bg-white dark:bg-zinc-950">

        {/* CABECERA SUPERIOR GLOBAL (DESKTOP HEADER 48px) */}
        <header className="h-12 w-full border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 px-4 flex items-center justify-between flex-shrink-0 z-30 select-none">
          {/* Izquierda: Menú con icono de 2 líneas redondeadas y flyout de Tema */}
          <DesktopHeaderMenu
            onExit={() => handleExit(true)}
            hasCopiedLink={hasCopiedLink}
            onCopyLink={handleCopyMeetingLink}
          />

          {/* Centro: Código de Sala con botón de copiar (sin la palabra "sala") */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleCopyMeetingLink}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer shadow-2xs"
              title="Copiar vínculo de la sala"
            >
              <span>{roomId}</span>
              {hasCopiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
              )}
            </button>
          </div>

          {/* Derecha: Perfil de usuario + Botón para alternar panel Asistente */}
          <div className="flex items-center gap-2">
            {/* Píldora de Perfil interactiva con popover */}
            <div className="relative" ref={profilePopoverRef}>
              <button
                type="button"
                onClick={() => {
                  setEditName(profile.name || 'Oyente');
                  setIsProfilePopoverOpen(prev => !prev);
                }}
                className="flex items-center gap-1.5 h-8 pl-1.5 pr-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-2xs"
                title="Tu perfil en la sala"
                aria-label="Tu perfil en la sala"
              >
                <div className="w-5.5 h-5.5 rounded-full bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center text-[10px] font-bold">
                  {profile.name ? profile.name.slice(0, 1).toUpperCase() : 'O'}
                </div>
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 max-w-[80px] sm:max-w-[110px] truncate">
                  {profile.name || 'Oyente'}
                </span>
              </button>

              {/* Popover flotante para renombrarse */}
              {isProfilePopoverOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 p-3.5 bg-white dark:bg-[#1f1f1f] border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl z-50 animate-fadeIn space-y-3 select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center text-xs font-bold">
                        {profile.name ? profile.name.slice(0, 1).toUpperCase() : 'O'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          Identidad en Sala
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Audiencia conectada</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsProfilePopoverOpen(false)}
                      className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveProfileName();
                      setIsProfilePopoverOpen(false);
                    }}
                    className="space-y-2.5"
                  >
                    <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block">
                      Nombre para preguntas al ponente:
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Tu nombre..."
                      maxLength={30}
                      autoFocus
                      className="w-full h-8 px-3 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-100"
                    />
                    <button
                      type="submit"
                      className="w-full h-8 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                    >
                      Guardar Nombre
                    </button>
                  </form>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsRightDrawerOpen(prev => !prev)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer border ${
                isRightDrawerOpen
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 shadow-2xs'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title={isRightDrawerOpen ? "Ocultar panel Asistente" : "Mostrar panel Asistente"}
              aria-label={isRightDrawerOpen ? "Ocultar panel Asistente" : "Mostrar panel Asistente"}
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* CUERPO DE 4 ZONAS (INICIA DEBAJO DEL HEADER) */}
        <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-row bg-white dark:bg-zinc-950">



        {/* ZONE 2: LEFT CONFIGURATION & CONTROL PANEL (w-80) */}
        <aside className="w-80 border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex flex-col flex-shrink-0 select-none overflow-hidden">
          {/* Header: Title */}
          <div className="h-14 px-5 flex items-center justify-between bg-white dark:bg-zinc-950 flex-shrink-0">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Cabina de Oyente
              </h2>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                Sincronización de audio y texto en tiempo real
              </p>
            </div>
          </div>

          {/* Línea divisoria con margen horizontal en X (no abarca el ancho completo) */}
          <div className="mx-5 border-b border-zinc-200 dark:border-zinc-800/80 flex-shrink-0" />

          {/* Left Sidebar Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5 flex flex-col space-y-5">
            <div className="space-y-4">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Configuración
              </div>

              {/* Canal de Recepción (4 bloques directos en cuadrícula 2x2 - Inspirado en media_1789145385636.png) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Canal de recepción
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {SUPPORTED_LANGUAGES.map(lang => {
                    const isSelected = selectedLanguage === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleSelectLanguage(lang.code)}
                        className={`p-3 min-w-[44px] min-h-[44px] rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-600 ring-1 ring-zinc-400/30 dark:ring-zinc-600/30 shadow-2xs'
                            : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                        }`}
                      >
                        {/* Fila superior: Bandera a la izquierda, Badge a la derecha */}
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200/60 dark:border-zinc-700/60 overflow-hidden shadow-2xs">
                            <CountryFlag code={lang.code} className="w-4.5 h-4.5 rounded-full object-cover" />
                          </div>
                          {isSelected ? (
                            <span className="w-6 h-6 inline-flex items-center justify-center text-zinc-900 dark:text-white">
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            </span>
                          ) : (
                            <span className="h-6 px-2 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-[10px] font-mono font-medium text-zinc-400 dark:text-zinc-500 inline-flex items-center justify-center">
                              {lang.code.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Fila inferior: Nombre de idioma y voz */}
                        <div>
                          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                            {lang.nativeName}
                          </div>
                          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                            {lang.voice}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section: Estado + Primary Button (Flujo continuo y compacto sin líneas divisorias) */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Estado de recepción
              </div>

              {/* Latency & Audio state card */}
              <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    isMuted
                      ? 'bg-zinc-400 dark:bg-zinc-500'
                      : isPlayingAudio
                      ? 'bg-emerald-500 animate-pulse'
                      : isAudioUnlocked
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`} />
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {isMuted
                      ? 'Audio silenciado'
                      : isPlayingAudio
                      ? 'Reproduciendo audio'
                      : isAudioUnlocked
                      ? 'Audio sincronizado'
                      : 'Audio en espera'}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-200/70 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full">
                  {socketLatency}ms
                </span>
              </div>

              {/* Visualizer wave if playing and not muted */}
              {isPlayingAudio && !isMuted && (
                <div className="h-10 rounded-xl overflow-hidden bg-zinc-900/10 dark:bg-zinc-900/60">
                  <GeminiFluidWave className="w-full h-full" />
                </div>
              )}

              {/* Master Audio Control Button (Anchored at Bottom) */}
              <button
                type="button"
                onClick={!isAudioUnlocked ? handleUnlockAudio : handleToggleMute}
                className={`w-full h-11 min-h-[44px] min-w-[44px] rounded-full font-semibold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs active:scale-[0.99] border ${
                  !isAudioUnlocked
                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 border-transparent'
                    : isMuted
                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 border-transparent'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {!isAudioUnlocked ? (
                  <>
                    <Volume2 className="w-4 h-4 text-current" />
                    <span>Iniciar Sintonización</span>
                  </>
                ) : isMuted ? (
                  <>
                    <Volume2 className="w-4 h-4 text-current" />
                    <span>Reanudar Audio</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <span>Silenciar Audio</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* ZONE 3: DOMINANT REAL-TIME TRANSCRIPTION CANVAS (flex-1) */}
        <section className="flex-1 min-w-0 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden">
          {/* Canvas Header */}
          <div className="h-14 border-b border-zinc-200 dark:border-zinc-800/80 px-6 flex items-center justify-between bg-white dark:bg-zinc-950 flex-shrink-0">
            <div>
              <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <span>Transcripción en Tiempo Real</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </h1>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                La transcripción aparecerá aquí cuando esté disponible
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Caption size switch */}
              <button
                type="button"
                onClick={handleCycleCaptionSize}
                className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Cambiar tamaño de fuente"
              >
                <Type className="w-3.5 h-3.5 text-zinc-400" />
                <span>{captionSize.toUpperCase()}</span>
              </button>
            </div>
          </div>

          {/* Canvas Body */}
          <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden p-4 sm:p-6">
            <LiveCaptions
              transcriptHistory={transcriptHistory}
              currentLanguage={selectedLanguage}
              showOriginal={true}
              captionSize={captionSize}
              className="flex-1 flex flex-col h-full min-h-0 w-full"
              maxHeightClass="flex-1 h-full min-h-0"
            />
          </div>
        </section>

        {/* ZONE 4: COLLAPSIBLE RIGHT INSPECTOR PANEL (w-88) */}
        {isRightDrawerOpen && (
          <aside className="w-88 border-l border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex flex-col flex-shrink-0 select-none overflow-hidden animate-fadeIn">
            {/* Inspector Header: Title + Subtitle + Menú de pestañas dentro del Header */}
            <div className="px-5 pt-3.5 pb-2.5 flex flex-col gap-2.5 bg-white dark:bg-zinc-950 flex-shrink-0">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Asistente
                </h2>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                  Intervenciones en tiempo real
                </p>
              </div>

              {/* Menú de pestañas dentro del header (estilo exacto app-salud / media_1789147633077.png) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('actions')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0 cursor-pointer ${
                    activeInspectorTab === 'actions'
                      ? 'text-zinc-950 dark:text-zinc-100 bg-zinc-100 dark:bg-white/10 shadow-2xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                  }`}
                >
                  Acciones
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('suggestions')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0 cursor-pointer ${
                    activeInspectorTab === 'suggestions'
                      ? 'text-zinc-950 dark:text-zinc-100 bg-zinc-100 dark:bg-white/10 shadow-2xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                  }`}
                >
                  Sugerencias
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInspectorTab('room')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0 cursor-pointer ${
                    activeInspectorTab === 'room'
                      ? 'text-zinc-950 dark:text-zinc-100 bg-zinc-100 dark:bg-white/10 shadow-2xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                  }`}
                >
                  Sala
                </button>
              </div>
            </div>

            {/* Inspector Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 pt-2.5 pb-5 flex flex-col justify-between">
              <div className="space-y-4">

                {/* Tab Content: Acciones */}
                {activeInspectorTab === 'actions' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        Preguntas al Ponente
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-zinc-500 dark:text-zinc-400">
                        {qaState === 'idle' ? 'Inactivo' : qaState === 'requested' ? 'En espera' : 'En directo'}
                      </span>
                    </div>

                    {qaState === 'idle' && (
                      <form onSubmit={handleSendQuestion} className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                            <label htmlFor="desktop-qa-question" className="font-medium">
                              Escribe tu consulta para pedir turno:
                            </label>
                            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">{currentLangObj.nativeName}</span>
                          </div>
                          <textarea
                            id="desktop-qa-question"
                            rows={3}
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            placeholder="Escribe aquí tu duda o consulta..."
                            className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-none transition-all leading-relaxed"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={isRecordingQuestion ? handleStopRecordingQuestion : handleStartRecordingQuestion}
                            className={`h-9 px-3.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                              isRecordingQuestion
                                ? 'bg-rose-600 text-white border-transparent animate-pulse'
                                : 'bg-white dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700/60 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }`}
                            title={isRecordingQuestion ? 'Detener dictado por voz' : 'Dictar consulta por voz'}
                          >
                            <Mic className="w-3.5 h-3.5" />
                            <span>{isRecordingQuestion ? 'Detener' : 'Dictar'}</span>
                          </button>

                          <button
                            type="submit"
                            disabled={!questionText.trim()}
                            className="flex-1 h-9 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                          >
                            <Hand className="w-3.5 h-3.5" />
                            <span>Pedir la Palabra</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between px-0.5 text-[11px] text-zinc-400 dark:text-zinc-500 pt-0.5">
                          <span className="truncate">Nombre visible: <strong className="text-zinc-700 dark:text-zinc-300 font-medium">{profile.name}</strong></span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditName(profile.name || 'Oyente');
                              setIsProfilePopoverOpen(true);
                            }}
                            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 underline cursor-pointer flex-shrink-0"
                          >
                            cambiar
                          </button>
                        </div>
                      </form>
                    )}

                    {qaState === 'requested' && (
                      <div className="space-y-3">
                        <Banner
                          icon={<Hand className="w-4 h-4 text-white animate-bounce" strokeWidth={2.4} />}
                          color="#f59e0b"
                          title="Turno solicitado"
                          desc="El ponente ha recibido tu consulta. Se te notificará cuando se te conceda la palabra."
                        />
                        {questionText && (
                          <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-200 leading-relaxed font-medium">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">Tu consulta enviada:</span>
                            &ldquo;{questionText}&rdquo;
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleCancelRaiseHand}
                          className="w-full h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Cancelar turno y bajar la mano
                        </button>
                      </div>
                    )}

                    {qaState === 'speaking' && (
                      <div className="space-y-3">
                        <Banner
                          icon={<CheckCircle2 className="w-4 h-4 text-white" strokeWidth={2.4} />}
                          color="#10b981"
                          title="¡Tienes la palabra!"
                          desc="El ponente te ha dado paso en directo."
                        />
                        {questionText && (
                          <div className="p-3 rounded-xl border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed font-medium">
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 block mb-1">Tu consulta:</span>
                            &ldquo;{questionText}&rdquo;
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setQaState('idle');
                            setQuestionText('');
                            socketService.lowerHand(roomId, profile.attendeeId);
                          }}
                          className="w-full h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Finalizar intervención
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab Content: Sugerencias */}
                {activeInspectorTab === 'suggestions' && (
                  <div className="space-y-3 animate-fadeIn">
                    <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 space-y-1.5 shadow-2xs">
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        Preguntas recomendadas
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Puedes pulsar cualquiera de estas frases para cargarlas en el campo de texto:
                      </p>
                    </div>
                    {[
                      "¿Podría profundizar más en el último punto?",
                      "¿Cómo impacta esto en la implementación práctica?",
                      "¿Cuál es el siguiente paso previsto en la hoja de ruta?"
                    ].map((phrase, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setQuestionText(phrase);
                          setActiveInspectorTab('actions');
                        }}
                        className="w-full p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/60 text-left text-xs text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-2xs"
                      >
                        &ldquo;{phrase}&rdquo;
                      </button>
                    ))}
                  </div>
                )}

                {/* Tab Content: Sala */}
                {activeInspectorTab === 'room' && (() => {
                  const rawParticipants = roomStats.attendees || [];
                  const hasSelf = rawParticipants.some(p => p.id === profile.attendeeId);
                  const fullParticipants = hasSelf
                    ? rawParticipants
                    : [
                        ...rawParticipants,
                        {
                          id: profile.attendeeId,
                          name: profile.name || 'Oyente',
                          lang: selectedLanguage,
                          isHost: false
                        }
                      ];

                  const filteredParticipants = fullParticipants.filter(p => {
                    if (!participantSearch.trim()) return true;
                    const term = participantSearch.toLowerCase();
                    return (
                      (p.name && p.name.toLowerCase().includes(term)) ||
                      (p.lang && p.lang.toLowerCase().includes(term))
                    );
                  });

                  const sortedParticipants = [...filteredParticipants].sort((a, b) => {
                    if (a.isHost) return -1;
                    if (b.isHost) return 1;
                    if (a.id === profile.attendeeId) return -1;
                    if (b.id === profile.attendeeId) return 1;
                    return (a.name || '').localeCompare(b.name || '');
                  });

                  return (
                    <div className="space-y-3 animate-fadeIn">
                      {/* Resumen Técnico */}
                      <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 space-y-2 text-xs shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500 dark:text-zinc-400">Total Oyentes:</span>
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {roomStats.totalListeners || fullParticipants.filter(p => !p.isHost).length || 1}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500 dark:text-zinc-400">Canal de Escucha:</span>
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 uppercase">{selectedLanguage}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500 dark:text-zinc-400">Latencia WebSocket:</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{socketLatency}ms</span>
                        </div>
                      </div>

                      {/* Directorio de Participantes */}
                      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 shadow-2xs overflow-hidden">
                        <div className="px-3.5 py-2.5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              Participantes en Sala
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800/70 text-[10px] font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                            {fullParticipants.length}
                          </span>
                        </div>

                        {/* Buscador si hay más de 5 participantes */}
                        {fullParticipants.length > 5 && (
                          <div className="p-2 border-b border-zinc-200/60 dark:border-zinc-800/60">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                              <input
                                type="text"
                                value={participantSearch}
                                onChange={(e) => setParticipantSearch(e.target.value)}
                                placeholder="Buscar participante..."
                                className="w-full h-7 pl-8 pr-3 rounded-full bg-white dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all"
                              />
                            </div>
                          </div>
                        )}

                        {/* Lista de usuarios conectados */}
                        <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
                          {sortedParticipants.length === 0 ? (
                            <div className="py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                              No hay participantes que coincidan
                            </div>
                          ) : (
                            sortedParticipants.map((p) => {
                              const isSelf = p.id === profile.attendeeId;
                              const isHost = p.isHost;
                              const initials = (p.name || 'O')
                                .split(' ')
                                .map(w => w[0])
                                .filter(Boolean)
                                .slice(0, 2)
                                .join('')
                                .toUpperCase() || 'O';

                              if (isHost) {
                                return (
                                  <div
                                    key="host"
                                    className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="relative shrink-0">
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                                          P
                                        </div>
                                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-zinc-900" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                          {p.name || 'Ponente'}
                                        </div>
                                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400">
                                          Anfitrión
                                        </div>
                                      </div>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                                      <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                      EN VIVO
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={p.id}
                                  className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                                    isSelf
                                      ? 'bg-zinc-200/60 dark:bg-zinc-800/60'
                                      : 'hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                        isSelf
                                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                      }`}
                                    >
                                      {initials}
                                    </div>
                                    <div className="min-w-0 flex items-center gap-1.5">
                                      <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                        {p.name || 'Oyente'}
                                      </span>
                                      {isSelf && (
                                        <span className="px-1 py-0.2 rounded text-[9px] font-medium bg-zinc-300/70 dark:bg-zinc-700/70 text-zinc-700 dark:text-zinc-300 shrink-0">
                                          Tú
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs shrink-0">
                                    <CountryFlag code={p.lang || 'es'} className="w-3 h-3 rounded-full object-cover shrink-0" />
                                    <span className="text-[9px] font-mono font-medium text-zinc-500 uppercase">
                                      {p.lang || 'es'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Bottom Tip Card (Matching Reference Screenshot 2) */}
              <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 text-xs space-y-1 mt-4 shadow-2xs">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  <span>Tip de Cabina</span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Puedes hablar o escribir en tu idioma natal; el sistema de traducción traducirá tus preguntas automáticamente al ponente.
                </p>
              </div>
            </div>
          </aside>
        )}

        </div>
      </div>

      {/* Mobile Ergonomic Thumb Dock with Upward Action Menu */}
      <MobileAudioDock
        currentLanguage={currentLangObj}
        selectedLanguage={selectedLanguage}
        onSelectLanguage={handleSelectLanguage}
        languageBreakdown={roomStats.languageBreakdown || {}}
        isPlaying={isPlayingAudio}
        isUnlocked={isAudioUnlocked}
        isMuted={isMuted}
        latency={socketLatency}
        qaState={qaState}
        captionSize={captionSize}
        onCycleCaptionSize={handleCycleCaptionSize}
        onTogglePlay={!isAudioUnlocked ? handleUnlockAudio : handleToggleMute}
        onToggleMute={handleToggleMute}
        onOpenLanguageSheet={() => setIsLanguageSheetOpen(true)}
        onOpenQA={() => {
          setIsQASheetOpen(true);
        }}
      />

      {/* Mobile Language Bottom Sheet */}
      <LanguageBottomSheet
        isOpen={isLanguageSheetOpen}
        onClose={() => setIsLanguageSheetOpen(false)}
        selectedLanguage={selectedLanguage}
        onSelectLanguage={handleSelectLanguage}
        languageBreakdown={roomStats.languageBreakdown || {}}
      />

      {/* Mobile Q&A Pill Modal */}
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
    </div>
  );
}
