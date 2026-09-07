import React from 'react';

/**
 * ElevenLabs Style Precision Slider
 * Minimalist track (2px), solid circular thumb, subtle boundary labels
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
  return (
    <div className={`space-y-1.5 text-left select-none ${className}`}>
      {/* Title & Value */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-neutral-900 tracking-tight">{label}</span>
        {formatValue && (
          <span className="text-neutral-500 font-mono text-[11px] font-medium">
            {formatValue(value)}
          </span>
        )}
      </div>

      {/* Boundary Labels (Directly under title, exactly like ElevenLabs) */}
      {(leftLabel || rightLabel) && (
        <div className="flex items-center justify-between text-[11px] text-neutral-400 font-normal">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}

      {/* Track & Circular Thumb */}
      <div className="pt-0.5">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="eleven-slider-input"
        />
      </div>
    </div>
  );
}


