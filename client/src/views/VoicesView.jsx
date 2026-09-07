import React, { useState, useEffect } from 'react';
import {
  Search, Play, Loader2, Volume2, Check, Sparkles, Filter, SlidersHorizontal,
  Home, Radio, Layers, Settings, QrCode, Users, Globe, ArrowRight, ShieldCheck,
  ChevronRight, Mic
} from 'lucide-react';
import { audioPlayerService } from '../services/audioPlayer.js';

const VOICE_CATEGORIES = [
  { id: 'all', label: 'Todas las voces' },
  { id: 'conversational', label: 'Conversacional' },
  { id: 'keynote', label: 'Oratoria & Keynote' },
  { id: 'medical', label: 'Médico & Clínico' },
  { id: 'deepgram', label: 'Deepgram Aura ⚡' },
  { id: 'google', label: 'Google Neural 🌐' },
  { id: 'openai', label: 'OpenAI TTS' }
];

const LANG_PILLS = [
  { id: 'all', label: 'Todos los idiomas' },
  { id: 'es', label: '🇪🇸 Español' },
  { id: 'en', label: '🇺🇸 English' },
  { id: 'it', label: '🇮🇹 Italiano' },
  { id: 'pt', label: '🇧🇷 Português' }
];

const DEFAULT_ACTIVE_VOICES = {
  es: 'es-ES-ElviraNeural',
  en: 'aura-orion-en',
  it: 'it-IT-ElsaNeural',
  pt: 'pt-BR-FranciscaNeural'
};

// Rich avatar gradient colors for voice cards
const AVATAR_COLORS = [
  'from-amber-600 to-orange-700',
  'from-emerald-600 to-teal-800',
  'from-blue-600 to-indigo-800',
  'from-purple-600 to-pink-700',
  'from-zinc-700 to-zinc-900',
  'from-rose-600 to-red-800'
];

