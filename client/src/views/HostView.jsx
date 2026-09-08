import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Radio, Settings, Volume2, Sparkles, AudioLines, Sliders,
  RefreshCw, Check, Globe, ChevronRight, Activity, Users, QrCode, Play,
  Send, Layers, ArrowRight, Shield, Download, FileText, Stethoscope, Home,
  Search, ExternalLink, Headphones, Hand, HelpCircle, CheckCircle2, XCircle, MessageSquare
} from 'lucide-react';
import AudioVisualizer from '../components/AudioVisualizer.jsx';
import LiveCaptions from '../components/LiveCaptions.jsx';
import ElevenSlider from '../components/ElevenSlider.jsx';
import VoiceCatalogModal from '../components/VoiceCatalogModal.jsx';
import QRCodeModal from '../components/QRCodeModal.jsx';
import AttendeesModal from '../components/AttendeesModal.jsx';
import SessionSummaryModal from '../components/SessionSummaryModal.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
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
      if (stats) setRoomStats(stats);
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
        if (monitoredLang && monitoredLang !== 'none' && packet.lang === monitoredLang) {
          audioPlayerService.playAudioChunk(packet);
        }
      }
    });

    // Q&A Backchannel socket handlers
    const unsubQaRaised = socketService.on('qa_hand_raised', (item) => {
      setQaQueue(prev => {
        const exists = prev.some(q => q.questionId === item.questionId);
        if (exists) {
          return prev.map(q => q.questionId === item.questionId ? { ...q, ...item } : q);
        }
        return [...prev, item];
      });
    });

    const unsubQaSpeaker = socketService.on('qa_active_speaker', (item) => {
      setActiveQuestion(item);
      setQaQueue(prev => prev.map(q => q.questionId === item.questionId ? { ...q, status: 'speaking' } : q));
    });

    const unsubQaClosed = socketService.on('qa_question_closed', ({ questionId }) => {
      setActiveQuestion(prev => (prev && prev.questionId === questionId ? null : prev));
      setQaQueue(prev => prev.filter(q => q.questionId !== questionId));
    });

    const unsubEarpiece = socketService.on('host_earpiece_audio', (data) => {
      setIncomingQuestionAudio(data);
      if (data && data.audioBase64) {
        audioPlayerService.playAudioChunk({
          audio: data.audioBase64,
          mimeType: data.mimeType || 'audio/mp3',
          lang: data.targetLang || 'es',
          isHostPreview: true
        });
      }
    });

    return () => {
      unsubStats();
      unsubTranscript();
      unsubLatency();
      unsubAudio();
      unsubQaRaised();
      unsubQaSpeaker();
      unsubQaClosed();
      unsubEarpiece();
    };
  }, [roomId, monitoredLang]);

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

    return () => {
      unsubAudioLevel();
    };
  }, []);

  const extractContinuationDeltaHost = (prevText, newText) => {
    if (!prevText || !prevText.trim()) return (newText || '').trim();
    if (!newText || !newText.trim()) return '';

    const cleanPrev = prevText.trim();
    const cleanNew = newText.trim();

    const normalize = (s) =>
      s
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¡¿]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normPrev = normalize(cleanPrev);
    const normNew = normalize(cleanNew);

    if (normPrev === normNew) return '';

    const prevWords = normPrev.split(' ').filter(Boolean);
    const newWords = normNew.split(' ').filter(Boolean);
    const originalWords = cleanNew.split(/\s+/).filter(Boolean);

    // 1. Direct word prefix match
    if (newWords.length > prevWords.length) {
      let match = true;
      for (let i = 0; i < prevWords.length; i++) {
        if (newWords[i] !== prevWords[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return originalWords.slice(prevWords.length).join(' ').trim();
      }
    }

    // 2. Substring match
    if (normNew.startsWith(normPrev)) {
      const rawDelta = cleanNew.slice(cleanPrev.length).trim();
      return rawDelta.replace(/^[.,;:!?\s]+/, '').trim();
    }

    // 3. Anchor suffix match (last 2-3 words of previous text)
    if (prevWords.length >= 2 && newWords.length > prevWords.length) {
      const anchor = prevWords.slice(-3);
      const anchorLen = anchor.length;
      for (let i = Math.max(0, prevWords.length - 4); i <= prevWords.length + 2 && i + anchorLen <= newWords.length; i++) {
        let anchorMatch = true;
        for (let j = 0; j < anchorLen; j++) {
          if (newWords[i + j] !== anchor[j]) {
            anchorMatch = false;
            break;
          }
        }
        if (anchorMatch) {
          const delta = originalWords.slice(i + anchorLen).join(' ').trim();
          if (delta) return delta;
        }
      }
    }

    // If neither prefix nor anchor matched, it is a distinct utterance/sentence
    return cleanNew;
  };

  const sendSpeechToEngines = (finalText) => {
    if (!finalText || !finalText.trim()) return;
    const cleanText = finalText.trim();
    const now = Date.now();

    const normalize = (s) =>
      s
        .toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'¡¿]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    let textToEmit = cleanText;

    // Layer 2 Defense: check against recent emissions history (within last 90 seconds)
    // Strip out any previously emitted sentences to guarantee that historical paragraphs NEVER re-emit!
    const recentHistory = recentEmissionsHistoryRef.current.filter(item => now - item.time < 90000);
    recentEmissionsHistoryRef.current = recentHistory;

    for (const recent of recentHistory) {
      const normRecent = recent.norm;
      if (!normRecent || normRecent.length < 5) continue;
      
      const normCurrent = normalize(textToEmit);
      if (normCurrent.includes(normRecent)) {
        const originalWords = textToEmit.split(/\s+/);
        const recentWords = recent.text.split(/\s+/);
        
        // If current text starts with recent utterance, strip that prefix
        if (normCurrent.startsWith(normRecent) && originalWords.length > recentWords.length) {
          textToEmit = originalWords.slice(recentWords.length).join(' ').trim();
          console.log(`[HostView] 🛡️ Stripped recent prefix from speech: "${recent.text}"`);
        } else if (normCurrent === normRecent) {
          console.log(`[HostView] 🛡️ Discarded duplicate historical speech: "${recent.text}"`);
          return;
        }
      }
    }

    // Layer 2.1: Continuation delta against immediate previous utterance
    const prevCumulative = lastCumulativeSpeechRef.current.text;
    const prevTime = lastCumulativeSpeechRef.current.time;

    if (prevCumulative && (now - prevTime < 12000)) {
      const delta = extractContinuationDeltaHost(prevCumulative, textToEmit);
      if (delta !== textToEmit) {
        console.log(`[HostView] 🛡️ Layer 2 stripped repeated sentence prefix. Previous: "${prevCumulative}", Delta: "${delta}"`);
        if (!delta || !delta.trim()) {
          console.log('[HostView] 🛡️ Layer 2 suppressed duplicate emission (empty delta).');
          return;
        }
        textToEmit = delta.trim();
      }
    }

    // Deduplication guard: ignore identical utterances within 8 seconds with robust normalization
    const normEmit = normalize(textToEmit);
    const normLastSent = normalize(lastSentSpeechRef.current.text || '');

    if (
      normLastSent &&
      normEmit === normLastSent &&
      now - lastSentSpeechRef.current.time < 8000
    ) {
      console.log('[HostView] 🛡️ Suppressed duplicate speech emission:', textToEmit);
      return;
    }

    if (!textToEmit || !textToEmit.trim()) return;

    lastSentSpeechRef.current = { text: textToEmit, time: now };
    recentEmissionsHistoryRef.current.push({
      text: textToEmit,
      norm: normalize(textToEmit),
      time: now
    });
    
    // Accumulate clean cumulative transcript across continuous speech
    const prevHistory = (now - prevTime < 12000 && lastCumulativeSpeechRef.current.text) ? lastCumulativeSpeechRef.current.text : '';
    const newCumulative = prevHistory ? `${prevHistory} ${textToEmit}` : textToEmit;
    lastCumulativeSpeechRef.current = { text: newCumulative, time: now };

    setLiveInterimSpeech('');

    // Transmit strictly ONE single socket event to server AI pipeline for translation and multi-booth TTS
    socketService.sendSpeechText(textToEmit, sourceLanguage.slice(0, 2), ['es', 'en', 'it', 'pt'], {
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
            socketService.sendSpeechAudio(audioBase64, mimeType, lang || sourceLanguage.slice(0, 2), {
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

  const currentPrimaryVoiceName = selectedVoices.es ? (selectedVoices.es.includes('Elvira') ? 'Elvira Neural (ES)' : selectedVoices.es) : 'Elvira Neural';

  return (
    <div className="h-screen w-full flex bg-[#f7f7f8] text-neutral-900 overflow-hidden font-sans select-none">
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* COLUMNA 1: SIDEBAR DE NAVEGACIÓN (Estilo ElevenLabs exacto)  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <aside className="w-64 h-screen border-r border-neutral-200 bg-[#fcfcfd] flex-shrink-0 flex flex-col justify-between">
        <div>
          {/* Top Logo (II LiftVoice) */}
          <div className="h-14 px-5 flex items-center justify-between border-b border-neutral-200 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-4.5 bg-neutral-900 rounded-full" />
                <div className="w-1.5 h-3 bg-neutral-900 rounded-full" />
              </div>
              <span className="font-bold text-sm text-neutral-950 tracking-tight">
                LiftVoice
              </span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                STUDIO
              </span>
            </div>
          </div>

          {/* Main Navigation Tools */}
          <div className="p-3 space-y-1">
            <button
              onClick={onLeave}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4 text-neutral-400" />
              <span>Inicio / Salir</span>
            </button>

            <button
              onClick={() => (onNavigateVoices ? onNavigateVoices() : setIsVoiceCatalogOpen(true))}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4 text-neutral-500" />
                <span>Voces</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </button>

            <div className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-neutral-950 bg-neutral-200/70 shadow-xs">
              <Radio className="w-4 h-4 text-neutral-950" />
              <span>Studio</span>
            </div>

            <button
              onClick={handleGenerateSummary}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-neutral-500" />
                <span>Resumen IA</span>
              </div>
              <span className="text-[9px] text-neutral-400 font-mono">1-CLICK</span>
            </button>
          </div>

          {/* Section: Fijado / Herramientas de Sala */}
          <div className="p-3 pt-3 space-y-1 border-t border-neutral-200">
            <div className="px-3.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 font-mono">
              Fijado
            </div>

            <div className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-800 bg-neutral-100/70 border border-neutral-200">
              <div className="flex items-center gap-2.5">
                <Mic className="w-3.5 h-3.5 text-neutral-900" />
                <span>Traducción Simultánea</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <button
              onClick={() => setIsQrModalOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <QrCode className="w-3.5 h-3.5 text-neutral-400" />
                <span>Proyectar QR</span>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">{roomId}</span>
            </button>

            <button
              onClick={() => setIsAttendeesModalOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-3.5 h-3.5 text-neutral-400" />
                <span>Asistentes</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700 text-[10px] font-mono font-semibold">
                {roomStats.attendees?.length || 0}
              </span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer Card (Workspace style ElevenLabs) */}
        <div className="p-3.5 m-3 bg-white border border-neutral-200 rounded-2xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-800">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Red Local
            </span>
            <span className="font-mono text-neutral-400 text-[11px]">{socketLatency}ms</span>
          </div>
          <p className="text-[11px] text-neutral-400 truncate font-mono">
            {localIp}:5173
          </p>
        </div>
      </aside>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CONTENIDO PRINCIPAL: TOP BAR + 2 COLUMNAS (STAGE + INSPECTOR) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        
        {/* Top Header Bar */}
        <header className="h-14 border-b border-neutral-200 px-6 flex items-center justify-between bg-white flex-shrink-0">
          {/* Breadcrumb & Live indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-600">
              <Radio className="w-3.5 h-3.5 text-neutral-500" />
              <span>Estudio de Emisión</span>
            </div>
            <span className="text-neutral-300">•</span>
            <button
              onClick={handleCopyMeetingLink}
              title="Copiar vínculo de la reunión para asistentes"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-200 px-2.5 py-1 rounded-md transition-all cursor-pointer shadow-2xs"
            >
              <span>{roomId}</span>
              {hasCopiedLink ? (
                <span className="text-[10px] text-emerald-600 font-sans font-medium flex items-center gap-0.5">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Copiado
                </span>
              ) : (
                <span className="text-[10px] text-neutral-400 hover:text-neutral-600 font-sans font-normal">
                  Copiar vínculo
                </span>
              )}
            </button>
            <span className="text-neutral-300">•</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isBroadcasting ? 'bg-red-500 animate-pulse' : 'bg-neutral-300'}`} />
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">
                {isBroadcasting ? 'En Directo (4 Cabinas)' : 'En Pausa'}
              </span>
            </div>
          </div>

          {/* Search pill ⌘K (ElevenLabs exact style) */}
          <div className="hidden lg:flex items-center w-72 h-8.5 bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-200 rounded-full px-3.5 text-xs text-neutral-400 justify-between transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-neutral-400" />
              <span>Buscar en todo...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-neutral-200 rounded text-neutral-400 shadow-xs">⌘K</kbd>
          </div>

          {/* Right Links & User */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="h-8 px-3 rounded-full bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-200 text-neutral-800 text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Haz clic para cambiar el transcriptor o las voces"
            >
              <Mic className="w-3 h-3 text-emerald-600" />
              <span>STT: <strong className="text-neutral-950 font-semibold">{sttEngine === 'deepgram' ? 'Deepgram ⚡' : sttEngine === 'webspeech' ? 'Web Speech 🌐' : 'Whisper 🤖'}</strong></span>
            </button>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-xs text-neutral-600 hover:text-neutral-950 font-medium transition-colors cursor-pointer"
            >
              Configuración
            </button>
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="h-9 px-5 rounded-full border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-800 flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <QrCode className="w-3.5 h-3.5 text-neutral-700" />
              <span>Proyectar QR</span>
            </button>
            <div className="w-7.5 h-7.5 rounded-full bg-neutral-950 text-white flex items-center justify-center text-xs font-bold font-mono">
              LV
            </div>
          </div>
        </header>

        {/* 2-Column Body: Center Stage + Right Inspector */}
        <div className="flex-1 flex flex-row overflow-hidden bg-white">
          
          {/* ───────────────────────────────────────────────────────── */}
          {/* COLUMNA 2: STUDIO STAGE (AMPLIO, LIMPIO, ELEVENLABS)       */}
          {/* ───────────────────────────────────────────────────────── */}
          <main className="flex-1 flex flex-col justify-between p-8 lg:p-10 overflow-y-auto bg-white">
            <div className="w-full max-w-4xl mx-auto space-y-6 flex-1 flex flex-col justify-between">
              
              {/* Stage Top Bar: Title & Primary Actions */}
              <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold text-neutral-950 tracking-tight">
                    {roomTitle}
                  </h1>
                  <p className="text-xs text-neutral-500">
                    {roomStats.totalListeners} oyente{roomStats.totalListeners === 1 ? '' : 's'} conectados en las 4 cabinas de audio simultáneo
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  {activeQuestion ? (
                    <div className="h-9 px-3.5 rounded-full bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span>Q&A en aire: {activeQuestion.name}</span>
                      <button
                        onClick={() => handleCloseQuestion(activeQuestion.questionId)}
                        className="ml-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer"
                      >
                        Cerrar
                      </button>
                    </div>
                  ) : qaQueue.some(q => q.status === 'pending') ? (
                    <button
                      onClick={() => setInspectorTab('qa')}
                      className="h-9 px-3.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm animate-pulse cursor-pointer"
                    >
                      <Hand className="w-3.5 h-3.5" />
                      <span>{qaQueue.filter(q => q.status === 'pending').length} Turno(s) Q&A</span>
                    </button>
                  ) : null}

                  <button
                    onClick={() => window.open(`/?room=${roomId}&lang=${monitoredLang !== 'none' ? monitoredLang : 'en'}`, '_blank')}
                    className="h-9 px-4 rounded-full border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    title="Abre la cabina en una pestaña nueva como oyente para verificar cómo se escucha y moderar la sala"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Moderar como Oyente</span>
                  </button>

                  <button
                    onClick={handleGenerateSummary}
                    className="h-9 px-5 rounded-full border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Resumen Ejecutivo</span>
                  </button>

                  <button
                    onClick={() => (onNavigateVoices ? onNavigateVoices() : setIsVoiceCatalogOpen(true))}
                    className="h-9 px-5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Explorar Voces</span>
                  </button>
                </div>
              </div>

              {/* Main Subtitles & Audio Stream Monitor Card */}
              <div className="border border-neutral-200 rounded-2xl bg-white shadow-xs overflow-hidden flex-1 min-h-[320px] flex flex-col">
                <div className="h-11 px-4 border-b border-neutral-200 bg-neutral-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-900">Subtítulos e Interpretación en Vivo</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-semibold">
                      4 CABINAS
                    </span>
                  </div>

                  {/* ElevenLabs Subtle Waveform Visualizer */}
                  <div className="h-6 w-32 flex items-center">
                    <AudioVisualizer
                      mode="bars"
                      height={24}
                      barCount={24}
                      isActive={isBroadcasting}
                      barColor="#09090b"
                      getFrequencyDataFn={() => audioRecorderService.getFrequencyData()}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                  <LiveCaptions
                    transcriptHistory={transcriptHistory}
                    interimText={liveInterimSpeech}
                    currentLanguage={sourceLanguage.slice(0, 2)}
                    showOriginal={true}
                    medicalMode={medicalConfig.medicalMode}
                    className="flex-1 flex flex-col"
                    maxHeightClass="flex-1 min-h-[220px] max-h-[420px]"
                  />
                </div>
              </div>

              {/* ElevenLabs Interactive Prompt Station & Broadcast Controls */}
              <div className="space-y-4 pt-2">
                {/* Master Studio Broadcast & Input Dock */}
                <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    
                    {/* Large Studio Broadcast Pill Button */}
                    <button
                      onClick={handleToggleBroadcast}
                      className={`h-11 px-6 rounded-full flex items-center gap-2.5 transition-all cursor-pointer font-semibold text-xs shadow-xs ${
                        isBroadcasting
                          ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25 animate-pulse'
                          : 'bg-neutral-950 hover:bg-neutral-800 text-white'
                      }`}
                    >
                      {isBroadcasting ? (
                        <>
                          <MicOff className="w-4 h-4" />
                          <span>Detener Transmisión en Directo</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" />
                          <span>Iniciar Emisión en Directo</span>
                        </>
                      )}
                    </button>

                    {/* Zero-Reflow GPU VAD Meter */}
                    <div className="w-48 p-2.5 rounded-xl bg-white border border-neutral-200 space-y-1 shadow-xs">
                      <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                        <span className="flex items-center gap-1 font-semibold text-neutral-700">
                          <Activity className="w-3 h-3 text-emerald-600" />
                          SEÑAL VAD
                        </span>
                        <span ref={meterTextRef} className="font-bold text-neutral-900 tabular-numbers">0%</span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
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
                      placeholder="O escribe cualquier frase aquí para interpretar y sintetizar en directo..."
                      className="flex-1 h-10 bg-white border border-neutral-200 rounded-xl px-4 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 transition-colors shadow-xs"
                    />
                    <button
                      type="submit"
                      disabled={!manualText.trim()}
                      className="h-10 px-5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white font-medium text-xs whitespace-nowrap cursor-pointer transition-all disabled:opacity-40 flex items-center gap-2 shadow-xs"
                    >
                      <span>Emitir</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>

                  {/* Direct Earphone Booth Monitor Bar (Studio Audio Return) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-neutral-200/70 text-xs">
                    <div className="flex items-center gap-2">
                      <Headphones className={`w-3.5 h-3.5 ${monitoredLang !== 'none' ? 'text-emerald-600 animate-pulse' : 'text-neutral-400'}`} />
                      <span className="font-medium text-neutral-700 text-[11px]">
                        Retorno de Audio en Auriculares:
                      </span>
                      {monitoredLang !== 'none' ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold">
                          ACTIVO ({monitoredLang.toUpperCase()})
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-400 font-mono">SILENCIADO</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleToggleMonitoring('none')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                          monitoredLang === 'none'
                            ? 'bg-neutral-900 text-white shadow-xs'
                            : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        Silencio
                      </button>
                      {ALL_CABINS.map(cab => (
                        <button
                          key={cab.code}
                          type="button"
                          onClick={() => handleToggleMonitoring(cab.code)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                            monitoredLang === cab.code
                              ? 'bg-emerald-600 text-white font-semibold shadow-xs ring-1 ring-emerald-500'
                              : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                          }`}
                          title={`Escuchar retorno en directo para ${cab.name}`}
                        >
                          <span>{cab.flag}</span>
                          <span>{cab.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </main>

          {/* ───────────────────────────────────────────────────────── */}
          {/* COLUMNA 3: PANEL DE INSPECCIÓN (w-88 / 352px Fijo)         */}
          {/* ───────────────────────────────────────────────────────── */}
          <aside className="w-88 h-full border-l border-neutral-200 bg-[#fcfcfd] flex-shrink-0 flex flex-col p-6 space-y-6 overflow-y-auto">
            
            {/* Top Tabs: Configuración | Cabinas en Vivo | Q&A */}
            <div className="flex items-center gap-4 border-b border-neutral-200 pb-2.5">
              <button
                onClick={() => setInspectorTab('config')}
                className={`text-xs font-bold transition-all cursor-pointer relative pb-1 ${
                  inspectorTab === 'config'
                    ? 'text-neutral-950'
                    : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <span>Configuración</span>
                {inspectorTab === 'config' && (
                  <span className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-neutral-950 rounded-full" />
                )}
              </button>

              <button
                onClick={() => setInspectorTab('cabins')}
                className={`text-xs font-medium transition-all cursor-pointer relative pb-1 flex items-center gap-1.5 ${
                  inspectorTab === 'cabins'
                    ? 'text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <span>Cabinas</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {inspectorTab === 'cabins' && (
                  <span className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-neutral-950 rounded-full" />
                )}
              </button>

              <button
                onClick={() => setInspectorTab('qa')}
                className={`text-xs font-medium transition-all cursor-pointer relative pb-1 flex items-center gap-1.5 ${
                  inspectorTab === 'qa'
                    ? 'text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <span>Q&A</span>
                {qaQueue.filter(q => q.status === 'pending').length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {qaQueue.filter(q => q.status === 'pending').length}
                  </span>
                )}
                {inspectorTab === 'qa' && (
                  <span className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-neutral-950 rounded-full" />
                )}
              </button>
            </div>

            {/* Tab: Configuración */}
            {inspectorTab === 'config' && (
              <div className="space-y-6 text-left animate-fadeIn">
                
                {/* Banner Card: Neural Pipeline (Style ElevenLabs Flows banner) */}
                <div className="bg-gradient-to-br from-rose-50 via-orange-50 to-pink-50 border border-rose-200/70 rounded-2xl p-4 space-y-1 shadow-xs">
                  <div className="text-[10px] font-mono font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>PRUEBA CABINAS SIMULTÁNEAS</span>
                  </div>
                  <div className="text-xs font-bold text-neutral-950">
                    Deepgram Aura & Qwen 3.8
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-relaxed">
                    Síntesis ultra-rápida (&lt;170ms TTFB) y traducción simultánea continua sin pausas entre frases.
                  </p>
                </div>

                {/* Active Voice Card */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-900 block">
                    Voz Activa
                  </label>
                  <button
                    onClick={() => (onNavigateVoices ? onNavigateVoices() : setIsVoiceCatalogOpen(true))}
                    className="w-full p-3 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 flex items-center justify-between shadow-xs cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-950 text-white flex items-center justify-center font-bold text-xs">
                        {currentPrimaryVoiceName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-neutral-950">{currentPrimaryVoiceName}</div>
                        <div className="text-[11px] text-neutral-500">Deepgram Aura &bull; Resonante, Natural</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  </button>
                </div>

                {/* Translation Engine */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-900 flex items-center justify-between">
                    <span>Modelo de Traducción</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono font-bold">Activo</span>
                  </label>
                  <div className="p-3 rounded-xl border border-neutral-200 bg-white shadow-xs space-y-0.5">
                    <div className="text-xs font-bold text-neutral-950">Alibaba Qwen 3.8</div>
                    <p className="text-[11px] text-neutral-500">Pesos abiertos (27B) con contexto continuo de oratoria.</p>
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
                <div className="space-y-2 pt-2 border-t border-neutral-200">
                  <label className="text-xs font-semibold text-neutral-900 block">
                    Dispositivo de Micrófono
                  </label>
                  <select
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:border-neutral-950 transition-colors shadow-xs cursor-pointer"
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
                  <label className="text-xs font-semibold text-neutral-900 block">
                    Idioma en que Hablas
                  </label>
                  <select
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:border-neutral-950 transition-colors shadow-xs cursor-pointer"
                  >
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
                <div className="p-3.5 rounded-2xl border border-neutral-200 bg-white space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-neutral-800" />
                      <span className="text-xs font-bold text-neutral-900">Retorno de Auriculares</span>
                    </div>
                    {monitoredLang !== 'none' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[10px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {monitoredLang.toUpperCase()} ACTIVO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-mono text-[10px] font-medium">
                        SILENCIADO
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    {monitoredLang !== 'none'
                      ? `Monitoreando la cabina en ${monitoredLang.toUpperCase()}. Usa el botón abajo para salir de la sala en cualquier momento.`
                      : 'Por defecto los audífonos están silenciados para no escuchar retorno ni eco mientras hablas al micrófono.'}
                  </p>

                  <div className="pt-0.5">
                    {monitoredLang !== 'none' ? (
                      <button
                        onClick={handleStopMonitoring}
                        className="w-full py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Salir de la sala (Silenciar)</span>
                      </button>
                    ) : (
                      <div className="text-[10px] text-neutral-400 italic">
                        Pulsa &quot;Escuchar&quot; en cualquier idioma para comprobar su calidad.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-neutral-800">Cabinas de Interpretación</span>
                  <button
                    onClick={() => window.open(`/?room=${roomId}&lang=${monitoredLang !== 'none' ? monitoredLang : 'en'}`, '_blank')}
                    className="text-[11px] text-neutral-600 hover:text-neutral-950 font-medium flex items-center gap-1 hover:underline cursor-pointer"
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
                            ? 'border-emerald-300 bg-emerald-50/30 ring-1 ring-emerald-200'
                            : 'border-neutral-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">{cab.flag}</span>
                            <div>
                              <div className="text-xs font-bold text-neutral-950">{cab.name}</div>
                              <div className="text-[11px] text-neutral-500 font-mono truncate max-w-[120px]">{voice}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleToggleMonitoring(cab.code)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-mono transition-all cursor-pointer flex items-center gap-1 ${
                                isMonitored
                                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
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
                                  ? 'bg-neutral-950 text-white animate-pulse'
                                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                              }`}
                              title="Audicionar muestra de voz"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => (onNavigateVoices ? onNavigateVoices() : setIsVoiceCatalogOpen(true))}
                          className="w-full py-1.5 text-center text-xs font-semibold text-neutral-700 hover:text-neutral-950 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-200 transition-colors cursor-pointer"
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
                <div className="bg-neutral-900 text-white p-4 rounded-2xl space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hand className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold">Backchannel Bi-direccional</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono">
                      {qaQueue.length} {qaQueue.length === 1 ? 'petición' : 'peticiones'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Los oyentes levantan la mano desde su móvil, hablan en su idioma nativo y el ponente escucha la traducción en tiempo real por el auricular.
                  </p>
                </div>

                {activeQuestion && (
                  <div className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-950">
                          {activeQuestion.name} está hablando
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {activeQuestion.nativeLang?.toUpperCase()}
                      </span>
                    </div>

                    {incomingQuestionAudio && incomingQuestionAudio.originalText && (
                      <div className="bg-white/90 rounded-xl p-3 text-xs space-y-1.5 border border-emerald-200">
                        <div className="text-[10px] text-neutral-500 font-mono">Pregunta original ({incomingQuestionAudio.sourceLang?.toUpperCase()}):</div>
                        <p className="text-neutral-700 italic font-mono text-[11px]">&quot;{incomingQuestionAudio.originalText}&quot;</p>
                        <div className="text-[10px] text-emerald-700 font-mono font-semibold pt-1 border-t border-neutral-100">Traducción a tu oído ({incomingQuestionAudio.targetLang?.toUpperCase()}):</div>
                        <p className="text-neutral-950 font-semibold">{incomingQuestionAudio.translatedText}</p>
                      </div>
                    )}

                    <button
                      onClick={() => handleCloseQuestion(activeQuestion.questionId)}
                      className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Finalizar Turno de Pregunta</span>
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-neutral-800 block">
                    Peticiones de palabra ({qaQueue.filter(q => q.status === 'pending').length})
                  </span>

                  {qaQueue.filter(q => q.status === 'pending').length === 0 ? (
                    <div className="p-6 rounded-2xl border border-dashed border-neutral-200 text-center space-y-1.5 bg-white">
                      <Hand className="w-5 h-5 text-neutral-300 mx-auto" />
                      <p className="text-xs text-neutral-600 font-medium">No hay preguntas pendientes</p>
                      <p className="text-[10px] text-neutral-400">Los oyentes pueden pulsar &quot;Levantar la mano&quot; en su teléfono para pedir la palabra.</p>
                    </div>
                  ) : (
                    qaQueue.filter(q => q.status === 'pending').map((q) => (
                      <div
                        key={q.questionId}
                        className="p-3.5 rounded-2xl border border-neutral-200 bg-white shadow-xs space-y-2.5 flex flex-col"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center font-bold text-xs text-neutral-800">
                              {q.name ? q.name.slice(0, 2).toUpperCase() : 'OY'}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-neutral-900">{q.name || 'Oyente'}</div>
                              <div className="text-[10px] text-neutral-500 font-mono">Idioma nativo: {q.nativeLang?.toUpperCase() || 'ES'}</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            En espera
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleApproveQuestion(q.questionId)}
                            disabled={!!activeQuestion}
                            className="flex-1 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Dar la palabra</span>
                          </button>
                          <button
                            onClick={() => handleCloseQuestion(q.questionId)}
                            className="p-1.5 rounded-xl hover:bg-neutral-100 text-neutral-500 hover:text-rose-600 transition-colors cursor-pointer"
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

          </aside>

        </div>

      </div>

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
