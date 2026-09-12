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
  isDirty,
  isSaving,
  isSaved,
  variant = 'modal'
}) {
  const isPage = variant === 'page';

  return (
    <footer
      className={`relative z-30 border-t border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md transition-colors duration-150 ${
        isPage
          ? 'sticky bottom-0 w-full py-3.5 sm:py-4 px-4 sm:px-6 lg:px-8 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.4)]'
          : 'flex-shrink-0 px-6 sm:px-8 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
      }`}
    >
      <DegradadoPie />

      <div
        className={
          isPage
            ? 'w-full max-w-7xl mx-auto flex items-center justify-between gap-4'
            : 'w-full flex items-center justify-between gap-3'
        }
      >
        {/* Left: System Status & Dirty State */}
        <div className="flex items-center gap-2.5 min-w-0">
          {isDirty ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400 truncate">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span>Modificaciones sin guardar</span>
              {isPage && (
                <>
                  <span className="hidden md:inline text-zinc-300 dark:text-zinc-700 select-none">•</span>
                  <span className="hidden md:inline text-xs text-zinc-500 dark:text-zinc-400 font-normal">
                    Aplica los cambios para sincronizarlos en vivo
                  </span>
                </>
              )}
            </div>
          ) : isSaved ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400 truncate">
              <Check className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span>Ajustes guardados correctamente</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-medium text-zinc-700 dark:text-zinc-300">LiftVoice Studio</span>
              <span className="text-zinc-300 dark:text-zinc-700 select-none hidden sm:inline">•</span>
              <span className="hidden sm:inline">Configuración sincronizada</span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {isDirty && (
            <button
              type="button"
              onClick={onCancel}
              className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/70 dark:bg-white/5 hover:bg-zinc-200/70 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-medium transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              Descartar
            </button>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className={`h-9 sm:h-10 px-5 sm:px-6 rounded-2xl text-xs sm:text-sm font-medium flex items-center gap-2 transition-all shadow-xs ${
              isSaved
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : isDirty
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-98 shadow-sm cursor-pointer'
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

