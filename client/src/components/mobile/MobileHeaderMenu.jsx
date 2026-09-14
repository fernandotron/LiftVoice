import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings, Users, QrCode, Copy, Check,
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
 * Sustituye el botón redundante de código QR en la parte superior derecha de la sala.
 */
export default function MobileHeaderMenu({
  roomId = '',
  onOpenSettings = () => {},
  onOpenAttendees = () => {},
  attendeesCount = 0,
  onOpenSummary = () => {},
  onOpenVoices = () => {},
  onOpenQR = () => {},
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
    setMenuPos({
      top: rect.bottom + 8,
      right: Math.max(10, window.innerWidth - rect.right)
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

    const handleOutsideClick = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label="Menú de opciones de la sala"
        aria-haspopup="true"
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
          isOpen
            ? 'bg-zinc-200 dark:bg-white/20 text-zinc-900 dark:text-white'
            : 'hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300'
        }`}
      >
        <Menu3LinesIcon className="w-4.5 h-4.5" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
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
          className="w-68 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/80 dark:border-white/10 shadow-xl dark:shadow-2xl p-1.5 space-y-0.5 animate-fadeIn select-none text-left"
        >
          {/* Bloque: Gestión & Ajustes */}
          <div className="space-y-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => { setIsOpen(false); onOpenSettings(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Settings className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
              <span className="flex-1 text-left truncate">Ajustes de sala</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => { setIsOpen(false); onOpenAttendees(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Users className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
              <span className="flex-1 text-left truncate">Participantes</span>
              {attendeesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/10 text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300">
                  {attendeesCount}
                </span>
              )}
            </button>
          </div>

          <hr className="my-1 border-zinc-100 dark:border-white/5" />

          {/* Bloque: Utilidades & Enlace */}
          <div className="space-y-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => { onCopyLink(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
            >
              {hasCopiedLink ? (
                <Check className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
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
              onClick={() => { setIsOpen(false); onOpenQR(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
            >
              <QrCode className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
              <span className="flex-1 text-left truncate">Proyectar código QR</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => { toggleTheme(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer"
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
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer group"
            >
              <LogOut className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400 group-hover:text-rose-500 shrink-0 transition-colors" />
              <span className="flex-1 text-left truncate">Salir de la sala</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
