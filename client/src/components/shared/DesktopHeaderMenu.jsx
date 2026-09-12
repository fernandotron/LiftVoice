import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight, Home, Sun, Moon, Monitor, Copy, Check,
  PlusCircle, QrCode, Sparkles, Headphones, Settings, LogOut
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';

/**
 * Icono de menú minimalista de 2 líneas redondeadas idéntico a la cabecera del estudio.
 */
export function MenuLinesIcon({ className = "w-4.5 h-4.5" }) {
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
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="15" x2="13" y2="15" />
    </svg>
  );
}

/**
 * Mapeo inteligente de iconos según la etiqueta de la opción extra.
 */
function getExtraItemIcon(label = '') {
  const l = label.toLowerCase();
  if (l.includes('qr')) return QrCode;
  if (l.includes('resumen')) return Sparkles;
  if (l.includes('voces') || l.includes('catálogo') || l.includes('catalogo')) return Headphones;
  if (l.includes('ajustes') || l.includes('configuración') || l.includes('configuracion')) return Settings;
  if (l.includes('crear') || l.includes('sala')) return PlusCircle;
  if (l.includes('salir') || l.includes('cerrar')) return LogOut;
  return Settings;
}

export default function DesktopHeaderMenu({
  onExit = () => {},
  hasCopiedLink = false,
  onCopyLink = () => {},
  extraItems = []
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [isThemeSubmenuOpen, setIsThemeSubmenuOpen] = useState(false);
  const [themeSubmenuPos, setThemeSubmenuPos] = useState({ top: 0, left: 0 });

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const themeItemRef = useRef(null);
  const submenuRef = useRef(null);
  const themeCloseTimer = useRef(null);

  const { theme, setTheme, resolvedTheme } = useTheme();

  const cancelThemeClose = useCallback(() => {
    if (themeCloseTimer.current) {
      clearTimeout(themeCloseTimer.current);
      themeCloseTimer.current = null;
    }
  }, []);

  const closeAll = useCallback(() => {
    cancelThemeClose();
    setIsOpen(false);
    setIsThemeSubmenuOpen(false);
  }, [cancelThemeClose]);

  // Posicionar menú principal al abrir
  const toggleMenu = () => {
    if (isOpen) {
      closeAll();
      return;
    }
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const MENU_WIDTH = 250;
    const padding = 8;

    let left = rect.left;
    if (left + MENU_WIDTH > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - MENU_WIDTH - padding);
    }

    setMenuPos({
      top: rect.bottom + 6,
      left
    });
    setIsOpen(true);
    setIsThemeSubmenuOpen(false);
  };

  // Posicionar submenú de tema
  const handleOpenThemeSubmenu = useCallback((e) => {
    cancelThemeClose();
    const target = themeItemRef.current || e?.currentTarget;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const panelRect = menuRef.current?.getBoundingClientRect();
    const SUBMENU_WIDTH = 180;
    const padding = 8;

    const panelRight = panelRect ? panelRect.right : rect.right;
    const panelLeft = panelRect ? panelRect.left : rect.left;

    let left = panelRight + 4;
    if (left + SUBMENU_WIDTH > window.innerWidth - padding) {
      left = Math.max(padding, panelLeft - SUBMENU_WIDTH - 4);
    }

    setThemeSubmenuPos({
      top: Math.max(padding, rect.top - 4),
      left
    });
    setIsThemeSubmenuOpen(true);
  }, [cancelThemeClose]);

  const toggleThemeSubmenu = useCallback((e) => {
    e?.stopPropagation();
    if (isThemeSubmenuOpen) {
      cancelThemeClose();
      setIsThemeSubmenuOpen(false);
    } else {
      handleOpenThemeSubmenu(e);
    }
  }, [isThemeSubmenuOpen, cancelThemeClose, handleOpenThemeSubmenu]);

  const handleCloseThemeWithGrace = useCallback(() => {
    cancelThemeClose();
    themeCloseTimer.current = setTimeout(() => {
      setIsThemeSubmenuOpen(false);
    }, 220);
  }, [cancelThemeClose]);

  // Cerrar al pulsar fuera, resize o Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (submenuRef.current && submenuRef.current.contains(e.target)) return;
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      closeAll();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isThemeSubmenuOpen) {
          setIsThemeSubmenuOpen(false);
          return;
        }
        closeAll();
      }
    };

    const handleResize = () => closeAll();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, isThemeSubmenuOpen, closeAll]);

  useEffect(() => () => cancelThemeClose(), [cancelThemeClose]);

  return (
    <div className="relative flex items-center">
      {/* Botón activador con el icono de 2 líneas redondeadas */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
          isOpen
            ? 'bg-zinc-200/80 dark:bg-white/10 text-zinc-900 dark:text-white'
            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-white'
        }`}
        aria-label="Menú principal"
        aria-expanded={isOpen}
      >
        <MenuLinesIcon className="w-4.5 h-4.5" />
      </button>

      {/* Menú Desplegable Principal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Menú de opciones"
          className="fixed z-[99999] min-w-[230px] max-w-[280px] w-max p-1.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.06)] border border-black/5 dark:border-white/10 overflow-hidden animate-fadeIn select-none text-left"
          style={{
            top: `${menuPos.top}px`,
            left: `${menuPos.left}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Bloque 1: Navegación de sala */}
          <div role="group" className="space-y-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeAll();
                onExit();
              }}
              onMouseEnter={handleCloseThemeWithGrace}
              className="flex w-full items-center gap-3 p-2 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100/70 dark:hover:bg-white/5 transition-colors focus:outline-none cursor-pointer"
            >
              <Home className="w-4 h-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
              <span>Volver al inicio</span>
            </button>

            {/* Opción de Tema con submenú (toggle por click y hover) */}
            <button
              ref={themeItemRef}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isThemeSubmenuOpen}
              onClick={toggleThemeSubmenu}
              onMouseEnter={handleOpenThemeSubmenu}
              onMouseLeave={handleCloseThemeWithGrace}
              className={`flex w-full items-center justify-between gap-3 p-2 rounded-xl text-sm font-medium transition-colors focus:outline-none cursor-pointer ${
                isThemeSubmenuOpen
                  ? 'bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white'
                  : 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100/70 dark:hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-3">
                {resolvedTheme === 'dark' ? (
                  <Moon className="w-4 h-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                ) : (
                  <Sun className="w-4 h-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                )}
                <span>Tema</span>
              </span>
              <ChevronRight className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0 transition-transform duration-150 ${isThemeSubmenuOpen ? 'rotate-90 sm:rotate-0' : ''}`} />
            </button>

            {/* Copiar enlace */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onCopyLink();
                closeAll();
              }}
              onMouseEnter={handleCloseThemeWithGrace}
              className="flex w-full items-center gap-3 p-2 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100/70 dark:hover:bg-white/5 transition-colors focus:outline-none cursor-pointer"
            >
              {hasCopiedLink ? (
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <Copy className="w-4 h-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
              )}
              <span>{hasCopiedLink ? '¡Enlace copiado!' : 'Copiar vínculo de sala'}</span>
            </button>
          </div>

          {/* Separador de acciones adicionales */}
          {extraItems.length > 0 && (
            <>
              <div className="border-t border-zinc-200 dark:border-white/10 my-1" />
              <div role="group" className="space-y-0.5">
                {extraItems.map((item, idx) => {
                  const ItemIcon = getExtraItemIcon(item.label);
                  const isDestructive = item.destructive || item.label.toLowerCase().includes('cerrar') || item.label.toLowerCase().includes('salir');
                  return (
                    <button
                      key={idx}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeAll();
                        item.onClick();
                      }}
                      onMouseEnter={handleCloseThemeWithGrace}
                      className={`flex w-full items-center gap-3 p-2 rounded-xl text-sm font-medium transition-colors focus:outline-none cursor-pointer ${
                        isDestructive
                          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
                          : 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100/70 dark:hover:bg-white/5'
                      }`}
                    >
                      <ItemIcon className={`w-4 h-4 flex-shrink-0 ${isDestructive ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Submenú Flotante de Tema: Portaled INDEPENDIENTEMENTE a document.body para que NUNCA sea clipeado por overflow-hidden */}
      {isOpen && isThemeSubmenuOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={submenuRef}
          role="menu"
          aria-label="Seleccionar tema"
          className="fixed z-[100000] min-w-[170px] p-1.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_24px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)] border border-black/5 dark:border-white/10 overflow-hidden animate-fadeIn select-none text-left"
          style={{
            top: `${themeSubmenuPos.top}px`,
            left: `${themeSubmenuPos.left}px`
          }}
          onMouseEnter={cancelThemeClose}
          onMouseLeave={handleCloseThemeWithGrace}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { value: 'light', label: 'Claro', icon: Sun },
            { value: 'dark', label: 'Oscuro', icon: Moon },
            { value: 'system', label: 'Sistema', icon: Monitor },
          ].map((opt) => {
            const OptIcon = opt.icon;
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  setTheme(opt.value);
                  closeAll();
                }}
                className={`w-full flex items-center justify-between gap-3 p-2 text-sm font-medium rounded-xl transition-colors cursor-pointer ${
                  isSelected
                    ? 'text-zinc-900 dark:text-white font-semibold bg-zinc-100/70 dark:bg-white/10'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <OptIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                  <span>{opt.label}</span>
                </span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 flex-shrink-0 stroke-[2.5]" />
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
