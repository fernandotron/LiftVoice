import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Radio, Settings, Volume2, Sparkles, AudioLines, Sliders,
  RefreshCw, Check, Globe, ChevronRight, Activity, Users, QrCode, Play,
  Send, Layers, ArrowRight, ArrowLeft, Type, Shield, Download, FileText, Stethoscope, Home,
  Search, ExternalLink, Headphones, Hand, HelpCircle, CheckCircle2, XCircle, MessageSquare,
  Menu, X, SlidersHorizontal, Copy, ChevronDown, PanelRight, Zap, Bell
} from 'lucide-react';
import CountryFlag from '../components/shared/CountryFlag.jsx';
import LiveCaptions from '../components/LiveCaptions.jsx';
import ElevenSlider from '../components/ElevenSlider.jsx';
import VoiceCatalogModal from '../components/VoiceCatalogModal.jsx';
import QRCodeModal from '../components/QRCodeModal.jsx';
import AttendeesModal from '../components/AttendeesModal.jsx';
import SessionSummaryModal from '../components/SessionSummaryModal.jsx';
import MasterBroadcastDock from '../components/mobile/MasterBroadcastDock.jsx';
import CabinsBottomSheet from '../components/mobile/CabinsBottomSheet.jsx';
import QABannerAlert from '../components/mobile/QABannerAlert.jsx';
import Banner from '../components/shared/Banner.jsx';
import DesktopHeaderMenu from '../components/shared/DesktopHeaderMenu.jsx';
import SelectDropdown from '../components/shared/SelectDropdown.jsx';
import UserMenu from '../components/shared/UserMenu.jsx';
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

