import React, { useEffect } from 'react';
import { X, Headphones, Play, Square, Bell, ChevronRight } from 'lucide-react';
import CountryFlag from '../shared/CountryFlag.jsx';

/**
 * CabinsBottomSheet — LiftVoice Studio 2026
 * Panel deslizable inferior simplificado para el control de cabinas de traducción en móvil:
 * - Tarjetas táctiles ergonómicas para las 4 cabinas (ES, EN, IT, PT)
 * - Monitor rápido de retorno por auriculares
 * - Test de sonido binaural de 440Hz
 */
export default function CabinsBottomSheet({
  isOpen = false,
  onClose = () => {},
  cabins = [],
  selectedVoices = {},
  monitoredLang = 'none',
  previewingLang = null,
  onToggleMonitoring = () => {},
  onStopMonitoring = () => {},
  onPreviewVoice = () => {},
  onTestAudio = () => {},
  onOpenCatalogForLang = () => {},
  decalageValue = 50,
  onDecalageChange = () => {},
  boothVolume = 85,
  onVolumeChange = () => {}
}) {
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-[3px] animate-backdrop-in sm:items-center sm:justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cabins-sheet-title"
    >
      {/* Backdrop Tap to Close */}
      <div 
        className="flex-1 w-full cursor-pointer" 
        onClick={onClose}
        aria-label="Cerrar panel de cabinas" 
      />

      {/* Sheet / Modal Container estilo Studio oscuro (zinc-950 acorde a la app) */}
      <div className="relative w-full sm:max-w-md rounded-[28px] bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl overflow-hidden animate-sheet-up flex flex-col max-h-[88dvh]">
        {/* Header sin línea divisoria rígida y sin icono */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 id="cabins-sheet-title" className="font-bold text-sm text-zinc-900 dark:text-white">
              Cabinas de Traducción
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
              Control de canales simultáneos e idiomas
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de cabinas"
            className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95 touch-manipulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido Scrolleable Táctil */}
        <div className="p-5 space-y-4 overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] no-scrollbar">
          
          {/* Barra de Monitoreo Rápido de Auricular */}
          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-transparent dark:bg-zinc-900/40 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                Retorno por Auricular
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {monitoredLang !== 'none' ? `Canal ${monitoredLang} activo` : 'Silenciado'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTestAudio}
                className="px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-750 bg-transparent dark:bg-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-mono font-medium text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95 touch-manipulation"
                title="Emitir tono de prueba 440Hz"
              >
                <Bell className="w-3 h-3 text-zinc-600 dark:text-zinc-300" />
                <span>Tono Test</span>
              </button>
            </div>
          </div>

          {/* Grid de Cabinas de Idiomas */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono text-zinc-400 block">
              Cabinas activas (4 canales IA)
            </label>

            {cabins.map((cab) => {
              const isMonitored = monitoredLang === cab.code;
              const isAuditioning = previewingLang === cab.code;
              const voiceName = selectedVoices[cab.code]?.voice || selectedVoices[cab.code] || 'Voz Neuronal';

              return (
                <div
                  key={cab.code}
                  onClick={() => onToggleMonitoring(cab.code)}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                    isMonitored
                      ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 ring-1 ring-zinc-400/20 dark:ring-zinc-700/50 shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800/70 bg-transparent dark:bg-zinc-900/40 hover:bg-zinc-50/50'
                  }`}
                >
                  <div
                    className="flex items-center gap-3 min-w-0 cursor-pointer group/cab"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCatalogForLang(cab.code);
                    }}
                    title={`Cambiar voz para ${cab.name}`}
                  >
                    <CountryFlag code={cab.code} className="w-7 h-7 shrink-0" title={cab.name} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-900 dark:text-white truncate group-hover/cab:text-indigo-600 dark:group-hover/cab:text-indigo-400 transition-colors flex items-center gap-1">
                        <span>{cab.name}</span>
                        <ChevronRight className="w-3 h-3 text-zinc-400 opacity-60" />
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[130px]">{voiceName}</div>
                    </div>
                  </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMonitoring(cab.code);
                      }}
                      aria-pressed={isMonitored}
                      aria-label={isMonitored ? `Detener escucha de cabina ${cab.name}` : `Escuchar cabina de ${cab.name} en auriculares`}
                      title={isMonitored ? `Detener escucha de cabina ${cab.name}` : `Escuchar cabina de ${cab.name} en auriculares`}
                      className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
                        isMonitored
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 ring-2 ring-zinc-950/20 dark:ring-white/20 shadow-xs'
                          : 'bg-transparent dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/80'
                      }`}
                    >
                      <Headphones className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewVoice(cab.code);
                      }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        isAuditioning 
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 ring-2 ring-zinc-900/20 dark:ring-white/20' 
                          : 'bg-transparent dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-750 border border-zinc-200 dark:border-zinc-700/80'
                      }`}
                      title={isAuditioning ? 'Detener reproducción de voz' : 'Audicionar muestra de voz'}
                      aria-label={isAuditioning ? `Detener voz para ${cab.name}` : `Audicionar voz para ${cab.name}`}
                    >
                      {isAuditioning ? (
                        <Square className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
