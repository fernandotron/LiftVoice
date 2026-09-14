import React, { useState, useEffect, useRef } from 'react';
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

function getEngineDisplayName(engine) {
  switch (engine) {
    case 'google': return 'Google Neural';
    case 'deepgram': return 'Deepgram Aura';
    case 'openai': return 'OpenAI TTS';
    case 'elevenlabs': return 'ElevenLabs Turbo';
    case 'qwen_tts': return 'Qwen Audio';
    default: return engine ? engine.charAt(0).toUpperCase() + engine.slice(1) : 'Neuronal';
  }
}

export default function VoiceCatalogModal({
  isOpen = false,
  onClose = () => {},
  roomId = 'MAIN',
  currentLanguage = 'es',
  selectedVoices = {},
  onSelectVoice = () => {},
  configuredEngines = { deepgram: true, google: true, openai: false, elevenlabs: false }
}) {
  const [voices, setVoices] = useState([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEngineFilter, setSelectedEngineFilter] = useState('all');
  const [targetLang, setTargetLang] = useState(currentLanguage || 'es');
  const [playingVoiceId, setPlayingVoiceId] = useState(null);

  const auditionAbortRef = useRef(null);

  // Estado borrador (draft) para permitir seleccionar sin cerrar inmediatamente
  const [draftVoices, setDraftVoices] = useState({});
  const [draftGenders, setDraftGenders] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Inicializar estado borrador cuando se abre el modal o cambian las voces asignadas
  useEffect(() => {
    if (isOpen) {
      setTargetLang(currentLanguage || 'es');
      setDraftVoices({ ...(selectedVoices || {}) });
      setDraftGenders({});
      setSearch('');
      setSelectedEngineFilter('all');
      setIsSaved(false);
      setIsSaving(false);
    } else {
      if (auditionAbortRef.current) auditionAbortRef.current.abort();
      try { audioPlayerService.stopAll(); } catch (e) {}
      setPlayingVoiceId(null);
    }
  }, [isOpen, currentLanguage, selectedVoices]);

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

  // Carga de voces desde el backend
  useEffect(() => {
    if (isOpen) {
      setIsLoadingVoices(true);
      fetch('/api/voices')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.voices)) {
            setVoices(data.voices);
          }
        })
        .catch((err) => {
          console.warn('[VoiceCatalog] Error al cargar voces:', err);
        })
        .finally(() => {
          setIsLoadingVoices(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Comprobar si hay modificaciones pendientes de guardar respecto a selectedVoices
  const isDirty = Object.keys(draftVoices).some(
    (lang) => Boolean(draftVoices[lang]) && draftVoices[lang] !== (selectedVoices[lang] || '')
  );

  const filteredVoices = voices.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.tone && v.tone.toLowerCase().includes(search.toLowerCase())) ||
      (v.desc && v.desc.toLowerCase().includes(search.toLowerCase()));
    const matchesEngine = selectedEngineFilter === 'all' || v.engine === selectedEngineFilter;
    const matchesLang = v.lang === 'all' || v.lang === targetLang;
    return matchesSearch && matchesEngine && matchesLang;
  });

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

      const samplePhrases = {
        es: 'Bienvenidos a LiftVoice. Esta es una demostración en vivo de mi voz para la cabina de traducción en español.',
        en: 'Welcome to LiftVoice. This is a real-time speech demonstration of my voice for the English translation booth.',
        it: 'Benvenuti a LiftVoice. Questa è una dimostrazione della mia voce per la cabina di traduzione in italiano.',
        pt: 'Bem-vindos ao LiftVoice. Esta é uma demostração da minha voz para a cabine de tradução em português.'
      };

      const response = await fetch(`/api/rooms/${roomId}/preview-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortCtrl.signal,
        body: JSON.stringify({
          lang: targetLang,
          sampleText: samplePhrases[targetLang] || samplePhrases.en,
          voice: voice.id,
          gender: voice.gender || 'female',
          engine: voice.engine
        })
      });

      if (abortCtrl.signal.aborted) return;
      const data = await response.json();
      if (abortCtrl.signal.aborted) return;

      let serverAudio = null;
      let mimeType = 'audio/mp3';
      if (data && data.audioBase64) {
        serverAudio = data.audioBase64;
        mimeType = data.mimeType || 'audio/mp3';
      }

      await audioPlayerService.playVoicePreview({
        voiceId: voice.id,
        voiceName: voice.name,
        lang: targetLang,
        text: samplePhrases[targetLang] || samplePhrases.en,
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
    setDraftVoices({ ...(selectedVoices || {}) });
    setDraftGenders({});
  };

  const activeDraftVoiceForLang = draftVoices[targetLang] || selectedVoices[targetLang] || '';

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
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
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
                className="w-full h-10 pl-10 pr-4 bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all shadow-2xs"
              />
            </div>

            {/* Segmented Switch para Cabinas de Idioma */}
            <div className="flex items-center bg-zinc-200/60 dark:bg-white/10 rounded-2xl p-1 border border-zinc-200/80 dark:border-white/10 overflow-x-auto no-scrollbar shrink-0">
              {CABINS.map((lang) => {
                const isActive = targetLang === lang.code;
                const isModified = draftVoices[lang.code] && draftVoices[lang.code] !== (selectedVoices[lang.code] || '');
                const hasAssigned = Boolean(draftVoices[lang.code] || selectedVoices[lang.code]);

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

          {/* Filtros de Motor Estilo Pills Limpias (Sin emojis invasivos) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5 text-xs">
            {[
              { id: 'all', label: `Todos los motores (${voices.length})` },
              { id: 'google', label: 'Google Neural' },
              { id: 'deepgram', label: 'Deepgram Aura' },
              { id: 'openai', label: 'OpenAI TTS' },
              { id: 'elevenlabs', label: 'ElevenLabs Turbo' }
            ].map((eng) => {
              const isSelected = selectedEngineFilter === eng.id;
              return (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => setSelectedEngineFilter(eng.id)}
                  className={`h-8 sm:h-8.5 px-4 rounded-full text-xs font-medium inline-flex items-center justify-center transition-all cursor-pointer border ${
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
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => handleSelectVoice(voice)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectVoice(voice);
                      }
                    }}
                    className={`group relative p-4 sm:p-5 rounded-3xl border-2 transition-all duration-200 cursor-pointer select-none text-left flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.06] shadow-xs'
                        : 'border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-white/20 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/70 shadow-2xs'
                    }`}
                  >
                    {/* Header de la tarjeta: Botón Play Directo + Nombres con Subtítulo (Tono • Motor) + Círculo con Check */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
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
                              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 ring-2 ring-zinc-900/20 dark:ring-white/30 scale-102 shadow-xs'
                              : isSelected
                              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:scale-105 shadow-xs'
                              : 'bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-white/15 hover:scale-105'
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

                        {/* Textos: Nombre, Género y Subtítulo enriquecido (Tono • Proveedor) */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate tracking-tight">
                              {voice.name}
                            </h4>
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 border border-zinc-200/70 dark:border-white/10 shrink-0">
                              {voice.gender === 'male' ? 'Masc' : voice.gender === 'female' ? 'Fem' : 'Neutro'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                            <span>{voice.tone || 'Timbre natural'}</span>
                            <span className="text-zinc-300 dark:text-zinc-700 select-none">•</span>
                            <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 font-normal">
                              {getEngineDisplayName(voice.engine)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Indicador de Selección Superior Derecho (Círculo con Check) */}
                      <div className="shrink-0 flex items-center">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs transition-all animate-fadeIn">
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
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 min-h-[34px]">
                      {voice.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 4. PIE CON ESTILO ADMIN STICKY FOOTER ──────────────────── */}
        <footer className="relative z-20 flex shrink-0 items-center justify-between gap-4 px-6 sm:px-8 py-3.5 sm:py-4 border-t border-zinc-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full inset-x-0 h-4 bg-gradient-to-t from-white dark:from-zinc-950 to-transparent z-10"
          />

          <div className="flex items-center gap-2.5 min-w-0">
            {isDirty ? (
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                <span>Modificaciones sin guardar</span>
                <span className="text-zinc-300 dark:text-zinc-700 hidden md:inline">•</span>
                <span className="hidden md:inline text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                  Pulsa Guardar cambios para aplicar a las cabinas
                </span>
              </div>
            ) : isSaved ? (
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

          <div className="flex items-center justify-end gap-2.5 sm:gap-3 shrink-0 ml-auto sm:ml-0">
            {isDirty && (
              <button
                type="button"
                onClick={handleDiscard}
                disabled={isSaving}
                className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/70 dark:bg-white/5 hover:bg-zinc-200/70 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-medium transition-all cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50"
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
              className={`h-9 sm:h-10 px-5 sm:px-6 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer active:scale-98 ${
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
                <span>Cerrar</span>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
