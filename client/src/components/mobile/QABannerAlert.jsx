import React from 'react';
import { Hand, CheckCircle2, XCircle } from 'lucide-react';

/**
 * QABannerAlert — LiftVoice Studio 2026
 * Notificación flotante interactiva para preguntas de la audiencia en vivo (Q&A Backchannel):
 * - Modo 1: Solicitud de mano levantada con aprobación inmediata de un toque
 * - Modo 2: Intercomunicador bidireccional activo con traducción directa al oído del ponente
 */
export default function QABannerAlert({
  pendingQuestions = [],
  activeQuestion = null,
  incomingQuestionAudio = null,
  onApprove = () => {},
  onCloseQuestion = () => {}
}) {
  // 1. Estado: Oyente Hablando en Vivo (Intercomunicador Bidireccional Activo)
  if (activeQuestion) {
    return (
      <aside 
        aria-live="assertive"
        className="fixed top-[calc(3.75rem+env(safe-area-inset-top,0px))] inset-x-3 sm:inset-x-auto sm:right-6 sm:w-96 z-50 animate-slideDown"
      >
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-emerald-500 shadow-2xl space-y-3 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                {activeQuestion.name || 'Oyente'} está hablando
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold">
              {activeQuestion.nativeLang || 'en'} ➔ es
            </span>
          </div>

          {incomingQuestionAudio && (
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs space-y-1">
              <div className="text-[10px] text-zinc-400 font-mono">Traducción a tu auricular:</div>
              <p className="font-semibold text-zinc-900 dark:text-white leading-snug">
                "{incomingQuestionAudio.translatedText || 'Escuchando en auricular...'}"
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => onCloseQuestion(activeQuestion.questionId)}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            <span>Finalizar turno y retomar oratoria</span>
          </button>
        </div>
      </aside>
    );
  }

  // 2. Estado: Petición de Mano Levantada Pendiente
  if (pendingQuestions.length > 0) {
    const nextQ = pendingQuestions[0];
    return (
      <aside 
        aria-live="polite"
        className="fixed top-[calc(3.75rem+env(safe-area-inset-top,0px))] inset-x-3 sm:inset-x-auto sm:right-6 sm:w-96 z-50 animate-slideDown"
      >
        <div className="p-3.5 rounded-2xl bg-zinc-950 text-white shadow-2xl border border-zinc-800 flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center font-bold text-xs shadow-xs animate-pulse flex-shrink-0">
              <Hand className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{nextQ.name || 'Oyente'}</div>
              <div className="text-[10px] text-zinc-400 font-mono truncate">
                Pide la palabra ({nextQ.nativeLang || 'en'})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => onApprove(nextQ.questionId)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Dar palabra</span>
            </button>
            <button
              type="button"
              onClick={() => onCloseQuestion(nextQ.questionId)}
              className="w-9 h-9 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Descartar solicitud"
              aria-label={`Descartar solicitud de ${nextQ.name || 'oyente'}`}
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return null;
}
