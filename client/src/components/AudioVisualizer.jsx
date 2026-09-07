import React, { useEffect, useRef } from 'react';

/**
 * ElevenLabs Style Waveform Canvas Visualizer
 * Minimalist, monochromatic, precision bars
 */
export default function AudioVisualizer({
  mode = 'bars', // 'bars' | 'wave' | 'aura'
  height = 64,
  className = '',
  barColor = '#ffffff',
  barCount = 36,
  isActive = false,
  getFrequencyDataFn = null
}) {
  const canvasRef = useRef(null);
  const staticBufferRef = useRef(new Uint8Array(barCount));
  const getFrequencyDataRef = useRef(getFrequencyDataFn);
  const isActiveRef = useRef(isActive);

  getFrequencyDataRef.current = getFrequencyDataFn;
  isActiveRef.current = isActive;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId = null;
    let isDisposed = false;

    // Retina display scaling with safety fallback
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    const updateDimensions = () => {
      if (isDisposed || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const displayWidth = Math.max(rect.width || 320, 50);
      const displayHeight = Math.max(height || 48, 20);
      if (canvas.width !== Math.round(displayWidth * dpr) || canvas.height !== Math.round(displayHeight * dpr)) {
        canvas.width = Math.round(displayWidth * dpr);
        canvas.height = Math.round(displayHeight * dpr);
      }
    };

    updateDimensions();

    let resizeTimer = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateDimensions, 100);
    };
    window.addEventListener('resize', handleResize);

    const render = () => {
      if (isDisposed) return;

      try {
        const width = canvas.width / dpr;
        const h = canvas.height / dpr;

        if (width > 0 && h > 0) {
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.clearRect(0, 0, width, h);

          let freqData = staticBufferRef.current;
          if (getFrequencyDataRef.current) {
            try {
              const raw = getFrequencyDataRef.current();
              if (raw && raw.length) {
                freqData = raw;
              }
            } catch (e) {}
          }

          const active = isActiveRef.current;

          if (mode === 'bars') {
            const gap = 3;
            const totalGaps = Math.max(0, (barCount - 1) * gap);
            const barWidth = Math.max(2, (width - totalGaps) / barCount);
            const centerY = h / 2;

            for (let i = 0; i < barCount; i++) {
              const dataVal = freqData[i] || 0;
              const syntheticVal = Math.sin(Date.now() * 0.005 + i * 0.45) * 20 + 28;
              const val = active ? Math.max(dataVal, syntheticVal * 0.7) : 4;
              const barHeight = Math.max(3, Math.min(h - 4, (val / 255) * (h - 8)));
              const x = i * (barWidth + gap);
              const y = centerY - (barHeight / 2);

              const alpha = active ? Math.min(1, 0.4 + (val / 255) * 0.6) : 0.15;
              ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
              ctx.beginPath();
              const radius = Math.min(2, barWidth / 2, barHeight / 2);
              if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(x, y, barWidth, barHeight, radius);
              } else {
                ctx.rect(x, y, barWidth, barHeight);
              }
              ctx.fill();
            }
          } else if (mode === 'wave') {
            const centerY = h / 2;
            ctx.beginPath();
            ctx.strokeStyle = active ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 2;

            for (let i = 0; i < width; i += 3) {
              const idx = Math.floor((i / width) * (freqData.length || 32));
              const val = active ? (freqData[idx] || 20) : 4;
              const offset = Math.sin(i * 0.05 + Date.now() * 0.005) * (val / 4);
              const y = centerY + offset;
              if (i === 0) ctx.moveTo(i, y);
              else ctx.lineTo(i, y);
            }
            ctx.stroke();
          } else if (mode === 'aura') {
            const centerX = width / 2;
            const centerY = h / 2;
            const baseRadius = Math.min(centerX, centerY) * 0.6;
            let sum = 0;
            for (let i = 0; i < freqData.length; i++) sum += freqData[i];
            const avg = active ? (sum / (freqData.length || 1)) : 8;
            const pulse = (avg / 255) * 16;

            ctx.beginPath();
            ctx.arc(centerX, centerY, Math.max(1, baseRadius + pulse + 8), 0, Math.PI * 2);
            ctx.fillStyle = active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(centerX, centerY, Math.max(1, baseRadius + pulse), 0, Math.PI * 2);
            ctx.fillStyle = active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)';
            ctx.fill();
          }

          ctx.restore();
        }
      } catch (err) {
        // Suppress any canvas rendering glitch to keep the UI smooth
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [mode, barCount, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${height}px` }}
      className={`w-full block ${className}`}
    />
  );
}
