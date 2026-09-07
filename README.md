# 🎙️ LiftVoice Pro (Edición 2026)
### Plataforma de Traducción Simultánea de Voz con IA y Streaming Multicanal en Tiempo Real

**LiftVoice** es una solución web para eventos, conferencias magistrales, reuniones corporativas y paneles internacionales. Permite que el ponente hable por su micrófono en cualquier idioma (Español, Inglés, Italiano, Portugués, etc.) y su discurso sea transcrito, traducido y sintetizado en voz por Inteligencia Artificial en tiempo real con ultra-baja latencia.

Los asistentes del evento simplemente **escanean el código QR proyectado en la sala**, conectan sus auriculares en su teléfono móvil, eligen su idioma de escucha preferido y disfrutan de la interpretación en directo.

---

## 🚀 Arquitectura del Flujo

```
[🎙️ Micrófono del Ponente] 
         ↓ (Audio en streaming / VAD)
[Panel de Control Web / Emisor] 
         ↓ (WebSockets en tiempo real)
[Pipeline de IA en la Nube / Local] 
   ├── 1. Transcripción (STT): OpenAI Whisper / Deepgram / WebSpeech
   ├── 2. Traducción Multicanal: GPT-4o-mini / DeepL / Fast Engine
   └── 3. Generación de Voz (TTS): OpenAI TTS / ElevenLabs / EdgeTTS
         ↓ (Audio en paquetes MP3/Opus distribuidos por canal)
[📱 Web App del Asistente (Móvil con auriculares)]
   ├── 🇺🇸 Canal Inglés (Audio + Subtítulos)
   ├── 🇪🇸 Canal Español (Audio + Subtítulos)
   ├── 🇮🇹 Canal Italiano (Audio + Subtítulos)
   └── 🇧🇷 Canal Portugués (Audio + Subtítulos)
```

---

## ✨ Características Principales

1. **Panel del Emisor / Host Studio (`/host`)**:
   - Selector de micrófono con cancelación de ruido y medidor VU de Voice Activity Detection (VAD).
   - Monitor multicanal en vivo: visualiza las 4 traducciones en tiempo real simultáneamente.
   - Monitor de telemetría de latencia (STT ms, Traducción ms, TTS ms, Ping socket).
   - Generador y Proyector de Código QR en pantalla completa para proyectar en el auditorio.
   - **Simulador de Voz Integrado**: Permite inyectar frases de prueba y presets en varios idiomas para testear el sistema inmediatamente sin tener que hablar por el micrófono.

2. **Web App del Asistente / Oyente (`/listen?room=ID`)**:
   - Diseño optimizado para móviles y uso con auriculares bluetooth o cableados.
   - **Conmutador dinámico de idioma**: Cambia de Inglés a Español, Italiano o Portugués al vuelo sin cortes ni recargas de página.
   - Reproductor Web Audio API de baja latencia con amplificador de volumen (+150%).
   - Subtítulos bilingües en vivo sincronizados con auto-scroll y opción de copiado/marcador.
   - Aura reactiva de voz y visualizador de ondas de audio en Canvas.

3. **Modos de Operación y Flexibilidad de IA**:
   - **Modo Out-of-the-Box (Sin costo / Sin API keys)**: Funciona de inmediato utilizando motores de traducción ultrarrápidos y síntesis de voz en el navegador.
   - **Modo Cloud Pro**: Compatible con API keys de OpenAI (`gpt-4o-mini`, `whisper-1`, `tts-1`), ElevenLabs y Deepgram configurables desde la interfaz gráfica.

---

## 🛠️ Instalación y Ejecución Local

### 1. Iniciar el Servidor Backend:
```bash
cd server
npm run dev
```
*El servidor se iniciará en el puerto `3001` y expondrá la IP de red local (ej. `http://192.168.1.21:3001`).*

### 2. Iniciar el Cliente Web:
En una nueva terminal:
```bash
cd client
npm run dev
```
*La aplicación web estará disponible en `http://localhost:5173` y accesible desde móviles en la misma red Wi-Fi en `http://192.168.1.21:5173`.*

---

## 📱 Guía de Uso Rápido:

1. **Crear una Sala**:
   - Abre `http://localhost:5173` y presiona **"Crear Sala de Emisión"**.
   - Haz clic en **"Proyectar Código QR"** en la esquina superior derecha.

2. **Conectar como Asistente**:
   - Abre la cámara de tu teléfono móvil o una pestaña en modo incógnito.
   - Escanea el código QR proyectado o entra a `http://localhost:5173/listen?room=TU_CODIGO`.
   - Selecciona el idioma que deseas escuchar (ej. 🇺🇸 English o 🇮🇹 Italiano).
   - Toca **"Habilitar Audio"**.

3. **Transmitir y Escuchar**:
   - En el panel del emisor, activa el micrófono o haz clic en cualquiera de las frases del **Simulador de Voz**.
   - Verás cómo el asistente recibe el audio traducido y los subtítulos bilingües en tiempo real.
   - Cambia de idioma en el móvil en cualquier momento y comprueba cómo el audio cambia instantáneamente al nuevo canal.
