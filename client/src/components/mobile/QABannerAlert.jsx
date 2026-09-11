import React from 'react';
import { Hand, CheckCircle2, XCircle, Mic } from 'lucide-react';
import Banner from '../shared/Banner.jsx';

/**
 * QABannerAlert — LiftVoice Studio 2026
 * Notificación flotante interactiva para preguntas de la audiencia en vivo (Q&A Backchannel) estilo Reness:
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
        className="fixed top-[calc(3.75rem+env(safe-area-inset-top,0px))] inset-x-3 sm:inset-x-auto sm:right-6 sm:w-96 z-50 animate-slideDown pointer-events-auto"
      >
        <Banner
          icon={<Mic className="w-4 h-4 text-white animate-pulse" strokeWidth={2.4} />}
          color="#10b981"
          title={`${activeQuestion.name || 'Oyente'} está hablando`}
          subtitle={`Canal: ${activeQuestion.nativeLang || 'en'} ➔ es`}
          desc={
            incomingQuestionAudio?.translatedText 
              ? `Traducción al auricular: "${incomingQuestionAudio.translatedText}"` 
              : 'Escuchando en auricular...'
          }
          bottomAction={
            <button
              type="button"
              onClick={() => onCloseQuestion(activeQuestion.questionId)}
              className="w-full min-h-[44px] rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
            >
              <XCircle className="w-4 h-4" />
              <span>Finalizar turno y retomar oratoria</span>
            </button>
          }
        />
      </aside>
    );
  }

  // 2. Estado: Petición de Mano Levantada Pendiente
  if (pendingQuestions.length > 0) {
    const nextQ = pendingQuestions[0];
    return (
      <aside 
        aria-live="polite"
        className="fixed top-[calc(3.75rem+env(safe-area-inset-top,0px))] inset-x-3 sm:inset-x-auto sm:right-6 sm:w-96 z-50 animate-slideDown pointer-events-auto"
      >
        <Banner
          icon={<Hand className="w-4 h-4 text-white" strokeWidth={2.4} />}
          color="#f59e0b"
          title={`${nextQ.name || 'Oyente'} pide la palabra`}
          subtitle={`Idioma: ${nextQ.nativeLang || 'en'}`}
          desc="Ha levantado la mano para intervenir en directo."
          action={
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => onApprove(nextQ.questionId)}
                className="min-h-[44px] min-w-[44px] px-3.5 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                <span>Dar palabra</span>
              </button>
              <button
                type="button"
                onClick={() => onCloseQuestion(nextQ.questionId)}
                className="min-w-[44px] min-h-[44px] rounded-full hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
                title="Descartar solicitud"
                aria-label={`Descartar solicitud de ${nextQ.name || 'oyente'}`}
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          }
        />
      </aside>
    );
  }

  return null;
}
