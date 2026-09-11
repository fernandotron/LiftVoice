import React from 'react';
import { X, Check } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../LanguageSelector.jsx';
import Modal from '../shared/Modal.jsx';
import CountryFlag from '../shared/CountryFlag.jsx';

/**
 * LanguageBottomSheet — LiftVoice 2026 (Estilo Reness)
 * Selector de cabina/idioma con diseño flotante de bordes redondeados (28px),
 * espaciado limpio sin líneas divisorias, banderas emoji vectoriales nítidas
 * y permanencia abierta hasta confirmar con 'Entendido' o cerrar con 'X'.
 */
export default function LanguageBottomSheet({
  isOpen = false,
  onClose = () => {},
  selectedLanguage = 'es',
  onSelectLanguage = () => {},
  languageBreakdown = {}
}) {
  const handleSelect = (code) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch (e) {}
    onSelectLanguage(code);
    // Permanece abierto para que el usuario confirme con 'Entendido' o cierre con la 'X'
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet"
      showHandle={false}
      titleId="lang-sheet-title"
      header={
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="lang-sheet-title" className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white tracking-tight">
              Idioma de traducción
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Audio y subtítulos sincronizados en directo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors shrink-0"
            aria-label="Cerrar panel de idiomas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      }
      footer={
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-sm transition-all shadow-sm active:scale-[0.99] cursor-pointer"
          >
            Entendido
          </button>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center font-medium">
            Sintonización instantánea con Web Audio
          </p>
        </div>
      }
    >
      <div className="space-y-2.5 pt-2 max-h-[50vh] overflow-y-auto no-scrollbar">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isSelected = selectedLanguage === lang.code;
          const count = languageBreakdown[lang.code] || 0;

          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-[0.99] cursor-pointer ${
                isSelected
                  ? 'bg-zinc-100/90 dark:bg-zinc-800/90 border-zinc-400/80 dark:border-zinc-600 ring-1 ring-zinc-400/40 dark:ring-zinc-600/40 shadow-xs'
                  : 'bg-zinc-50/50 dark:bg-zinc-800/30 border-zinc-200/70 dark:border-zinc-800/80 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60'
              }`}
              aria-pressed={isSelected}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <CountryFlag code={lang.code} className="w-7 h-7 shrink-0" title={lang.nativeName} />
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      {lang.nativeName}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 truncate text-zinc-500 dark:text-zinc-400">
                    {lang.name} {count > 0 ? `· ${count} ${count === 1 ? 'oyente' : 'oyentes'}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center shrink-0 ml-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs'
                      : 'border-2 border-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
