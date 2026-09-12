import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const title = summaryData?.title || 'Conferencia Principal 2026';
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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-dialog-title"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden rounded-[28px] sm:rounded-[32px] bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-2xl text-left text-zinc-900 dark:text-zinc-100">
        
        {/* Header exacto del modal de configuración admin */}
        <header className="relative z-20 flex shrink-0 items-start justify-between gap-4 px-6 sm:px-8 pt-6 pb-5 border-b border-zinc-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md">
          <div className="min-w-0 flex-1">
            <h3 id="summary-dialog-title" className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              Resumen Ejecutivo con IA
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Minuta estructurada de la sala <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium">{roomId}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </header>

        {/* Scrollable Content Body con estética Admin */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 sm:px-8 py-6 space-y-6 scrollbar-custom text-left">
          
          {isLoading && (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-zinc-900 dark:text-zinc-100 animate-spin mx-auto" />
              <div className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Analizando la transcripción de la ponencia...
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                La Inteligencia Artificial está extrayendo ideas centrales, argumentos clave y acuerdos de la sesión.
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-4 sm:p-5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-start gap-3.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
              <div className="min-w-0 flex-1">
                <b className="block text-red-900 dark:text-red-200 font-semibold mb-1">No se pudo generar el resumen</b>
                <p className="leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {!isLoading && (
            <>
              {/* Sección 1: Métricas de la Sesión */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50/80 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/10">
                    <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Duración
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white font-mono mt-1">
                      {duration} <span className="text-xs font-normal text-zinc-500 font-sans">min</span>
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50/80 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/10">
                    <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Frases
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white font-mono mt-1">
                      {totalSentences}
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50/80 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/10">
                    <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Oyentes
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white font-mono mt-1">
                      {totalListeners}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 2: Conferencia / Síntesis Principal */}
              <div className="space-y-2">
                <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                  {title}
                </h4>
                
                {execSummary ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/80 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/10 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                    {execSummary}
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/80 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/10 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-3">
                    <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    <span>No se detectaron discursos durante esta sesión para resumir.</span>
                  </div>
                )}
              </div>

              {/* Sección 3: Puntos Clave (si existen) */}
              {keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                    Puntos Clave y Argumentos
                  </h4>
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/80 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/10 space-y-2.5">
                    {keyPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-white mt-2 flex-shrink-0" />
                        <span className="leading-relaxed">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sección 4: Conclusiones y Próximos Pasos */}
              <div className="space-y-2">
                <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                  Conclusiones y Próximos Pasos
                </h4>
                
                {actionItems.length > 0 ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/80 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/10 space-y-2.5">
                    {actionItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-white mt-2 flex-shrink-0" />
                        <span className="leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/80 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/10 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 flex-shrink-0" />
                    <span>Sin contenido registrado.</span>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Footer idéntico al del panel de administración */}
        <footer className="relative z-20 flex shrink-0 items-center justify-between gap-4 px-6 sm:px-8 py-4 sm:py-5 border-t border-zinc-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md">
          <div className="text-xs text-zinc-400 dark:text-zinc-500 font-mono hidden sm:block">
            LiftVoice Studio Summary
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              disabled={isLoading || (!execSummary && actionItems.length === 0)}
              className="h-10 px-5 rounded-full border border-zinc-200/80 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>Copiar Markdown</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              disabled={isLoading || (!execSummary && actionItems.length === 0)}
              className="h-10 px-6 rounded-full bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar (.md)</span>
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
}
