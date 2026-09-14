/**
 * asr-audio-worklet.js — AudioWorkletProcessor para transcripción en vivo por streaming (LiftVoice)
 *
 * Corre en el hilo de audio dedicado (Web Audio API) y para cada bloque de audio (render quantum de 128 muestras):
 *   1. Baja la frecuencia de muestreo del AudioContext (típ. 44.1 kHz o 48 kHz, hasta 96 kHz) a 16 kHz
 *      mediante interpolación lineal con cursor continuo entre bloques (sin saltos ni desfases periódicos).
 *   2. Convierte Float32 [-1, 1] a PCM lineal de 16 bits (linear16 Int16Array) requerido por Deepgram.
 *   3. Aplica VAD por RMS en tiempo real: suprime silencio prolongado para ahorrar ancho de banda y cuota,
 *      pero preserva una cola de hangover (0.6s) para que el silencio de cierre llegue intacto al backend
 *      y Deepgram active el endpointing acústico (is_final).
 *   4. Acumula PCM y emite bloques de ~100ms (chunkMs) de audio por mensaje (el punto dulce de Deepgram),
 *      vaciando la cola de inmediato al entrar en silencio sin retener el audio residual.
 *
 * Emite ArrayBuffers transferibles al hilo principal (zero-copy IPC).
 */

const DEFAULT_TARGET_RATE = 16000;
const DEFAULT_SILENCE_THRESHOLD = 0.008; // RMS por debajo de este valor ≈ silencio (~ -42 dBFS)
const DEFAULT_HANGOVER_SECONDS = 0.6;   // cola de audio tras la última voz detectada (600ms)
const DEFAULT_CHUNK_MS = 100;           // audio objetivo por mensaje WebSocket (~100ms)

class ASRAudioWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.targetRate = opts.targetSampleRate || DEFAULT_TARGET_RATE;
    this.silenceThreshold =
      typeof opts.silenceThreshold === 'number' ? opts.silenceThreshold : DEFAULT_SILENCE_THRESHOLD;

    // sampleRate es global en el scope del AudioWorklet (rate nativo del AudioContext, ej: 44100, 48000, 96000)
    this.ratio = sampleRate / this.targetRate;

    // Respetar 0 explícito si se configura
    const hangoverSeconds =
      typeof opts.hangoverSeconds === 'number' ? opts.hangoverSeconds : DEFAULT_HANGOVER_SECONDS;
    this.hangoverSamples = Math.round(hangoverSeconds * sampleRate);

    this.cursor = 0;       // posición fraccional en muestras de entrada para la próxima muestra de salida
    this.silenceRun = 0;   // contador de muestras consecutivas en silencio

    // Batching de salida: acumula ~chunkMs de audio en 16 kHz antes de transferir por postMessage
    const chunkMs = typeof opts.chunkMs === 'number' && opts.chunkMs > 0 ? opts.chunkMs : DEFAULT_CHUNK_MS;
    this.chunkSamples = Math.max(1, Math.round((this.targetRate * chunkMs) / 1000));
    this.chunkBuf = new Int16Array(this.chunkSamples);
    this.pending = 0;
  }

  // Escala Float32 [-1.0, 1.0] a Int16 [-32768, 32767] y acumula en el buffer
  pushSample(sample) {
    const s = Math.max(-1, Math.min(1, sample));
    this.chunkBuf[this.pending++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.pending >= this.chunkSamples) {
      this.flush();
    }
  }

  // Emite el buffer acumulado como ArrayBuffer transferible (zero-copy) y resetea el acumulador
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

    // --- 1. VAD por RMS en tiempo real para el bloque de render quantum (n=128) ---
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

    // --- 2. Downsampling lineal continuo hacia 16 kHz ---
    // El cursor avanza ininterrumpidamente para mantener sincronía temporal estricta con el reloj de audio
    while (this.cursor < n) {
      const i = Math.floor(this.cursor);
      const frac = this.cursor - i;
      const s0 = channel[i];
      const s1 = i + 1 < n ? channel[i + 1] : s0; // clamp en el borde del bloque (error sub-audible)
      if (shouldSend) {
        this.pushSample(s0 + (s1 - s0) * frac);
      }
      this.cursor += this.ratio;
    }
    // Arrastrar el residuo fraccional positivo al siguiente bloque
    this.cursor -= n;

    // --- 3. Drenaje inmediato al entrar en silencio ---
    // Al superar el hangover, vaciar cualquier audio residual para que el endpointing de Deepgram reciba
    // el silencio de cierre inmediatamente sin esperar a llenar un chunk completo de 100ms.
    if (!shouldSend) {
      this.flush();
    }

    return true; // Mantener vivo el processor
  }
}

registerProcessor('asr-audio-worklet', ASRAudioWorkletProcessor);
