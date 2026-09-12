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
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') handleClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isSheetOpen]);

  const handlePillClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch (e) {}

    setSheetOpen(true);
  };

  const handleFormSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!questionText.trim()) return;
    onSendQuestion(e);
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
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors shrink-0 -mr-1 mt-0.5"
              aria-label="Cerrar ventana de preguntas"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        }
        footer={
          <div className="w-full">
            {qaState === 'idle' ? (
              <div className="grid grid-cols-2 gap-2.5 w-full">
                <button
                  type="button"
                  onClick={isRecording ? onStopRecord : onStartRecord}
                  className={`h-12 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 border shadow-xs ${
                    isRecording
                      ? 'bg-rose-600 text-white border-transparent animate-pulse'
                      : 'bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-zinc-200/60 dark:border-zinc-700/60'
                  }`}
                  title={isRecording ? 'Detener dictado por voz' : 'Dictar pregunta con tu voz'}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current text-white" />
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
                  className="h-12 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99]"
                >
                  <Hand className="w-4 h-4" />
                  <span>Pedir la Palabra</span>
                </button>
              </div>
            ) : qaState === 'requested' ? (
              <button
                type="button"
                onClick={() => {
                  onCancelRaiseHand();
                  handleClose();
                }}
                className="w-full h-12 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer active:scale-[0.99]"
              >
                <X className="w-4 h-4" />
                <span>Bajar la mano y cancelar turno</span>
              </button>
            ) : qaState === 'speaking' ? (
              <button
                type="button"
                onClick={() => {
                  onCancelRaiseHand();
                  handleClose();
                }}
                className="w-full h-12 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 transition-colors cursor-pointer"
              >
                <span>Finalizar intervención</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="w-full h-12 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                <span>Cerrar</span>
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-3.5 pt-1.5">
          {/* Hand Raised Status Banner */}
          {qaState === 'requested' && (
            <div className="space-y-3">
              <Banner
                icon={<Hand className="w-4 h-4 text-white animate-bounce" strokeWidth={2.4} />}
                color="#f59e0b"
                title="Turno solicitado"
                desc="El ponente ha recibido tu consulta. Se te notificará cuando se te conceda la palabra."
              />
              {questionText && (
                <div className="p-3.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium text-left">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">Tu consulta enviada:</span>
                  &ldquo;{questionText}&rdquo;
                </div>
              )}
            </div>
          )}

          {qaState === 'speaking' && (
            <div className="space-y-3">
              <Banner
                icon={<Mic className="w-4 h-4 text-white animate-pulse" strokeWidth={2.4} />}
                color="#00e5ff"
                title="¡Tienes la palabra!"
                subtitle="Micrófono abierto en directo"
                desc={`Habla en ${langName}. El ponente te escuchará traducido en tiempo real en su auricular.`}
              />
              {questionText && (
                <div className="p-3.5 rounded-2xl border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed font-medium text-left">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 block mb-1">Tu consulta:</span>
                  &ldquo;{questionText}&rdquo;
                </div>
              )}
            </div>
          )}

          {qaState === 'completed' && (
            <Banner
              icon={<CheckCircle2 className="w-4 h-4 text-white" strokeWidth={2.4} />}
              color="#10b981"
              title="Pregunta enviada"
              desc="Tu duda ha sido enviada al ponente en tiempo real."
            />
          )}

          {/* Form Input for Question: Only shown when idle */}
          {qaState === 'idle' && (
            <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-transparent focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-colors shadow-2xs space-y-2 text-left">
              <div className="flex items-center justify-between">
                <label htmlFor="mobile-qa-text" className="text-xs block cursor-pointer transition-colors">
                  {isRecording ? (
                    <span className="text-zinc-800 dark:text-zinc-200 font-medium animate-fadeIn">
                      Escuchando tu voz...
                    </span>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500 font-medium">
                      Escribe o dicta tu consulta
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
                placeholder={isRecording ? `Te escuchamos, habla ahora en ${langName}...` : `Escribe aquí tu consulta o duda en ${langName}...`}
                className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-0 resize-none leading-relaxed"
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
