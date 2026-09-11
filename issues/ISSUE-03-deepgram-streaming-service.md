# ISSUE-03: Servicio de Transporte WebSocket Streaming Deepgram

## 1. Contexto y Justificación
Para lograr una experiencia de dictado y traducción simultánea verdaderamente en vivo, la captura debe conectarse mediante un canal WebSocket bidireccional continuo con Deepgram (`wss://api.deepgram.com/v1/listen`), recibiendo hipótesis provisionales inmediatas (`interim_results`) y enunciados consolidados (`is_final`).

Este servicio debe incorporar la robustez probada de `app-salud-inteligente`: separación estricta del ciclo de vida del grafo de audio vs WebSocket, reconexión multi-caída con backoff exponencial, heartbeat KeepAlive, medición de latencia del primer parcial y drenaje seguro de la cola (`CloseStream`).

## 2. Alcance Técnico
1. **Archivo `client/src/services/deepgramStreamingService.js`**:
   - Conexión WebSocket nativa (sin cargar el SDK pesado de `@deepgram/sdk`).
   - Autenticación mediante el subprotocolo `['bearer', token]` obtenido de `POST /api/asr-token`.
   - Parámetros de URL Deepgram:
     - `model=nova-3`
     - `encoding=linear16`
     - `sample_rate=16000`
     - `channels=1`
     - `interim_results=true`
     - `smart_format=true`
     - `endpointing=300` (300 ms de silencio)
     - `utterance_end_ms=1000`
     - Inyección de `keyterm` repetidos para vocabulario técnico.
   - **Separación de Ciclo de Vida**:
     - `start(stream, config, callbacks)`: Construye el grafo de audio (`MediaStreamSourceNode` -> `AudioWorkletNode` -> `GainNode(0)` -> `destination`), monta el listener `onmessage` y abre el socket.
     - `reconnect(config, callbacks)`: Reabre únicamente el socket WebSocket reutilizando el grafo de audio vivo (las muestras producidas durante la caída se bufferizan en `PcmBacklog`).
     - `stop()`: Drena el socket y destruye el AudioContext y nodos.
   - **KeepAlive Heartbeat**: Envío de `{"type": "KeepAlive"}` cada 5 segundos para evitar que Deepgram cierre la conexión a los 10s de inactividad durante silencios largos.
   - **Prevención de Tail-Loss (#852)**: Al cerrar el socket, enviar `{"type": "CloseStream"}` y esperar hasta 1500 ms de drenaje para recibir los últimos finales antes del `ws.close()`.
   - **Medición de Latencia y Modo Degradado**: Medir el tiempo desde el primer byte de audio enviado hasta el primer parcial recibido. Si excede 1500 ms, notificar estado `degraded` (conexión lenta).

## 3. Criterios de Aceptación (Acceptance Criteria)
- [ ] El servicio abre el WebSocket a Deepgram autenticando exitosamente con el token efímero bearer.
- [ ] Se emiten callbacks limpios para parciales en tiempo real (`onInterim`) y finales consolidados (`onFinal`).
- [ ] Si la conexión se interrumpe, `reconnect` reabre el socket sin perder muestras gracias al `PcmBacklog`.
- [ ] En pausas o paradas, `CloseStream` vacía los enunciados pendientes sin truncar las palabras finales.
