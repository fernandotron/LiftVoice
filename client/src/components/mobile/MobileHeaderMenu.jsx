import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings, QrCode, Copy, Check,
  Sun, Moon, LogOut
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';

/**
 * Ícono de menú con 2 líneas completas y la tercera más recortada
 */
function Menu3LinesIcon({ className = "w-4.5 h-4.5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="11" y1="18" x2="20" y2="18" />
    </svg>
  );
}

/**
 * MobileHeaderMenu — Menú desplegable de opciones para la cabecera móvil del estudio
 */
export default function MobileHeaderMenu({
  roomId = '',
  onOpenSettings = () => {},
  onOpenQR = () => {},
  onOpenAttendees = () => {},
  attendeesCount = 0,
  onOpenSummary = () => {},
  onOpenVoices = () => {},
  hasCopiedLink = false,
  onCopyLink = () => {},
  onLeave = () => {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 52, right: 12 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const rightOffset = Math.max(12, window.innerWidth - rect.right);
    setMenuPos({
      top: rect.bottom + 8,
      right: rightOffset
    });
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updatePosition);
      window.visualViewport.addEventListener('scroll', updatePosition);
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updatePosition);
        window.visualViewport.removeEventListener('scroll', updatePosition);
      }
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      {/* Botón Disparador Touch Target 44px Apple HIG */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label="Menú de opciones de la sala"
        aria-haspopup="true"
        className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border flex items-center justify-center transition-colors cursor-pointer shadow-xs active:scale-95 touch-manipulation ${
          isOpen
            ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
        }`}
      >
        <Menu3LinesIcon className="w-4.5 h-4.5" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          {/* Telón Backdrop para cerrar al tocar fuera en iOS Safari */}
          <div
            className="fixed inset-0 z-[9998] bg-black/15 dark:bg-black/35 backdrop-blur-[1px] pointer-events-auto"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Menú Desplegable con contención segura contra la barra inferior de Safari */}
          <div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            style={{
              position: 'fixed',
              top: `${menuPos.top}px`,
              right: `${menuPos.right}px`,
              zIndex: 9999
            }}
            className="w-68 max-w-[calc(100vw-24px)] max-h-[calc(100dvh-env(safe-area-inset-bottom,0px)-90px)] overflow-y-auto overscroll-contain rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/80 dark:border-white/10 shadow-xl dark:shadow-2xl p-1.5 space-y-0.5 animate-fadeIn select-none text-left no-scrollbar"
          >
            {/* Bloque: Gestión & Ajustes */}
            <div className="space-y-0.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => { setIsOpen(false); onOpenSettings(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer touch-manipulation"
              >
                <Settings className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span className="flex-1 text-left truncate">Ajustes de sala</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => { setIsOpen(false); onOpenQR(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer touch-manipulation"
              >
                <QrCode className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span className="flex-1 text-left truncate">Proyectar código QR</span>
              </button>
            </div>

            <hr className="my-1 border-zinc-100 dark:border-white/5" />

            {/* Bloque: Utilidades & Enlace */}
            <div className="space-y-0.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => { onCopyLink(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer touch-manipulation"
              >
                {hasCopiedLink ? (
                  <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0 stroke-[2.5]" />
                ) : (
                  <Copy className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                )}
                <span className="flex-1 text-left truncate">
                  {hasCopiedLink ? 'Enlace copiado' : 'Copiar enlace de sala'}
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => { toggleTheme(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer touch-manipulation"
              >
                {isDark ? (
                  <Sun className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                ) : (
                  <Moon className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                )}
                <span className="flex-1 text-left truncate">
                  {isDark ? 'Modo claro' : 'Modo oscuro'}
                </span>
              </button>
            </div>

            <hr className="my-1 border-zinc-100 dark:border-white/5" />

            {/* Bloque: Salir */}
            <div className="pt-0.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => { setIsOpen(false); onLeave(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer group touch-manipulation"
              >
                <LogOut className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 group-hover:text-rose-500 shrink-0 transition-colors" />
                <span className="flex-1 text-left truncate">Salir de la sala</span>
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
