import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * USER MENU — Perfil minimalista de usuario en sala.
 *
 * Estructura:
 *   - ANCHO_MENU: 320px
 *   - Header: email / rol centrado (text-sm font-medium) con botón cerrar (X) en absolute right-4, sin borde inferior divisorio
 *   - Avatar: 64x64 (h-16 w-16) redondeado completo con borde sutil y fondo neutral, iniciales limpias sin caracteres especiales
 *   - Saludo: ¡Hola, {userName}! (text-lg font-medium) centrado
 *   - Botón principal de acción: pastilla llena rounded-full (py-2.5 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20)
 */

const ANCHO_MENU = 320;
const SEPARACION = 8;
const ALTO_ESTIMADO_MENU = 210;

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

  // Extraer inicial limpia (solo letras alfabéticas, evitando barras o símbolos como "P/")
  const cleanWords = (userName || 'Usuario')
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = cleanWords[0] ? cleanWords[0][0].toUpperCase() : 'U';

  // Nombre para el saludo sin slashes
  const cleanDisplayName = cleanWords[0] || 'Ponente';

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
      {/* Header con email / rol y botón cerrar (calcado de standalone-assistant) */}
      <div className="relative flex items-center justify-center px-4 pt-4 pb-3">
        <div className="text-sm font-medium text-zinc-900 dark:text-white text-center truncate max-w-[230px]">
          {userEmail ? userEmail : (userRole === 'admin_master' ? 'admin@liftvoice.ai' : 'Ponente / Anfitrión')}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-white/40"
          aria-label="Cerrar menú"
          style={{ lineHeight: 0 }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Información del usuario (avatar 64x64 e inicial limpia) */}
      <div className="px-4 py-6 flex flex-col items-center">
        <div className="h-16 w-16 rounded-full bg-zinc-100 dark:bg-white/10 border-2 border-zinc-200 dark:border-white/10 flex items-center justify-center text-2xl font-bold text-zinc-800 dark:text-white shadow-xs">
          {initials}
        </div>
        <h3 className="text-lg font-medium text-zinc-900 dark:text-white mt-3">
          ¡Hola, {cleanDisplayName}!
        </h3>
      </div>

      {/* Botón de acción */}
      {onOpenSettings && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            data-testid="usermenu-ajustes"
            className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-zinc-900 dark:text-white rounded-full transition-colors text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-white/40 cursor-pointer text-center"
          >
            Configuración de Sala
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
