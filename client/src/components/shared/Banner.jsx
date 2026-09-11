import React from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';

/**
 * getBadgeGradient — Genera el degradado característico para el badge del icono
 * Idéntico a la función homónima del proyecto Reness.
 */
export function getBadgeGradient(color, isLight = false) {
  return isLight
    ? `linear-gradient(145deg, color-mix(in srgb, ${color} 80%, #ffffff) 0%, ${color} 100%)`
    : `linear-gradient(145deg, ${color} 0%, color-mix(in srgb, ${color} 75%, #000000) 100%)`;
}

/**
 * Banner — Componente de aviso y estado estilo Reness
 * Portado directamente desde Reness/src/components/shared/index.tsx
 * - Contenedor con borderRadius: 22px
 * - Fondo radial con acento de color en dark mode y superficie en light mode
 * - Badge de icono 32x32px con borderRadius 11px y gradiente de color
 * - Tipografía: title (14px, 650), subtitle (12px, 600) y desc (12.5px)
 * - Soporte para acción lateral (action) y/o acción inferior (bottomAction)
 */
export default function Banner({
  icon,
  color = '#f59e0b',
  title,
  subtitle,
  desc,
  action,
  bottomAction,
  className = '',
  style = {},
  alignCenter = false
}) {
  const { isDark } = useTheme();
  const isLightTheme = !isDark;

  const isCritical = color.includes('red') || color.includes('rose');
  const shouldCenter = alignCenter || (!desc && !!action && !bottomAction);

  return (
    <div
      role={isCritical ? 'alert' : 'status'}
      aria-live={isCritical ? 'assertive' : 'polite'}
      className={`w-full text-left transition-all ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: isLightTheme
          ? '#ffffff'
          : `radial-gradient(ellipse at 0% 0%, color-mix(in srgb, ${color} 12%, transparent), transparent 75%), #18181b`,
        border: isLightTheme
          ? '1px solid #e4e4e7'
          : '1px solid color-mix(in srgb, #27272a 80%, transparent)',
        borderRadius: 22,
        padding: '14px 16px',
        boxShadow: isLightTheme
          ? '0 1px 3px rgba(0, 0, 0, 0.05)'
          : '0 2px 8px rgba(0, 0, 0, 0.35)',
        boxSizing: 'border-box',
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: shouldCenter ? 'center' : 'flex-start',
        }}
      >
        {/* Icon block (32x32, 11px border radius, gradient background) */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 11,
            flexShrink: 0,
            background: getBadgeGradient(color, isLightTheme),
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: shouldCenter ? 0 : 1,
            alignSelf: shouldCenter ? 'center' : 'flex-start',
            border: 'none',
            boxShadow: isLightTheme
              ? 'none'
              : `0 2px 8px color-mix(in srgb, ${color} 20%, transparent)`,
          }}
        >
          {icon}
        </div>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {title && (
            <div
              className="text-zinc-900 dark:text-zinc-100"
              style={{
                fontSize: 14,
                fontWeight: 650,
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
                minWidth: 0,
                wordBreak: 'break-word',
              }}
            >
              {title}
            </div>
          )}

          {subtitle && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: color,
                lineHeight: 1.3,
                minWidth: 0,
              }}
            >
              {subtitle}
            </div>
          )}

          {desc && (
            <p
              className="text-zinc-500 dark:text-zinc-400"
              style={{
                fontSize: 12.5,
                lineHeight: 1.45,
                margin: 0,
                minWidth: 0,
                wordBreak: 'break-word',
              }}
            >
              {desc}
            </p>
          )}
        </div>

        {/* Side action block */}
        {action && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              alignSelf: shouldCenter ? 'center' : 'flex-start',
              marginTop: shouldCenter ? 0 : 1,
            }}
          >
            {action}
          </div>
        )}
      </div>

      {/* Bottom action block */}
      {bottomAction && (
        <div style={{ marginTop: 12, width: '100%' }}>
          {bottomAction}
        </div>
      )}
    </div>
  );
}
