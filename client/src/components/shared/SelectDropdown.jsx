import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

/**
 * SelectDropdown — Replicado fielmente de standalone-assistant/app/admin/components/SelectDropdown.tsx.
 *
 * Características:
 *   - En escritorio (>=640px): Menú flotante anclado al botón con esquinas `rounded-2xl`,
 *     superficie `bg-white dark:bg-zinc-900`, sombra suave, checkmark esmeralda/zinc en la opción activa,
 *     y detección automática de espacio vertical (`openUp`).
 *   - En móvil (<640px): Bottom Sheet modal pegado abajo con esquinas `rounded-[32px]`,
 *     tirador táctil superior (`w-9 h-1 rounded-full bg-zinc-300 dark:bg-white/20`), velo oscuro y opciones `rounded-2xl`.
 *   - Renderizado vía portal en `document.body` para escapar de containing blocks con backdrop-filter.
 *   - Soporta tanto la prop `options: [{ value, label, description }]` como `children: <option value="...">Label</option>`.
 *   - Invoca `onChange` pasando tanto el objeto sintético `{ target: { value } }` como el valor directo `value`.
 */

export default function SelectDropdown({
  value,
  options: optionsProp,
  onChange = () => {},
  placeholder = 'Seleccionar...',
  disabled = false,
  id,
  'aria-label': ariaLabel,
  className = '',
  children
}) {
  // Extraer y normalizar opciones desde `optionsProp` o desde `children` (<option>)
  const parsedOptions = useMemo(() => {
    let rawList = [];
    if (Array.isArray(optionsProp) && optionsProp.length > 0) {
      rawList = optionsProp;
    } else if (children) {
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.props) {
          rawList.push({
            value: child.props.value !== undefined ? child.props.value : child.props.children,
            label: child.props.children || child.props.label || String(child.props.value),
            description: child.props['data-description'] || child.props.description
          });
        }
      });
    }

    return rawList.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        opt = { value: opt, label: String(opt) };
      }
      if (!opt || typeof opt !== 'object') {
        return { value: '', label: '', description: null };
      }

      const rawVal = opt.value !== undefined ? opt.value : opt.label;
      const labelStr = typeof opt.label === 'string' ? opt.label : (opt.label != null ? String(opt.label) : String(rawVal ?? ''));
      let desc = opt.description ? String(opt.description).trim() : null;

      // Limpiar prefijos numéricos ("1. ", "2) ", "3 - ")
      let cleanLabel = labelStr.replace(/^\d+[\.\)\-]\s*/, '').trim();

      // Si no hay subtítulo/descripción explícita, extraer de paréntesis al final ("Título (Subtítulo)")
      if (!desc) {
        const parenMatch = cleanLabel.match(/^(.*?)\s*\(([^()]+)\)$/);
        if (parenMatch && parenMatch[1].trim()) {
          cleanLabel = parenMatch[1].trim();
          desc = parenMatch[2].trim();
        }
      }

      return {
        value: rawVal,
        label: cleanLabel || labelStr,
        description: desc,
        originalLabel: labelStr
      };
    });
  }, [optionsProp, children]);

  const [isOpen, setIsOpen] = useState(false);
  const [animado, setAnimado] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  // Detectar pantalla móvil (<640px)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const selectedOption = parsedOptions.find(opt => String(opt.value) === String(value));
  const displayLabel = selectedOption?.label || placeholder;

  const abrir = () => {
    if (disabled || !buttonRef.current) return;

    if (isOpen) {
      cerrar();
      return;
    }

    const rect = buttonRef.current.getBoundingClientRect();
    const hasDescriptions = parsedOptions.some(opt => !!opt.description);
    const optionHeight = hasDescriptions ? 52 : 40;
    const menuMaxHeight = 340;
    const estimatedMenuHeight = Math.min(parsedOptions.length * optionHeight + 16, menuMaxHeight);
    const spacing = 4;
    const spaceBelow = window.innerHeight - rect.bottom - spacing;
    const spaceAbove = rect.top - spacing;

    const openUp = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

    // Calcular ancho y alineación dentro del viewport
    const menuWidth = Math.max(rect.width, 280);
    const maxLeft = Math.max(12, window.innerWidth - menuWidth - 12);
    const adjustedLeft = Math.max(12, Math.min(rect.left, maxLeft));

    setMenuPosition({
      top: openUp ? rect.top : rect.bottom + spacing,
      left: rect.left,
      adjustedLeft,
      width: menuWidth,
      openUp,
    });
    setIsOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimado(true);
      });
    });
  };

  const cerrar = () => {
    setAnimado(false);
    setTimeout(() => {
      setIsOpen(false);
      setMenuPosition(null);
    }, 150);
  };

  const handleSelect = (optionValue) => {
    // Enviar evento compatible tanto con handlers que esperan `e.target.value` como `val`
    const syntheticEvent = {
      target: { value: optionValue, id, name: id },
      currentTarget: { value: optionValue, id, name: id },
      stopPropagation: () => {},
      preventDefault: () => {}
    };
    onChange(syntheticEvent, optionValue);
    cerrar();
  };

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      const target = event.target;
      if (
        buttonRef.current &&
        menuRef.current &&
        !buttonRef.current.contains(target) &&
        !menuRef.current.contains(target)
      ) {
        cerrar();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cerrar();
        buttonRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        aria-label={ariaLabel || displayLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={abrir}
        className={`w-full appearance-none rounded-2xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-white/40 border border-zinc-200/90 dark:border-white/10 h-11 px-4 pr-10 text-xs sm:text-sm font-medium cursor-pointer flex items-center justify-between relative transition-all disabled:opacity-50 disabled:cursor-not-allowed select-none ${
          isOpen ? 'bg-zinc-100 dark:bg-white/10' : 'bg-zinc-100/70 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10'
        } ${className}`}
      >
        <span className="truncate text-left">{displayLabel}</span>
        <ChevronDown
          className={`shrink-0 text-zinc-500 dark:text-zinc-400 absolute right-3 transition-transform duration-200 w-4.5 h-4.5 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && typeof window !== 'undefined' && createPortal(
        isMobile ? (
          // Versión Móvil: Bottom Sheet estilo standalone-assistant
          <div>
            <div
              className={`fixed inset-0 z-[100010] bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-out ${
                animado ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={cerrar}
              aria-hidden="true"
            />
            <div
              className="fixed inset-0 z-[100011] flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pointer-events-none"
              onClick={cerrar}
            >
              <div
                ref={menuRef}
                onClick={(e) => e.stopPropagation()}
                role="listbox"
                aria-label={ariaLabel || 'Opciones'}
                className={`relative w-full max-w-[420px] max-h-[85vh] flex flex-col rounded-[32px] bg-white dark:bg-zinc-900 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border border-black/5 dark:border-white/10 overflow-hidden pointer-events-auto transition-all duration-200 ease-out transform ${
                  animado ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
                }`}
              >
                {/* Tirador táctil superior */}
                <div className="pt-3 pb-2 flex justify-center shrink-0">
                  <div className="w-9 h-1 rounded-full bg-zinc-300 dark:bg-white/20 transition-colors" />
                </div>

                {/* Lista de opciones */}
                <div className="overflow-y-auto px-3.5 pb-4 space-y-1 scrollbar-custom">
                  {parsedOptions.map((option) => {
                    const isSelected = String(value) === String(option.value);
                    return (
                      <button
                        key={String(option.value)}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(option.value)}
                        className={`group w-full flex items-center justify-between gap-3.5 px-3.5 py-2.5 rounded-2xl text-left transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:focus-visible:ring-white/40 cursor-pointer ${
                          isSelected
                            ? 'text-zinc-950 dark:text-white hover:bg-zinc-100/80 dark:hover:bg-white/10 active:bg-zinc-200/60 dark:active:bg-white/15'
                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-white/10 active:bg-zinc-200/60 dark:active:bg-white/15 font-normal'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`truncate text-sm sm:text-[15px] ${isSelected ? 'font-semibold text-zinc-950 dark:text-white' : 'font-medium text-zinc-800 dark:text-zinc-200'}`}>
                            {option.label}
                          </span>
                          {option.description && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 leading-snug">
                              {option.description}
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <Check
                            className="shrink-0 text-zinc-950 dark:text-white w-4 h-4 ml-2"
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Versión Escritorio: Menú flotante anclado al disparador con createPortal
          menuPosition && (
            <div
              ref={menuRef}
              role="listbox"
              aria-label={ariaLabel || 'Opciones'}
              className={`fixed p-1.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_40px_-6px_rgba(0,0,0,0.75)] border border-zinc-200/90 dark:border-white/10 z-[100010] max-h-[340px] overflow-y-auto scrollbar-custom select-none transition-all duration-150 space-y-0.5 ${
                animado ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              style={{
                ...(menuPosition.openUp
                  ? { bottom: `${window.innerHeight - menuPosition.top + 4}px` }
                  : { top: `${menuPosition.top}px` }),
                left: `${menuPosition.adjustedLeft ?? menuPosition.left}px`,
                width: `${menuPosition.width}px`,
                pointerEvents: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {parsedOptions.map((option) => {
                const isSelected = String(value) === String(option.value);
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(option.value)}
                    className={`group flex w-full items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-colors focus:outline-none cursor-pointer ${
                      isSelected
                        ? 'text-zinc-950 dark:text-white hover:bg-zinc-100/80 dark:hover:bg-white/10'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-white/10'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1 pr-2">
                      <span className={`truncate text-xs sm:text-sm ${isSelected ? 'font-semibold text-zinc-950 dark:text-white' : 'font-medium text-zinc-800 dark:text-zinc-200'}`}>
                        {option.label}
                      </span>
                      {option.description && (
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 leading-snug">
                          {option.description}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check
                        className="shrink-0 text-zinc-950 dark:text-white w-4 h-4 ml-2"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )
        ),
        document.body
      )}
    </>
  );
}
