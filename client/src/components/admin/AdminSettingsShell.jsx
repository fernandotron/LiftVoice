import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings, Key, X, Check, Shield, Cpu, Zap, Volume2, Mic,
  Sparkles, Stethoscope, Activity, BookOpen, Play, Square, Loader2, Headphones,
  Radio, User, Users, ChevronRight, CheckCircle2, Lock, Server, Globe, VolumeX,
  Palette, Sun, Moon, Monitor, Eye, EyeOff, AlertCircle, ArrowLeft, Home
} from 'lucide-react';
import { audioPlayerService } from '../../services/audioPlayer.js';
import { audioRecorderService } from '../../services/audioRecorder.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import CountryFlag from '../shared/CountryFlag.jsx';
import SelectDropdown from '../shared/SelectDropdown.jsx';
import AdminSidebarRail from './AdminSidebarRail.jsx';
import AdminStickyFooter from './AdminStickyFooter.jsx';
import UnsavedChangesPrompt from './UnsavedChangesPrompt.jsx';
import { AdminLoginCard } from './AdminLoginCard.jsx';
import UsersAndRoomsSection from './UsersAndRoomsSection.jsx';
import MenuDeArea from './MenuDeArea.jsx';
import { adminAuthService } from '../../services/adminAuthService.js';
import { usePermissions, PERMISSIONS } from '../../hooks/usePermissions.js';

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

const BOOTH_VOICE_OPTIONS = {
  es: [
    { id: 'aura-asteria-en', name: 'Deepgram Aura', gender: 'female', engine: 'deepgram', desc: 'Ultra-baja latencia ~140ms • Saldo $200' },
    { id: 'es-ES-ElviraNeural', name: 'Google Elvira', gender: 'female', engine: 'google', desc: 'Fluida y natural • Universal' },
    { id: 'es-ES-AlvaroNeural', name: 'Google Álvaro', gender: 'male', engine: 'google', desc: 'Claro y profesional • Universal' },
    { id: 'qwen3-tts-es', name: 'Alibaba Qwen3-TTS', gender: 'female', engine: 'qwen_tts', desc: 'Ultra-rápido 97ms • Qwen' },
    { id: 'nova', name: 'OpenAI Nova', gender: 'female', engine: 'openai', desc: 'Expresiva y cálida • OpenAI' },
    { id: 'alloy', name: 'OpenAI Alloy', gender: 'neutral', engine: 'openai', desc: 'Neutra y corporativa • OpenAI' },
    { id: 'echo', name: 'OpenAI Echo', gender: 'male', engine: 'openai', desc: 'Barítono suave • OpenAI' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'ElevenLabs Rachel', gender: 'female', engine: 'elevenlabs', desc: 'Fotorrealismo insignia • 11Labs' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'ElevenLabs Antoni', gender: 'male', engine: 'elevenlabs', desc: 'Cinematográfico • 11Labs' }
  ],
  en: [
    { id: 'aura-asteria-en', name: 'Deepgram Asteria', gender: 'female', engine: 'deepgram', desc: 'Ultra-baja latencia ~140ms • Saldo $200' },
    { id: 'aura-orion-en', name: 'Deepgram Orion', gender: 'male', engine: 'deepgram', desc: 'Barítono confiado ~140ms • Saldo $200' },
    { id: 'aura-luna-en', name: 'Deepgram Luna', gender: 'female', engine: 'deepgram', desc: 'Serena y pausada • Saldo $200' },
    { id: 'aura-stella-en', name: 'Deepgram Stella', gender: 'female', engine: 'deepgram', desc: 'Directa e institucional • Saldo $200' },
    { id: 'aura-arcas-en', name: 'Deepgram Arcas', gender: 'male', engine: 'deepgram', desc: 'Amigable y cercano • Saldo $200' },
    { id: 'qwen3-tts-en', name: 'Alibaba Qwen3-TTS', gender: 'female', engine: 'qwen_tts', desc: 'Ultra-rápido 97ms • Qwen' },
    { id: 'en-US-JennyNeural', name: 'Google Jenny', gender: 'female', engine: 'google', desc: 'Articulación nítida • Universal' },
    { id: 'en-US-GuyNeural', name: 'Google Guy', gender: 'male', engine: 'google', desc: 'Seguro y cálido • Universal' },
    { id: 'alloy', name: 'OpenAI Alloy', gender: 'neutral', engine: 'openai', desc: 'Neutra y dinámica • OpenAI' },
    { id: 'nova', name: 'OpenAI Nova', gender: 'female', engine: 'openai', desc: 'Modulación viva • OpenAI' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'ElevenLabs Adam', gender: 'male', engine: 'elevenlabs', desc: 'Keynote magistral • 11Labs' }
  ],
  it: [
    { id: 'aura-asteria-en', name: 'Deepgram Aura', gender: 'female', engine: 'deepgram', desc: 'Ultra-baja latencia ~140ms • Saldo $200' },
    { id: 'it-IT-ElsaNeural', name: 'Google Elsa', gender: 'female', engine: 'google', desc: 'Italiano fluido y expresivo • Universal' },
    { id: 'it-IT-CosimoNeural', name: 'Google Cosimo', gender: 'male', engine: 'google', desc: 'Sereno y refinado • Universal' },
    { id: 'qwen3-tts-it', name: 'Alibaba Qwen3-TTS', gender: 'female', engine: 'qwen_tts', desc: 'Ultra-rápido 97ms • Qwen' },
    { id: 'shimmer', name: 'OpenAI Shimmer', gender: 'female', engine: 'openai', desc: 'Luminosa y clara • OpenAI' },
    { id: 'alloy', name: 'OpenAI Alloy', gender: 'neutral', engine: 'openai', desc: 'Versátil • OpenAI' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'ElevenLabs Domi', gender: 'female', engine: 'elevenlabs', desc: 'Asertiva y dinámica • 11Labs' }
  ],
  pt: [
    { id: 'aura-asteria-en', name: 'Deepgram Aura', gender: 'female', engine: 'deepgram', desc: 'Ultra-baja latencia ~140ms • Saldo $200' },
    { id: 'pt-BR-FranciscaNeural', name: 'Google Francisca', gender: 'female', engine: 'google', desc: 'Portugués brasileño suave • Universal' },
    { id: 'pt-BR-AntonioNeural', name: 'Google Antonio', gender: 'male', engine: 'google', desc: 'Enérgico y amigable • Universal' },
    { id: 'qwen3-tts-pt', name: 'Alibaba Qwen3-TTS', gender: 'female', engine: 'qwen_tts', desc: 'Ultra-rápido 97ms • Qwen' },
    { id: 'echo', name: 'OpenAI Echo', gender: 'male', engine: 'openai', desc: 'Voz pausada y clara • OpenAI' },
    { id: 'nova', name: 'OpenAI Nova', gender: 'female', engine: 'openai', desc: 'Expresiva • OpenAI' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'ElevenLabs Antoni', gender: 'male', engine: 'elevenlabs', desc: 'Locución natural • 11Labs' }
  ]
};

const BOOTHS = [
  { lang: 'es', label: 'Español', flag: 'ES', badge: 'Cabina Principal' },
  { lang: 'en', label: 'English', flag: 'US', badge: 'Cabina Global' },
  { lang: 'it', label: 'Italiano', flag: 'IT', badge: 'Cabina Europea' },
  { lang: 'pt', label: 'Português', flag: 'BR', badge: 'Cabina Iberoamérica' }
];

const TAB_METADATA = {
  'stt': { title: 'Motor de reconocimiento de voz', desc: 'Configura la transcripción en directo y los parámetros de captura acústica' },
  'tts': { title: 'Voces de síntesis por cabina', desc: 'Asigna timbres de voz natural para las cuatro cabinas de interpretación' },
  'ai': { title: 'Modelos de traducción', desc: 'Gestiona los modelos y la estrategia de inferencia para la interpretación simultánea' },
  'appearance': { title: 'Apariencia y tema visual', desc: 'Personaliza la interfaz, esquemas de color y modo claro u oscuro' },
  'medical': { title: 'Modo clínico y glosario', desc: 'Activa vocabulario médico especializado y reglas léxicas estrictas' },
  'users-rooms': { title: 'Gestión de usuarios y salas', desc: 'Monitorea conferencias en directo, participantes y roles de acceso' },
  'keys': { title: 'Claves de proveedores', desc: 'Administra tus credenciales de Deepgram, Google, ElevenLabs y OpenAI' }
};

