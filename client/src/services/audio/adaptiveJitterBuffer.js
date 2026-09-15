/**
 * adaptiveJitterBuffer.js
 * RFC-3550 Inspired Adaptive Jitter Estimator & Speed Controller (2026 Edition)
 * Dynamically computes optimal WSOLA playback speed to absorb network fluctuations.
 */

export class AdaptiveJitterBuffer {
  constructor({ targetLatencyMs = 80, minSpeed = 0.92, maxSpeed = 1.12 } = {}) {
    this.targetLatencyMs = targetLatencyMs;
    this.minSpeed = minSpeed;
    this.maxSpeed = maxSpeed;

    this.jitterEstMs = 20;
    this.lastTransitTime = null;
    this.lastPacketTime = null;
    this.lastServerTimestamp = null;
    this.currentSpeed = 1.0;
  }

  // Registra la llegada de un paquete de red para actualizar la estimación de jitter
  onPacketArrival(serverTimestamp) {
    const now = Date.now();
    if (this.lastPacketTime !== null && this.lastServerTimestamp !== null && serverTimestamp !== undefined && serverTimestamp !== null) {
      // Diferencial estricto RFC-3550: D(i, j) = (R_j - R_i) - (S_j - S_i)
      // Al restar deltas locales, se elimina matemáticamente cualquier desfase absoluto de reloj (clock skew).
      let d = 0;
      if (serverTimestamp < 4294967296 && serverTimestamp > 0) {
        const rDiff = ((now >>> 0) - (this.lastPacketTime >>> 0)) | 0;
        const sDiff = ((serverTimestamp >>> 0) - (this.lastServerTimestamp >>> 0)) | 0;
        d = Math.abs(rDiff - sDiff);
      } else {
        const rDiff = now - this.lastPacketTime;
        const sDiff = serverTimestamp - this.lastServerTimestamp;
        d = Math.abs(rDiff - sDiff);
      }

      // Filtrar saltos anormales causados por suspensión de pestaña móvil (> 1500ms)
      if (d < 1500) {
        this.jitterEstMs += (d - this.jitterEstMs) / 16.0; // Filtro IIR de 1er orden RFC-3550
        // Delimitar jitter a límites acústicos razonables [10ms, 150ms]
        this.jitterEstMs = Math.min(150, Math.max(10, this.jitterEstMs));
      }
    }
    this.lastPacketTime = now;
    this.lastServerTimestamp = serverTimestamp !== undefined ? serverTimestamp : null;
  }

  /**
   * Calcula la velocidad WSOLA óptima en función del número de muestras amortiguadas
   * Incluye limitador de pendiente (slew-rate) para eliminar wow/flutter psicoacústico
   */
  computeOptimalPlaybackRate(currentBufferedSamples, sampleRate = 48000) {
    const sr = (sampleRate && sampleRate >= 16000) ? sampleRate : 48000;
    const currentBufferMs = (Math.max(0, currentBufferedSamples) / sr) * 1000;
    // El watermark dinámico se adapta si la red fluctúa
    const targetBufferMs = Math.max(this.targetLatencyMs, this.jitterEstMs * 2.5);

    const deltaMs = currentBufferMs - targetBufferMs;

    let rawRate = 1.0;
    // Banda muerta de estabilidad (+-15ms): velocidad nominal 1.0x
    if (Math.abs(deltaMs) >= 15) {
      if (deltaMs < 0) {
        // Buffer por debajo de lo ideal (riesgo de underrun) -> Ralentizar sutilmente
        const deficitRatio = Math.min(1.0, Math.abs(deltaMs) / 70);
        rawRate = 1.0 - (1.0 - this.minSpeed) * deficitRatio; // Ej: 0.94x
      } else {
        // Buffer por encima de lo ideal (latencia acumulándose) -> Acelerar sutilmente
        const surplusRatio = Math.min(1.0, deltaMs / 120);
        rawRate = 1.0 + (this.maxSpeed - 1.0) * surplusRatio; // Ej: 1.08x
      }
    }

    // Limitador de pendiente (slew-rate limiter) de máx ±0.003 por ciclo para evitar modulación de tono
    const maxDelta = 0.003;
    if (rawRate > this.currentSpeed + maxDelta) {
      this.currentSpeed += maxDelta;
    } else if (rawRate < this.currentSpeed - maxDelta) {
      this.currentSpeed -= maxDelta;
    } else {
      this.currentSpeed = rawRate;
    }

    return this.currentSpeed;
  }

  reset() {
    this.jitterEstMs = 20;
    this.lastTransitTime = null;
    this.lastPacketTime = null;
    this.lastServerTimestamp = null;
    this.currentSpeed = 1.0;
  }
}
