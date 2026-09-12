import React, { useState, useEffect } from 'react';
import { X, Play, Loader2, Check, AudioLines, Search, Volume2, Sparkles, Sliders } from 'lucide-react';
import { audioPlayerService } from '../services/audioPlayer.js';
import CountryFlag from './shared/CountryFlag.jsx';

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
  const [targetLang, setTargetLang] = useState(currentLanguage);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);

  useEffect(() => {
    setTargetLang(currentLanguage);
  }, [currentLanguage]);

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
          console.warn('[VoiceCatalog] Could not fetch voices:', err);
        })
        .finally(() => {
          setIsLoadingVoices(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
    if (playingVoiceId === voice.id) return;
    setPlayingVoiceId(voice.id);

    try {
      await audioPlayerService.unlockAudio(roomId, targetLang);
      const samplePhrases = {
        es: 'Bienvenidos a LiftVoice. Esta es una demostración en vivo de mi voz para la cabina de traducción en español.',
        en: 'Welcome to LiftVoice. This is a real-time speech demonstration of my voice for the English translation booth.',
        it: 'Benvenuti a LiftVoice. Questa è una dimostrazione della mia voce per la cabina di traduzione in italiano.',
        pt: 'Bem-vindos ao LiftVoice. Esta é uma demonstração da minha voz para a cabine de tradução em português.'
      };

      const response = await fetch(`/api/rooms/${roomId}/preview-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: targetLang,
          sampleText: samplePhrases[targetLang] || samplePhrases.en,
          voice: voice.id,
          gender: voice.gender || 'female',
          engine: voice.engine
        })
      });

      const data = await response.json();
      if (data.audioBase64) {
        audioPlayerService.playAudioChunk({
          audioBase64: data.audioBase64,
          mimeType: data.mimeType || 'audio/mp3',
          lang: targetLang
        });
      }
    } catch (err) {
      console.error('[VoiceCatalog] Error auditioning voice:', err);
    } finally {
      setTimeout(() => {
        setPlayingVoiceId(null);
      }, 3500);
    }
  };

  const activeVoiceForLang = selectedVoices[targetLang] || '';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-4 bg-black/40 backdrop-blur-[3px] animate-backdrop-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl max-h-[90dvh] sm:max-h-[88vh] bg-white dark:bg-[#1f1f1f] rounded-[28px] border border-zinc-200/80 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-left animate-sheet-up sm:animate-fadeIn transition-colors duration-150 text-zinc-900 dark:text-zinc-100">
        {/* Modal Header without divider line */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between bg-white dark:bg-[#1f1f1f] flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center shadow-xs flex-shrink-0">
              <AudioLines className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2 truncate">
                Catálogo de Voces Multi-Motor
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                Selecciona y audiciona la voz activa para cada cabina de idioma.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-4 sm:px-6 py-3 bg-zinc-50/60 dark:bg-white/[0.02] space-y-2.5 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar voz o tono..."
                className="w-full h-11 pl-10 pr-3 text-xs sm:text-sm bg-white dark:bg-[#1a1a1a] border border-zinc-200 dark:border-white/10 rounded-2xl placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-white/30 transition-all"
              />
            </div>

            {/* Language Tabs */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#1a1a1a] p-1 border border-zinc-200/80 dark:border-white/10 rounded-2xl w-full sm:w-auto overflow-x-auto no-scrollbar">
              {[
                { code: 'es', label: 'Español' },
                { code: 'en', label: 'English' },
                { code: 'it', label: 'Italiano' },
                { code: 'pt', label: 'Português' }
              ].map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setTargetLang(lang.code)}
                  className={`px-3 py-1.5 text-xs rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    targetLang === lang.code
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-white/5'
                  }`}
                >
                  <CountryFlag code={lang.code} className="w-4 h-4 rounded-full shadow-2xs" />
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Engine Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs">
            <button
              onClick={() => setSelectedEngineFilter('all')}
              className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                selectedEngineFilter === 'all'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white font-medium'
                  : 'bg-white dark:bg-[#1a1a1a] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
              }`}
            >
              Todos los motores ({voices.length})
            </button>

            <button
              onClick={() => setSelectedEngineFilter('deepgram')}
              className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedEngineFilter === 'deepgram'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white font-medium'
                  : 'bg-white dark:bg-[#1a1a1a] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
              }`}
            >
              <span>Deepgram Aura ⚡</span>
              <span className={`w-1.5 h-1.5 rounded-full ${configuredEngines.deepgram ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
            </button>

            <button
              onClick={() => setSelectedEngineFilter('google')}
              className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedEngineFilter === 'google'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white font-medium'
                  : 'bg-white dark:bg-[#1a1a1a] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
              }`}
            >
              <span>Google Neural 🌐</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </button>

            <button
              onClick={() => setSelectedEngineFilter('openai')}
              className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedEngineFilter === 'openai'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white font-medium'
                  : 'bg-white dark:bg-[#1a1a1a] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
              }`}
            >
              <span>OpenAI 🤖</span>
              <span className={`w-1.5 h-1.5 rounded-full ${configuredEngines.openai ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
            </button>

            <button
              onClick={() => setSelectedEngineFilter('elevenlabs')}
              className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedEngineFilter === 'elevenlabs'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white font-medium'
                  : 'bg-white dark:bg-[#1a1a1a] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
              }`}
            >
              <span>ElevenLabs 🌟</span>
              <span className={`w-1.5 h-1.5 rounded-full ${configuredEngines.elevenlabs ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
            </button>
          </div>
        </div>

        {/* Voices Grid */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white dark:bg-[#1f1f1f]">
          {isLoadingVoices ? (
            <div className="col-span-2 py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-900 dark:text-zinc-100" />
              <span className="text-xs">Cargando catálogo consolidado...</span>
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="col-span-2 py-16 text-center text-zinc-400 dark:text-zinc-500 text-xs">
              No se encontraron voces con los filtros seleccionados.
            </div>
          ) : (
            filteredVoices.map((voice) => {
              const isSelected = activeVoiceForLang === voice.id;
              const isPlaying = playingVoiceId === voice.id;

              return (
                <div
                  key={voice.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-zinc-900 dark:border-white/30 bg-zinc-100/80 dark:bg-white/[0.08] shadow-xs ring-1 ring-zinc-900/10 dark:ring-white/20'
                      : 'border-zinc-200 dark:border-white/10 bg-zinc-50/40 dark:bg-white/[0.02] hover:border-zinc-300 dark:hover:border-white/20 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold flex items-center justify-center flex-shrink-0 shadow-xs">
                          {voice.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            {voice.name}
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono font-normal">
                              {voice.gender === 'male' ? '♂ Masc' : voice.gender === 'female' ? '♀ Fem' : 'Neutro'}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                            {voice.tone}
                          </div>
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 text-[10px] font-mono border border-zinc-200 dark:border-white/10">
                        {voice.badge}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {voice.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-100 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => handleAudition(voice)}
                      disabled={isPlaying}
                      className="h-9 px-3.5 rounded-2xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isPlaying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-900 dark:text-zinc-100" />
                          <span className="text-zinc-900 dark:text-zinc-100 font-medium">Audicionando...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-zinc-800 dark:fill-zinc-200 text-zinc-800 dark:text-zinc-200" />
                          <span>Audicionar</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectVoice(targetLang, voice.id, voice.engine, voice.gender);
                        onClose();
                      }}
                      className={`h-9 px-4 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs'
                          : 'bg-zinc-100 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/20'
                      }`}
                    >
                      {isSelected ? 'Voz Asignada ✓' : 'Asignar Cabina'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3 bg-zinc-50/50 dark:bg-[#1f1f1f] flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3 flex-shrink-0">
          <span className="truncate max-w-[200px] sm:max-w-none">Sincronizado con las 4 cabinas de audio.</span>
          <button
            onClick={onClose}
            className="h-9 px-5 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer text-xs transition-colors flex items-center justify-center"
          >
            Listo
          </button>
        </div>

      </div>
    </div>
  );
}
