import React, { useEffect } from 'react';
import { X, Hand, Mic, CheckCircle2, XCircle } from 'lucide-react';
import Banner from '../shared/Banner.jsx';

/**
 * QABottomSheet — LiftVoice Studio 2026
 * Panel deslizable exclusivo para la gestión táctil de preguntas y turnos de palabra en móvil:
 * - Tarjeta del oyente activo en locución en vivo con transcripción traducida
 * - Cola interactiva de preguntas pendientes (dar la palabra / descartar)
 * - Estado vacío amigable e informativo
 * - Botón de cierre ergonómico circular de 44px
 * - Soporte seguro para iOS Safe Area Insets
 */
export default function QABottomSheet({
  isOpen = false,
  onClose = () => {},
  qaQueue = [],
  activeQuestion = null,
  incomingQuestionAudio = null,
  onApproveQuestion = () => {},
  onCloseQuestion = () => {}
}) {
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pendingQuestions = qaQueue.filter(q => q.status === 'pending');

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-[3px] animate-backdrop-in sm:items-center sm:justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qa-sheet-title"
    >
      {/* Backdrop Tap to Close */}
      <div
        className="flex-1 w-full cursor-pointer"
        onClick={onClose}
        aria-label="Cerrar panel de preguntas"
      />

      {/* Sheet Container */}
      <div className="relative w-full sm:max-w-md rounded-[28px] bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl overflow-hidden animate-sheet-up flex flex-col max-h-[88dvh]">
        {/* Header ergonómico */}
        <div className="px-5 pt-4 pb-2.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div>
              <div className="flex items-center gap-2">
                <h3 id="qa-sheet-title" className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                  Turnos de Pregunta (Q&A)
                </h3>
                {pendingQuestions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-xs font-bold shrink-0">
                    {pendingQuestions.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                Intervenciones y preguntas de oyentes en vivo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de preguntas"
            className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95 touch-manipulation flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido Scrolleable */}
        <div className="p-5 space-y-4 overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] no-scrollbar">
          
          {/* Oyente Activo en Directo */}
          {activeQuestion && (
            <Banner
              icon={<Mic className="w-4 h-4 text-white animate-pulse" strokeWidth={2.4} />}
              color="#10b981"
              title={`${activeQuestion.name || 'Oyente'} está hablando`}
              subtitle={`Canal nativo: ${activeQuestion.nativeLang || 'en'} ➔ traducción a tu auricular`}
              desc={
                incomingQuestionAudio?.translatedText
                  ? `Traducción en vivo: "${incomingQuestionAudio.translatedText}"`
                  : 'Escuchando intervención en tu auricular...'
              }
              bottomAction={
                <button
                  type="button"
                  onClick={() => onCloseQuestion(activeQuestion.questionId)}
                  className="w-full h-10 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-98 touch-manipulation"
                >
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span>Finalizar Turno de Pregunta</span>
                </button>
              }
            />
          )}

          {/* Cola de Preguntas Pendientes */}
          <div className="space-y-2.5">
            {pendingQuestions.length === 0 ? (
              <div className="py-8 px-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-2 bg-zinc-50/50 dark:bg-zinc-900/30">
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-850 flex items-center justify-center mx-auto text-zinc-400 dark:text-zinc-500">
                  <Hand className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    No hay preguntas pendientes
                  </p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-relaxed max-w-xs mx-auto">
                    Los oyentes pueden pulsar &ldquo;Pedir la palabra&rdquo; desde sus móviles para intervenir en su idioma.
                  </p>
                </div>
              </div>
            ) : (
              pendingQuestions.map((q) => {
                const initials = (q.name ? q.name.slice(0, 2) : 'OY').toUpperCase();
                return (
                  <div
                    key={q.questionId}
                    className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 shadow-2xs space-y-3 flex flex-col"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-800 dark:text-zinc-200 shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {q.name || 'Oyente'}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                            Idioma nativo: {q.nativeLang || 'es'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex-shrink-0 font-medium">
                        En espera
                      </span>
                    </div>

                    {q.questionText && (
                      <div className="p-3 rounded-xl bg-white dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800/80 text-xs text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed italic">
                        &ldquo;{q.questionText}&rdquo;
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onApproveQuestion(q.questionId)}
                        disabled={!!activeQuestion}
                        className="flex-1 h-9 rounded-full bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 text-white dark:text-zinc-950 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95 touch-manipulation"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-600" />
                        <span>Dar la palabra</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onCloseQuestion(q.questionId)}
                        className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer flex items-center justify-center active:scale-95 touch-manipulation"
                        title="Descartar pregunta"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
