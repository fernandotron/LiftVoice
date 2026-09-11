/**
 * asr-audio-worklet.js — AudioWorkletProcessor para transcripción en vivo por streaming (LiftVoice)
 *
 * Corre en el hilo de audio dedicado (Web Audio API) y para cada bloque de audio:
 *   1. Baja la frecuencia de muestreo del AudioContext (típ. 44.1 kHz o 48 kHz) a 16 kHz
 *      mediante interpolación lineal con cursor continuo entre bloques (sin saltos).
 *   2. Convierte Float32 [-1, 1] a PCM lineal de 16 bits (linear16 Int16Array) que requiere Deepgram.
 *   3. Aplica VAD por RMS en tiempo real: suprime silencio prolongado para ahorrar ancho de banda,
 *      pero preserva una cola de hangover (0.6s) para que el silencio de cierre llegue al backend
 *      y Deepgram active el endpointing acústico (is_final).
 *   4. Acumula PCM y emite bloques de ~100ms (chunkMs) de audio por mensaje (el punto dulce de Deepgram),
 *      vaciando la cola de inmediato al entrar en silencio.
 *
 * Emite ArrayBuffers transferibles al hilo principal (zero-copy).
 */

const DEFAULT_TARGET_RATE = 16000;
const DEFAULT_SILENCE_THRESHOLD = 0.008; // RMS por debajo de este valor ≈ silencio
const DEFAULT_HANGOVER_SECONDS = 0.6; // cola de audio tras la última voz detectada
const DEFAULT_CHUNK_MS = 100; // audio objetivo por mensaje WebSocket (~100ms)

class ASRAudioWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.targetRate = opts.targetSampleRate || DEFAULT_TARGET_RATE;
    this.silenceThreshold =
      typeof opts.silenceThreshold === 'number' ? opts.silenceThreshold : DEFAULT_SILENCE_THRESHOLD;
    
    // sampleRate es global en el scope del AudioWorklet (rate del AudioContext nativo)
    this.ratio = sampleRate / this.targetRate;
    
    const hangoverSeconds =
      typeof opts.hangoverSeconds === 'number' ? opts.hangoverSeconds : DEFAULT_HANGOVER_SECONDS;
    this.hangoverSamples = Math.round(hangoverSeconds * sampleRate);
    this.cursor = 0;
    this.silenceRun = 0;
    this.lastInputSample = 0;

    // 2nd-order Butterworth IIR Low-Pass filter (fc = 7.2 kHz) para suprimir aliasing
    const cutoff = Math.min(7200, (this.targetRate / 2) * 0.9);
    const nyquist = sampleRate / 2;
    if (cutoff < nyquist && sampleRate > this.targetRate) {
      const w0 = (2 * Math.PI * cutoff) / sampleRate;
      const alpha = Math.sin(w0) / (2 * Math.SQRT1_2); // Q = 1/sqrt(2) = 0.7071
      const cosw0 = Math.cos(w0);
      const a0 = 1 + alpha;
      this.b0 = (1 - cosw0) / (2 * a0);
      this.b1 = (1 - cosw0) / a0;
      this.b2 = (1 - cosw0) / (2 * a0);
      this.a1 = (-2 * cosw0) / a0;
      this.a2 = (1 - alpha) / a0;
      this.hasFilter = true;
    } else {
      this.hasFilter = false;
    }
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
    this.filterBuf = new Float32Array(128);

    const chunkMs = typeof opts.chunkMs === 'number' && opts.chunkMs > 0 ? opts.chunkMs : DEFAULT_CHUNK_MS;
    this.chunkSamples = Math.max(1, Math.round((this.targetRate * chunkMs) / 1000));
    this.chunkBuf = new Int16Array(this.chunkSamples);
    this.pending = 0;
  }

  resetFilterState() {
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
    this.lastInputSample = 0;
  }

  // Filtrado IIR biquad paso bajo en línea
  filterSample(x) {
    if (!this.hasFilter) return x;
    const safeX = Number.isFinite(x) ? x : 0;
    let y = this.b0 * safeX + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    if (Math.abs(y) < 1e-15) y = 0;
    this.x2 = this.x1;
    this.x1 = safeX;
    this.y2 = Math.abs(this.y1) < 1e-15 ? 0 : this.y1;
    this.y1 = y;
    return y;
  }

  pushSample(sample) {
    const s = Math.max(-1, Math.min(1, sample));
    this.chunkBuf[this.pending++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.pending >= this.chunkSamples) {
      this.flush();
    }
  }

  flush() {
    if (this.pending === 0) return;
    // Buffer transferible exacto para zero-copy sin fragmentación
    const out = new Int16Array(this.pending);
    out.set(this.chunkBuf.subarray(0, this.pending));
    this.pending = 0;
    this.port.postMessage(out.buffer, [out.buffer]);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    const n = channel.length;

    // --- VAD por RMS del bloque ---
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      sumSq += channel[i] * channel[i];
    }
    const rms = Math.sqrt(sumSq / n);
    const voiced = rms >= this.silenceThreshold;

    const wasInSilence = this.silenceRun > this.hangoverSamples;
    if (voiced) {
      if (wasInSilence) {
        this.resetFilterState();
      }
      this.silenceRun = 0;
    } else {
      this.silenceRun += n;
    }

    const shouldSend = voiced || this.silenceRun <= this.hangoverSamples;

    // --- H1: Filtrado Butterworth LPF (fc = 7.2 kHz) a frecuencia nativa ANTES del diezmado ---
    let filteredChannel = channel;
    if (this.hasFilter) {
      if (!this.filterBuf || this.filterBuf.length < n) {
        this.filterBuf = new Float32Array(n);
      }
      for (let i = 0; i < n; i++) {
        this.filterBuf[i] = this.filterSample(channel[i]);
      }
      filteredChannel = this.filterBuf;
    }

    // --- Downsample a 16 kHz con interpolación continua ---
    while (this.cursor < n - 1) {
      const i = Math.floor(this.cursor);
      const frac = this.cursor - i;
      const s0 = i >= 0 ? filteredChannel[i] : this.lastInputSample;
      const s1 = filteredChannel[i + 1];
      const rawSample = s0 + (s1 - s0) * frac;
      if (shouldSend) {
        this.pushSample(rawSample);
      }
      this.cursor += this.ratio;
    }
    this.cursor -= n;
    this.lastInputSample = filteredChannel[n - 1];

    // Al entrar en silencio (fin del hangover), vaciar la cola acumulada
    if (!shouldSend) {
      this.flush();
    }

    return true;
  }
}

registerProcessor('asr-audio-worklet', ASRAudioWorkletProcessor);
