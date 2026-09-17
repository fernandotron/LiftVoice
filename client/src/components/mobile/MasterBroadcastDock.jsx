import React, { useRef, useEffect } from 'react';
import { Mic, Users, SlidersHorizontal, Settings2, Hand, Square } from 'lucide-react';

/**
 * MasterBroadcastDock — LiftVoice Studio 2026
 * Muelle de emisión ergonómico anclado en la zona del pulgar (Thumb Zone):
 * - Botones táctiles de 48px con separación ergonómica centrada (gap-2.5)
 * - Estado de emisión activo con bg-rose-600 text-white animate-pulse
 * - Contenedor con gradiente suave desvanecido sin línea divisoria rígida
 * - Soporte nativo para iOS Safe Area Insets
 */
export default function MasterBroadcastDock({
  isBroadcasting = false,
  onToggleBroadcast = () => {},
  isToggling = false,
  onOpenAttendees = () => {},
  attendeesCount = 0,
  onOpenStudioSettings = () => {},
  onOpenCabinsSheet = () => {},
  onOpenQA = () => {},
  audioRecorderService = null,
  pendingQACount = 0
}) {
  const haloRef = useRef(null);

  // GPU Reactive VAD Halo (will-change: transform, opacity)
  useEffect(() => {
    if (!audioRecorderService?.onAudioLevel) return;
    const unsub = audioRecorderService.onAudioLevel((lvl) => {
      if (haloRef.current) {
        const normalized = Math.min(100, Math.max(0, lvl));
        const scale = 1 + (normalized / 100) * 0.28;
        const opacity = Math.min(0.75, 0.15 + (normalized / 100) * 0.55);
        haloRef.current.style.transform = `scale(${scale})`;
        haloRef.current.style.opacity = `${opacity}`;
      }
    });
    return () => unsub();
  }, [audioRecorderService]);

  const handleBroadcastClick = () => {
    if (isToggling) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(isBroadcasting ? 28 : [18, 35, 22]);
      }
    } catch (e) {}
    onToggleBroadcast();
  };

  return (
    <nav 
      aria-label="Controles de emisión del ponente"
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-12 px-2.5 sm:px-4 pointer-events-none select-none"
    >
      {/* Capa de difuminado progresivo inferior (Frosted Glass con gradiente y desenfoque) */}
      <div 
        aria-hidden="true" 
        className="dock-difuminado-inferior" 
      />

      <div className="relative z-10 flex items-center justify-center gap-2.5 sm:gap-3 pointer-events-auto max-w-md mx-auto">
        
        {/* Satélite 1: Participantes en Sala (48px circular neutro con badge de asistentes) */}
        <button
          type="button"
          onClick={onOpenAttendees}
          className="relative w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title="Participantes en sala"
          aria-label={attendeesCount > 0 ? `Participantes en sala, ${attendeesCount} conectados` : 'Participantes en sala'}
        >
          <Users className="w-5 h-5" strokeWidth={1.7} />
          {attendeesCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 h-4.5 min-w-[18px] rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-mono font-bold flex items-center justify-center shadow-xs">
              {attendeesCount}
            </span>
          )}
        </button>

        {/* Satélite 2: Ajustes de Estudio (Micrófono, Idioma del Ponente, Locución) */}
        <button
          type="button"
          onClick={onOpenStudioSettings}
          className="w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title="Ajustes de estudio (Micrófono e idioma del ponente)"
          aria-label="Ajustes de estudio"
        >
          <Settings2 className="w-5 h-5" strokeWidth={1.6} />
        </button>

        {/* Centro: Master Broadcast Button — Dynamic Morphing Capsule 2026 */}
        <div className="relative inline-flex items-center justify-center shrink-0">
          {isBroadcasting && (
            <div
              ref={haloRef}
              className="absolute -inset-2 rounded-full bg-rose-500/20 pointer-events-none transition-transform duration-75 will-change-transform"
              style={{ transform: 'scale(1)', opacity: 0.5 }}
            />
          )}

          <button
            type="button"
            onClick={handleBroadcastClick}
            disabled={isToggling}
            className={`relative h-12 rounded-full font-medium text-xs tracking-tight flex items-center justify-center shadow-xs cursor-pointer active:scale-95 touch-manipulation select-none overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width,background-color] ${
              isBroadcasting
                ? 'w-[124px] px-4 bg-rose-600 text-white border border-transparent shadow-lg shadow-rose-600/30'
                : 'w-12 px-0 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-md ring-2 ring-zinc-950/10 dark:ring-white/20'
            } ${isToggling ? 'opacity-70 cursor-wait' : ''}`}
            aria-label={isBroadcasting ? 'Detener emisión en vivo' : 'Comenzar a emitir en vivo'}
            title={isBroadcasting ? 'Detener emisión en vivo' : 'Comenzar a emitir en vivo'}
          >
            {/* Contenido en Estado ACTIVO (Cápsula: Stop Icon + Detener) */}
            <div 
              className={`flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 ease-out ${
                isBroadcasting 
                  ? 'opacity-100 scale-100 delay-75' 
                  : 'opacity-0 scale-75 pointer-events-none absolute'
              }`}
            >
              <Square className="w-3.5 h-3.5 fill-current text-white shrink-0" />
              <span className="font-semibold tracking-wide">Detener</span>
            </div>

            {/* Contenido en Estado REPOSO (Círculo: Mic Icon centrado) */}
            <div 
              className={`flex items-center justify-center transition-all duration-150 ease-out ${
                !isBroadcasting 
                  ? 'opacity-100 scale-100' 
                  : 'opacity-0 scale-75 pointer-events-none absolute'
              }`}
            >
              <Mic className="w-5 h-5 shrink-0" strokeWidth={1.8} />
            </div>
          </button>
        </div>

        {/* Satélite 3: Panel de Cabinas (48px circular neutro) */}
        <button
          type="button"
          onClick={onOpenCabinsSheet}
          className="w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title="Ajustar cabinas de idiomas y décalage"
          aria-label="Panel de cabinas"
        >
          <SlidersHorizontal className="w-5 h-5" strokeWidth={1.6} />
        </button>

        {/* Satélite 4: Q&A Backchannel (48px circular neutro con badge reactivo) */}
        <button
          type="button"
          onClick={onOpenQA}
          className="relative w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title="Turnos de palabra y preguntas Q&A"
          aria-label={pendingQACount > 0 ? `Panel de preguntas, ${pendingQACount} pendientes` : 'Panel de preguntas'}
        >
          <Hand className="w-5 h-5" strokeWidth={1.6} />
          {pendingQACount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce shadow-xs">
              {pendingQACount}
            </span>
          )}
        </button>

      </div>
    </nav>
  );
}
