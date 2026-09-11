# ISSUE-02: AudioWorklet Processor y PcmBacklog Ring Buffer

## 1. Contexto y Justificación
`LiftVoice` actual depende de `MediaRecorder` emitiendo bloques WebM/Opus comprimidos cada 250ms, lo cual genera alta latencia, sobrecarga de codificación en el hilo principal y pausas de recolección de basura. Asimismo, ante congestión de red o microcortes, no existe un ring buffer que preserve las muestras de audio sin saturar la memoria.

Adoptando el patrón probado de `app-salud-inteligente`, se implementará un `AudioWorkletProcessor` nativo en el hilo de audio del navegador que realiza el muestreo, conversión PCM16 y Voice Activity Detection (VAD) de ultra-bajo consumo, junto con `PcmBacklog`, un ring buffer acotado por bytes para tolerar backpressure.

## 2. Alcance Técnico
1. **AudioWorklet (`client/public/asr-audio-worklet.js`)**:
   - Corre en el hilo de audio (`AudioWorkletGlobalScope`).
   - Downsampling continuo con interpolación lineal desde la tasa del hardware (44.1 kHz / 48 kHz) a exactamente **16.000 Hz** (16 kHz mono).
   - Conversión de `Float32 [-1, 1]` a enteros `linear16` (`Int16Array`).
   - VAD por RMS en tiempo real:
     - Umbral de silencio configurable (`silenceThreshold = 0.008`).
     - Hangover de cierre (`hangoverSeconds = 0.6s`) para garantizar que el silencio de cierre alcance a Deepgram y active el endpointing.
   - Batching de salida a ~100 ms (`ASR_CHUNK_MS = 100`) evitando el overhead de emitir un mensaje por cada render quantum (2.7 ms).
   - Envío de buffers transferibles (`ArrayBuffer`) con zero-copy al hilo principal.
2. **Ring Buffer (`client/src/services/pcmBacklog.js`)**:
   - Clase `PcmBacklog` desacoplada de DOM y Web Audio.
   - Límite máximo acotado: 262.144 bytes (~8 segundos de audio PCM16 a 16 kHz).
   - Política FIFO de descarte: si excede la capacidad, elimina los bloques más viejos (`drop-oldest`), protegiendo la memoria del navegador.
   - Método `drain(sendFn)` que respeta el backpressure (si `sendFn` devuelve `false`, detiene el drenado y conserva el audio pendiente).

## 3. Criterios de Aceptación (Acceptance Criteria)
- [ ] `asr-audio-worklet.js` está disponible en la carpeta pública del cliente y se carga sin errores mediante `audioContext.audioWorklet.addModule()`.
- [ ] El worklet emite chunks de audio `Int16Array` mono a 16 kHz a intervalos de ~100 ms.
- [ ] El VAD por RMS suprime el audio en silencio prolongado y vacía la cola pendiente al detectar fin de voz.
- [ ] `PcmBacklog` acumula chunks correctamente, respeta la cota de memoria de 256 KB y drena en orden FIFO sin pérdida cuando la conexión se restablece.
