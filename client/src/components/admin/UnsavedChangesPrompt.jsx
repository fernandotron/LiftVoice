import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * UnsavedChangesPrompt — LiftVoice Shell 2026
 * Diálogo de confirmación adaptativo:
 * - En móvil (<640px): Bottom Sheet ergonómico deslizable desde el fondo con pb-safe.
 * - En desktop (>=640px): Modal centrado con bordes redondeados y proporciones elegantes.
 * - Sigue el sistema de diseño canónico de LiftVoice: cabecera sin icono con botón circular X,
 *   y botones de acción 'rounded-full'.
 */
export default function UnsavedChangesPrompt({ isOpen, onConfirm, onCancel }) {
  // Manejo de tecla Escape y bloqueo de scroll en body
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/40 backdrop-blur-[3px] animate-backdrop-in sm:items-center sm:justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unsaved-prompt-title"
      aria-describedby="unsaved-prompt-desc"
    >
      {/* Backdrop Tap to Close */}
      <div
        className="flex-1 w-full cursor-pointer"
        onClick={onCancel}
        aria-label="Cerrar diálogo de cambios sin guardar"
      />

      {/* Sheet / Modal Container acorde al estándar canónico de LiftVoice */}
      <div className="relative w-full sm:max-w-md rounded-[28px] bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl overflow-hidden animate-sheet-up flex flex-col text-left transition-colors">
        {/* Header Ergonómico idéntico a CabinsBottomSheet y StudioSettingsBottomSheet (sin icono, título limpio y botón circular) */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 id="unsaved-prompt-title" className="font-bold text-sm text-zinc-900 dark:text-white">
              Cambios sin guardar
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Ajustes pendientes de confirmación
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar diálogo de cambios sin guardar"
            className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95 touch-manipulation flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido y Botones full rounded */}
        <div className="p-5 pt-2 space-y-4">
          <p id="unsaved-prompt-desc" className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Tienes modificaciones pendientes en la configuración. Si sales ahora se perderán todos los ajustes no guardados.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 px-5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center shadow-2xs active:scale-95"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="h-11 px-5 rounded-full bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-xs sm:text-sm shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center justify-center"
            >
              Descartar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
