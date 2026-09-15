/**
 * stream-playout-worklet.js
 * LiftVoice Ultra-Low Latency Audio Worklet Playout Processor (2026 Edition)
 * Continuous SPSC circular buffer consumer with zero-click underrun protection.
 */

class StreamPlayoutProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    // Capacidad del buffer circular: 2 segundos a 48kHz = 96,000 muestras
    this.bufferSize = (options && options.processorOptions && options.processorOptions.bufferSize) || 96000;
    this.ringBuffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.availableSamples = 0;

    // Control de micro-fades para evitar clics DC en caso de underrun / recuperación
    this.lastSample = 0.0;
    this.isUnderrun = true;
    this.fadeInRemaining = 0;
    this.prefillThreshold = 1024; // Esperar al menos ~20ms antes de comenzar a vaciar
    this.samplesSinceReport = 0;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'push' && data.samples) {
        this.write(data.samples);
      } else if (data.command === 'flush') {
        this.flush();
      }
    };
  }

  write(samples) {
    const len = samples.length;
    if (len === 0) return;

    // Si el bloque entrante es mayor o igual a la capacidad total, recortar a las muestras más recientes
    let samplesToWrite = samples;
    let actualLen = len;
    if (len >= this.bufferSize) {
      samplesToWrite = samples.subarray(len - this.bufferSize);
      actualLen = this.bufferSize;
      this.readIndex = 0;
      this.writeIndex = 0;
      this.availableSamples = 0;
    } else if (this.availableSamples + actualLen > this.bufferSize) {
      const overflow = (this.availableSamples + actualLen) - this.bufferSize;
      this.readIndex = (this.readIndex + overflow) % this.bufferSize;
      this.availableSamples = this.bufferSize - actualLen;
    }

    for (let i = 0; i < actualLen; i++) {
      this.ringBuffer[this.writeIndex] = samplesToWrite[i];
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    }
    this.availableSamples += actualLen;

    if (this.isUnderrun && this.availableSamples >= this.prefillThreshold) {
      this.isUnderrun = false;
      this.fadeInRemaining = 64; // Rampa suave de coseno elevado (Hann)
    }
  }

  flush() {
    this.readIndex = 0;
    this.writeIndex = 0;
    this.availableSamples = 0;
    this.isUnderrun = true;
    this.lastSample = 0.0;
    this.fadeInRemaining = 0;
    this.samplesSinceReport = 0;
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const channelLeft = output[0];
    const channelRight = output[1] || channelLeft;
    const quantumSize = channelLeft.length; // Siempre 128 muestras en Web Audio

    if (this.isUnderrun || this.availableSamples < quantumSize) {
      // SUBDESBORDAMIENTO (Underrun): Decaimiento exponencial suave a 0 para prevenir pop digital
      this.isUnderrun = true;
      this.fadeInRemaining = 0;
      for (let i = 0; i < quantumSize; i++) {
        this.lastSample *= 0.85; // Decaimiento rápido en <1ms
        channelLeft[i] = this.lastSample;
        if (channelRight !== channelLeft) channelRight[i] = this.lastSample;
      }
      return true;
    }

    // LECTURA CONTÍNUA DEL BUFFER CIRCULAR CON RAMPA DE ENTRADA SUAVE (Hann Raised-Cosine C1)
    for (let i = 0; i < quantumSize; i++) {
      let sample = this.ringBuffer[this.readIndex];
      this.readIndex = (this.readIndex + 1) % this.bufferSize;

      if (this.fadeInRemaining > 0) {
        const progress = 1.0 - (this.fadeInRemaining / 64);
        const factor = 0.5 * (1.0 - Math.cos(Math.PI * progress));
        sample *= factor;
        this.fadeInRemaining--;
      }

      channelLeft[i] = sample;
      if (channelRight !== channelLeft) channelRight[i] = sample;
      this.lastSample = sample;
    }

    this.availableSamples -= quantumSize;

    // Reporte determinista de telemetría cada ~2048 muestras (~42ms)
    this.samplesSinceReport += quantumSize;
    if (this.samplesSinceReport >= 2048) {
      this.samplesSinceReport = 0;
      this.port.postMessage({
        type: 'status',
        bufferedSamples: this.availableSamples,
        sampleRate: typeof sampleRate !== 'undefined' ? sampleRate : 48000
      });
    }

    return true;
  }
}

registerProcessor('stream-playout-processor', StreamPlayoutProcessor);