// Opciones enriquecidas de dos niveles: Título nítido + Subtítulo técnico
const STT_ENGINE_OPTIONS = [
  { value: 'deepgram', label: 'Deepgram Nova-3 Streaming', description: 'Saldo $200 disponible • Latencia ultra-baja ~150ms' },
  { value: 'gemini_live', label: 'Google Gemini 3.5 Live', description: 'Multimodal Cloud • Alta fidelidad acústica en salas' },
  { value: 'whisper', label: 'OpenAI Whisper-1', description: 'Máxima precisión técnica y fidelidad léxica' },
  { value: 'webspeech', label: 'Web Speech API', description: 'Navegador local nativo • 100% gratuito sin cuota' }
];

const STT_STRATEGY_OPTIONS = [
  { value: 'deepgram_balance', label: 'Modo Saldo Deepgram', description: 'Nova-3 + Gemini 3.1 + Aura TTS (Balance óptimo)' },
  { value: 'google_free', label: 'Modo 100% Gratuito', description: 'WebSpeech + Gemini + Google Neural (Cero costes)' },
  { value: 'max_quality', label: 'Máxima Calidad VIP', description: 'Nova-3 + GPT-4o + ElevenLabs (Hiper-realismo)' },
  { value: 'custom', label: 'Configuración Personalizada', description: 'Ajuste manual modular de cada componente' }
];

const STT_LANG_OPTIONS = [
  { value: 'auto', label: 'Detección Automática', description: 'Reconocimiento multilingüe dinámico (Nova-3 / Gemini)' },
  { value: 'es', label: 'Español Fijado', description: 'Dialectos es-ES y es-419' },
  { value: 'en', label: 'Inglés Fijado', description: 'Dialectos en-US y en-GB' },
  { value: 'it', label: 'Italiano Fijado', description: 'Dialecto estándar it-IT' },
  { value: 'pt', label: 'Portugués Fijado', description: 'Dialectos pt-BR y pt-PT' }
];

const STT_VAD_OPTIONS = [
  { value: 'standard', label: 'VAD Estándar', description: 'Recomendado para conferencias y simposios' },
  { value: 'high', label: 'Alta Sensibilidad', description: 'Micrófono distante, solapas o voz suave' },
  { value: 'aggressive', label: 'Filtrado Agresivo de Ruido', description: 'Salas con reverberación o murmullos' }
];

const TTS_GLOBAL_ENGINE_OPTIONS = [
  { value: 'deepgram', label: 'Deepgram Aura / Aura-2', description: 'Latencia ~140ms • Saldo $200' },
  { value: 'google', label: 'Google Neural Universal', description: '100% Gratuito & Ilimitado' },
  { value: 'qwen_tts', label: 'Alibaba Qwen3-TTS', description: 'Ultra-rápido 97ms • CosyVoice' },
  { value: 'elevenlabs', label: 'ElevenLabs Turbo v2.5', description: 'Hiper-realismo VIP • Latencia optimizada' },
  { value: 'openai', label: 'OpenAI TTS-1', description: 'Voces Alloy, Nova, Echo, Shimmer' },
  { value: 'auto', label: 'Auto Inteligente', description: 'Mejor voz activa disponible según latencia' }
];

const TTS_DECALAGE_OPTIONS = [
  { value: 'natural', label: 'Natural con buffer', description: '~1.5s • Oraciones completas y fluidas' },
  { value: 'fast', label: 'Streaming inmediato', description: '~800ms • Prioridad a la ultra-baja latencia' },
  { value: 'paused', label: 'Pausado simultáneo', description: '~2.5s • Máxima coherencia de interpretación' }
];

const AI_PROVIDER_OPTIONS = [
  { value: 'gemini', label: 'Google Gemini 3.1 Flash-Lite', description: 'Recomendado • Sub-150ms y salida JSON' },
  { value: 'qwen', label: 'Alibaba Qwen 3.8', description: 'Open-Weights 27B • Inferencia Ollama o Cloud' },
  { value: 'openai', label: 'OpenAI GPT-4o Mini', description: 'Alta fidelidad gramatical y médica' },
  { value: 'google', label: 'Google Neural', description: 'Traducción directa instantánea sin costo' }
];

const AI_STRATEGY_OPTIONS = [
  { value: 'json_single', label: 'Llamada Única JSON', description: '4 cabinas simultáneas en una sola petición (-75% cuota)' },
  { value: 'parallel', label: 'Inferencia en Paralelo', description: 'Una petición independiente por cabina' },
  { value: 'fallback', label: 'Respaldo Escalonado', description: 'Gemini principal con fallback en OpenAI' }
];

const GEMINI_MODEL_OPTIONS = [
  { value: 'google/gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', description: 'google/gemini-3.1-flash-lite • Ultra-rápido' },
  { value: 'google/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', description: 'google/gemini-3.5-flash-lite • Razonamiento adaptativo' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: 'gemini-2.0-flash • Google AI Studio directo' }
];

const TEMPERATURE_OPTIONS = [
  { value: '0.1', label: '0.1 - Máxima Precisión', description: 'Ideal para conferencias médicas y fidelidad estricta' },
  { value: '0.3', label: '0.3 - Balanceada', description: 'Fluidez natural con consistencia semántica' },
  { value: '0.7', label: '0.7 - Creativa', description: 'Para discursos literarios o coloquiales' }
];

const QWEN_MODEL_OPTIONS = [
  { value: 'qwen/qwen-3.8-27b', label: 'Qwen 3.8 27B Cloud', description: 'qwen/qwen-3.8-27b • OpenRouter oficial' },
  { value: 'qwen/qwen-3.8-flash', label: 'Qwen 3.8 Flash', description: 'qwen/qwen-3.8-flash • Ultra-baja latencia' },
  { value: 'qwen3.8:27b-instruct-q4_k_m', label: 'Qwen 3.8 27B Local', description: 'qwen3.8:27b-instruct-q4_k_m • GGUF Ollama' },
  { value: 'qwen3.5:9b-instruct-q4_k_m', label: 'Qwen 3.5 9B Ligero', description: 'qwen3.5:9b-instruct-q4_k_m • Bajo consumo 5.5GB' }
];

const OPENAI_MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Económico, ágil y con preservación de términos' },
  { value: 'gpt-4o', label: 'GPT-4o Omni', description: 'Modelo insignia multimodal de OpenAI' }
];

const GOOGLE_NEURAL_OPTIONS = [
  { value: 'universal', label: 'Traducción Universal Directa', description: 'Sub-90ms • Cobertura multilingüe instantánea' }
];

const MEDICAL_MODE_OPTIONS = [
  { value: 'true', label: 'Modo Clínico Activado', description: 'Protege siglas hospitalarias, CIE-11 y fármacos DCI' },
  { value: 'false', label: 'Modo Clínico Desactivado', description: 'Lenguaje general sin heurística médica' }
];

const MEDICAL_SPECIALTY_OPTIONS = [
  { value: 'general', label: 'Medicina General & Urgencias', description: 'Cuidados críticos, triage y atención primaria' },
  { value: 'cardiology', label: 'Cardiología & Hemodinámica', description: 'ECG, IAM, arritmias y cateterismo' },
  { value: 'pharmacology', label: 'Farmacología & Dosificaciones', description: 'Denominación Común Internacional (DCI / INN)' },
  { value: 'surgery', label: 'Cirugía & Anestesiología', description: 'Quirófano, monitorización hemodinámica e intubación' }
];

export function DegradadoCabecera() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-full inset-x-0 h-4 bg-gradient-to-b from-white dark:from-zinc-950 to-transparent z-10"
    />
  );
}

