import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Radio, Settings, Volume2, Sparkles, AudioLines, Sliders,
  RefreshCw, Check, Globe, ChevronRight, Activity, Users, QrCode, Play,
  Send, Layers, ArrowRight, Shield, Download, FileText, Stethoscope, Home,
  Search, ExternalLink, Headphones, Hand, HelpCircle, CheckCircle2, XCircle, MessageSquare,
  Menu, X, SlidersHorizontal, Copy, ChevronDown
} from 'lucide-react';
import AudioVisualizer from '../components/AudioVisualizer.jsx';
import LiveCaptions from '../components/LiveCaptions.jsx';
import ElevenSlider from '../components/ElevenSlider.jsx';
import VoiceCatalogModal from '../components/VoiceCatalogModal.jsx';
import QRCodeModal from '../components/QRCodeModal.jsx';
import AttendeesModal from '../components/AttendeesModal.jsx';
import SessionSummaryModal from '../components/SessionSummaryModal.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import DynamicIslandBar from '../components/mobile/DynamicIslandBar.jsx';
import MasterBroadcastDock from '../components/mobile/MasterBroadcastDock.jsx';
import CabinsBottomSheet from '../components/mobile/CabinsBottomSheet.jsx';
import QABannerAlert from '../components/mobile/QABannerAlert.jsx';
import Banner from '../components/shared/Banner.jsx';
import DesktopHeaderMenu from '../components/shared/DesktopHeaderMenu.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { audioRecorderService } from '../services/audioRecorder.js';
import { audioPlayerService } from '../services/audioPlayer.js';
import { socketService } from '../services/socket.js';

export const ALL_CABINS = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' }
];

export const DEFAULT_VOICES = {
  es: 'es-ES-ElviraNeural',
  en: 'aura-orion-en',
  it: 'it-IT-ElsaNeural',
  pt: 'pt-BR-FranciscaNeural'
};

