import React, { useState } from 'react';
import { X, Sparkles, Copy, Check, Download, FileText, CheckCircle2, Clock, Users, MessageSquare, Loader2, AlertCircle } from 'lucide-react';

export default function SessionSummaryModal({
  isOpen = false,
  onClose = () => {},
  roomId = 'MAIN',
  summaryData = null,
  isLoading = false,
  error = null
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const title = summaryData?.title || 'Resumen de Sesión LiftVoice';
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
${execSummary}

## 🎯 Puntos Clave
${keyPoints.map(p => `- ${p}`).join('\n')}

## ⚡ Conclusiones y Próximos Pasos
${actionItems.map(a => `- ${a}`).join('\n')}

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
${execSummary}

## 🎯 Puntos Clave
${keyPoints.map(p => `- ${p}`).join('\n')}

## ⚡ Conclusiones y Próximos Pasos
${actionItems.map(a => `- ${a}`).join('\n')}

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
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-backdrop-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col rounded-t-[28px] sm:rounded-2xl border-t sm:border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xl animate-sheet-up sm:animate-fadeIn text-zinc-900 dark:text-zinc-100 transition-colors duration-150">
        
        {/* Pull Handle táctil exclusivo móvil */}
        <div className="sm:hidden -mt-1 pb-1 flex justify-center flex-shrink-0">
          <div className="sheet-pull-handle my-0" />
        </div>

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-shrink-0 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-800 dark:text-zinc-200 flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-50 tracking-tight truncate">
                Resumen Ejecutivo con IA
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                Minuta estructurada de la sala <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium">{roomId}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-5 text-left">
          
          {isLoading && (
            <div className="py-14 text-center space-y-2.5">
              <Loader2 className="w-7 h-7 text-zinc-800 dark:text-zinc-200 animate-spin mx-auto" />
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Analizando la transcripción de la ponencia...
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                La Inteligencia Artificial está extrayendo ideas centrales, argumentos clave y acuerdos de la sesión.
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <div>
                <b className="block text-red-900 dark:text-red-200 font-semibold mb-0.5">No se pudo generar el resumen</b>
                {error}
              </div>
            </div>
          )}

          {summaryData && !isLoading && (
            <>
              {/* Key Metrics Strip */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-center">
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Duración</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                    {duration} min
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-center">
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Frases</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                    {totalSentences}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-center">
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">Oyentes</div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono mt-0.5">
                    {totalListeners}
                  </div>
                </div>
              </div>

              {/* Title & Executive Summary */}
              <div className="space-y-1.5">
                <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {title}
                </h4>
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {execSummary}
                </div>
              </div>

              {/* Key Points */}
              {keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-800 dark:text-zinc-200" />
                    Puntos Clave y Argumentos
                  </h5>
                  <ul className="space-y-1.5">
                    {keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 mt-1.5 flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items / Conclusions */}
              {actionItems.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-zinc-800 dark:text-zinc-200" />
                    Conclusiones y Próximos Pasos
                  </h5>
                  <ul className="space-y-1.5">
                    {actionItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:text-zinc-500 mt-1.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer Actions */}
        {summaryData && !isLoading && (
          <div className="p-3.5 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/90 flex items-center justify-between gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-4 flex-shrink-0">
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono hidden sm:block">
              LiftVoice Studio Summary
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleCopyMarkdown}
                className="h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Markdown</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadMarkdown}
                className="h-8 px-3.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-medium cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar (.md)</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
