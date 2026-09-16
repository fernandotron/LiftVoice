/**
 * wsolaEngine.js
 * High-Performance Waveform Similarity Overlap-Add (WSOLA) Time-Stretcher (2026 Edition)
 * Pitch-preserving time-scale modification for continuous conversational audio.
 * Allows seamless speed modulation (0.90x to 1.15x) without altering voice pitch.
 */

export class WsolaTimeStretcher {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this._recomputeParameters();

    this.inputBuffer = new Float32Array(this.sampleRate * 12); // 12 segundos de historial para soportar frases extensas
    this.inputWritePos = 0;
    this.inputReadPos = 0;
    this.samplesAvailable = 0;
    this.totalSamplesWritten = 0;

    this.overlapBuffer = new Float32Array(this.halfWindow);
    this.hasOverlap = false;
  }

  _recomputeParameters() {
    // Ventana de análisis de 20ms: equilibrio ideal entre fidelidad de formantes y latencia
    this.windowSize = Math.round((this.sampleRate * 20) / 1000);
    if (this.windowSize % 2 !== 0) this.windowSize++;
    this.halfWindow = this.windowSize / 2;

    // Desplazamiento de búsqueda ampliado a ±12ms para acomodar F0 graves masculinos (85Hz = 11.76ms)
    this.maxSearchDelta = Math.round((this.sampleRate * 12) / 1000);

    // Ventana de Hanning precalculada con partición de unidad exacta (C1)
    this.window = new Float32Array(this.windowSize);
    for (let i = 0; i < this.windowSize; i++) {
      this.window[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (this.windowSize - 1)));
    }

    // Tablas normalizadas de solapamiento precalculadas para eliminar divisiones por muestra en tiempo real
    this.windowIn = new Float32Array(this.halfWindow);
    this.windowOverlap = new Float32Array(this.halfWindow);
    for (let i = 0; i < this.halfWindow; i++) {
      const wIn = this.window[i];
      const wOverlap = this.window[this.halfWindow + i];
      const norm = (wIn + wOverlap) || 1.0;
      this.windowIn[i] = wIn / norm;
      this.windowOverlap[i] = wOverlap / norm;
    }
  }

  setSampleRate(newRate) {
    if (newRate && newRate !== this.sampleRate && newRate >= 16000 && newRate <= 96000) {
      this.sampleRate = newRate;
      this._recomputeParameters();
      this.inputBuffer = new Float32Array(this.sampleRate * 12);
      this.overlapBuffer = new Float32Array(this.halfWindow);
      this.reset();
    }
  }

  writeInput(samples) {
    if (!samples || samples.length === 0) return;
    const num = samples.length;
    const bufLen = this.inputBuffer.length;

    // Protección ante desbordamiento de búfer: descartar muestras viejas si el productor supera la capacidad
    if (this.samplesAvailable + num > bufLen) {
      const overflow = (this.samplesAvailable + num) - bufLen;
      this.inputReadPos = this._mod(this.inputReadPos + overflow, bufLen);
      this.samplesAvailable = bufLen - num;
    }

    for (let i = 0; i < num; i++) {
      this.inputBuffer[this.inputWritePos] = samples[i];
      this.inputWritePos = (this.inputWritePos + 1) % bufLen;
    }
    this.samplesAvailable += num;
    this.totalSamplesWritten += num;
  }

  /**
   * Helper Euclidean modulo to avoid negative indexing in circular buffers
   */
  _mod(n, m) {
    return ((n % m) + m) % m;
  }

  /**
   * Procesa y extrae muestras con una tasa de velocidad `timeScale`
   */
  process(timeScale = 1.0, maxOutputSamples = null) {
    const bufLen = this.inputBuffer.length;
    const effectiveMax = (typeof maxOutputSamples === 'number' && maxOutputSamples > 0)
      ? maxOutputSamples
      : Math.max(4096, Math.ceil(this.samplesAvailable / Math.max(0.5, timeScale)) + 8192);

    // 1. FAST BYPASS (1.0x nominal): Evaluate BEFORE minRequired check so chunks of any size drain directly
    if (Math.abs(timeScale - 1.0) < 0.005) {
      if (this.hasOverlap) {
        if (this.samplesAvailable < this.halfWindow) {
          return new Float32Array(0);
        }
        const blendCount = Math.min(this.halfWindow, this.samplesAvailable, effectiveMax);
        const remainingToTake = Math.min(this.samplesAvailable - blendCount, Math.max(0, effectiveMax - blendCount));
        const totalOut = blendCount + remainingToTake;
        const out = new Float32Array(totalOut);
        for (let i = 0; i < blendCount; i++) {
          const inSample = this.inputBuffer[this._mod(this.inputReadPos + i, bufLen)];
          out[i] = this.overlapBuffer[i] * this.windowOverlap[i] + inSample * this.windowIn[i];
        }
        this.inputReadPos = this._mod(this.inputReadPos + blendCount, bufLen);
        this.samplesAvailable -= blendCount;
        this.hasOverlap = false;

        for (let i = 0; i < remainingToTake; i++) {
          out[blendCount + i] = this.inputBuffer[this.inputReadPos];
          this.inputReadPos = this._mod(this.inputReadPos + 1, bufLen);
        }
        this.samplesAvailable -= remainingToTake;
        return out;
      }

      // Direct bypass: take all available samples without artificial barrier
      if (this.samplesAvailable === 0) return new Float32Array(0);
      const take = Math.min(this.samplesAvailable, effectiveMax);
      const out = new Float32Array(take);
      for (let i = 0; i < take; i++) {
        out[i] = this.inputBuffer[this.inputReadPos];
        this.inputReadPos = this._mod(this.inputReadPos + 1, bufLen);
      }
      this.samplesAvailable -= take;
      return out;
    }

    // 2. ACTIVE WSOLA SEARCH: Required only when stretching or compressing
    const minRequired = this.windowSize + this.maxSearchDelta * 2 + (this.hasOverlap ? 0 : this.halfWindow);
    if (this.samplesAvailable < minRequired) {
      return new Float32Array(0);
    }

    // Pre-asignación en typed array para cero presión en el Garbage Collector
    const outBuffer = new Float32Array(effectiveMax);
    let outCount = 0;
    const stepSynthesis = this.halfWindow;
    const stepAnalysis = Math.max(1, Math.round(stepSynthesis * timeScale));

    while (
      this.samplesAvailable >= (this.windowSize + this.maxSearchDelta * 2 + (this.hasOverlap ? 0 : this.halfWindow)) &&
      (outCount + this.halfWindow) <= effectiveMax
    ) {
      if (!this.hasOverlap) {
        // Primera trama: inicializar overlap
        for (let i = 0; i < this.halfWindow; i++) {
          const idx = this._mod(this.inputReadPos + i, bufLen);
          this.overlapBuffer[i] = this.inputBuffer[idx];
        }
        this.inputReadPos = this._mod(this.inputReadPos + this.halfWindow, bufLen);
        this.samplesAvailable -= this.halfWindow;
        this.hasOverlap = true;
      }

      // Encontrar el desfase óptimo delta en el rango [-maxSearchDelta, +maxSearchDelta]
      const bestOffset = this._findBestMatch(this.inputReadPos, this.overlapBuffer);
      const alignedPos = this.inputReadPos + bestOffset;

      // Overlap-Add entre la cola anterior y la nueva trama sincronizada
      for (let i = 0; i < this.halfWindow; i++) {
        const inSample = this.inputBuffer[this._mod(alignedPos + i, bufLen)];
        outBuffer[outCount++] = this.overlapBuffer[i] * this.windowOverlap[i] + inSample * this.windowIn[i];

        // Guardar la segunda mitad de la ventana para el siguiente solapamiento
        const nextInSample = this.inputBuffer[this._mod(alignedPos + this.halfWindow + i, bufLen)];
        this.overlapBuffer[i] = nextInSample;
      }

      // Avanzar el cursor de análisis según la escala temporal
      this.inputReadPos = this._mod(this.inputReadPos + stepAnalysis, bufLen);
      this.samplesAvailable -= stepAnalysis;
    }

    return outCount === effectiveMax ? outBuffer : outBuffer.slice(0, outCount);
  }

  // Búsqueda de similitud de forma de onda en dos fases: gruesa (x2) + refinamiento fino (±1 muestra)
  _findBestMatch(targetPos, template) {
    let minDiff = Infinity;
    let bestDelta = 0;
    const bufLen = this.inputBuffer.length;
    // Protección de límite inferior calculada sobre el historial real de muestras acumuladas en el buffer circular
    const historySamples = this.totalSamplesWritten > 0
      ? Math.max(0, Math.min(this.totalSamplesWritten, bufLen) - this.samplesAvailable)
      : targetPos;
    const minDelta = Math.max(-this.maxSearchDelta, -historySamples);

    for (let delta = minDelta; delta <= this.maxSearchDelta; delta += 2) {
      let diff = 0;
      const start = targetPos + delta;
      for (let i = 0; i < this.halfWindow; i += 2) { // Decimación x2 (Nyquist a 12 kHz, sin aliasing de formantes)
        const idx = this._mod(start + i, bufLen);
        diff += Math.abs(this.inputBuffer[idx] - template[i]);
        if (diff > minDiff) break;
      }
      if (diff < minDiff) {
        minDiff = diff;
        bestDelta = delta;
      }
    }

    // Refinamiento fino local ±1 muestra para eliminar filtrado en peine en altas frecuencias
    const fineDeltas = [bestDelta - 1, bestDelta + 1];
    for (const d of fineDeltas) {
      if (d < minDelta || d > this.maxSearchDelta) continue;
      let diff = 0;
      const start = targetPos + d;
      for (let i = 0; i < this.halfWindow; i += 2) {
        const idx = this._mod(start + i, bufLen);
        diff += Math.abs(this.inputBuffer[idx] - template[i]);
        if (diff > minDiff) break;
      }
      if (diff < minDiff) {
        minDiff = diff;
        bestDelta = d;
      }
    }

    return bestDelta;
  }

  drain() {
    const bufLen = this.inputBuffer.length;
    let outCount = 0;
    const out = new Float32Array(this.samplesAvailable + (this.hasOverlap ? this.halfWindow : 0));

    if (this.hasOverlap) {
      const blendCount = Math.min(this.halfWindow, this.samplesAvailable);
      for (let i = 0; i < blendCount; i++) {
        const inSample = this.inputBuffer[this._mod(this.inputReadPos + i, bufLen)];
        out[outCount++] = this.overlapBuffer[i] * this.windowOverlap[i] + inSample * this.windowIn[i];
      }
      for (let i = blendCount; i < this.halfWindow; i++) {
        out[outCount++] = this.overlapBuffer[i] * this.windowOverlap[i];
      }
      this.inputReadPos = this._mod(this.inputReadPos + blendCount, bufLen);
      this.samplesAvailable -= blendCount;
      this.hasOverlap = false;
    }

    while (this.samplesAvailable > 0) {
      out[outCount++] = this.inputBuffer[this.inputReadPos];
      this.inputReadPos = this._mod(this.inputReadPos + 1, bufLen);
      this.samplesAvailable--;
    }

    this.reset();
    return out.subarray(0, outCount);
  }

  reset() {
    this.inputWritePos = 0;
    this.inputReadPos = 0;
    this.samplesAvailable = 0;
    this.totalSamplesWritten = 0;
    this.hasOverlap = false;
    if (this.overlapBuffer) this.overlapBuffer.fill(0);
  }
}