export default function HostView({
  roomId = 'MAIN',
  roomTitle = 'Conferencia Principal 2026',
  onLeave = () => {},
  localIp = '192.168.1.12',
  onOpenSettings = () => {},
  onNavigateVoices = null
}) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('es-ES');
  const [targetLanguages, setTargetLanguages] = useState(['es', 'en', 'it', 'pt']);
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [liveInterimSpeech, setLiveInterimSpeech] = useState('');
  const [roomStats, setRoomStats] = useState({ totalListeners: 0, listenersByLang: {}, attendees: [] });
  const [socketLatency, setSocketLatency] = useState(1);
  const [inspectorTab, setInspectorTab] = useState('config'); // 'config' | 'cabins' | 'qa'
  const [isVoiceCatalogOpen, setIsVoiceCatalogOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [manualText, setManualText] = useState('');
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [monitoredLang, setMonitoredLang] = useState('none');
  const [previewingLang, setPreviewingLang] = useState(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  const [isDesktopInspectorOpen, setIsDesktopInspectorOpen] = useState(true);
  const [isCabinsSheetOpen, setIsCabinsSheetOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);


  // Q&A Backchannel State
  const [qaQueue, setQaQueue] = useState([]);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [incomingQuestionAudio, setIncomingQuestionAudio] = useState(null);

  // ElevenLabs Precision Sliders State
  const [speechRate, setSpeechRate] = useState(1.0);
  const [decalageValue, setDecalageValue] = useState(50);
  const [vadSensitivity, setVadSensitivity] = useState(65);
  const [boothVolume, setBoothVolume] = useState(85);

  // Active Voices Configuration
  const [selectedVoices, setSelectedVoices] = useState(() => {
    try {
      const saved = localStorage.getItem('lv_voice_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Sanitize: ensure non-English languages never retain legacy aura-*-en voices
        Object.keys(DEFAULT_VOICES).forEach(lang => {
          if (!parsed[lang] || (lang !== 'en' && typeof parsed[lang] === 'string' && parsed[lang].startsWith('aura-'))) {
            parsed[lang] = DEFAULT_VOICES[lang];
          }
        });
        return parsed;
      }
      return DEFAULT_VOICES;
    } catch (e) {
      return DEFAULT_VOICES;
    }
  });

  const [preferredEngine, setPreferredEngine] = useState(() => {
    return localStorage.getItem('lv_preferred_engine') || 'qwen';
  });

  const [sttEngine, setSttEngine] = useState(() => {
    return localStorage.getItem('lv_stt_engine') || 'deepgram';
  });

  const [asrStatus, setAsrStatus] = useState(() => {
    return (audioRecorderService.getStreamingStatus && audioRecorderService.getStreamingStatus()) || 'idle';
  });

  const [medicalConfig, setMedicalConfig] = useState(() => {
    try {
      return {
        medicalMode: localStorage.getItem('lv_medical_mode') === 'true',
        medicalSpecialty: localStorage.getItem('lv_medical_specialty') || 'general',
        customGlossary: (localStorage.getItem('lv_custom_glossary') || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
      };
    } catch (e) {
      return { medicalMode: false, medicalSpecialty: 'general', customGlossary: [] };
    }
  });

  const meterBarRef = useRef(null);
  const meterTextRef = useRef(null);
  const lastSentSpeechRef = useRef({ text: '', time: 0 });
  const lastCumulativeSpeechRef = useRef({ text: '', time: 0 });
  const recentEmissionsHistoryRef = useRef([]);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

  const monitoredLangRef = useRef(monitoredLang);
  useEffect(() => {
    monitoredLangRef.current = monitoredLang;
  }, [monitoredLang]);

  // Synchronize microphone / STT engine language dynamically
  useEffect(() => {
    audioRecorderService.setLanguage(sourceLanguage);
  }, [sourceLanguage]);

  const handleCopyMeetingLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/?room=${roomId}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setHasCopiedLink(true);
        setTimeout(() => setHasCopiedLink(false), 2000);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    audioRecorderService.getAudioInputDevices().then((devs) => {
      if (Array.isArray(devs) && devs.length) setDevices(devs);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    socketService.connect().then(() => {
      socketService.joinAsHost(roomId);
    });

    const unsubStats = socketService.on('room_stats', (stats) => {
      if (stats) {
        setRoomStats(stats);
        if (Array.isArray(stats.qaQueue)) {
          setQaQueue(stats.qaQueue.map(q => ({
            ...q,
            questionId: q.questionId || q.attendeeId || q.socketId
          })));
        }
        if (stats.activeSpeaker !== undefined) {
          setActiveQuestion(stats.activeSpeaker);
        }
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

    const unsubLatency = socketService.on('latency', (lat) => {
      setSocketLatency(lat);
    });

    const unsubAudio = socketService.on('audio_chunk', (packet) => {
      if (packet.isHostPreview) {
        audioPlayerService.playAudioChunk(packet);
      } else if (packet.isBoothAudio) {
        // Play only the cabin that the host explicitly chose to monitor in headphones
        const activeMonitored = monitoredLangRef.current;
        if (activeMonitored && activeMonitored !== 'none' && packet.lang === activeMonitored) {
          audioPlayerService.playAudioChunk(packet);
        }
      }
    });

    // Q&A Backchannel socket handlers
    const handleIncomingQaRequest = (msg) => {
      const item = msg?.request || msg;
      if (!item) return;
      const normalized = {
        ...item,
        questionId: item.questionId || item.attendeeId || item.socketId,
        status: item.status || 'pending'
      };
      setQaQueue(prev => {
        const exists = prev.some(q => q.questionId === normalized.questionId);
        if (exists) {
          return prev.map(q => q.questionId === normalized.questionId ? { ...q, ...normalized } : q);
        }
        return [...prev, normalized];
      });
    };

    const unsubQaRequested = socketService.on('qa_question_requested', handleIncomingQaRequest);
    const unsubQaRaised = socketService.on('qa_hand_raised', handleIncomingQaRequest);

    const unsubQaSpeaker = socketService.on('qa_active_speaker', (msg) => {
      const speaker = msg?.speaker || msg;
      if (speaker) {
        const normalized = {
          ...speaker,
          questionId: speaker.questionId || speaker.attendeeId || speaker.socketId
        };
        setActiveQuestion(normalized);
        setQaQueue(prev => prev.map(q => q.questionId === normalized.questionId ? { ...q, status: 'speaking' } : q));
      }
    });

    const unsubQaClosed = socketService.on('qa_question_closed', (msg) => {
      const qId = msg?.questionId;
      setActiveQuestion(prev => (prev && (!qId || prev.questionId === qId) ? null : prev));
      if (qId) {
        setQaQueue(prev => prev.filter(q => q.questionId !== qId));
      } else {
        setQaQueue(prev => prev.filter(q => q.status !== 'speaking'));
      }
    });

    const unsubEarpiece = socketService.on('host_earpiece_audio', (data) => {
      setIncomingQuestionAudio(data);
      if (data && data.audioBase64) {
        audioPlayerService.playAudioChunk({
          audioBase64: data.audioBase64,
          mimeType: data.mimeType || 'audio/mp3',
          lang: data.lang || data.targetLang || 'es',
          isHostPreview: true
        });
      }
    });

    return () => {
      unsubStats();
      unsubTranscript();
      unsubLatency();
      unsubAudio();
      unsubQaRequested();
      unsubQaRaised();
      unsubQaSpeaker();
      unsubQaClosed();
      unsubEarpiece();
    };
  }, [roomId]);

  // Zero-Reflow GPU VAD listener
  useEffect(() => {
    const unsubAudioLevel = audioRecorderService.onAudioLevel((lvl) => {
      // lvl is 0 to 100 from audioRecorderService
      const pct = Math.min(100, Math.max(0, Math.round(lvl)));
      const norm = pct / 100;
      if (meterBarRef.current) {
        meterBarRef.current.style.transform = `scaleX(${norm})`;
      }
      if (meterTextRef.current) {
        meterTextRef.current.textContent = `${pct}%`;
      }
    });

    const unsubStreamingStatus = audioRecorderService.onStreamingStatus
      ? audioRecorderService.onStreamingStatus((status) => {
          setAsrStatus(status);
        })
      : () => {};

    return () => {
      unsubAudioLevel();
      unsubStreamingStatus();
    };
  }, []);

  const sendSpeechToEngines = (finalText) => {
    if (!finalText || !finalText.trim()) return;
    const cleanText = finalText.trim();
    const now = Date.now();

    const normalize = (s) =>
      (s || '')
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¡¿]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normEmit = normalize(cleanText);
    const normLastSent = normalize(lastSentSpeechRef.current.text || '');

    // Deduplication guard: ignore identical utterances within 4 seconds (prevent rapid duplicate loops)
    if (
      normLastSent &&
      normEmit === normLastSent &&
      now - lastSentSpeechRef.current.time < 4000
    ) {
      console.log('[HostView] 🛡️ Suppressed rapid duplicate speech emission:', cleanText);
      return;
    }

    lastSentSpeechRef.current = { text: cleanText, time: now };
    recentEmissionsHistoryRef.current.push({
      text: cleanText,
      norm: normEmit,
      time: now
    });

    setLiveInterimSpeech('');

    const sendLang = (!sourceLanguage || sourceLanguage === 'auto') ? 'auto' : sourceLanguage.slice(0, 2);

    // Transmit strictly ONE single socket event to server AI pipeline for translation and multi-booth TTS
    socketService.sendSpeechText(cleanText, sendLang, ['es', 'en', 'it', 'pt'], {
      medicalMode: medicalConfig.medicalMode,
      medicalSpecialty: medicalConfig.medicalSpecialty,
      customGlossary: medicalConfig.customGlossary
    });
  };

  const handleToggleMonitoring = async (langCode) => {
    if (langCode === 'none' || monitoredLang === langCode) {
      // Salir de la sala / Silenciar retorno
      setMonitoredLang('none');
      audioPlayerService.stopAll();
    } else {
      audioPlayerService.stopAll();
      setMonitoredLang(langCode);
      try {
        await audioPlayerService.unlockAudio(roomId, langCode);
      } catch (e) {}
    }
  };

  const handleStopMonitoring = () => {
    setMonitoredLang('none');
    audioPlayerService.stopAll();
  };

  const handleToggleBroadcast = async () => {
    if (isBroadcasting) {
      audioRecorderService.stopRecording();
      setIsBroadcasting(false);
      setLiveInterimSpeech('');
      socketService.send({ type: 'host_broadcast_state', roomId, isBroadcasting: false });
    } else {
      try {
        await audioPlayerService.unlockAudio(roomId, 'es');
        const activeStt = localStorage.getItem('lv_stt_engine') || sttEngine || 'deepgram';
        await audioRecorderService.startRecording({
          deviceId: selectedDevice === 'default' ? null : selectedDevice,
          lang: sourceLanguage,
          language: sourceLanguage,
          sttEngine: activeStt,
          medicalMode: medicalConfig.medicalMode,
          medicalSpecialty: medicalConfig.medicalSpecialty,
          customGlossary: medicalConfig.customGlossary,
          onInterimSpeech: (interim) => {
            setLiveInterimSpeech(interim);
          },
          onSpeechAudio: (audioBase64, mimeType, lang) => {
            // When Deepgram / server STT is selected, send audio to server AI pipeline
            const targetLang = (lang && lang !== 'auto') 
              ? (lang.length > 2 ? lang.slice(0, 2) : lang)
              : (sourceLanguage === 'auto' ? 'auto' : (sourceLanguage ? sourceLanguage.slice(0, 2) : 'auto'));
            socketService.sendSpeechAudio(audioBase64, mimeType, targetLang, {
              medicalMode: medicalConfig.medicalMode,
              medicalSpecialty: medicalConfig.medicalSpecialty,
              customGlossary: medicalConfig.customGlossary
            });
          },
          onSpeechText: (finalText) => {
            sendSpeechToEngines(finalText);
          }
        });
        setIsBroadcasting(true);
        socketService.send({ type: 'host_broadcast_state', roomId, isBroadcasting: true });
      } catch (err) {
        alert('No se pudo acceder al micrófono: ' + err.message);
      }
    }
  };

  const handleSendCustomText = (e) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    const textToSend = manualText.trim();
    setManualText('');
    sendSpeechToEngines(textToSend);
  };

  const handleSelectVoiceFromCatalog = (lang, voiceId) => {
    const updated = { ...selectedVoices, [lang]: voiceId };
    setSelectedVoices(updated);
    try {
      localStorage.setItem('lv_voice_config', JSON.stringify(updated));
      fetch(`/api/rooms/${roomId}/voices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceConfig: updated })
      }).catch(() => {});
    } catch (e) {}
  };

  const handlePreviewChannelVoice = async (langCode) => {
    setPreviewingLang(langCode);
    try {
      await audioPlayerService.unlockAudio(roomId, langCode);
      const sampleTexts = {
        en: 'Welcome to LiftVoice. This is a real-time neural voice preview for the English channel.',
        es: 'Bienvenidos a LiftVoice. Esta es una prueba de voz neuronal en tiempo real para el canal en español.',
        it: 'Benvenuti a LiftVoice. Questa è una prova di voce neurale in tempo reale per il canale italiano.',
        pt: 'Bem-vindos ao LiftVoice. Este é um teste de voz neural em tempo real para o canal em português.',
        fr: 'Bienvenue sur LiftVoice. Ceci est un aperçu vocal neuronal en temps réel pour le canal français.',
        de: 'Willkommen bei LiftVoice. Dies ist eine neuronale Sprachvorschau in Echtzeit für den deutschen Kanal.',
        zh: '欢迎来到 LiftVoice。这是中文频道的实时神经网络语音预览。',
        ja: 'LiftVoiceへようこそ。これは日本語チャンネルのリアルタイム音声プレビューです。',
        ar: 'مرحبًا بك في LiftVoice. هذه معاينة صوتية عصبية في الوقت الفعلي للقناة العربية.',
        ru: 'Добро пожаловать в LiftVoice. Это предварительный просмотр нейронного голоса для русского канала.',
        ko: 'LiftVoice에 오신 것을 환영합니다. 한국어 채널의 실시간 신경망 음성 미리보기입니다.',
        hi: 'LiftVoice में आपका स्वागत है। यह हिंदी चैनल के लिए रीयल-टाइम न्यूरल वॉयस पूर्वावलोकन है।'
      };
      const text = sampleTexts[langCode] || sampleTexts.en;

      let serverAudio = null;
      try {
        const res = await fetch(`/api/rooms/${roomId}/preview-voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lang: langCode,
            sampleText: text,
            voice: selectedVoices[langCode]
          })
        });
        const data = await res.json();
        if (data && data.audioBase64) {
          serverAudio = data.audioBase64;
        }
      } catch (err) {}

      await audioPlayerService.playVoicePreview({
        voiceId: selectedVoices[langCode],
        lang: langCode,
        text,
        audioBase64: serverAudio
      });
    } catch (e) {
      console.warn('Voice preview warning:', e);
    } finally {
      setTimeout(() => setPreviewingLang(null), 2500);
    }
  };

  const handleApproveQuestion = (questionId) => {
    socketService.approveQuestion(roomId, questionId);
  };

  const handleCloseQuestion = (questionId) => {
    socketService.closeQuestion(roomId, questionId);
    if (activeQuestion && activeQuestion.questionId === questionId) {
      setActiveQuestion(null);
    }
    setQaQueue(prev => prev.filter(q => q.questionId !== questionId));
  };

  const handleGenerateSummary = async () => {
    setIsSummaryModalOpen(true);
    setIsGeneratingSummary(true);
    setSummaryError(null);

    try {
      const res = await fetch(`/api/rooms/${roomId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      const summary = data.summary || (data.success ? data : null);
      if (summary) {
        setSummaryData(summary);
      } else {
        setSummaryError(data.error || 'No se pudo generar el resumen.');
      }
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleKickAttendee = (attendeeId, name) => {
    if (!attendeeId) return;
    const confirmKick = window.confirm(`¿Estás seguro de que deseas expulsar a "${name || 'este asistente'}" de la sala?`);
    if (confirmKick) {
      socketService.kickAttendee(roomId, attendeeId, name, 'Expulsado por el anfitrión');
    }
  };

  const handleUnbanAttendee = (attendeeId) => {
    if (!attendeeId) return;
    socketService.unbanAttendee(roomId, attendeeId);
  };

  const currentPrimaryVoiceName = selectedVoices.es ? (selectedVoices.es.includes('Elvira') ? 'Elvira Neural (ES)' : selectedVoices.es) : 'Elvira Neural';

  const renderNavSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full justify-between">
      <div>
        {/* Top Logo (II LiftVoice) */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1">
              <div className="w-1 h-4.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
              <div className="w-1 h-3 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
            </div>
            <span className="font-medium text-sm text-zinc-950 dark:text-white tracking-tight">
              LiftVoice
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
              Studio
            </span>
          </div>
          {isMobile && (
            <button
              onClick={() => setIsMobileNavOpen(false)}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-pointer"
              title="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Main Navigation Tools */}
        <div className="p-3 space-y-1">
          <button
            onClick={() => {
              if (isMobile) setIsMobileNavOpen(false);
              onLeave();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <span>Inicio / Salir</span>
          </button>

          <button
            onClick={() => {
              if (isMobile) setIsMobileNavOpen(false);
              if (onNavigateVoices) onNavigateVoices();
              else setIsVoiceCatalogOpen(true);
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Layers className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span>Voces</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </button>

          <div className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-950 dark:text-white bg-zinc-200/70 dark:bg-zinc-800 shadow-xs">
            <Radio className="w-4 h-4 text-zinc-950 dark:text-zinc-100" />
            <span>Studio</span>
          </div>

          <button
            onClick={() => {
              if (isMobile) setIsMobileNavOpen(false);
              handleGenerateSummary();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span>Resumen IA</span>
            </div>
            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">1-click</span>
          </button>
        </div>

        {/* Section: Fijado / Herramientas de Sala */}
        <div className="p-3 pt-3 space-y-1 border-t border-zinc-200 dark:border-zinc-800">
          <div className="px-3.5 pb-1.5 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 font-mono">
            Fijado
          </div>

          <div className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-zinc-100/70 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <Mic className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
              <span>Traducción Simultánea</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <button
            onClick={() => {
              if (isMobile) setIsMobileNavOpen(false);
              setIsQrModalOpen(true);
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <QrCode className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              <span>Proyectar QR</span>
            </div>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{roomId}</span>
          </button>

          <button
            onClick={() => {
              if (isMobile) setIsMobileNavOpen(false);
              setIsAttendeesModalOpen(true);
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              <span>Asistentes</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono font-semibold">
              {roomStats.attendees?.length || 0}
            </span>
          </button>
        </div>
      </div>

      {/* Sidebar Footer Card (Workspace style ElevenLabs) */}
      <div className="p-3.5 m-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-1 shadow-xs">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-800 dark:text-zinc-200">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Red Local
          </span>
          <span className="font-mono text-zinc-400 dark:text-zinc-500 text-[11px]">{socketLatency}ms</span>
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate font-mono">
          {localIp}:{typeof window !== 'undefined' && window.location.port ? window.location.port : '5174'}
        </p>
      </div>
    </div>
  );

  const renderInspectorContent = (isMobile = false) => (
    <div className="space-y-5">
      {/* Top Tabs: Configuración | Cabinas en Vivo | Q&A (Solo en cajón móvil; en escritorio van dentro del header) */}
      {isMobile && (
        <div className="flex items-center gap-3 sm:gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
          <button
            onClick={() => setInspectorTab('config')}
            className={`text-xs font-bold transition-all cursor-pointer relative pb-1 ${
              inspectorTab === 'config'
                ? 'text-zinc-950 dark:text-white'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>Configuración</span>
            {inspectorTab === 'config' && (
              <span className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-zinc-950 dark:bg-white rounded-full" />
            )}
          </button>

          <button
            onClick={() => setInspectorTab('cabins')}
            className={`text-xs font-medium transition-all cursor-pointer relative pb-1 flex items-center gap-1.5 ${
              inspectorTab === 'cabins'
                ? 'text-zinc-950 dark:text-white font-bold'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>Cabinas</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {inspectorTab === 'cabins' && (
              <span className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-zinc-950 dark:bg-white rounded-full" />
            )}
          </button>

          <button
            onClick={() => setInspectorTab('qa')}
            className={`text-xs font-medium transition-all cursor-pointer relative pb-1 flex items-center gap-1.5 ${
              inspectorTab === 'qa'
                ? 'text-zinc-950 dark:text-white font-bold'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <span>Q&A</span>
            {qaQueue.filter(q => q.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {qaQueue.filter(q => q.status === 'pending').length}
              </span>
            )}
            {inspectorTab === 'qa' && (
              <span className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-zinc-950 dark:bg-white rounded-full" />
            )}
          </button>
        </div>
      )}

      {/* Tab: Configuración */}
      {inspectorTab === 'config' && (
        <div className="space-y-6 text-left animate-fadeIn">
          {/* Banner Card: Neural Pipeline */}
          <div className="bg-gradient-to-br from-rose-50 via-orange-50 to-pink-50 dark:from-rose-950/30 dark:via-zinc-900 dark:to-zinc-900 border border-rose-200/70 dark:border-rose-900/40 rounded-2xl p-4 space-y-1 shadow-xs">
            <div className="text-[10px] font-mono font-medium text-rose-700 dark:text-rose-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Prueba cabinas simultáneas</span>
            </div>
            <div className="text-xs font-bold text-zinc-950 dark:text-zinc-100">
              Deepgram Aura & Qwen 3.8
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Síntesis ultra-rápida (&lt;170ms TTFB) y traducción simultánea continua sin pausas entre frases.
            </p>
          </div>

          {/* Active Voice Card */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
              Voz Activa
            </label>
            <button
              onClick={() => {
                if (isMobile) setIsMobileInspectorOpen(false);
                if (onNavigateVoices) onNavigateVoices();
                else setIsVoiceCatalogOpen(true);
              }}
              className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 flex items-center justify-between shadow-xs cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-950 dark:bg-zinc-800 text-white dark:text-zinc-100 flex items-center justify-center font-bold text-xs">
                  {currentPrimaryVoiceName.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-zinc-950 dark:text-zinc-100">{currentPrimaryVoiceName}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Deepgram Aura &bull; Resonante, Natural</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            </button>
          </div>

          {/* Translation Engine */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
              <span>Modelo de Traducción</span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded-full font-mono font-bold">Activo</span>
            </label>
            <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-0.5">
              <div className="text-xs font-bold text-zinc-950 dark:text-zinc-100">Alibaba Qwen 3.8</div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Pesos abiertos (27B) con contexto continuo de oratoria.</p>
            </div>
          </div>

          {/* ElevenLabs Style Precision Sliders */}
          <div className="space-y-5 pt-1">
            <ElevenSlider
              label="Velocidad de Locución"
              value={speechRate}
              min={0.7}
              max={1.5}
              step={0.05}
              leftLabel="Más lento"
              rightLabel="Más rápido"
              formatValue={(val) => `${val.toFixed(2)}x`}
              onChange={(v) => {
                setSpeechRate(v);
                audioPlayerService.setPlaybackRate(v);
              }}
            />

            <ElevenSlider
              label="Cadencia / Décalage"
              value={decalageValue}
              min={0}
              max={100}
              step={5}
              leftLabel="⚡ Rápido (3s)"
              rightLabel="🎙️ Ponencia (6s)"
              formatValue={(val) => (val < 40 ? 'Ágil' : 'Ponencia')}
              onChange={(v) => {
                setDecalageValue(v);
                fetch(`/api/rooms/${roomId}/decalage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ decalageMode: v < 40 ? 'quick' : 'natural' })
                }).catch(() => {});
              }}
            />

            <ElevenSlider
              label="Sensibilidad VAD / Micro"
              value={vadSensitivity}
              min={20}
              max={95}
              step={5}
              leftLabel="Baja (Ambiente ruidoso)"
              rightLabel="Alta (Habla suave)"
              formatValue={(val) => `${val}%`}
              onChange={(v) => setVadSensitivity(v)}
            />

            <ElevenSlider
              label="Volumen de Auriculares"
              value={boothVolume}
              min={0}
              max={100}
              step={5}
              leftLabel="Silencio"
              rightLabel="Máximo"
              formatValue={(val) => `${val}%`}
              onChange={(v) => {
                setBoothVolume(v);
                audioPlayerService.setMasterVolume(v / 100);
              }}
            />
          </div>

          {/* Audio Input Device Selector */}
          <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
              Dispositivo de Micrófono
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-100 transition-colors shadow-xs cursor-pointer"
            >
              <option value="default">🎙️ Micrófono Predeterminado</option>
              {devices.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Micrófono ${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Speaker Language */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
              Idioma en que Hablas
            </label>
            <select
              value={sourceLanguage}
              onChange={(e) => {
                setSourceLanguage(e.target.value);
                audioRecorderService.setLanguage(e.target.value);
              }}
              className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-100 transition-colors shadow-xs cursor-pointer"
            >
              <option value="auto">🌐 Detección Automática (Multilingüe Nova)</option>
              <option value="es-ES">🇪🇸 Español (Ponente)</option>
              <option value="en-US">🇺🇸 English (Speaker)</option>
              <option value="it-IT">🇮🇹 Italiano (Relatore)</option>
              <option value="pt-BR">🇧🇷 Português (Palestrante)</option>
            </select>
          </div>
        </div>
      )}

      {/* Tab: Cabinas en Vivo */}
      {inspectorTab === 'cabins' && (
        <div className="space-y-4 text-left animate-fadeIn">
          {/* Headphone Monitoring Controller & Salir de la sala */}
          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Retorno de Auriculares</span>
              </div>
              {monitoredLang !== 'none' ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {monitoredLang} activo
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono text-[10px] font-medium">
                  Silenciado
                </span>
              )}
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {monitoredLang !== 'none'
                ? `Monitoreando la cabina en ${monitoredLang}. Usa el botón abajo para silenciar en cualquier momento.`
                : 'Por defecto los audífonos están silenciados para no escuchar retorno ni eco mientras hablas al micrófono.'}
            </p>

            <div className="pt-0.5 flex gap-2">
              {monitoredLang !== 'none' ? (
                <button
                  onClick={handleStopMonitoring}
                  className="flex-1 py-2 px-4 rounded-full bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Salir de la sala (Silenciar)</span>
                </button>
              ) : (
                <div className="flex-1 text-[10px] text-zinc-400 dark:text-zinc-500 italic flex items-center">
                  Pulsa &quot;Escuchar&quot; en cualquier idioma para comprobar su calidad.
                </div>
              )}
              <button
                type="button"
                onClick={() => audioPlayerService.playAudioTestTone()}
                className="py-2 px-3.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 flex-shrink-0"
                title="Probar sonido de altavoz o auriculares locales"
              >
                <span>🔔 Probar</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Cabinas de Interpretación</span>
            <button
              onClick={() => window.open(`/?room=${roomId}&lang=${monitoredLang !== 'none' ? monitoredLang : 'en'}`, '_blank')}
              className="text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium flex items-center gap-1 hover:underline cursor-pointer"
              title="Abre la vista de asistente en otra ventana"
            >
              <span>Moderar como Oyente</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {ALL_CABINS.map((cab) => {
              const isMonitored = monitoredLang === cab.code;
              const voice = selectedVoices[cab.code] || DEFAULT_VOICES[cab.code] || 'Voz Neuronal';
              const isAuditioning = previewingLang === cab.code;

              return (
                <div
                  key={cab.code}
                  className={`p-3.5 rounded-2xl border transition-all space-y-2.5 shadow-xs ${
                    isMonitored
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20 ring-1 ring-emerald-200 dark:ring-emerald-800/50'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{cab.flag}</span>
                      <div>
                        <div className="text-xs font-bold text-zinc-950 dark:text-zinc-100">{cab.name}</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[120px]">{voice}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleMonitoring(cab.code)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono transition-all cursor-pointer flex items-center gap-1 ${
                          isMonitored
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                        }`}
                        title={isMonitored ? 'Hacer clic para salir de la sala (silenciar)' : `Monitorear cabina en ${cab.name}`}
                      >
                        <Headphones className="w-3 h-3" />
                        <span>{isMonitored ? 'Escuchando' : 'Escuchar'}</span>
                      </button>

                      <button
                        onClick={() => handlePreviewChannelVoice(cab.code)}
                        disabled={isAuditioning}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isAuditioning
                            ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 animate-pulse'
                            : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                        }`}
                        title="Audicionar muestra de voz"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (isMobile) setIsMobileInspectorOpen(false);
                      if (onNavigateVoices) onNavigateVoices();
                      else setIsVoiceCatalogOpen(true);
                    }}
                    className="w-full py-1.5 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                  >
                    Cambiar Voz de Cabina &rarr;
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Turnos de Preguntas Q&A (Backchannel Bi-direccional) */}
      {inspectorTab === 'qa' && (
        <div className="space-y-4 text-left animate-fadeIn">
          <div className="bg-zinc-900 dark:bg-zinc-950 text-white p-4 rounded-2xl space-y-2 border border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hand className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold">Backchannel Bi-direccional</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                {qaQueue.length} {qaQueue.length === 1 ? 'petición' : 'peticiones'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Los oyentes levantan la mano desde su móvil, hablan en su idioma nativo y el ponente escucha la traducción en tiempo real por el auricular.
            </p>
          </div>

          {activeQuestion && (
            <Banner
              icon={<Mic className="w-4 h-4 text-white animate-pulse" strokeWidth={2.4} />}
              color="#10b981"
              title={`${activeQuestion.name || 'Oyente'} está hablando`}
              subtitle={`Canal nativo: ${activeQuestion.nativeLang || 'en'} ➔ es`}
              desc={
                incomingQuestionAudio?.translatedText
                  ? `Traducción a tu oído: "${incomingQuestionAudio.translatedText}"`
                  : 'Escuchando intervención en tu auricular...'
              }
              bottomAction={
                <button
                  type="button"
                  onClick={() => handleCloseQuestion(activeQuestion.questionId)}
                  className="w-full h-9 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Finalizar Turno de Pregunta</span>
                </button>
              }
            />
          )}

          <div className="space-y-2">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
              Peticiones de palabra ({qaQueue.filter(q => q.status === 'pending').length})
            </span>

            {qaQueue.filter(q => q.status === 'pending').length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-1.5 bg-white dark:bg-zinc-900">
                <Hand className="w-5 h-5 text-zinc-300 dark:text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">No hay preguntas pendientes</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Los oyentes pueden pulsar &quot;Levantar la mano&quot; en su teléfono para pedir la palabra.</p>
              </div>
            ) : (
              qaQueue.filter(q => q.status === 'pending').map((q) => (
                <div
                  key={q.questionId}
                  className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-2.5 flex flex-col"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-800 dark:text-zinc-200">
                        {q.name ? q.name.slice(0, 2).toUpperCase() : 'Oy'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{q.name || 'Oyente'}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">Idioma nativo: {q.nativeLang || 'es'}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex-shrink-0">
                      En espera
                    </span>
                  </div>

                  {q.questionText && (
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60 text-xs text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed">
                      &ldquo;{q.questionText}&rdquo;
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleApproveQuestion(q.questionId)}
                      disabled={!!activeQuestion}
                      className="flex-1 py-1.5 px-4 rounded-full bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 text-white dark:text-zinc-950 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                      <span>Dar la palabra</span>
                    </button>
                    <button
                      onClick={() => handleCloseQuestion(q.questionId)}
                      className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title="Descartar"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (isInitializing) {
    return (
      <div className="h-dvh min-h-dvh w-full flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="w-5 h-5 border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-dvh min-h-dvh w-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans select-none transition-colors">
      
      {/* Mobile Left Drawer Backdrop & Sheet */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between shadow-2xl z-10 animate-fadeIn">
            {renderNavSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CABECERA SUPERIOR GLOBAL (DESKTOP HEADER 48px)                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="hidden lg:flex h-12 w-full border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 px-4 items-center justify-between flex-shrink-0 z-30 select-none">
        {/* Izquierda: Menú con icono de 2 líneas redondeadas y flyout de Tema */}
        <DesktopHeaderMenu
          onExit={() => onLeave({ reason: 'voluntary' })}
          hasCopiedLink={hasCopiedLink}
          onCopyLink={handleCopyMeetingLink}
          extraItems={[
            {
              label: 'Proyectar código QR',
              onClick: () => setIsQrModalOpen(true)
            },
            {
              label: 'Resumen de sesión IA',
              onClick: handleGenerateSummary
            }
          ]}
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

        {/* Derecha: Botón para alternar inspector de sala */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDesktopInspectorOpen(prev => !prev)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer border ${
              isDesktopInspectorOpen
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title="Alternar Inspector de Sala"
            aria-label="Alternar Inspector de Sala"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* CUERPO PRINCIPAL (RESPETA LA CABECERA SUPERIOR) */}
      <div className="flex-1 min-h-0 w-full flex flex-row overflow-hidden">

        {/* ───────────────────────────────────────────────────────────── */}
        {/* ZONE 1: ACTIVITY RAIL (Ultra-slim 60px, Desktop: hidden lg:flex) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex w-15 lg:w-16 h-full border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex-col items-center justify-between py-4 flex-shrink-0 select-none z-20">
        {/* Top: Brand & Nav items */}
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Brand Glyph */}
          <button
            type="button"
            onClick={() => onLeave({ reason: 'voluntary' })}
            className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs shadow-xs hover:scale-105 transition-all cursor-pointer"
            title="LiftVoice Studio - Volver al Inicio"
          >
            LV
          </button>

          {/* Micro-nav icons */}
          <div className="flex flex-col items-center gap-4 w-full">
            <button
              type="button"
              className="flex flex-col items-center gap-1 w-full py-1.5 text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"
              title="Estudio de emisión"
            >
              <div className="relative">
                <Radio className="w-5 h-5" />
                {isBroadcasting && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              </div>
              <span className="text-[10px] font-medium tracking-tight">Emisión</span>
            </button>

            <button
              type="button"
              onClick={() => (onNavigateVoices ? onNavigateVoices() : setIsVoiceCatalogOpen(true))}
              className="flex flex-col items-center gap-1 w-full py-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              title="Catálogo de voces neuronales"
            >
              <Layers className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">Voces</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateSummary}
              className="flex flex-col items-center gap-1 w-full py-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              title="Generar resumen de sesión IA"
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">Resumen</span>
            </button>
          </div>
        </div>

        {/* Bottom: QR, Attendees, Settings, Home */}
        <div className="flex flex-col items-center gap-3.5 w-full">
          <button
            type="button"
            onClick={() => setIsQrModalOpen(true)}
            className="w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            title="Proyectar código QR para la sala"
          >
            <QrCode className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsAttendeesModalOpen(true)}
            className="relative w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            title="Asistentes conectados"
          >
            <Users className="w-4 h-4" />
            {(roomStats.attendees?.length || 0) > 0 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-4 h-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[9px] font-mono font-bold flex items-center justify-center">
                {roomStats.attendees.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            title="Configuración avanzada"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onLeave({ reason: 'voluntary' })}
            className="w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            title="Salir del estudio"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ZONE 2: LEFT HOST CONFIGURATION & CONTROL PANEL (Desktop)     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-80 h-full border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex-col flex-shrink-0 select-none overflow-hidden">
        {/* Header: Title */}
        <div className="h-14 px-5 flex items-center justify-between bg-white dark:bg-zinc-950 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span>Estudio de Emisión</span>
            </h2>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
              Traducción simultánea impulsada por IA
            </p>
          </div>
        </div>

        {/* Línea divisoria con margen horizontal en X (no abarca el ancho completo) */}
        <div className="mx-5 border-b border-zinc-200 dark:border-zinc-800/80 flex-shrink-0" />

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5 flex flex-col justify-between">
          <div className="space-y-5">

          {/* Configuración Section */}
          <div className="space-y-4">
            <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 font-mono tracking-wider uppercase">
              Configuración de Entrada
            </div>

            {/* Mic Device selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                Dispositivo de Micrófono
              </label>
              <div className="relative">
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none appearance-none cursor-pointer shadow-2xs"
                >
                  <option value="default">🎙️ Micrófono Predeterminado</option>
                  {devices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Micrófono ${i + 1}`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Speaker Language */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                Idioma del Ponente
              </label>
              <div className="relative">
                <select
                  value={sourceLanguage}
                  onChange={(e) => {
                    setSourceLanguage(e.target.value);
                    audioRecorderService.setLanguage(e.target.value);
                  }}
                  className="w-full h-10 px-3 pr-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none appearance-none cursor-pointer shadow-2xs"
                >
                  <option value="es-ES">🇪🇸 Español (Ponente)</option>
                  <option value="en-US">🇺🇸 English (Speaker)</option>
                  <option value="it-IT">🇮🇹 Italiano (Relatore)</option>
                  <option value="pt-BR">🇧🇷 Português (Palestrante)</option>
                  <option value="auto">🌐 Detección Automática</option>
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Active Cabins Display */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Cabinas de Traducción
                </label>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">4 en directo</span>
              </div>
              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2 shadow-2xs">
                <div className="grid grid-cols-4 gap-1.5">
                  {ALL_CABINS.map(cab => (
                    <div
                      key={cab.code}
                      className="h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center gap-1 text-xs"
                      title={`Cabina ${cab.name}`}
                    >
                      <span>{cab.flag}</span>
                      <span className="font-mono text-[10px] font-bold text-zinc-800 dark:text-zinc-200 uppercase">{cab.code}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons: QR & Attendees */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <QrCode className="w-3.5 h-3.5 text-zinc-500" />
                <span>Proyectar QR</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAttendeesModalOpen(true)}
                className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span>Asistentes ({roomStats.attendees?.length || 0})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section: Estado de Emisión + Primary Broadcast Button */}
        <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 font-mono tracking-wider uppercase">
            Estado de Emisión
          </div>

          {/* VAD Level Meter Card */}
          <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">Señal Micrófono</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-400">{socketLatency}ms</span>
                <span ref={meterTextRef} className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100 tabular-numbers">0%</span>
              </div>
            </div>
            <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                ref={meterBarRef}
                className="h-full w-full bg-emerald-500 rounded-full origin-left will-change-transform"
                style={{ transform: 'scaleX(0)', transition: 'transform 0.05s linear' }}
              />
            </div>
          </div>

          {/* Master Primary Broadcast Button */}
          <div className="relative">
            {isBroadcasting && (
              <div className="absolute -inset-1 rounded-xl gemini-aura-glow opacity-60 pointer-events-none" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={handleToggleBroadcast}
              className={`relative w-full h-12 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs active:scale-[0.99] z-10 ${
                isBroadcasting
                  ? 'gemini-gradient-bg text-white border border-white/20'
                  : 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200'
              }`}
            >
              {isBroadcasting ? (
                <>
                  <div className="flex items-center gap-0.5 h-3.5">
                    <span className="w-1 h-2 rounded-full bg-white animate-gemini-wave" />
                    <span className="w-1 h-3.5 rounded-full bg-white animate-gemini-wave delay-1" />
                    <span className="w-1 h-2 rounded-full bg-white animate-gemini-wave delay-2" />
                  </div>
                  <span>Detener Emisión en Directo</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Iniciar Emisión en Directo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CONTENIDO PRINCIPAL: TOP BAR + 2 COLUMNAS (STAGE + INSPECTOR) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-zinc-950">
        
        {/* Top Header Bar — En móvil integra la Dynamic Island; en Desktop queda oculto para privilegiar la distribución de 4 zonas */}
        <header className="lg:hidden h-[calc(3.25rem+env(safe-area-inset-top,0px))] pt-safe border-b border-zinc-200 dark:border-zinc-800 px-3 sm:px-6 flex items-center justify-between bg-white dark:bg-zinc-900 flex-shrink-0 z-30">
          {/* Left: Hamburger (mobile) + Desktop Studio Indicator */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Solo en Desktop (sm+): Nombre del estudio y código de sala */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <Radio className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Estudio de Emisión</span>
            </div>
            <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">•</span>
            
            <button
              onClick={handleCopyMeetingLink}
              title="Copiar vínculo de la reunión para asistentes"
              className="hidden sm:inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 px-2 sm:px-2.5 py-1 rounded-md transition-all cursor-pointer shadow-2xs"
            >
              <span>{roomId}</span>
              {hasCopiedLink ? (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-medium flex items-center gap-0.5">
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Copiado</span>
                </span>
              ) : (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 font-sans font-normal hidden sm:inline">
                  Copiar
                </span>
              )}
            </button>
            <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">•</span>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isBroadcasting ? 'bg-red-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
              <span className="text-[10px] sm:text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 truncate max-w-[85px] sm:max-w-none">
                {isBroadcasting ? 'En directo' : 'En pausa'}
              </span>
            </div>

            {isBroadcasting && (
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded-full font-mono text-[9px] sm:text-[10px] font-semibold ${
                  asrStatus === 'listening'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                    : asrStatus === 'connecting' || asrStatus === 'reconnecting'
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 animate-pulse'
                    : asrStatus === 'degraded'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    asrStatus === 'listening' ? 'bg-emerald-500' :
                    asrStatus === 'degraded' ? 'bg-rose-500' : 'bg-amber-500'
                  }`} />
                  <span className="hidden sm:inline">ASR: </span>
                  <span>{asrStatus === 'listening' ? 'Nova-3 ⚡' : asrStatus}</span>
                </span>
              </div>
            )}
          </div>

          {/* Center (Mobile Only): Cápsula elegante de código de sala en una sola línea sin saltos */}
          <div className="sm:hidden flex items-center justify-center flex-1 min-w-0 px-1.5">
            <button
              type="button"
              onClick={handleCopyMeetingLink}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 transition-all cursor-pointer truncate shadow-2xs active:scale-95"
              title="Toca para copiar enlace de la sala"
              aria-label={`Sala ${roomId}. Toca para copiar enlace`}
            >
              <span className="truncate max-w-[130px]">{roomId}</span>
              {hasCopiedLink ? (
                <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
              )}
            </button>
          </div>

          {/* Right Links & Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            {/* Q&A mobile alert button if pending questions */}
            {qaQueue.filter(q => q.status === 'pending').length > 0 && (
              <button
                onClick={() => {
                  setInspectorTab('qa');
                  setIsMobileInspectorOpen(true);
                }}
                className="xl:hidden h-8 px-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 animate-pulse shadow-xs cursor-pointer flex-shrink-0"
                title="Peticiones de palabra en espera"
              >
                <Hand className="w-3.5 h-3.5" />
                <span>{qaQueue.filter(q => q.status === 'pending').length}</span>
              </button>
            )}

            {/* STT engine badge (desktop only) */}
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="hidden md:flex h-8 px-3 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-medium items-center gap-1.5 transition-colors cursor-pointer shadow-2xs flex-shrink-0"
              title="Haz clic para cambiar el transcriptor o las voces"
            >
              <Mic className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>STT: <strong className="text-zinc-950 dark:white font-semibold">{sttEngine === 'deepgram' ? 'Deepgram ⚡' : sttEngine === 'webspeech' ? 'Web Speech 🌐' : 'Whisper 🤖'}</strong></span>
            </button>

            {/* QR button */}
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="h-8 sm:h-9 px-2.5 sm:px-4 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors flex-shrink-0"
              title="Proyectar código QR para la audiencia"
            >
              <QrCode className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 flex-shrink-0" />
              <span className="hidden sm:inline">Proyectar QR</span>
            </button>

            {/* User Avatar */}
            <div className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center text-[10px] sm:text-xs font-bold font-mono flex-shrink-0">
              LV
            </div>
          </div>
        </header>

        {/* Floating Q&A Interactive Alert */}
        <QABannerAlert
          pendingQuestions={qaQueue.filter(q => q.status === 'pending')}
          activeQuestion={activeQuestion}
          incomingQuestionAudio={incomingQuestionAudio}
          onApprove={handleApproveQuestion}
          onCloseQuestion={handleCloseQuestion}
        />

        {/* 2-Column Body: Center Stage + Right Inspector */}
        <div className="flex-1 flex flex-row overflow-hidden bg-white dark:bg-zinc-950">
          
          {/* ───────────────────────────────────────────────────────── */}
          {/* COLUMNA 2: STUDIO STAGE (AMPLIO, LIMPIO, ELEVENLABS)       */}
          {/* ───────────────────────────────────────────────────────── */}
          <main className="flex-1 flex flex-col px-0 sm:px-6 lg:px-8 py-2 sm:py-4 pb-24 sm:pb-6 overflow-hidden bg-white dark:bg-zinc-950 min-w-0 h-full">
            <div className="w-full max-w-4xl mx-auto space-y-2 sm:space-y-3 flex-1 flex flex-col min-h-0">
              
              {/* Stage Top Bar: En móvil limpio y de una sola línea sin desbordes horizontales */}
              <div className="flex items-center justify-between gap-2 px-3 sm:px-0 pb-2 sm:pb-3 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                <div className="min-w-0">
                  <div className="hidden sm:flex items-center gap-2">
                    <h1 className="text-lg sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight truncate max-w-[240px] sm:max-w-md">
                      {roomTitle}
                    </h1>
                    <button
                      onClick={handleCopyMeetingLink}
                      className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors p-1 cursor-pointer"
                      title="Copiar vínculo de la sala"
                    >
                      {hasCopiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  
                  {/* Vista móvil: una sola línea concisa con indicador */}
                  <div className="sm:hidden flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span><strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{roomStats.totalListeners}</strong> oyentes · 4 idiomas</span>
                  </div>

                  {/* Vista desktop: texto completo descriptivo */}
                  <p className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">{roomStats.totalListeners}</span> oyente{roomStats.totalListeners === 1 ? '' : 's'} conectados en los 4 idiomas de audio
                  </p>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  {activeQuestion ? (
                    <div className="h-7.5 sm:h-9 px-2.5 sm:px-3 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span className="truncate max-w-[100px] sm:max-w-[120px]">Q&A: {activeQuestion.name}</span>
                      <button
                        onClick={() => handleCloseQuestion(activeQuestion.questionId)}
                        className="ml-1 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold cursor-pointer"
                      >
                        Cerrar
                      </button>
                    </div>
                  ) : qaQueue.some(q => q.status === 'pending') ? (
                    <button
                      onClick={() => {
                        setInspectorTab('qa');
                        setIsMobileInspectorOpen(true);
                      }}
                      className="h-7.5 sm:h-9 px-2.5 sm:px-3 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 shadow-sm animate-pulse flex-shrink-0 cursor-pointer"
                    >
                      <Hand className="w-3.5 h-3.5" />
                      <span>{qaQueue.filter(q => q.status === 'pending').length} Q&A</span>
                    </button>
                  ) : null}

                  <button
                    onClick={() => window.open(`/?room=${roomId}&lang=${monitoredLang !== 'none' ? monitoredLang : 'en'}`, '_blank')}
                    className="hidden sm:flex h-7.5 sm:h-9 px-3 sm:px-4 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[11px] sm:text-xs font-medium text-zinc-700 dark:text-zinc-300 items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
                    title="Abre la cabina en una pestaña nueva como oyente"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>Moderar</span>
                  </button>

                  <button
                    onClick={handleGenerateSummary}
                    className="h-7.5 sm:h-9 px-2.5 sm:px-3.5 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[11px] sm:text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400 flex-shrink-0" />
                    <span>Resumen</span>
                  </button>

                  <button
                    onClick={() => (onNavigateVoices ? onNavigateVoices() : setIsVoiceCatalogOpen(true))}
                    className="h-7.5 sm:h-9 px-2.5 sm:px-3.5 rounded-full bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
                  >
                    <Layers className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Voces</span>
                  </button>
                </div>
              </div>

              {/* Main Subtitles Stream Canvas — 100% Full Area (Sin contenedor artificial ni recortes) */}
              <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">
                <LiveCaptions
                  transcriptHistory={transcriptHistory}
                  interimText={liveInterimSpeech}
                  currentLanguage={sourceLanguage.slice(0, 2)}
                  showOriginal={true}
                  medicalMode={medicalConfig.medicalMode}
                  className="flex-1 flex flex-col h-full min-h-0 w-full"
                  maxHeightClass="flex-1 h-full min-h-0"
                />
              </div>

              {/* ElevenLabs Interactive Prompt Station & Broadcast Controls (SOLO ESCRITORIO — En móvil actúa MasterBroadcastDock) */}
              <div className="hidden lg:block space-y-3 pt-1 flex-shrink-0">
                {/* Master Studio Broadcast & Input Dock */}
                <div className="p-3 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    
                    {/* Large Studio Broadcast Pill Button */}
                    <div className="relative inline-flex w-full sm:w-auto">
                      {isBroadcasting && (
                        <div className="absolute -inset-2 rounded-xl sm:rounded-full gemini-aura-glow opacity-65 pointer-events-none" aria-hidden="true" />
                      )}
                      <button
                        onClick={handleToggleBroadcast}
                        className={`relative w-full sm:w-auto h-12 sm:h-11 px-6 rounded-xl sm:rounded-full flex items-center justify-center gap-2.5 transition-all cursor-pointer font-semibold text-xs sm:text-xs shadow-xs active:scale-[0.99] ${
                          isBroadcasting
                            ? 'gemini-gradient-bg text-white border border-white/20'
                            : 'bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950'
                        }`}
                      >
                        {isBroadcasting ? (
                          <>
                            <div className="flex items-center gap-0.5 h-3.5 relative z-10">
                              <span className="w-1 h-2 rounded-full bg-white animate-gemini-wave" />
                              <span className="w-1 h-3.5 rounded-full bg-white animate-gemini-wave delay-1" />
                              <span className="w-1 h-2 rounded-full bg-white animate-gemini-wave delay-2" />
                            </div>
                            <span className="relative z-10">Detener Transmisión en Directo</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-4 h-4" />
                            <span>Iniciar Emisión en Directo</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Zero-Reflow GPU VAD Meter */}
                    <div className="w-full sm:w-44 p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 space-y-1 shadow-xs">
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                          <Activity className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Señal VAD
                        </span>
                        <span ref={meterTextRef} className="font-bold text-zinc-900 dark:text-zinc-100 tabular-numbers">0%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          ref={meterBarRef}
                          className="h-full w-full bg-emerald-500 rounded-full origin-left will-change-transform"
                          style={{ transform: 'scaleX(0)', transition: 'transform 0.05s linear' }}
                        />
                      </div>
                    </div>

                  </div>

                  {/* Direct Text Prompt Input Bar */}
                  <form onSubmit={handleSendCustomText} className="flex gap-2">
                    <input
                      type="text"
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="O escribe cualquier frase aquí para emitir..."
                      className="flex-1 h-9 sm:h-10 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 sm:px-4 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-100 transition-colors shadow-xs"
                    />
                    <button
                      type="submit"
                      disabled={!manualText.trim()}
                      className="h-9 sm:h-10 px-4 sm:px-5 rounded-xl bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-medium text-xs whitespace-nowrap cursor-pointer transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-xs active:scale-95"
                    >
                      <span>Emitir</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>

                  {/* Direct Earphone Booth Monitor Bar (Studio Audio Return) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-zinc-200/70 dark:border-zinc-800 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Headphones className={`w-3.5 h-3.5 ${monitoredLang !== 'none' ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' : 'text-zinc-400 dark:text-zinc-500'}`} />
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 text-[11px]">
                          Retorno Auriculares:
                        </span>
                        {monitoredLang !== 'none' ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 text-[10px] font-mono font-medium">
                            {monitoredLang} activo
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Silenciado</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await audioPlayerService.playAudioTestTone();
                          } catch (e) {
                            console.error('[HostView] Error playing test tone:', e);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 transition-colors cursor-pointer flex items-center gap-1 flex-shrink-0"
                        title="Probar sonido de altavoz o auriculares locales"
                      >
                        <span>🔔 Probar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleMonitoring('none')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer flex-shrink-0 ${
                          monitoredLang === 'none'
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                            : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                      >
                        Silencio
                      </button>
                      {ALL_CABINS.map(cab => (
                        <button
                          key={cab.code}
                          type="button"
                          onClick={() => handleToggleMonitoring(cab.code)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 flex-shrink-0 ${
                            monitoredLang === cab.code
                              ? 'bg-emerald-600 text-white font-semibold shadow-xs ring-1 ring-emerald-500'
                              : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                          }`}
                          title={`Escuchar retorno en directo para ${cab.name}`}
                        >
                          <span>{cab.flag}</span>
                          <span>{cab.code}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </main>

          {/* ───────────────────────────────────────────────────────── */}
          {/* ZONE 4: PANEL DE INSPECCIÓN (Desktop: hidden lg:flex)      */}
          {/* ───────────────────────────────────────────────────────── */}
          {isDesktopInspectorOpen && (
            <aside className="hidden lg:flex w-88 h-full border-l border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex-shrink-0 flex-col overflow-hidden animate-fadeIn select-none">
              {/* Header: Title + Subtitle + Menú de pestañas dentro del Header */}
              <div className="px-5 pt-3.5 pb-2.5 flex flex-col gap-3 bg-white dark:bg-zinc-950 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                      Inspector de Sala
                    </h2>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                      Control acústico, cabinas y audiencia
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDesktopInspectorOpen(false)}
                    className="w-7 h-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                    title="Cerrar panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Menú de pestañas dentro del header (estilo exacto app-salud / Tabs.tsx) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setInspectorTab('config')}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0 cursor-pointer ${
                      inspectorTab === 'config'
                        ? 'text-zinc-950 dark:text-zinc-100 bg-zinc-100 dark:bg-white/10 shadow-2xs'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                    }`}
                  >
                    Configuración
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab('cabins')}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      inspectorTab === 'cabins'
                        ? 'text-zinc-950 dark:text-zinc-100 bg-zinc-100 dark:bg-white/10 shadow-2xs'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                    }`}
                  >
                    <span>Cabinas</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab('qa')}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      inspectorTab === 'qa'
                        ? 'text-zinc-950 dark:text-zinc-100 bg-zinc-100 dark:bg-white/10 shadow-2xs'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                    }`}
                  >
                    <span>Q&A</span>
                    {qaQueue.filter(q => q.status === 'pending').length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                        {qaQueue.filter(q => q.status === 'pending').length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pt-2.5 pb-5 space-y-5">
                {renderInspectorContent(false)}
              </div>
            </aside>
          )}

          {/* Mobile Right Drawer for Inspector & Cabinas */}
          {isMobileInspectorOpen && (
            <div className="fixed inset-0 z-50 xl:hidden flex justify-end">
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
                onClick={() => setIsMobileInspectorOpen(false)}
              />
              <aside className="relative w-full sm:w-96 max-w-[92vw] h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col p-5 space-y-5 overflow-y-auto shadow-2xl z-10 animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Controles & cabinas
                    </span>
                  </div>
                  <button
                    onClick={() => setIsMobileInspectorOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-pointer"
                    title="Cerrar panel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {renderInspectorContent(true)}
              </aside>
            </div>
          )}

        </div>

      </div>
      </div>

      {/* Mobile Master Broadcast Dock (Fixed Thumb Zone) */}
      <div className="lg:hidden">
        <MasterBroadcastDock
          isBroadcasting={isBroadcasting}
          onToggleBroadcast={handleToggleBroadcast}
          monitoredLang={monitoredLang}
          onToggleMonitoring={handleToggleMonitoring}
          onOpenCabinsSheet={() => setIsCabinsSheetOpen(true)}
          audioRecorderService={audioRecorderService}
          pendingQACount={qaQueue.filter(q => q.status === 'pending').length}
        />
      </div>

      {/* Mobile Cabins Bottom Sheet */}
      <CabinsBottomSheet
        isOpen={isCabinsSheetOpen}
        onClose={() => setIsCabinsSheetOpen(false)}
        cabins={ALL_CABINS}
        selectedVoices={selectedVoices}
        monitoredLang={monitoredLang}
        previewingLang={previewingLang}
        onToggleMonitoring={handleToggleMonitoring}
        onStopMonitoring={handleStopMonitoring}
        onPreviewVoice={handlePreviewChannelVoice}
        onTestAudio={() => audioPlayerService.playAudioTestTone()}
        decalageValue={decalageValue}
        onDecalageChange={setDecalageValue}
        boothVolume={boothVolume}
        onVolumeChange={setBoothVolume}
      />

      {/* Global Modals */}
      <VoiceCatalogModal
        isOpen={isVoiceCatalogOpen}
        onClose={() => setIsVoiceCatalogOpen(false)}
        selectedVoices={selectedVoices}
        onSelectVoice={handleSelectVoiceFromCatalog}
        roomId={roomId}
      />

      <QRCodeModal
        roomId={roomId}
        roomTitle={roomTitle}
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        localIp={localIp}
      />

      <AttendeesModal
        roomId={roomId}
        isOpen={isAttendeesModalOpen}
        onClose={() => setIsAttendeesModalOpen(false)}
        attendees={roomStats.attendees || []}
        onKickAttendee={handleKickAttendee}
        onUnbanAttendee={handleUnbanAttendee}
      />

      <SessionSummaryModal
        roomId={roomId}
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summaryData={summaryData}
        isLoading={isGeneratingSummary}
        error={summaryError}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        roomId={roomId}
        onSaveConfig={(cfg) => {
          if (cfg.sttEngine) setSttEngine(cfg.sttEngine);
          if (cfg.voiceConfig) setSelectedVoices(cfg.voiceConfig);
          if (cfg.preferredEngine) setPreferredEngine(cfg.preferredEngine);
        }}
      />

    </div>
  );
}
