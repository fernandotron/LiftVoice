import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Play, Square, Loader2, Headphones, Check, Sparkles, Plus, Languages } from 'lucide-react';
import { audioPlayerService } from '../../services/audioPlayer.js';
import { useI18n } from '../../contexts/I18nContext.jsx';
import CountryFlag from '../shared/CountryFlag.jsx';
import SelectDropdown from '../shared/SelectDropdown.jsx';
import { FALLBACK_VOICES, getEngineDisplayName } from '../VoiceCatalogModal.jsx';

const DEFAULT_CABINS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' }
];

const DEFAULT_CABIN_NAMES = {
  es: 'Español',
  en: 'English',
  it: 'Italiano',
  pt: 'Português'
};

// Module-level memory cache to eliminate any mount flicker and provide 0ms instant renders
let cachedCatalogVoices = null;
try {
  const stored = typeof window !== 'undefined' ? sessionStorage.getItem('lv_cached_catalog_voices') : null;
  if (stored) {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      cachedCatalogVoices = parsed;
    }
  }
} catch (e) {}

// Eager preload in background on script load
if (typeof window !== 'undefined') {
  fetch('/api/voices')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && data.success && Array.isArray(data.voices) && data.voices.length > 0) {
        cachedCatalogVoices = data.voices;
        try {
          sessionStorage.setItem('lv_cached_catalog_voices', JSON.stringify(data.voices));
        } catch (e) {}
      }
    })
    .catch(() => {});
}

