import React, { useState, useEffect } from 'react';
import { X, Play, Loader2, Check, AudioLines, Search, Volume2, Sparkles, Sliders } from 'lucide-react';
import { audioPlayerService } from '../services/audioPlayer.js';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-3xl max-h-[88vh] bg-white rounded-2xl border border-zinc-200 shadow-2xl flex flex-col overflow-hidden text-left">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-sm">
              <AudioLines className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
                Catálogo de Voces Multi-Motor
              </h3>
              <p className="text-xs text-zinc-500">
                Selecciona y audiciona la voz activa para cada cabina de idioma.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3.5 bg-zinc-50/80 border-b border-zinc-200 space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, tono o estilo (ej. Orion, Asteria, Resonante)..."
                className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-zinc-200 rounded-xl placeholder:text-zinc-400 text-zinc-800 focus:outline-none focus:border-zinc-900 transition-all"
              />
            </div>

            {/* Language Tabs */}
            <div className="flex items-center gap-1 bg-white p-1 border border-zinc-200 rounded-xl w-full sm:w-auto justify-between sm:justify-start">
              {[
                { code: 'es', label: '🇪🇸 Español' },
                { code: 'en', label: '🇺🇸 English' },
                { code: 'it', label: '🇮🇹 Italiano' },
                { code: 'pt', label: '🇧🇷 Português' }
              ].map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setTargetLang(lang.code)}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer ${
                    targetLang === lang.code
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  {lang.label}
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
                  ? 'bg-zinc-900 text-white border-zinc-900 font-medium'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              Todos los motores ({voices.length})
            </button>

            <button
              onClick={() => setSelectedEngineFilter('deepgram')}
              className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedEngineFilter === 'deepgram'
                  ? 'bg-zinc-900 text-white border-zinc-900 font-medium'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <span>Deepgram Aura ⚡</span>
              <span className={`w-1.5 h-1.5 rounded-full ${configuredEngines.deepgram ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
            </button>

            <button
              onClick={() => setSelectedEngineFilter('google')}
              className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedEngineFilter === 'google'
                  ? 'bg-zinc-900 text-white border-zinc-900 font-medium'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <span>Google Neural 🌐</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </button>

            <button
              onClick={() => setSelectedEngineFilter('openai')}
              className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedEngineFilter === 'openai'
                  ? 'bg-zinc-900 text-white border-zinc-900 font-medium'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <span>OpenAI 🤖</span>
              <span className={`w-1.5 h-1.5 rounded-full ${configuredEngines.openai ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
            </button>

            <button
              onClick={() => setSelectedEngineFilter('elevenlabs')}
              className={`px-3 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedEngineFilter === 'elevenlabs'
                  ? 'bg-zinc-900 text-white border-zinc-900 font-medium'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <span>ElevenLabs 🌟</span>
              <span className={`w-1.5 h-1.5 rounded-full ${configuredEngines.elevenlabs ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
            </button>
          </div>
        </div>

        {/* Voices Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white">
          {isLoadingVoices ? (
            <div className="col-span-2 py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-900" />
              <span className="text-xs">Cargando catálogo consolidado...</span>
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="col-span-2 py-16 text-center text-zinc-400 text-xs">
              No se encontraron voces con los filtros seleccionados.
            </div>
          ) : (
            filteredVoices.map((voice) => {
              const isSelected = activeVoiceForLang === voice.id;
              const isPlaying = playingVoiceId === voice.id;

              return (
                <div
                  key={voice.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-zinc-900 bg-zinc-50/70 shadow-xs ring-1 ring-zinc-900/10'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-zinc-900 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0 shadow-xs">
                          {voice.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-zinc-900 flex items-center gap-1.5">
                            {voice.name}
                            <span className="text-[10px] text-zinc-500 font-mono font-normal">
                              {voice.gender === 'male' ? '♂ Masc' : voice.gender === 'female' ? '♀ Fem' : 'Neutro'}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-500 font-medium">
                            {voice.tone}
                          </div>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-mono border border-zinc-200">
                        {voice.badge}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {voice.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-zinc-100">
                    <button
                      type="button"
                      onClick={() => handleAudition(voice)}
                      disabled={isPlaying}
                      className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-medium text-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isPlaying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-900" />
                          <span className="text-zinc-900 font-medium">Audicionando...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-zinc-800 text-zinc-800" />
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
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
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
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500">
          <span>Las voces configuradas se sincronizan automáticamente con las 4 cabinas de audio.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 text-white font-medium hover:bg-zinc-800 cursor-pointer"
          >
            Listo
          </button>
        </div>

      </div>
    </div>
  );
}
