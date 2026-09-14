import React, { useState } from 'react';
import { Sparkles, Copy, Check, Download, RefreshCw, Loader2, AlertCircle, FileText } from 'lucide-react';

export default function SidebarSessionSummary({
  roomId = 'MAIN',
  summaryData = null,
  isLoading = false,
  error = null,
  onGenerate = () => {}
}) {
  const [copied, setCopied] = useState(false);

  const title = (summaryData?.title === 'Conferencia Principal 2026') ? 'Conferencia Principal' : (summaryData?.title || 'Conferencia Principal');
  const execSummary = summaryData?.executiveSummary || summaryData?.summaryEs || summaryData?.summaryEn || '';
  const keyPoints = summaryData?.keyPoints || summaryData?.keyTakeawaysEs || summaryData?.keyTakeawaysEn || [];
  const actionItems = summaryData?.actionItems || (summaryData?.conclusions ? [summaryData.conclusions] : []);
  const duration = summaryData?.durationMinutes || 1;
  const totalSentences = summaryData?.totalSentences || 0;
  const totalListeners = summaryData?.totalListeners || summaryData?.attendeeCount || 0;

  const handleCopyMarkdown = () => {
    if (!summaryData) return;
    const md = `# ${title}
*Sala: ${roomId} • Fecha: ${new Date().toLocaleDateString()}*

## 📝 Resumen Ejecutivo
${execSummary || 'No se detectaron discursos durante esta sesión para resumir.'}

## 🎯 Puntos Clave
${keyPoints.length > 0 ? keyPoints.map(p => `- ${p}`).join('\n') : '- Sin contenido registrado.'}

## ⚡ Conclusiones y Próximos Pasos
${actionItems.length > 0 ? actionItems.map(a => `- ${a}`).join('\n') : '- Sin contenido registrado.'}

---
*Métricas: ${duration} min | ${totalSentences} frases | ${totalListeners} oyentes*
*Generado automáticamente por LiftVoice Studio AI*
`;
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!summaryData) return;
    const md = `# ${title}
*Sala: ${roomId} • Fecha: ${new Date().toLocaleDateString()}*

## 📝 Resumen Ejecutivo
${execSummary || 'No se detectaron discursos durante esta sesión para resumir.'}

## 🎯 Puntos Clave
${keyPoints.length > 0 ? keyPoints.map(p => `- ${p}`).join('\n') : '- Sin contenido registrado.'}

## ⚡ Conclusiones y Próximos Pasos
${actionItems.length > 0 ? actionItems.map(a => `- ${a}`).join('\n') : '- Sin contenido registrado.'}

---
*Métricas: ${duration} min | ${totalSentences} frases | ${totalListeners} oyentes*
*Generado automáticamente por LiftVoice Studio AI*
`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `LiftVoice-Resumen-${roomId}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none animate-fadeIn text-left">
      {/* 1. Header con datum line h-14 */}
      <div className="h-14 px-5 flex items-center justify-between bg-white dark:bg-zinc-950 flex-shrink-0">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Resumen de Sesión IA
          </h2>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
            Minuta estructurada con IA
          </p>
        </div>

        {/* Acciones de exportación y actualización */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {summaryData && !isLoading && (
            <>
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer shadow-2xs"
                title="Copiar resumen en Markdown"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer shadow-2xs"
                title="Descargar archivo Markdown"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onGenerate}
            disabled={isLoading}
            className="h-7 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center gap-1 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            title="Generar o actualizar resumen"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{summaryData ? 'Actualizar' : 'Generar'}</span>
          </button>
        </div>
      </div>

      <div className="mx-5 border-b border-zinc-200 dark:border-zinc-800/80 flex-shrink-0" />

      {/* 2. Cuerpo Scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {isLoading && (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-zinc-900 dark:text-zinc-100 animate-spin mx-auto" />
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Analizando la transcripción de la ponencia...
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
              La Inteligencia Artificial está extrayendo ideas centrales, argumentos y acuerdos de la sesión.
            </p>
          </div>
        )}

        {error && !isLoading && (
          <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
            <div className="min-w-0 flex-1">
              <b className="block font-semibold mb-0.5">No se pudo generar el resumen</b>
              <p className="leading-relaxed text-[11px]">{error}</p>
              <button
                type="button"
                onClick={onGenerate}
                className="mt-2 px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 text-[10.5px] font-semibold hover:underline cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && !summaryData && (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center mx-auto text-zinc-500">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Minuta no generada
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Genera un resumen inteligente a partir de las intervenciones registradas en el estudio.
              </p>
            </div>
            <button
              type="button"
              onClick={onGenerate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generar Resumen Ahora</span>
            </button>
          </div>
        )}

        {!isLoading && summaryData && (
          <>
            {/* Métricas */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 text-center">
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Duración</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white font-mono mt-0.5">
                  {duration} <span className="text-[10px] font-normal text-zinc-500">min</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 text-center">
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Frases</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white font-mono mt-0.5">
                  {totalSentences}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 text-center">
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Oyentes</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white font-mono mt-0.5">
                  {totalListeners}
                </div>
              </div>
            </div>

            {/* Resumen Ejecutivo */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Resumen Ejecutivo
              </div>
              <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                {execSummary || 'No se detectaron discursos durante esta sesión para resumir.'}
              </div>
            </div>

            {/* Puntos Clave */}
            {keyPoints.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Puntos Clave y Argumentos
                </div>
                <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
                  {keyPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 mt-1.5 flex-shrink-0" />
                      <span className="leading-relaxed">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conclusiones y Próximos Pasos */}
            {actionItems.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Conclusiones y Próximos Pasos
                </div>
                <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-2">
                  {actionItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 mt-1.5 flex-shrink-0" />
                      <span className="leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
