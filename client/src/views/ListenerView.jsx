import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  ArrowLeft,
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
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Menu,
  Sun,
  Moon
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
  const [profile] = useState(() => {
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
        name: profile.name.trim() || 'Oyente',
        email: profile.email.trim() || '',
        phone: profile.phone.trim() || ''
      };
      socketService.joinAsListener(roomId, selectedLangRef.current, activeProfile);

      const elapsed = Date.now() - startTime;
      const minWait = Math.max(0, 300 - elapsed);
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
      if (speaker && (speaker.attendeeId === profile.attendeeId || speaker.name === profile.name)) {
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
    };
  }, [roomId, profile.attendeeId, profile.name]);

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

  const handleExit = () => {
    audioPlayerService.stopAll();
    onLeave({ reason: 'voluntary', selectedLanguage });
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

  // Desktop Studio Layout States
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(true);
  const [activeInspectorTab, setActiveInspectorTab] = useState('actions'); // 'actions' | 'suggestions' | 'room'



  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];

  if (isInitializing) {
    return (
      <div className="h-dvh min-h-dvh w-full flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-dvh min-h-dvh w-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans select-none transition-colors">

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CABECERA MÓVIL: SALA Y CONTROLES ESENCIALES                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="sm:hidden h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-safe border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between bg-white dark:bg-zinc-900 flex-shrink-0 z-30">

        {/* Left: Mobile Exit */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExit}
            className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-2xs"
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 transition-all cursor-pointer truncate shadow-2xs active:scale-95"
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

        {/* Right: Theme Toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            title={resolvedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
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
                  className="h-9 px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
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
            onExit={handleExit}
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

          {/* Derecha: Botón para alternar panel Asistente */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRightDrawerOpen(prev => !prev)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer border ${
                isRightDrawerOpen
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 shadow-2xs'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title="Alternar panel Asistente"
              aria-label="Alternar panel Asistente"
            >
              <SlidersHorizontal className="w-4 h-4" />
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
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5 flex flex-col justify-between">
            <div className="space-y-5">
              {/* Configuración Section */}
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
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
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
                              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white border border-emerald-500 inline-flex items-center justify-center shadow-2xs">
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
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

                {/* Identidad en Sala */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                    Identidad en Sala
                  </label>
                  <div className="h-10 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300 font-medium shadow-2xs">
                    <span className="truncate">{profile.name}</span>
                    <span className="text-[10px] font-mono text-zinc-400">Oyente</span>
                  </div>
                </div>

                {/* Copy Link Secondary Button */}
                <button
                  type="button"
                  onClick={handleCopyMeetingLink}
                  className="w-full h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                >
                  {hasCopiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Enlace Copiado al Portapapeles</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Copiar Enlace de Oyente</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Section: Estado + Primary Button */}
            <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Estado de recepción
              </div>

              {/* Latency & Audio state card */}
              <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between text-xs shadow-2xs">
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
                <span className="font-mono text-[11px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  {socketLatency}ms
                </span>
              </div>

              {/* Visualizer wave if playing and not muted */}
              {isPlayingAudio && !isMuted && (
                <div className="h-10 rounded-xl overflow-hidden bg-zinc-900/10 dark:bg-zinc-900">
                  <GeminiFluidWave className="w-full h-full" />
                </div>
              )}

              {/* Master Audio Control Button (Anchored at Bottom) */}
              <button
                type="button"
                onClick={!isAudioUnlocked ? handleUnlockAudio : handleToggleMute}
                className={`w-full h-11 rounded-2xl font-semibold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs active:scale-[0.99] border ${
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Asistente
                  </h2>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                    Intervenciones en tiempo real
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRightDrawerOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                  title="Cerrar panel"
                >
                  <X className="w-4 h-4" />
                </button>
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
                    {/* Q&A Backchannel Card */}
                    <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          Preguntas al Ponente
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          {qaState === 'idle' ? 'Inactivo' : qaState === 'requested' ? 'En espera' : 'En directo'}
                        </span>
                      </div>

                      {qaState === 'idle' && (
                        <button
                          type="button"
                          onClick={handleRaiseHand}
                          className="w-full h-10 rounded-xl bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                        >
                          <Hand className="w-4 h-4" />
                          <span>Pedir la Palabra</span>
                        </button>
                      )}

                      {qaState === 'requested' && (
                        <div className="space-y-2">
                          <Banner
                            icon={<Hand className="w-4 h-4 text-white animate-bounce" strokeWidth={2.4} />}
                            color="#f59e0b"
                            title="Turno solicitado"
                            desc="El anfitrión ha recibido tu solicitud. Se te notificará cuando se te conceda la palabra."
                          />
                          <button
                            type="button"
                            onClick={handleCancelRaiseHand}
                            className="w-full h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Bajar la mano
                          </button>
                        </div>
                      )}

                      {qaState === 'speaking' && (
                        <div className="space-y-3">
                          <Banner
                            icon={<CheckCircle2 className="w-4 h-4 text-white" strokeWidth={2.4} />}
                            color="#10b981"
                            title="¡Tienes la palabra!"
                            desc="Escribe o dicta tu pregunta con voz. Se traducirá en tiempo real para el ponente."
                          />
                          <form onSubmit={handleSendQuestion} className="space-y-2.5">
                            <textarea
                              rows={2}
                              value={questionText}
                              onChange={(e) => setQuestionText(e.target.value)}
                              placeholder="Escribe aquí tu pregunta..."
                              className="w-full bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={isRecordingQuestion ? handleStopRecordingQuestion : handleStartRecordingQuestion}
                                className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  isRecordingQuestion
                                    ? 'bg-rose-600 text-white border-transparent animate-pulse'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                }`}
                              >
                                <Mic className="w-3.5 h-3.5" />
                                <span>{isRecordingQuestion ? 'Detener' : 'Dictar'}</span>
                              </button>
                              <button
                                type="submit"
                                disabled={!questionText.trim()}
                                className="flex-1 h-9 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Enviar</span>
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab Content: Sugerencias */}
                {activeInspectorTab === 'suggestions' && (
                  <div className="space-y-3 animate-fadeIn">
                    <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1.5 shadow-2xs">
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
                          if (qaState === 'idle') handleRaiseHand();
                        }}
                        className="w-full p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left text-xs text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-2xs"
                      >
                        &ldquo;{phrase}&rdquo;
                      </button>
                    ))}
                  </div>
                )}

                {/* Tab Content: Sala */}
                {activeInspectorTab === 'room' && (
                  <div className="space-y-3 animate-fadeIn">
                    <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2 text-xs shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400">Total Oyentes:</span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{roomStats.totalListeners}</span>
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
                  </div>
                )}
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
          if (qaState === 'idle') handleRaiseHand();
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
