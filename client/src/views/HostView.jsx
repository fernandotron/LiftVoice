import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Radio, Settings, Volume2, Sparkles, AudioLines, Sliders,
  RefreshCw, Check, Globe, ChevronRight, Activity, Users, QrCode, Play, Square,
  Send, Layers, ArrowRight, ArrowLeft, ArrowUp, Type, Shield, Download, FileText, Stethoscope, Home,
  Search, ExternalLink, Headphones, Hand, HelpCircle, CheckCircle2, XCircle, MessageSquare,
  Menu, X, SlidersHorizontal, Copy, ChevronDown, PanelRight, Zap, Bell, Loader2
} from 'lucide-react';
import CountryFlag from '../components/shared/CountryFlag.jsx';
import LiveCaptions from '../components/LiveCaptions.jsx';
import ElevenSlider from '../components/ElevenSlider.jsx';
import ErrorBoundary from '../components/shared/ErrorBoundary.jsx';
import QRCodeModal from '../components/QRCodeModal.jsx';
import AttendeesModal from '../components/AttendeesModal.jsx';
import SessionSummaryModal from '../components/SessionSummaryModal.jsx';
import MasterBroadcastDock from '../components/mobile/MasterBroadcastDock.jsx';
import CabinsBottomSheet from '../components/mobile/CabinsBottomSheet.jsx';
import QABottomSheet from '../components/mobile/QABottomSheet.jsx';
import AttendeesBottomSheet from '../components/mobile/AttendeesBottomSheet.jsx';
import StudioSettingsBottomSheet from '../components/mobile/StudioSettingsBottomSheet.jsx';
import QABannerAlert from '../components/mobile/QABannerAlert.jsx';
import MobileHeaderMenu from '../components/mobile/MobileHeaderMenu.jsx';
import Banner from '../components/shared/Banner.jsx';
import DesktopHeaderMenu from '../components/shared/DesktopHeaderMenu.jsx';
import StudioSidebar from '../components/shared/StudioSidebar.jsx';
import SidebarVoiceCatalog from '../components/sidebar/SidebarVoiceCatalog.jsx';
import SidebarSessionSummary from '../components/sidebar/SidebarSessionSummary.jsx';
import SelectDropdown from '../components/shared/SelectDropdown.jsx';
import UserMenu from '../components/shared/UserMenu.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { audioRecorderService } from '../services/audioRecorder.js';
import { audioPlayerService } from '../services/audioPlayer.js';
import { socketService } from '../services/socket.js';
import { usePermissions, ROLES } from '../hooks/usePermissions.js';
import { adminAuthService } from '../services/adminAuthService.js';

export const ALL_CABINS = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' }
];

export const DEFAULT_VOICES = {
  es: 'es-ES-ElviraNeural',
  en: 'aura-2-thalia-en',
  it: 'it-IT-ElsaNeural',
  pt: 'pt-BR-FranciscaNeural'
};

export const DEFAULT_GENDERS = {
  es: 'female',
  en: 'female',
  it: 'female',
  pt: 'female'
};

export const SPEAKER_LANGUAGES = [
  { code: 'es', langCode: 'es-ES', label: 'Español (Ponente)', nativeName: 'Español', voice: 'Voz del ponente' },
  { code: 'en', langCode: 'en-US', label: 'English (Speaker)', nativeName: 'English', voice: 'Speaker voice' },
  { code: 'it', langCode: 'it-IT', label: 'Italiano (Relatore)', nativeName: 'Italiano', voice: 'Voce del relatore' },
  { code: 'pt', langCode: 'pt-BR', label: 'Português (Palestrante)', nativeName: 'Português', voice: 'Voz do palestrante' },
  { code: 'auto', langCode: 'auto', label: 'Detección Automática', nativeName: 'Automático', voice: 'Detección automática' }
];


