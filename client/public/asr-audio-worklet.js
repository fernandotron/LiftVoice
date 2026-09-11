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

    const chunkMs = typeof opts.chunkMs === 'number' && opts.chunkMs > 0 ? opts.chunkMs : DEFAULT_CHUNK_MS;
    this.chunkSamples = Math.max(1, Math.round((this.targetRate * chunkMs) / 1000));
    this.chunkBuf = new Int16Array(this.chunkSamples);
    this.pending = 0;
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
    const out = this.chunkBuf.slice(0, this.pending);
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

    if (voiced) {
      this.silenceRun = 0;
    } else {
      this.silenceRun += n;
    }

    const shouldSend = voiced || this.silenceRun <= this.hangoverSamples;

    // --- Downsample a 16 kHz por interpolación lineal ---
    while (this.cursor < n) {
      const i = Math.floor(this.cursor);
      const frac = this.cursor - i;
      const s0 = channel[i];
      const s1 = i + 1 < n ? channel[i + 1] : s0;
      if (shouldSend) {
        this.pushSample(s0 + (s1 - s0) * frac);
      }
      this.cursor += this.ratio;
    }
    this.cursor -= n; // arrastrar el remanente al siguiente bloque

    // Al entrar en silencio (fin del hangover), vaciar la cola acumulada
    if (!shouldSend) {
      this.flush();
    }

    return true;
  }
}

registerProcessor('asr-audio-worklet', ASRAudioWorkletProcessor);
