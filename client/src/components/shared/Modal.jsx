import React, { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Modal — Diálogo y Bottom Sheet al estilo del proyecto Reness
 * - Tarjeta flotante con bordes redondeados en las 4 esquinas (28px)
 * - Sin líneas separadoras rígidas ni tiradores invasivos
 * - Espaciado perimetral e interno idéntico al diseño de Reness
 * - Backdrop difuminado con blur de 3px y animación suave
 */
export function Modal({
  isOpen = true,
  onClose = () => {},
  titleId,
  ariaLabel,
  ariaDescribedBy,
  role = 'dialog',
  variant = 'sheet',
  children,
  header,
  stickyHeader = false,
  footer,
  showHandle = false, // Por defecto sin línea superior tal como en Reness
  headerStyle,
  footerStyle,
  bodyStyle,
  bodyClassName = '',
  overlayStyle,
  dialogStyle,
  overlayClassName = '',
  dialogClassName = '',
  zIndex = 50,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  initialFocusRef,
  container: customContainer,
  usePortal = true,
}) {
  const autoTitleId = useId();
  const effectiveTitleId = titleId || (ariaLabel ? undefined : `lv-modal-title-${autoTitleId}`);

  const dialogRef = useRef(null);
  const overlayRef = useRef(null);
  const triggerRef = useRef(null);

  const portalTarget = customContainer !== undefined
    ? customContainer
    : (typeof document !== 'undefined'
        ? (document.getElementById('root') || document.body)
        : null);

  // Captura y restauración del foco
  useEffect(() => {
    if (!isOpen) return;

    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      triggerRef.current = document.activeElement;
    }

    const timer = setTimeout(() => {
      if (!dialogRef.current) return;

      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);

      if (focusableElements.length > 0 && focusableElements[0]) {
        focusableElements[0].focus();
      } else {
        dialogRef.current.focus();
      }
    }, 20);

    return () => {
      clearTimeout(timer);
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        try {
          triggerRef.current.focus();
        } catch {}
      }
    };
  }, [isOpen, initialFocusRef]);

  // Bloqueo de scroll en body mientras está abierto
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Manejo de teclado: Escape y Focus Trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation();
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!dialogRef.current) return;

        const focusableElements = Array.from(
          dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);

        if (focusableElements.length === 0) {
          e.preventDefault();
          dialogRef.current.focus();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const isFullscreen = variant === 'fullscreen';
  const isCenter = variant === 'center';
  const shouldRenderHandle = Boolean(showHandle) && variant === 'sheet';

  const innerContent = (
    <>
      {/* Encabezado sin bordes divisorios */}
      {stickyHeader && header && (
        <div className="flex-shrink-0 px-6 pt-6 sm:pt-7 pb-2" style={headerStyle}>
          {header}
        </div>
      )}

      {/* Cuerpo scrolleable táctil con espaciado Reness */}
      <div
        className={`flex-1 overflow-y-auto overscroll-contain no-scrollbar ${bodyClassName}`}
        style={{
          WebkitOverflowScrolling: 'touch',
          padding: stickyHeader || !header ? '24px 24px 16px' : undefined,
          ...bodyStyle,
        }}
      >
        {!stickyHeader && header && (
          <div className="px-6 pt-6 sm:pt-7 pb-2" style={headerStyle}>
            {header}
          </div>
        )}
        <div className={!stickyHeader && header ? "px-6 pb-2" : ""}>
          {children}
        </div>
      </div>

      {/* Pie inferior limpio sin bordes divisorios */}
      {footer && (
        <div
          className="flex-shrink-0 px-6 pt-2 pb-6 pb-[max(1.5rem,calc(1rem+env(safe-area-inset-bottom,0px)))] bg-inherit"
          style={footerStyle}
        >
          {footer}
        </div>
      )}
    </>
  );

  // Fullscreen variant
  if (isFullscreen) {
    const fullscreenContent = (
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={effectiveTitleId}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={`fixed inset-0 z-50 flex flex-col w-full h-full bg-white dark:bg-zinc-950 overflow-hidden outline-none animate-sheet-up ${dialogClassName}`}
        style={{ zIndex, ...dialogStyle }}
      >
        {innerContent}
      </div>
    );

    if (usePortal && portalTarget) {
      return createPortal(fullscreenContent, portalTarget);
    }
    return fullscreenContent;
  }

  // Clases y estilos de overlay y contenedor estilo Reness
  const overlayClasses = isCenter
    ? 'fixed inset-0 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-[3px] animate-backdrop-in'
    : 'fixed inset-0 flex flex-col justify-end items-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-6 sm:justify-center bg-black/40 backdrop-blur-[3px] animate-backdrop-in';

  const defaultDialogClasses = isCenter
    ? 'w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[28px] border border-zinc-200/80 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden outline-none animate-fadeIn text-left transition-colors duration-150'
    : 'w-full max-w-md bg-white dark:bg-zinc-900 rounded-[28px] border border-zinc-200/80 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[88dvh] sm:max-h-[85vh] overflow-hidden outline-none animate-sheet-up text-left transition-colors duration-150';

  const modalNode = (
    <div
      ref={overlayRef}
      className={`${overlayClasses} ${overlayClassName}`}
      style={{ zIndex, ...overlayStyle }}
      onClick={(e) => {
        if (closeOnOverlayClick && e.target === overlayRef.current) {
          onClose();
        }
      }}
    >
      {/* Área superior para cerrar al hacer clic en el backdrop en modo sheet */}
      {!isCenter && (
        <div
          className="flex-1 w-full"
          style={{ cursor: closeOnOverlayClick ? 'pointer' : 'default' }}
          onClick={(e) => {
            if (closeOnOverlayClick) {
              e.stopPropagation();
              onClose();
            }
          }}
          aria-hidden="true"
        />
      )}

      {/* Contenedor Flotante del Diálogo */}
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={effectiveTitleId}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`${defaultDialogClasses} ${dialogClassName}`}
        style={dialogStyle}
      >
        {innerContent}
      </div>
    </div>
  );

  if (usePortal && portalTarget) {
    return createPortal(modalNode, portalTarget);
  }
  return modalNode;
}

export default Modal;
