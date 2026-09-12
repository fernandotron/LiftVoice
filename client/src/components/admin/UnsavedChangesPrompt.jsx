import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function UnsavedChangesPrompt({ isOpen, onConfirm, onCancel }) {
  // Manejo de tecla Escape para cancelar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unsaved-prompt-title"
      aria-describedby="unsaved-prompt-desc"
    >
      <div className="relative w-full max-w-[440px] rounded-[32px] bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.5)] p-6 sm:p-8 text-left text-zinc-900 dark:text-zinc-100 overflow-hidden animate-sheet-up sm:animate-fadeIn transition-all">
        {/* Botón de cierre en esquina superior */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cerrar diálogo"
          className="absolute top-5 right-5 w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        {/* Icono vectorial neutro estilo Admin */}
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center text-zinc-900 dark:text-zinc-100 shadow-2xs mb-5">
          <AlertCircle className="w-5 h-5" strokeWidth={2} />
        </div>

        {/* Textos descriptivos */}
        <div className="space-y-2">
          <h3 id="unsaved-prompt-title" className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Cambios sin guardar
          </h3>
          <p id="unsaved-prompt-desc" className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[42ch]">
            Tienes modificaciones pendientes en la configuración. Si sales ahora se perderán todos los ajustes no guardados.
          </p>
        </div>

        {/* Botones de acción integrados sin división artificial */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-7 sm:mt-8">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 px-5 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/70 dark:bg-white/5 hover:bg-zinc-200/70 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-semibold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center order-2 sm:order-1"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 px-5 rounded-2xl bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-xs sm:text-sm shadow-2xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center order-1 sm:order-2"
          >
            Descartar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
