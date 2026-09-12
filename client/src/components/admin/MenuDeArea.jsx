import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

/**
 * SELECTOR DE ÁREA EN MÓVIL: MODAL FLOTANTE (MenuDeArea).
 * Replicado fielmente de standalone-assistant/app/admin/components/MenuDeArea.tsx.
 *
 * En escritorio (md+), el carril lateral (`AdminSidebarRail`) muestra todas las áreas.
 * En móvil (<768px), el carril se oculta y el título del encabezado actúa como disparador táctil.
 * Al pulsar el título, se despliega como un Modal Flotante / Bottom-Sheet:
 *   - Velo estándar de fondo (`bg-black/40 backdrop-blur-sm`).
 *   - Tarjeta flotante con esquinas completas `rounded-[32px]`.
 *   - Superficie que usa el token exacto de diálogo (`bg-white dark:bg-zinc-900`).
 *   - Renderizado vía portal en `document.body`.
 *   - Tirador superior táctil (`w-9 h-1 rounded-full bg-zinc-300 dark:bg-white/20`).
 *   - Opciones con esquinas `rounded-2xl`, icono a la izquierda y checkmark a la derecha.
 *   - Cierre accesible con Escape, click en el velo o selección.
 */

const OPCIONES_SELECTOR = '[role="menuitemradio"]';