export const SPEAKER_LANGUAGES = [
  { code: 'es', langCode: 'es-ES', label: 'Español (Ponente)' },
  { code: 'en', langCode: 'en-US', label: 'English (Speaker)' },
  { code: 'it', langCode: 'it-IT', label: 'Italiano (Relatore)' },
  { code: 'pt', langCode: 'pt-BR', label: 'Português (Palestrante)' },
  { code: 'auto', langCode: 'auto', label: 'Detección Automática' }
];

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
  const [isTogglingBroadcast, setIsTogglingBroadcast] = useState(false);
  const [broadcastError, setBroadcastError] = useState(null);
  const [sourceLanguage, setSourceLanguage] = useState('es-ES');
  const sourceLanguageRef = useRef(sourceLanguage);
  useEffect(() => {
    sourceLanguageRef.current = sourceLanguage;
  }, [sourceLanguage]);
  const [targetLanguages, setTargetLanguages] = useState(['es', 'en', 'it', 'pt']);
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [liveInterimSpeech, setLiveInterimSpeech] = useState('');
  const [roomStats, setRoomStats] = useState({ totalListeners: 0, listenersByLang: {}, attendees: [] });
  const [socketLatency, setSocketLatency] = useState(1);
  const [inspectorTab, setInspectorTab] = useState('cabins'); // 'cabins' | 'qa' | 'room'
  const [captionSize, setCaptionSize] = useState('md'); // 'sm' | 'md' | 'lg' | 'xl'
  const [isVoiceCatalogOpen, setIsVoiceCatalogOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [manualText, setManualText] = useState('');
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [monitoredLang, setMonitoredLang] = useState('none');
  const [previewingLang, setPreviewingLang] = useState(null);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  const [isDesktopInspectorOpen, setIsDesktopInspectorOpen] = useState(true);
  const [isCabinsSheetOpen, setIsCabinsSheetOpen] = useState(false);
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

  const currentSpeakerLang = SPEAKER_LANGUAGES.find(l => l.langCode === sourceLanguage) || SPEAKER_LANGUAGES[0];

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

  const medicalConfigRef = useRef(medicalConfig);
  useEffect(() => {
    medicalConfigRef.current = medicalConfig;
  }, [medicalConfig]);

  const sidebarMeterBarRef = useRef(null);
  const sidebarMeterTextRef = useRef(null);
  const dockMeterBarRef = useRef(null);
  const dockMeterTextRef = useRef(null);
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

  // Synchronize dynamic parameters when admin config is saved or on mount
  useEffect(() => {
    try {
      const savedVad = localStorage.getItem('lv_stt_vad');
      if (savedVad) audioRecorderService.setVadSensitivity(savedVad);
      const savedDecalage = localStorage.getItem('lv_decalage_mode');
      if (savedDecalage) audioRecorderService.setDecalageMode(savedDecalage);
      const savedLang = localStorage.getItem('lv_stt_lang');
      if (savedLang && savedLang !== 'auto') {
        setSourceLanguage(savedLang);
        audioRecorderService.setLanguage(savedLang);
      }
    } catch (e) {}

    const handleConfigSaved = (e) => {
      const cfg = e.detail;
      if (!cfg) return;
      if (cfg.sttLang && cfg.sttLang !== 'auto') {
        setSourceLanguage(cfg.sttLang);
        audioRecorderService.setLanguage(cfg.sttLang);
      }
      if (cfg.sttVad) {
        audioRecorderService.setVadSensitivity(cfg.sttVad);
      }
      if (cfg.decalageMode) {
        audioRecorderService.setDecalageMode(cfg.decalageMode);
      }
      if (cfg.medicalMode !== undefined || cfg.medicalSpecialty || cfg.customGlossary) {
        setMedicalConfig({
          medicalMode: Boolean(cfg.medicalMode),
          medicalSpecialty: cfg.medicalSpecialty || 'general',
          customGlossary: Array.isArray(cfg.customGlossary) ? cfg.customGlossary : []
        });
      }
    };
    window.addEventListener('liftvoice_config_saved', handleConfigSaved);
    return () => window.removeEventListener('liftvoice_config_saved', handleConfigSaved);
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
    audioRecorderService.getAudioInputDevices().then((devs) => {
      if (Array.isArray(devs) && devs.length) setDevices(devs);
    }).catch(() => {});
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

    const unsubStats = socketService.on('room_stats', (stats) => {
      if (!isMounted) return;
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
      if (!isMounted || !item) return;
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
      if (!isMounted) return;
      setSocketLatency(lat);
    });

    const unsubAudio = socketService.on('audio_chunk', (packet) => {
      if (!isMounted) return;
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
      unsubTranscript();
      unsubLatency();
      unsubAudio();
      unsubQaRequested();
      unsubQaRaised();
      unsubQaSpeaker();
      unsubQaClosed();
      unsubQaLowered();
      unsubEarpiece();
    };
  }, [roomId]);

  // Reactive listener for global SettingsModal updates
  useEffect(() => {
    const handleConfigSaved = (e) => {
      const cfg = e.detail;
      if (!cfg) return;
      if (cfg.sttEngine) setSttEngine(cfg.sttEngine);
      if (cfg.voiceConfig) setSelectedVoices(cfg.voiceConfig);
      if (cfg.preferredEngine) setPreferredEngine(cfg.preferredEngine);
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
    };
    window.addEventListener('liftvoice_config_saved', handleConfigSaved);
    return () => window.removeEventListener('liftvoice_config_saved', handleConfigSaved);
  }, []);

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
      if (dockMeterBarRef.current) {
        dockMeterBarRef.current.style.transform = `scaleX(${norm})`;
      }
      if (dockMeterTextRef.current) {
        dockMeterTextRef.current.textContent = `${pct}%`;
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

    const currentSrc = sourceLanguageRef.current;
    const sendLang = (!currentSrc || currentSrc === 'auto') ? 'auto' : currentSrc.slice(0, 2);

    // Transmit strictly ONE single socket event to server AI pipeline for translation and multi-booth TTS
    // Pass empty array [] so Lazy Cabins only synthesizes audio for active listeners or host-monitored booth
    const currentMedConfig = medicalConfigRef.current || {};
    socketService.sendSpeechText(cleanText, sendLang, [], {
      medicalMode: currentMedConfig.medicalMode,
      medicalSpecialty: currentMedConfig.medicalSpecialty,
      customGlossary: currentMedConfig.customGlossary
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
      } catch (e) {}
    }
  };

  const handleStopMonitoring = () => {
    setMonitoredLang('none');
    audioPlayerService.stopAll();
    socketService.setMonitoredBooth(roomId, 'none');
  };

  const handleToggleBroadcast = async () => {
    if (isTogglingBroadcast) return;
    setIsTogglingBroadcast(true);
    setBroadcastError(null);

    try {
      if (isBroadcasting) {
        audioRecorderService.stopRecording();
        setIsBroadcasting(false);
        setLiveInterimSpeech('');
        socketService.send({ type: 'host_broadcast_state', roomId, isBroadcasting: false });
      } else {
        await audioPlayerService.unlockAudio(roomId, 'es');
        const activeStt = localStorage.getItem('lv_stt_engine') || sttEngine || 'deepgram';
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
            const targetLang = (lang && lang !== 'auto') 
              ? (lang.length > 2 ? lang.slice(0, 2) : lang)
              : (activeLang === 'auto' ? 'auto' : (activeLang ? activeLang.slice(0, 2) : 'auto'));
            socketService.sendSpeechAudio(audioBase64, mimeType, targetLang, {
              medicalMode: medicalConfigRef.current.medicalMode,
              medicalSpecialty: medicalConfigRef.current.medicalSpecialty,
              customGlossary: medicalConfigRef.current.customGlossary
            });
          },
          onSpeechText: (finalText) => {
            sendSpeechToEngines(finalText);
          }
        });
        setIsBroadcasting(true);
        socketService.send({ type: 'host_broadcast_state', roomId, isBroadcasting: true });
      }
    } catch (err) {
      console.error('[HostView] Error al alternar emisión:', err);
      setBroadcastError(err?.message || 'No se pudo acceder al micrófono o iniciar la emisión.');
    } finally {
      setIsTogglingBroadcast(false);
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

  const renderInspectorContent = (isMobile = false) => (
    <div className="space-y-4">
      {/* Mobile top tabs */}
      {isMobile && (
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80">
          {[
            { id: 'cabins', label: 'Cabinas' },
            { id: 'qa', label: `Q&A ${qaQueue.filter(q => q.status === 'pending').length ? `(${qaQueue.filter(q => q.status === 'pending').length})` : ''}` },
            { id: 'room', label: 'Sala' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setInspectorTab(t.id)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                inspectorTab === t.id
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-2xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab: Cabinas */}
      {inspectorTab === 'cabins' && (
        <div className="space-y-4 text-left animate-fadeIn">
          {/* Headphone Monitor & Volume Card */}
          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Retorno de Auriculares</span>
              </div>
              {monitoredLang !== 'none' ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {monitoredLang.toUpperCase()} activo
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 font-mono text-[10px] font-medium">
                  Silenciado
                </span>
              )}
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {monitoredLang !== 'none'
                ? `Monitoreando retorno en directo en ${monitoredLang.toUpperCase()}. Silencia cuando hables al micrófono para evitar eco.`
                : 'Silenciado para no escuchar eco mientras hablas. Selecciona una cabina para audicionar su locución.'}
            </p>

            <div className="pt-0.5 flex gap-2">
              {monitoredLang !== 'none' ? (
                <button
                  onClick={handleStopMonitoring}
                  className="flex-1 py-1.5 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Silenciar Retorno</span>
                </button>
              ) : (
                <div className="flex-1 text-[11px] text-zinc-400 dark:text-zinc-500 italic flex items-center">
                  Selecciona una cabina abajo para escuchar.
                </div>
              )}
              <button
                type="button"
                onClick={() => audioPlayerService.playAudioTestTone()}
                className="py-1.5 px-3 rounded-2xl bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 flex-shrink-0 shadow-2xs"
                title="Probar sonido de altavoz o auriculares locales"
              >
                <Bell className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                <span>Probar</span>
              </button>
            </div>

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
                onClick={() => (onNavigateVoices ? onNavigateVoices() : setIsVoiceCatalogOpen(true))}
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

              return (
                <div
                  key={cab.code}
                  className={`p-3.5 rounded-2xl border transition-all space-y-2.5 shadow-2xs ${
                    isMonitored
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-800/50'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CountryFlag code={cab.code} className="w-5 h-5 rounded-xs shadow-2xs flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-950 dark:text-zinc-100">{cab.name}</div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[130px]">{voice}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleToggleMonitoring(cab.code)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-mono transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                          isMonitored
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-300'
                        }`}
                        title={isMonitored ? 'Silenciar auricular' : `Escuchar ${cab.name}`}
                      >
                        <Headphones className="w-3 h-3" />
                        <span>{isMonitored ? 'Activo' : 'Escuchar'}</span>
                      </button>

                      <button
                        onClick={() => handlePreviewChannelVoice(cab.code)}
                        disabled={isAuditioning}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-2xs ${
                          isAuditioning
                            ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 animate-pulse'
                            : 'bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-800 dark:text-zinc-200'
                        }`}
                        title="Audicionar muestra de voz"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    </div>
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
                  {roomStats.totalListeners || rawParticipants.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Canal de Ponente:</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 uppercase">{sourceLanguage.slice(0, 2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Latencia Red:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{socketLatency}ms</span>
              </div>
            </div>

            {/* Directorio de Participantes Unificado Listener-Style */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 shadow-2xs overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Participantes en Sala
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-zinc-200/70 dark:bg-zinc-800/70 text-[10px] font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                    {rawParticipants.length + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAttendeesModalOpen(true)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer font-medium"
                  >
                    Ver todos
                  </button>
                </div>
              </div>

              {/* Buscador si hay participantes */}
              {rawParticipants.length > 2 && (
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
              <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
                {/* Ponente / Anfitrión Fila Pinned */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                        P
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-zinc-900" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        Tú (Anfitrión)
                      </div>
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                        Emisión principal
                      </div>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                    <span className={`w-1 h-1 rounded-full ${isBroadcasting ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                    {isBroadcasting ? 'EN DIRECTO' : 'EN SALA'}
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
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex items-center gap-1.5">
                            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                              {att.name || 'Oyente'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
                            <CountryFlag code={att.lang || 'es'} className="w-3 h-3 rounded-full object-cover shrink-0" />
                            <span className="text-[9px] font-mono font-medium text-zinc-500 uppercase">
                              {att.lang || 'es'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleKickAttendee(att.id, att.name)}
                            className="px-2 py-0.5 text-[10px] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
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
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 dark:border-t-zinc-100 animate-spin" />
          <Radio className="w-5 h-5 text-zinc-600 dark:text-zinc-400 absolute" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Iniciando estudio de emisión...
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            {roomId}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh min-h-dvh w-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans select-none transition-colors">
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* CABECERA MÓVIL (MOBILE HEADER 48px, sm:hidden)                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="sm:hidden h-12 w-full bg-white dark:bg-zinc-950 px-3 flex items-center justify-between z-30 select-none flex-shrink-0">
        <button
          type="button"
          onClick={() => onLeave({ reason: 'voluntary', isMobile: true })}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
          title="Salir al inicio"
          aria-label="Salir al inicio"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleCopyMeetingLink}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 transition-all cursor-pointer truncate shadow-2xs"
          title="Copiar vínculo de la sala"
        >
          <span>{roomId}</span>
          {hasCopiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />}
        </button>

        <button
          type="button"
          onClick={() => setIsQrModalOpen(true)}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
          title="Proyectar código QR"
          aria-label="Proyectar código QR"
        >
          <QrCode className="w-4 h-4" />
        </button>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CABECERA ESCRITORIO (DESKTOP HEADER 48px, hidden sm:flex)     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="hidden sm:flex h-12 w-full border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 px-4 items-center justify-between flex-shrink-0 z-30 select-none">
        <div className="flex items-center gap-3">
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
                label: 'Resumen de sesión IA',
                onClick: handleGenerateSummary
              },
              {
                label: 'Catálogo de Voces',
                onClick: () => (onNavigateVoices ? onNavigateVoices() : setIsVoiceCatalogOpen(true))
              },
              {
                label: 'Ajustes de Sala',
                onClick: () => onOpenSettings && onOpenSettings()
              }
            ]}
          />
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[200px]">{roomTitle}</span>
          </div>
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

          {/* Píldora de Perfil del Anfitrión con UserMenu de standalone-assistant */}
          <button
            ref={hostUserMenuTriggerRef}
            type="button"
            onClick={() => setIsHostUserMenuOpen(prev => !prev)}
            className="flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-2xs select-none"
            title="Tu perfil en la sala"
            aria-label="Perfil del anfitrión"
          >
            <div className="w-6 h-6 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-[10px] font-bold">
              P
            </div>
            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
              Ponente
            </span>
          </button>

          <UserMenu
            isOpen={isHostUserMenuOpen}
            onClose={() => setIsHostUserMenuOpen(false)}
            anchorElement={hostUserMenuTriggerRef.current}
            userName="Ponente / Anfitrión"
            userRole="host"
            canAccessAdmin={true}
            onOpenSettings={onOpenSettings}
            onOpenAdminPanel={onOpenSettings}
            onLogout={() => onLeave({ reason: 'voluntary' })}
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
      {/* CUERPO PRINCIPAL (3 ZONAS: CONTROLES, STAGE, INSPECTOR)        */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 w-full flex flex-row overflow-hidden">

        {/* ─────────────────────────────────────────────────────────── */}
        {/* ZONA 1: PANEL DE CONTROL DE EMISIÓN (hidden sm:flex, w-80)  */}
        {/* ─────────────────────────────────────────────────────────── */}
        <aside className="hidden sm:flex w-80 h-full border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex-col flex-shrink-0 select-none overflow-hidden">
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
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5 flex flex-col justify-between space-y-5">
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
                      ...devices.map((d, i) => ({
                        value: d.deviceId,
                        label: d.label || `Micrófono ${i + 1}`
                      }))
                    ]}
                    onChange={(_, val) => setSelectedDevice(val || 'default')}
                  />
                </div>

                {/* Speaker Language con SelectDropdown de standalone-assistant */}
                <div className="space-y-1.5">
                  <label htmlFor="host-speaker-lang" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                    Idioma del Ponente
                  </label>
                  <SelectDropdown
                    id="host-speaker-lang"
                    aria-label="Idioma del Ponente"
                    value={sourceLanguage}
                    options={SPEAKER_LANGUAGES.map((langItem) => ({
                      value: langItem.langCode,
                      label: langItem.label
                    }))}
                    onChange={(_, val) => {
                      if (val) {
                        setSourceLanguage(val);
                        audioRecorderService.setLanguage(val);
                      }
                    }}
                  />
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
                    leftLabel={
                      <span className="inline-flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span>Rápido (3s)</span>
                      </span>
                    }
                    rightLabel={
                      <span className="inline-flex items-center gap-1">
                        <Mic className="w-3 h-3 text-zinc-400" />
                        <span>Ponencia (6s)</span>
                      </span>
                    }
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
                      className="h-full w-full bg-emerald-500 rounded-full origin-left will-change-transform"
                      style={{ transform: 'scaleX(0)', transition: 'transform 0.05s linear' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Botón Maestro de Emisión Anclado al Pie */}
            <div className="pt-2">
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
                    <span>Iniciar Emisión en Directo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* ZONA 2: STUDIO STAGE (CENTRAL CANVAS)                       */}
        {/* ─────────────────────────────────────────────────────────── */}
        <section className="flex-1 min-w-0 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden">
          {/* Canvas Header (Alineado con datum line h-14 de las columnas laterales) */}
          <div className="h-14 border-b border-zinc-200 dark:border-zinc-800/80 px-6 flex items-center justify-between bg-white dark:bg-zinc-950 flex-shrink-0">
            <div>
              <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <span>{roomTitle}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${isBroadcasting ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
              </h1>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {roomStats.totalListeners} oyente{roomStats.totalListeners === 1 ? '' : 's'} conectados · Emisión neuronal en 4 cabinas
              </p>
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

          {/* Canvas Body con Subtítulos y Barra de Emisión Manual */}
          <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden p-4 sm:p-6 space-y-3">
            {/* Error Banner */}
            {broadcastError && (
              <div className="flex-shrink-0">
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
            )}

            {/* Subtítulos a Pantalla Completa */}
            <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden">
              <LiveCaptions
                transcriptHistory={transcriptHistory}
                interimText={liveInterimSpeech}
                currentLanguage={sourceLanguage.slice(0, 2)}
                showOriginal={true}
                medicalMode={medicalConfig.medicalMode}
                className="flex-1 flex flex-col h-full min-h-0 w-full"
                maxHeightClass="flex-1 h-full min-h-0"
                captionSize={captionSize}
              />
            </div>

            {/* Desktop Bottom Prompt (Limpio, sin barra flotante redundante de retorno) */}
            <div className="hidden sm:flex flex-col gap-2 pt-1 flex-shrink-0">
              <form onSubmit={handleSendCustomText} className="flex items-center gap-2">
                <input
                  type="text"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Escribe cualquier frase aquí para emitir por voz en las 4 cabinas..."
                  className="flex-1 h-10 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-300 transition-colors shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!manualText.trim()}
                  className="h-10 px-5 rounded-2xl bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-xs whitespace-nowrap cursor-pointer transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-xs active:scale-95"
                >
                  <span>Emitir</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
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
              {renderInspectorContent(false)}
            </div>
          </aside>
        )}

        {/* Mobile Right Drawer for Inspector */}
        {isMobileInspectorOpen && (
          <div className="fixed inset-0 z-50 sm:hidden flex justify-end">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileInspectorOpen(false)}
            />
            <aside className="relative w-full sm:w-96 max-w-[92vw] h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col p-4 space-y-4 overflow-y-auto shadow-2xl z-10 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Inspector de Sala
                </span>
                <button
                  onClick={() => setIsMobileInspectorOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-pointer"
                  title="Cerrar panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {renderInspectorContent(true)}
            </aside>
          </div>
        )}

      </div>

      {/* Mobile Master Broadcast Dock (Fixed Thumb Zone) */}
      <div className="sm:hidden">
        <MasterBroadcastDock
          isBroadcasting={isBroadcasting}
          onToggleBroadcast={handleToggleBroadcast}
          isToggling={isTogglingBroadcast}
          monitoredLang={monitoredLang}
          onToggleMonitoring={handleToggleMonitoring}
          onOpenCabinsSheet={() => setIsCabinsSheetOpen(true)}
          onOpenQR={() => setIsQrModalOpen(true)}
          onOpenQA={() => {
            setInspectorTab('qa');
            setIsMobileInspectorOpen(true);
          }}
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

    </div>
  );
}
