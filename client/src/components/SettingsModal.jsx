import React, { useState, useEffect } from 'react';
import {
  Settings, Key, X, Check, Shield, Cpu, Zap, Volume2, Mic,
  Sparkles, Stethoscope, Activity, BookOpen, Play, Loader2, Headphones,
  Radio, User, ChevronRight, CheckCircle2, Lock, Server, Globe, VolumeX,
  Palette, Sun, Moon, Monitor
} from 'lucide-react';
import { audioPlayerService } from '../services/audioPlayer.js';
import { useTheme } from '../contexts/ThemeContext.jsx';

const safeGetItem = (key, fallback = '') => {
  try {
    const val = localStorage.getItem(key);
    return val !== null && val !== undefined ? val : fallback;
  } catch (e) {
    return fallback;
  }
};

const safeSetItem = (key, val) => {
  try {
    localStorage.setItem(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
  } catch (e) {}
};

const DEFAULT_VOICES = {
  es: 'es-ES-ElviraNeural',
  en: 'aura-asteria-en',
  it: 'it-IT-ElsaNeural',
  pt: 'pt-BR-FranciscaNeural'
};

const DEFAULT_GENDERS = {
  es: 'female',
  en: 'female',
  it: 'female',
  pt: 'female'
};

// Curated voices catalog grouped by language for fast dynamic selection
const BOOTH_VOICE_OPTIONS = {
  es: [
    { id: 'es-ES-ElviraNeural', name: 'Google Elvira', gender: 'female', engine: 'google', desc: 'Fluida y natural • Universal 🌐' },
    { id: 'es-ES-AlvaroNeural', name: 'Google Álvaro', gender: 'male', engine: 'google', desc: 'Claro y profesional • Universal 🌐' },
    { id: 'nova', name: 'OpenAI Nova', gender: 'female', engine: 'openai', desc: 'Expresiva y cálida • OpenAI 🤖' },
    { id: 'alloy', name: 'OpenAI Alloy', gender: 'neutral', engine: 'openai', desc: 'Neutra y corporativa • OpenAI 🤖' },
    { id: 'echo', name: 'OpenAI Echo', gender: 'male', engine: 'openai', desc: 'Barítono suave • OpenAI 🤖' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'ElevenLabs Rachel', gender: 'female', engine: 'elevenlabs', desc: 'Fotorrealismo insignia • 11Labs 🌟' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'ElevenLabs Antoni', gender: 'male', engine: 'elevenlabs', desc: 'Cinematográfico • 11Labs 🌟' }
  ],
  en: [
    { id: 'aura-asteria-en', name: 'Deepgram Asteria', gender: 'female', engine: 'deepgram', desc: 'Ultra-baja latencia ~150ms • Aura ⚡' },
    { id: 'aura-orion-en', name: 'Deepgram Orion', gender: 'male', engine: 'deepgram', desc: 'Barítono confiado ~150ms • Aura ⚡' },
    { id: 'aura-luna-en', name: 'Deepgram Luna', gender: 'female', engine: 'deepgram', desc: 'Serena y pausada • Aura ⚡' },
    { id: 'aura-stella-en', name: 'Deepgram Stella', gender: 'female', engine: 'deepgram', desc: 'Directa e institucional • Aura ⚡' },
    { id: 'aura-arcas-en', name: 'Deepgram Arcas', gender: 'male', engine: 'deepgram', desc: 'Amigable y cercano • Aura ⚡' },
    { id: 'en-US-JennyNeural', name: 'Google Jenny', gender: 'female', engine: 'google', desc: 'Articulación nítida • Universal 🌐' },
    { id: 'en-US-GuyNeural', name: 'Google Guy', gender: 'male', engine: 'google', desc: 'Seguro y cálido • Universal 🌐' },
    { id: 'alloy', name: 'OpenAI Alloy', gender: 'neutral', engine: 'openai', desc: 'Neutra y dinámica • OpenAI 🤖' },
    { id: 'nova', name: 'OpenAI Nova', gender: 'female', engine: 'openai', desc: 'Modulación viva • OpenAI 🤖' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'ElevenLabs Adam', gender: 'male', engine: 'elevenlabs', desc: 'Keynote magistral • 11Labs 🌟' }
  ],
  it: [
    { id: 'it-IT-ElsaNeural', name: 'Google Elsa', gender: 'female', engine: 'google', desc: 'Italiano fluido y expresivo • Universal 🌐' },
    { id: 'it-IT-CosimoNeural', name: 'Google Cosimo', gender: 'male', engine: 'google', desc: 'Sereno y refinado • Universal 🌐' },
    { id: 'shimmer', name: 'OpenAI Shimmer', gender: 'female', engine: 'openai', desc: 'Luminosa y clara • OpenAI 🤖' },
    { id: 'alloy', name: 'OpenAI Alloy', gender: 'neutral', engine: 'openai', desc: 'Versátil • OpenAI 🤖' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'ElevenLabs Domi', gender: 'female', engine: 'elevenlabs', desc: 'Asertiva y dinámica • 11Labs 🌟' }
  ],
  pt: [
    { id: 'pt-BR-FranciscaNeural', name: 'Google Francisca', gender: 'female', engine: 'google', desc: 'Portugués brasileño suave • Universal 🌐' },
    { id: 'pt-BR-AntonioNeural', name: 'Google Antonio', gender: 'male', engine: 'google', desc: 'Enérgico y amigable • Universal 🌐' },
    { id: 'echo', name: 'OpenAI Echo', gender: 'male', engine: 'openai', desc: 'Voz pausada y clara • OpenAI 🤖' },
    { id: 'nova', name: 'OpenAI Nova', gender: 'female', engine: 'openai', desc: 'Expresiva • OpenAI 🤖' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'ElevenLabs Antoni', gender: 'male', engine: 'elevenlabs', desc: 'Locución natural • 11Labs 🌟' }
  ]
};

const BOOTHS = [
  { lang: 'es', label: 'Español', flag: '🇪🇸', badge: 'Cabina Principal' },
  { lang: 'en', label: 'English', flag: '🇺🇸', badge: 'Cabina Global' },
  { lang: 'it', label: 'Italiano', flag: '🇮🇹', badge: 'Cabina Europea' },
  { lang: 'pt', label: 'Português', flag: '🇧🇷', badge: 'Cabina Iberoamérica' }
];

export default function SettingsModal({
  isOpen = false,
  onClose = () => {},
  onSaveConfig = () => {},
  roomId = 'MAIN'
}) {
  const [activeTab, setActiveTab] = useState('stt'); // 'stt' | 'tts' | 'ai' | 'medical' | 'keys'

  // STT Transcriber Engine (Default Deepgram)
  const [sttEngine, setSttEngine] = useState(() => safeGetItem('lv_stt_engine', 'deepgram'));

  // TTS Global & Per-Language Voices
  const [preferredTtsEngine, setPreferredTtsEngine] = useState(() => safeGetItem('lv_tts_engine', 'auto'));
  const [voiceConfig, setVoiceConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('lv_voice_config');
      return saved ? { ...DEFAULT_VOICES, ...JSON.parse(saved) } : DEFAULT_VOICES;
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

  // State for quick audition play
  const [previewingLang, setPreviewingLang] = useState(null);

  // API Keys
  const [deepgramKey, setDeepgramKey] = useState(() => safeGetItem('lv_deepgram_key'));
  const [elevenLabsKey, setElevenLabsKey] = useState(() => safeGetItem('lv_eleven_key'));
  const [openaiKey, setOpenaiKey] = useState(() => safeGetItem('lv_openai_key'));
  const [qwenKey, setQwenKey] = useState(() => safeGetItem('lv_qwen_key'));
  const [qwenModel, setQwenModel] = useState(() => safeGetItem('lv_qwen_model') || 'qwen/qwen-3.8-27b');
  const [qwenEndpoint, setQwenEndpoint] = useState(() => safeGetItem('lv_qwen_endpoint'));
  const [preferredEngine, setPreferredEngine] = useState(() => safeGetItem('lv_preferred_engine', 'qwen'));

  // Medical Clinical Mode
  const [medicalMode, setMedicalMode] = useState(() => safeGetItem('lv_medical_mode') === 'true');
  const [medicalSpecialty, setMedicalSpecialty] = useState(() => safeGetItem('lv_medical_specialty', 'general'));
  const [customGlossary, setCustomGlossary] = useState(() => safeGetItem('lv_custom_glossary'));

  // Decalage Cadence
  const [decalageMode, setDecalageMode] = useState(() => safeGetItem('lv_decalage_mode', 'natural'));

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load active server config on open if available
  useEffect(() => {
    if (isOpen) {
      fetch('/api/config')
        .then(res => res.json())
        .then(data => {
          if (data && data.success) {
            if (data.preferredSttEngine && !localStorage.getItem('lv_stt_engine')) {
              setSttEngine(data.preferredSttEngine);
            }
            if (data.preferredTtsEngine && !localStorage.getItem('lv_tts_engine')) {
              setPreferredTtsEngine(data.preferredTtsEngine);
            }
            if (data.voiceConfig && !localStorage.getItem('lv_voice_config')) {
              setVoiceConfig(prev => ({ ...prev, ...data.voiceConfig }));
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVoiceChange = (lang, newVoiceId) => {
    setVoiceConfig(prev => {
      const next = { ...prev, [lang]: newVoiceId };
      safeSetItem('lv_voice_config', next);
      return next;
    });
  };

  const handleGenderChange = (lang, newGender) => {
    setVoiceGender(prev => {
      const next = { ...prev, [lang]: newGender };
      safeSetItem('lv_voice_gender', next);
      return next;
    });
  };

  const handlePreviewVoice = async (langCode) => {
    setPreviewingLang(langCode);
    const sampleTexts = {
      es: 'Bienvenidos a LiftVoice. Esta es una muestra de voz en tiempo real para la cabina en español.',
      en: 'Welcome to LiftVoice. This is a real-time simultaneous voice preview for the English cabin.',
      it: 'Benvenuti a LiftVoice. Questa è una dimostrazione di voce in tempo reale per la cabina italiana.',
      pt: 'Bem-vindos ao LiftVoice. Este é um teste de voz em tempo real para a cabina em português.'
    };
    const sampleText = sampleTexts[langCode] || sampleTexts.es;
    const voice = voiceConfig[langCode] || DEFAULT_VOICES[langCode];
    const gender = voiceGender[langCode] || 'female';

    try {
      await audioPlayerService.unlockAudio(roomId, langCode);
      const res = await fetch(`/api/rooms/${roomId || 'MAIN'}/preview-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: langCode,
          sampleText,
          voice,
          gender,
          engine: preferredTtsEngine
        })
      });
      const data = await res.json();
      await audioPlayerService.playVoicePreview({
        voiceId: voice,
        lang: langCode,
        text: sampleText,
        audioBase64: data?.audioBase64 || null,
        gender
      });
    } catch (e) {
      console.warn('[SettingsModal] Voice preview warning:', e);
    } finally {
      setTimeout(() => setPreviewingLang(null), 2400);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    safeSetItem('lv_stt_engine', sttEngine);
    safeSetItem('lv_tts_engine', preferredTtsEngine);
    safeSetItem('lv_voice_config', voiceConfig);
    safeSetItem('lv_voice_gender', voiceGender);

    safeSetItem('lv_openai_key', openaiKey);
    safeSetItem('lv_eleven_key', elevenLabsKey);
    safeSetItem('lv_deepgram_key', deepgramKey);
    safeSetItem('lv_qwen_key', qwenKey);
    safeSetItem('lv_qwen_model', qwenModel);
    safeSetItem('lv_qwen_endpoint', qwenEndpoint);
    safeSetItem('lv_preferred_engine', preferredEngine);

    safeSetItem('lv_medical_mode', medicalMode ? 'true' : 'false');
    safeSetItem('lv_medical_specialty', medicalSpecialty);
    safeSetItem('lv_custom_glossary', customGlossary);
    safeSetItem('lv_decalage_mode', decalageMode);

    const parsedGlossary = (customGlossary || '')
      .split(/[,;\n]+/)
      .map(t => t.trim())
      .filter(Boolean);

    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredSttEngine: sttEngine,
          sttEngine,
          preferredTtsEngine,
          voiceConfig,
          voiceGender,
          openaiKey: openaiKey || undefined,
          elevenLabsKey: elevenLabsKey || undefined,
          deepgramKey: deepgramKey || undefined,
          qwenKey: qwenKey || undefined,
          qwenModel: qwenModel || undefined,
          qwenEndpoint: qwenEndpoint || undefined,
          preferredEngine,
          medicalMode,
          medicalSpecialty,
          customGlossary: parsedGlossary,
          decalageMode
        })
      });

      if (roomId) {
        fetch(`/api/rooms/${roomId}/voices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceConfig, voiceGender })
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Could not sync config to server:', err);
    }

    setIsSaving(false);
    setIsSaved(true);

    if (onSaveConfig) {
      onSaveConfig({
        sttEngine,
        preferredTtsEngine,
        voiceConfig,
        voiceGender,
        openaiKey,
        elevenLabsKey,
        deepgramKey,
        qwenKey,
        qwenModel,
        qwenEndpoint,
        preferredEngine,
        medicalMode,
        medicalSpecialty,
        customGlossary: parsedGlossary,
        decalageMode
      });
    }

    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 700);
  };

  const { theme, resolvedTheme, setTheme } = useTheme();

  const TABS = [
    { id: 'stt', label: 'Transcriptor (STT)', icon: Mic, badge: sttEngine === 'deepgram' ? 'Deepgram ⚡' : (sttEngine ? sttEngine.charAt(0).toUpperCase() + sttEngine.slice(1).toLowerCase() : '') },
    { id: 'tts', label: 'Voces por Idioma', icon: Volume2, badge: '4 cabinas' },
    { id: 'ai', label: 'Modelos de Traducción', icon: Cpu, badge: preferredEngine ? preferredEngine.charAt(0).toUpperCase() + preferredEngine.slice(1).toLowerCase() : '' },
    { id: 'appearance', label: 'Apariencia & Tema', icon: Palette, badge: theme ? theme.charAt(0).toUpperCase() + theme.slice(1).toLowerCase() : '' },
    { id: 'medical', label: 'Modo Clínico', icon: Stethoscope, badge: medicalMode ? 'Activo' : null },
    { id: 'keys', label: 'Claves de API', icon: Key, badge: 'Conectadas' }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-3 md:p-6 bg-black/40 backdrop-blur-[3px] animate-backdrop-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl h-[90dvh] sm:h-[640px] max-h-[90dvh] sm:max-h-[92vh] rounded-[28px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xl flex flex-col md:flex-row overflow-hidden text-left animate-sheet-up sm:animate-fadeIn transition-colors duration-150">
        {/* ─────────────────────────────────────────────────────────── */}
        {/* SIDEBAR DE PESTAÑAS (Desktop: vertical; Mobile: horizontal) */}
        {/* ─────────────────────────────────────────────────────────── */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950 p-3 sm:p-5 flex flex-col justify-between flex-shrink-0 select-none">
          <div className="space-y-3 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs flex-shrink-0">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 tracking-tight">Configuración</h3>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">LiftVoice Studio 2026</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="md:hidden w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer transition-colors"
                aria-label="Cerrar configuración"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Buttons: Horizontal scroll in mobile, vertical stack in desktop */}
            <div className="flex md:flex-col overflow-x-auto no-scrollbar gap-1.5 pb-1 md:pb-0">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-between px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-zinc-950 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`} />
                      <span>{tab.label}</span>
                    </div>

                    {tab.badge && (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ml-2 hidden sm:inline-block ${
                        isActive
                          ? 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 shadow-xs'
                          : 'bg-zinc-200/70 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Active Transcriber & Voice Status Card (Desktop only) */}
          <div className="hidden md:block p-3.5 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 space-y-1.5 text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
            <div className="flex items-center justify-between font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-zinc-950 dark:text-zinc-100" />
                <span>Estado Activo</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                LISTO
              </span>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 text-[10.5px]">
              Transcriptor: <strong className="text-zinc-900 dark:text-zinc-200">{sttEngine === 'deepgram' ? 'Deepgram Nova-3 ⚡' : sttEngine === 'webspeech' ? 'Web Speech API' : 'Whisper-1'}</strong>
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 text-[10.5px]">
              Voces: <strong className="text-zinc-900 dark:text-zinc-200">Lectura limpia directa</strong> en las 4 cabinas (ES, EN, IT, PT).
            </p>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* PANEL DE CONTENIDO                                          */}
        {/* ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-between h-full overflow-hidden bg-white dark:bg-zinc-900">
          
          <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
            
            {/* ═══════════════════════════════════════════════════════ */}
            {/* PESTAÑA: TRANSCRIPTOR (STT)                             */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'stt' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-zinc-950 dark:text-zinc-100 tracking-tight">
                      ¿Quién transcribe la voz del ponente?
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                      DEFAULT: DEEPGRAM
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Elige el motor de reconocimiento de voz (STT). Puedes cambiarlo cuando quieras de forma dinámica.
                  </p>
                </div>

                {/* STT Option Cards */}
                <div className="space-y-3">
                  {[
                    {
                      id: 'deepgram',
                      title: 'Deepgram Nova-3 (Predeterminado ⚡)',
                      tag: 'Ultra-baja latencia ~150ms',
                      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                      desc: 'El modelo insignia de Deepgram. Transcripción acústica streaming en tiempo real con puntuación inteligente, números y capitalización automática.',
                      features: ['Latencia ultra-rápida (~150ms TTFB)', 'Soporta español, inglés, italiano y portugués', 'Integración directa con la API activa de Deepgram', 'Mantiene vista previa en pantalla mientras hablas']
                    },
                    {
                      id: 'webspeech',
                      title: 'Web Speech API (Navegador Local 🌐)',
                      tag: '100% gratis & nativo',
                      badgeColor: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                      desc: 'Utiliza el motor de reconocimiento de voz integrado en Chrome, Edge o Safari. Funciona directamente en tu ordenador sin coste alguno.',
                      features: ['0 consumo de cuota de API', 'Dictado palabra por palabra en vivo', 'Sin dependencias de servidores externos']
                    },
                    {
                      id: 'whisper',
                      title: 'OpenAI Whisper (Whisper-1 🤖)',
                      tag: 'Alta precisión multilingüe',
                      badgeColor: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                      desc: 'Reconocimiento robusto con gran resistencia a acentos fuertes y ruido ambiente, ideal para ponencias muy técnicas o médicas.',
                      features: ['Excelente fidelidad semántica', 'Priming con glosario clínico', 'Requiere clave OpenAI configurada']
                    }
                  ].map((engine) => {
                    const isSelected = sttEngine === engine.id;
                    return (
                      <button
                        key={engine.id}
                        type="button"
                        onClick={() => setSttEngine(engine.id)}
                        className={`w-full p-4.5 rounded-xl border text-left transition-all cursor-pointer space-y-2.5 ${
                          isSelected
                            ? 'border-zinc-950 dark:border-zinc-400 bg-zinc-50/80 dark:bg-zinc-850 shadow-xs ring-1.5 ring-zinc-950 dark:ring-zinc-400'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/40 dark:hover:bg-zinc-850/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-zinc-950 dark:border-zinc-100 bg-zinc-950 dark:bg-zinc-100' : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-950" />}
                            </div>
                            <span className="font-semibold text-xs text-zinc-950 dark:text-zinc-100">
                              {engine.title}
                            </span>
                          </div>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-md border font-semibold ${engine.badgeColor}`}>
                            {engine.tag}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pl-6.5">
                          {engine.desc}
                        </p>

                        <div className="flex flex-wrap gap-2 pl-6.5 pt-1">
                          {engine.features.map((feat, i) => (
                            <span key={i} className="text-[10px] text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                              ✓ {feat}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* PESTAÑA: VOCES POR IDIOMA (TTS)                         */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'tts' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-zinc-950 dark:text-zinc-100 tracking-tight">
                        ¿Quién habla en qué idioma?
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Configura la voz asignada a cada cabina de traducción simultánea. Los modelos leen directamente la traducción con locución limpia.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Preferred TTS Engine selector bar */}
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-850/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">Motor de Síntesis Preferido:</span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Selecciona el motor global o déjalo en Auto Inteligente.</span>
                  </div>
                  <select
                    value={preferredTtsEngine}
                    onChange={(e) => setPreferredTtsEngine(e.target.value)}
                    className="h-8.5 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 shadow-xs cursor-pointer"
                  >
                    <option value="auto">Auto Inteligente (Mejor voz activa ⚡)</option>
                    <option value="google">Google Neural Universal (100% Gratis & Ilimitado 🌐)</option>
                    <option value="deepgram">Deepgram Aura (Ultra-baja latencia ~150ms ⚡)</option>
                    <option value="openai">OpenAI TTS-1 (Alloy, Nova, Echo, Shimmer 🤖)</option>
                    <option value="elevenlabs">ElevenLabs Turbo v2.5 (Hiper-realista 🌟)</option>
                  </select>
                </div>

                {/* 4 Language Cabins Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {BOOTHS.map((b) => {
                    const currentVoice = voiceConfig[b.lang] || DEFAULT_VOICES[b.lang];
                    const currentGender = voiceGender[b.lang] || 'female';
                    const availableVoices = BOOTH_VOICE_OPTIONS[b.lang] || [];
                    const isPreviewing = previewingLang === b.lang;

                    return (
                      <div
                        key={b.lang}
                        className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-xs space-y-3"
                      >
                        {/* Header of Booth Card */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{b.flag}</span>
                            <div>
                              <div className="font-semibold text-xs text-zinc-950 dark:text-zinc-100">
                                {b.label} ({b.lang})
                              </div>
                              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                                {b.badge}
                              </div>
                            </div>
                          </div>

                          {/* Gender Switch */}
                          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-zinc-200 dark:border-zinc-700">
                            <button
                              type="button"
                              onClick={() => handleGenderChange(b.lang, 'female')}
                              className={`px-2 py-1 text-[10px] rounded-md font-medium transition-all cursor-pointer ${
                                currentGender === 'female'
                                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                              }`}
                            >
                              👩 Fem
                            </button>
                            <button
                              type="button"
                              onClick={() => handleGenderChange(b.lang, 'male')}
                              className={`px-2 py-1 text-[10px] rounded-md font-medium transition-all cursor-pointer ${
                                currentGender === 'male'
                                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                              }`}
                            >
                              👨 Masc
                            </button>
                          </div>
                        </div>

                        {/* Voice Picker Dropdown */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block">
                            Voz Asignada:
                          </label>
                          <select
                            value={currentVoice}
                            onChange={(e) => handleVoiceChange(b.lang, e.target.value)}
                            className="w-full h-9 px-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100/70 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-colors cursor-pointer"
                          >
                            {availableVoices.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} ({v.desc})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Preview Audition Button */}
                        <button
                          type="button"
                          onClick={() => handlePreviewVoice(b.lang)}
                          disabled={isPreviewing}
                          className={`w-full h-8 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isPreviewing
                              ? 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-900'
                              : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          {isPreviewing ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Reproduciendo muestra...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Probar voz ({b.label})</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* PESTAÑA: MODELOS DE TRADUCCIÓN                          */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'ai' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-zinc-950 dark:text-zinc-100 tracking-tight">
                    Motor de Traducción Simultánea
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Elige el modelo encargado de traducir los enunciados capturados por el micrófono en vivo.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { id: 'qwen', title: 'Alibaba Qwen 3.8', subtitle: 'Flagship MoE 27B', tag: 'Recomendado' },
                    { id: 'google', title: 'Google Neural', subtitle: 'Universal <90ms', tag: '100% gratis' },
                    { id: 'openai', title: 'GPT-4o Mini', subtitle: 'Razonamiento semántico', tag: 'OpenAI' }
                  ].map((eng) => (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => setPreferredEngine(eng.id)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        preferredEngine === eng.id
                          ? 'border-zinc-950 dark:border-zinc-400 bg-zinc-50 dark:bg-zinc-850 shadow-xs ring-1 ring-zinc-950 dark:ring-zinc-400'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                        {eng.tag}
                      </span>
                      <div className="font-semibold text-xs text-zinc-950 dark:text-zinc-100 mt-2">{eng.title}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{eng.subtitle}</div>
                    </button>
                  ))}
                </div>

                {preferredEngine === 'qwen' && (
                  <div className="p-4.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 space-y-4 shadow-xs">
                    <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-100 flex items-center justify-between">
                      <span>Configuración de Alibaba Qwen (Open Weights)</span>
                      <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">Apache 2.0</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium block">
                        Modelo de Qwen:
                      </label>
                      <select
                        value={qwenModel}
                        onChange={(e) => setQwenModel(e.target.value)}
                        className="w-full h-9.5 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-colors shadow-xs cursor-pointer"
                      >
                        <option value="qwen/qwen-3.8-27b">qwen/qwen-3.8-27b (Oficial OpenRouter Cloud)</option>
                        <option value="qwen3.8:27b-instruct-q4_k_m">qwen3.8:27b-instruct-q4_k_m (Ollama Local GGUF)</option>
                        <option value="qwen3.5:9b-instruct-q4_k_m">qwen3.5:9b-instruct-q4_k_m (Ollama Ligero 5.5GB)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium flex items-center justify-between">
                        <span>Endpoint Propio (Ollama / vLLM local)</span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Opcional</span>
                      </label>
                      <input
                        type="text"
                        value={qwenEndpoint}
                        onChange={(e) => setQwenEndpoint(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className="w-full h-9.5 px-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* PESTAÑA: MODO MÉDICO & GLOSARIO                         */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'medical' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-zinc-950 dark:text-zinc-100 tracking-tight">
                    Especialización Médica & Glosarios
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Activa la nomenclatura clínica CIE-11, fármacos DCI y acrónimos hospitalarios en la traducción simultánea.
                  </p>
                </div>

                <div className="p-4.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                      Modo Clínico Activo
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Protege siglas médicas (ECG, SpO2, IAM) y fármacos de alteraciones coloquiales.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMedicalMode(!medicalMode)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      medicalMode ? 'bg-zinc-950 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-zinc-950 shadow-xs transition duration-200 ease-in-out ${
                        medicalMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {medicalMode && (
                  <div className="space-y-5 animate-fadeIn">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium block">
                        Especialidad Principal de la Conferencia:
                      </label>
                      <select
                        value={medicalSpecialty}
                        onChange={(e) => setMedicalSpecialty(e.target.value)}
                        className="w-full h-10 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-colors shadow-xs cursor-pointer"
                      >
                        <option value="general">🩺 Medicina General / Urgencias & Cuidados Críticos</option>
                        <option value="cardiology">🫀 Cardiología & Hemodinámica (ECG, IAM, Fibrilación)</option>
                        <option value="pharmacology">💊 Farmacología Clínica & Dosificaciones (DCI / INN)</option>
                        <option value="surgery">🔪 Cirugía General, Anestesiología & Quirófano</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium flex items-center justify-between">
                        <span>Glosario Personalizado de la Conferencia</span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Separar por coma</span>
                      </label>
                      <textarea
                        rows={3}
                        value={customGlossary}
                        onChange={(e) => setCustomGlossary(e.target.value)}
                        placeholder="SpO2, ECG, enoxaparina, amiodarona, troponina, IAM, shock cardiogénico, CIE-11..."
                        className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-mono text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* PESTAÑA: APARIENCIA Y TEMA                              */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'appearance' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                    Preferencia de Interfaz & Tema
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Ajusta la paleta visual según las condiciones lumínicas de la sala, auditorio o cabina de traducción.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'light', label: 'Modo Claro', desc: 'Fondo blanco con bordes de precisión para conferencias de día.', icon: Sun },
                    { id: 'dark', label: 'Modo Oscuro', desc: 'Tonos carbón profundo para cabinas y escenarios en penumbra.', icon: Moon },
                    { id: 'system', label: 'Automático / Sistema', desc: 'Sigue la configuración de modo claro/oscuro de tu dispositivo.', icon: Monitor }
                  ].map((item) => {
                    const ItemIcon = item.icon;
                    const isSelected = theme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTheme(item.id)}
                        className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-md ring-1 ring-zinc-900/10'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-white/20 dark:bg-zinc-950/20 text-white dark:text-zinc-950' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}>
                            <ItemIcon className="w-4 h-4" />
                          </div>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                        </div>
                        <div className="font-semibold text-xs sm:text-sm">{item.label}</div>
                        <div className={`text-[11px] mt-1 leading-snug ${
                          isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                        }`}>
                          {item.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-200">Estado del Tema Activo</div>
                  <p>Modo seleccionado: <strong className="text-zinc-900 dark:text-zinc-100">{theme}</strong> (Resuelto actualmente en pantalla como: <strong className="text-zinc-900 dark:text-zinc-100">{resolvedTheme}</strong>)</p>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* PESTAÑA: CLAVES DE API                                  */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'keys' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                    Claves de API y Proveedores
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Las claves se guardan de forma segura en tu navegador y se sincronizan con la sesión activa.
                  </p>
                </div>

                {/* Deepgram Key Card */}
                <div className="p-4.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs">
                        D
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Deepgram (STT Nova-3 + TTS Aura)</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Motor de transcripción predeterminado (~150ms)</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
                      CONECTADO
                    </span>
                  </div>

                  <input
                    type="password"
                    value={deepgramKey}
                    onChange={(e) => setDeepgramKey(e.target.value)}
                    placeholder="1f057415ec50bb496a86ec8d8bc9e4f627a57f7d"
                    className="w-full h-9.5 px-3.5 bg-zinc-50/70 dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs"
                  />
                </div>

                {/* ElevenLabs Key Card */}
                <div className="p-4.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs">
                        11
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">ElevenLabs (Turbo v2.5)</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Voces hiper-realistas Rachel, Adam, Antoni</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
                      OPCIONAL
                    </span>
                  </div>

                  <input
                    type="password"
                    value={elevenLabsKey}
                    onChange={(e) => setElevenLabsKey(e.target.value)}
                    placeholder="xi_api_key..."
                    className="w-full h-9.5 px-3.5 bg-zinc-50/70 dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs"
                  />
                </div>

                {/* OpenAI Key Card */}
                <div className="p-4.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs">
                        OA
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">OpenAI (Whisper + GPT-4o + TTS-1)</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Síntesis Alloy, Nova, Echo, Shimmer</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
                      OPCIONAL
                    </span>
                  </div>

                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full h-9.5 px-3.5 bg-zinc-50/70 dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs"
                  />
                </div>
              </div>
            )}

          </div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* BARRA DE BOTONES INFERIOR                                 */}
          {/* ───────────────────────────────────────────────────────── */}
          <div className="min-h-16 py-3 sm:py-0 sm:h-16 px-5 sm:px-6 md:px-8 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between flex-shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-9.5 px-6 rounded-full bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Preferencias Guardadas</span>
                </>
              ) : isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Aplicar Cambios</span>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