export default function AdminSettingsShell({
  variant = 'modal', // 'modal' | 'page'
  isOpen = true,
  onClose = () => {},
  roomId = null,
  onNavigateHost = null,
  onNavigateHome = null,
  onSaveConfig = null
}) {
  const [effectiveRoomId] = useState(() => {
    if (roomId) return roomId;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('room');
      if (r) return r;
      return localStorage.getItem('lv_active_room_id') || null;
    }
    return null;
  });

  const { hasPermission } = usePermissions();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (isOpen || variant === 'page') {
      adminAuthService.verify().then(valid => {
        setIsAuthenticated(valid);
        setIsCheckingAuth(false);
      });
    }
  }, [isOpen, variant]);

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const panel = params.get('panel');
      if (['stt', 'tts', 'ai', 'appearance', 'medical', 'keys'].includes(panel)) {
        return panel;
      }
    }
    return 'stt';
  });

  // URL Sync
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location);
      url.searchParams.set('panel', activeTab);
      window.history.replaceState({}, '', url);
    }
  }, [activeTab]);

  const [sttEngine, setSttEngine] = useState(() => safeGetItem('lv_stt_engine', 'deepgram'));
  const [preferredTtsEngine, setPreferredTtsEngine] = useState(() => safeGetItem('lv_tts_engine', 'deepgram'));
  const [voiceConfig, setVoiceConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('lv_voice_config');
      return saved ? { ...DEFAULT_VOICES, ...JSON.parse(saved) } : DEFAULT_VOICES;
    } catch (e) { return DEFAULT_VOICES; }
  });
  const [voiceGender, setVoiceGender] = useState(() => {
    try {
      const saved = localStorage.getItem('lv_voice_gender');
      return saved ? { ...DEFAULT_GENDERS, ...JSON.parse(saved) } : DEFAULT_GENDERS;
    } catch (e) { return DEFAULT_GENDERS; }
  });

  const [previewingLang, setPreviewingLang] = useState(null);

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

  const [medicalMode, setMedicalMode] = useState(() => safeGetItem('lv_medical_mode') === 'true');
  const [medicalSpecialty, setMedicalSpecialty] = useState(() => safeGetItem('lv_medical_specialty', 'general'));
  const [customGlossary, setCustomGlossary] = useState(() => safeGetItem('lv_custom_glossary'));

  const [decalageMode, setDecalageMode] = useState(() => safeGetItem('lv_decalage_mode', 'natural'));
  const [sttLang, setSttLang] = useState(() => safeGetItem('lv_stt_lang', 'auto'));
  const [sttVad, setSttVad] = useState(() => safeGetItem('lv_stt_vad', 'standard'));
  const [aiStrategy, setAiStrategy] = useState(() => safeGetItem('lv_ai_strategy', 'json_single'));
  const [geminiTemp, setGeminiTemp] = useState(() => safeGetItem('lv_gemini_temp', '0.1'));
  const [qwenTemp, setQwenTemp] = useState(() => safeGetItem('lv_qwen_temp', '0.1'));
  const [openaiModel, setOpenaiModel] = useState(() => safeGetItem('lv_openai_model', 'gpt-4o-mini'));
  const [openaiTemp, setOpenaiTemp] = useState(() => safeGetItem('lv_openai_temp', '0.1'));
  const [googleNeuralMode, setGoogleNeuralMode] = useState(() => safeGetItem('lv_google_neural_mode', 'universal'));

  const [isDirty, setIsDirty] = useState(false);
  
  // Track dirtiness based on state changes. We can do it by saving initial state.
  const [initialState, setInitialState] = useState(null);
  
  useEffect(() => {
    if (!initialState && !isCheckingAuth) {
      setInitialState({
        sttEngine, preferredTtsEngine, voiceConfig, voiceGender,
        deepgramKey, geminiKey, geminiModel, geminiTemp, elevenLabsKey, openaiKey, openaiModel, openaiTemp,
        qwenKey, qwenModel, qwenTemp, qwenEndpoint, qwenTtsEndpoint,
        preferredEngine, aiStrategy, medicalMode, medicalSpecialty, customGlossary, decalageMode,
        sttLang, sttVad, googleNeuralMode
      });
    }
  }, [isCheckingAuth]);

  useEffect(() => {
    if (initialState) {
      const current = {
        sttEngine, preferredTtsEngine, voiceConfig, voiceGender,
        deepgramKey, geminiKey, geminiModel, geminiTemp, elevenLabsKey, openaiKey, openaiModel, openaiTemp,
        qwenKey, qwenModel, qwenTemp, qwenEndpoint, qwenTtsEndpoint,
        preferredEngine, aiStrategy, medicalMode, medicalSpecialty, customGlossary, decalageMode,
        sttLang, sttVad, googleNeuralMode
      };
      setIsDirty(JSON.stringify(current) !== JSON.stringify(initialState));
    }
  }, [sttEngine, preferredTtsEngine, voiceConfig, voiceGender,
      deepgramKey, geminiKey, geminiModel, geminiTemp, elevenLabsKey, openaiKey, openaiModel, openaiTemp,
      qwenKey, qwenModel, qwenTemp, qwenEndpoint, qwenTtsEndpoint,
      preferredEngine, aiStrategy, medicalMode, medicalSpecialty, customGlossary, decalageMode,
      sttLang, sttVad, googleNeuralMode]);
      
  const handleCloseAttempt = (e) => {
    if (e) e.preventDefault();
    if (isDirty) {
      setShowUnsavedPrompt(true);
    } else {
      onClose();
    }
  };

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [serverFlags, setServerFlags] = useState({
    hasGeminiKey: false,
    hasQwenKey: false,
    hasDeepgramKey: false,
    hasElevenLabsKey: false,
    hasOpenAiKey: false
  });

  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [showKeys, setShowKeys] = useState({});
  const toggleShowKey = (keyName) => {
    setShowKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const [touchedKeys, setTouchedKeys] = useState(new Set());
  const markKeyTouched = (keyName) => {
    setTouchedKeys(prev => new Set(prev).add(keyName));
  };

  const previewAbortRef = useRef(null);
  const modalContainerRef = useRef(null);

  useEffect(() => {
    if (variant === 'modal' && !isOpen) {
      if (previewAbortRef.current) {
        previewAbortRef.current.abort();
        previewAbortRef.current = null;
      }
      try { audioPlayerService.stopAll(); } catch (e) {}
      setPreviewingLang(null);
    }
  }, [isOpen, variant]);

  useEffect(() => {
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
      previewAbortRef.current = null;
    }
    try { audioPlayerService.stopAll(); } catch (e) {}
    setPreviewingLang(null);
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (previewAbortRef.current) {
        previewAbortRef.current.abort();
        previewAbortRef.current = null;
      }
      try { audioPlayerService.stopAll(); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    if (variant === 'modal' && isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = originalOverflow; };
    }
  }, [isOpen, variant]);

  useEffect(() => {
    if (variant === 'modal' && isOpen) {
      const timer = setTimeout(() => {
        if (modalContainerRef.current) {
          const focusable = modalContainerRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
          );
          if (focusable.length > 0) focusable[0].focus();
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
            container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])')
          ).filter(el => el.offsetParent !== null);
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
    }
  }, [isOpen, onClose, variant]);

  const PRESETS = {
    deepgram_balance: {
      stt: 'deepgram', engine: 'gemini', tts: 'deepgram',
      voices: { es: 'es-ES-ElviraNeural', en: 'aura-asteria-en', it: 'it-IT-ElsaNeural', pt: 'pt-BR-FranciscaNeural' }
    },
    google_free: {
      stt: 'webspeech', engine: 'gemini', tts: 'google',
      voices: { es: 'es-ES-ElviraNeural', en: 'en-US-JennyNeural', it: 'it-IT-ElsaNeural', pt: 'pt-BR-FranciscaNeural' }
    },
    max_quality: {
      stt: 'deepgram', engine: 'openai', tts: 'elevenlabs',
      voices: { es: '21m00Tcm4TlvDq8ikWAM', en: '21m00Tcm4TlvDq8ikWAM', it: 'AZnzlk1XvdvUeBnXmlld', pt: 'ErXwobaYiN019PkySvjV' }
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

  useEffect(() => {
    if (variant === 'page' || (variant === 'modal' && isOpen)) {
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
            if (data.preferredSttEngine && !localStorage.getItem('lv_stt_engine')) setSttEngine(data.preferredSttEngine);
            if (data.preferredTtsEngine && !localStorage.getItem('lv_tts_engine')) setPreferredTtsEngine(data.preferredTtsEngine);
            if (data.voiceConfig && !localStorage.getItem('lv_voice_config')) setVoiceConfig(prev => ({ ...prev, ...data.voiceConfig }));
            if (data.qwenTtsEndpoint && !localStorage.getItem('lv_qwen_tts_endpoint')) setQwenTtsEndpoint(data.qwenTtsEndpoint);
            if (data.sttLang && !localStorage.getItem('lv_stt_lang')) setSttLang(data.sttLang);
            if (data.sttVad && !localStorage.getItem('lv_stt_vad')) setSttVad(data.sttVad);
            if (data.aiStrategy && !localStorage.getItem('lv_ai_strategy')) setAiStrategy(data.aiStrategy);
            if (data.geminiTemp && !localStorage.getItem('lv_gemini_temp')) setGeminiTemp(data.geminiTemp);
            if (data.qwenTemp && !localStorage.getItem('lv_qwen_temp')) setQwenTemp(data.qwenTemp);
            if (data.openaiModel && !localStorage.getItem('lv_openai_model')) setOpenaiModel(data.openaiModel);
            if (data.openaiTemp && !localStorage.getItem('lv_openai_temp')) setOpenaiTemp(data.openaiTemp);
            if (data.decalageMode && !localStorage.getItem('lv_decalage_mode')) setDecalageMode(data.decalageMode);
            if (data.googleNeuralMode && !localStorage.getItem('lv_google_neural_mode')) setGoogleNeuralMode(data.googleNeuralMode);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, variant]);

  if (variant === 'modal' && !isOpen) return null;

  const handlePreferredTtsEngineChange = (newEngine) => {
    setPreferredTtsEngine(newEngine);
    const newVoices = { ...voiceConfig };
    BOOTHS.forEach(b => {
      const currentGender = voiceGender[b.lang] || 'female';
      const options = BOOTH_VOICE_OPTIONS[b.lang] || [];
      const best = options.find(v => v.engine === newEngine && v.gender === currentGender)
        || options.find(v => v.engine === newEngine)
        || options[0];
      if (best) newVoices[b.lang] = best.id;
    });
    setVoiceConfig(newVoices);
  };

  const handleVoiceChange = (lang, newVoiceId) => {
    setVoiceConfig(prev => ({ ...prev, [lang]: newVoiceId }));
    const found = (BOOTH_VOICE_OPTIONS[lang] || []).find(v => v.id === newVoiceId);
    if (found && (found.gender === 'male' || found.gender === 'female')) {
      setVoiceGender(prev => ({ ...prev, [lang]: found.gender }));
    }
  };

  const handleGenderChange = (lang, newGender) => {
    setVoiceGender(prev => ({ ...prev, [lang]: newGender }));
    const candidates = (BOOTH_VOICE_OPTIONS[lang] || []).filter(v => v.gender === newGender);
    const currentEngine = preferredTtsEngine;
    const matched = candidates.find(v => v.engine === currentEngine) || candidates[0];
    if (matched) setVoiceConfig(prev => ({ ...prev, [lang]: matched.id }));
  };

  const handlePreviewVoice = async (langCode) => {
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

    const sampleTexts = {
      es: 'Bienvenidos a LiftVoice. Esta es una muestra de voz en tiempo real para la cabina en español.',
      en: 'Welcome to LiftVoice. This is a real-time simultaneous voice preview for the English cabin.',
      it: 'Benvenuti a LiftVoice. Questa è una dimostrazione di voce in tempo reale per la cabina italiana.',
      pt: 'Bem-vindos ao LiftVoice. Este é um teste de voz em tempo real para a cabina em português.'
    };
    const sampleText = sampleTexts[langCode] || sampleTexts.es;
    const voice = voiceConfig[langCode] || DEFAULT_VOICES[langCode];
    const gender = voiceGender[langCode] || 'female';

    const selectedVoiceObj = (BOOTH_VOICE_OPTIONS[langCode] || []).find(v => v.id === voice);
    const engineToUse = selectedVoiceObj?.engine || preferredTtsEngine;

    try {
      await audioPlayerService.unlockAudio(effectiveRoomId || 'MAIN', langCode);
      const res = await fetch(`/api/rooms/${effectiveRoomId || 'MAIN'}/preview-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortCtrl.signal,
        body: JSON.stringify({ lang: langCode, sampleText, voice, gender, engine: engineToUse })
      });
      if (abortCtrl.signal.aborted) return;
      const data = await res.json();
      if (abortCtrl.signal.aborted) return;

      if (data && data.audioBase64) {
        await audioPlayerService.playVoicePreview({
          voiceId: voice, lang: langCode, text: sampleText, audioBase64: data.audioBase64,
          mimeType: data.mimeType || 'audio/mpeg', gender
        });
      } else {
        await audioPlayerService.playVoicePreview({
          voiceId: voice, lang: langCode, text: sampleText, gender
        });
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('[AdminSettingsShell] Voice preview warning:', e);
    } finally {
      if (previewAbortRef.current === abortCtrl) setPreviewingLang(null);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    const parsedGlossary = (customGlossary || '').split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);

    try {
      const token = adminAuthService.getToken();
      const resp = await fetch('/api/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          preferredSttEngine: sttEngine, sttEngine, preferredTtsEngine, voiceConfig, voiceGender,
          sttLang, sttVad,
          openaiKey: touchedKeys.has('openai') ? openaiKey : undefined,
          openaiModel, openaiTemp,
          elevenLabsKey: touchedKeys.has('eleven') ? elevenLabsKey : undefined,
          deepgramKey: touchedKeys.has('deepgram') ? deepgramKey : undefined,
          geminiKey: touchedKeys.has('gemini') ? geminiKey : undefined,
          geminiModel: geminiModel || '',
          geminiTemp,
          qwenKey: touchedKeys.has('qwen') ? qwenKey : undefined,
          qwenModel: qwenModel || '',
          qwenTemp,
          qwenEndpoint: touchedKeys.has('qwenEndpoint') ? qwenEndpoint : undefined,
          qwenTtsEndpoint: touchedKeys.has('qwenTtsEndpoint') ? qwenTtsEndpoint : undefined,
          preferredEngine, preferredTranslationEngine: preferredEngine,
          aiStrategy,
          medicalMode, medicalSpecialty, customGlossary: parsedGlossary, decalageMode,
          googleNeuralMode
        })
      });

      if (!resp.ok) throw new Error(`Error del servidor (${resp.status}) al guardar configuración`);

      safeSetItem('lv_stt_engine', sttEngine);
      safeSetItem('lv_stt_lang', sttLang);
      safeSetItem('lv_stt_vad', sttVad);
      safeSetItem('lv_tts_engine', preferredTtsEngine);
      safeSetItem('lv_voice_config', voiceConfig);
      safeSetItem('lv_voice_gender', voiceGender);
      safeSetItem('lv_openai_key', openaiKey);
      safeSetItem('lv_openai_model', openaiModel);
      safeSetItem('lv_openai_temp', openaiTemp);
      safeSetItem('lv_eleven_key', elevenLabsKey);
      safeSetItem('lv_deepgram_key', deepgramKey);
      safeSetItem('lv_gemini_key', geminiKey);
      safeSetItem('lv_gemini_model', geminiModel);
      safeSetItem('lv_gemini_temp', geminiTemp);
      safeSetItem('lv_qwen_key', qwenKey);
      safeSetItem('lv_qwen_model', qwenModel);
      safeSetItem('lv_qwen_temp', qwenTemp);
      safeSetItem('lv_qwen_endpoint', qwenEndpoint);
      safeSetItem('lv_qwen_tts_endpoint', qwenTtsEndpoint);
      safeSetItem('lv_preferred_engine', preferredEngine);
      safeSetItem('lv_ai_strategy', aiStrategy);
      safeSetItem('lv_medical_mode', medicalMode ? 'true' : 'false');
      safeSetItem('lv_medical_specialty', medicalSpecialty);
      safeSetItem('lv_custom_glossary', customGlossary);
      safeSetItem('lv_decalage_mode', decalageMode);
      safeSetItem('lv_google_neural_mode', googleNeuralMode);

      // Propagar al grabador de audio en vivo del cliente
      try {
        if (typeof audioRecorderService !== 'undefined') {
          if (sttLang) audioRecorderService.setLanguage(sttLang);
          if (sttVad) audioRecorderService.setVadSensitivity(sttVad);
          if (decalageMode) audioRecorderService.setDecalageMode(decalageMode);
        }
      } catch (e) {
        console.warn('[AdminSettingsShell] Could not apply audioRecorder settings:', e);
      }

      if (effectiveRoomId) {
        fetch(`/api/rooms/${effectiveRoomId}/voices`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceConfig, voiceGender })
        }).catch(() => {});
      }

      const savedCfg = {
        sttEngine, preferredTtsEngine, voiceConfig, voiceGender, preferredEngine,
        sttLang, sttVad, aiStrategy,
        openaiKey, openaiModel, openaiTemp,
        elevenLabsKey, deepgramKey, geminiKey, geminiModel, geminiTemp,
        qwenKey, qwenModel, qwenTemp, qwenEndpoint, qwenTtsEndpoint,
        medicalMode, medicalSpecialty, customGlossary: parsedGlossary, decalageMode, googleNeuralMode
      };

      setIsSaving(false);
      setIsSaved(true);
      setInitialState(savedCfg);
      setIsDirty(false);

      if (onSaveConfig) onSaveConfig(savedCfg);
      window.dispatchEvent(new CustomEvent('liftvoice_config_saved', { detail: savedCfg }));

      setTimeout(() => {
        setIsSaved(false);
        if (variant === 'modal') onClose();
      }, 700);
    } catch (err) {
      console.warn('Could not sync config to server:', err);
      setIsSaving(false);
      setSaveError(err.message || 'Error al conectar con el servidor.');
    }
  };

  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  const activeKeysCount = [
    deepgramKey || serverFlags.hasDeepgramKey,
    geminiKey || serverFlags.hasGeminiKey,
    qwenKey || serverFlags.hasQwenKey,
    elevenLabsKey || serverFlags.hasElevenLabsKey,
    openaiKey || serverFlags.hasOpenAiKey
  ].filter(Boolean).length;

  const engineSummary = `Cadena: ${sttEngine} + ${preferredEngine} + ${preferredTtsEngine}`;
  const ALL_TABS = [
    { id: 'stt', label: 'Reconocimiento de voz', icon: Mic, badge: sttEngine === 'deepgram' ? 'Deepgram' : (sttEngine ? sttEngine.charAt(0).toUpperCase() + sttEngine.slice(1).toLowerCase() : ''), reqPerm: PERMISSIONS.PERM_ROOM_AUDIO },
    { id: 'tts', label: 'Voces por idioma', icon: Volume2, badge: '4 cabinas', reqPerm: PERMISSIONS.PERM_ROOM_AUDIO },
    { id: 'ai', label: 'Modelos de traducción', icon: Cpu, badge: preferredEngine ? preferredEngine.charAt(0).toUpperCase() + preferredEngine.slice(1).toLowerCase() : '', reqPerm: PERMISSIONS.PERM_AI_MODELS },
    { id: 'appearance', label: 'Apariencia y tema', icon: Palette, badge: theme ? theme.charAt(0).toUpperCase() + theme.slice(1).toLowerCase() : '', reqPerm: PERMISSIONS.PERM_ACCESS_ADMIN },
    { id: 'medical', label: 'Modo clínico', icon: Stethoscope, badge: medicalMode ? 'Activo' : null, reqPerm: PERMISSIONS.PERM_AI_MODELS },
    { id: 'users-rooms', label: 'Usuarios y salas', icon: Users, badge: 'Directo', reqPerm: PERMISSIONS.PERM_ROOM_MANAGEMENT },
    { id: 'keys', label: 'Claves de proveedores', icon: Key, badge: activeKeysCount > 0 ? `${activeKeysCount} activas` : 'Pendientes', reqPerm: PERMISSIONS.PERM_API_KEYS }
  ];

  const TABS = ALL_TABS.filter(tab => hasPermission(tab.reqPerm));

  useEffect(() => {
    if (TABS.length > 0 && !TABS.find(t => t.id === activeTab)) {
      if (activeTab === 'keys') {
        // Just let it be for the "Access Denied" badge display? Or redirect?
        // Issue: "redirige a la primera pestaña autorizada o muestra un estado de acceso denegado"
        // Let's redirect to first authorized tab if it's completely disallowed and we don't have a specific AccessDenied UI, but wait! The issue says: 
        // "Si el usuario no tiene PERM_API_KEYS, la pestaña de claves de API no aparece (o muestra estado de acceso denegado con badge si se navega directamente por ?panel=keys)"
        // It's easier to just redirect to the first available tab to satisfy "redirige a la primera pestaña autorizada"
        setActiveTab(TABS[0].id);
      } else {
        setActiveTab(TABS[0].id);
      }
    }
  }, [hasPermission, activeTab, TABS]);

  const handleReturn = () => {
    if (effectiveRoomId && onNavigateHost) {
      onNavigateHost();
    } else if (onNavigateHome) {
      onNavigateHome();
    } else {
      if (effectiveRoomId) {
        window.history.pushState({}, '', `?room=${effectiveRoomId}&host=true`);
        window.location.reload();
      } else {
        window.history.pushState({}, '', '/');
        window.location.reload();
      }
    }
  };

  const currentTabMeta = TAB_METADATA[activeTab] || {
    title: 'Configuración',
    desc: 'Panel de administración del sistema'
  };

  const renderSidebarContent = () => (
    <AdminSidebarRail
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      engineSummary={engineSummary}
      onLogout={() => setIsAuthenticated(false)}
    />
  );

  const mainContent = (
    <div className={`flex-1 ${variant === 'modal' ? 'px-6 sm:px-8 pt-6 pb-8 space-y-8' : 'min-w-0 space-y-8'}`}>
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PESTAÑA: RECONOCIMIENTO DE VOZ                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'stt' && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
              Motor de reconocimiento de voz
            </h4>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
              Selecciona el motor de transcripción en directo del ponente y la estrategia de consumo de cuota.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
              {/* Motor Principal */}
              <div>
                <label htmlFor="admin-stt-engine" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Motor Principal de Transcripción
                </label>
                <SelectDropdown
                  id="admin-stt-engine"
                  aria-label="Motor principal de transcripción"
                  value={sttEngine}
                  options={STT_ENGINE_OPTIONS}
                  onChange={(e) => { setSttEngine(e.target.value); setIsDirty(true); }}
                  className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  {sttEngine === 'deepgram' && 'Modelo acústico insignia con latencia ultra-baja (~150ms) y puntuación inteligente. Consume tu saldo de $200.'}
                  {sttEngine === 'gemini_live' && 'Transcripción multimodal de Google optimizada para entornos con reverberación y salas amplias.'}
                  {sttEngine === 'whisper' && 'Reconocimiento robusto con alta fidelidad léxica, ideal para simposios médicos y conferencias técnicas.'}
                  {sttEngine === 'webspeech' && '100% nativo y gratuito en tu navegador (Chrome, Edge, Safari). Sin consumo de API ni servidores.'}
                </p>
              </div>

              {/* Estrategia de Ejecución / Preset */}
              <div>
                <label htmlFor="admin-stt-strategy" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Estrategia de Ejecución & Presupuesto
                </label>
                <SelectDropdown
                  id="admin-stt-strategy"
                  aria-label="Estrategia de ejecución y presupuesto"
                  value={isPresetActive('deepgram_balance') ? 'deepgram_balance' : isPresetActive('google_free') ? 'google_free' : isPresetActive('max_quality') ? 'max_quality' : 'custom'}
                  options={STT_STRATEGY_OPTIONS}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      applyPreset(e.target.value);
                    }
                    setIsDirty(true);
                  }}
                  className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  Sincroniza en un clic el reconocimiento de voz, la traducción y la síntesis vocal para optimizar costes o calidad.
                </p>
              </div>
            </div>
          </div>

          <hr className="border-t border-zinc-200/80 dark:border-white/10 my-8" />

          <div>
            <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
              Parámetros de Captura & Audio
            </h4>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
              Ajustes para el filtrado acústico y la detección del orador principal.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
              <div>
                <label htmlFor="admin-stt-lang" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Detección de Idioma del Ponente
                </label>
                <SelectDropdown
                  id="admin-stt-lang"
                  aria-label="Detección de idioma del ponente"
                  value={sttLang}
                  options={STT_LANG_OPTIONS}
                  onChange={(e) => { setSttLang(e.target.value); setIsDirty(true); }}
                  className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  Permite alternar de idioma sobre la marcha o forzar el dialecto nativo para evitar falsas detecciones.
                </p>
              </div>

              <div>
                <label htmlFor="admin-stt-vad" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Filtro de Silencio & VAD (Voice Activity Detection)
                </label>
                <SelectDropdown
                  id="admin-stt-vad"
                  aria-label="Filtro de silencio y VAD"
                  value={sttVad}
                  options={STT_VAD_OPTIONS}
                  onChange={(e) => { setSttVad(e.target.value); setIsDirty(true); }}
                  className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  Evita transcripciones involuntarias por toses, murmullos del público o pausas largas del orador.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PESTAÑA: VOCES POR IDIOMA                                   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'tts' && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
              Motor de síntesis vocal
            </h4>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
              Define el proveedor predeterminado y la sincronización temporal del audio de interpretación.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
              <div>
                <label htmlFor="admin-tts-global" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Motor de Síntesis Predeterminado
                </label>
                <SelectDropdown
                  id="admin-tts-global"
                  aria-label="Motor de síntesis predeterminado"
                  value={preferredTtsEngine}
                  options={TTS_GLOBAL_ENGINE_OPTIONS}
                  onChange={(e) => handlePreferredTtsEngineChange(e.target.value)}
                  className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  Asigna el proveedor de voz a las cabinas de traducción de forma automática.
                </p>
              </div>

              <div>
                <label htmlFor="admin-tts-decalage" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Modo de Décalage & Latencia
                </label>
                <SelectDropdown
                  id="admin-tts-decalage"
                  aria-label="Modo de décalage y latencia"
                  value={decalageMode}
                  options={TTS_DECALAGE_OPTIONS}
                  onChange={(e) => { setDecalageMode(e.target.value); setIsDirty(true); }}
                  className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  El décalage equilibra la velocidad de entrega del audio traducido frente a la naturalidad tonal.
                </p>
              </div>
            </div>
          </div>

          <hr className="border-t border-zinc-200/80 dark:border-white/10 my-8" />

          <div>
            <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
              Cabinas de Traducción Simultánea
            </h4>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
              Configura el timbre de voz y prueba la pronunciación en directo para cada canal de oyente.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
              {BOOTHS.map((b) => {
                const currentVoice = voiceConfig[b.lang] || DEFAULT_VOICES[b.lang];
                const currentGender = voiceGender[b.lang] || 'female';
                const availableVoices = BOOTH_VOICE_OPTIONS[b.lang] || [];
                const isPreviewing = previewingLang === b.lang;

                return (
                  <div
                    key={b.lang}
                    className="p-5 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-white/5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CountryFlag code={b.lang} className="w-5 h-5 rounded-xs shadow-2xs flex-shrink-0" />
                        <div>
                          <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                            {b.label}
                          </span>
                        </div>
                      </div>

                      {/* Gender switch */}
                      <div className="flex items-center bg-zinc-200/70 dark:bg-white/10 rounded-xl p-0.5 border border-zinc-200/80 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => handleGenderChange(b.lang, 'female')}
                          className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all cursor-pointer ${
                            currentGender === 'female'
                              ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                          }`}
                        >
                          Fem
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenderChange(b.lang, 'male')}
                          className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all cursor-pointer ${
                            currentGender === 'male'
                              ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                          }`}
                        >
                          Masc
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`admin-voice-${b.lang}`} className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                        Voz de interpretación
                      </label>
                      <SelectDropdown
                        id={`admin-voice-${b.lang}`}
                        aria-label={`Voz asignada para cabina ${b.label}`}
                        value={currentVoice}
                        options={availableVoices.map((v) => ({
                          value: v.id,
                          label: v.name,
                          description: v.desc
                        }))}
                        onChange={(e) => handleVoiceChange(b.lang, e.target.value)}
                        className="w-full h-11 px-3.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePreviewVoice(b.lang)}
                      className={`w-full h-11 px-4 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isPreviewing
                          ? 'bg-zinc-100 hover:bg-zinc-200/90 text-zinc-900 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white border border-zinc-300 dark:border-white/20 shadow-2xs'
                          : 'bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-white/10 shadow-2xs'
                      }`}
                    >
                      {isPreviewing ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Detener voz</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Probar voz</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PESTAÑA: MODELOS DE TRADUCCIÓN                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'ai' && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
              Motor de Inferencia y Traducción
            </h4>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
              Gestiona los modelos de lenguaje y la estrategia de generación simultánea en 4 idiomas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
              <div>
                <label htmlFor="admin-ai-provider" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Proveedor Principal de Inferencia
                </label>
                <SelectDropdown
                  id="admin-ai-provider"
                  aria-label="Proveedor principal de inferencia"
                  value={preferredEngine}
                  options={AI_PROVIDER_OPTIONS}
                  onChange={(e) => { setPreferredEngine(e.target.value); setIsDirty(true); }}
                  className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  {preferredEngine === 'gemini' && 'Inferencia ultra-rápida en sub-150ms con salida estructurada JSON sin razonamiento forzado.'}
                  {preferredEngine === 'qwen' && 'Modelo de pesos abiertos con excelente soporte para lenguas romances e inferencia local.'}
                  {preferredEngine === 'openai' && 'Modelo optimizado con alta consistencia gramatical y preservación de terminología especializada.'}
                  {preferredEngine === 'google' && 'Traducción directa universal con latencia inferior a 90ms sin costo de API adicional.'}
                </p>
              </div>

              <div>
                <label htmlFor="admin-ai-strategy" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Estrategia de Generación Multilingüe
                </label>
                <SelectDropdown
                  id="admin-ai-strategy"
                  aria-label="Estrategia de generación multilingüe"
                  value={aiStrategy}
                  options={AI_STRATEGY_OPTIONS}
                  onChange={(e) => { setAiStrategy(e.target.value); setIsDirty(true); }}
                  className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  La llamada única estructurada reduce el consumo de cuota un 75% y sincroniza los tiempos de audio.
                </p>
              </div>
            </div>
          </div>

          <hr className="border-t border-zinc-200/80 dark:border-white/10 my-8" />

          <div>
            <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
              Parámetros del Modelo Seleccionado
            </h4>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
              Ajuste de hiperparámetros, versión específica y conexiones locales.
            </p>

            {preferredEngine === 'gemini' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
                <div>
                  <label htmlFor="admin-gemini-model" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    Modelo de Gemini Activo
                  </label>
                  <SelectDropdown
                    id="admin-gemini-model"
                    value={geminiModel}
                    options={GEMINI_MODEL_OPTIONS}
                    onChange={(e) => { setGeminiModel(e.target.value); setIsDirty(true); }}
                    className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                    Optimizado para devolver las 4 traducciones en una sola respuesta JSON compacta.
                  </p>
                </div>

                <div>
                  <label htmlFor="admin-gemini-temp" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    Temperatura / Fidelidad
                  </label>
                  <SelectDropdown
                    id="admin-gemini-temp"
                    value={geminiTemp}
                    options={TEMPERATURE_OPTIONS}
                    onChange={(e) => { setGeminiTemp(e.target.value); setIsDirty(true); }}
                    className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                    Una temperatura baja previene alucinaciones y respeta fielmente el mensaje del ponente.
                  </p>
                </div>
              </div>
            )}

            {preferredEngine === 'qwen' && (
              <div className="space-y-6 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <label htmlFor="admin-qwen-model" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                      Modelo de Qwen Activo
                    </label>
                    <SelectDropdown
                      id="admin-qwen-model"
                      value={qwenModel}
                      options={QWEN_MODEL_OPTIONS}
                      onChange={(e) => { setQwenModel(e.target.value); setIsDirty(true); }}
                      className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                    />
                  </div>

                  <div>
                    <label htmlFor="admin-qwen-temp" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                      Temperatura
                    </label>
                    <SelectDropdown
                      id="admin-qwen-temp"
                      value={qwenTemp}
                      options={TEMPERATURE_OPTIONS}
                      onChange={(e) => { setQwenTemp(e.target.value); setIsDirty(true); }}
                      className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                      Endpoint LLM (Ollama / vLLM local)
                    </label>
                    <input
                      type="text"
                      value={qwenEndpoint}
                      onChange={(e) => { setQwenEndpoint(e.target.value); markKeyTouched('qwenEndpoint'); setIsDirty(true); }}
                      placeholder="http://localhost:11434/v1"
                      className="w-full h-11 px-4 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                      Endpoint Qwen-TTS (/v1/audio/speech)
                    </label>
                    <input
                      type="text"
                      value={qwenTtsEndpoint}
                      onChange={(e) => { setQwenTtsEndpoint(e.target.value); markKeyTouched('qwenTtsEndpoint'); setIsDirty(true); }}
                      placeholder="http://localhost:8000/v1/audio/speech"
                      className="w-full h-11 px-4 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {preferredEngine === 'openai' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
                <div>
                  <label htmlFor="admin-openai-model" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    Modelo de OpenAI Activo
                  </label>
                  <SelectDropdown
                    id="admin-openai-model"
                    value={openaiModel}
                    options={OPENAI_MODEL_OPTIONS}
                    onChange={(e) => { setOpenaiModel(e.target.value); setIsDirty(true); }}
                    className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                  />
                </div>

                <div>
                  <label htmlFor="admin-openai-temp" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    Temperatura
                  </label>
                  <SelectDropdown
                    id="admin-openai-temp"
                    value={openaiTemp}
                    options={TEMPERATURE_OPTIONS}
                    onChange={(e) => { setOpenaiTemp(e.target.value); setIsDirty(true); }}
                    className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                  />
                </div>
              </div>
            )}

            {preferredEngine === 'google' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
                <div>
                  <label htmlFor="admin-google-neural-mode" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    Modo Google Neural
                  </label>
                  <SelectDropdown
                    id="admin-google-neural-mode"
                    aria-label="Modo Google Neural"
                    value={googleNeuralMode}
                    options={GOOGLE_NEURAL_OPTIONS}
                    onChange={(e) => { setGoogleNeuralMode(e.target.value); setIsDirty(true); }}
                    className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PESTAÑA: MODO MÉDICO & GLOSARIO                             */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'medical' && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
              Especialización Médica & Terminología
            </h4>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
              Activa la nomenclatura clínica CIE-11, fármacos DCI y acrónimos hospitalarios en la traducción simultánea.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
              <div>
                <label htmlFor="admin-med-mode" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Estado del Modo Clínico
                </label>
                <SelectDropdown
                  id="admin-med-mode"
                  value={medicalMode ? 'true' : 'false'}
                  options={MEDICAL_MODE_OPTIONS}
                  onChange={(e) => { setMedicalMode(e.target.value === 'true'); setIsDirty(true); }}
                  className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  Protege siglas críticas (ECG, SpO2, IAM, TVP) para evitar alteraciones coloquiales.
                </p>
              </div>

              <div>
                <label htmlFor="admin-med-specialty" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Especialidad Principal de la Conferencia
                </label>
                <SelectDropdown
                  id="admin-med-specialty"
                  value={medicalSpecialty}
                  options={MEDICAL_SPECIALTY_OPTIONS}
                  onChange={(e) => { setMedicalSpecialty(e.target.value); setIsDirty(true); }}
                  disabled={!medicalMode}
                  className="w-full h-11 px-3.5 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all cursor-pointer disabled:opacity-50"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  Ajusta el priming terminológico del modelo para la jerga del simposio.
                </p>
              </div>
            </div>
          </div>

          <hr className="border-t border-zinc-200/80 dark:border-white/10 my-8" />

          <div>
            <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
              Glosario Personalizado de la Conferencia
            </h4>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
              Introduce siglas, medicamentos o nombres técnicos separados por coma para su preservación literal.
            </p>

            <div className="mt-4">
              <textarea
                rows={4}
                value={customGlossary}
                onChange={(e) => { setCustomGlossary(e.target.value); setIsDirty(true); }}
                placeholder="SpO2, ECG, enoxaparina, amiodarona, troponina, IAM, shock cardiogénico, CIE-11..."
                className="w-full p-4 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all resize-none"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                Los términos introducidos se inyectarán como reglas léxicas estrictas en el prompt de traducción simultánea.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PESTAÑA: CLAVES DE API                                      */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'keys' && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
              Credenciales de Proveedores
            </h4>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
              Las credenciales se guardan de forma segura en tu navegador y se sincronizan con la sesión activa.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-4">
              {/* Deepgram Key */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="admin-key-deepgram" className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Clave de Deepgram
                  </label>
                  {serverFlags.hasDeepgramKey && (
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      En servidor
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    id="admin-key-deepgram"
                    type={showKeys.deepgram ? 'text' : 'password'}
                    value={deepgramKey}
                    onChange={(e) => { setDeepgramKey(e.target.value); markKeyTouched('deepgram'); setIsDirty(true); }}
                    placeholder={serverFlags.hasDeepgramKey ? 'Configurada en el servidor (.env) — escribe para reemplazar' : 'Clave de Deepgram (Nova-3 y Aura)...'}
                    className="w-full h-11 pl-4 pr-11 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('deepgram')}
                    className="absolute right-3.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                    aria-label={showKeys.deepgram ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showKeys.deepgram ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  Saldo disponible de $200. Cubre más de 15 eventos de 5 horas con audio en vivo.
                </p>
              </div>

              {/* Google Gemini Key */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="admin-key-gemini" className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Clave de Google Gemini
                  </label>
                  {serverFlags.hasGeminiKey && (
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      En servidor
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    id="admin-key-gemini"
                    type={showKeys.gemini ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => { setGeminiKey(e.target.value); markKeyTouched('gemini'); setIsDirty(true); }}
                    placeholder={serverFlags.hasGeminiKey ? 'Configurada en el servidor (.env) — escribe para reemplazar' : 'AIzaSy... o sk-or-v1-...'}
                    className="w-full h-11 pl-4 pr-11 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('gemini')}
                    className="absolute right-3.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                    aria-label={showKeys.gemini ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showKeys.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  Requerida para la inferencia multilingüe en tiempo real (&lt;140ms).
                </p>
              </div>

              {/* Alibaba Qwen Key */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="admin-key-qwen" className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Clave de Alibaba Qwen
                  </label>
                  {serverFlags.hasQwenKey && (
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      En servidor
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    id="admin-key-qwen"
                    type={showKeys.qwen ? 'text' : 'password'}
                    value={qwenKey}
                    onChange={(e) => { setQwenKey(e.target.value); markKeyTouched('qwen'); setIsDirty(true); }}
                    placeholder={serverFlags.hasQwenKey ? 'Configurada en el servidor (.env) — escribe para reemplazar' : 'sk-or-v1-... o sk-...'}
                    className="w-full h-11 pl-4 pr-11 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('qwen')}
                    className="absolute right-3.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                    aria-label={showKeys.qwen ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showKeys.qwen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  Opcional. Habilita modelos Qwen 3.8 en la nube y síntesis de voz Qwen3-TTS.
                </p>
              </div>

              {/* ElevenLabs Key */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="admin-key-elevenlabs" className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Clave de ElevenLabs
                  </label>
                  {serverFlags.hasElevenLabsKey && (
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      En servidor
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    id="admin-key-elevenlabs"
                    type={showKeys.eleven ? 'text' : 'password'}
                    value={elevenLabsKey}
                    onChange={(e) => { setElevenLabsKey(e.target.value); markKeyTouched('eleven'); setIsDirty(true); }}
                    placeholder={serverFlags.hasElevenLabsKey ? 'Configurada en el servidor (.env) — escribe para reemplazar' : 'xi_api_key...'}
                    className="w-full h-11 pl-4 pr-11 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('eleven')}
                    className="absolute right-3.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                    aria-label={showKeys.eleven ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showKeys.eleven ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  Opcional. Habilita timbres fotorrealistas VIP (Rachel, Adam, Antoni).
                </p>
              </div>

              {/* OpenAI Key */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="admin-key-openai" className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Clave de OpenAI
                  </label>
                  {serverFlags.hasOpenAiKey && (
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      En servidor
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    id="admin-key-openai"
                    type={showKeys.openai ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => { setOpenaiKey(e.target.value); markKeyTouched('openai'); setIsDirty(true); }}
                    placeholder={serverFlags.hasOpenAiKey ? 'Configurada en el servidor (.env) — escribe para reemplazar' : 'sk-proj-...'}
                    className="w-full h-11 pl-4 pr-11 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('openai')}
                    className="absolute right-3.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                    aria-label={showKeys.openai ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                  Opcional. Habilita síntesis OpenAI (Alloy, Nova, Echo) y transcriptor Whisper.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PESTAÑA: USUARIOS Y SALAS                                   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'users-rooms' && (
        <UsersAndRoomsSection />
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PESTAÑA: APARIENCIA Y TEMA                                  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'appearance' && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
              Preferencia de Interfaz & Tema
            </h4>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
              Ajusta la paleta visual según las condiciones lumínicas de la sala, auditorio o cabina de traducción.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-4">
              {[
                { id: 'light', label: 'Modo Claro', desc: 'Fondo blanco con contraste nítido para conferencias de día.', icon: Sun },
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
                    className={`p-5 rounded-2xl border-2 text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white border-zinc-950 dark:border-white shadow-xs'
                        : 'bg-zinc-50/50 dark:bg-white/5 border-zinc-200/80 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                        isSelected ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-zinc-200/70 dark:bg-white/10 text-zinc-700 dark:text-zinc-300'
                      }`}>
                        <ItemIcon className="w-4.5 h-4.5" />
                      </div>
                      {isSelected && (
                        <div
                          className="w-2.5 h-2.5 rounded-full bg-zinc-950 dark:bg-white mt-1 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="font-semibold text-xs sm:text-sm">{item.label}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      {item.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Banner Global de Error de Guardado */}
      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2.5 animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-medium break-words">{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-full text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 transition-colors cursor-pointer flex-shrink-0"
            aria-label="Cerrar mensaje de error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );

  if (isCheckingAuth) {
    if (variant === 'modal') {
      return (
        <div className="w-full max-w-5xl h-[92vh] sm:h-[680px] max-h-[92vh] rounded-[28px] sm:rounded-[30px] bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl flex items-center justify-center relative">
          <button onClick={handleCloseAttempt} className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 z-10 cursor-pointer rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"><X className="w-5 h-5"/></button>
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        </div>
      );
    }
    return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>;
  }

  if (!isAuthenticated) {
    if (variant === 'modal') {
      return (
        <div className="w-full max-w-md my-auto rounded-[28px] bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 shadow-2xl overflow-hidden relative flex items-center justify-center p-2 sm:p-4">
           <button onClick={handleCloseAttempt} className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 z-10 cursor-pointer rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"><X className="w-5 h-5"/></button>
           <AdminLoginCard
             onLoginSuccess={() => setIsAuthenticated(true)}
             onCancel={handleCloseAttempt}
             variant="modal"
             roomId={effectiveRoomId}
           />
        </div>
      );
    }
    return (
      <div className="min-h-dvh w-full max-w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col justify-between transition-colors duration-150 font-sans">
        {/* Header de /admin idéntico al diseño general */}
        <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md pt-safe transition-colors duration-150">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-15 sm:h-16">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="flex items-center gap-1 flex-shrink-0 select-none">
                <div className="w-1 h-5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
                <div className="w-1 h-3.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-base text-zinc-900 dark:text-zinc-50 tracking-tight">LiftVoice</span>
                <span className="text-zinc-300 dark:text-zinc-700 select-none hidden sm:inline-block">•</span>
                <span className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 truncate">Configuración del Sistema</span>
              </div>
            </div>
            {effectiveRoomId && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-2xs">
                <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse flex-shrink-0" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Sala:</span>
                <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100">{effectiveRoomId}</span>
              </div>
            )}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button type="button" onClick={toggleTheme} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer shadow-2xs" aria-label="Cambiar tema de color">
                {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-zinc-400 hover:text-zinc-100" /> : <Moon className="w-4 h-4 text-zinc-600 hover:text-zinc-900" />}
              </button>
              <button type="button" onClick={handleReturn} className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-full bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-2xs transition-all active:scale-95">
                {effectiveRoomId ? <><ArrowLeft className="w-3.5 h-3.5" /><span className="hidden sm:inline">Volver a la sala</span><span className="sm:hidden">Sala</span></> : <><Home className="w-3.5 h-3.5" /><span>Volver al inicio</span></>}
              </button>
            </div>
          </div>
        </header>

        {/* Contenido interactivo con diseño exacto a la entrada de la sala */}
        <main className="flex-1 flex flex-col justify-between overflow-y-auto min-h-0">
          <AdminLoginCard
            onLoginSuccess={() => setIsAuthenticated(true)}
            onCancel={handleReturn}
            variant="page"
            roomId={effectiveRoomId}
          />

          <footer className="w-full border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/30 py-5 sm:py-6 px-4 sm:px-8 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] transition-colors mt-auto flex-shrink-0">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6 text-xs sm:text-sm">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-center sm:text-left">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight text-xs sm:text-sm">
                  LiftVoice
                </span>
                <span className="text-zinc-300 dark:text-zinc-700 select-none">&bull;</span>
                <span className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">
                  Panel de Seguridad Administrativo
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-zinc-400 dark:text-zinc-500 font-mono">
                <span>Acceso autenticado</span>
                <span className="text-zinc-300 dark:text-zinc-700 select-none">&bull;</span>
                <span>&copy; 2026</span>
              </div>
            </div>
          </footer>
        </main>
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div 
        className="relative w-full h-full sm:h-[88vh] sm:max-h-[820px] sm:max-w-[1100px] flex flex-col md:flex-row overflow-hidden rounded-none sm:rounded-[32px] bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-2xl text-left focus:outline-none" 
        ref={modalContainerRef}
      >
        {/* Left Sidebar Rail (Visible en md+, en móvil oculto para activar MenuDeArea) */}
        <div className="hidden md:flex md:w-[268px] border-r border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/30 flex-col justify-between shrink-0 select-none">
          {renderSidebarContent()}
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 flex flex-col justify-between h-full overflow-hidden bg-white dark:bg-zinc-950 min-w-0">
          {/* Modal Header con MenuDeArea táctil para móvil */}
          <header className="relative z-20 flex shrink-0 items-start justify-between gap-4 px-6 sm:px-8 pt-5 sm:pt-7 pb-4 border-b border-zinc-200/80 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md">
            <DegradadoCabecera />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <MenuDeArea
                  idTitulo="admin-modal-area-title"
                  titulo={currentTabMeta.title}
                  opciones={TABS.map(t => ({
                    id: t.id,
                    title: t.label,
                    icon: t.icon,
                    badge: t.badge
                  }))}
                  actual={activeTab}
                  onElegir={(newId) => setActiveTab(newId)}
                  etiquetaMenu="Secciones del panel de administración"
                />
                {effectiveRoomId && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-300 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Sala: {effectiveRoomId}</span>
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-[65ch] truncate sm:whitespace-normal leading-relaxed">
                {currentTabMeta.desc}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-9 h-9 rounded-full border border-zinc-200/80 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer shadow-2xs"
                title={`Tema actual: ${theme === 'system' ? 'Sistema (' + resolvedTheme + ')' : theme}`}
                aria-label="Cambiar tema de color"
              >
                {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleCloseAttempt}
                className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Cerrar panel de administración"
                aria-label="Cerrar panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-custom scrollbar-fina">
            {mainContent}
          </div>

          {/* Sticky Actions Footer */}
          <AdminStickyFooter 
            onSave={handleSave} 
            onCancel={handleCloseAttempt} 
            isDirty={isDirty} 
            isSaving={isSaving} 
            isSaved={isSaved} 
          />
        </div>

        {/* Unsaved Changes Prompt */}
        <UnsavedChangesPrompt
          isOpen={showUnsavedPrompt}
          onCancel={() => setShowUnsavedPrompt(false)}
          onConfirm={() => {
            setShowUnsavedPrompt(false);
            onClose();
          }}
        />
      </div>
    );
  }

  // variant === 'page'
  return (
    <div className="min-h-dvh w-full max-w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col justify-between transition-colors duration-150 font-sans">
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md pt-safe transition-colors duration-150">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-15 sm:h-16">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="flex items-center gap-1 flex-shrink-0 select-none">
              <div className="w-1 h-5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
              <div className="w-1 h-3.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-base text-zinc-900 dark:text-zinc-50 tracking-tight">LiftVoice</span>
              <span className="text-zinc-300 dark:text-zinc-700 select-none hidden sm:inline-block">•</span>
              <span className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 truncate">Configuración del Sistema</span>
            </div>
          </div>
          {effectiveRoomId && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-2xs">
              <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse flex-shrink-0" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Sala:</span>
              <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100">{effectiveRoomId}</span>
            </div>
          )}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button type="button" onClick={toggleTheme} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer shadow-2xs" aria-label="Cambiar tema de color">
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-zinc-400 hover:text-zinc-100" /> : <Moon className="w-4 h-4 text-zinc-600 hover:text-zinc-900" />}
            </button>
            <button type="button" onClick={handleReturn} className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-full bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-2xs transition-all active:scale-95">
              {effectiveRoomId ? <><ArrowLeft className="w-3.5 h-3.5" /><span className="hidden sm:inline">Volver a la sala</span><span className="sm:hidden">Sala</span></> : <><Home className="w-3.5 h-3.5" /><span>Volver al inicio</span></>}
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col md:flex-row gap-6 lg:gap-8">
        <aside className="hidden md:block w-full md:w-64 lg:w-72 flex-shrink-0 select-none">
          <div className="sticky top-24 space-y-4">
            {renderSidebarContent()}
          </div>
        </aside>
        <section className="flex-1 min-w-0 space-y-6">
          {/* Selector táctil móvil de secciones para /admin (MenuDeArea) */}
          <div className="md:hidden pb-4 border-b border-zinc-200/80 dark:border-white/10">
            <MenuDeArea
              idTitulo="admin-page-area-title"
              titulo={currentTabMeta.title}
              opciones={TABS.map(t => ({
                id: t.id,
                title: t.label,
                icon: t.icon,
                badge: t.badge
              }))}
              actual={activeTab}
              onElegir={(newId) => setActiveTab(newId)}
              etiquetaMenu="Secciones de configuración"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {currentTabMeta.desc}
            </p>
          </div>
          {mainContent}
        </section>
      </main>
      <AdminStickyFooter onSave={handleSave} onCancel={handleReturn} isDirty={isDirty} isSaving={isSaving} isSaved={isSaved} />
      <UnsavedChangesPrompt isOpen={showUnsavedPrompt} onCancel={() => setShowUnsavedPrompt(false)} onConfirm={() => { setShowUnsavedPrompt(false); onClose(); }} />
    </div>
  );
}
