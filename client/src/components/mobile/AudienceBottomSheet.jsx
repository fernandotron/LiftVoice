import React from 'react';
import { X } from 'lucide-react';
import Modal from '../shared/Modal.jsx';
import CountryFlag from '../shared/CountryFlag.jsx';
import { SUPPORTED_LANGUAGES } from '../LanguageSelector.jsx';
import { useI18n } from '../../contexts/I18nContext.jsx';

/**
 * AudienceBottomSheet — LiftVoice 2026
 * Hoja inferior táctil para ver la audiencia y las cabinas de traducción en directo,
 * con la misma arquitectura visual unificada de MobileQAPill (Modal variant="sheet").
 */
export default function AudienceBottomSheet({
  isOpen = false,
  onClose = () => {},
  roomTitle = 'Conferencia Principal',
  roomId = '',
  effectiveAttendeesCount = 1,
  languageBreakdown = {},
  activeLangCode = 'es',
  onSelectLanguage = () => {},
  profileName = 'Oyente',
  latency = 0
}) {
  const { t } = useI18n();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      showHandle={false}
      titleId="audience-sheet-title"
      header={
        <div className="flex items-start justify-between gap-3 text-left">
          <div className="space-y-1 min-w-0">
            <h2
              id="audience-sheet-title"
              className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight"
            >
              {t('audienceBottomSheet.title')}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed pt-0.5">
              {effectiveAttendeesCount === 1
                ? (t('common.peopleConnected_one') || '1 persona conectada a la sesión en tiempo real.')
                : (t('common.peopleConnected_other', { count: effectiveAttendeesCount }) || `${effectiveAttendeesCount} personas conectadas a la sesión en tiempo real.`)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95 touch-manipulation shrink-0"
            aria-label={t('audienceBottomSheet.closeAria')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-3 pt-1">
        {/* Grupo unificado de cabinas de idiomas */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 overflow-hidden divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const count = languageBreakdown[lang.code] || (lang.code === activeLangCode ? 1 : 0);
            const isUserLang = lang.code === activeLangCode;
            const listenerLabel = count === 1 
              ? (t('common.listeners_one') || 'oyente') 
              : (t('common.listeners_other') || 'oyentes');

            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  try {
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                      navigator.vibrate(15);
                    }
                  } catch (e) {}
                  onSelectLanguage(lang.code);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors cursor-pointer text-left select-none active:scale-[0.99] ${
                  isUserLang ? 'bg-zinc-100/70 dark:bg-zinc-800/60 font-medium' : 'hover:bg-zinc-100/40 dark:hover:bg-zinc-800/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CountryFlag code={lang.code} className="w-5 h-5 shrink-0" title={lang.nativeName} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs truncate ${
                          isUserLang ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {lang.nativeName}
                      </span>
                      {isUserLang && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium shrink-0">
                          {t('audienceBottomSheet.yourChannel')}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block truncate">
                      {lang.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 font-mono ml-2">
                  <span
                    className={`text-xs ${
                      count > 0 ? 'text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-400 dark:text-zinc-600'
                    }`}
                  >
                    {count}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans">
                    {listenerLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Pie integrado: Perfil del oyente y código de sala */}
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[11px] font-bold text-zinc-700 dark:text-zinc-200 uppercase shrink-0">
              {(profileName || t('common.defaultAttendeeName') || 'Oyente').charAt(0)}
            </div>
            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
              {profileName || t('common.defaultAttendeeName') || 'Oyente'}
            </span>
          </div>

          {roomId && (
            <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-500">
              <span className="text-[10px] font-sans">{t('common.room')}</span>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">{roomId}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
