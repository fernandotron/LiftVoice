import React from 'react';

/**
 * ElevenLabs Style Precision Slider — Edición Septiembre 2026
 * - Área táctil extendida para dedos móviles (touch-action: none)
 * - Relleno de progreso dinámico en gradiente monocromo
 * - Números tabulares fluidos y tipografía de precisión
 */
export default function ElevenSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange = () => {},
  leftLabel = '',
  rightLabel = '',
  formatValue = null,
  className = ''
}) {
  const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div className={`space-y-1.5 text-left select-none ${className}`}>
      {/* Title & Value */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">{label}</span>
        {formatValue && (
          <span className="font-mono text-xs font-semibold tabular-numbers text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-zinc-200/80 dark:border-zinc-700/80">
            {formatValue(value)}
          </span>
        )}
      </div>

      {/* Boundary Labels */}
      {(leftLabel || rightLabel) && (
        <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 font-normal">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}

      {/* Track & Circular Thumb */}
      <div className="py-1">
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, var(--slider-active, #09090b) 0%, var(--slider-active, #09090b) ${percent}%, var(--slider-track, #e4e4e7) ${percent}%, var(--slider-track, #e4e4e7) 100%)`
          }}
          className="eleven-slider-input"
        />
      </div>
    </div>
  );
}


