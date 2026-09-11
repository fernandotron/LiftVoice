import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings, Key, X, Check, Shield, Cpu, Zap, Volume2, Mic,
  Sparkles, Stethoscope, Activity, BookOpen, Play, Loader2, Headphones,
  Radio, User, ChevronRight, CheckCircle2, Lock, Server, Globe, VolumeX,
  Palette, Sun, Moon, Monitor, Eye, EyeOff, AlertCircle
} from 'lucide-react';
import { audioPlayerService } from '../services/audioPlayer.js';
import { useTheme } from '../contexts/ThemeContext.jsx';
import CountryFlag from './shared/CountryFlag.jsx';

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
// Curated voices catalog grouped by language for fast dynamic selection
const BOOTH_VOICE_OPTIONS = {
  es: [
    { id: 'aura-asteria-en', name: 'Deepgram Aura (Multilingüe)', gender: 'female', engine: 'deepgram', desc: 'Ultra-baja latencia ~140ms • Saldo $200 ⚡' },
    { id: 'es-ES-ElviraNeural', name: 'Google Elvira', gender: 'female', engine: 'google', desc: 'Fluida y natural • Universal 🌐' },
    { id: 'es-ES-AlvaroNeural', name: 'Google Álvaro', gender: 'male', engine: 'google', desc: 'Claro y profesional • Universal 🌐' },
    { id: 'qwen3-tts-es', name: 'Alibaba Qwen3-TTS', gender: 'female', engine: 'qwen_tts', desc: 'Ultra-rápido 97ms • Qwen 🎙️' },
    { id: 'nova', name: 'OpenAI Nova', gender: 'female', engine: 'openai', desc: 'Expresiva y cálida • OpenAI 🤖' },
    { id: 'alloy', name: 'OpenAI Alloy', gender: 'neutral', engine: 'openai', desc: 'Neutra y corporativa • OpenAI 🤖' },
    { id: 'echo', name: 'OpenAI Echo', gender: 'male', engine: 'openai', desc: 'Barítono suave • OpenAI 🤖' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'ElevenLabs Rachel', gender: 'female', engine: 'elevenlabs', desc: 'Fotorrealismo insignia • 11Labs 🌟' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'ElevenLabs Antoni', gender: 'male', engine: 'elevenlabs', desc: 'Cinematográfico • 11Labs 🌟' }
  ],
  en: [
    { id: 'aura-asteria-en', name: 'Deepgram Asteria', gender: 'female', engine: 'deepgram', desc: 'Ultra-baja latencia ~140ms • Saldo $200 ⚡' },
    { id: 'aura-orion-en', name: 'Deepgram Orion', gender: 'male', engine: 'deepgram', desc: 'Barítono confiado ~140ms • Saldo $200 ⚡' },
    { id: 'aura-luna-en', name: 'Deepgram Luna', gender: 'female', engine: 'deepgram', desc: 'Serena y pausada • Saldo $200 ⚡' },
    { id: 'aura-stella-en', name: 'Deepgram Stella', gender: 'female', engine: 'deepgram', desc: 'Directa e institucional • Saldo $200 ⚡' },
    { id: 'aura-arcas-en', name: 'Deepgram Arcas', gender: 'male', engine: 'deepgram', desc: 'Amigable y cercano • Saldo $200 ⚡' },
    { id: 'qwen3-tts-en', name: 'Alibaba Qwen3-TTS', gender: 'female', engine: 'qwen_tts', desc: 'Ultra-rápido 97ms • Qwen 🎙️' },
    { id: 'en-US-JennyNeural', name: 'Google Jenny', gender: 'female', engine: 'google', desc: 'Articulación nítida • Universal 🌐' },
    { id: 'en-US-GuyNeural', name: 'Google Guy', gender: 'male', engine: 'google', desc: 'Seguro y cálido • Universal 🌐' },
    { id: 'alloy', name: 'OpenAI Alloy', gender: 'neutral', engine: 'openai', desc: 'Neutra y dinámica • OpenAI 🤖' },
    { id: 'nova', name: 'OpenAI Nova', gender: 'female', engine: 'openai', desc: 'Modulación viva • OpenAI 🤖' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'ElevenLabs Adam', gender: 'male', engine: 'elevenlabs', desc: 'Keynote magistral • 11Labs 🌟' }
  ],
  it: [
    { id: 'aura-asteria-en', name: 'Deepgram Aura (Multilingüe)', gender: 'female', engine: 'deepgram', desc: 'Ultra-baja latencia ~140ms • Saldo $200 ⚡' },
    { id: 'it-IT-ElsaNeural', name: 'Google Elsa', gender: 'female', engine: 'google', desc: 'Italiano fluido y expresivo • Universal 🌐' },
    { id: 'it-IT-CosimoNeural', name: 'Google Cosimo', gender: 'male', engine: 'google', desc: 'Sereno y refinado • Universal 🌐' },
    { id: 'qwen3-tts-it', name: 'Alibaba Qwen3-TTS', gender: 'female', engine: 'qwen_tts', desc: 'Ultra-rápido 97ms • Qwen 🎙️' },
    { id: 'shimmer', name: 'OpenAI Shimmer', gender: 'female', engine: 'openai', desc: 'Luminosa y clara • OpenAI 🤖' },
    { id: 'alloy', name: 'OpenAI Alloy', gender: 'neutral', engine: 'openai', desc: 'Versátil • OpenAI 🤖' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'ElevenLabs Domi', gender: 'female', engine: 'elevenlabs', desc: 'Asertiva y dinámica • 11Labs 🌟' }
  ],
  pt: [
    { id: 'aura-asteria-en', name: 'Deepgram Aura (Multilingüe)', gender: 'female', engine: 'deepgram', desc: 'Ultra-baja latencia ~140ms • Saldo $200 ⚡' },
    { id: 'pt-BR-FranciscaNeural', name: 'Google Francisca', gender: 'female', engine: 'google', desc: 'Portugués brasileño suave • Universal 🌐' },
    { id: 'pt-BR-AntonioNeural', name: 'Google Antonio', gender: 'male', engine: 'google', desc: 'Enérgico y amigable • Universal 🌐' },
    { id: 'qwen3-tts-pt', name: 'Alibaba Qwen3-TTS', gender: 'female', engine: 'qwen_tts', desc: 'Ultra-rápido 97ms • Qwen 🎙️' },
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

  // STT Transcriber Engine (Default Deepgram Nova-3)
  const [sttEngine, setSttEngine] = useState(() => safeGetItem('lv_stt_engine', 'deepgram'));

  // TTS Global & Per-Language Voices (Default Deepgram Aura to consume $200 free credit)
  const [preferredTtsEngine, setPreferredTtsEngine] = useState(() => safeGetItem('lv_tts_engine', 'deepgram'));
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

  // API Keys & Model Selectors (Sept 2026 Modular Architecture)
  const [deepgramKey, setDeepgramKey] = useState(() => safeGetItem('lv_deepgram_key'));
  const [geminiKey, setGeminiKey] = useState(() => safeGetItem('lv_gemini_key'));
  const [geminiModel, setGeminiModel] = useState(() => safeGetItem('lv_gemini_model') || 'google/gemini-3.1-flash-lite');
  const [elevenLabsKey, setElevenLabsKey] = useState(() => safeGetItem('lv_eleven_key'));
  const [openaiKey, setOpenaiKey] = useState(() => safeGetItem('lv_openai_key'));
  const [qwenKey, setQwenKey] = useState(() => safeGetItem('lv_qwen_key'));
  const [qwenModel, setQwenModel] = useState(() => safeGetItem('lv_qwen_model') || 'qwen/qwen-3.8-27b');
  const [qwenEndpoint, setQwenEndpoint] = useState(() => safeGetItem('lv_qwen_endpoint'));
  const [qwenTtsEndpoint, setQwenTtsEndpoint] = useState(() => safeGetItem('lv_qwen_tts_endpoint'));
  const [preferredEngine, setPreferredEngine] = useState(() => safeGetItem('lv_preferred_engine', 'gemini'));

  // Medical Clinical Mode
  const [medicalMode, setMedicalMode] = useState(() => safeGetItem('lv_medical_mode') === 'true');
  const [medicalSpecialty, setMedicalSpecialty] = useState(() => safeGetItem('lv_medical_specialty', 'general'));
  const [customGlossary, setCustomGlossary] = useState(() => safeGetItem('lv_custom_glossary'));

  // Decalage Cadence
  const [decalageMode, setDecalageMode] = useState(() => safeGetItem('lv_decalage_mode', 'natural'));

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Server credentials status flags
  const [serverFlags, setServerFlags] = useState({
    hasGeminiKey: false,
    hasQwenKey: false,
    hasDeepgramKey: false,
    hasElevenLabsKey: false,
    hasOpenAiKey: false
  });

  // Password fields visibility state
  const [showKeys, setShowKeys] = useState({});
  const toggleShowKey = (keyName) => {
    setShowKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  // Track explicitly edited API keys to prevent overwriting server .env values with empty strings
  const [touchedKeys, setTouchedKeys] = useState(new Set());
  const markKeyTouched = (keyName) => {
    setTouchedKeys(prev => new Set(prev).add(keyName));
  };

  // Preview cancellation ref & audio lifecycle management
  const previewAbortRef = useRef(null);
  const modalContainerRef = useRef(null);

  // Audio cleanup and abort controller on modal close
  useEffect(() => {
    if (!isOpen) {
      if (previewAbortRef.current) {
        previewAbortRef.current.abort();
        previewAbortRef.current = null;
      }
      try {
        audioPlayerService.stopAll();
      } catch (e) {}
      setPreviewingLang(null);
    }
  }, [isOpen]);

  // Audio cleanup when active tab changes
  useEffect(() => {
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
      previewAbortRef.current = null;
    }
    try {
      audioPlayerService.stopAll();
    } catch (e) {}
    setPreviewingLang(null);
  }, [activeTab]);

  // Audio cleanup on component unmount
  useEffect(() => {
    return () => {
      if (previewAbortRef.current) {
        previewAbortRef.current.abort();
        previewAbortRef.current = null;
      }
      try {
        audioPlayerService.stopAll();
      } catch (e) {}
    };
  }, []);

  // ALTA-04: Lock body scroll while modal is open, restoring original overflow upon close or unmount
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // ALTA-04: Focus trap (Tab / Shift+Tab) & Escape key closing
  useEffect(() => {
    if (!isOpen) return;

    // Focus first interactive element or container when opened
    const timer = setTimeout(() => {
      if (modalContainerRef.current) {
        const focusable = modalContainerRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const container = modalContainerRef.current;
        if (!container) return;

        const focusableElements = Array.from(
          container.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
          )
        ).filter(el => el.offsetParent !== null); // only visible elements

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // 1-Click Strategy Presets (Engine + Verified Catalog Voices)
  const PRESETS = {
    deepgram_balance: {
      stt: 'deepgram',
      engine: 'gemini',
      tts: 'deepgram',
      voices: {
        es: 'es-ES-ElviraNeural',
        en: 'aura-asteria-en',
        it: 'it-IT-ElsaNeural',
        pt: 'pt-BR-FranciscaNeural'
      }
    },
    google_free: {
      stt: 'webspeech',
      engine: 'gemini',
      tts: 'google',
      voices: {
        es: 'es-ES-ElviraNeural',
        en: 'en-US-JennyNeural',
        it: 'it-IT-ElsaNeural',
        pt: 'pt-BR-FranciscaNeural'
      }
    },
    max_quality: {
      stt: 'deepgram',
      engine: 'openai',
      tts: 'elevenlabs',
      voices: {
        es: '21m00Tcm4TlvDq8ikWAM', // Rachel
        en: '21m00Tcm4TlvDq8ikWAM', // Rachel
        it: 'AZnzlk1XvdvUeBnXmlld', // Domi
        pt: 'ErXwobaYiN019PkySvjV'  // Antoni
      }
    }
  };

  const isPresetActive = (presetKey) => {
    const p = PRESETS[presetKey];
    if (!p) return false;
    if (sttEngine !== p.stt || preferredEngine !== p.engine || preferredTtsEngine !== p.tts) return false;
    return Object.keys(p.voices).every(lang => voiceConfig[lang] === p.voices[lang]);
  };

  const applyPreset = (presetKey) => {
    const p = PRESETS[presetKey];
    if (!p) return;
    setSttEngine(p.stt);
    setPreferredEngine(p.engine);
    setPreferredTtsEngine(p.tts);
    setVoiceConfig(p.voices);
  };

  // Load active server config on open if available
  useEffect(() => {
    if (isOpen) {
      fetch('/api/config')
        .then(res => res.json())
        .then(data => {
          if (data && data.success) {
            setServerFlags({
              hasGeminiKey: Boolean(data.hasGeminiKey),
              hasQwenKey: Boolean(data.hasQwenKey),
              hasDeepgramKey: Boolean(data.hasDeepgramKey),
              hasElevenLabsKey: Boolean(data.hasElevenLabsKey),
              hasOpenAiKey: Boolean(data.hasOpenAiKey)
            });
            if (data.preferredSttEngine && !localStorage.getItem('lv_stt_engine')) {
              setSttEngine(data.preferredSttEngine);
            }
            if (data.preferredTtsEngine && !localStorage.getItem('lv_tts_engine')) {
              setPreferredTtsEngine(data.preferredTtsEngine);
            }
            if (data.voiceConfig && !localStorage.getItem('lv_voice_config')) {
              setVoiceConfig(prev => ({ ...prev, ...data.voiceConfig }));
            }
            if (data.qwenTtsEndpoint && !localStorage.getItem('lv_qwen_tts_endpoint')) {
              setQwenTtsEndpoint(data.qwenTtsEndpoint);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-switch voices when user switches preferred TTS engine to avoid orphan voice IDs
  const handlePreferredTtsEngineChange = (newEngine) => {
    setPreferredTtsEngine(newEngine);
    const newVoices = { ...voiceConfig };
    BOOTHS.forEach(b => {
      const currentGender = voiceGender[b.lang] || 'female';
      const options = BOOTH_VOICE_OPTIONS[b.lang] || [];
      const best = options.find(v => v.engine === newEngine && v.gender === currentGender)
        || options.find(v => v.engine === newEngine)
        || options[0];
      if (best) {
        newVoices[b.lang] = best.id;
      }
    });
    setVoiceConfig(newVoices);
  };

  const handleVoiceChange = (lang, newVoiceId) => {
    setVoiceConfig(prev => ({ ...prev, [lang]: newVoiceId }));
    // Two-way sync: derive and set gender based on selected voice
    const found = (BOOTH_VOICE_OPTIONS[lang] || []).find(v => v.id === newVoiceId);
    if (found && (found.gender === 'male' || found.gender === 'female')) {
      setVoiceGender(prev => ({ ...prev, [lang]: found.gender }));
    }
  };

  const handleGenderChange = (lang, newGender) => {
    setVoiceGender(prev => ({ ...prev, [lang]: newGender }));
    // Two-way sync: pick a compatible voice matching the newly selected gender
    const candidates = (BOOTH_VOICE_OPTIONS[lang] || []).filter(v => v.gender === newGender);
    const currentEngine = preferredTtsEngine;
    const matched = candidates.find(v => v.engine === currentEngine) || candidates[0];
    if (matched) {
      setVoiceConfig(prev => ({ ...prev, [lang]: matched.id }));
    }
  };

  const handlePreviewVoice = async (langCode) => {
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }
    const abortCtrl = new AbortController();
    previewAbortRef.current = abortCtrl;

    setPreviewingLang(langCode);
    try {
      audioPlayerService.stopAll();
    } catch (e) {}

    const sampleTexts = {
      es: 'Bienvenidos a LiftVoice. Esta es una muestra de voz en tiempo real para la cabina en español.',
      en: 'Welcome to LiftVoice. This is a real-time simultaneous voice preview for the English cabin.',
      it: 'Benvenuti a LiftVoice. Questa è una dimostrazione di voce in tempo reale per la cabina italiana.',
      pt: 'Bem-vindos ao LiftVoice. Este é um teste de voz em tempo real para a cabina em português.'
    };
    const sampleText = sampleTexts[langCode] || sampleTexts.es;
    const voice = voiceConfig[langCode] || DEFAULT_VOICES[langCode];
    const gender = voiceGender[langCode] || 'female';

    // Use the actual engine of the selected voice rather than forcing preferredTtsEngine
    const selectedVoiceObj = (BOOTH_VOICE_OPTIONS[langCode] || []).find(v => v.id === voice);
    const engineToUse = selectedVoiceObj?.engine || preferredTtsEngine;

    try {
      await audioPlayerService.unlockAudio(roomId, langCode);
      const res = await fetch(`/api/rooms/${roomId || 'MAIN'}/preview-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortCtrl.signal,
        body: JSON.stringify({
          lang: langCode,
          sampleText,
          voice,
          gender,
          engine: engineToUse
        })
      });
      if (abortCtrl.signal.aborted) return;
      const data = await res.json();
      if (abortCtrl.signal.aborted) return;

      if (data && data.audioBase64) {
        await audioPlayerService.playVoicePreview({
          voiceId: voice,
          lang: langCode,
          text: sampleText,
          audioBase64: data.audioBase64,
          mimeType: data.mimeType || 'audio/mpeg',
          gender
        });
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn('[SettingsModal] Voice preview warning:', e);
      }
    } finally {
      if (previewAbortRef.current === abortCtrl) {
        setPreviewingLang(null);
      }
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    const parsedGlossary = (customGlossary || '')
      .split(/[,;\n]+/)
      .map(t => t.trim())
      .filter(Boolean);

    try {
      const resp = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredSttEngine: sttEngine,
          sttEngine,
          preferredTtsEngine,
          voiceConfig,
          voiceGender,
          openaiKey: touchedKeys.has('openai') ? openaiKey : undefined,
          elevenLabsKey: touchedKeys.has('eleven') ? elevenLabsKey : undefined,
          deepgramKey: touchedKeys.has('deepgram') ? deepgramKey : undefined,
          geminiKey: touchedKeys.has('gemini') ? geminiKey : undefined,
          geminiModel: geminiModel || '',
          qwenKey: touchedKeys.has('qwen') ? qwenKey : undefined,
          qwenModel: qwenModel || '',
          qwenEndpoint: touchedKeys.has('qwenEndpoint') ? qwenEndpoint : undefined,
          qwenTtsEndpoint: touchedKeys.has('qwenTtsEndpoint') ? qwenTtsEndpoint : undefined,
          preferredEngine,
          preferredTranslationEngine: preferredEngine,
          medicalMode,
          medicalSpecialty,
          customGlossary: parsedGlossary,
          decalageMode
        })
      });

      if (!resp.ok) {
        throw new Error(`Error del servidor (${resp.status}) al guardar configuración`);
      }

      // Persistencia atómica una vez validada la respuesta del servidor
      safeSetItem('lv_stt_engine', sttEngine);
      safeSetItem('lv_tts_engine', preferredTtsEngine);
      safeSetItem('lv_voice_config', voiceConfig);
      safeSetItem('lv_voice_gender', voiceGender);

      safeSetItem('lv_openai_key', openaiKey);
      safeSetItem('lv_eleven_key', elevenLabsKey);
      safeSetItem('lv_deepgram_key', deepgramKey);
      safeSetItem('lv_gemini_key', geminiKey);
      safeSetItem('lv_gemini_model', geminiModel);
      safeSetItem('lv_qwen_key', qwenKey);
      safeSetItem('lv_qwen_model', qwenModel);
      safeSetItem('lv_qwen_endpoint', qwenEndpoint);
      safeSetItem('lv_qwen_tts_endpoint', qwenTtsEndpoint);
      safeSetItem('lv_preferred_engine', preferredEngine);

      safeSetItem('lv_medical_mode', medicalMode ? 'true' : 'false');
      safeSetItem('lv_medical_specialty', medicalSpecialty);
      safeSetItem('lv_custom_glossary', customGlossary);
      safeSetItem('lv_decalage_mode', decalageMode);

      if (roomId) {
        fetch(`/api/rooms/${roomId}/voices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceConfig, voiceGender })
        }).catch(() => {});
      }

      const savedCfg = {
        sttEngine,
        preferredTtsEngine,
        voiceConfig,
        voiceGender,
        preferredEngine,
        openaiKey,
        elevenLabsKey,
        deepgramKey,
        geminiKey,
        geminiModel,
        qwenKey,
        qwenModel,
        qwenEndpoint,
        qwenTtsEndpoint,
        medicalMode,
        medicalSpecialty,
        customGlossary: parsedGlossary,
        decalageMode
      };

      setIsSaving(false);
      setIsSaved(true);

      if (onSaveConfig) {
        onSaveConfig(savedCfg);
      }
      window.dispatchEvent(new CustomEvent('liftvoice_config_saved', { detail: savedCfg }));

      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 700);
    } catch (err) {
      console.warn('Could not sync config to server:', err);
      setIsSaving(false);
      setSaveError(err.message || 'Error al conectar con el servidor.');
    }
  };

  const { theme, resolvedTheme, setTheme } = useTheme();

  const activeKeysCount = [
    deepgramKey || serverFlags.hasDeepgramKey,
    geminiKey || serverFlags.hasGeminiKey,
    qwenKey || serverFlags.hasQwenKey,
    elevenLabsKey || serverFlags.hasElevenLabsKey,
    openaiKey || serverFlags.hasOpenAiKey
  ].filter(Boolean).length;

  const TABS = [
    { id: 'stt', label: 'Transcriptor (STT)', icon: Mic, badge: sttEngine === 'deepgram' ? 'Deepgram ⚡' : (sttEngine ? sttEngine.charAt(0).toUpperCase() + sttEngine.slice(1).toLowerCase() : '') },
    { id: 'tts', label: 'Voces por Idioma', icon: Volume2, badge: '4 cabinas' },
    { id: 'ai', label: 'Modelos de Traducción', icon: Cpu, badge: preferredEngine ? preferredEngine.charAt(0).toUpperCase() + preferredEngine.slice(1).toLowerCase() : '' },
    { id: 'appearance', label: 'Apariencia & Tema', icon: Palette, badge: theme ? theme.charAt(0).toUpperCase() + theme.slice(1).toLowerCase() : '' },
    { id: 'medical', label: 'Modo Clínico', icon: Stethoscope, badge: medicalMode ? 'Activo' : null },
    { id: 'keys', label: 'Claves de API', icon: Key, badge: activeKeysCount > 0 ? `${activeKeysCount} activas` : 'Pendientes' }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-3 md:p-6 bg-black/40 backdrop-blur-[3px] animate-backdrop-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div 
        ref={modalContainerRef}
        className="w-full max-w-4xl h-[90dvh] sm:h-[640px] max-h-[90dvh] sm:max-h-[92vh] rounded-[28px] bg-white dark:bg-[#1f1f1f] border border-zinc-200/80 dark:border-white/10 shadow-2xl flex flex-col md:flex-row overflow-hidden text-left animate-sheet-up sm:animate-fadeIn transition-colors duration-150"
      >
        {/* ─────────────────────────────────────────────────────────── */}
        {/* SIDEBAR DE PESTAÑAS (Desktop: vertical; Mobile: horizontal) */}
        {/* ─────────────────────────────────────────────────────────── */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-200/80 dark:border-white/5 bg-zinc-50/60 dark:bg-[#1f1f1f] p-3 sm:p-5 flex flex-col justify-between flex-shrink-0 select-none">
          <div className="space-y-3 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center shadow-xs flex-shrink-0">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="settings-dialog-title" className="font-bold text-sm text-zinc-900 dark:text-zinc-50 tracking-tight">Configuración</h3>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">LiftVoice Studio 2026</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer transition-colors"
                aria-label="Cerrar configuración"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Buttons: Horizontal scroll in mobile, vertical stack in desktop */}
            <div
              role="tablist"
              aria-label="Secciones de configuración"
              aria-orientation="vertical"
              onKeyDown={(e) => {
                const tabIds = TABS.map(t => t.id);
                const currentIndex = tabIds.indexOf(activeTab);
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  const nextIndex = (currentIndex + 1) % tabIds.length;
                  setActiveTab(tabIds[nextIndex]);
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
                  setActiveTab(tabIds[prevIndex]);
                }
              }}
              className="flex md:flex-col overflow-x-auto no-scrollbar gap-1.5 pb-1 md:pb-0"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-between px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                      isActive
                        ? 'bg-zinc-200/80 dark:bg-white/10 text-zinc-950 dark:text-white font-semibold shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
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
                          : 'bg-zinc-200/70 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
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
          <div className="hidden md:block p-3.5 rounded-2xl bg-zinc-100/50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 space-y-1.5 text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
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
        <div className="flex-1 flex flex-col justify-between h-full overflow-hidden bg-white dark:bg-[#1f1f1f]">
          
          <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">

            {/* 1-Click Strategy Presets Bar */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Estrategias Rápidas en 1 Clic (Presets 2026)</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">Consenso Sept 2026</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('deepgram_balance')}
                  className={`px-3 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                    isPresetActive('deepgram_balance')
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-500'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="text-[11px] font-bold flex items-center gap-1">
                    <span>💰 Modo Saldo Deepgram</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Nova-3 + Gemini 3.1 + Aura TTS (Gasta tus $200)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('google_free')}
                  className={`px-3 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                    isPresetActive('google_free')
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200 ring-1 ring-blue-500'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="text-[11px] font-bold flex items-center gap-1">
                    <span>🌐 100% Económico / Free</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    WebSpeech + Gemini + Google Neural ($0)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('max_quality')}
                  className={`px-3 py-2 rounded-xl text-left border transition-all cursor-pointer ${
                    isPresetActive('max_quality')
                      ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-950 dark:text-purple-200 ring-1 ring-purple-500'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="text-[11px] font-bold flex items-center gap-1">
                    <span>🌟 Máxima Calidad VIP</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Nova-3 + GPT-4o + ElevenLabs Turbo
                  </div>
                </button>
              </div>
            </div>
            
            {/* ═══════════════════════════════════════════════════════ */}
            {/* PESTAÑA: TRANSCRIPTOR (STT)                             */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'stt' && (
              <div
                role="tabpanel"
                id="panel-stt"
                aria-labelledby="tab-stt"
                tabIndex={0}
                className="space-y-6 animate-fadeIn outline-none"
              >
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
                    Elige entre 4 motores modulares de reconocimiento de voz (STT). Puedes cambiarlo en cualquier momento.
                  </p>
                </div>

                {/* STT 4 Option Cards */}
                <div className="space-y-3">
                  {[
                    {
                      id: 'deepgram',
                      title: '1. Deepgram Nova-3 Streaming (Predeterminado ⚡)',
                      tag: 'Saldo $200 disponible • ~150ms',
                      badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                      desc: 'Modelo acústico insignia de Deepgram. Transcripción streaming ultra-rápida con puntuación inteligente y detección automática de idioma.',
                      features: ['Latencia ultra-rápida (~150ms TTFB)', 'Soporta español, inglés, italiano y portugués', 'Consume tu saldo gratuito de $200', 'Puntuación y números automáticos']
                    },
                    {
                      id: 'gemini_live',
                      title: '2. Google Gemini 3.5 Transcribe Live (Cloud 🌐)',
                      tag: 'Google Cloud • $0.54/hr',
                      badgeColor: 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800',
                      desc: 'Nuevo modelo de transcripción multimodal de Google (Agosto 2026). Gran resistencia a reverberación acústica y acentos variados.',
                      features: ['Streaming multimodal de Google', 'Excelente comprensión en salas grandes', 'Tarifa plana económica ($0.54/hr)', 'Integración con API Gemini']
                    },
                    {
                      id: 'whisper',
                      title: '3. OpenAI Whisper (Whisper-1 🤖)',
                      tag: 'Alta precisión multilingüe',
                      badgeColor: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                      desc: 'Reconocimiento robusto con gran resistencia a ruido ambiente, ideal para ponencias muy técnicas o simposios médicos.',
                      features: ['Excelente fidelidad semántica', 'Priming con glosario clínico', 'Requiere clave OpenAI']
                    },
                    {
                      id: 'webspeech',
                      title: '4. Web Speech API (Navegador Local 💻)',
                      tag: '100% gratis & nativo',
                      badgeColor: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                      desc: 'Utiliza el motor integrado en Chrome, Edge o Safari. Funciona directamente en tu dispositivo sin servidores externos ni coste alguno.',
                      features: ['0 consumo de cuota de API', 'Dictado palabra por palabra en vivo', 'Sin dependencias de servidores externos']
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
              <div
                role="tabpanel"
                id="panel-tts"
                aria-labelledby="tab-tts"
                tabIndex={0}
                className="space-y-6 animate-fadeIn outline-none"
              >
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
                    onChange={(e) => handlePreferredTtsEngineChange(e.target.value)}
                    aria-label="Motor de síntesis preferido"
                    className="h-8.5 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 shadow-xs cursor-pointer"
                  >
                    <option value="deepgram">1. Deepgram Aura / Aura-2 (Consume tus $200 de saldo ⚡)</option>
                    <option value="google">2. Google Neural Universal (100% Gratis & Ilimitado 🌐)</option>
                    <option value="qwen_tts">3. Alibaba Qwen3-TTS / CosyVoice (Ultra-rápido 97ms 🎙️)</option>
                    <option value="elevenlabs">4. ElevenLabs Turbo v2.5 (Hiper-realista VIP 🌟)</option>
                    <option value="openai">OpenAI TTS-1 (Alloy, Nova, Echo, Shimmer 🤖)</option>
                    <option value="auto">Auto Inteligente (Mejor voz activa ⚡)</option>
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
                        className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-zinc-300 dark:hover:border-white/20 transition-all shadow-xs space-y-3"
                      >
                        {/* Header of Booth Card */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <CountryFlag code={b.lang} className="w-5 h-5 rounded-xs shadow-2xs flex-shrink-0" />
                            <div>
                              <div className="font-semibold text-xs text-zinc-950 dark:text-zinc-100">
                                {b.label} ({b.lang.toUpperCase()})
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
                              aria-label={`Voz femenina para cabina ${b.label}`}
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
                              aria-label={`Voz masculina para cabina ${b.label}`}
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
                          <label htmlFor={`voice-select-${b.lang}`} className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block">
                            Voz Asignada para {b.label}:
                          </label>
                          <select
                            id={`voice-select-${b.lang}`}
                            aria-label={`Voz asignada para cabina ${b.label}`}
                            value={currentVoice}
                            onChange={(e) => handleVoiceChange(b.lang, e.target.value)}
                            className="w-full h-9 px-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100/70 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-colors cursor-pointer"
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
              <div
                role="tabpanel"
                id="panel-ai"
                aria-labelledby="tab-ai"
                tabIndex={0}
                className="space-y-6 animate-fadeIn outline-none"
              >
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-zinc-950 dark:text-zinc-100 tracking-tight">
                    Motor de Traducción Simultánea
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Elige entre 4 motores modulares para traducir los enunciados capturados por el micrófono en vivo.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { id: 'gemini', title: 'Gemini 3.1 Flash-Lite', subtitle: 'Ultra-rápido ~120ms', tag: 'Recomendado ⚡', badgeColor: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
                    { id: 'qwen', title: 'Alibaba Qwen 3.8', subtitle: 'Open-Weights 27B', tag: 'Romances 🇨🇳', badgeColor: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
                    { id: 'openai', title: 'GPT-4o Mini', subtitle: 'Alta precisión clínica', tag: 'OpenAI 🤖', badgeColor: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
                    { id: 'google', title: 'Google Neural', subtitle: 'Universal <90ms', tag: '100% gratis 🌐', badgeColor: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800' }
                  ].map((eng) => (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => setPreferredEngine(eng.id)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        preferredEngine === eng.id
                          ? 'border-zinc-950 dark:border-zinc-400 bg-zinc-50 dark:bg-zinc-850 shadow-xs ring-1.5 ring-zinc-950 dark:ring-zinc-400'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold ${eng.badgeColor}`}>
                        {eng.tag}
                      </span>
                      <div className="font-semibold text-xs text-zinc-950 dark:text-zinc-100 mt-2">{eng.title}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{eng.subtitle}</div>
                    </button>
                  ))}
                </div>

                {preferredEngine === 'gemini' && (
                  <div className="p-4.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 space-y-4 shadow-xs">
                    <div className="text-xs font-semibold text-zinc-950 dark:text-zinc-100 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Configuración de Google Gemini (Flash-Lite Sept 2026)</span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">Sub-150ms</span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium block">
                        Modelo de Gemini:
                      </label>
                      <select
                        value={geminiModel}
                        onChange={(e) => setGeminiModel(e.target.value)}
                        className="w-full h-9.5 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-colors shadow-xs cursor-pointer"
                      >
                        <option value="google/gemini-3.1-flash-lite">google/gemini-3.1-flash-lite (Sin CoT obligatorio • Recomendado ⚡)</option>
                        <option value="google/gemini-3.5-flash-lite">google/gemini-3.5-flash-lite (Razonamiento adaptativo)</option>
                        <option value="gemini-2.0-flash">gemini-2.0-flash (Google AI Studio directo)</option>
                      </select>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Genera las 4 traducciones en una sola llamada estructurada JSON con latencia ultrabaja.
                      </p>
                    </div>
                  </div>
                )}

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
                        <option value="qwen/qwen-3.8-flash">qwen/qwen-3.8-flash (Ultra-baja latencia)</option>
                        <option value="qwen3.8:27b-instruct-q4_k_m">qwen3.8:27b-instruct-q4_k_m (Ollama Local GGUF)</option>
                        <option value="qwen3.5:9b-instruct-q4_k_m">qwen3.5:9b-instruct-q4_k_m (Ollama Ligero 5.5GB)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium flex items-center justify-between">
                          <span>Endpoint LLM (Ollama / vLLM)</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Opcional</span>
                        </label>
                        <input
                          type="text"
                          value={qwenEndpoint}
                          onChange={(e) => { setQwenEndpoint(e.target.value); markKeyTouched('qwenEndpoint'); }}
                          placeholder="http://localhost:11434/v1"
                          className="w-full h-9.5 px-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-700 dark:text-zinc-300 font-medium flex items-center justify-between">
                          <span>Endpoint Qwen-TTS (/v1/audio/speech)</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Opcional</span>
                        </label>
                        <input
                          type="text"
                          value={qwenTtsEndpoint}
                          onChange={(e) => { setQwenTtsEndpoint(e.target.value); markKeyTouched('qwenTtsEndpoint'); }}
                          placeholder="http://localhost:8000/v1/audio/speech"
                          className="w-full h-9.5 px-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* PESTAÑA: MODO MÉDICO & GLOSARIO                         */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'medical' && (
              <div
                role="tabpanel"
                id="panel-medical"
                aria-labelledby="tab-medical"
                tabIndex={0}
                className="space-y-6 animate-fadeIn outline-none"
              >
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
              <div
                role="tabpanel"
                id="panel-appearance"
                aria-labelledby="tab-appearance"
                tabIndex={0}
                className="space-y-6 animate-fadeIn outline-none"
              >
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
              <div
                role="tabpanel"
                id="panel-keys"
                aria-labelledby="tab-keys"
                tabIndex={0}
                className="space-y-6 animate-fadeIn outline-none"
              >
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                    Claves de API y Proveedores
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Las credenciales se guardan de forma segura en tu navegador y se sincronizan con la sesión activa.
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
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Ultra-baja latencia ~140ms • Crédito promocional activo</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {serverFlags.hasDeepgramKey && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          ✓ En servidor (.env)
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-bold">
                        💰 $200 SALDO DISPONIBLE
                      </span>
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      id="key-deepgram"
                      aria-label="Clave de API de Deepgram"
                      type={showKeys.deepgram ? 'text' : 'password'}
                      value={deepgramKey}
                      onChange={(e) => { setDeepgramKey(e.target.value); markKeyTouched('deepgram'); }}
                      placeholder={serverFlags.hasDeepgramKey ? 'Configurada en el servidor (.env) — escribe para reemplazar' : 'Clave de Deepgram (Nova-3 y Aura)...'}
                      className="w-full h-9.5 pl-3.5 pr-10 bg-zinc-50/70 dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('deepgram')}
                      className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                      aria-label={showKeys.deepgram ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                      {showKeys.deepgram ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10.5px] text-emerald-600 dark:text-emerald-400">
                    💡 Tus $200 de saldo cubren más de 15 eventos completos de 5 horas con transcripción en vivo y síntesis de voz en cabinas.
                  </p>
                </div>

                {/* Google Gemini / OpenRouter Key Card */}
                <div className="p-4.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs">
                        G
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Google Gemini / OpenRouter (Flash-Lite 3.1)</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Traducción simultánea en &lt;140ms sin CoT forzado</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {serverFlags.hasGeminiKey && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          ✓ En servidor (.env)
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold">
                        RECOMENDADO
                      </span>
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      id="key-gemini"
                      aria-label="Clave de Google Gemini o OpenRouter"
                      type={showKeys.gemini ? 'text' : 'password'}
                      value={geminiKey}
                      onChange={(e) => { setGeminiKey(e.target.value); markKeyTouched('gemini'); }}
                      placeholder={serverFlags.hasGeminiKey ? 'Configurada en el servidor (.env) — escribe para reemplazar' : 'AIzaSy... o sk-or-v1-...'}
                      className="w-full h-9.5 pl-3.5 pr-10 bg-zinc-50/70 dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('gemini')}
                      className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                      aria-label={showKeys.gemini ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                      {showKeys.gemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Alibaba Qwen / DashScope Key Card */}
                <div className="p-4.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs">
                        Q
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Alibaba Qwen (DashScope / OpenRouter / Ollama)</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Qwen 3.8-Flash, 27B y Qwen3-TTS</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {serverFlags.hasQwenKey && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          ✓ En servidor (.env)
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
                        OPCIONAL
                      </span>
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      id="key-qwen"
                      aria-label="Clave de API de Alibaba Qwen"
                      type={showKeys.qwen ? 'text' : 'password'}
                      value={qwenKey}
                      onChange={(e) => { setQwenKey(e.target.value); markKeyTouched('qwen'); }}
                      placeholder={serverFlags.hasQwenKey ? 'Configurada en el servidor (.env) — escribe para reemplazar' : 'sk-or-v1-... o sk-...'}
                      className="w-full h-9.5 pl-3.5 pr-10 bg-zinc-50/70 dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('qwen')}
                      className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                      aria-label={showKeys.qwen ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                      {showKeys.qwen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
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
                    <div className="flex items-center gap-2">
                      {serverFlags.hasElevenLabsKey && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          ✓ En servidor (.env)
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
                        OPCIONAL
                      </span>
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      id="key-elevenlabs"
                      aria-label="Clave de API de ElevenLabs"
                      type={showKeys.eleven ? 'text' : 'password'}
                      value={elevenLabsKey}
                      onChange={(e) => { setElevenLabsKey(e.target.value); markKeyTouched('eleven'); }}
                      placeholder={serverFlags.hasElevenLabsKey ? 'Configurada en el servidor (.env) — escribe para reemplazar' : 'xi_api_key...'}
                      className="w-full h-9.5 pl-3.5 pr-10 bg-zinc-50/70 dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('eleven')}
                      className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                      aria-label={showKeys.eleven ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                      {showKeys.eleven ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
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
                    <div className="flex items-center gap-2">
                      {serverFlags.hasOpenAiKey && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          ✓ En servidor (.env)
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium">
                        OPCIONAL
                      </span>
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      id="key-openai"
                      aria-label="Clave de API de OpenAI"
                      type={showKeys.openai ? 'text' : 'password'}
                      value={openaiKey}
                      onChange={(e) => { setOpenaiKey(e.target.value); markKeyTouched('openai'); }}
                      placeholder={serverFlags.hasOpenAiKey ? 'Configurada en el servidor (.env) — escribe para reemplazar' : 'sk-proj-...'}
                      className="w-full h-9.5 pl-3.5 pr-10 bg-zinc-50/70 dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 transition-all shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey('openai')}
                      className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                      aria-label={showKeys.openai ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                      {showKeys.openai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Banner Global de Error de Guardado */}
          {saveError && (
            <div className="px-5 sm:px-6 md:px-8 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2.5 flex-shrink-0 animate-fadeIn">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="font-medium break-words">{saveError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-md text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 transition-colors cursor-pointer flex-shrink-0"
                aria-label="Cerrar mensaje de error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────── */}
          {/* BARRA DE BOTONES INFERIOR                                 */}
          {/* ───────────────────────────────────────────────────────── */}
          <div className="min-h-16 py-3 sm:py-0 sm:h-16 px-5 sm:px-6 md:px-8 border-t border-zinc-200/80 dark:border-white/5 bg-white dark:bg-[#1f1f1f] flex items-center justify-between flex-shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-9.5 px-6 rounded-full bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
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
