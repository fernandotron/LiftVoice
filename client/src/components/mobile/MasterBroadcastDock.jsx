import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Headphones, SlidersHorizontal } from 'lucide-react';

/**
 * MasterBroadcastDock — LiftVoice Studio 2026
 * Muelle de emisión ergonómico anclado en la zona del pulgar (Thumb Zone):
 * - Botón maestro central de 56px de alto con halo reactivo al volumen RMS (Zero-Reflow GPU)
 * - Satélite izquierdo: Conmutador de retorno de auricular (Mute / Idioma activo)
 * - Satélite derecho: Acceso al Bottom Sheet de cabinas con badge de Q&A
 * - Soporte nativo para iOS Safe Area Insets
 */
export default function MasterBroadcastDock({
  isBroadcasting = false,
  onToggleBroadcast = () => {},
  isToggling = false,
  monitoredLang = 'none',
  onToggleMonitoring = () => {},
  onOpenCabinsSheet = () => {},
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
        navigator.vibrate(isBroadcasting ? 25 : [20, 40, 20]);
      }
    } catch (e) {}
    onToggleBroadcast();
  };

  return (
    <nav 
      aria-label="Controles de emisión del ponente"
      className="fixed bottom-0 inset-x-0 z-40 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3 px-4 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95 backdrop-blur-md border-t border-zinc-200/50 dark:border-zinc-800/50 pointer-events-none"
    >
      <div className="max-w-md mx-auto flex items-center justify-between gap-3 pointer-events-auto">
        
        {/* Satélite Izquierdo: Monitor Auricular Rápido */}
        <button
          type="button"
          onClick={() => onToggleMonitoring(monitoredLang === 'none' ? 'es' : 'none')}
          aria-pressed={monitoredLang !== 'none'}
          className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 ${
            monitoredLang !== 'none'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
          title="Alternar retorno por auriculares"
          aria-label={monitoredLang !== 'none' ? `Auriculares activos en ${monitoredLang}` : 'Auriculares silenciados'}
        >
          <Headphones className="w-4 h-4" />
          <span className="text-[10px] font-mono font-medium mt-0.5">
            {monitoredLang !== 'none' ? monitoredLang : 'Mute'}
          </span>
        </button>

        {/* Centro: Master Broadcast Button con Voice-Reactive Aura Gemini Live */}
        <div className="flex items-center justify-center flex-1">
          <div className="relative w-full max-w-[220px] flex items-center justify-center">
            {isBroadcasting && (
              <div
                ref={haloRef}
                className="absolute -inset-3 rounded-full gemini-aura-glow pointer-events-none transition-transform duration-75"
                style={{ transform: 'scale(1)', opacity: 0.6, willChange: 'transform, opacity' }}
              />
            )}

            <button
              type="button"
              onClick={handleBroadcastClick}
              disabled={isToggling}
              className={`relative w-full h-14 rounded-full font-semibold text-xs tracking-tight flex items-center justify-center gap-2.5 shadow-md transition-all cursor-pointer active:scale-95 touch-manipulation select-none whitespace-nowrap ${
                isToggling ? 'opacity-70 cursor-wait' : ''
              } ${
                isBroadcasting
                  ? 'gemini-gradient-bg text-white border border-white/20 shadow-lg shadow-purple-500/25'
                  : 'bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-950 shadow-zinc-950/20'
              }`}
              aria-label={isBroadcasting ? 'Detener emisión en vivo' : 'Comenzar a emitir en vivo'}
            >
              {isBroadcasting ? (
                <>
                  <div className="flex items-center gap-0.5 h-4 relative z-10">
                    <span className="w-1 h-2.5 rounded-full bg-white animate-gemini-wave" />
                    <span className="w-1 h-4 rounded-full bg-white animate-gemini-wave delay-1" />
                    <span className="w-1 h-2 rounded-full bg-white animate-gemini-wave delay-2" />
                    <span className="w-1 h-3.5 rounded-full bg-white animate-gemini-wave delay-3" />
                  </div>
                  <span className="relative z-10">Transmitiendo en vivo</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  <span>Emitir en directo</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Satélite Derecho: Drawer de Cabinas & Badge Q&A */}
        <button
          type="button"
          onClick={onOpenCabinsSheet}
          className="relative w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shadow-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-95 cursor-pointer flex-shrink-0"
          title="Abrir panel de cabinas y configuración rápida"
          aria-label={pendingQACount > 0 ? `Panel de cabinas, ${pendingQACount} preguntas pendientes` : 'Panel de cabinas'}
        >
          <SlidersHorizontal className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
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
