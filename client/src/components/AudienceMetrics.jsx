import React from 'react';
import { Users, Zap, Clock, ShieldCheck, Radio, CheckCircle, AudioLines, Activity } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from './LanguageSelector.jsx';

export default function AudienceMetrics({
  totalListeners = 0,
  languageBreakdown = {},
  metrics = {},
  latestPipelineMetric = null,
  socketLatency = 14
}) {
  return (
    <div className="space-y-4 text-left">
      {/* Top Counters Grid (ElevenLabs Dashboard Style) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="flex items-center gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              Oyentes Activos
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-3xl font-bold text-white font-mono">
            {totalListeners}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Conectados en sala</div>
        </div>

        <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="flex items-center gap-1.5 text-xs">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              Latencia Pipeline IA
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
              latestPipelineMetric ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {latestPipelineMetric ? 'En vivo' : 'En espera'}
            </span>
          </div>
          <div className="text-3xl font-bold text-white font-mono">
            {latestPipelineMetric?.totalLatencyMs ? (
              <>
                {latestPipelineMetric.totalLatencyMs}
                <span className="text-xs font-normal text-zinc-500 ml-1">ms</span>
              </>
            ) : (
              <span className="text-2xl text-zinc-500 font-normal">--</span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {latestPipelineMetric ? (
              <span className="truncate block" title={latestPipelineMetric.engineUsed || 'Google Neural'}>
                <b className="text-emerald-400">
                  {latestPipelineMetric.engineUsed
                    ? (latestPipelineMetric.engineUsed.includes('Qwen') ? '🇨🇳 Qwen 3.8' : latestPipelineMetric.engineUsed.includes('Google') ? '⚡ Google' : '🤖 GPT-4o')
                    : 'IA'}:
                </b>{' '}
                {latestPipelineMetric.transMs || 0}ms &bull; Ping: {socketLatency}ms
              </span>
            ) : (
              <span>Ping WebSocket: <b className="text-emerald-400 font-mono">{socketLatency}ms</b></span>
            )}
          </div>
        </div>

        <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="flex items-center gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-zinc-300" />
              Frases
            </span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-white font-mono">
            {metrics.sentencesProcessed || 0}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Traducidas a 4 idiomas</div>
        </div>

        <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="flex items-center gap-1.5 text-xs">
              <AudioLines className="w-3.5 h-3.5 text-white" />
              Cabinas de Voz
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">4 activas</span>
          </div>
          <div className="text-3xl font-bold text-white font-mono">
            4
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">EN, ES, IT, PT</div>
        </div>
      </div>

      {/* Language Breakdown Cards */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
          <span>Distribución de Audiencia por Canal</span>
          <span className="text-[11px] text-zinc-500 font-mono">Tiempo real</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const count = languageBreakdown[lang.code] || 0;
            const percentage = totalListeners > 0 ? Math.round((count / totalListeners) * 100) : 0;

            return (
              <div
                key={lang.code}
                className="p-3 rounded-xl bg-zinc-950/80 border border-white/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <div className="font-semibold text-xs text-white">{lang.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{lang.code}</div>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold text-sm text-white">{count}</div>
                  <div className="text-[10px] text-zinc-400">{percentage}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Telemetry Bar */}
      {latestPipelineMetric && (
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-zinc-300 text-xs flex-wrap">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            <span className="font-semibold">Telemetría de Pipeline IA:</span>
            {latestPipelineMetric.engineUsed && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                {latestPipelineMetric.engineUsed}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="text-zinc-400">
              STT: <b className="text-white">{latestPipelineMetric.sttMs}ms</b>
            </span>
            <span className="text-zinc-400">
              Traducción: <b className="text-white">{latestPipelineMetric.transMs}ms</b>
            </span>
            <span className="text-zinc-400">
              Síntesis TTS: <b className="text-white">{latestPipelineMetric.ttsMs}ms</b>
            </span>
            <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-zinc-900 border border-emerald-500/20">
              Total E2E: {latestPipelineMetric.totalLatencyMs}ms
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

