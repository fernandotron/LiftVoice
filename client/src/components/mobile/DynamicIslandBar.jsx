import React, { useState } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import AudioVisualizer from '../AudioVisualizer.jsx';

/**
 * DynamicIslandBar — LiftVoice Studio 2026
 * Cápsula flotante superior con estética Apple/ElevenLabs:
 * - Código de sala con copia háptica rápida
 * - Indicador de emisión (En Directo / Pausa)
 * - Micro VU ecualizador reactivo a la voz
 * - Badge ASR Nova-3 y latencia de red
 * - Menú expandible con información de sala e IP local
 */
export default function DynamicIslandBar({
  roomId = 'MAIN',
  isBroadcasting = false,
  asrStatus = 'idle',
  socketLatency = 1,
  audioRecorderService = null,
  onCopyRoomLink = () => {},
  localIp = '192.168.1.12',
  embedded = false
}) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopy = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch (err) {}
    onCopyRoomLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getAsrBadgeColor = () => {
    if (asrStatus === 'listening' || asrStatus === 'streaming' || asrStatus === 'connected') {
      return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
    if (asrStatus === 'connecting' || asrStatus === 'reconnecting') {
      return 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    if (asrStatus === 'error' || asrStatus === 'degraded') {
      return 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    }
    return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
  };

  const OuterTag = embedded ? 'div' : 'header';

  return (
    <OuterTag className={embedded ? 'relative w-full' : 'sticky top-2 z-30 mx-auto w-full max-w-lg px-3 pointer-events-none'}>
      <div 
        className={`pointer-events-auto flex items-center justify-between px-2.5 sm:px-3.5 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/90 dark:border-zinc-800 shadow-md shadow-zinc-900/5 transition-all select-none ${
          embedded ? 'h-9 border-zinc-200 dark:border-zinc-700/80 shadow-2xs' : 'h-11'
        }`}
        aria-label="Estado de la sala e información de emisión"
      >
        {/* Izquierda: Código de Sala con Copia Rápida */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono text-[11px] font-bold transition-all cursor-pointer active:scale-95 whitespace-nowrap flex-shrink-0"
          title="Toca para copiar enlace de la sala"
          aria-label={`Código de sala ${roomId}. Toca para copiar enlace.`}
        >
          <span className="whitespace-nowrap">{roomId}</span>
          {copied ? <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" /> : <Copy className="w-2.5 h-2.5 text-zinc-400 flex-shrink-0" />}
        </button>

        {/* Centro: Estado de Emisión & Micro Waveform */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isBroadcasting ? 'bg-rose-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
            <span className="text-[11px] font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
              {isBroadcasting ? 'En directo' : 'En pausa'}
            </span>
          </div>

          {isBroadcasting && audioRecorderService?.getFrequencyData && (
            <div className="w-12 h-3.5 hidden xs:flex items-center" aria-hidden="true">
              <AudioVisualizer
                mode="bars"
                height={14}
                barCount={8}
                isActive={isBroadcasting}
                barColor="auto"
                getFrequencyDataFn={() => audioRecorderService.getFrequencyData()}
              />
            </div>
          )}
        </div>

        {/* Derecha: ASR Badge, Latencia y Toggle Acordeón */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label="Información de red y detalles de emisión"
          className="flex items-center gap-1.5 font-mono text-[10px] font-semibold cursor-pointer hover:opacity-85 transition-opacity whitespace-nowrap flex-shrink-0"
        >
          <span 
            className={`px-2 py-0.5 rounded-full border flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${getAsrBadgeColor()}`}
            aria-label={`Reconocimiento de voz Nova-3: ${asrStatus}`}
          >
            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span className="hidden xs:inline whitespace-nowrap">Nova-3 ⚡</span>
            <span className="xs:hidden">⚡</span>
          </span>
          <span className="text-zinc-600 dark:text-zinc-400 tabular-nums whitespace-nowrap">{socketLatency}ms</span>
          <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Menú Expandido Flotante */}
      {isExpanded && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto mt-2 p-3.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-2.5 text-left text-xs text-zinc-700 dark:text-zinc-300 animate-slideDown"
        >
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="font-semibold text-zinc-900 dark:text-white">Estudio de Emisión Móvil</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              Septiembre 2026
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-400 block text-[9px]">IP de red local</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-bold">{localIp}:5174</span>
            </div>
            <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-400 block text-[9px]">Estado ASR</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{asrStatus}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-zinc-400 font-mono">Enlace oyentes: ?room={roomId}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] font-bold text-zinc-900 dark:text-white hover:underline cursor-pointer flex items-center gap-1"
            >
              {copied ? '¡Copiado!' : 'Copiar enlace'}
            </button>
          </div>
        </div>
      )}
    </OuterTag>
  );
}
