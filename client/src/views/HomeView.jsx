import React, { useState } from 'react';
import { Mic, Headphones, ArrowRight, AudioLines, Radio, Shield, Zap, QrCode, Play, Volume2, Globe, CheckCircle2, Waves, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../components/LanguageSelector.jsx';
import { audioPlayerService } from '../services/audioPlayer.js';
import { normalizeRoomCode } from '../App.jsx';

const SAMPLE_PHRASES = {
  en: 'Welcome to LiftVoice. Real-time simultaneous AI interpretation for live conferences and keynotes.',
  es: 'Bienvenidos a LiftVoice. Interpretación simultánea con inteligencia artificial en tiempo real.',
  it: 'Benvenuti a LiftVoice. Interpretazione simultanea con intelligenza artificiale in tempo reale.',
  pt: 'Bem-vindos ao LiftVoice. Interpretação simultânea com inteligência artificial em tempo real.'
};

export default function HomeView({
  onCreateRoom = () => {},
  onJoinRoom = () => {}
}) {
  const [joinPin, setJoinPin] = useState('');
  const [customRoomName, setCustomRoomName] = useState('');
  const [playingLang, setPlayingLang] = useState(null);
  const [mobileTab, setMobileTab] = useState('host'); // 'host' | 'join'
  const [isVoicesExpanded, setIsVoicesExpanded] = useState(false);

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!joinPin.trim()) return;
    onJoinRoom(normalizeRoomCode(joinPin.trim()));
  };

  const handleCreateInstant = () => {
    onCreateRoom(null);
  };

  const handleCreateCustom = (e) => {
    e.preventDefault();
    onCreateRoom(customRoomName.trim() ? normalizeRoomCode(customRoomName.trim()) : null);
  };

  const handlePlayVoiceSample = async (langCode) => {
    if (playingLang === langCode) {
      audioPlayerService.stopAll();
      setPlayingLang(null);
      return;
    }

    setPlayingLang(langCode);
    try {
      await audioPlayerService.unlockAudio('DEMO', langCode);
      const text = SAMPLE_PHRASES[langCode] || SAMPLE_PHRASES.en;
      
      try {
        const res = await fetch('/api/rooms/DEMO/preview-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang: langCode, text })
        });
        const data = await res.json();
        if (data && data.audioBase64) {
          audioPlayerService.playAudioChunk({
            audioBase64: data.audioBase64,
            mimeType: data.mimeType || 'audio/mp3',
            lang: langCode,
            text
          });
        } else {
          audioPlayerService.playAudioChunk({ text, lang: langCode });
        }
      } catch (err) {
        audioPlayerService.playAudioChunk({ text, lang: langCode });
      }

      setTimeout(() => {
        setPlayingLang(prev => (prev === langCode ? null : prev));
      }, 3500);
    } catch (e) {
      setPlayingLang(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col justify-between py-10 sm:py-14 bg-white dark:bg-zinc-950 transition-colors">
      <div className="container-custom space-y-14">
        
        {/* Spacious High-End Hero */}
        <div className="text-center max-w-3xl mx-auto space-y-5 pt-2">
          {/* Subtle Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Interpretación Simultánea Neuronal en Vivo &bull; Edición 2026</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-[1.1]">
            Traducción de Voz en Directo <br />
            <span className="text-zinc-400 dark:text-zinc-500 font-normal">
              para Conferencias & Keynotes.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Habla en tu idioma nativo en el escenario. La audiencia escanea el código QR, conecta sus auriculares y escucha la interpretación neuronal multilingüe con latencia mínima en sus teléfonos móviles.
          </p>
        </div>

        {/* Mobile View Switcher (Crear Sala vs Unirse) */}
        <div className="lg:hidden flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-xs mx-auto shadow-2xs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'host'}
            onClick={() => setMobileTab('host')}
            className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mobileTab === 'host'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
            <span>Crear Sala</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'join'}
            onClick={() => setMobileTab('join')}
            className={`flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mobileTab === 'join'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Headphones className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
            <span>Unirme (Oyente)</span>
          </button>
        </div>

        {/* Action Dual Cards (Spacious, Minimalist, High-Contrast) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          
          {/* Card 1: Speaker Studio */}
          <div className={`${mobileTab === 'host' ? 'flex' : 'hidden lg:flex'} bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 flex-col justify-between shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-left`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
                  <Mic className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono font-medium">Panel del ponente</span>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Estudio de Retransmisión
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Inicia una emisión en directo con tu micrófono. La plataforma detecta tu voz y emite simultáneamente en 4 cabinas de idiomas con motores neuronales.
                </p>
              </div>
            </div>

            <div className="mt-6 sm:mt-7 space-y-3">
              <button
                type="button"
                onClick={handleCreateInstant}
                className="w-full h-12 sm:h-11 rounded-xl sm:rounded-lg bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold sm:font-medium text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
              >
                <span>Crear Sala & Iniciar Retransmisión</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <form onSubmit={handleCreateCustom} className="flex gap-2">
                <input
                  type="text"
                  value={customRoomName}
                  onChange={(e) => setCustomRoomName(e.target.value)}
                  placeholder="O código personalizado (ej: abc-defg-hij)"
                  className="flex-1 h-11 sm:h-9 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl sm:rounded-lg px-3.5 text-sm sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-100 font-mono transition-all"
                />
                <button
                  type="submit"
                  className="h-11 sm:h-9 px-4 rounded-xl sm:rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold cursor-pointer transition-colors flex-shrink-0"
                >
                  Crear
                </button>
              </form>
            </div>
          </div>

          {/* Card 2: Attendee Receiver */}
          <div className={`${mobileTab === 'join' ? 'flex' : 'hidden lg:flex'} bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 flex-col justify-between shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-left`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
                  <Headphones className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono font-medium">Canal de oyente</span>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  Sintonizar Conferencia
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  ¿Estás en el auditorio? Ingresa el código o vínculo de la reunión para escuchar la ponencia en tus auriculares con pantalla activa o bloqueada.
                </p>
              </div>
            </div>

            <form onSubmit={handleJoinSubmit} className="mt-6 sm:mt-7 space-y-3">
              <input
                type="text"
                value={joinPin}
                onChange={(e) => setJoinPin(e.target.value)}
                placeholder="Introduce un código o enlace (ej: abc-defg-hij)..."
                className="w-full h-11 sm:h-9 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl sm:rounded-lg px-3.5 text-sm sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-100 font-mono transition-all tracking-wider"
              />
              <button
                type="submit"
                disabled={!joinPin.trim()}
                className="w-full h-12 sm:h-11 rounded-xl sm:rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-semibold text-xs border border-zinc-200 dark:border-zinc-700 flex items-center justify-center gap-2 shadow-2xs disabled:opacity-40 cursor-pointer transition-colors active:scale-[0.99]"
              >
                <span>Conectar Auriculares &bull; Escuchar en Directo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Multi-Channel Voice Soundboard Deck (Collapsible on mobile, always visible on desktop) */}
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setIsVoicesExpanded(prev => !prev)}
              className="flex items-center gap-2 text-left cursor-pointer group"
            >
              <Waves className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                Audición de voces neuronales multicanal
              </span>
              <span className="lg:hidden text-zinc-500 dark:text-zinc-400 font-mono text-[10px] ml-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
                {isVoicesExpanded ? (
                  <><span>Ocultar</span> <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <><span>Probar (4)</span> <ChevronDown className="w-3 h-3" /></>
                )}
              </span>
            </button>
            <span className="hidden sm:inline text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">Haz clic para escuchar</span>
          </div>

          <div className={`${isVoicesExpanded ? 'grid' : 'hidden lg:grid'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 transition-all`}>
            {SUPPORTED_LANGUAGES.map((l) => {
              const isPlaying = playingLang === l.code;

              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handlePlayVoiceSample(l.code)}
                  className={`p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between h-28 relative overflow-hidden group active:scale-[0.98] ${
                    isPlaying
                      ? 'bg-zinc-900 dark:bg-zinc-800 border-zinc-900 dark:border-zinc-700 text-white shadow-sm'
                      : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{l.flag}</span>
                      <div>
                        <div className={`font-semibold text-xs ${isPlaying ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'}`}>{l.nativeName}</div>
                        <div className={`text-[10px] font-mono ${isPlaying ? 'text-zinc-400' : 'text-zinc-400 dark:text-zinc-500'}`}>{l.code} &bull; {l.voice.split(' ')[0]}</div>
                      </div>
                    </div>

                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform ${
                      isPlaying ? 'bg-white text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700'
                    }`}>
                      {isPlaying ? (
                        <Volume2 className="w-3 h-3 animate-pulse" />
                      ) : (
                        <Play className="w-2.5 h-2.5 ml-0.5" />
                      )}
                    </div>
                  </div>

                  {/* Equalizer animation or description */}
                  <div className={`flex items-center justify-between pt-2 border-t ${isPlaying ? 'border-zinc-800 dark:border-zinc-700' : 'border-zinc-100 dark:border-zinc-800'}`}>
                    {isPlaying ? (
                      <div className="flex items-center gap-1 text-emerald-400 text-xs font-mono">
                        <span className="w-1 h-2.5 bg-emerald-400 animate-pulse" />
                        <span className="w-1 h-3.5 bg-emerald-400 animate-pulse delay-75" />
                        <span className="w-1 h-2 bg-emerald-400 animate-pulse delay-150" />
                        <span className="ml-1 text-[10px] text-zinc-300">Reproduciendo...</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[120px]">{l.description}</span>
                    )}

                    <span className={`text-[9px] font-mono font-medium ${isPlaying ? 'text-zinc-300' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      {isPlaying ? 'En vivo' : 'Probar'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Feature Pillars */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-10 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
            <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
              <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-semibold">01 / Captura</div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Audio & VAD</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Transmisión directa desde navegador sin instalar software, con detección por voz.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
              <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-semibold">02 / Reconoce</div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Speech-to-Text</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Transcripción neuronal con soporte multilingüe automático y segmentación continua.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
              <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-semibold">03 / Traduce</div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Multi-Target AI</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Traducción semántica paralela en menos de 200 ms conservando el contexto clínico y técnico.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
              <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 font-semibold">04 / Sintetiza</div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Deepgram & Aura</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Catálogo multi-motor con Deepgram Aura, ElevenLabs, OpenAI y Google Neural.
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-[11px] text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 mt-14 font-mono">
        LiftVoice Studio &bull; Neural Simultaneous Interpretation Platform &bull; 2026
      </footer>
    </div>
  );
}
