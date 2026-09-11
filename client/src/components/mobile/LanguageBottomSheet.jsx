import React, { useEffect } from 'react';
import { X, Check, Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../LanguageSelector.jsx';

export default function LanguageBottomSheet({
  isOpen = false,
  onClose = () => {},
  selectedLanguage = 'es',
  onSelectLanguage = () => {},
  languageBreakdown = {}
}) {
  // Prevent background body scroll when sheet is open and handle Escape key
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (code) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch (e) {}
    onSelectLanguage(code);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-backdrop-in sm:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-sheet-title"
    >
      {/* Backdrop Tap to Close */}
      <div 
        className="flex-1 cursor-pointer" 
        onClick={onClose}
        aria-label="Cerrar panel de idiomas" 
      />

      {/* Sheet Container */}
      <div className="relative w-full rounded-t-3xl bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 shadow-2xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] space-y-4 animate-sheet-up text-left">
        
        {/* iOS Drag Handle */}
        <div className="sheet-pull-handle my-0" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
            <h3 id="lang-sheet-title" className="font-bold text-sm text-zinc-900 dark:text-white tracking-tight">
              Cabina de Idioma &bull; Voz Neuronal
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Cerrar panel de idiomas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language Options: Ergonomic Touch Cards */}
        <div className="space-y-2 pt-1 max-h-[60vh] overflow-y-auto">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            const count = languageBreakdown[lang.code] || 0;

            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-98 cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-1 ring-white/15'
                    : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100'
                }`}
                aria-pressed={isSelected}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl flex-shrink-0">{lang.flag}</span>
                  <div className="text-left min-w-0">
                    <div className="font-semibold text-xs flex items-center gap-1.5 truncate">
                      <span className="truncate">{lang.nativeName}</span>
                      <span className={`text-[10px] font-mono flex-shrink-0 ${isSelected ? 'text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        ({lang.code})
                      </span>
                    </div>
                    <div className={`text-[10px] font-mono truncate ${isSelected ? 'text-zinc-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                      {lang.voice} &bull; {lang.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200/70 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                  }`}>
                    {count} {count === 1 ? 'oyente' : 'oyentes'}
                  </span>
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-white text-zinc-900 flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center font-mono pt-1">
          ⚡ Sintonización instantánea con resíntesis Web Audio
        </p>

      </div>
    </div>
  );
}
