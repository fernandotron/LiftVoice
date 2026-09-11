import React, { useState, useEffect } from 'react';
import { Hand, Mic, MicOff, Send, X, CheckCircle2, Square } from 'lucide-react';
import Modal from '../shared/Modal.jsx';
import Banner from '../shared/Banner.jsx';

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

  const langName = typeof currentLanguage === 'object'
    ? (currentLanguage.nativeName || currentLanguage.name || 'tu idioma')
    : currentLanguage;

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
                ? 'bg-zinc-900 text-white font-bold ring-2 ring-amber-400/40 border border-amber-400/80'
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

      {/* Q&A Interactive Bottom Sheet con diseño unificado estilo PostLeaveView */}
      <Modal
        isOpen={isSheetOpen}
        onClose={handleClose}
        variant="sheet"
        showHandle={false}
        titleId="qa-sheet-title"
        header={
          <div className="flex items-start justify-between gap-3 text-left">
            <div className="space-y-1 min-w-0">
              <div className="mb-1.5">
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  {qaState === 'speaking'
                    ? 'Turno concedido'
                    : qaState === 'requested'
                    ? 'Turno de preguntas'
                    : 'Preguntas y respuestas'}
                </span>
              </div>
              <h2 id="qa-sheet-title" className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
                Preguntar al ponente
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed pt-0.5">
                {qaState === 'speaking'
                  ? `Habla en ${langName}. El ponente te escuchará traducido en tiempo real.`
                  : 'Envía tu duda por escrito o solicita la palabra para intervenir en directo.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors shrink-0 -mr-1 mt-0.5"
              aria-label="Cerrar ventana de preguntas"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        }
        footer={
          <div className="w-full">
            <div className="grid grid-cols-2 gap-2.5 w-full">
              <button
                type="button"
                onClick={isRecording ? onStopRecord : onStartRecord}
                className="h-12 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 border bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-zinc-200/60 dark:border-zinc-700/60 shadow-xs"
                title={isRecording ? 'Detener dictado' : 'Dictar pregunta con tu voz'}
              >
                {isRecording ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current text-zinc-700 dark:text-zinc-300" />
                    <span>Detener</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                    <span>Dictar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleFormSubmit}
                disabled={!questionText.trim()}
                className="h-12 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99]"
              >
                <Send className="w-4 h-4" />
                <span>Enviar</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3.5 pt-1.5">
          {/* Hand Raised Status Banner (Diseño Reness con acción inferior y texto fluido) */}
          {qaState === 'requested' && (
            <Banner
              icon={<Hand className="w-4 h-4 text-white" strokeWidth={2.4} />}
              color="#f59e0b"
              title="Turno solicitado"
              desc="Cuando el orador te dé paso se activará tu micrófono para intervenir en directo."
              bottomAction={
                <button
                  type="button"
                  onClick={() => {
                    onCancelRaiseHand();
                    handleClose();
                  }}
                  className="w-full h-8.5 rounded-full bg-zinc-200/60 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 text-xs font-semibold border border-zinc-300/50 dark:border-zinc-700/60 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.99]"
                >
                  <X className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                  <span>Bajar la mano y cancelar turno</span>
                </button>
              }
            />
          )}

          {qaState === 'speaking' && (
            <Banner
              icon={<Mic className="w-4 h-4 text-white animate-pulse" strokeWidth={2.4} />}
              color="#00e5ff"
              title="¡Tienes la palabra!"
              subtitle="Micrófono abierto en directo"
              desc={`Habla en ${langName}. El ponente te escuchará traducido en tiempo real en su auricular.`}
            />
          )}

          {qaState === 'completed' && (
            <Banner
              icon={<CheckCircle2 className="w-4 h-4 text-white" strokeWidth={2.4} />}
              color="#10b981"
              title="Pregunta enviada"
              desc="Tu duda ha sido enviada al ponente en tiempo real."
            />
          )}

          {/* If idle: Option to raise hand directly inside the sheet */}
          {qaState === 'idle' && (
            <button
              type="button"
              onClick={() => onRaiseHand()}
              className="w-full text-left cursor-pointer group transition-transform active:scale-[0.99]"
            >
              <Banner
                icon={<Hand className="w-4 h-4 text-white" strokeWidth={2.4} />}
                color="#3b82f6"
                title="Levantar la mano"
                subtitle="Intervención en directo"
                desc="Solicita turno para hablar con el ponente en tiempo real."
                action={
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 group-hover:translate-x-0.5 transition-all">
                    Pedir →
                  </span>
                }
              />
            </button>
          )}

          {/* Form Input for Question (Diseño 100% neutro, feedback dinámico en cabecera) */}
          <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-colors shadow-2xs space-y-2 text-left">
            <div className="flex items-center justify-between">
              <label htmlFor="mobile-qa-text" className="text-xs block cursor-pointer transition-colors">
                {isRecording ? (
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium animate-fadeIn">
                    Escuchando tu voz...
                  </span>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500 font-medium">
                    Escribe o dicta tu duda
                  </span>
                )}
              </label>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
                {langName}
              </span>
            </div>
            <textarea
              id="mobile-qa-text"
              rows={3}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={isRecording ? `Te escuchamos, habla ahora en ${langName}...` : `Habla o escribe tu pregunta en ${langName}...`}
              className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-0 resize-none leading-relaxed"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
