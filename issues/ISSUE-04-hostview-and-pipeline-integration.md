# ISSUE-04: Integración en HostView, LiveCaptions y Desacoplamiento del AI Pipeline

## 1. Contexto y Justificación
En la arquitectura actual de `LiftVoice`, `HostView.jsx` y `audioRecorder.js` están saturados de lógica defensiva para manejar recortes y repeticiones de texto de la Web Speech API (`extractContinuationDelta`, expresiones regulares, timeouts de dangling connectors).
Con la llegada de Deepgram Streaming WebSocket, la transcripción se vuelve autoritativa y exacta. Se requiere integrar el nuevo motor desacoplando de forma limpia los subtítulos provisionales (interim) para la UI del Host/Listener frente a los enunciados finales consolidados (`is_final`) que alimentan la traducción y el TTS.

## 2. Alcance Técnico
1. **Actualización de `client/src/services/audioRecorder.js`**:
   - Integrar `deepgramStreamingService` como motor de primera clase para la opción `'deepgram'`.
   - Cuando `sttEngine === 'deepgram'`, delegar la captura y el flujo de audio a `deepgramStreamingService`.
   - Mantener el selector de fallback a WebSpeech para entornos sin conectividad o sin API keys.
2. **Integración en `client/src/views/HostView.jsx`**:
   - Conectar los eventos de parciales directamente al estado `liveInterimSpeech` para que `LiveCaptions` muestre las palabras a medida que se pronuncian con latencia < 200 ms.
   - Al recibir un resultado con `isFinal === true`, invocar inmediatamente `sendSpeechToEngines(finalText)`.
   - Desactivar las heurísticas redundantes de continuación cuando se usa Deepgram streaming.
   - Reflejar estados de conexión del ASR (`connecting`, `listening`, `degraded`, `reconnecting`) en el indicador del Host.
3. **Optimización en `client/src/components/LiveCaptions.jsx`**:
   - Mostrar el texto parcial activo en gris / cursiva con indicador de detección inmediata.
   - Añadir suavemente las frases consolidadas al historial de transcripciones traducidas.
4. **Armonización en el Backend (`server/src/services/aiPipeline.js`)**:
   - Dado que los finales provienen de Deepgram Nova-3 con puntuación inteligente (`smart_format`), el pipeline recibe frases enteras y coherentes, permitiendo que la traducción neuronal y el TTS fluyan de manera mucho más natural y sin duplicaciones.

## 3. Criterios de Aceptación (Acceptance Criteria)
- [ ] Al presionar "Transmitir" con el motor Deepgram activo, el micrófono se activa con AudioWorklet y el WebSocket de Deepgram conecta en milisegundos.
- [ ] A medida que el ponente habla, las palabras aparecen palabra por palabra en `LiveCaptions` sin retraso perceptible.
- [ ] Al haber una pausa natural (~300ms), Deepgram emite `is_final`, consolidando la frase e iniciando la traducción multicanal (4 idiomas) y síntesis de voz sin duplicaciones ni cortes.
- [ ] Se preserva la opción en `SettingsModal` para alternar entre motores si es necesario.