export default function VoicesView({
  roomId = 'MAIN',
  onNavigateStudio = () => {},
  onNavigateHome = () => {},
  onOpenSettings = () => {},
  onOpenQR = () => {}
}) {
  const [voices, setVoices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLang, setSelectedLang] = useState('all');
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [assignedFeedback, setAssignedFeedback] = useState(null);

  const [activeVoices, setActiveVoices] = useState(() => {
    try {
      const saved = localStorage.getItem('lv_voice_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(DEFAULT_ACTIVE_VOICES).forEach(lang => {
          if (!parsed[lang] || (lang !== 'en' && typeof parsed[lang] === 'string' && parsed[lang].startsWith('aura-'))) {
            parsed[lang] = DEFAULT_ACTIVE_VOICES[lang];
          }
        });
        return parsed;
      }
      return DEFAULT_ACTIVE_VOICES;
    } catch (e) {
      return DEFAULT_ACTIVE_VOICES;
    }
  });

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/voices')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.voices)) {
          setVoices(data.voices);
        }
      })
      .catch(err => console.warn('Could not load voices:', err))
      .finally(() => setIsLoading(false));

    // Listen for audio player completion to sync play button state
    const unsubState = audioPlayerService.onStateChange((state) => {
      if (!state.isPlaying) {
        setPlayingVoiceId(null);
      }
    });

    return () => {
      unsubState();
    };
  }, []);

  const handleAudition = async (voice) => {
    if (playingVoiceId === voice.id) {
      audioPlayerService.stopAll();
      setPlayingVoiceId(null);
      return;
    }

    // Immediately stop any previous audio (playlist-style instant switch)
    audioPlayerService.stopAll();
    setPlayingVoiceId(voice.id);

    const supportedLangs = (voice.languages && voice.languages.length > 0)
      ? voice.languages
      : (voice.lang === 'all' ? ['es', 'en', 'it', 'pt'] : [voice.lang]);

    // Use selectedLang if supported by this voice, otherwise pick its primary supported language
    const langToUse = supportedLangs.includes(selectedLang)
      ? selectedLang
      : supportedLangs[0];

    try {
      await audioPlayerService.unlockAudio(roomId, langToUse);
      const sampleTexts = {
        es: 'Hola, esta es una demostración en tiempo real de mi voz neuronal para conferencias y traducción simultánea.',
        en: 'Hello, this is a real-time neural speech demonstration of my voice for live conferences and keynotes.',
        it: 'Ciao, questa è una dimostrazione in tempo reale della mia voce neurale per conferenze dal vivo.',
        pt: 'Olá, esta é uma demonstração em tempo real da minha voz neural para conferências ao vivo.'
      };
      const text = sampleTexts[langToUse] || sampleTexts.es;

      let serverAudio = null;
      let mimeType = 'audio/mp3';
      try {
        const res = await fetch(`/api/rooms/${roomId}/preview-voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lang: langToUse,
            sampleText: text,
            voice: voice.id,
            engine: voice.engine,
            gender: voice.gender || 'female'
          })
        });
        const data = await res.json();
        if (data && data.audioBase64) {
          serverAudio = data.audioBase64;
          mimeType = data.mimeType || 'audio/mp3';
        }
      } catch (err) {
        // Fallback to distinct browser persona speech
      }

      await audioPlayerService.playVoicePreview({
        voiceId: voice.id,
        voiceName: voice.name,
        lang: langToUse,
        text,
        audioBase64: serverAudio,
        mimeType,
        gender: voice.gender || 'female'
      });
    } catch (err) {
      console.warn('Audition error:', err);
      setPlayingVoiceId(null);
    }
  };

  const handleAssignToBooth = (langCode, voiceId, voiceName) => {
    const isCurrentlyAssigned = activeVoices[langCode] === voiceId;
    const updated = {
      ...activeVoices,
      [langCode]: isCurrentlyAssigned ? null : voiceId
    };
    setActiveVoices(updated);
    try {
      localStorage.setItem('lv_voice_config', JSON.stringify(updated));
      fetch(`/api/rooms/${roomId}/voices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceConfig: updated })
      }).catch(() => {});
    } catch (e) {}

    setAssignedFeedback({
      lang: langCode,
      name: voiceName,
      unassigned: isCurrentlyAssigned
    });
    setTimeout(() => setAssignedFeedback(null), 2500);
  };

  // Filter voices
  const filteredVoices = voices.filter(v => {
    const q = search.toLowerCase();
    const matchesSearch =
      v.name.toLowerCase().includes(q) ||
      (v.tone && v.tone.toLowerCase().includes(q)) ||
      (v.desc && v.desc.toLowerCase().includes(q));

    const matchesLang =
      selectedLang === 'all' || v.lang === 'all' || v.lang === selectedLang;

    let matchesCat = true;
    if (selectedCategory === 'deepgram') matchesCat = v.engine === 'deepgram';
    else if (selectedCategory === 'google') matchesCat = v.engine === 'google';
    else if (selectedCategory === 'openai') matchesCat = v.engine === 'openai';
    else if (selectedCategory === 'conversational') matchesCat = (v.tone || '').toLowerCase().includes('conversacional') || (v.desc || '').toLowerCase().includes('cálid') || (v.gender === 'female');
    else if (selectedCategory === 'keynote') matchesCat = (v.tone || '').toLowerCase().includes('oratoria') || (v.tone || '').toLowerCase().includes('autoridad') || (v.gender === 'male');
    else if (selectedCategory === 'medical') matchesCat = true; // all voices support clinical glossary

    return matchesSearch && matchesLang && matchesCat;
  });

  return (
    <div className="h-screen w-full flex bg-[#f7f7f8] text-neutral-900 overflow-hidden font-sans select-none">
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* SIDEBAR IZQUIERDO (Estilo ElevenLabs exacto)                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <aside className="w-64 h-screen border-r border-neutral-200 bg-[#fcfcfd] flex-shrink-0 flex flex-col justify-between">
        <div>
          {/* Logo II LiftVoice */}
          <div className="h-14 px-5 flex items-center justify-between border-b border-neutral-200 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-4.5 bg-neutral-900 rounded-full" />
                <div className="w-1.5 h-3 bg-neutral-900 rounded-full" />
              </div>
              <span className="font-bold text-sm text-neutral-950 tracking-tight">LiftVoice</span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">STUDIO</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            <button
              onClick={onNavigateHome}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4 text-neutral-400" />
              <span>Inicio</span>
            </button>

            <div className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-neutral-950 bg-neutral-200/70 shadow-xs">
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4 text-neutral-950" />
                <span>Voces</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>

            <button
              onClick={onNavigateStudio}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <Radio className="w-4 h-4 text-neutral-400" />
              <span>Studio</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4 text-neutral-400" />
              <span>Configuración</span>
            </button>
          </div>

          {/* Fijado / Sala Activa */}
          <div className="p-3 pt-3 space-y-1 border-t border-neutral-200">
            <div className="px-3.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 font-mono">
              Sala Activa
            </div>

            <button
              onClick={onNavigateStudio}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-800 bg-neutral-100/70 border border-neutral-200 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Mic className="w-3.5 h-3.5 text-neutral-900" />
                <span>Cabina {roomId}</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            <button
              onClick={onOpenQR}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <QrCode className="w-3.5 h-3.5 text-neutral-400" />
                <span>Proyectar QR</span>
              </div>
              <ChevronRight className="w-3 h-3 text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Sidebar Footer info */}
        <div className="p-3.5 m-3 bg-white border border-neutral-200 rounded-2xl space-y-1 shadow-xs">
          <div className="text-[11px] font-semibold text-neutral-900">
            Catálogo Multi-Motor
          </div>
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            Deepgram Aura, Google Neural y OpenAI listos para emisión multicanal.
          </p>
        </div>
      </aside>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CONTENIDO PRINCIPAL: HEADER + BIBLIOTECA DE VOCES (Image 5)   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        
        {/* Top Header Bar (Igual a ElevenLabs Image 5) */}
        <header className="h-14 border-b border-neutral-200 px-8 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
            <Layers className="w-3.5 h-3.5 text-neutral-400" />
            <span>Voces</span>
            <span className="text-neutral-300">&rsaquo;</span>
            <span className="font-semibold text-neutral-950">Explorar</span>
          </div>

          {/* Search pill ⌘K */}
          <div className="hidden lg:flex items-center w-72 h-8.5 bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-200 rounded-full px-3.5 text-xs text-neutral-400 justify-between transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-neutral-400" />
              <span>Buscar en todo...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-neutral-200 rounded text-neutral-400 shadow-xs">⌘K</kbd>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onNavigateStudio}
              className="h-9 px-5 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Volver al Studio</span>
            </button>
            <div className="w-7.5 h-7.5 rounded-full bg-neutral-950 text-white flex items-center justify-center text-xs font-bold font-mono">
              LV
            </div>
          </div>
        </header>

        {/* Main Scrolling Body */}
        <main className="flex-1 overflow-y-auto p-8 sm:p-10 space-y-8 bg-white">
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* Feedback alert when voice is assigned or unassigned */}
            {assignedFeedback && (
              <div className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between shadow-xs transition-all ${
                assignedFeedback.unassigned
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}>
                <div className="flex items-center gap-2">
                  <Check className={`w-4 h-4 ${assignedFeedback.unassigned ? 'text-amber-600' : 'text-emerald-600'}`} />
                  <span>
                    {assignedFeedback.unassigned ? (
                      <>Voz <b>{assignedFeedback.name}</b> deseleccionada de la cabina <b>{assignedFeedback.lang.toUpperCase()}</b>.</>
                    ) : (
                      <>Voz <b>{assignedFeedback.name}</b> asignada con éxito a la cabina <b>{assignedFeedback.lang.toUpperCase()}</b>.</>
                    )}
                  </span>
                </div>
                <button
                  onClick={onNavigateStudio}
                  className={`px-3 py-1 text-white rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                    assignedFeedback.unassigned ? 'bg-amber-700 hover:bg-amber-800' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  Ir al Studio &rarr;
                </button>
              </div>
            )}

            {/* Page Title & Action Buttons (ElevenLabs Image 5) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-neutral-950 tracking-tight">
                  Voces
                </h1>
                
                {/* Pill Tabs: Explorar | Mis Voces */}
                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-full border border-neutral-200">
                  <button className="px-3.5 py-1 rounded-full bg-neutral-950 text-white shadow-xs text-xs font-medium">
                    Explorar
                  </button>
                  <button
                    onClick={onOpenSettings}
                    className="px-3.5 py-1 rounded-full text-xs font-medium text-neutral-600 hover:text-neutral-950 transition-colors"
                  >
                    Mis Voces
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={onOpenSettings}
                  className="h-8.5 px-3.5 rounded-full border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 transition-colors cursor-pointer shadow-xs"
                >
                  Ganancias
                </button>
                <button
                  onClick={onOpenSettings}
                  className="h-8.5 px-4 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <span>+ Crear voz</span>
                </button>
              </div>
            </div>

            {/* Big Search Bar with Filters (ElevenLabs Image 5 style) */}
            <div className="space-y-3">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar en las voces de la biblioteca..."
                  className="w-full h-11 pl-11 pr-24 bg-white border border-neutral-200 rounded-full text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 shadow-xs transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <button className="h-7 px-3 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-medium flex items-center gap-1 transition-colors">
                    <Filter className="w-3 h-3 text-neutral-500" />
                    <span>Filtros</span>
                  </button>
                </div>
              </div>

              {/* Language and Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* Languages Dropdown / Pills */}
                {LANG_PILLS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLang(l.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                      selectedLang === l.id
                        ? 'bg-neutral-950 text-white border-neutral-950 shadow-xs'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}

                <span className="w-px h-4 bg-neutral-200 mx-1" />

                {/* Categories */}
                {VOICE_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                      selectedCategory === c.id
                        ? 'bg-neutral-950 text-white border-neutral-950 shadow-xs'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Section: Trending Voices Grid (ElevenLabs Image 5 style) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-neutral-950 tracking-tight flex items-center gap-1.5">
                  <span>Voces en tendencia</span>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                </h2>
                <span className="text-[11px] text-neutral-400 font-mono">
                  CLIC EN ▶ PARA AUDICIONAR
                </span>
              </div>

              {isLoading ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 className="w-7 h-7 text-neutral-900 animate-spin mx-auto" />
                  <p className="text-xs text-neutral-500">Cargando catálogo de voces...</p>
                </div>
              ) : filteredVoices.length === 0 ? (
                <div className="py-16 text-center bg-white border border-neutral-200 rounded-2xl space-y-2">
                  <p className="text-xs font-semibold text-neutral-900">No se encontraron voces</p>
                  <p className="text-[11px] text-neutral-500">Intenta buscar con otros términos o cambia los filtros de idioma.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredVoices.map((voice, idx) => {
                    const isPlaying = playingVoiceId === voice.id;
                    const colorGradient = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                    const supportedLangs = (voice.languages && voice.languages.length > 0)
                      ? voice.languages
                      : (voice.lang === 'all' ? ['es', 'en', 'it', 'pt'] : [voice.lang]);

                    return (
                      <div
                        key={voice.id}
                        className={`p-3.5 rounded-2xl border transition-all duration-150 flex flex-col justify-between bg-white ${
                          isPlaying
                            ? 'border-neutral-950 shadow-md ring-1 ring-neutral-950'
                            : 'border-neutral-200 hover:border-neutral-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* ElevenLabs Style Avatar circle with gradient */}
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colorGradient} text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs relative`}>
                              {voice.name.slice(0, 2).toUpperCase()}
                              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-neutral-950 text-white flex items-center justify-center text-[8px] border border-white">
                                ✓
                              </span>
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <h3 className="font-semibold text-xs text-neutral-950 truncate tracking-tight">
                                {voice.name}
                              </h3>
                              <p className="text-[11px] text-neutral-500 truncate">
                                {voice.tone || voice.desc || 'Narración'}
                              </p>
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                                  {supportedLangs.length === 1
                                    ? (supportedLangs[0] === 'es' ? '🇪🇸 Español' : supportedLangs[0] === 'en' ? '🇺🇸 English' : supportedLangs[0] === 'it' ? '🇮🇹 Italiano' : '🇧🇷 Português')
                                    : `🌐 Multilingüe (${supportedLangs.map(l => l.toUpperCase()).join(', ')})`}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Play / Stop Button */}
                          <button
                            onClick={() => handleAudition(voice)}
                            disabled={isLoading}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 shadow-xs ${
                              isPlaying
                                ? 'bg-neutral-950 text-white animate-pulse'
                                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                            }`}
                            title="Audicionar voz en tiempo real"
                          >
                            {isPlaying ? (
                              <Volume2 className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3 h-3 ml-0.5" />
                            )}
                          </button>
                        </div>

                        {/* Bottom Assignment Action Buttons (Filtered strictly to supported languages) */}
                        <div className="mt-3.5 pt-2.5 border-t border-neutral-100 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-neutral-400 font-mono">
                            Asignar a cabina:
                          </span>
                          <div className="flex items-center gap-1">
                            {supportedLangs.map((lang) => {
                              const isCurrent = activeVoices[lang] === voice.id;
                              return (
                                <button
                                  key={lang}
                                  onClick={() => handleAssignToBooth(lang, voice.id, voice.name)}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium transition-all cursor-pointer ${
                                    isCurrent
                                      ? 'bg-neutral-950 text-white shadow-xs font-bold ring-1 ring-neutral-950'
                                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                                  }`}
                                  title={isCurrent ? `Deseleccionar de la cabina ${lang.toUpperCase()}` : `Asignar ${voice.name} a la cabina de ${lang.toUpperCase()}`}
                                >
                                  {lang.toUpperCase()}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section: Seleccionado para tu caso de uso (ElevenLabs Image 5 banners) */}
            <div className="space-y-3 pt-2">
              <h2 className="text-sm font-bold text-neutral-950 tracking-tight">
                Seleccionado para tu caso de uso
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white space-y-2 shadow-xs">
                  <div className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                    V3 ENGINE
                  </div>
                  <h4 className="font-bold text-sm text-white">
                    Best voices for Live Interpretation
                  </h4>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Modelos optimizados para conferencias sin latencia perceptible.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 text-white space-y-2 shadow-xs">
                  <div className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                    KEYNOTE PRO
                  </div>
                  <h4 className="font-bold text-sm text-white">
                    Studio-Quality Conversational Voices
                  </h4>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Voces con entonación oratoria y cadencia natural para eventos magistrales.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-br from-neutral-950 to-neutral-900 text-white space-y-2 shadow-xs">
                  <div className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                    CLÍNICO CIE-11
                  </div>
                  <h4 className="font-bold text-sm text-white">
                    Medical & Technical Certified Voices
                  </h4>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Pronunciación milimétrica para congresos médicos y farmacéuticos.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </main>

      </div>

    </div>
  );
}
