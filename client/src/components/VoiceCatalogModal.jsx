import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Play, Square, Loader2, Check, Headphones, Volume2, Search, SlidersHorizontal
} from 'lucide-react';
import { audioPlayerService } from '../services/audioPlayer.js';
import CountryFlag from './shared/CountryFlag.jsx';

const CABINS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' }
];

const CABIN_NAMES = {
  es: 'Español',
  en: 'English',
  it: 'Italiano',
  pt: 'Português'
};

export function getEngineDisplayName(engine) {
  switch (engine) {
    case 'gemini_live': return 'Google Gemini Live (24kHz)';
    case 'edge':
    case 'google': return 'Edge / Google Neural';
    case 'deepgram': return 'Deepgram Aura-2';
    case 'openai': return 'OpenAI TTS';
    case 'elevenlabs': return 'ElevenLabs Flash';
    case 'cartesia': return 'Cartesia Sonic';
    case 'qwen_tts': return 'Qwen Audio';
    default: return engine ? engine.charAt(0).toUpperCase() + engine.slice(1) : 'Neuronal';
  }
}

function normalizeLangCode(lang) {
  if (!lang) return 'es';
  const clean = String(lang).toLowerCase().trim();
  if (clean.startsWith('pt')) return 'pt';
  return clean.length > 2 ? clean.slice(0, 2) : clean;
}

