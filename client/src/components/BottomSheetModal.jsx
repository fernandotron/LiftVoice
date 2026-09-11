import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * BottomSheetModal — LiftVoice Shell 2026
 * En móvil (<640px): Se desliza desde el fondo con pull handle táctil y pb-safe.
 * En desktop (>=640px): Se renderiza como un modal flotante centrado con bordes suaves.
 */
export default function BottomSheetModal({
  isOpen = false,
  onClose = () => {},
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  footerContent,
  maxWidth = 'max-w-3xl',
  className = '',
  hideHeader = false
}) {
  const sheetRef = useRef(null);

  // Prevenir scroll en body al estar abierto y soportar tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-4 md:p-6 bg-black/40 backdrop-blur-[3px] animate-backdrop-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-modal-title"
    >
      <div 
        ref={sheetRef}
        className={`w-full ${maxWidth} bg-white dark:bg-zinc-900 rounded-[28px] border border-zinc-200/80 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[88dvh] sm:max-h-[90vh] overflow-hidden text-left animate-sheet-up sm:animate-fadeIn transition-colors duration-150 ${className}`}
      >
        {/* Encabezado del Modal / Sheet */}
        {!hideHeader && (
          <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between flex-shrink-0 bg-white dark:bg-zinc-900">
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Icon className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 id="sheet-modal-title" className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight truncate">
                    {title}
                  </h3>
                  {badge && (
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {badge}
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ventana"
              className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Cuerpo con scroll fluido táctil */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 no-scrollbar sm:scroll-auto text-zinc-900 dark:text-zinc-100">
          {children}
        </div>

        {/* Barra inferior fija con soporte para iOS Safe Area */}
        {footerContent && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 sm:px-6 py-3 sm:py-3.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3.5 flex items-center justify-between flex-shrink-0">
            {footerContent}
          </div>
        )}
      </div>
    </div>
  );
}
