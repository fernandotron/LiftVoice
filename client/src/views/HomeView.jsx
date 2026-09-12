import React, { useState, useEffect } from 'react';
import { Mic, Headphones } from 'lucide-react';
import { normalizeRoomCode } from '../App.jsx';
import { SUPPORTED_LANGUAGES } from '../components/LanguageSelector.jsx';

/**
 * HomeView — LiftVoice 2026
 * Pantalla principal calibrada para ajuste perfecto a pantalla completa sin scroll forzado:
 * - Píldora interactiva minimalista de última sala
 * - Tarjetas ergonómicas para Oyente y Ponente
 * - Footer compacto, elegante y sin indicador verde
 */
export default function HomeView({
  onCreateRoom = () => {},
  onJoinRoom = () => {},
  isAttendeeOnly = false
}) {
  const [joinPin, setJoinPin] = useState('');
  const [customRoomName, setCustomRoomName] = useState('');
  const [mobileTab, setMobileTab] = useState('join'); // 'join' | 'host'
  const [recentRoom, setRecentRoom] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('lv_recent_room');
      if (raw) {
        const parsed = JSON.parse(raw);
        const isFresh = parsed.timestamp && (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000);
        const banned = JSON.parse(localStorage.getItem('lv_banned_rooms') || '{}');
        const isBanned = Boolean(banned[parsed.roomId]);

        if (isFresh && !isBanned && parsed.roomId) {
          const langObj = SUPPORTED_LANGUAGES.find(l => l.code === parsed.lang) || SUPPORTED_LANGUAGES[0];
          const diffMinutes = Math.max(1, Math.round((Date.now() - parsed.timestamp) / 60000));
          const timeAgo = diffMinutes < 60 ? `${diffMinutes}m` : `${Math.round(diffMinutes / 60)}h`;

          setRecentRoom({
            roomId: parsed.roomId,
            lang: parsed.lang || 'es',
            langName: langObj.nativeName,
            timeAgo
          });
        }
      }
    } catch (e) {}
  }, []);

  const handleDismissRecentRoom = (e) => {
    e.stopPropagation();
    try {
      localStorage.removeItem('lv_recent_room');
    } catch (err) {}
    setRecentRoom(null);
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!joinPin.trim()) return;
    onJoinRoom(normalizeRoomCode(joinPin.trim()));
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    onCreateRoom(customRoomName.trim() ? normalizeRoomCode(customRoomName.trim()) : null);
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors overflow-y-auto min-h-0">
      
      {/* Main Interactive Content: centrado y con espaciados cómodos estilo Reness */}
      <div className="my-auto w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-7 sm:space-y-9">
        
        {/* Clean Hero */}
        <div className="text-center max-w-xl mx-auto space-y-3.5 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium shadow-2xs">
            <span>Interpretación simultánea en directo</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.15]">
            Traducción de voz en directo
          </h1>

          <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
            {isAttendeeOnly
              ? 'Ingresa a tu sala para escuchar la conferencia y leer subtítulos sincronizados en tu idioma.'
              : 'Escucha o retransmite conferencias en tiempo real con audio sincronizado en varios idiomas.'}
          </p>
        </div>

        {/* Píldora Minimalista de Reingreso a Última Sala (Estilo Dynamic Island) */}
        {recentRoom && (
          <div className="max-w-md mx-auto w-full animate-fadeIn pt-1.5 sm:pt-2">
            <div className="py-2.5 pl-4.5 pr-2 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex flex-col justify-center min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Última sala:</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {recentRoom.roomId}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono leading-none mt-1">
                  hace {recentRoom.timeAgo}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onJoinRoom(recentRoom.roomId, recentRoom.lang)}
                  className="h-9 px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <span>Entrar</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismissRecentRoom}
                  className="h-9 px-3.5 rounded-full text-xs font-medium bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white border border-zinc-300/60 dark:border-zinc-700/60 transition-all cursor-pointer flex items-center justify-center shadow-2xs active:scale-95"
                  title="Descartar"
                  aria-label="Descartar sala reciente"
                >
                  <span>Descartar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section: Action Cards + Mobile Role Switcher */}
        <div className="space-y-4 sm:space-y-6 w-full">
          {/* Mobile View Switcher (Oyente vs Ponente) — Oculto en modo oyente exclusivo */}
          {!isAttendeeOnly && (
            <div className="lg:hidden flex p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-full border border-zinc-200/90 dark:border-zinc-800 max-w-sm mx-auto shadow-2xs w-full" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mobileTab === 'join'}
                onClick={() => setMobileTab('join')}
                className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-full flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  mobileTab === 'join'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Headphones className="w-4 h-4" />
                <span>Oyente</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileTab === 'host'}
                onClick={() => setMobileTab('host')}
                className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-semibold rounded-full flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  mobileTab === 'host'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>Ponente</span>
              </button>
            </div>
          )}

          {/* Action Cards: 1. Attendee (Oyente) / 2. Speaker (Ponente) */}
          <div className={`grid grid-cols-1 ${isAttendeeOnly ? 'max-w-md mx-auto' : 'lg:grid-cols-2 max-w-4xl mx-auto'} gap-5 sm:gap-6 w-full`}>
            
            {/* Card 1: Attendee / Sintonizar Sala */}
            <div className={`${isAttendeeOnly || mobileTab === 'join' ? 'flex' : 'hidden lg:flex'} bg-white dark:bg-zinc-900/70 border border-zinc-200/90 dark:border-zinc-800 rounded-[28px] p-6 sm:p-7 flex-col justify-between shadow-2xs text-left space-y-6 w-full`}>
              <div className="space-y-4">
                <div className={`${isAttendeeOnly ? 'flex' : 'hidden lg:flex'} w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 items-center justify-center text-zinc-900 dark:text-zinc-100 shadow-2xs`}>
                  <Headphones className="w-5 h-5" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Entrar como oyente
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Ingresa el código de la reunión para escuchar la conferencia y leer los subtítulos en tu idioma.
                  </p>
                </div>
              </div>

              <form onSubmit={handleJoinSubmit} className="space-y-3">
                <input
                  type="text"
                  value={joinPin}
                  onChange={(e) => setJoinPin(e.target.value)}
                  placeholder="Código de sala (ej: abc-defg-hij)"
                  className="w-full h-12 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 text-sm font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-100 transition-all"
                />
                <button
                  type="submit"
                  disabled={!joinPin.trim()}
                  className="w-full h-12 rounded-full bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-sm flex items-center justify-center shadow-sm disabled:opacity-40 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <span>Entrar a la sala</span>
                </button>
              </form>
            </div>

            {/* Card 2: Host / Crear Sala — Completamente oculta en modo oyente exclusivo */}
            {!isAttendeeOnly && (
              <div className={`${mobileTab === 'host' ? 'flex' : 'hidden lg:flex'} bg-white dark:bg-zinc-900/70 border border-zinc-200/90 dark:border-zinc-800 rounded-[28px] p-6 sm:p-7 flex-col justify-between shadow-2xs text-left space-y-6`}>
                <div className="space-y-4">
                  <div className="hidden lg:flex w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 items-center justify-center text-zinc-900 dark:text-zinc-100 shadow-2xs">
                    <Mic className="w-5 h-5" />
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                      Crear sala
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Inicia una sala para retransmitir tu conferencia desde tu micrófono en directo a los asistentes.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateSubmit} className="space-y-3">
                  <input
                    type="text"
                    value={customRoomName}
                    onChange={(e) => setCustomRoomName(e.target.value)}
                    placeholder="Código personalizado (opcional)"
                    className="w-full h-12 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 text-sm font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-100 transition-all"
                  />
                  <button
                    type="submit"
                    className="w-full h-12 rounded-full bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-sm flex items-center justify-center shadow-sm cursor-pointer transition-all active:scale-[0.99]"
                  >
                    <span>{customRoomName.trim() ? 'Crear sala con código' : 'Crear sala instantánea'}</span>
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Footer Estructurado, Elegante y con Respiración Adecuada */}
      <footer className="w-full border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/30 py-5 sm:py-6 px-4 sm:px-8 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] transition-colors mt-auto flex-shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6 text-xs sm:text-sm">
          {/* Brand Identity & Mission */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-center sm:text-left">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight text-xs sm:text-sm">
              LiftVoice
            </span>
            <span className="text-zinc-300 dark:text-zinc-700 select-none">&bull;</span>
            <span className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">
              Interpretación simultánea en directo
            </span>
          </div>

          {/* Status & Copyright Meta */}
          <div className="flex items-center gap-2.5 text-xs text-zinc-400 dark:text-zinc-500 font-mono">
            <span>Audio sincronizado</span>
            <span className="text-zinc-300 dark:text-zinc-700 select-none">&bull;</span>
            <span>&copy; 2026</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
