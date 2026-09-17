import React from 'react';
import { Loader2, Check } from 'lucide-react';

export function DegradadoPie() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-full inset-x-0 h-5 bg-gradient-to-t from-white/95 dark:from-zinc-950/95 to-transparent z-10"
    />
  );
}

export default function AdminStickyFooter({
  onSave,
  onCancel,
  onResetDefaults,
  resetLabel,
  savedMessage,
  isDirty,
  isSaving,
  isSaved,
  isResetting = false,
  variant = 'modal'
}) {
  const isPage = variant === 'page';

  return (
    <footer
      className={`relative z-30 border-t border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md transition-colors duration-150 ${
        isPage
          ? 'sticky bottom-0 w-full py-3.5 sm:py-4 px-4 sm:px-6 lg:px-8 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.4)]'
          : 'flex-shrink-0 px-4 sm:px-6 md:px-8 pt-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
      }`}
    >
      <DegradadoPie />

      <div
        className={
          isPage
            ? 'w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4'
            : 'w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3'
        }
      >
        {/* Left: System Status & Dirty State */}
        <div className="flex items-center gap-2.5 min-w-0">
          {isSaved && (
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400 truncate">
              <Check className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span>{savedMessage || 'Ajustes guardados correctamente'}</span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center justify-end gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
          {onResetDefaults && (
            <button
              type="button"
              onClick={onResetDefaults}
              disabled={isSaving || isResetting}
              title={resetLabel ? `Restablecer ${resetLabel} a los valores recomendados por defecto` : "Restablecer a los valores recomendados por defecto"}
              className="flex-1 sm:flex-initial h-12 sm:h-10 px-4 sm:px-4 rounded-full sm:rounded-2xl border border-zinc-200 dark:border-white/10 bg-transparent dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 hover:border-zinc-300 dark:hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm font-semibold flex items-center justify-center transition-all cursor-pointer active:scale-[0.99] sm:active:scale-95 shadow-2xs shrink-0 whitespace-nowrap"
            >
              {isResetting ? (
                <span>Restableciendo...</span>
              ) : (
                <span>{resetLabel ? `Restablecer ${resetLabel}` : "Restablecer"}</span>
              )}
            </button>
          )}

          {isDirty && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 sm:flex-initial h-12 sm:h-10 px-4 sm:px-4 rounded-full sm:rounded-2xl border border-zinc-200 dark:border-white/10 bg-transparent dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-semibold flex items-center justify-center transition-all cursor-pointer active:scale-[0.99] sm:active:scale-95 shadow-2xs whitespace-nowrap"
            >
              Descartar
            </button>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className={`flex-1 sm:flex-initial h-12 sm:h-10 px-5 sm:px-6 rounded-full sm:rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-xs whitespace-nowrap ${
              isSaved
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : isDirty
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.99] sm:active:scale-98 shadow-sm cursor-pointer'
                : 'bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/80 text-zinc-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 size={15} className="animate-spin text-zinc-400" />
                <span>Guardando...</span>
              </>
            ) : isSaved ? (
              <>
                <Check size={15} className="stroke-[3]" />
                <span>Guardado</span>
              </>
            ) : (
              <span>Guardar cambios</span>
            )}
          </button>
        </div>
      </div>
    </footer>
  );
}

