import React from 'react';
import { Loader2, Check } from 'lucide-react';

export default function AdminStickyFooter({ onSave, onCancel, isDirty, isSaving, isSaved }) {
  return (
    <div className="sticky bottom-0 left-0 right-0 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10 flex items-center justify-end gap-3 rounded-b-2xl">
      <div className="absolute top-0 left-0 right-0 h-4 -mt-4 bg-gradient-to-t from-white dark:from-zinc-950 to-transparent pointer-events-none" />
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
      >
        Cancelar
      </button>
      <button
        onClick={onSave}
        disabled={!isDirty || isSaving}
        className={`px-4 py-2 text-sm font-medium text-white rounded-xl flex items-center gap-2 transition-all shadow-sm ${
          isSaved
            ? 'bg-emerald-500 hover:bg-emerald-600'
            : isDirty
            ? 'bg-indigo-600 hover:bg-indigo-700'
            : 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
        }`}
      >
        {isSaving ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Guardando...
          </>
        ) : isSaved ? (
          <>
            <Check size={16} className="stroke-[3]" />
            Guardado
          </>
        ) : (
          'Guardar Preferencias'
        )}
      </button>
    </div>
  );
}
