import React, { useState, useEffect } from 'react';
import { Hand, Mic, MicOff, Send, X, CheckCircle2, Square } from 'lucide-react';
import Modal from '../shared/Modal.jsx';
import Banner from '../shared/Banner.jsx';
import { useI18n } from '../../contexts/I18nContext.jsx';

export default function MobileQAPill({
  qaState = 'idle', // 'idle' | 'requested' | 'speaking' | 'completed'
  isQAEnabled = false,
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
  const { t } = useI18n();
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
                ? t('mobileQAPill.floatingButton.speakingAria')
                : qaState === 'requested'
                ? t('mobileQAPill.floatingButton.requestedAria')
                : t('mobileQAPill.floatingButton.defaultAria')
            }
          >
            <Hand className={`w-4 h-4 ${qaState === 'requested' ? 'animate-bounce text-zinc-950' : 'text-amber-400'}`} />
            <span className="text-[11px] font-medium">
              {qaState === 'speaking'
                ? t('mobileQAPill.floatingButton.speakingText')
                : qaState === 'requested'
                ? t('mobileQAPill.floatingButton.requestedText')
                : t('mobileQAPill.floatingButton.defaultText')}
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
              <h2 id="qa-sheet-title" className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
                {t('mobileQAPill.modal.title')}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed pt-0.5">
                {qaState === 'speaking'
                  ? t('mobileQAPill.modal.speakingSubtitle', { language: langName })
                  : (!isQAEnabled && qaState === 'idle')
                  ? t('listenerView.assistant.qa.disabledNotice', 'El ponente no ha habilitado todavía la opción de preguntas')
                  : t('mobileQAPill.modal.defaultSubtitle')}
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95 touch-manipulation shrink-0"
              aria-label={t('mobileQAPill.modal.closeAria')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        }
        footer={
          (!isQAEnabled && qaState === 'idle') ? null : (
            <div className="w-full">
              {qaState === 'idle' ? (
                <div className="w-full">
                  <button
                    type="button"
                    onClick={handleFormSubmit}
                    disabled={!questionText.trim()}
                    className="w-full h-12 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99]"
                  >
                    <Hand className="w-4 h-4" />
                    <span>{t('mobileQAPill.modal.raiseHandButton')}</span>
                  </button>
                </div>
              ) : qaState === 'requested' ? (
              <button
                type="button"
                onClick={() => {
                  onCancelRaiseHand();
                  handleClose();
                }}
                className="w-full h-12 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer active:scale-[0.99]"
              >
                <X className="w-4 h-4" />
                <span>{t('mobileQAPill.modal.cancelTurnButton')}</span>
              </button>
            ) : qaState === 'speaking' ? (
              <button
                type="button"
                onClick={() => {
                  onCancelRaiseHand();
                  handleClose();
                }}
                className="w-full h-12 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 transition-colors cursor-pointer"
              >
                <span>{t('mobileQAPill.modal.finishButton')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="w-full h-12 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                <span>{t('common.close')}</span>
              </button>
            )}
          </div>
        )}
      >
        <div className="space-y-3.5 pt-1.5">
          {/* Hand Raised Status Banner */}
          {qaState === 'requested' && (
            <div className="space-y-3">
              <Banner
                icon={<Hand className="w-4 h-4 text-white animate-bounce" strokeWidth={2.4} />}
                color="#f59e0b"
                title={t('listenerView.assistant.qa.requestedBanner.title')}
                desc={t('listenerView.assistant.qa.requestedBanner.desc')}
              />
              {questionText && (
                <div className="p-3.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium text-left">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
                    {t('listenerView.assistant.qa.yourSentQuery')}
                  </span>
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
                title={t('listenerView.assistant.qa.speakingBanner.title')}
                subtitle={t('mobileQAPill.modal.speakingBannerSubtitle')}
                desc={t('mobileQAPill.modal.speakingBannerDesc', { language: langName })}
              />
              {questionText && (
                <div className="p-3.5 rounded-2xl border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed font-medium text-left">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 block mb-1">
                    {t('listenerView.assistant.qa.yourQuery')}
                  </span>
                  &ldquo;{questionText}&rdquo;
                </div>
              )}
            </div>
          )}

          {qaState === 'completed' && (
            <Banner
              icon={<CheckCircle2 className="w-4 h-4 text-white" strokeWidth={2.4} />}
              color="#10b981"
              title={t('mobileQAPill.modal.completedTitle')}
              desc={t('mobileQAPill.modal.completedDesc')}
            />
          )}

          {/* Form Input for Question: Only shown when idle */}
          {qaState === 'idle' && (
            !isQAEnabled ? (
              <div
                role="status"
                aria-live="polite"
                className="p-5 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-center space-y-3 animate-fadeIn"
              >
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-400 dark:text-zinc-500">
                  <Hand className="w-5 h-5 opacity-40" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {t('listenerView.assistant.qa.disabledTitle', 'Preguntas no habilitadas')}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
                    {t('listenerView.assistant.qa.disabledNotice', 'El ponente no ha habilitado todavía la opción de preguntas')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-transparent focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-colors shadow-2xs text-left">
                <textarea
                  id="mobile-qa-text"
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder={t('mobileQAPill.modal.placeholder')}
                  aria-label={t('mobileQAPill.modal.placeholder', 'Escribe tu pregunta...')}
                  className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-0 resize-none leading-relaxed"
                />
              </div>
            )
          )}
        </div>
      </Modal>
    </>
  );
}
