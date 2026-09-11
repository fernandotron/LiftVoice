import React from 'react';
import { Volume2, VolumeX, Hand } from 'lucide-react';

/**
 * MobileAudioDock — LiftVoice Listener 2026
 * Muelle de escucha ergonómico anclado en la zona del pulgar (Thumb Zone):
 * - Satélite izquierdo: Selector de idioma / cabina (Bandera + código)
 * - Botón maestro central de 56px: Sintonizar / En directo / Silenciar con barras de onda reactivas
 * - Satélite derecho: Pedir la palabra (Q&A) con estado interactivo (idle / requested / speaking)
 * - Soporte nativo para iOS/Android Safe Area Insets y backdrop-blur
 */
export default function MobileAudioDock({
  currentLanguage = { code: 'es', nativeName: 'Español', flag: '🇪🇸' },
  isPlaying = false,
  isUnlocked = true,
  isMuted = false,
  latency = 14,
  qaState = 'idle', // 'idle' | 'requested' | 'speaking' | 'completed'
  onTogglePlay = () => {},
  onToggleMute = () => {},
  onOpenLanguageSheet = () => {},
  onOpenQA = () => {}
}) {
  const handlePlayClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch (e) {}
    if (!isUnlocked) {
      onTogglePlay();
    } else {
      onToggleMute();
    }
  };

  const handleQAClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch (e) {}
    onOpenQA();
  };

  return (
    <nav 
      aria-label="Controles de audio del oyente"
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3 px-4 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95 backdrop-blur-md border-t border-zinc-200/50 dark:border-zinc-800/50 pointer-events-none"
    >
      <div className="max-w-md mx-auto flex items-center justify-between gap-3 pointer-events-auto">
        
        {/* Satélite Izquierdo: Selector de Idioma / Cabina */}
        <button
          type="button"
          onClick={onOpenLanguageSheet}
          aria-haspopup="dialog"
          className="w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex-shrink-0"
          title="Cambiar idioma de la cabina"
          aria-label={`Idioma actual: ${currentLanguage.nativeName}. Toca para cambiar.`}
        >
          <span className="text-base leading-none">{currentLanguage.flag}</span>
          <span className="text-[10px] font-mono font-bold mt-0.5 leading-none">
            {currentLanguage.code}
          </span>
        </button>

        {/* Centro: Master Audio Button (Hero 56px) */}
        <div className="relative flex items-center justify-center flex-1">
          <button
            type="button"
            onClick={handlePlayClick}
            className={`relative w-full max-w-[220px] h-14 rounded-full font-semibold text-xs tracking-tight flex items-center justify-center gap-2.5 shadow-md transition-all cursor-pointer active:scale-95 touch-manipulation select-none whitespace-nowrap ${
              !isUnlocked
                ? 'bg-amber-400 hover:bg-amber-500 text-zinc-950 font-bold ring-4 ring-amber-400/30 animate-pulse'
                : isMuted
                ? 'bg-zinc-800 hover:bg-zinc-700 text-white shadow-zinc-950/20'
                : 'bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-100 text-white dark:text-zinc-950 shadow-zinc-950/20'
            }`}
            aria-label={!isUnlocked ? 'Sintonizar audio' : isMuted ? 'Activar sonido' : 'Silenciar audio'}
          >
            {!isUnlocked ? (
              <>
                <Volume2 className="w-5 h-5 animate-pulse" />
                <span>Sintonizar audio</span>
              </>
            ) : isMuted ? (
              <>
                <VolumeX className="w-5 h-5 text-rose-400" />
                <span>Silenciado</span>
              </>
            ) : (
              <>
                {/* Waveform Sound Bars */}
                <div className="flex items-center gap-0.5 h-4" aria-hidden="true">
                  {[35, 75, 100, 60, 90, 45].map((h, i) => (
                    <span
                      key={i}
                      className="w-0.5 bg-current rounded-full transition-all duration-150 animate-pulse"
                      style={{
                        height: isPlaying ? `${h}%` : '25%',
                        animationDelay: `${i * 90}ms`,
                        animationDuration: '500ms'
                      }}
                    />
                  ))}
                </div>
                <span>En directo · {currentLanguage.nativeName}</span>
              </>
            )}
          </button>
        </div>

        {/* Satélite Derecho: Pedir la palabra / Q&A */}
        <button
          type="button"
          onClick={handleQAClick}
          className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 ${
            qaState === 'speaking'
              ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse ring-4 ring-emerald-500/30'
              : qaState === 'requested'
              ? 'bg-amber-400 text-zinc-950 border-amber-300 font-bold ring-4 ring-amber-400/30'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
          title="Pedir la palabra / Q&A"
          aria-label="Pedir la palabra al ponente"
        >
          <Hand className={`w-4 h-4 ${qaState === 'requested' ? 'animate-bounce text-zinc-950' : ''}`} />
          <span className="text-[10px] font-mono font-medium mt-0.5 leading-none">
            {qaState === 'speaking' ? 'Hablas' : qaState === 'requested' ? 'Espera' : 'Pedir'}
          </span>
        </button>

      </div>
    </nav>
  );
}
