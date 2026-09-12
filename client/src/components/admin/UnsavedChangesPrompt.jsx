import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function UnsavedChangesPrompt({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                Cambios sin guardar
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Tienes cambios pendientes. Si sales ahora, se perderán. ¿Estás seguro de que quieres descartarlos?
              </p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Volver
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-2xl transition-colors cursor-pointer"
          >
            Descartar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
