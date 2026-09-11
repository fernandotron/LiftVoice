# ISSUE-01: Servidor de Minteo de Tokens Efímeros Deepgram y Endpointing (`/api/asr-token`)

## 1. Contexto y Justificación
Actualmente, `LiftVoice` realiza transcripciones enviando buffers WebM en base64 mediante llamadas REST a `https://api.deepgram.com/v1/listen`.
Para habilitar la transcripción por streaming continuo de ultra-baja latencia (< 200 ms) directamente entre el navegador del host y Deepgram vía WebSocket (`wss://api.deepgram.com/v1/listen`), es indispensable que el navegador cuente con una credencial de acceso.

Por estrictas razones de seguridad (cero fuga de secretos al frontend), la `DEEPGRAM_API_KEY` maestra jamás debe exponerse en el cliente web. En su lugar, el servidor debe actuar como emisor de tokens efímeros autorizados con TTL acotado (60 segundos) usando la API de concesión de Deepgram (`POST https://api.deepgram.com/v1/auth/grant`).

## 2. Alcance Técnico
1. **Nuevo Endpoint REST en Express**:
   - Ruta: `POST /api/asr-token` (en `server/src/index.js`).
   - Entrada JSON:
     ```json
     {
       "language": "es" | "en" | "it" | "pt" | "auto",
       "keyterms": ["cardiología", "amiodarona", ...] // Opcional
     }
     ```
2. **Llamada a Deepgram Grant API**:
   - `POST https://api.deepgram.com/v1/auth/grant`
   - Headers: `Authorization: Token ${DEEPGRAM_API_KEY}`, `Content-Type: application/json`
   - Body: `{"ttl_seconds": 60}`
   - Retorno: `{ "access_token": "...", "expires_in": 60 }`
3. **Respuesta hacia el Cliente Web**:
   ```json
   {
     "success": true,
     "token": "...",
     "expiresIn": 60,
     "listenUrl": "wss://api.deepgram.com/v1/listen",
     "model": "nova-3",
     "language": "es",
     "keyterms": [...]
   }
   ```
4. **Mapeo de Idiomas y Keyterms**:
   - Si el idioma es `auto`, Deepgram recibe `multi` (Nova-3 Multilingual con code-switching dinámico).
   - Soporte para adjuntar keyterms clínicos o de conferencia para sesgar positivamente el reconocimiento fonético.

## 3. Criterios de Aceptación (Acceptance Criteria)
- [ ] `POST /api/asr-token` devuelve HTTP 200 con un `token` válido generado por Deepgram.
- [ ] Si `DEEPGRAM_API_KEY` no está configurada, el endpoint devuelve HTTP 500 con un mensaje de error claro y estructurado (`deepgramNotConfigured`).
- [ ] El token generado tiene un TTL de 60 segundos (tiempo suficiente para el handshake del WebSocket).
- [ ] El endpoint soporta resolución de idioma (`es`, `en`, `it`, `pt`, `multi`).