export default function HostView({
  roomId = 'MAIN',
  roomTitle = 'Conferencia Principal',
  onLeave = () => {},
  localIp = '192.168.1.12',
  onOpenSettings = () => {}
}) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isTogglingBroadcast, setIsTogglingBroadcast] = useState(false);
  const isTogglingRef = useRef(false);
  const toggleCooldownTimerRef = useRef(null);
  const [broadcastError, setBroadcastError] = useState(null);

  // Admin Verification & Real-time Diagnostic Telemetry (Default Deny)
  const { role } = usePermissions();
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [activeSttInfo, setActiveSttInfo] = useState(() => {
    return audioRecorderService.getActiveSttInfo ? audioRecorderService.getActiveSttInfo() : null;
  });
  const [activeTelemetry, setActiveTelemetry] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (role === ROLES.ADMIN_MASTER || adminAuthService.getToken()) {
      adminAuthService.verify().then(valid => {
        if (isMounted) setIsAdminVerified(valid);
      });
    } else {
      setIsAdminVerified(false);
    }
    return () => { isMounted = false; };
  }, [role]);

  useEffect(() => {
    if (!audioRecorderService.onSttInfoChange) return;
    const unsub = audioRecorderService.onSttInfoChange((info) => {
      setActiveSttInfo(info);
    });
    setActiveSttInfo(audioRecorderService.getActiveSttInfo?.() || null);
    return () => unsub();
  }, []);
  const [sourceLanguage, setSourceLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem('lv_stt_lang');
      if (saved && saved !== 'auto') return saved;
      return 'es-ES';
    } catch (e) {
      return 'es-ES';
    }
  });
  const lastExplicitSpeakerLangRef = useRef((() => {
    try {
      const saved = localStorage.getItem('lv_stt_lang');
      if (saved && saved !== 'auto') return saved;
    } catch (e) {}
    return 'es-ES';
  })());
  const sourceLanguageRef = useRef(sourceLanguage);
  useEffect(() => {
    sourceLanguageRef.current = sourceLanguage;
    if (sourceLanguage && sourceLanguage !== 'auto') {
      lastExplicitSpeakerLangRef.current = sourceLanguage;
    }
    try {
      localStorage.setItem('lv_stt_lang', sourceLanguage);
    } catch (e) {}
  }, [sourceLanguage]);

  const isBroadcastingRef = useRef(isBroadcasting);
  useEffect(() => {
    isBroadcastingRef.current = isBroadcasting;
  }, [isBroadcasting]);

  useEffect(() => {
    return () => {
      if (toggleCooldownTimerRef.current) {
        clearTimeout(toggleCooldownTimerRef.current);
      }
    };
  }, []);

  const isSwitchingDeviceRef = useRef(false);
  const hasServerKeysRef = useRef(false);
  const serverConfigPromiseRef = useRef(null);
  const [targetLanguages, setTargetLanguages] = useState(['es', 'en', 'it', 'pt']);
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [liveInterimSpeech, setLiveInterimSpeech] = useState('');
  const [roomStats, setRoomStats] = useState({ totalListeners: 0, listenersByLang: {}, attendees: [] });
  const [socketLatency, setSocketLatency] = useState(1);
  const [inspectorTab, setInspectorTab] = useState('cabins'); // 'cabins' | 'qa' | 'room'
  const [captionSize, setCaptionSize] = useState('md'); // 'sm' | 'md' | 'lg' | 'xl'
  const [selectedCatalogLang, setSelectedCatalogLang] = useState('all');
  const [catalogNavNonce, setCatalogNavNonce] = useState(0);
  const [voiceToast, setVoiceToast] = useState(null);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [manualText, setManualText] = useState('');
  const promptTextareaRef = useRef(null);

  const adjustPromptHeight = useCallback((element) => {
    const textarea = element || promptTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 40), 160);
    textarea.style.height = `${nextHeight}px`;
  }, []);

  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [monitoredLang, setMonitoredLang] = useState('none');
  const [previewingLang, setPreviewingLang] = useState(null);
  const previewAbortRef = useRef(null);
  const [isDesktopInspectorOpen, setIsDesktopInspectorOpen] = useState(true);
  const [isCabinsSheetOpen, setIsCabinsSheetOpen] = useState(false);
  const [isQASheetOpen, setIsQASheetOpen] = useState(false);
  const [isAttendeesSheetOpen, setIsAttendeesSheetOpen] = useState(false);
  const [isStudioSettingsOpen, setIsStudioSettingsOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [participantSearch, setParticipantSearch] = useState('');
  const [broadcastSeconds, setBroadcastSeconds] = useState(0);

  // User Menu State & Ref
  const [isHostUserMenuOpen, setIsHostUserMenuOpen] = useState(false);
  const hostUserMenuTriggerRef = useRef(null);

  // Custom Dropdown State & Refs for Mic and Speaker Language
  const [isMicMenuOpen, setIsMicMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const micMenuRef = useRef(null);
  const langMenuRef = useRef(null);

  // Close custom dropdowns on outside click or Escape
  useEffect(() => {
    if (!isMicMenuOpen && !isLangMenuOpen) return;
    const handleClickOutside = (e) => {
      if (micMenuRef.current && !micMenuRef.current.contains(e.target)) {
        setIsMicMenuOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
        setIsLangMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMicMenuOpen(false);
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMicMenuOpen, isLangMenuOpen]);

  const activeMicLabel = selectedDevice === 'default'
    ? 'Micrófono Predeterminado'
    : (devices.find(d => d.deviceId === selectedDevice)?.label || 'Micrófono Externo');

  const isGenericRoomTitle = !roomTitle ||
    roomTitle.toLowerCase() === `sala ${roomId.toLowerCase()}` ||
    roomTitle.toLowerCase() === roomId.toLowerCase() ||
    roomTitle === 'Conferencia Principal' ||
    roomTitle === 'Conferencia Principal 2026';
  const stageTitle = isGenericRoomTitle ? 'Transcripción en Directo' : roomTitle;

  const rawParticipants = roomStats.attendees || [];
  const effectiveTotalListeners = Math.max(
    Number(roomStats.totalListeners) || 0,
    rawParticipants.filter(a => !a.isHost && a.isOnline !== false).length
  );

  useEffect(() => {
    let timer = null;
    if (isBroadcasting) {
      timer = setInterval(() => {
        setBroadcastSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setBroadcastSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isBroadcasting]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Q&A Backchannel State
  const [qaQueue, setQaQueue] = useState([]);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [incomingQuestionAudio, setIncomingQuestionAudio] = useState(null);

  // ElevenLabs Precision Sliders State
  const [speechRate, setSpeechRate] = useState(1.0);
  const [decalageValue, setDecalageValue] = useState(50);
  const [boothVolume, setBoothVolume] = useState(85);

  // Active Voices Configuration
  const [selectedVoices, setSelectedVoices] = useState(() => {
    try {
      const saved = localStorage.getItem('lv_voice_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // Sanitize: ensure non-English languages never retain legacy aura-*-en voices
          Object.keys(DEFAULT_VOICES).forEach(lang => {
            if (!parsed[lang] || (lang !== 'en' && typeof parsed[lang] === 'string' && parsed[lang].startsWith('aura-'))) {
              parsed[lang] = DEFAULT_VOICES[lang];
            }
          });
          return parsed;
        }
      }
      return DEFAULT_VOICES;
    } catch (e) {
      return DEFAULT_VOICES;
    }
  });

  const [voiceGender, setVoiceGender] = useState(() => {
    try {
      const saved = localStorage.getItem('lv_voice_gender');
      return saved ? { ...DEFAULT_GENDERS, ...JSON.parse(saved) } : DEFAULT_GENDERS;
    } catch (e) {
      return DEFAULT_GENDERS;
    }
  });

  const [preferredEngine, setPreferredEngine] = useState(() => {
    return localStorage.getItem('lv_preferred_engine') || 'gemini';
  });

  const [sttEngine, setSttEngine] = useState(() => {
    const saved = localStorage.getItem('lv_stt_engine');
    if (saved === 'webspeech') {
      try { localStorage.removeItem('lv_stt_engine'); } catch (e) {}
      return 'deepgram';
    }
    return saved || 'deepgram';
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

  const medicalConfigRef = useRef(medicalConfig);
  useEffect(() => {
    medicalConfigRef.current = medicalConfig;
  }, [medicalConfig]);

  const sidebarMeterBarRef = useRef(null);
  const sidebarMeterTextRef = useRef(null);
  const lastSentSpeechRef = useRef({ text: '', time: 0 });
  const lastCumulativeSpeechRef = useRef({ text: '', time: 0 });
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

  const monitoredLangRef = useRef(monitoredLang);
  useEffect(() => {
    monitoredLangRef.current = monitoredLang;
  }, [monitoredLang]);

  // Synchronize microphone / STT engine language dynamically
  useEffect(() => {
    audioRecorderService.setLanguage?.(sourceLanguage);
  }, [sourceLanguage]);

  // Synchronize dynamic parameters when admin config is saved or on mount
  useEffect(() => {
    let isSubscribed = true;

    try {
      const savedVad = localStorage.getItem('lv_stt_vad');
      if (savedVad) audioRecorderService.setVadSensitivity?.(savedVad);
      const savedDecalage = localStorage.getItem('lv_decalage_mode');
      if (savedDecalage) audioRecorderService.setDecalageMode?.(savedDecalage);
      const savedLang = localStorage.getItem('lv_stt_lang');
      if (savedLang) {
        setSourceLanguage(savedLang);
        audioRecorderService.setLanguage?.(savedLang);
      }
    } catch (e) {}

    // Sincronizar proactivamente con la configuración global del servidor
    serverConfigPromiseRef.current = fetch('/api/config')
      .then(res => (res.ok ? res.json() : null))
      .then(cfg => {
        if (!isSubscribed || !cfg) return;
        if (cfg.hasDeepgramKey || cfg.hasOpenAiKey || cfg.hasGeminiKey) {
          hasServerKeysRef.current = true;
        }
        if (cfg.preferredSttEngine) {
          setSttEngine(cfg.preferredSttEngine);
          audioRecorderService.setSttEngine?.(cfg.preferredSttEngine);
        }
        if (cfg.sttLang && cfg.sttLang !== 'auto' && !localStorage.getItem('lv_stt_lang')) {
          setSourceLanguage(cfg.sttLang);
          audioRecorderService.setLanguage?.(cfg.sttLang);
        }
        if (cfg.voiceConfig) setSelectedVoices(cfg.voiceConfig);
        if (cfg.voiceGender) setVoiceGender(cfg.voiceGender);
        if (cfg.preferredTranslationEngine) setPreferredEngine(cfg.preferredTranslationEngine);
        if (cfg.medicalMode !== undefined) {
          setMedicalConfig({
            medicalMode: Boolean(cfg.medicalMode),
            medicalSpecialty: cfg.medicalSpecialty || 'general',
            customGlossary: Array.isArray(cfg.customGlossary)
              ? cfg.customGlossary
              : (typeof cfg.customGlossary === 'string'
                  ? cfg.customGlossary.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
                  : [])
          });
        }
      })
      .catch(err => console.warn('[HostView] Aviso al consultar /api/config en montaje:', err));

    const handleConfigSaved = (e) => {
      const cfg = e.detail;
      if (!cfg) return;
      if (cfg.hasDeepgramKey || cfg.hasOpenAiKey || cfg.hasGeminiKey || cfg.deepgramApiKey) {
        hasServerKeysRef.current = true;
      }
      if (cfg.sttLang) {
        setSourceLanguage(cfg.sttLang);
        audioRecorderService.setLanguage?.(cfg.sttLang);
      }
      if (cfg.sttEngine) {
        let cleanEngine = cfg.sttEngine;
        if (cleanEngine === 'gemini' || cleanEngine === 'google') cleanEngine = 'gemini_live';
        setSttEngine(cleanEngine);
        audioRecorderService.setSttEngine?.(cleanEngine);
        setActiveSttInfo(audioRecorderService.getActiveSttInfo?.() || null);
      }
      if (cfg.sttVad) {
        audioRecorderService.setVadSensitivity?.(cfg.sttVad);
      }
      if (cfg.decalageMode) {
        audioRecorderService.setDecalageMode?.(cfg.decalageMode);
      }
      if (cfg.voiceConfig) {
        setSelectedVoices(cfg.voiceConfig);
      }
      if (cfg.voiceGender) {
        setVoiceGender(cfg.voiceGender);
      }
      if (cfg.preferredEngine) {
        setPreferredEngine(cfg.preferredEngine);
      }
      if (cfg.medicalMode !== undefined || cfg.medicalSpecialty || cfg.customGlossary !== undefined) {
        setMedicalConfig({
          medicalMode: Boolean(cfg.medicalMode),
          medicalSpecialty: cfg.medicalSpecialty || 'general',
          customGlossary: Array.isArray(cfg.customGlossary)
            ? cfg.customGlossary
            : (typeof cfg.customGlossary === 'string'
                ? cfg.customGlossary.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
                : [])
        });
      }
    };
    window.addEventListener('liftvoice_config_saved', handleConfigSaved);
    return () => {
      isSubscribed = false;
      window.removeEventListener('liftvoice_config_saved', handleConfigSaved);
    };
  }, []);

  const handleCopyMeetingLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/join?room=${roomId}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setHasCopiedLink(true);
        setTimeout(() => setHasCopiedLink(false), 2000);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    const refreshDevices = async () => {
      try {
        const devs = await audioRecorderService.getAudioInputDevices();
        if (Array.isArray(devs) && devs.length) setDevices(devs);
      } catch (e) {}
    };

    refreshDevices();

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    }

    audioRecorderService.onDeviceAutoSwitched = (fallbackDev) => {
      setSelectedDevice(fallbackDev || 'default');
    };

    return () => {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      }
      audioRecorderService.onDeviceAutoSwitched = null;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();
    let minWaitTimer = null;

    const fallbackTimer = setTimeout(() => {
      if (isMounted) setIsInitializing(false);
    }, 1500);

    socketService.connect().then(() => {
      if (!isMounted) return;
      socketService.joinAsHost(roomId);
      const elapsed = Date.now() - startTime;
      const minWait = Math.max(0, 380 - elapsed);
      minWaitTimer = setTimeout(() => {
        if (isMounted) setIsInitializing(false);
      }, minWait);
    }).catch(() => {
      if (isMounted) setIsInitializing(false);
    });

    const applyStatsUpdate = (stats) => {
      if (!isMounted || !stats) return;
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
    };

    const unsubStats = socketService.on('room_stats', applyStatsUpdate);
    const unsubJoined = socketService.on('joined_success', (msg) => {
      if (msg?.stats) {
        applyStatsUpdate(msg.stats);
      }
      // Re-sincronizar cabina de auriculares monitorizada y estado de emisión tras reconexión
      if (monitoredLangRef.current && monitoredLangRef.current !== 'none') {
        socketService.setMonitoredBooth(roomId, monitoredLangRef.current);
      }
      if (isBroadcastingRef.current) {
        socketService.send({ type: 'host_broadcast_state', roomId, isBroadcasting: true });
      }
    });

    const unsubJoinFailed = socketService.on('host_join_failed', (msg) => {
      if (!isMounted) return;
      console.warn('[HostView] ⚠️ Rechazado acceso como anfitrión:', msg);
      setBroadcastError(`Acceso como anfitrión rechazado: ${msg?.reason || 'Clave de sala no válida'}`);
      setIsBroadcasting(false);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(`lv_hostkey_${roomId}`);
          localStorage.removeItem(`lv_hostkey_${roomId.toUpperCase()}`);
        }
      } catch (e) {}
    });

    const unsubSocketError = socketService.on('error', (msg) => {
      if (!isMounted) return;
      if (msg?.message) {
        console.warn('[HostView] ⚠️ Mensaje de error recibido del socket:', msg.message);
        if (msg.message.includes('Unauthorized') || msg.message.includes('host')) {
          setBroadcastError(msg.message);
        }
      }
    });

    const unsubTranscript = socketService.on('transcript_event', (item) => {
      if (!isMounted || !item) return;
      setTranscriptHistory(prev => {
        let next;
        if (prev.some(p => p.id === item.id)) {
          next = prev.map(p => p.id === item.id ? { ...p, ...item, translations: { ...(p.translations || {}), ...(item.translations || {}) } } : p);
        } else {
          const last = prev[prev.length - 1];
          if (last && last.originalText === item.originalText && Math.abs((item.timestamp || 0) - (last.timestamp || 0)) < 4000) {
            return prev;
          }
          next = [...prev, item];
        }
        // Rolling window defensivo: evita acumular miles de nodos DOM en conferencias largas (>2 horas)
        const MAX_CLIENT_TRANSCRIPTS = 80;
        return next.length > MAX_CLIENT_TRANSCRIPTS ? next.slice(-MAX_CLIENT_TRANSCRIPTS) : next;
      });
    });

    const unsubHistory = socketService.on('transcript_history', (history) => {
      if (!isMounted || !Array.isArray(history)) return;
      setTranscriptHistory(prev => {
        if (prev.length === 0) return history.slice(-80);
        const existingIds = new Set(prev.map(p => p.id));
        const newItems = history.filter(h => !existingIds.has(h.id));
        return [...prev, ...newItems].slice(-80);
      });
    });

    const unsubLatency = socketService.on('latency', (lat) => {
      if (!isMounted) return;
      setSocketLatency(lat);
    });

    const unsubTelemetry = socketService.on('pipeline_metric', (metric) => {
      if (!isMounted || !metric) return;
      setActiveTelemetry(metric);
    });

    const unsubAudio = socketService.on('audio_chunk', (packet) => {
      if (!isMounted || !packet) return;
      if (packet.isHostPreview) {
        audioPlayerService.playAudioChunk(packet);
      } else {
        // Play only the cabin that the host explicitly chose to monitor in headphones
        const activeMonitored = monitoredLangRef.current;
        if (activeMonitored && activeMonitored !== 'none' && packet.lang === activeMonitored) {
          audioPlayerService.playAudioChunk({
            ...packet,
            isBoothAudio: true,
            isHostMonitoring: true
          });
        }
      }
    });

    // Q&A Backchannel socket handlers
    const handleIncomingQaRequest = (msg) => {
      if (!isMounted) return;
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
      if (!isMounted) return;
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
      if (!isMounted) return;
      const qId = msg?.questionId;
      setActiveQuestion(prev => (prev && (!qId || prev.questionId === qId) ? null : prev));
      if (qId) {
        setQaQueue(prev => prev.filter(q => q.questionId !== qId));
      } else {
        setQaQueue(prev => prev.filter(q => q.status !== 'speaking'));
      }
    });

    const unsubQaLowered = socketService.on('qa_hand_lowered', (msg) => {
      if (!isMounted) return;
      const attId = msg?.attendeeId;
      if (attId) {
        setQaQueue(prev => prev.filter(q => q.attendeeId !== attId && q.questionId !== attId && q.socketId !== attId));
        setActiveQuestion(prev => (prev && (prev.attendeeId === attId || prev.questionId === attId || prev.socketId === attId) ? null : prev));
        setIncomingQuestionAudio(prev => (prev && (prev.attendeeId === attId || prev.socketId === attId) ? null : prev));
      }
    });

    const unsubEarpiece = socketService.on('host_earpiece_audio', (data) => {
      if (!isMounted) return;
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
      isMounted = false;
      clearTimeout(fallbackTimer);
      if (minWaitTimer) clearTimeout(minWaitTimer);
      audioRecorderService.stopRecording();
      audioPlayerService.disposeSession();
      socketService.send({ type: 'host_broadcast_state', roomId, isBroadcasting: false });
      socketService.setMonitoredBooth(roomId, 'none');
      socketService.leaveRoom(roomId);
      unsubStats();
      unsubJoined();
      unsubJoinFailed();
      unsubSocketError();
      unsubTranscript();
      unsubHistory();
      unsubLatency();
      unsubTelemetry();
      unsubAudio();
      unsubQaRequested();
      unsubQaRaised();
      unsubQaSpeaker();
      unsubQaClosed();
      unsubQaLowered();
      unsubEarpiece();
    };
  }, [roomId]);

  // Zero-Reflow GPU VAD listener
  useEffect(() => {
    const unsubAudioLevel = audioRecorderService.onAudioLevel((lvl) => {
      // lvl is 0 to 100 from audioRecorderService
      const pct = Math.min(100, Math.max(0, Math.round(lvl)));
      const norm = pct / 100;
      if (sidebarMeterBarRef.current) {
        sidebarMeterBarRef.current.style.transform = `scaleX(${norm})`;
      }
      if (sidebarMeterTextRef.current) {
        sidebarMeterTextRef.current.textContent = `${pct}%`;
      }
    });

    const unsubStreamingStatus = audioRecorderService.onStreamingStatus
      ? audioRecorderService.onStreamingStatus((status) => {
          setAsrStatus(status);
          if (status === 'fallback_webspeech') {
            setSttEngine('webspeech');
          }
        })
      : () => {};

    return () => {
      unsubAudioLevel();
      unsubStreamingStatus();
    };
  }, []);

  const sendSpeechToEngines = (finalText, detectedLang, overrides = {}) => {
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

    setLiveInterimSpeech('');

    const currentSrc = sourceLanguageRef.current;
    let sendLang = (!currentSrc || currentSrc === 'auto' || currentSrc === 'multi') ? 'auto' : currentSrc;
    if (sendLang === 'auto' && detectedLang && detectedLang !== 'auto' && detectedLang !== 'multi') {
      sendLang = detectedLang;
    }
    if (sendLang !== 'auto') {
      const srcLower = sendLang.toLowerCase();
      if (srcLower.startsWith('es')) sendLang = 'es';
      else if (srcLower.startsWith('en')) sendLang = 'en';
      else if (srcLower.startsWith('it')) sendLang = 'it';
      else if (srcLower.startsWith('pt')) sendLang = 'pt';
      else sendLang = sendLang.length > 2 ? sendLang.slice(0, 2) : sendLang;
    }

    // Transmit strictly ONE single socket event to server AI pipeline for translation and multi-booth TTS
    const currentMedConfig = medicalConfigRef.current || {};
    const currentStt = audioRecorderService.getActiveSttInfo ? audioRecorderService.getActiveSttInfo() : null;
    const activeMon = monitoredLangRef.current;
    let forceLangs = [];
    if (activeMon && activeMon !== 'none') {
      forceLangs.push(activeMon);
    }
    if (overrides.inputSource === 'manual_text') {
      forceLangs = ['es', 'en', 'it', 'pt'];
    }
    socketService.sendSpeechText(cleanText, sendLang, forceLangs, {
      medicalMode: currentMedConfig.medicalMode,
      medicalSpecialty: currentMedConfig.medicalSpecialty,
      customGlossary: currentMedConfig.customGlossary,
      sttEngine: overrides.sttEngine || currentStt?.label,
      sttModel: overrides.sttModel || currentStt?.model,
      inputSource: overrides.inputSource || 'voice',
      isTerminalSilence: overrides.isTerminalSilence,
      endOfTurn: overrides.endOfTurn,
      bypassDecalage: overrides.bypassDecalage
    });
  };

  const handleToggleMonitoring = async (langCode) => {
    if (langCode === 'none' || monitoredLang === langCode) {
      // Salir de la sala / Silenciar retorno
      setMonitoredLang('none');
      audioPlayerService.stopAll();
      socketService.setMonitoredBooth(roomId, 'none');
    } else {
      audioPlayerService.stopAll();
      setMonitoredLang(langCode);
      socketService.setMonitoredBooth(roomId, langCode);
      try {
        await audioPlayerService.unlockAudio(roomId, langCode);
        audioPlayerService.setLanguage(langCode);
      } catch (e) {}
    }
  };

  const handleStopMonitoring = () => {
    setMonitoredLang('none');
    audioPlayerService.stopAll();
    socketService.setMonitoredBooth(roomId, 'none');
  };

  const handleToggleBroadcast = async () => {
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    setIsTogglingBroadcast(true);
    setBroadcastError(null);

    try {
      if (isBroadcasting) {
        audioRecorderService.stopRecording();
        setIsBroadcasting(false);
        setLiveInterimSpeech('');
        setActiveSttInfo(audioRecorderService.getActiveSttInfo?.() || null);
        socketService.send({ type: 'host_broadcast_state', roomId, isBroadcasting: false });
      } else {
        // Pre-flight de compatibilidad para evitar silent failure loops en Firefox/Safari sin claves
        const hasNativeSTT = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
        let hasConfiguredKeys = Boolean(hasServerKeysRef.current) || (typeof localStorage !== 'undefined' && Boolean(
          localStorage.getItem('lv_deepgram_key') ||
          localStorage.getItem('deepgram_api_key') ||
          localStorage.getItem('lv_openai_key') ||
          localStorage.getItem('lv_gemini_key')
        ));

        // Si no hay STT nativo ni claves locales, esperar a que /api/config resuelva si está en vuelo
        if (!hasNativeSTT && !hasConfiguredKeys && serverConfigPromiseRef.current) {
          try {
            await serverConfigPromiseRef.current;
          } catch (e) {}
          hasConfiguredKeys = Boolean(hasServerKeysRef.current);
        }

        if (!hasNativeSTT && !hasConfiguredKeys) {
          const isFirefoxOrSafari = typeof navigator !== 'undefined' && (
            /firefox/i.test(navigator.userAgent) ||
            (/safari/i.test(navigator.userAgent) && !/chrome|chromium/i.test(navigator.userAgent))
          );
          if (isFirefoxOrSafari) {
            setBroadcastError(
              'Tu navegador (Firefox / Safari) no admite transcripción de voz local gratuita. ' +
              'Para emitir gratis en modo Zero-Cost, utiliza Google Chrome o Microsoft Edge, o bien añade una clave de Deepgram en Ajustes (icono de engranaje).'
            );
            setIsTogglingBroadcast(false);
            return;
          }
        }

        const activeBoothLang = (monitoredLangRef.current && monitoredLangRef.current !== 'none')
          ? monitoredLangRef.current
          : ((sourceLanguageRef.current && sourceLanguageRef.current !== 'auto') ? sourceLanguageRef.current : 'es');
        await audioPlayerService.unlockAudio(roomId, activeBoothLang);
        let activeStt = sttEngine || localStorage.getItem('lv_stt_engine') || 'deepgram';
        if (activeStt === 'gemini' || activeStt === 'google') activeStt = 'gemini_live';
        const currentSrcLang = sourceLanguageRef.current;
        await audioRecorderService.startRecording({
          deviceId: selectedDevice === 'default' ? null : selectedDevice,
          lang: currentSrcLang,
          language: currentSrcLang,
          sttEngine: activeStt,
          medicalMode: medicalConfig.medicalMode,
          medicalSpecialty: medicalConfig.medicalSpecialty,
          customGlossary: medicalConfig.customGlossary,
          onInterimSpeech: (interim) => {
            setLiveInterimSpeech(interim);
          },
          onSpeechAudio: (audioBase64, mimeType, lang) => {
            // When Deepgram / server STT is selected, send audio to server AI pipeline
            const activeLang = sourceLanguageRef.current;
            const srcLower = (activeLang || '').toLowerCase();
            let resolvedActive = 'auto';
            if (srcLower.startsWith('es')) resolvedActive = 'es';
            else if (srcLower.startsWith('en')) resolvedActive = 'en';
            else if (srcLower.startsWith('it')) resolvedActive = 'it';
            else if (srcLower.startsWith('pt')) resolvedActive = 'pt';
            else if (activeLang && activeLang !== 'auto' && activeLang !== 'multi') resolvedActive = activeLang.slice(0, 2);

            let targetLang = resolvedActive;
            if (lang && lang !== 'auto' && lang !== 'multi') {
              const lLower = lang.toLowerCase();
              if (lLower.startsWith('es')) targetLang = 'es';
              else if (lLower.startsWith('en')) targetLang = 'en';
              else if (lLower.startsWith('it')) targetLang = 'it';
              else if (lLower.startsWith('pt')) targetLang = 'pt';
              else targetLang = lang.slice(0, 2);
            }
            const currentStt = audioRecorderService.getActiveSttInfo ? audioRecorderService.getActiveSttInfo() : null;
            socketService.sendSpeechAudio(audioBase64, mimeType, targetLang, {
              medicalMode: medicalConfigRef.current.medicalMode,
              medicalSpecialty: medicalConfigRef.current.medicalSpecialty,
              customGlossary: medicalConfigRef.current.customGlossary,
              sttEngine: currentStt?.label,
              sttModel: currentStt?.model
            });
          },
          onSpeechText: (finalText, detectedLang, overrides = {}) => {
            sendSpeechToEngines(finalText, detectedLang, overrides);
          }
        });
        setIsBroadcasting(true);
        setActiveSttInfo(audioRecorderService.getActiveSttInfo?.() || null);
        socketService.send({ type: 'host_broadcast_state', roomId, isBroadcasting: true });
      }
    } catch (err) {
      console.error('[HostView] Error al alternar emisión:', err);
      setBroadcastError(err?.message || 'No se pudo acceder al micrófono o iniciar la emisión.');
    } finally {
      setIsTogglingBroadcast(false);
      if (toggleCooldownTimerRef.current) {
        clearTimeout(toggleCooldownTimerRef.current);
      }
      toggleCooldownTimerRef.current = setTimeout(() => {
        isTogglingRef.current = false;
        toggleCooldownTimerRef.current = null;
      }, 400);
    }
  };

  const handleSendCustomText = (e) => {
    if (e) e.preventDefault();
    if (!manualText.trim()) return;
    const textToSend = manualText.trim();
    setManualText('');
    if (promptTextareaRef.current) {
      promptTextareaRef.current.style.height = 'auto';
    }
    sendSpeechToEngines(textToSend, null, {
      sttEngine: 'Entrada Manual',
      sttModel: 'keyboard',
      inputSource: 'manual_text'
    });
  };

  const handleSelectVoiceFromCatalog = (langOrConfig, maybeVoiceId, engine, gender) => {
    if (!langOrConfig) return;

    let updatedVoices;
    let updatedGenders;
    let toastMessage = 'Voces actualizadas correctamente';
    let toastLang = 'all';

    if (typeof langOrConfig === 'object' && langOrConfig !== null) {
      updatedVoices = { ...selectedVoices, ...langOrConfig };
      updatedGenders = (typeof maybeVoiceId === 'object' && maybeVoiceId !== null)
        ? { ...voiceGender, ...maybeVoiceId }
        : voiceGender;
      toastMessage = 'Voces de cabina guardadas y sincronizadas';
    } else {
      const lang = langOrConfig;
      const voiceId = maybeVoiceId;
      if (!voiceId) return;

      const resolvedGender = gender || (voiceGender && voiceGender[lang]) || 'female';
      updatedVoices = { ...selectedVoices, [lang]: voiceId };
      updatedGenders = { ...voiceGender, [lang]: resolvedGender };

      const cabinInfo = ALL_CABINS.find(c => c.code === lang);
      toastMessage = `Voz actualizada en cabina ${cabinInfo ? cabinInfo.name : lang.toUpperCase()}`;
      toastLang = lang;
    }

    setSelectedVoices(updatedVoices);
    setVoiceGender(updatedGenders);

    try {
      localStorage.setItem('lv_voice_config', JSON.stringify(updatedVoices));
      localStorage.setItem('lv_voice_gender', JSON.stringify(updatedGenders));

      if (roomId) {
        const token = adminAuthService.getToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        fetch(`/api/rooms/${roomId}/voices`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            voiceConfig: updatedVoices,
            voiceGender: updatedGenders
          })
        }).catch((err) => {
          console.warn('[HostView] Aviso al actualizar voces en el servidor:', err);
        });
      }

      window.dispatchEvent(new CustomEvent('liftvoice_config_saved', {
        detail: {
          voiceConfig: updatedVoices,
          voiceGender: updatedGenders
        }
      }));

      setVoiceToast({
        message: toastMessage,
        lang: toastLang
      });
      setTimeout(() => setVoiceToast(null), 3000);
    } catch (e) {
      console.warn('[HostView] Error al persistir voces:', e);
    }
  };

  const handleDecalageChange = (v) => {
    setDecalageValue(v);
    audioRecorderService.setDecalageMode?.(v);
    const token = adminAuthService.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (roomId) {
      fetch(`/api/rooms/${roomId}/decalage`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          decalageMode: v < 40 ? 'quick' : 'natural',
          decalageValue: v
        })
      }).catch((err) => {
        console.warn('[HostView] Error al actualizar decalage:', err);
      });
    }
  };

  const handlePreviewChannelVoice = async (langCode) => {
    // Si la cabina seleccionada ya se está reproduciendo, detener la reproducción inmediatamente
    if (previewingLang === langCode) {
      if (previewAbortRef.current) previewAbortRef.current.abort();
      try { audioPlayerService.stopAll(); } catch (e) {}
      setPreviewingLang(null);
      return;
    }

    if (previewAbortRef.current) previewAbortRef.current.abort();
    const abortCtrl = new AbortController();
    previewAbortRef.current = abortCtrl;
    setPreviewingLang(langCode);
    try { audioPlayerService.stopAll(); } catch (e) {}

    try {
      await audioPlayerService.unlockAudio(roomId, langCode);
      if (abortCtrl.signal.aborted) return;

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
          signal: abortCtrl.signal,
          body: JSON.stringify({
            lang: langCode,
            sampleText: text,
            voice: selectedVoices[langCode]
          })
        });
        if (abortCtrl.signal.aborted) return;
        const data = await res.json();
        if (abortCtrl.signal.aborted) return;
        if (data && data.audioBase64) {
          serverAudio = data.audioBase64;
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
      }

      if (abortCtrl.signal.aborted) return;

      await audioPlayerService.playVoicePreview({
        voiceId: selectedVoices[langCode],
        lang: langCode,
        text,
        audioBase64: serverAudio
      });
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn('Voice preview warning:', e);
      }
    } finally {
      if (previewAbortRef.current === abortCtrl) {
        setPreviewingLang(null);
      }
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

  const handleGenerateSummary = async (openModal = false) => {
    if (openModal) {
      setIsSummaryModalOpen(true);
    }
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

  const [sidebarTab, setSidebarTab] = useState('studio'); // 'studio' | 'catalog' | 'summary'

  const handleSelectStudio = useCallback(() => {
    setSidebarTab('studio');
  }, []);

  const handleSelectCatalog = useCallback(() => {
    setSidebarTab('catalog');
  }, []);

  const handleOpenCatalogForCabin = useCallback((langCode) => {
    setSelectedCatalogLang(langCode || 'all');
    setSidebarTab('catalog');
    setCatalogNavNonce(prev => prev + 1);
  }, []);

  const handleSelectSummary = useCallback(() => {
    setSidebarTab('summary');
    if (!summaryData && !isGeneratingSummary) {
      handleGenerateSummary(false);
    }
  }, [summaryData, isGeneratingSummary]);

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

  const renderInspectorContent = () => (
    <div className="space-y-4">

      {/* Tab: Cabinas */}
      {inspectorTab === 'cabins' && (
        <div className="space-y-4 text-left animate-fadeIn">
          {/* Headphone Monitor & Volume Card */}
          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 space-y-3 shadow-2xs">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
              Retorno de Auriculares
            </span>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {monitoredLang !== 'none'
                ? `Monitoreando retorno en directo en ${monitoredLang.toUpperCase()}. Silencia cuando hables al micrófono para evitar eco.`
                : 'Silenciado para no escuchar eco mientras hablas. Selecciona una cabina para audicionar su locución.'}
            </p>

            <button
              type="button"
              onClick={() => audioPlayerService.playAudioTestTone()}
              className="w-full h-7 px-3 rounded-full bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 touch-manipulation"
              title="Probar sonido de altavoz o auriculares locales"
            >
              <Bell className="w-3 h-3 text-zinc-600 dark:text-zinc-300" />
              <span>Probar</span>
            </button>

            {monitoredLang !== 'none' && (
              <div className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium leading-tight ${
                isBroadcasting
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
                  : 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
              }`}>
                <span>
                  {isBroadcasting
                    ? 'Usa auriculares obligatoriamente para evitar que el sonido de los altavoces entre por tu micrófono.'
                    : 'Recomendación: Usa auriculares al activar el retorno para evitar acople acústico cuando hables.'}
                </span>
              </div>
            )}

            {/* Slider de Volumen Auriculares Integrado Ergonómicamente */}
            <div className="pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70">
              <ElevenSlider
                label="Volumen Auriculares"
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
          </div>

          {/* Cabins List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Cabinas de Traducción</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCatalogLang('all');
                  setSidebarTab('catalog');
                }}
                className="text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Catálogo de Voces</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {ALL_CABINS.map((cab) => {
              const isMonitored = monitoredLang === cab.code;
              const voice = selectedVoices[cab.code] || DEFAULT_VOICES[cab.code] || 'Voz Neuronal';
              const isAuditioning = previewingLang === cab.code;
              const latestItem = transcriptHistory.length > 0 ? transcriptHistory[transcriptHistory.length - 1] : null;
              const cabinText = latestItem
                ? (latestItem.translations?.[cab.code] || (latestItem.detectedLanguage === cab.code ? latestItem.originalText : null))
                : null;

              return (
                <div
                  key={cab.code}
                  className={`p-3.5 rounded-2xl border transition-all space-y-2.5 shadow-2xs ${
                    isMonitored
                      ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/80 ring-1 ring-zinc-400/20 dark:ring-zinc-700/50'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CountryFlag code={cab.code} className="w-6 h-6 rounded-full shadow-2xs flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-950 dark:text-zinc-100">{cab.name}</div>
                        <button
                          type="button"
                          onClick={() => handleOpenCatalogForCabin(cab.code)}
                          className="text-[10px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-mono truncate max-w-[130px] block text-left hover:underline cursor-pointer"
                          title={`Cambiar voz para ${cab.name}`}
                        >
                          {voice}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleMonitoring(cab.code)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95 ${
                          isMonitored
                            ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 ring-2 ring-zinc-950/20 dark:ring-white/20'
                            : 'bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-300'
                        }`}
                        title={isMonitored ? `Silenciar retorno de ${cab.name}` : `Escuchar retorno en directo de ${cab.name}`}
                        aria-label={isMonitored ? `Silenciar retorno de ${cab.name}` : `Escuchar retorno en directo de ${cab.name}`}
                      >
                        <Headphones className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePreviewChannelVoice(cab.code)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95 ${
                          isAuditioning
                            ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 ring-2 ring-zinc-950/20 dark:ring-white/20'
                            : 'bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-800 dark:text-zinc-200'
                        }`}
                        title={isAuditioning ? 'Detener reproducción de voz' : 'Audicionar muestra de voz'}
                        aria-label={isAuditioning ? `Detener voz para ${cab.name}` : `Audicionar voz para ${cab.name}`}
                      >
                        {isAuditioning ? (
                          <Square className="w-2.5 h-2.5 fill-current" />
                        ) : (
                          <Play className="w-3 h-3 fill-current ml-0.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Vista previa de traducción en tiempo real */}
                  <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-start gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${cabinText ? 'bg-blue-500' : (isMonitored ? 'bg-zinc-400 dark:bg-zinc-300 animate-pulse' : 'bg-zinc-400 dark:bg-zinc-600')}`} />
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300 italic line-clamp-2 leading-tight">
                      {cabinText ? `“${cabinText}”` : (effectiveTotalListeners === 0 && monitoredLang === 'none' ? 'En reposo (0 oyentes)' : 'Esperando locución...')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Q&A */}
      {inspectorTab === 'qa' && (
        <div className="space-y-4 text-left animate-fadeIn">
          <div className="p-3.5 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hand className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Turnos de Pregunta (Q&A)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono font-bold">
                {qaQueue.length}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Los oyentes pueden pulsar &quot;Pedir la palabra&quot; para intervenir en su idioma nativo.
            </p>
          </div>

          {activeQuestion && (
            <Banner
              icon={<Mic className="w-4 h-4 text-white animate-pulse" strokeWidth={2.4} />}
              color="#10b981"
              title={`${activeQuestion.name || 'Oyente'} está hablando`}
              subtitle={`Canal nativo: ${activeQuestion.nativeLang || 'en'} ➔ traducción a tu auricular`}
              desc={
                incomingQuestionAudio?.translatedText
                  ? `Traducción a tu oído: "${incomingQuestionAudio.translatedText}"`
                  : 'Escuchando intervención en tu auricular...'
              }
              bottomAction={
                <button
                  type="button"
                  onClick={() => handleCloseQuestion(activeQuestion.questionId)}
                  className="w-full h-9 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Finalizar Turno de Pregunta</span>
                </button>
              }
            />
          )}

          <div className="space-y-2">
            {qaQueue.filter(q => q.status === 'pending').length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-1.5 bg-zinc-50/50 dark:bg-zinc-900/30">
                <Hand className="w-5 h-5 text-zinc-400 dark:text-zinc-500 mx-auto" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">No hay preguntas pendientes</p>
              </div>
            ) : (
              qaQueue.filter(q => q.status === 'pending').map((q) => (
                <div
                  key={q.questionId}
                  className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 shadow-2xs space-y-2.5 flex flex-col"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-800 dark:text-zinc-200">
                        {q.name ? q.name.slice(0, 2).toUpperCase() : 'OY'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{q.name || 'Oyente'}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">Idioma: {q.nativeLang || 'es'}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex-shrink-0 font-medium">
                      En espera
                    </span>
                  </div>

                  {q.questionText && (
                    <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 text-xs text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed">
                      &ldquo;{q.questionText}&rdquo;
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleApproveQuestion(q.questionId)}
                      disabled={!!activeQuestion}
                      className="flex-1 py-1.5 px-4 rounded-2xl bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 text-white dark:text-zinc-950 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                      <span>Dar la palabra</span>
                    </button>
                    <button
                      onClick={() => handleCloseQuestion(q.questionId)}
                      className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
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

      {/* Tab: Sala & Asistentes */}
      {inspectorTab === 'room' && (() => {
        const rawParticipants = roomStats.attendees || [];
        const filteredParticipants = rawParticipants.filter(p => {
          if (!participantSearch.trim()) return true;
          const term = participantSearch.toLowerCase();
          return (
            (p.name && p.name.toLowerCase().includes(term)) ||
            (p.lang && p.lang.toLowerCase().includes(term))
          );
        });

        return (
          <div className="space-y-4 text-left animate-fadeIn">
            {/* Resumen Técnico */}
            <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 space-y-2 text-xs shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Total Oyentes:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {effectiveTotalListeners}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Canal de Ponente:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 uppercase">{sourceLanguage === 'auto' ? 'AUTO' : sourceLanguage.slice(0, 2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Latencia Red:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{socketLatency}ms</span>
              </div>
            </div>

            {/* Auditoría Técnica Exclusiva para Administrador */}
            {isAdminVerified && (
              <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 space-y-2 text-xs shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Motor STT Activo:</span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                    {activeSttInfo?.label || 'Deepgram Nova-3'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Modelo STT:</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {activeSttInfo?.model || 'nova-3'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">Modo Captura:</span>
                  <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                    {activeSttInfo?.modeLabel || 'AudioWorklet 16kHz'}
                  </span>
                </div>
                {activeTelemetry && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 dark:text-zinc-400">Motor LLM:</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">
                        {activeTelemetry.engineUsed || 'Google Gemini 3.8 Live'}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-zinc-200/70 dark:border-zinc-800/70 grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
                      <div className="p-1.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/50">
                        <div className="text-[9px] text-zinc-400">STT</div>
                        <div className="font-bold text-zinc-800 dark:text-zinc-200">{activeTelemetry.sttMs || 0}ms</div>
                      </div>
                      <div className="p-1.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/50">
                        <div className="text-[9px] text-zinc-400">LLM</div>
                        <div className="font-bold text-zinc-800 dark:text-zinc-200">{activeTelemetry.transMs || 0}ms</div>
                      </div>
                      <div className="p-1.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/50">
                        <div className="text-[9px] text-zinc-400">Total</div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">{activeTelemetry.totalLatencyMs || 0}ms</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Sección de Participantes Directa (sin contenedor envolvente) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Participantes en Sala
                </span>
                <button
                  type="button"
                  onClick={() => setIsAttendeesModalOpen(true)}
                  className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer font-medium"
                >
                  Ver todos
                </button>
              </div>

              {/* Buscador si hay participantes */}
              {rawParticipants.length > 2 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    placeholder="Buscar participante..."
                    className="w-full h-8 pl-8.5 pr-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all"
                  />
                </div>
              )}

              {/* Lista de usuarios conectados */}
              <div className="space-y-2">
                {/* Ponente / Anfitrión Fila Pinned */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center text-xs font-bold border border-zinc-300/60 dark:border-zinc-700/60">
                        P
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        Tú (Anfitrión)
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                        Emisión principal
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-zinc-200/70 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-300/60 dark:border-zinc-700/60 flex items-center gap-1.5 shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${isBroadcasting ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <span>{isBroadcasting ? 'En Directo' : 'En Sala'}</span>
                  </span>
                </div>

                {/* Oyentes */}
                {rawParticipants.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                    Esperando a que entren oyentes a la sala
                  </div>
                ) : filteredParticipants.length === 0 ? (
                  <div className="py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                    No hay participantes que coincidan
                  </div>
                ) : (
                  filteredParticipants.map((att) => {
                    const initials = (att.name || 'OY')
                      .split(' ')
                      .map(w => w[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || 'OY';

                    return (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 shadow-2xs transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-xs font-bold shrink-0 border border-zinc-300/60 dark:border-zinc-700/60">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                              {att.name || 'Oyente'}
                            </span>
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium block">
                              {att.isOnline === false ? 'Desconectado' : 'Oyente conectado'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 shadow-2xs">
                            <CountryFlag code={att.lang || 'es'} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                            <span className="text-[10px] font-mono font-medium text-zinc-600 dark:text-zinc-400 uppercase">
                              {att.lang || 'es'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleKickAttendee(att.id, att.name)}
                            className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                          >
                            Expulsar
                          </button>
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
  );

  if (isInitializing) {
    return (
      <div className="fixed inset-0 z-50 w-full h-full flex flex-col items-center justify-center bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-6 space-y-4 text-center select-none overflow-hidden animate-fadeIn">
        <Loader2 className="w-8 h-8 text-zinc-800 dark:text-zinc-200 animate-spin" />
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 tracking-tight">
            Iniciando estudio de emisión...
          </p>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{roomId}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex-1 w-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans select-none transition-colors">

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CABECERA MÓVIL (MOBILE HEADER, sm:hidden)                     */}
      {/* Ajuste ergonómico de 56px + Safe Area Inset para iOS Safari    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="sm:hidden h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-safe border-b border-zinc-200 dark:border-zinc-800/80 px-4 flex items-center justify-between bg-white dark:bg-zinc-950 flex-shrink-0 z-30 select-none">
        {/* Izquierda: Salir de la sala con touch target de 44px HIG */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onLeave({ reason: 'voluntary', isMobile: true })}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-xs active:scale-95 touch-manipulation"
            title="Salir al inicio"
            aria-label="Salir al inicio"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Centro: Cápsula de sala táctil con altura mínima de 44px */}
        <div className="flex items-center justify-center flex-1 min-w-0 px-1.5">
          <button
            type="button"
            onClick={handleCopyMeetingLink}
            className="flex items-center gap-1.5 px-3.5 py-1.5 min-h-[44px] rounded-full bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 transition-all cursor-pointer truncate shadow-xs active:scale-95 touch-manipulation"
            title="Toca para copiar vínculo de la sala"
          >
            <span className="truncate">{roomId}</span>
            {hasCopiedLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
            )}
          </button>
        </div>

        {/* Derecha: Menú desplegable móvil con touch target de 44px */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <MobileHeaderMenu
            roomId={roomId}
            onOpenSettings={() => onOpenSettings && onOpenSettings()}
            onOpenQR={() => setIsQrModalOpen(true)}
            onOpenAttendees={() => setIsAttendeesSheetOpen(true)}
            attendeesCount={roomStats.attendees?.length || 0}
            onOpenSummary={handleGenerateSummary}
            onOpenVoices={() => {
              setSelectedCatalogLang('all');
              setSidebarTab('catalog');
            }}
            hasCopiedLink={hasCopiedLink}
            onCopyLink={handleCopyMeetingLink}
            onLeave={() => onLeave({ reason: 'voluntary', isMobile: true })}
          />
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CABECERA ESCRITORIO (DESKTOP HEADER 48px, hidden sm:flex)     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="hidden sm:flex h-12 w-full border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 px-4 items-center justify-between flex-shrink-0 z-30 select-none">
        {/* Menú principal hamburguesa alineado exactamente sobre la barra lateral StudioSidebar */}
        <div className="w-[70px] -ml-4 flex items-center justify-center flex-shrink-0">
          <DesktopHeaderMenu
            onExit={() => onLeave({ reason: 'voluntary' })}
            hasCopiedLink={hasCopiedLink}
            onCopyLink={handleCopyMeetingLink}
            extraItems={[
              {
                label: 'Crear otra sala',
                onClick: () => {
                  window.history.pushState({}, '', '/create');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              },
              {
                label: 'Proyectar código QR',
                onClick: () => setIsQrModalOpen(true)
              },
              {
                label: 'Ajustes de Sala',
                onClick: () => onOpenSettings && onOpenSettings()
              }
            ]}
          />
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleCopyMeetingLink}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer shadow-2xs"
            title="Copiar vínculo de la sala"
          >
            <span>{roomId}</span>
            {hasCopiedLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsQrModalOpen(true)}
            className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shadow-2xs"
            title="Proyectar código QR para oyentes"
            aria-label="Proyectar código QR"
          >
            <QrCode className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300 shadow-2xs">
            <span className={`w-2 h-2 rounded-full ${isBroadcasting ? 'bg-rose-500 animate-pulse' : 'bg-zinc-400'}`} />
            <span className="font-medium font-mono text-[11px]">{isBroadcasting ? `En directo · ${formatDuration(broadcastSeconds)}` : 'En pausa'}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsDesktopInspectorOpen(prev => !prev)}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer border ${
              isDesktopInspectorOpen
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 shadow-2xs'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title={isDesktopInspectorOpen ? "Ocultar Inspector de Sala" : "Mostrar Inspector de Sala"}
            aria-label={isDesktopInspectorOpen ? "Ocultar Inspector de Sala" : "Mostrar Inspector de Sala"}
          >
            <PanelRight className="w-4 h-4" />
          </button>

          {/* Botón de Perfil del Anfitrión con UserMenu */}
          <button
            ref={hostUserMenuTriggerRef}
            type="button"
            onClick={() => setIsHostUserMenuOpen(prev => !prev)}
            className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer shadow-2xs select-none active:scale-95"
            title="Tu perfil en la sala (Ponente)"
            aria-label="Perfil del anfitrión"
          >
            <div className="w-6 h-6 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-[10px] font-bold">
              P
            </div>
          </button>

          <UserMenu
            isOpen={isHostUserMenuOpen}
            onClose={() => setIsHostUserMenuOpen(false)}
            anchorElement={hostUserMenuTriggerRef.current}
            userName="Ponente"
            userRole="host"
            onOpenSettings={onOpenSettings}
          />
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CUERPO PRINCIPAL (StudioSidebar + Zona 1 + Stage + Inspector)  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 w-full flex flex-row overflow-hidden">

        {/* ───────────────────────────────────────────────────────────── */}
        {/* SIDEBAR VERTICAL IZQUIERDO (STUDIO SIDEBAR, hidden sm:flex)   */}
        {/* ───────────────────────────────────────────────────────────── */}
        <StudioSidebar
          activeTab={sidebarTab}
          onSelectStudio={handleSelectStudio}
          onSelectCatalog={handleSelectCatalog}
          onSelectSummary={handleSelectSummary}
        />

        {/* ─────────────────────────────────────────────────────────── */}
        {/* ZONA 1: PANEL DE CONTROL / CATÁLOGO / RESUMEN (w-[380px])   */}
        {/* ─────────────────────────────────────────────────────────── */}
        <aside className="hidden sm:flex w-[380px] h-full border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex-col flex-shrink-0 select-none overflow-hidden">
          {/* Tab 1: Estudio de Emisión (persistente) */}
          <div className={`flex-col h-full overflow-hidden ${sidebarTab === 'studio' ? 'flex' : 'hidden'}`}>
              {/* Header con datum line h-14 alineado con canvas e inspector */}
              <div className="h-14 px-5 flex items-center justify-between bg-white dark:bg-zinc-950 flex-shrink-0">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                Estudio de Emisión
              </h2>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                Control de captura y locución en directo
              </p>
            </div>
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full">
              {socketLatency}ms
            </span>
          </div>

          {/* Línea divisoria con margen horizontal en X (idéntico a ListenerView) */}
          <div className="mx-5 border-b border-zinc-200 dark:border-zinc-800/80 flex-shrink-0" />

          {/* Left Sidebar Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2 space-y-4">
            <div className="space-y-4">
              {/* Sección 1: Configuración de Entrada */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Configuración de Entrada
                </div>

                {/* Mic Device selector con SelectDropdown de standalone-assistant */}
                <div className="space-y-1.5">
                  <label htmlFor="host-mic-select" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                    Micrófono de Entrada
                  </label>
                  <SelectDropdown
                    id="host-mic-select"
                    aria-label="Micrófono de Entrada"
                    value={selectedDevice}
                    options={[
                      { value: 'default', label: 'Micrófono Predeterminado' },
                      ...devices
                        .filter(d => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
                        .map((d, i) => ({
                          value: d.deviceId,
                          label: d.label || `Micrófono ${i + 1}`
                        }))
                    ]}
                    onChange={async (_, val) => {
                      const newDev = val || 'default';
                      setSelectedDevice(newDev);
                      if (isBroadcasting) {
                        if (isSwitchingDeviceRef.current) return;
                        isSwitchingDeviceRef.current = true;
                        try {
                          await audioRecorderService.switchDevice(newDev);
                        } catch (err) {
                          console.error('[HostView] Error en conmutación en caliente de micrófono:', err);
                          setBroadcastError('No se pudo conmutar al nuevo micrófono. Se mantiene el dispositivo previo.');
                        } finally {
                          isSwitchingDeviceRef.current = false;
                        }
                      } else {
                        audioRecorderService.setDevice(newDev);
                      }
                    }}
                  />
                </div>

                {/* Idioma del Ponente (cuadrícula 2x2 calcada de la sala del oyente) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                      Idioma del Ponente
                    </label>
                    <label
                      className="inline-flex items-center gap-2 cursor-pointer select-none group py-0.5 rounded outline-none focus:outline-none focus-within:outline-none"
                      title="Detección automática del idioma del ponente"
                    >
                      <input
                        type="checkbox"
                        checked={sourceLanguage === 'auto'}
                        onChange={(e) => {
                          try { e.target.blur(); } catch (err) {}
                          const next = sourceLanguage === 'auto'
                            ? (lastExplicitSpeakerLangRef.current || 'es-ES')
                            : 'auto';
                          setSourceLanguage(next);
                          try { localStorage.setItem('lv_stt_lang', next); } catch (err) {}
                          audioRecorderService.setLanguage(next);
                        }}
                        className="sr-only outline-none focus:outline-none"
                      />
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                          sourceLanguage === 'auto'
                            ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-zinc-900 shadow-2xs'
                            : 'bg-transparent border-zinc-300 dark:border-zinc-700 group-hover:border-zinc-400 dark:group-hover:border-zinc-500'
                        }`}
                      >
                        {sourceLanguage === 'auto' && (
                          <Check className="w-3 h-3 stroke-[3]" />
                        )}
                      </div>
                      <span className={`text-xs transition-colors ${
                        sourceLanguage === 'auto'
                          ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                          : 'text-zinc-500 dark:text-zinc-400 font-medium group-hover:text-zinc-700 dark:group-hover:text-zinc-300'
                      }`}>
                        Auto
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {SPEAKER_LANGUAGES.filter(l => l.code !== 'auto').map((lang) => {
                      const isSelected = sourceLanguage !== 'auto' && (
                        sourceLanguage === lang.langCode ||
                        sourceLanguage === lang.code ||
                        sourceLanguage.startsWith(lang.code)
                      );
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            setSourceLanguage(lang.langCode);
                            lastExplicitSpeakerLangRef.current = lang.langCode;
                            try { localStorage.setItem('lv_stt_lang', lang.langCode); } catch (e) {}
                            audioRecorderService.setLanguage(lang.langCode);
                          }}
                          className={`p-3 min-w-[44px] min-h-[44px] rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between select-none ${
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

                          {/* Fila inferior: Nombre de idioma y subtítulo */}
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

              {/* Sección 2: Ajustes de Locución (Reubicados ergonómicamente) */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Ajustes de Locución
                </div>

                <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 space-y-4 shadow-2xs">
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
                    leftLabel="Rápido (3s)"
                    rightLabel="Ponencia (6s)"
                    formatValue={(val) => (val < 40 ? 'Ágil' : 'Ponencia')}
                    onChange={handleDecalageChange}
                  />
                </div>
              </div>

              {/* Sección 3: Estado de Emisión & Vúmetro */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Estado de Emisión
                </div>

                {/* Live State Card */}
                <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 flex items-center justify-between text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isBroadcasting ? 'bg-rose-500 animate-pulse' : 'bg-zinc-400'}`} />
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {isBroadcasting ? 'Emisión en directo' : 'Emisión en pausa'}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 bg-zinc-200/70 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full">
                    {socketLatency}ms
                  </span>
                </div>

                {/* VAD Level Meter */}
                <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">Señal Micrófono</span>
                    <span ref={sidebarMeterTextRef} className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100 tabular-numbers">0%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      ref={sidebarMeterBarRef}
                      className="h-full w-full bg-emerald-500 rounded-full origin-left will-change-transform scale-x-0"
                      style={{ transition: 'transform 0.05s linear' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botón Maestro de Emisión Anclado al Pie */}
          <div className="px-5 pb-5 pt-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleToggleBroadcast}
              disabled={isTogglingBroadcast}
              className={`w-full h-11 min-h-[44px] rounded-2xl font-semibold text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs active:scale-[0.99] border ${
                isTogglingBroadcast ? 'opacity-70 cursor-wait' : ''
              } ${
                isBroadcasting
                  ? 'bg-rose-600 text-white hover:bg-rose-700 border-transparent shadow-rose-600/20'
                  : 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 border-transparent'
              }`}
            >
              {isBroadcasting ? (
                <>
                  <div className="w-2.5 h-2.5 rounded-xs bg-white animate-pulse" />
                  <span>Detener Emisión ({formatDuration(broadcastSeconds)})</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-current" />
                  <span>Iniciar Emisión</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab 2: Catálogo de Voces (mantenido montado en segundo plano para 0ms y cero parpadeo) */}
          <div className={`h-full overflow-hidden ${sidebarTab === 'catalog' ? 'flex flex-col' : 'hidden'}`}>
            <ErrorBoundary>
              <SidebarVoiceCatalog
                roomId={roomId}
                selectedVoices={selectedVoices}
                targetLang={selectedCatalogLang}
                navNonce={catalogNavNonce}
                onSelectVoice={(targetLang, voiceObj) => {
                  const voiceId = typeof voiceObj === 'object' && voiceObj ? voiceObj.id : voiceObj;
                  const gender = typeof voiceObj === 'object' && voiceObj ? voiceObj.gender : undefined;
                  const engine = typeof voiceObj === 'object' && voiceObj ? voiceObj.engine : undefined;
                  handleSelectVoiceFromCatalog(targetLang, voiceId, engine, gender);
                }}
              />
            </ErrorBoundary>
          </div>

          {/* Tab 3: Resumen de Sesión */}
          <div className={`h-full overflow-hidden ${sidebarTab === 'summary' ? 'flex flex-col' : 'hidden'}`}>
            <SidebarSessionSummary
              roomId={roomId}
              summaryData={summaryData}
              isLoading={isGeneratingSummary}
              error={summaryError}
              onGenerate={() => handleGenerateSummary(false)}
            />
          </div>
        </aside>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* ZONA 2: STUDIO STAGE (CENTRAL CANVAS)                       */}
        {/* ─────────────────────────────────────────────────────────── */}
        <section className="flex-1 min-w-0 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden">
          {/* Canvas Header (Alineado con datum line h-14 de las columnas laterales, 100% de ancho) */}
          <div className="h-14 border-b border-zinc-200 dark:border-zinc-800/80 px-5 sm:px-6 flex items-center justify-between bg-white dark:bg-zinc-950 flex-shrink-0 w-full">
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                    <span>{stageTitle}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isBroadcasting ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                  </h1>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    {effectiveTotalListeners} oyente{effectiveTotalListeners === 1 ? '' : 's'} conectado{effectiveTotalListeners === 1 ? '' : 's'} · Emisión neuronal en 4 cabinas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Font Size Cycler (rounded-lg como ListenerView) */}
                <button
                  type="button"
                  onClick={() => setCaptionSize(prev => prev === 'sm' ? 'md' : prev === 'md' ? 'lg' : prev === 'lg' ? 'xl' : 'sm')}
                  className="h-8 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title={`Tamaño de subtítulos: ${captionSize.toUpperCase()}`}
                >
                  <Type className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{captionSize.toUpperCase()}</span>
                </button>

                {activeQuestion ? (
                  <div className="h-8 px-3 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="truncate max-w-[110px]">Q&A: {activeQuestion.name}</span>
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
                      setIsDesktopInspectorOpen(true);
                    }}
                    className="h-8 px-3 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs animate-pulse cursor-pointer"
                  >
                    <Hand className="w-3.5 h-3.5" />
                    <span>{qaQueue.filter(q => q.status === 'pending').length} Q&A</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Canvas Body con Subtítulos y Barra de Emisión Manual */}
          <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">
            {/* Error Banner */}
            {broadcastError && (
              <div className="flex-shrink-0 px-4 sm:px-6 pt-3">
                <div className="w-full max-w-4xl mx-auto">
                  <Banner
                    icon={<XCircle className="w-4 h-4 text-white" strokeWidth={2.4} />}
                    color="#ef4444"
                    title="Error al acceder al micrófono"
                    desc={broadcastError}
                    action={
                      <button
                        type="button"
                        onClick={() => setBroadcastError(null)}
                        className="h-8 px-3 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cerrar
                      </button>
                    }
                  />
                </div>
              </div>
            )}

            {/* Subtítulos a Pantalla Completa: w-full para que el scrollbar esté totalmente a la derecha */}
            <LiveCaptions
              transcriptHistory={transcriptHistory}
              interimText={liveInterimSpeech}
              currentLanguage={monitoredLang !== 'none' ? monitoredLang : (sourceLanguage === 'auto' ? 'es' : sourceLanguage.slice(0, 2))}
              showOriginal={true}
              medicalMode={medicalConfig.medicalMode}
              className="flex-1 flex flex-col h-full min-h-0 w-full"
              maxHeightClass="flex-1 h-full min-h-0"
              captionSize={captionSize}
              isAdmin={isAdminVerified}
              activeSttInfo={activeSttInfo}
            />
          </div>

          {/* Desktop Bottom Prompt — Replicado calcado de standalone-assistant (PromptInput) */}
          <div className="hidden sm:flex px-6 pb-4 pt-1 flex-shrink-0 w-full justify-center">
            <form
              onSubmit={handleSendCustomText}
              className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-3 shadow-xs transition-all duration-200 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-700 flex flex-col gap-2"
            >
              {/* Chips rápidos de presets para prueba del simulador */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {[
                  { label: '🇪🇸 Bienvenida', text: 'Bienvenidos a la conferencia de innovación. Hoy presentamos la traducción simultánea con inteligencia artificial en tiempo real.', lang: 'es' },
                  { label: '🇺🇸 Keynote', text: 'Welcome to our live keynote. You can listen in real-time in English, Spanish, Italian, and Portuguese directly from your mobile phone.', lang: 'en' },
                  { label: '🩺 Caso clínico', text: 'El paciente presenta disnea súbita, taquicardia con frecuencia de 115 lpm y saturación de oxígeno del 91%. Se solicita electrocardiograma urgente.', lang: 'es' },
                  { label: '⚡ Conmutación', text: 'Probando cambio dinámico de cabina de idioma en alta fidelidad y ultra-baja latencia.', lang: 'es' }
                ].map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setManualText(p.text);
                      if (promptTextareaRef.current) {
                        promptTextareaRef.current.focus();
                        adjustPromptHeight(promptTextareaRef.current);
                      }
                    }}
                    className="h-6 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors cursor-pointer shrink-0 border border-zinc-200/50 dark:border-zinc-700/50"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Textarea Multimodal-input style */}
              <div className="flex flex-row items-start gap-1 sm:gap-2">
                <textarea
                  ref={promptTextareaRef}
                  value={manualText}
                  onChange={(e) => {
                    setManualText(e.target.value);
                    adjustPromptHeight(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (e.nativeEvent.isComposing) return;
                      if (e.shiftKey) return;
                      e.preventDefault();
                      handleSendCustomText(e);
                    }
                  }}
                  rows={1}
                  placeholder="Escribe cualquier frase aquí para emitir por voz en las 4 cabinas..."
                  className="grow resize-none border-0 border-none bg-transparent p-2 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none ring-0 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden leading-relaxed"
                  style={{ minHeight: '40px', maxHeight: '160px' }}
                />
              </div>

              {/* PromptInputToolbar */}
              <div className="flex items-center justify-between border-t-0 p-0 shadow-none">
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-800/60 select-none">
                    <AudioLines className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                    <span>Emisión en 4 cabinas</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 hidden md:inline select-none">
                    Enter para emitir · Shift+Enter para salto de línea
                  </span>
                </div>

                {/* PromptInputSubmit circular button */}
                <button
                  type="submit"
                  disabled={!manualText.trim()}
                  className="size-8 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center transition-colors duration-200 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-30 disabled:hover:bg-zinc-950 dark:disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-95 shrink-0"
                  title="Emitir mensaje por voz (Enter)"
                  aria-label="Emitir mensaje por voz"
                >
                  <ArrowUp className="w-4 h-4" strokeWidth={2.4} />
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* ZONA 3: INSPECTOR DE SALA (hidden sm:flex, w-88)            */}
        {/* ─────────────────────────────────────────────────────────── */}
        {isDesktopInspectorOpen && (
          <aside className="hidden sm:flex w-88 h-full border-l border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex-shrink-0 flex-col overflow-hidden animate-fadeIn select-none">
            {/* Inspector Header: Title + Subtitle + Menú de pestañas dentro del Header */}
            <div className="px-5 pt-3.5 pb-2.5 flex flex-col gap-2.5 bg-white dark:bg-zinc-950 flex-shrink-0">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Inspector de Sala
                </h2>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                  Cabinas, Q&A y audiencia en vivo
                </p>
              </div>

              {/* Menú de pestañas integrado idéntico a ListenerView */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { id: 'cabins', label: 'Cabinas' },
                  { id: 'qa', label: `Q&A ${qaQueue.filter(q => q.status === 'pending').length ? `(${qaQueue.filter(q => q.status === 'pending').length})` : ''}` },
                  { id: 'room', label: 'Sala' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setInspectorTab(t.id)}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 whitespace-nowrap flex-shrink-0 cursor-pointer ${
                      inspectorTab === t.id
                        ? 'text-zinc-950 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 shadow-2xs'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Línea divisoria inset con margen horizontal */}
            <div className="mx-5 border-b border-zinc-200 dark:border-zinc-800/80 flex-shrink-0" />

            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5 space-y-4">
              {renderInspectorContent()}
            </div>
          </aside>
        )}

      </div>

      {/* Mobile Master Broadcast Dock (Fixed Thumb Zone) */}
      <div className="sm:hidden">
        <MasterBroadcastDock
          isBroadcasting={isBroadcasting}
          onToggleBroadcast={handleToggleBroadcast}
          isToggling={isTogglingBroadcast}
          onOpenAttendees={() => setIsAttendeesSheetOpen(true)}
          attendeesCount={roomStats.attendees?.length || 0}
          onOpenStudioSettings={() => setIsStudioSettingsOpen(true)}
          onOpenCabinsSheet={() => setIsCabinsSheetOpen(true)}
          onOpenQA={() => setIsQASheetOpen(true)}
          audioRecorderService={audioRecorderService}
          pendingQACount={qaQueue.filter(q => q.status === 'pending').length}
        />
      </div>

      {/* Mobile Studio Settings Bottom Sheet (Sección Exclusiva de Ajustes de Estudio / Micrófono e Idioma) */}
      <StudioSettingsBottomSheet
        isOpen={isStudioSettingsOpen}
        onClose={() => setIsStudioSettingsOpen(false)}
        sourceLanguage={sourceLanguage}
        onSelectSourceLanguage={(langCode) => {
          setSourceLanguage(langCode);
          lastExplicitSpeakerLangRef.current = langCode;
          try { localStorage.setItem('lv_stt_lang', langCode); } catch (e) {}
          audioRecorderService.setLanguage(langCode);
        }}
        onToggleAutoLanguage={() => {
          const next = sourceLanguage === 'auto'
            ? (lastExplicitSpeakerLangRef.current || 'es-ES')
            : 'auto';
          setSourceLanguage(next);
          try { localStorage.setItem('lv_stt_lang', next); } catch (err) {}
          audioRecorderService.setLanguage(next);
        }}
        devices={devices}
        selectedDevice={selectedDevice}
        onChangeDevice={async (newDev) => {
          const dev = newDev || 'default';
          setSelectedDevice(dev);
          if (isBroadcasting) {
            if (isSwitchingDeviceRef.current) return;
            isSwitchingDeviceRef.current = true;
            try {
              await audioRecorderService.switchDevice(dev);
            } catch (err) {
              console.error('[HostView] Error en conmutación en caliente de micrófono:', err);
              setBroadcastError('No se pudo conmutar al nuevo micrófono. Se mantiene el dispositivo previo.');
            } finally {
              isSwitchingDeviceRef.current = false;
            }
          } else {
            audioRecorderService.setDevice(dev);
          }
        }}
        speechRate={speechRate}
        onChangeSpeechRate={(v) => {
          setSpeechRate(v);
          audioPlayerService.setPlaybackRate(v);
        }}
        decalageValue={decalageValue}
        onChangeDecalage={handleDecalageChange}
        isBroadcasting={isBroadcasting}
        audioRecorderService={audioRecorderService}
      />

      {/* Mobile Cabins Bottom Sheet (Sección Exclusiva de Cabinas) */}
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
        onOpenCatalogForLang={(lang) => {
          setIsCabinsSheetOpen(false);
          handleOpenCatalogForCabin(lang || 'all');
        }}
        decalageValue={decalageValue}
        onDecalageChange={handleDecalageChange}
        boothVolume={boothVolume}
        onVolumeChange={setBoothVolume}
      />

      {/* Mobile Q&A Bottom Sheet (Sección Exclusiva de Preguntas) */}
      <QABottomSheet
        isOpen={isQASheetOpen}
        onClose={() => setIsQASheetOpen(false)}
        qaQueue={qaQueue}
        activeQuestion={activeQuestion}
        incomingQuestionAudio={incomingQuestionAudio}
        onApproveQuestion={handleApproveQuestion}
        onCloseQuestion={handleCloseQuestion}
      />

      {/* Mobile Attendees Bottom Sheet (Sección Exclusiva de Participantes) */}
      <AttendeesBottomSheet
        isOpen={isAttendeesSheetOpen}
        onClose={() => setIsAttendeesSheetOpen(false)}
        roomId={roomId}
        roomStats={roomStats}
        effectiveTotalListeners={effectiveTotalListeners}
        sourceLanguage={sourceLanguage}
        socketLatency={socketLatency}
        isBroadcasting={isBroadcasting}
        isAdminVerified={isAdminVerified}
        activeSttInfo={activeSttInfo}
        activeTelemetry={activeTelemetry}
        onKickAttendee={handleKickAttendee}
      />

      {/* Global Modals */}

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

      {/* Micro-toast flotante de confirmación de voz en vivo */}
      {voiceToast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-900/90 dark:bg-white/95 text-white dark:text-zinc-900 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 backdrop-blur-xs animate-fadeIn border border-white/10 dark:border-zinc-200">
          <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600 flex-shrink-0 stroke-[2.5]" />
          <span>{voiceToast.message}</span>
        </div>
      )}

    </div>
  );
}
