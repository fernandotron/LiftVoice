/**
 * PcmBacklog — Ring buffer acotado por bytes para PCM16 (LiftVoice)
 *
 * Acumula temporalmente los fragmentos de PCM que no se pudieron enviar al WebSocket
 * (durante una reconexión de red o congestión de buffer). Se reproduce en orden FIFO
 * al reabrir el socket o al aliviarse la congestión.
 *
 * Si excede el tope configurado (ej. 256 KB ≈ 8s de audio), descarta los bloques
 * MÁS VIEJOS (drop-oldest), protegiendo la memoria del navegador.
 */
export class PcmBacklog {
  constructor(maxBytes = 262144) {
    this.maxBytes = maxBytes;
    this.chunks = [];
    this.bytes = 0;
  }

  get size() {
    return this.chunks.length;
  }

  get byteLength() {
    return this.bytes;
  }

  /** Encola un ArrayBuffer; si excede el tope, descarta los más viejos (ring acotado) */
  push(buffer) {
    if (!buffer || !buffer.byteLength) return;
    let safeBuffer = buffer;
    if (safeBuffer.byteLength % 2 !== 0) {
      safeBuffer = safeBuffer.slice(0, safeBuffer.byteLength - 1);
    }
    if (!safeBuffer.byteLength) return;

    this.chunks.push(safeBuffer);
    this.bytes += safeBuffer.byteLength;
    while (this.bytes > this.maxBytes && this.chunks.length > 0) {
      const dropped = this.chunks.shift();
      if (dropped) {
        this.bytes -= dropped.byteLength;
      }
    }
  }

  /**
   * Drena en orden FIFO llamando a `send` por cada chunk.
   * Si `send` devuelve `false` (backpressure / socket no listo), detiene el drenado
   * y conserva el resto para el próximo intento (no pierde audio).
   */
  drain(send) {
    while (this.chunks.length > 0) {
      const next = this.chunks[0];
      if (!send(next)) {
        break; // Backpressure detectado: retener el resto
      }
      this.chunks.shift();
      this.bytes -= next.byteLength;
    }
  }

  /** Vacía el buffer */
  clear() {
    this.chunks = [];
    this.bytes = 0;
  }
}
