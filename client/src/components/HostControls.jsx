import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings, Volume2, Sparkles, Play, Send, ChevronDown, Radio, Activity, AudioLines, CheckCircle2, Cpu, Zap, Bot, Globe } from 'lucide-react';
import { audioRecorderService } from '../services/audioRecorder.js';

const DEMO_PRESETS = [
  {
    label: '🇪🇸 "Bienvenidos a la conferencia..."',
    text: 'Bienvenidos a la conferencia de innovación 2026. Hoy presentamos la traducción simultánea con inteligencia artificial en tiempo real.',
    lang: 'es'
  },
  {
    label: '🇺🇸 "Welcome to our live keynote..."',
    text: 'Welcome to our live keynote. You can listen in real-time in English, Spanish, Italian, and Portuguese directly from your mobile phone.',
    lang: 'en'
  },
  {
    label: '🇮🇹 "È un vero piacere essere qui..."',
    text: 'È un vero piacere essere qui con voi oggi. Questa tecnologia permette una comunicación universale senza barriere linguistiche.',
    lang: 'it'
  },
  {
    label: '🇧🇷 "Muito obrigado pela presença..."',
    text: 'Muito obrigado pela presença de todos. Podem alterar o idioma a qualquer momento nos vossos fones de ouvido.',
    lang: 'pt'
  }
];

