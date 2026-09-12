import React from 'react';
import { Loader2, Check } from 'lucide-react';

export function DegradadoPie() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-full inset-x-0 h-4 bg-gradient-to-t from-white dark:from-zinc-950 to-transparent z-10"
    />
  );
}

export default function AdminStickyFooter({ onSave, onCancel, isDirty, isSaving, isSaved }) {
  return (
    <footer className="relative z-20 flex items-center justify-between gap-4 px-6 py-3.5 border-t border-zinc-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md flex-shrink-0">
      <DegradadoPie />

      {/* Left status indicator */}
      <div className="flex items-center gap-2 text-xs sm:text-sm">
        {isDirty ? (
          <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Cambios pendientes</span>
          </span>
        ) : isSaved ? (
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <Check size={16} className="stroke-[2.5]" />
            <span>Preferencias guardadas</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <span>Sin cambios</span>
          </span>
        )}
      </div>

      {/* Right action buttons: pill buttons h-11 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 px-5 rounded-full text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          Descartar
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className={`h-11 px-6 rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
            isSaved
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : isDirty
              ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-98 shadow-sm'
              : 'bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin text-zinc-400" />
              <span>Guardando...</span>
            </>
          ) : isSaved ? (
            <>
              <Check size={16} className="stroke-[3]" />
              <span>Guardado</span>
            </>
          ) : (
            <span>Guardar cambios</span>
          )}
        </button>
      </div>
    </footer>
  );
}