export const FALLBACK_VOICES = [
  {
    id: 'gemini-live-aoede',
    engine: 'gemini_live',
    name: 'Google Aoede (Gemini Live)',
    gender: 'female',
    tone: 'Cálida, Natural, Expresiva',
    desc: 'Voz insignia de Google Gemini Live a 24kHz, ideal para conferencias generales.',
    lang: 'all',
    languages: ['es', 'en', 'it', 'pt'],
    latency: '~80ms',
    badge: 'Google Gemini Live • 24kHz ⚡',
    tier: 'zero_cost',
    tierLabel: 'Gemini Live S2S',
    scenario: 'keynote',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'gemini-live-kore',
    engine: 'gemini_live',
    name: 'Google Kore (Gemini Live)',
    gender: 'female',
    tone: 'Serena, Académica, Pausada',
    desc: 'Voz serena y académica a 24kHz, perfecta para simposios médicos y técnicos.',
    lang: 'all',
    languages: ['es', 'en', 'it', 'pt'],
    latency: '~80ms',
    badge: 'Google Gemini Live • 24kHz ⚡',
    tier: 'zero_cost',
    tierLabel: 'Gemini Live S2S',
    scenario: 'panel',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'gemini-live-puck',
    engine: 'gemini_live',
    name: 'Google Puck (Gemini Live)',
    gender: 'neutral',
    tone: 'Ágil, Dinámica, Conversacional',
    desc: 'Voz neutra y rápida a 24kHz, optimizada para rondas de preguntas y respuestas.',
    lang: 'all',
    languages: ['es', 'en', 'it', 'pt'],
    latency: '~80ms',
    badge: 'Google Gemini Live • 24kHz ⚡',
    tier: 'zero_cost',
    tierLabel: 'Gemini Live S2S',
    scenario: 'conversational',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'gemini-live-charon',
    engine: 'gemini_live',
    name: 'Google Charon (Gemini Live)',
    gender: 'male',
    tone: 'Barítono, Profundo, Solemne',
    desc: 'Voz masculina grave y solemne a 24kHz, excelente para alocuciones magistrales.',
    lang: 'all',
    languages: ['es', 'en', 'it', 'pt'],
    latency: '~80ms',
    badge: 'Google Gemini Live • 24kHz ⚡',
    tier: 'zero_cost',
    tierLabel: 'Gemini Live S2S',
    scenario: 'keynote',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'gemini-live-fenrir',
    engine: 'gemini_live',
    name: 'Google Fenrir (Gemini Live)',
    gender: 'male',
    tone: 'Firme, Directo, Asertivo',
    desc: 'Voz masculina enérgica y asertiva a 24kHz para debates y paneles ejecutivos.',
    lang: 'all',
    languages: ['es', 'en', 'it', 'pt'],
    latency: '~80ms',
    badge: 'Google Gemini Live • 24kHz ⚡',
    tier: 'zero_cost',
    tierLabel: 'Gemini Live S2S',
    scenario: 'panel',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'es-ES-ElviraNeural',
    engine: 'edge',
    name: 'Elvira Neural',
    gender: 'female',
    tone: 'Institucional, Fluido',
    desc: 'Voz neuronal estándar de alta definición en español europeo e internacional.',
    lang: 'es',
    languages: ['es'],
    latency: '~130ms',
    badge: 'Azure Neural • Gratuito ⚡',
    tier: 'zero_cost',
    tierLabel: 'Universal Gratuito',
    scenario: 'keynote',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'es-ES-AlvaroNeural',
    engine: 'edge',
    name: 'Álvaro Neural',
    gender: 'male',
    tone: 'Claro, Dinámico',
    desc: 'Locución masculina clara y enérgica para conferencias técnicas y paneles.',
    lang: 'es',
    languages: ['es'],
    latency: '~130ms',
    badge: 'Azure Neural • Gratuito ⚡',
    tier: 'zero_cost',
    tierLabel: 'Universal Gratuito',
    scenario: 'panel',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'es-MX-DaliaNeural',
    engine: 'edge',
    name: 'Dalia Neural (México)',
    gender: 'female',
    tone: 'Cálido, Suave',
    desc: 'Acento neutro latinoamericano suave y fluido para foros panamericanos.',
    lang: 'es',
    languages: ['es'],
    latency: '~135ms',
    badge: 'Azure Neural • Gratuito ⚡',
    tier: 'zero_cost',
    tierLabel: 'Universal Gratuito',
    scenario: 'conversational',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'aura-2-carina-es',
    engine: 'deepgram',
    name: 'Carina (Aura-2)',
    gender: 'female',
    tone: 'Natural, Fluida',
    desc: 'Deepgram Aura-2 nativa en español de latencia mínima para interpretación simultánea.',
    lang: 'es',
    languages: ['es'],
    latency: '~95ms',
    badge: 'Deepgram Aura-2 ⚡',
    tier: 'zero_cost',
    tierLabel: 'Universal Gratuito',
    scenario: 'conversational',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'en-US-JennyNeural',
    engine: 'edge',
    name: 'Jenny Neural',
    gender: 'female',
    tone: 'Natural, Expressive',
    desc: 'Voz institucional en inglés americano de alta naturalidad y entonación limpia.',
    lang: 'en',
    languages: ['en'],
    latency: '~130ms',
    badge: 'Azure Neural • Gratuito ⚡',
    tier: 'zero_cost',
    tierLabel: 'Universal Gratuito',
    scenario: 'keynote',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'en-US-GuyNeural',
    engine: 'edge',
    name: 'Guy Neural',
    gender: 'male',
    tone: 'Profundo, Autoridad',
    desc: 'Tono masculino firme y seguro para discursos ejecutivos y plenarias.',
    lang: 'en',
    languages: ['en'],
    latency: '~130ms',
    badge: 'Azure Neural • Gratuito ⚡',
    tier: 'zero_cost',
    tierLabel: 'Universal Gratuito',
    scenario: 'keynote',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'aura-2-thalia-en',
    engine: 'deepgram',
    name: 'Thalia (Aura-2)',
    gender: 'female',
    tone: 'Conversacional, Ultrarrápida',
    desc: 'Nueva generación Deepgram Aura-2 optimizada para latencia extrema (<120ms).',
    lang: 'en',
    languages: ['en'],
    latency: '~90ms',
    badge: 'Deepgram Aura-2 ⚡',
    tier: 'zero_cost',
    tierLabel: 'Universal Gratuito',
    scenario: 'conversational',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'it-IT-ElsaNeural',
    engine: 'edge',
    name: 'Elsa Neural',
    gender: 'female',
    tone: 'Melódica, Profesional',
    desc: 'Pronunciación italiana impecable y modulada para eventos internacionales.',
    lang: 'it',
    languages: ['it'],
    latency: '~130ms',
    badge: 'Azure Neural • Gratuito ⚡',
    tier: 'zero_cost',
    tierLabel: 'Universal Gratuito',
    scenario: 'keynote',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'it-IT-DiegoNeural',
    engine: 'edge',
    name: 'Diego Neural',
    gender: 'male',
    tone: 'Cálido, Directo',
    desc: 'Locución masculina italiana elegante para conferencias y seminarios.',
    lang: 'it',
    languages: ['it'],
    latency: '~130ms',
    badge: 'Azure Neural • Gratuito ⚡',
    tier: 'zero_cost',
    tierLabel: 'Universal Gratuito',
    scenario: 'panel',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'pt-BR-FranciscaNeural',
    engine: 'edge',
    name: 'Francisca Neural',
    gender: 'female',
    tone: 'Acogedora, Articulada',
    desc: 'Portugués brasileño estándar suave y perfectamente comprensible.',
    lang: 'pt',
    languages: ['pt'],
    latency: '~130ms',
    badge: 'Azure Neural • Gratuito ⚡',
    tier: 'zero_cost',
    tierLabel: 'Universal Gratuito',
    scenario: 'keynote',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  },
  {
    id: 'pt-BR-AntonioNeural',
    engine: 'edge',
    name: 'Antônio Neural',
    gender: 'male',
    tone: 'Enérgico, Convincente',
    desc: 'Voz masculina brasileña versátil para ponencias dinámicas y rondas de preguntas.',
    lang: 'pt',
    languages: ['pt'],
    latency: '~130ms',
    badge: 'Azure Neural • Gratuito ⚡',
    tier: 'zero_cost',
    tierLabel: 'Universal Gratuito',
    scenario: 'panel',
    isFree: true,
    requiresKey: false,
    isConfigured: true
  }
];

