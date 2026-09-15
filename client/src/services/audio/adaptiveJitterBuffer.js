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
    this.currentSpeed = 1.0;
  }

  // Registra la llegada de un paquete de red para actualizar la estimación de jitter
  onPacketArrival(serverTimestamp) {
    const now = Date.now();
    if (this.lastPacketTime !== null && serverTimestamp !== undefined && serverTimestamp !== null) {
      let transit = 0;

      // Si el timestamp viene en UInt32 (LVBP v1.1, menor a 2^32), calcular con aritmética modular UInt32
      if (serverTimestamp < 4294967296 && serverTimestamp > 0) {
        const now32 = (now >>> 0);
        transit = (now32 - (serverTimestamp >>> 0)) >>> 0;
      } else {
        transit = Math.max(0, now - serverTimestamp);
      }

      if (this.lastTransitTime !== null) {
        const d = Math.abs(transit - this.lastTransitTime);
        // Filtrar saltos anormales causados por suspensión de pestaña móvil (> 1500ms)
        if (d < 1500) {
          this.jitterEstMs += (d - this.jitterEstMs) / 16.0; // Filtro IIR de 1er orden RFC-3550
          // Delimitar jitter a límites acústicos razonables [10ms, 150ms]
          this.jitterEstMs = Math.min(150, Math.max(10, this.jitterEstMs));
        }
      }
      this.lastTransitTime = transit;
    }
    this.lastPacketTime = now;
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
    this.currentSpeed = 1.0;
  }
}
