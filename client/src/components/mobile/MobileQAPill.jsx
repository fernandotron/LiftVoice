import React, { useState, useEffect } from 'react';
import { Hand, Mic, MicOff, Send, X, CheckCircle2 } from 'lucide-react';

export default function MobileQAPill({
  qaState = 'idle', // 'idle' | 'requested' | 'speaking' | 'completed'
  currentLanguage = { nativeName: 'Español', code: 'es' },
  questionText = '',
  setQuestionText = () => {},
  isRecording = false,
  onRaiseHand = () => {},
  onCancelRaiseHand = () => {},
  onStartRecord = () => {},
  onStopRecord = () => {},
  onSendQuestion = () => {},
  isOpen = undefined,
  onClose = () => {},
  showFloatingButton = false
}) {
  const [internalSheetOpen, setInternalSheetOpen] = useState(false);
  const isSheetOpen = isOpen !== undefined ? isOpen : internalSheetOpen;

  const setSheetOpen = (val) => {
    if (isOpen !== undefined) {
      if (!val) onClose();
    } else {
      setInternalSheetOpen(val);
    }
  };

  const handleClose = () => {
    setSheetOpen(false);
  };

  useEffect(() => {
    if (qaState === 'speaking') {
      setSheetOpen(true);
    }
  }, [qaState]);

  useEffect(() => {
    if (isSheetOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') handleClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isSheetOpen]);

  const handlePillClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch (e) {}

    if (qaState === 'idle') {
      onRaiseHand();
    }
    setSheetOpen(true);
  };

  const handleFormSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!questionText.trim()) return;
    onSendQuestion(e);
    handleClose();
  };

  // Swipe down to dismiss gesture on mobile
  const [touchStartY, setTouchStartY] = useState(null);

  const handleTouchStart = (e) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e) => {
    if (touchStartY !== null) {
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      if (deltaY > 50) {
        handleClose();
      }
      setTouchStartY(null);
    }
  };

  return (
    <>
      {/* Floating Pill: Solo visible si showFloatingButton está activo */}
      {showFloatingButton && (
        <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] right-3.5 z-40 sm:hidden pointer-events-auto">
        <button
          type="button"
          onClick={handlePillClick}
          className={`flex items-center gap-1.5 h-11 px-3.5 rounded-full shadow-xl transition-all active:scale-95 cursor-pointer text-xs font-semibold backdrop-blur-md ${
            qaState === 'speaking'
              ? 'bg-emerald-600 text-white animate-pulse ring-4 ring-emerald-500/25'
              : qaState === 'requested'
              ? 'bg-amber-400 text-zinc-950 font-bold ring-4 ring-amber-400/30'
              : 'bg-zinc-900/90 hover:bg-zinc-900 text-white border border-white/15'
          }`}
          aria-label={
            qaState === 'speaking'
              ? 'Tu turno de hablar activo. Toca para abrir micrófono.'
              : qaState === 'requested'
              ? 'Mano levantada enviada. Toca para ver estado.'
              : 'Preguntar al ponente en vivo'
          }
        >
          <Hand className={`w-4 h-4 ${qaState === 'requested' ? 'animate-bounce text-zinc-950' : 'text-amber-400'}`} />
          <span className="text-[11px] font-medium">
            {qaState === 'speaking'
              ? '¡Tu turno!'
              : qaState === 'requested'
              ? 'Mano enviada'
              : 'Preguntar'}
          </span>
        </button>
      </div>
      )}

      {/* Q&A Interactive Bottom Sheet */}
      {isSheetOpen && (
        <div 
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-backdrop-in sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qa-sheet-title"
        >
          {/* Backdrop Tap to Close */}
          <div 
            className="flex-1 cursor-pointer" 
            onClick={handleClose}
            aria-label="Cerrar panel de preguntas" 
          />

          <div 
            className="relative w-full rounded-t-3xl bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 shadow-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] space-y-4 animate-sheet-up text-left"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            
            {/* Pull Handle (Tap or swipe down to close) */}
            <div 
              onClick={handleClose} 
              className="py-1 -mt-2 -mb-1 flex justify-center cursor-pointer"
              title="Toca o desliza hacia abajo para cerrar"
            >
              <div className="sheet-pull-handle my-0" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hand className="w-4 h-4 text-zinc-900 dark:text-white" />
                <h3 id="qa-sheet-title" className="font-bold text-sm text-zinc-900 dark:text-white">
                  Preguntar al Ponente (Q&A en Vivo)
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Cerrar ventana de preguntas"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hand Raised Status Banner */}
            {qaState === 'requested' && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 text-center">
                <p className="text-xs font-medium">
                  ✋ Tu turno ha sido solicitado. Cuando el orador te dé paso se activará el audio.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onCancelRaiseHand();
                    handleClose();
                  }}
                  className="px-3.5 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs"
                >
                  Bajar la mano / Cancelar
                </button>
              </div>
            )}

            {qaState === 'speaking' && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>¡Tienes la palabra! Micrófono abierto</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-tight">
                  Habla en tu idioma ({currentLanguage.nativeName}). El ponente te escuchará traducido en tiempo real en su auricular.
                </p>
              </div>
            )}

            {qaState === 'completed' && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs font-semibold">¡Pregunta enviada al ponente!</span>
              </div>
            )}

            {/* Form Input for Question */}
            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="mobile-qa-text" className="block text-[11px] font-mono text-zinc-500">
                  Escribe o dicta tu duda
                </label>
                <textarea
                  id="mobile-qa-text"
                  rows={2}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder={`Habla o escribe tu pregunta en ${currentLanguage.nativeName}...`}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-3 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors shadow-2xs resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isRecording ? onStopRecord : onStartRecord}
                  className={`h-10 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isRecording
                      ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                      : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200/80'
                  }`}
                >
                  {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isRecording ? 'Detener' : 'Dictar'}</span>
                </button>

                <button
                  type="submit"
                  disabled={!questionText.trim()}
                  className="flex-1 h-10 px-4 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 disabled:opacity-40 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-98"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar al Ponente</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </>
  );
}
