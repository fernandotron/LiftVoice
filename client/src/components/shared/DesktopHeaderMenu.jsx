import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext.jsx';

/**
 * Icono de menú minimalista de 2 líneas horizontales (superior larga, inferior corta),
 * con terminaciones redondeadas, idéntico a la captura de referencia.
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

export default function DesktopHeaderMenu({
  onExit = () => {},
  hasCopiedLink = false,
  onCopyLink = () => {},
  extraItems = []
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isThemeSubmenuOpen, setIsThemeSubmenuOpen] = useState(false);
  const menuRef = useRef(null);
  const themeCloseTimer = useRef(null);
  const { theme, setTheme } = useTheme();

  // Cerrar menús al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsThemeSubmenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsThemeSubmenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Limpiar timer de cierre de tema al desmontar
  useEffect(() => {
    return () => {
      if (themeCloseTimer.current) {
        clearTimeout(themeCloseTimer.current);
      }
    };
  }, []);

  return (
    <div className="relative flex items-center" ref={menuRef}>
      {/* Botón activador con el icono de 2 líneas redondeadas */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setIsThemeSubmenuOpen(false);
        }}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F2F2F2] dark:hover:bg-white/10 transition-colors cursor-pointer"
        aria-label="Menú principal"
        aria-expanded={isOpen}
      >
        <MenuLinesIcon className="w-4.5 h-4.5 text-zinc-500 dark:text-zinc-400" />
      </button>

      {/* Menú Desplegable Principal (Diseño exacto de app-salud / RecordingLayout) */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 p-1 flex flex-col whitespace-nowrap bg-white dark:bg-[#1f1f1f] rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.06)] z-50 animate-fadeIn select-none">
          {/* Volver al inicio */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setIsThemeSubmenuOpen(false);
              onExit();
            }}
            className="w-full text-left py-1.5 px-2.5 text-sm font-medium text-[#1C1C1C] dark:text-[#F2F2F2] rounded-lg hover:bg-[#F2F2F2] dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Volver al inicio
          </button>

          {/* Opción Tema con submenú flyout */}
          <div
            className="relative"
            onMouseEnter={() => {
              if (themeCloseTimer.current) {
                clearTimeout(themeCloseTimer.current);
                themeCloseTimer.current = null;
              }
              setIsThemeSubmenuOpen(true);
            }}
            onMouseLeave={() => {
              themeCloseTimer.current = setTimeout(() => setIsThemeSubmenuOpen(false), 150);
            }}
          >
            <button
              type="button"
              onMouseEnter={() => {
                if (themeCloseTimer.current) {
                  clearTimeout(themeCloseTimer.current);
                  themeCloseTimer.current = null;
                }
              }}
              onClick={() => setIsThemeSubmenuOpen(prev => !prev)}
              className="w-full flex items-center justify-between gap-6 py-1.5 px-2.5 text-sm text-[#1C1C1C] dark:text-[#F2F2F2] rounded-lg hover:bg-[#F2F2F2] dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <span>Tema</span>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
            </button>

            {/* Submenú Flotante de Selección de Tema */}
            {isThemeSubmenuOpen && (
              <div
                className="absolute left-full top-0 -ml-1 pl-2 z-50"
                onMouseEnter={() => {
                  if (themeCloseTimer.current) {
                    clearTimeout(themeCloseTimer.current);
                    themeCloseTimer.current = null;
                  }
                }}
                onMouseLeave={() => {
                  themeCloseTimer.current = setTimeout(() => setIsThemeSubmenuOpen(false), 150);
                }}
              >
                <div className="p-1 flex flex-col whitespace-nowrap bg-white dark:bg-[#1f1f1f] rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.06)]">
                  {[
                    { value: 'light', label: 'Claro' },
                    { value: 'dark', label: 'Oscuro' },
                    { value: 'system', label: 'Sistema' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setTheme(opt.value);
                        setIsOpen(false);
                        setIsThemeSubmenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-4 py-1.5 px-2.5 text-sm font-medium rounded-lg transition-colors hover:bg-[#F2F2F2] dark:hover:bg-white/5 cursor-pointer ${
                        theme === opt.value
                          ? 'text-[#1C1C1C] dark:text-[#F2F2F2]'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {theme === opt.value && (
                        <span className="text-[#1C1C1C] dark:text-[#F2F2F2] leading-none text-base">•</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Copiar vínculo de sala */}
          <button
            type="button"
            onClick={() => {
              onCopyLink();
              setIsOpen(false);
              setIsThemeSubmenuOpen(false);
            }}
            className="w-full text-left py-1.5 px-2.5 text-sm font-medium text-[#1C1C1C] dark:text-[#F2F2F2] rounded-lg hover:bg-[#F2F2F2] dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            {hasCopiedLink ? '¡Enlace copiado!' : 'Copiar vínculo de sala'}
          </button>

          {/* Opciones adicionales (ej. HostView) */}
          {extraItems.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsThemeSubmenuOpen(false);
                item.onClick();
              }}
              className="w-full text-left py-1.5 px-2.5 text-sm font-medium text-[#1C1C1C] dark:text-[#F2F2F2] rounded-lg hover:bg-[#F2F2F2] dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