export default function MenuDeArea({
  idTitulo = 'admin-area-title',
  titulo,
  opciones = [],
  actual,
  onElegir,
  etiquetaMenu = 'Secciones del panel de administración'
}) {
  const [montado, setMontado] = useState(false);
  const [animado, setAnimado] = useState(false);
  const botonRef = useRef(null);
  const menuRef = useRef(null);

  const esControl = opciones && opciones.length > 0;

  const abrir = () => {
    setMontado(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimado(true);
      });
    });
  };

  const cerrar = (devolverFoco = false) => {
    setAnimado(false);
    setTimeout(() => {
      setMontado(false);
      if (devolverFoco) {
        botonRef.current?.focus({ preventScroll: true });
      }
    }, 200);
  };

  /* Al abrir, el foco entra en la opción activa sin provocar scroll */
  useEffect(() => {
    if (!animado) return;
    const activa = menuRef.current?.querySelector('[aria-checked="true"]');
    const primera = menuRef.current?.querySelector(OPCIONES_SELECTOR);
    (activa || primera)?.focus({ preventScroll: true });
  }, [animado]);

  /* Gestión de teclado (Escape), resize y bloqueo de scroll de fondo */
  useEffect(() => {
    if (!montado) return;

    const alTeclear = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      cerrar(true);
    };

    const alRedimensionar = () => {
      if (window.innerWidth >= 768) {
        cerrar(false);
      }
    };

    const scrollAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', alTeclear, true);
    window.addEventListener('resize', alRedimensionar);

    return () => {
      document.body.style.overflow = scrollAnterior;
      document.removeEventListener('keydown', alTeclear, true);
      window.removeEventListener('resize', alRedimensionar);
    };
  }, [montado]);

  /** Navegación accesible con flechas, Inicio y Fin */
  const navegar = (e) => {
    const items = [...(menuRef.current?.querySelectorAll(OPCIONES_SELECTOR) || [])];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const ir = (n) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus({ preventScroll: true });
    };
    if (e.key === 'ArrowDown') ir(i + 1);
    else if (e.key === 'ArrowUp') ir(i - 1);
    else if (e.key === 'Home') ir(0);
    else if (e.key === 'End') ir(items.length - 1);
  };

  return (
    <div className="relative min-w-0">
      {/* EL TÍTULO: en móvil es el disparador del Modal; en escritorio (md+) es estático */}
      <h2
        id={idTitulo}
        className="min-w-0 text-zinc-900 dark:text-zinc-100 text-xl sm:text-2xl font-bold tracking-tight leading-tight overflow-visible"
      >
        {!esControl ? (
          <span className="truncate block">{titulo}</span>
        ) : (
          <button
            ref={botonRef}
            type="button"
            onClick={() => (montado ? cerrar(true) : abrir())}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                abrir();
              }
            }}
            aria-haspopup="menu"
            aria-expanded={montado && animado}
            data-testid="admin-area-selector"
            className="flex min-w-0 items-center gap-1.5 text-left md:pointer-events-none px-2 py-1 -mx-2 -my-1 rounded-xl focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-zinc-500 dark:focus-visible:ring-white/40 active:opacity-75 transition-opacity"
          >
            <span className="truncate">{titulo}</span>
            <ChevronDown
              className={`shrink-0 text-zinc-500 dark:text-zinc-400 transition-transform duration-200 md:hidden w-5 h-5 ${
                montado && animado ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        )}
      </h2>

      {/* MODAL FLOTANTE (Solo en móvil < 768px, portaleado al body) */}
      {esControl && montado && typeof document !== 'undefined' && createPortal(
        <div className="md:hidden">
          {/* Telón de fondo (Velo estándar de la app) */}
          <div
            className={`fixed inset-0 z-[100010] bg-black/40 backdrop-blur-sm transition-opacity duration-200 ease-out ${
              animado ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => cerrar(true)}
            aria-hidden="true"
          />

          {/* Envoltorio de alineación inferior en móvil */}
          <div
            className="fixed inset-0 z-[100011] flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pointer-events-none"
            onClick={() => cerrar(true)}
          >
            {/* Tarjeta del Modal Flotante pegada abajo */}
            <div
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-[420px] max-h-[85vh] flex flex-col rounded-[32px] bg-white dark:bg-zinc-900 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border border-black/5 dark:border-white/10 overflow-hidden pointer-events-auto transition-all duration-200 ease-out transform ${
                animado
                  ? 'scale-100 opacity-100 translate-y-0'
                  : 'scale-95 opacity-0 translate-y-4'
              }`}
            >
              {/* Tirador central superior estilo Bottom Sheet */}
              <div className="pt-3 pb-2 flex justify-center shrink-0">
                <div className="w-9 h-1 rounded-full bg-zinc-300 dark:bg-white/20 transition-colors" />
              </div>

              {/* Lista de Opciones */}
              <div
                ref={menuRef}
                role="menu"
                aria-label={etiquetaMenu}
                data-testid="admin-area-menu"
                onKeyDown={navegar}
                className="overflow-y-auto px-3.5 pb-4 space-y-1 scrollbar-custom"
              >
                {opciones.map((o) => {
                  const esActiva = o.id === actual;
                  const Icon = o.icon;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={esActiva}
                      onClick={() => {
                        cerrar(false);
                        onElegir(o.id);
                      }}
                      className={`group w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 dark:focus-visible:ring-white/40 ${
                        esActiva
                          ? 'bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/70 dark:hover:bg-white/5 active:bg-zinc-200/60 dark:active:bg-white/10'
                      }`}
                    >
                      {/* Icono de la opción */}
                      {Icon && (
                        <div
                          className={`shrink-0 flex items-center justify-center w-6 h-6 transition-colors ${
                            esActiva
                              ? 'text-zinc-900 dark:text-white'
                              : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                      )}

                      {/* Texto del área */}
                      <span className={`truncate flex-1 text-[15px] ${esActiva ? 'font-semibold text-zinc-900 dark:text-white' : 'font-normal'}`}>
                        {o.title || o.label}
                      </span>

                      {/* Badge contextual si existe */}
                      {o.badge && (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          esActiva
                            ? 'bg-zinc-200 dark:bg-white/20 text-zinc-900 dark:text-white border-zinc-300 dark:border-white/20'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                        }`}>
                          {o.badge}
                        </span>
                      )}

                      {/* Check simple a la derecha */}
                      <Check
                        className={`shrink-0 transition-opacity text-zinc-900 dark:text-white w-4 h-4 ${
                          esActiva ? 'opacity-100' : 'opacity-0'
                        }`}
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