export default function HostControls({
  isBroadcasting = false,
  onToggleBroadcast = () => {},
  onSendManualSpeech = () => {},
  sourceLanguage = 'auto',
  onSourceLanguageChange = () => {},
  decalageMode = 'natural',
  onDecalageModeChange = () => {}
}) {
  const meterBarRef = useRef(null);
  const meterTextRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [manualText, setManualText] = useState('');
  const [isSendingDemo, setIsSendingDemo] = useState(false);
  const [liveInterimText, setLiveInterimText] = useState('');
  const [preferredEngine, setPreferredEngine] = useState(() => {
    try {
      return localStorage.getItem('lv_preferred_engine') || 'qwen';
    } catch (e) {
      return 'qwen';
    }
  });

  // Sync preferred engine and credentials with backend on load
  useEffect(() => {
    try {
      const savedEngine = localStorage.getItem('lv_preferred_engine') || 'qwen';
      const qwenKey = localStorage.getItem('lv_qwen_key') || '';
      const qwenModel = localStorage.getItem('lv_qwen_model') || 'qwen/qwen-3.8-27b';
      const qwenEndpoint = localStorage.getItem('lv_qwen_endpoint') || '';
      const openaiKey = localStorage.getItem('lv_openai_key') || '';
      const elevenKey = localStorage.getItem('lv_eleven_key') || '';
      const deepgramKey = localStorage.getItem('lv_deepgram_key') || '';

      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredEngine: savedEngine,
          qwenApiKey: qwenKey,
          qwenModel,
          qwenEndpoint,
          openaiApiKey: openaiKey,
          elevenLabsApiKey: elevenKey,
          deepgramApiKey: deepgramKey
        })
      }).catch(() => {});
    } catch (e) {}
  }, []);

  const handleEngineChange = async (engine) => {
    setPreferredEngine(engine);
    try {
      localStorage.setItem('lv_preferred_engine', engine);
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredEngine: engine })
      });
    } catch (err) {
      console.warn('Failed to update preferred engine:', err);
    }
  };

  useEffect(() => {
    audioRecorderService.getAudioInputDevices().then((devs) => {
      if (Array.isArray(devs) && devs.length) {
        setDevices(devs);
      }
    }).catch(() => {});

    const unsubLevel = audioRecorderService.onAudioLevel((level) => {
      if (meterBarRef.current) {
        meterBarRef.current.style.width = `${level}%`;
        meterBarRef.current.style.backgroundColor = level > 70 ? '#ef4444' : '#10b981';
      }
      if (meterTextRef.current) {
        meterTextRef.current.textContent = `${level}%`;
      }
    });
    const unsubInterim = audioRecorderService.onInterim(setLiveInterimText);

    return () => {
      unsubLevel();
      unsubInterim();
    };
  }, []);

  const handleDeviceChange = (e) => {
    const devId = e.target.value;
    setSelectedDevice(devId);
    audioRecorderService.setDevice(devId);
  };

  const handleSendPreset = async (preset) => {
    setIsSendingDemo(true);
    await onSendManualSpeech(preset.text, preset.lang);
    setIsSendingDemo(false);
  };

  const handleSendCustomText = (e) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    onSendManualSpeech(manualText.trim(), sourceLanguage);
    setManualText('');
  };

  return (
    <div className="space-y-5">
      {/* Broadcast Master Control (ElevenLabs Studio Card) */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden space-y-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4 text-left w-full sm:w-auto">
            <button
              onClick={onToggleBroadcast}
              className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 ${
                isBroadcasting
                  ? 'bg-red-500 text-white shadow-2xl shadow-red-500/50 scale-105'
                  : 'bg-white text-black hover:bg-zinc-200 hover:scale-105 shadow-xl shadow-white/10'
              }`}
            >
              {isBroadcasting ? (
                <Mic className="w-7 h-7 animate-pulse" />
              ) : (
                <Mic className="w-7 h-7" />
              )}
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-white">
                  {isBroadcasting ? 'Micrófono en Emisión Activa' : 'Transmisión en Pausa'}
                </span>
                {isBroadcasting && (
                  <span className="badge-live-clean">EN VIVO</span>
                )}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isBroadcasting
                  ? 'Capturando tu voz y traduciendo a las 4 cabinas de audio en tiempo real.'
                  : 'Haz clic en el micrófono para comenzar la emisión en directo.'}
              </p>
            </div>
          </div>

          {/* ElevenLabs Style VU Level Meter */}
          <div className="w-full sm:w-60 space-y-2 bg-zinc-950 p-4 rounded-xl border border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5 text-xs">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Voz / VAD
              </span>
              <span ref={meterTextRef} className="font-mono text-white text-xs font-bold">0%</span>
            </div>

            {/* Meter Bar */}
            <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
              <div
                ref={meterBarRef}
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: '0%',
                  backgroundColor: '#10b981'
                }}
              />
            </div>
          </div>
        </div>

        {/* Live Speech Recognition Prompter (Instant Feedback while speaking) */}
        {isBroadcasting && (
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex items-start gap-3 transition-all animate-fadeIn">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse mt-1 flex-shrink-0" />
            <div className="text-xs flex-1 text-left">
              <span className="text-zinc-500 font-mono text-[10px] uppercase block mb-1">Detectando en vivo desde micrófono:</span>
              <span className="text-white font-medium text-sm italic leading-relaxed">
                {liveInterimText || 'Habla ahora, tus palabras se transcribirán aquí al instante...'}
              </span>
            </div>
          </div>
        )}

        {/* Input Configuration Bar */}
        <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">
              Dispositivo de Micrófono
            </label>
            <select
              value={selectedDevice}
              onChange={handleDeviceChange}
              className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-white transition-all cursor-pointer"
            >
              <option value="default">🎙️ Micrófono Predeterminado</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Micrófono (${d.deviceId.slice(0, 8)}...)`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">
              Idioma en que Hablas
            </label>
            <select
              value={sourceLanguage}
              onChange={(e) => {
                const newLang = e.target.value;
                onSourceLanguageChange(newLang);
                audioRecorderService.setLanguage(newLang);
              }}
              className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-white transition-all cursor-pointer"
            >
              <option value="es-ES">🇪🇸 Español (Ponente)</option>
              <option value="en-US">🇺🇸 English (Speaker)</option>
              <option value="it-IT">🇮🇹 Italiano (Oratore)</option>
              <option value="pt-BR">🇧🇷 Português (Palestrante)</option>
              <option value="auto">✨ Detección Automática</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">
              Cadencia / Décalage
            </label>
            <select
              value={decalageMode}
              onChange={(e) => onDecalageModeChange(e.target.value)}
              className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-zinc-200 focus:outline-none focus:border-white transition-all cursor-pointer"
            >
              <option value="quick">⚡ Rápido (2.5s - 3.5s)</option>
              <option value="natural">🎙️ Ponencia (4.0s - 5.0s)</option>
            </select>
          </div>
        </div>

        {/* AI Translation Engine Switcher (Alibaba Qwen 3.8 vs Google vs OpenAI) */}
        <div className="pt-4 border-t border-white/10 space-y-2.5 text-left">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              Motor de Traducción IA
            </label>
            <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
              Activo: <b className="text-emerald-400">{preferredEngine === 'qwen' ? 'Qwen 3.8 (Alibaba)' : preferredEngine === 'google' ? 'Google Neural' : 'OpenAI GPT-4o'}</b>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Alibaba Qwen 3.8 */}
            <button
              type="button"
              onClick={() => handleEngineChange('qwen')}
              className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                preferredEngine === 'qwen'
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-lg ring-1 ring-emerald-500/30'
                  : 'bg-zinc-950 hover:bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white flex items-center gap-1.5">
                  <span>🇨🇳</span> Qwen 3.8
                </span>
                {preferredEngine === 'qwen' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
              <span className="text-[10px] text-zinc-500 leading-tight">
                Open Weights (27B)
              </span>
            </button>

            {/* Google Neural Universal */}
            <button
              type="button"
              onClick={() => handleEngineChange('google')}
              className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                preferredEngine === 'google'
                  ? 'bg-blue-500/10 border-blue-500/50 text-white shadow-lg ring-1 ring-blue-500/30'
                  : 'bg-zinc-950 hover:bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white flex items-center gap-1.5">
                  <span>⚡</span> Google
                </span>
                {preferredEngine === 'google' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                )}
              </div>
              <span className="text-[10px] text-zinc-500 leading-tight">
                Ultrarrápido & Free
              </span>
            </button>

            {/* OpenAI GPT-4o-mini */}
            <button
              type="button"
              onClick={() => handleEngineChange('openai')}
              className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                preferredEngine === 'openai'
                  ? 'bg-purple-500/10 border-purple-500/50 text-white shadow-lg ring-1 ring-purple-500/30'
                  : 'bg-zinc-950 hover:bg-zinc-900 border-white/5 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white flex items-center gap-1.5">
                  <span>🤖</span> GPT-4o
                </span>
                {preferredEngine === 'openai' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                )}
              </div>
              <span className="text-[10px] text-zinc-500 leading-tight">
                OpenAI Contextual
              </span>
            </button>
          </div>

          <div className="text-[11px] text-zinc-400 bg-zinc-950/60 p-2.5 rounded-lg border border-white/5">
            {preferredEngine === 'qwen' && (
              <span>✨ <b>Alibaba Qwen 3.8:</b> Versión de pesos abiertos (Apache 2.0 - 27B y Flash-Next). Admite API en la nube (OpenRouter/DashScope) o ejecución local con Ollama/vLLM sin coste de API.</span>
            )}
            {preferredEngine === 'google' && (
              <span>⚡ <b>Google Neural Universal:</b> Motor sin latencia (&lt;90ms), ideal para conexiones lentas y sin necesidad de claves API.</span>
            )}
            {preferredEngine === 'openai' && (
              <span>🤖 <b>OpenAI GPT-4o:</b> Inferencia de alta fidelidad gramatical (requiere configurar API key en el icono de Ajustes).</span>
            )}
          </div>
        </div>
      </div>

      {/* Voice Playground & Presets */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Simulador de Voz & Frases de Prueba
            </h4>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">1-CLICK TEST</span>
        </div>

        {/* Preset Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {DEMO_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              disabled={isSendingDemo}
              onClick={() => handleSendPreset(preset)}
              className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/5 hover:border-white/15 text-left transition-all text-xs text-zinc-300 group cursor-pointer"
            >
              <span className="truncate group-hover:text-white font-medium">{preset.label}</span>
              <Play className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Custom text sender */}
        <form onSubmit={handleSendCustomText} className="flex gap-2.5 pt-1">
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="O escribe cualquier texto para traducir y sintetizar en directo..."
            className="flex-1 h-11 bg-zinc-950 border border-white/10 rounded-xl px-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-white transition-all"
          />
          <button
            type="submit"
            disabled={!manualText.trim()}
            className="h-11 px-5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs whitespace-nowrap cursor-pointer transition-all disabled:opacity-40 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Emitir</span>
          </button>
        </form>
      </div>
    </div>
  );
}