export default function SidebarVoiceCatalog({
  roomId = 'MAIN',
  selectedVoices = {},
  onSelectVoice = () => {},
  configuredEngines = { deepgram: true, google: true, openai: false, elevenlabs: false },
  targetLang = 'all',
  navNonce = 0
}) {
  const { t } = useI18n();

  const CABINS = useMemo(() => [
    { code: 'es', label: t('languages.es.name', 'Español') },
    { code: 'en', label: t('languages.en.name', 'English') },
    { code: 'it', label: t('languages.it.name', 'Italiano') },
    { code: 'pt', label: t('languages.pt.name', 'Português') }
  ], [t]);

  const CABIN_NAMES = useMemo(() => ({
    es: t('languages.es.name', 'Español'),
    en: t('languages.en.name', 'English'),
    it: t('languages.it.name', 'Italiano'),
    pt: t('languages.pt.name', 'Português')
  }), [t]);

  const LANG_OPTIONS = useMemo(() => [
    { value: 'all', label: t('voiceCatalog.allLanguages', 'Todos los idiomas'), icon: Languages },
    { value: 'es', label: t('languages.es.name', 'Español'), flag: 'es' },
    { value: 'en', label: t('languages.en.name', 'Inglés'), flag: 'gb' },
    { value: 'it', label: t('languages.it.name', 'Italiano'), flag: 'it' },
    { value: 'pt', label: t('languages.pt.name', 'Português'), flag: 'br' }
  ], [t]);

  const ENGINE_OPTIONS = useMemo(() => [
    { value: 'all', label: t('voiceCatalog.allProviders', 'Todos los proveedores') },
    { value: 'gemini_live', label: 'Google Gemini Live' },
    { value: 'edge', label: 'Azure / Edge' },
    { value: 'deepgram', label: 'Deepgram' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'elevenlabs', label: 'ElevenLabs' },
    { value: 'cartesia', label: 'Cartesia' }
  ], [t]);

  const [voices, setVoices] = useState(() => cachedCatalogVoices || FALLBACK_VOICES);
  const [isLoading, setIsLoading] = useState(!cachedCatalogVoices);
  const [search, setSearch] = useState('');
  const [selectedLang, setSelectedLang] = useState(targetLang || 'all');
  const [selectedEngine, setSelectedEngine] = useState('all');
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [assigningVoiceId, setAssigningVoiceId] = useState(null);
  const [highlightedVoiceId, setHighlightedVoiceId] = useState(null);

  const auditionAbortRef = useRef(null);

  // Sincronizar idioma seleccionado y desplazarse suavemente hasta la voz asignada
  useEffect(() => {
    if (targetLang) {
      setSelectedLang(targetLang);
      if (targetLang !== 'all') {
        // Resetear filtros de búsqueda y proveedor para garantizar que la tarjeta de la voz esté visible
        setSelectedEngine('all');
        setSearch('');

        const targetVoiceId = selectedVoices[targetLang];
        if (targetVoiceId) {
          setHighlightedVoiceId(targetVoiceId);
          const scrollTimer = setTimeout(() => {
            const cardEl = document.getElementById(`voice-card-${targetVoiceId}`);
            if (cardEl) {
              cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 200);

          const clearTimer = setTimeout(() => {
            setHighlightedVoiceId(null);
          }, 2800);

          return () => {
            clearTimeout(scrollTimer);
            clearTimeout(clearTimer);
          };
        }
      }
    }
  }, [targetLang, selectedVoices, navNonce]);

  useEffect(() => {
    let isMounted = true;
    if (!cachedCatalogVoices) {
      setIsLoading(true);
    }

    fetch('/api/voices')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data && data.success && Array.isArray(data.voices) && data.voices.length > 0) {
          cachedCatalogVoices = data.voices;
          try {
            sessionStorage.setItem('lv_cached_catalog_voices', JSON.stringify(data.voices));
          } catch (e) {}
          setVoices((prev) => {
            // Prevent state update and re-render if data is already identical
            if (prev && prev.length === data.voices.length && prev[0]?.id === data.voices[0]?.id) {
              return prev;
            }
            return data.voices;
          });
        }
      })
      .catch((err) => {
        console.warn('[SidebarVoiceCatalog] Error al cargar catálogo de /api/voices:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      if (auditionAbortRef.current) auditionAbortRef.current.abort();
      try { audioPlayerService.stopAll(); } catch (e) {}
      setPlayingVoiceId(null);
    };
  }, [roomId]);

  // Cerrar popover de asignación al hacer clic fuera
  useEffect(() => {
    if (!assigningVoiceId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-assign-popover]')) {
        setAssigningVoiceId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [assigningVoiceId]);

  const handleAudition = async (voice) => {
    if (auditionAbortRef.current) {
      auditionAbortRef.current.abort();
      auditionAbortRef.current = null;
    }

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
      // Si la voz es multilingüe ('all') o soporta el idioma seleccionado en el filtro:
      const isMultilingual = voice.lang === 'all' || (Array.isArray(voice.languages) && voice.languages.includes('all'));
      const targetLang = (selectedLang && selectedLang !== 'all' && (isMultilingual || voice.lang === selectedLang))
        ? selectedLang
        : (voice.langCode || (voice.id?.toLowerCase().includes('pt-br') ? 'pt' : (voice.lang === 'all' ? 'es' : (voice.lang || 'es'))));

      const sampleText = targetLang === 'es'
        ? 'LiftVoice: traducción simultánea y voz en directo.'
        : targetLang === 'it'
          ? 'LiftVoice: traduzione simultanea e voce in tempo reale.'
          : targetLang === 'pt'
            ? 'LiftVoice: tradução simultânea e voz em tempo real.'
            : 'LiftVoice: real-time speech translation and voice.';

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
          console.warn(`[SidebarVoiceCatalog] Preescucha remota devolvió status ${response.status}. Fallback a síntesis local de voz.`);
        }
      } catch (fetchErr) {
        if (abortCtrl.signal.aborted || fetchErr.name === 'AbortError') return;
        console.warn('[SidebarVoiceCatalog] Fallo en API remota, activando síntesis de voz local:', fetchErr.message);
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
        console.error('[SidebarVoiceCatalog] Error en audición:', err);
      }
    } finally {
      if (auditionAbortRef.current === abortCtrl) {
        setPlayingVoiceId(null);
      }
    }
  };

  // Asignación directa si hay un filtro de idioma activo, o apertura de popover si el filtro es 'all'
  const handleAssignVoice = (voice, specificLang = null) => {
    if (specificLang) {
      onSelectVoice(specificLang, voice);
      setAssigningVoiceId(null);
      return;
    }

    if (selectedLang && selectedLang !== 'all') {
      onSelectVoice(selectedLang, voice);
      setAssigningVoiceId(null);
      return;
    }

    // Solo se abre el popover si el filtro superior está en 'Todos los idiomas'
    setAssigningVoiceId(prev => (prev === voice.id ? null : voice.id));
  };

  const filteredVoices = useMemo(() => {
    const normalize = (str) =>
      (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = normalize(search);

    return voices.filter(v => {
      const matchesSearch = !q ||
        normalize(v.name).includes(q) ||
        normalize(v.desc).includes(q) ||
        normalize(v.tone).includes(q);

      let matchesLang = true;
      if (selectedLang !== 'all') {
        const vLang = (v.lang || '').toLowerCase();
        const vId = (v.id || '').toLowerCase();
        const vLangs = Array.isArray(v.languages) ? v.languages.map(l => String(l).toLowerCase()) : [];

        if (vLang === 'all' || vLangs.includes('all')) {
          matchesLang = true;
        } else if (selectedLang === 'pt') {
          matchesLang = vLang.startsWith('pt') || vLangs.some(l => l.startsWith('pt')) || vId.startsWith('pt') || vId.includes('-pt');
        } else if (selectedLang === 'en') {
          matchesLang = vLang.startsWith('en') || vLangs.some(l => l.startsWith('en')) || vId.startsWith('en') || vId.includes('-en');
        } else if (selectedLang === 'es') {
          matchesLang = vLang.startsWith('es') || vLangs.some(l => l.startsWith('es')) || vId.startsWith('es') || vId.includes('-es');
        } else if (selectedLang === 'it') {
          matchesLang = vLang.startsWith('it') || vLangs.some(l => l.startsWith('it')) || vId.startsWith('it') || vId.includes('-it');
        } else {
          matchesLang = vLang === selectedLang || vLangs.includes(selectedLang) || vId.startsWith(selectedLang);
        }
      }

      const matchesEngine = selectedEngine === 'all' ||
        v.engine === selectedEngine ||
        (selectedEngine === 'edge' && (v.engine === 'edge' || v.engine === 'google'));

      return matchesSearch && matchesLang && matchesEngine;
    });
  }, [voices, search, selectedLang, selectedEngine]);

  return (
    <div className="flex flex-col h-full overflow-hidden select-none animate-fadeIn text-left">
      {/* 1. Header alineado con datum line h-14 */}
      <div className="h-14 px-5 flex items-center justify-between bg-white dark:bg-zinc-950 flex-shrink-0">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {t('voiceCatalog.sidebarTitle', 'Catálogo de Voces')}
          </h2>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
            {t('voiceCatalog.sidebarSubtitle', 'Voces neuronales para emisión multicanal')}
          </p>
        </div>
        <span className="font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400 bg-transparent border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded-full">
          {t('voiceCatalog.availableCount', { count: filteredVoices.length })}
        </span>
      </div>

      <div className="mx-5 border-b border-zinc-200 dark:border-zinc-800/80 flex-shrink-0" />

      {/* 2. Filtros y Búsqueda */}
      <div className="px-5 pt-3.5 pb-3 space-y-3 flex-shrink-0 bg-white dark:bg-zinc-950">
        {/* Buscador con altura h-11 y esquinas rounded-2xl como Micrófono de Entrada */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('voiceCatalog.searchPlaceholderSidebar', 'Buscar por nombre o tono de voz...')}
            className="w-full h-11 pl-10.5 pr-4 bg-transparent dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all shadow-2xs"
          />
        </div>

        {/* Filtro: Idioma */}
        <SelectDropdown
          id="voice-catalog-lang-select"
          aria-label={t('voiceCatalog.filterByLanguage', 'Filtrar por idioma')}
          value={selectedLang}
          options={LANG_OPTIONS}
          onChange={(_, val) => {
            setSelectedLang(val || 'all');
            setAssigningVoiceId(null);
          }}
        />

        {/* Filtro: Proveedor */}
        <SelectDropdown
          id="voice-catalog-engine-select"
          aria-label={t('voiceCatalog.filterByProvider', 'Filtrar por proveedor')}
          value={selectedEngine}
          options={ENGINE_OPTIONS}
          onChange={(_, val) => setSelectedEngine(val || 'all')}
        />
      </div>

      <div className="mx-5 border-b border-zinc-200/60 dark:border-zinc-800/60 flex-shrink-0" />

      {/* 3. Lista de Tarjetas de Voz */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
        {filteredVoices.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Headphones className="w-6 h-6 text-zinc-300 dark:text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('voiceCatalog.emptyVoicesDesc', 'No se encontraron voces con los filtros actuales.')}
            </p>
          </div>
        ) : (
          filteredVoices.map((voice) => {
            const isPlaying = playingVoiceId === voice.id;
            const assignedCabins = CABINS.filter(c => selectedVoices[c.code] === voice.id);
            const isAssigned = assignedCabins.length > 0;
            const isAssignedToCurrent = selectedLang !== 'all'
              ? selectedVoices[selectedLang] === voice.id
              : isAssigned;
            const isAssigning = assigningVoiceId === voice.id && selectedLang === 'all';
            const isHighlighted = highlightedVoiceId === voice.id;
            const currentLangLabel = CABIN_NAMES[selectedLang] || selectedLang.toUpperCase();

            return (
              <div
                key={voice.id}
                id={`voice-card-${voice.id}`}
                onClick={() => {
                  if (selectedLang !== 'all') {
                    handleAssignVoice(voice);
                  }
                }}
                className={`group relative flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 shadow-2xs ${
                  selectedLang !== 'all' ? 'cursor-pointer' : ''
                } ${
                  isHighlighted
                    ? 'border-zinc-400 dark:border-white/60 bg-zinc-50 dark:bg-zinc-800/95 shadow-md ring-2 ring-zinc-950/20 dark:ring-white/30 scale-[1.01]'
                    : isAssignedToCurrent
                    ? 'border-zinc-400 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/90 shadow-2xs ring-1 ring-zinc-400/30 dark:ring-zinc-600/50'
                    : 'border-zinc-200 dark:border-zinc-800 bg-transparent dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/60 dark:hover:bg-zinc-900/80'
                }`}
              >
                {/* Lado izquierdo: Botón de Play / Audición compacto + Bandera en esquina inferior derecha */}
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAudition(voice);
                    }}
                    className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer group/btn ${
                      isPlaying
                        ? 'bg-zinc-100 dark:bg-white/20 text-zinc-900 dark:text-white border border-zinc-300 dark:border-white/30 ring-2 ring-zinc-300/50 dark:ring-white/20 scale-102 shadow-2xs'
                        : isAssignedToCurrent
                        ? 'bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-white/20 hover:bg-zinc-200/80 dark:hover:bg-white/20 hover:scale-105 shadow-2xs'
                        : 'bg-transparent dark:bg-white/5 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10 hover:bg-zinc-100/70 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-zinc-100 hover:scale-105 shadow-2xs'
                    }`}
                    title={isPlaying ? t('voiceCatalog.stopAuditionTooltip', 'Detener muestra') : t('voiceCatalog.playAuditionTooltip', { name: voice.name })}
                    aria-label={isPlaying ? t('voiceCatalog.stopAuditionTooltip', 'Detener muestra') : t('voiceCatalog.playAuditionTooltip', { name: voice.name })}
                  >
                    {isPlaying ? (
                      <>
                        {/* Indicador animado de ondas ecualizadoras */}
                        <div className="flex items-end justify-center gap-0.5 h-3 group-hover/btn:hidden">
                          <span className="w-0.5 bg-current rounded-full animate-soundwave-1" />
                          <span className="w-0.5 bg-current rounded-full animate-soundwave-2" />
                          <span className="w-0.5 bg-current rounded-full animate-soundwave-3" />
                        </div>
                        {/* Icono Stop en hover durante la reproducción */}
                        <Square className="w-3 h-3 fill-current hidden group-hover/btn:block" />
                      </>
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                    )}
                  </button>

                  {/* Bandera pequeña en la parte inferior derecha, un poco más abajo */}
                  <div className="absolute -bottom-1.5 -right-1 z-10 pointer-events-none">
                    <CountryFlag
                      code={voice.langCode || (voice.id?.toLowerCase().includes('pt-br') ? 'pt-br' : voice.lang) || 'es'}
                      className="w-3.5 h-3.5 rounded-full ring-[1.5px] ring-white dark:ring-zinc-900 object-cover shadow-2xs"
                    />
                  </div>
                </div>

                {/* Centro: Datos de la voz */}
                <div className="min-w-0 flex-1 px-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
                      {voice.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                    <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-400 bg-transparent border border-zinc-200/80 dark:border-zinc-700/60 px-1 py-0.2 rounded">
                      {getEngineDisplayName(voice.engine)}
                    </span>
                    {voice.tone && (
                      <span className="truncate text-zinc-400 dark:text-zinc-500">
                        • {voice.tone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Lado derecho: Botón Asignar a cabina */}
                <div
                  className={`relative shrink-0 transition-opacity duration-150 ${
                    isAssignedToCurrent || isAssigning
                      ? 'opacity-100'
                      : 'opacity-100 sm:opacity-0 sm:pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto'
                  }`}
                  data-assign-popover
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAssignVoice(voice);
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                      isAssignedToCurrent
                        ? 'bg-zinc-100 dark:bg-white/15 text-zinc-900 dark:text-white border-zinc-300 dark:border-white/25 hover:bg-zinc-200/80 dark:hover:bg-white/25'
                        : isAssigning
                          ? 'bg-zinc-100 dark:bg-white/15 text-zinc-900 dark:text-white border-zinc-300 dark:border-white/25'
                          : 'bg-transparent dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                    title={
                      selectedLang !== 'all'
                        ? (isAssignedToCurrent ? t('voiceCatalog.activeVoiceForBooth', { cabin: currentLangLabel }) : t('voiceCatalog.assignToBoothSpecific', { cabin: currentLangLabel }))
                        : (isAssigned ? t('voiceCatalog.assignedToMultiple', { cabins: assignedCabins.map(c => c.label).join(', ') }) : t('voiceCatalog.assignToBoothAction', 'Asignar a cabina'))
                    }
                    aria-label={
                      selectedLang !== 'all'
                        ? (isAssignedToCurrent ? t('voiceCatalog.activeVoiceForBooth', { cabin: currentLangLabel }) : t('voiceCatalog.assignToBoothSpecific', { cabin: currentLangLabel }))
                        : (isAssigned ? t('voiceCatalog.assignedToMultiple', { cabins: assignedCabins.map(c => c.label).join(', ') }) : t('voiceCatalog.assignToBoothAction', 'Asignar a cabina'))
                    }
                  >
                    {isAssignedToCurrent ? (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : (
                      <Plus className={`w-3.5 h-3.5 stroke-[2.5] transition-transform ${isAssigning ? 'rotate-45' : ''}`} />
                    )}
                  </button>

                  {/* Popover de asignación rápida a cabinas (solo cuando el filtro es 'all') */}
                  {isAssigning && selectedLang === 'all' && (
                    <div className="absolute right-0 bottom-full mb-1.5 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5 animate-fadeIn">
                      <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        {t('voiceCatalog.assignToBoothAction', 'Asignar a cabina')}:
                      </div>
                      {CABINS.map(cab => {
                        const isCurrent = selectedVoices[cab.code] === voice.id;
                        return (
                          <button
                            key={cab.code}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignVoice(voice, cab.code);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <CountryFlag code={cab.code} className="w-4 h-4 rounded-full" />
                              <span>{cab.label}</span>
                            </div>
                            {isCurrent && <Check className="w-3.5 h-3.5 stroke-[3] text-zinc-900 dark:text-zinc-100" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
