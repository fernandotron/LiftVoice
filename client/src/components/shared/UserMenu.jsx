import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Settings, LogOut, Check, User } from 'lucide-react';

/**
 * USER MENU — Replicado fielmente de standalone-assistant/components/chatbot/UserMenu.tsx.
 *
 * Menú flotante del usuario / avatar:
 *   - Encabezado con correo/rol y botón de cierre accesible.
 *   - Tarjeta con esquinas redondeadas completas (`rounded-2xl`).
 *   - Superficie que usa tokens de diálogo (`bg-white dark:bg-zinc-900`).
 *   - Sombra sutil de elevación: `shadow-[0_8px_24px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)]`.
 *   - Borde de contorno: `border border-black/5 dark:border-white/10`.
 *   - Botón de acción destacada como pastilla llena (`rounded-full py-2.5 bg-zinc-100 dark:bg-white/10`).
 *   - Opción exclusiva de administración destacada en azul con icono de escudo (`Shield`).
 *   - Renderizado vía portal en `document.body`.
 */

const ANCHO_MENU = 300;
const SEPARACION = 8;
const ALTO_ESTIMADO_MENU = 320;

export default function UserMenu({
  isOpen = false,
  onClose = () => {},
  anchorElement = null,
  userName = 'Usuario',
  userEmail = null,
  userRole = null, // 'admin_master' | 'host' | 'listener'
  canAccessAdmin = false,
  onOpenSettings = null,
  onOpenAdminPanel = null,
  onLogout = null
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const alPulsarFuera = (event) => {
      const destino = event.target;
      if (menuRef.current && menuRef.current.contains(destino)) return;
      if (anchorElement && anchorElement.contains(destino)) return;
      onClose();
    };

    const alTeclear = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', alPulsarFuera);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alPulsarFuera);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [isOpen, onClose, anchorElement]);

  if (!isOpen || !anchorElement || typeof window === 'undefined') return null;

  const rect = anchorElement.getBoundingClientRect();
  let top = rect.top + rect.height + SEPARACION;
  let right = window.innerWidth - rect.right;

  if (top + ALTO_ESTIMADO_MENU > window.innerHeight && rect.top - ALTO_ESTIMADO_MENU > SEPARACION) {
    top = rect.top - ALTO_ESTIMADO_MENU - SEPARACION;
  }
  if (top < SEPARACION) top = SEPARACION;
  if (right + ANCHO_MENU > window.innerWidth) right = window.innerWidth - ANCHO_MENU - SEPARACION;
  if (right < SEPARACION) right = SEPARACION;

  const initials = userName
    ? userName.trim().split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'LV';

  return createPortal(
    <div
      ref={menuRef}
      data-testid="usermenu"
      role="menu"
      aria-label="Menú de usuario"
      className="fixed z-[100000] bg-white dark:bg-zinc-900 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)] border border-black/5 dark:border-white/10 overflow-hidden animate-fadeIn select-none text-left"
      style={{ top: `${top}px`, right: `${right}px`, width: `${ANCHO_MENU}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header con email / rol y botón cerrar */}
      <div className="relative flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-zinc-100 dark:border-white/10">
        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate pr-6">
          {userEmail || (userRole === 'admin_master' ? 'Administrador Master' : 'Sesión en Vivo')}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer focus:outline-none"
          aria-label="Cerrar menú"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Información del usuario */}
      <div className="px-4 py-5 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-lg font-bold shadow-xs">
          {initials}
        </div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white mt-2.5">
          ¡Hola, {userName}!
        </h3>
        {userRole && (
          <span className="text-[11px] font-mono font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
            {userRole === 'admin_master' ? 'Rol: Administrador' : userRole === 'host' ? 'Rol: Ponente / Anfitrión' : 'Rol: Oyente'}
          </span>
        )}
      </div>

      {/* Botones de acción */}
      <div className="px-4 pb-4 space-y-2">
        {onOpenSettings && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            data-testid="usermenu-ajustes"
            className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-zinc-900 dark:text-white rounded-2xl transition-colors text-sm font-medium focus:outline-none cursor-pointer text-center"
          >
            Configuración de Sala
          </button>
        )}

        {/* Panel de administración (destacado en azul como en standalone-assistant) */}
        {canAccessAdmin && onOpenAdminPanel && (
          <>
            <div className="py-0.5">
              <div className="border-t border-zinc-200 dark:border-white/10" />
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdminPanel();
              }}
              data-testid="usermenu-admin-panel"
              className="flex w-full items-center gap-3 p-2 rounded-xl text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors focus:outline-none cursor-pointer"
            >
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span>Panel de Administración</span>
            </button>
          </>
        )}

        {/* Cerrar sesión si aplica */}
        {onLogout && (
          <>
            <div className="py-0.5">
              <div className="border-t border-zinc-200 dark:border-white/10" />
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              data-testid="usermenu-logout"
              className="flex w-full items-center gap-3 p-2 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors focus:outline-none cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span>Cerrar sesión</span>
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