// Module-level memory cache to eliminate modal flicker
let cachedModalVoices = null;
try {
  const stored = typeof window !== 'undefined' ? sessionStorage.getItem('lv_cached_catalog_voices') : null;
  if (stored) {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      cachedModalVoices = parsed;
    }
  }
} catch (e) {}

export default function VoiceCatalogModal({
  isOpen = false,
  onClose = () => {},
  roomId = 'MAIN',
  currentLanguage = 'es',
  selectedVoices = {},
  onSelectVoice = () => {},
  configuredEngines = { deepgram: true, google: true, openai: false, elevenlabs: false, cartesia: false }
}) {
  const [voices, setVoices] = useState(() => cachedModalVoices || FALLBACK_VOICES);
  const [isLoadingVoices, setIsLoadingVoices] = useState(!cachedModalVoices && isOpen);
  const [search, setSearch] = useState('');
  const [selectedEngineFilter, setSelectedEngineFilter] = useState('all');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState('all');
  const [selectedTierFilter, setSelectedTierFilter] = useState('all');
  const [targetLang, setTargetLang] = useState(() => normalizeLangCode(currentLanguage));
  const [playingVoiceId, setPlayingVoiceId] = useState(null);

  const auditionAbortRef = useRef(null);

  const safeSelectedVoices = useMemo(() => {
    if (selectedVoices && typeof selectedVoices === 'object' && !Array.isArray(selectedVoices)) {
      return selectedVoices;
    }
    return {
      es: 'es-ES-ElviraNeural',
      en: 'aura-2-thalia-en',
      it: 'it-IT-ElsaNeural',
      pt: 'pt-BR-FranciscaNeural'
    };
  }, [selectedVoices]);

  // Estado borrador (draft) para permitir seleccionar sin cerrar inmediatamente
  const [draftVoices, setDraftVoices] = useState({});
  const [draftGenders, setDraftGenders] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Inicializar estado borrador cuando se abre el modal o cambian las voces asignadas
  useEffect(() => {
    if (isOpen) {
      setTargetLang(normalizeLangCode(currentLanguage));
      setDraftVoices({ ...safeSelectedVoices });
      setDraftGenders({});
      setSearch('');
      setSelectedEngineFilter('all');
      setSelectedGenderFilter('all');
      setSelectedTierFilter('all');
      setIsSaved(false);
      setIsSaving(false);
    } else {
      if (auditionAbortRef.current) auditionAbortRef.current.abort();
      try { audioPlayerService.stopAll(); } catch (e) {}
      setPlayingVoiceId(null);
    }
  }, [isOpen, currentLanguage, safeSelectedVoices]);

  // Bloqueo de desplazamiento del fondo mientras el modal está abierto
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Tecla Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (auditionAbortRef.current) auditionAbortRef.current.abort();
        try { audioPlayerService.stopAll(); } catch (err) {}
        setPlayingVoiceId(null);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (auditionAbortRef.current) auditionAbortRef.current.abort();
      try { audioPlayerService.stopAll(); } catch (e) {}
      setPlayingVoiceId(null);
    };
  }, []);

  // Carga de voces desde el backend con caché persistente
  useEffect(() => {
    if (isOpen) {
      if (!cachedModalVoices) {
        setIsLoadingVoices(true);
      }
      fetch('/api/voices')
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data && data.success && Array.isArray(data.voices) && data.voices.length > 0) {
            cachedModalVoices = data.voices;
            try {
              sessionStorage.setItem('lv_cached_catalog_voices', JSON.stringify(data.voices));
            } catch (e) {}
            setVoices((prev) => {
              if (prev && prev.length === data.voices.length && prev[0]?.id === data.voices[0]?.id) {
                return prev;
              }
              return data.voices;
            });
          }
        })
        .catch((err) => {
          console.warn('[VoiceCatalog] Error al cargar voces remotas, manteniendo catálogo base:', err);
        })
        .finally(() => {
          setIsLoadingVoices(false);
        });
    }
  }, [isOpen]);

  // Comprobar si hay modificaciones pendientes de guardar respecto a selectedVoices
  const isDirty = Object.keys(draftVoices).some(
    (lang) => Boolean(draftVoices[lang]) && draftVoices[lang] !== (safeSelectedVoices[lang] || '')
  );

  const normalize = (str) =>
    (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filteredVoices = useMemo(() => {
    const normTarget = normalizeLangCode(targetLang);
    return voices.filter((v) => {
      const q = normalize(search);
      const matchesSearch = !q ||
        normalize(v.name).includes(q) ||
        normalize(v.tone).includes(q) ||
        normalize(v.desc).includes(q);

      const matchesEngine =
        selectedEngineFilter === 'all' ||
        v.engine === selectedEngineFilter ||
        (selectedEngineFilter === 'edge' && (v.engine === 'edge' || v.engine === 'google'));

      const voiceLangs = (v.languages && v.languages.length > 0)
        ? v.languages
        : (v.lang === 'all' ? ['es', 'en', 'it', 'pt'] : [v.lang]);
      const matchesLang = v.lang === 'all' || voiceLangs.includes(normTarget) || voiceLangs.includes(targetLang);

      const matchesGender =
        selectedGenderFilter === 'all' || v.gender === selectedGenderFilter;

      const matchesTier =
        selectedTierFilter === 'all' ||
        v.tier === selectedTierFilter ||
        (selectedTierFilter === 'zero_cost' && v.isFree) ||
        (selectedTierFilter === 'premium_studio' && !v.isFree);

      return matchesSearch && matchesEngine && matchesLang && matchesGender && matchesTier;
    });
  }, [voices, search, selectedEngineFilter, targetLang, selectedGenderFilter, selectedTierFilter]);

  const handleAudition = async (voice) => {
    if (auditionAbortRef.current) auditionAbortRef.current.abort();

    if (playingVoiceId === voice.id) {
      try { audioPlayerService.stopAll(); } catch (e) {}
      setPlayingVoiceId(null);
      return;
    }

    try { audioPlayerService.stopAll(); } catch (e) {}
    setPlayingVoiceId(voice.id);
    const abortCtrl = new AbortController();
    auditionAbortRef.current = abortCtrl;

    try {
      await audioPlayerService.unlockAudio(roomId, targetLang);
      if (abortCtrl.signal.aborted) return;

      const rawScenario = voice.scenario || 'panel';
      const scenario = rawScenario === 'conversational' ? 'panel' : rawScenario;
      const CONTEXTUAL_SCRIPTS = {
        keynote: {
          es: 'Damas y caballeros, bienvenidos a la sesión plenaria de LiftVoice. Hoy exploraremos el futuro de la interpretación simultánea con inteligencia artificial.',
          en: 'Ladies and gentlemen, welcome to the LiftVoice keynote session. Today we explore the future of real-time simultaneous AI interpretation.',
          it: "Signore e signori, benvenuti alla sessione plenaria di LiftVoice. Oggi esploriamo l'interpretazione simultanea con intelligenza artificiale.",
          pt: 'Senhoras e senhores, bem-vindos à sessão plenária do LiftVoice. Hoje exploraremos a interpretação simultânea com inteligência artificial.'
        },
        medical: {
          es: 'Protocolo clínico asistencial: la administración endovenosa requiere monitorización hemodinámica continua y control estricto de saturación de oxígeno.',
          en: 'Clinical care protocol: intravenous administration requires continuous hemodynamic monitoring and strict arterial oxygen saturation control.',
          it: 'Protocollo clinico: la somministrazione endovenosa richiede un monitoraggio emodinamico costante e saturazione arteriosa.',
          pt: 'Protocolo clínico: a administração intravenosa requer monitoramento hemodinâmico contínuo e saturação de oxigênio.'
        },
        panel: {
          es: 'Hola, esta es una demostración en vivo de mi voz neuronal para paneles de debate, fluidez conversacional y traducción simultánea.',
          en: 'Hello, this is a live demonstration of my neural voice for conversational panels, debates and real-time translation.',
          it: 'Ciao, questa è una dimostrazione in tempo reale della mia voce neurale per dibattiti dal vivo e traduzione simultanea.',
          pt: 'Olá, esta é uma demostração em tempo real da minha voz neural para painéis de debate e tradução simultânea ao vivo.'
        }
      };

      const scenarioScripts = CONTEXTUAL_SCRIPTS[scenario] || CONTEXTUAL_SCRIPTS.panel;
      const sampleText = scenarioScripts[targetLang] || scenarioScripts.en || scenarioScripts.es;

      let serverAudio = null;
      let mimeType = 'audio/mp3';

      try {
        const response = await fetch(`/api/rooms/${roomId}/preview-voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortCtrl.signal,
          body: JSON.stringify({
            lang: targetLang,
            sampleText,
            voice: voice.id,
            gender: voice.gender || 'female',
            engine: voice.engine
          })
        });

        if (abortCtrl.signal.aborted) return;
        if (response.ok) {
          const data = await response.json();
          if (data && data.audioBase64) {
            serverAudio = data.audioBase64;
            mimeType = data.mimeType || 'audio/mp3';
          }
        } else {
          console.warn(`[VoiceCatalog] Preescucha remota devolvió status ${response.status}. Fallback a síntesis local de voz.`);
        }
      } catch (fetchErr) {
        if (abortCtrl.signal.aborted || fetchErr.name === 'AbortError') return;
        console.warn('[VoiceCatalog] Fallo en API remota, activando síntesis de voz local:', fetchErr.message);
      }

      if (abortCtrl.signal.aborted) return;

      await audioPlayerService.playVoicePreview({
        voiceId: voice.id,
        voiceName: voice.name,
        lang: targetLang,
        text: sampleText,
        audioBase64: serverAudio,
        mimeType,
        gender: voice.gender || 'female'
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[VoiceCatalog] Error en audición:', err);
      }
    } finally {
      if (auditionAbortRef.current === abortCtrl) {
        setPlayingVoiceId(null);
      }
    }
  };

  // Selección de voz en el borrador local (NO CIERRA EL MODAL)
  const handleSelectVoice = (voice) => {
    setDraftVoices((prev) => ({
      ...prev,
      [targetLang]: voice.id
    }));
    if (voice.gender) {
      setDraftGenders((prev) => ({
        ...prev,
        [targetLang]: voice.gender
      }));
    }
  };

  // Guardar cambios aplicados a las cabinas
  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      await onSelectVoice(draftVoices, draftGenders);
      setIsSaved(true);
      setIsSaving(false);
      setTimeout(() => {
        if (auditionAbortRef.current) auditionAbortRef.current.abort();
        try { audioPlayerService.stopAll(); } catch (err) {}
        setPlayingVoiceId(null);
        onClose();
        setIsSaved(false);
      }, 500);
    } catch (err) {
      console.error('[VoiceCatalog] Error al guardar voces:', err);
      setIsSaving(false);
    }
  };

  // Descartar cambios pendientes
  const handleDiscard = () => {
    setDraftVoices({ ...safeSelectedVoices });
    setDraftGenders({});
  };

  const activeDraftVoiceForLang = draftVoices[targetLang] || safeSelectedVoices[targetLang] || '';

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/60 dark:bg-black/75 backdrop-blur-[4px] transition-all duration-200 select-none animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (auditionAbortRef.current) auditionAbortRef.current.abort();
          try { audioPlayerService.stopAll(); } catch (err) {}
          setPlayingVoiceId(null);
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-catalog-title"
    >
      <div 
        className="relative flex flex-col w-full h-full sm:h-[88vh] sm:max-h-[820px] sm:max-w-[1000px] bg-white dark:bg-zinc-950 border-0 sm:border border-zinc-200/80 dark:border-white/10 rounded-none sm:rounded-[32px] shadow-2xl transition-all duration-200 overflow-hidden select-none text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. CABECERA CON ESTILO ADMIN SETTINGS ──────────────────── */}
        <header className="relative z-20 flex shrink-0 items-start justify-between gap-4 px-6 sm:px-8 pt-[max(1.25rem,env(safe-area-inset-top))] sm:pt-6 pb-4 border-b border-zinc-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md">
          {/* Degradado sutil idéntico a AdminSettingsShell */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-full inset-x-0 h-4 bg-gradient-to-b from-white dark:from-zinc-950 to-transparent z-10"
          />

          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0 shadow-2xs">
              <Headphones className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 id="voice-catalog-title" className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                  Catálogo de Voces de Interpretación
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
                  {voices.length} disponibles
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                Audiciona y asigna timbres neuronales a las cabinas de traducción en tiempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (auditionAbortRef.current) auditionAbortRef.current.abort();
                try { audioPlayerService.stopAll(); } catch (err) {}
                setPlayingVoiceId(null);
                onClose();
              }}
              className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95 touch-manipulation shrink-0"
              title="Cerrar catálogo (Esc)"
              aria-label="Cerrar catálogo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── 2. BARRA DE FILTRADO Y SELECTORES SEGMENTADOS ──────────── */}
        <div className="px-6 sm:px-8 py-3.5 border-b border-zinc-200/70 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/20 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Buscador idéntico a los inputs del Admin */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre de voz, tono o estilo..."
                className="w-full h-10 pl-10 pr-4 bg-transparent dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400/30 dark:focus:ring-white/20 transition-all shadow-2xs"
              />
            </div>

            {/* Segmented Switch para Cabinas de Idioma */}
            <div className="flex items-center bg-zinc-200/60 dark:bg-white/10 rounded-2xl p-1 border border-zinc-200/80 dark:border-white/10 overflow-x-auto no-scrollbar shrink-0">
              {CABINS.map((lang) => {
                const isActive = targetLang === lang.code;
                const isModified = draftVoices[lang.code] && draftVoices[lang.code] !== (safeSelectedVoices[lang.code] || '');
                const hasAssigned = Boolean(draftVoices[lang.code] || safeSelectedVoices[lang.code]);

                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      if (auditionAbortRef.current) auditionAbortRef.current.abort();
                      try { audioPlayerService.stopAll(); } catch (e) {}
                      setPlayingVoiceId(null);
                      setTargetLang(lang.code);
                    }}
                    className={`flex items-center gap-1.5 h-8 sm:h-8.5 px-3.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <CountryFlag code={lang.code} className="w-3.5 h-3.5 rounded-full shadow-2xs shrink-0" />
                    <span>{lang.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtros de Motor, Nivel y Género */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-0.5 text-xs flex-wrap sm:flex-nowrap">
            {/* Engine Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: `Todos` },
                { id: 'gemini_live', label: 'Google Live' },
                { id: 'edge', label: 'Edge Neural' },
                { id: 'deepgram', label: 'Aura-2' },
                { id: 'openai', label: 'OpenAI' },
                { id: 'elevenlabs', label: 'ElevenLabs' },
                { id: 'cartesia', label: 'Cartesia' }
              ].map((eng) => {
                const isSelected = selectedEngineFilter === eng.id;
                return (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => setSelectedEngineFilter(eng.id)}
                    className={`h-7 sm:h-7.5 px-3 rounded-full text-xs font-medium inline-flex items-center justify-center transition-all cursor-pointer border whitespace-nowrap ${
                      isSelected
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-2xs font-semibold'
                        : 'bg-white dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {eng.label}
                  </button>
                );
              })}
            </div>

            {/* Tier & Gender micro-toggles */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {/* Tier Toggle */}
              <div className="flex items-center bg-zinc-200/60 dark:bg-white/10 rounded-xl p-0.5 border border-zinc-200/80 dark:border-white/10">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'zero_cost', label: '⚡ Zero-Cost' },
                  { id: 'premium_studio', label: '🌟 Pro' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTierFilter(t.id)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                      selectedTierFilter === t.id
                        ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-2xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Gender Toggle */}
              <div className="flex items-center bg-zinc-200/60 dark:bg-white/10 rounded-xl p-0.5 border border-zinc-200/80 dark:border-white/10">
                {[
                  { id: 'all', label: '⚤' },
                  { id: 'female', label: '♀' },
                  { id: 'male', label: '♂' }
                ].map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGenderFilter(g.id)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                      selectedGenderFilter === g.id
                        ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-2xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. CUERPO DE TARJETAS ESTILO ADMIN CABINS ──────────────── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 min-h-0 bg-white dark:bg-zinc-950 scrollbar-custom">
          {isLoadingVoices ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-7 h-7 animate-spin text-zinc-900 dark:text-zinc-100" />
              <span className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Cargando catálogo consolidado de voces...
              </span>
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="py-20 text-center space-y-2 text-zinc-400 dark:text-zinc-500">
              <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mx-auto mb-2">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                No se encontraron voces
              </p>
              <p className="text-xs max-w-sm mx-auto leading-relaxed">
                Prueba ajustando los términos de búsqueda o seleccionando otro motor de locución.
              </p>
            </div>
          ) : (
            <div 
              role="radiogroup" 
              aria-label={`Voces disponibles para la cabina de ${CABIN_NAMES[targetLang] || targetLang}`}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5"
            >
              {filteredVoices.map((voice) => {
                const isSelected = activeDraftVoiceForLang === voice.id;
                const isPlaying = playingVoiceId === voice.id;

                return (
                  <div
                    key={voice.id}
                    className={`group relative p-4 sm:p-5 rounded-3xl border-2 transition-all duration-200 select-none text-left flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-zinc-400 dark:border-white/50 bg-zinc-50 dark:bg-white/5 shadow-xs ring-1 ring-zinc-400/20 dark:ring-white/20'
                        : 'border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-white/20 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/70 shadow-2xs'
                    }`}
                  >
                    {/* Botón de selección accesible que cubre la tarjeta */}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectVoice(voice)}
                      className="absolute inset-0 w-full h-full rounded-3xl z-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-white"
                      aria-label={`Seleccionar voz ${voice.name} para cabina de ${CABIN_NAMES[targetLang] || targetLang}`}
                    />

                    {/* Header de la tarjeta: Botón Play Directo + Nombres con Subtítulo (Tono • Motor) + Círculo con Check */}
                    <div className="flex items-start justify-between gap-3 relative z-10 pointer-events-none">
                      <div className="flex items-center gap-3 min-w-0 pointer-events-auto">
                        {/* Botón Play Directo (con ecualizador de ondas animado durante la reproducción) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAudition(voice);
                          }}
                          title={isPlaying ? "Detener muestra" : `Audicionar muestra de ${voice.name}`}
                          aria-label={isPlaying ? "Detener muestra" : `Audicionar muestra de ${voice.name}`}
                          className={`relative w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer group/btn ${
                            isPlaying
                              ? 'bg-zinc-100 dark:bg-white/20 text-zinc-900 dark:text-white border border-zinc-300 dark:border-white/30 ring-2 ring-zinc-300/50 dark:ring-white/20 scale-102 shadow-2xs'
                              : isSelected
                              ? 'bg-zinc-100 dark:bg-white/15 text-zinc-900 dark:text-white border border-zinc-300 dark:border-white/25 hover:scale-105 shadow-2xs'
                              : 'bg-transparent dark:bg-white/5 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-zinc-100 hover:scale-105 shadow-2xs'
                          }`}
                        >
                          {isPlaying ? (
                            <>
                              {/* Indicador animado de ondas ecualizadoras */}
                              <div className="flex items-end justify-center gap-0.5 h-4 group-hover/btn:hidden">
                                <span className="w-1 bg-current rounded-full animate-soundwave-1" />
                                <span className="w-1 bg-current rounded-full animate-soundwave-2" />
                                <span className="w-1 bg-current rounded-full animate-soundwave-3" />
                              </div>
                              {/* Icono Stop en hover durante la reproducción */}
                              <Square className="w-3.5 h-3.5 fill-current hidden group-hover/btn:block" />
                            </>
                          ) : (
                            <Play className="w-4 h-4 fill-current translate-x-0.5" />
                          )}
                        </button>

                        {/* Textos: Nombre, Género, Tier y Subtítulo enriquecido */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate tracking-tight">
                              {voice.name}
                            </h4>
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 border border-zinc-200/70 dark:border-white/10 shrink-0">
                              {voice.gender === 'male' ? '♂ Masc' : voice.gender === 'female' ? '♀ Fem' : 'Neutro'}
                            </span>
                            {voice.tier === 'zero_cost' || voice.isFree ? (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shrink-0">
                                ⚡ Zero-Cost
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 shrink-0">
                                🌟 Studio Pro
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                            <span>{voice.tone || 'Timbre natural'}</span>
                            <span className="text-zinc-300 dark:text-zinc-700 select-none">•</span>
                            <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 font-normal">
                              {getEngineDisplayName(voice.engine)}
                            </span>
                            {voice.latency && (
                              <>
                                <span className="text-zinc-300 dark:text-zinc-700 select-none">•</span>
                                <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                                  {voice.latency}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Indicador de Selección Superior Derecho (Círculo con Check) */}
                      <div className="shrink-0 flex items-center">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-white/15 text-zinc-900 dark:text-white border border-zinc-300 dark:border-white/25 flex items-center justify-center shadow-2xs transition-all animate-fadeIn">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-zinc-300/80 dark:border-white/20 flex items-center justify-center text-transparent group-hover:border-zinc-400 dark:group-hover:border-white/40 transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400/0 group-hover:bg-zinc-400/30 transition-colors" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Descripción concisa de la voz */}
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 min-h-[34px] relative z-10 pointer-events-none">
                      {voice.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 4. PIE CON ESTILO ADMIN STICKY FOOTER ──────────────────── */}
        <footer className="relative z-20 flex shrink-0 flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-8 py-3.5 sm:py-4 border-t border-zinc-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full inset-x-0 h-4 bg-gradient-to-t from-white dark:from-zinc-950 to-transparent z-10"
          />

          <div className="flex items-center gap-2.5 min-w-0">
            {isSaved ? (
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                <Check className="w-4 h-4 stroke-[2.5] text-emerald-500 shrink-0" />
                <span>Voces guardadas y sincronizadas con éxito</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                <span>
                  Cabina: <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{CABIN_NAMES[targetLang] || targetLang.toUpperCase()}</strong>
                </span>
                <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
                <span className="hidden sm:inline truncate font-mono text-[11px]">
                  Voz activa: <strong className="text-zinc-700 dark:text-zinc-300">{activeDraftVoiceForLang || 'Por defecto'}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
            {isDirty && (
              <button
                type="button"
                onClick={handleDiscard}
                disabled={isSaving}
                className="flex-1 sm:flex-initial h-12 sm:h-10 px-4 sm:px-4 rounded-full sm:rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/70 dark:bg-white/5 hover:bg-zinc-200/70 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-semibold flex items-center justify-center transition-all cursor-pointer active:scale-[0.99] sm:active:scale-95 shadow-2xs disabled:opacity-50 whitespace-nowrap"
              >
                Descartar
              </button>
            )}

            <button
              type="button"
              onClick={isDirty ? handleSave : () => {
                try { audioPlayerService.stopAll(); } catch (err) {}
                onClose();
              }}
              disabled={isSaving}
              className={`flex-1 sm:flex-initial h-12 sm:h-10 px-5 sm:px-6 rounded-full sm:rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-[0.99] sm:active:scale-98 whitespace-nowrap ${
                isSaved
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                  : isDirty
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-sm'
                  : 'bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-white/10'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} className="animate-spin text-zinc-400 dark:text-zinc-600" />
                  <span>Guardando...</span>
                </>
              ) : isSaved ? (
                <>
                  <Check size={15} className="stroke-[3]" />
                  <span>Guardado</span>
                </>
              ) : isDirty ? (
                <span>Guardar cambios</span>
              ) : (
                <span>Listo</span>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
