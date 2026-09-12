import React from 'react';
import { Loader2, Check, Sparkles } from 'lucide-react';

export function DegradadoPie() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-6 inset-x-0 h-6 bg-gradient-to-t from-white dark:from-zinc-950 to-transparent"
    />
  );
}

export default function AdminStickyFooter({ onSave, onCancel, isDirty, isSaving, isSaved }) {
  return (
    <footer className="relative z-20 flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md flex-shrink-0">
      <DegradadoPie />

      {/* Left status badge */}
      <div className="flex items-center gap-2 text-xs">
        {isDirty ? (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Cambios pendientes</span>
          </span>
        ) : isSaved ? (
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <Check size={14} className="stroke-[2.5]" />
            <span>Preferencias guardadas</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400/60 dark:bg-zinc-600" />
            <span>Sin cambios</span>
          </span>
        )}
      </div>

      {/* Right action buttons */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 sm:h-10 px-4 rounded-full text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          Descartar
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className={`h-9 sm:h-10 px-5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
            isSaved
              ? 'bg-emerald-600 text-white'
              : isDirty
              ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-98'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed shadow-none'
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
    </footer>
  );
}
