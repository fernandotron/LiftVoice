import React, { useEffect } from 'react';
import { X, Headphones, Play, Sparkles, Globe, Bell } from 'lucide-react';
import ElevenSlider from '../ElevenSlider.jsx';
import CountryFlag from '../shared/CountryFlag.jsx';

/**
 * CabinsBottomSheet — LiftVoice Studio 2026
 * Panel deslizable inferior para el control de cabinas de traducción en móvil y tablet:
 * - Tarjetas táctiles ergonómicas para las 4 cabinas (ES, EN, IT, PT)
 * - Monitor rápido de retorno por auriculares
 * - Test de sonido binaural de 440Hz
 * - Deslizadores de precisión ElevenLabs (Décalage de traducción y Volumen de cabinas)
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

      {/* Sheet / Modal Container estilo Reness */}
      <div className="relative w-full sm:max-w-md rounded-[28px] bg-white dark:bg-[#1f1f1f] border border-zinc-200/80 dark:border-white/10 shadow-2xl overflow-hidden animate-sheet-up flex flex-col max-h-[88dvh]">
        {/* Header sin línea divisoria rígida */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-zinc-900 dark:text-white" />
            <div>
              <h3 id="cabins-sheet-title" className="font-bold text-sm text-zinc-900 dark:text-white">
                Cabinas de Traducción
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                Control de canales simultáneos y décalage
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de cabinas"
            className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido Scrolleable Táctil */}
        <div className="p-5 space-y-4 overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] no-scrollbar">
          
          {/* Barra de Monitoreo Rápido de Auricular */}
          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <Headphones className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <div>
                <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                  Retorno por Auricular
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {monitoredLang !== 'none' ? `Canal ${monitoredLang} activo` : 'Silenciado'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTestAudio}
                className="px-2.5 py-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 text-[11px] font-mono font-medium text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Emitir tono de prueba 440Hz"
              >
                <Bell className="w-3 h-3 text-zinc-600 dark:text-zinc-300" />
                <span>Tono Test</span>
              </button>

              {monitoredLang !== 'none' && (
                <button
                  type="button"
                  onClick={onStopMonitoring}
                  className="px-2.5 py-1.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Silenciar
                </button>
              )}
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
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isMonitored
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CountryFlag code={cab.code} className="w-7 h-7 shrink-0" title={cab.name} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">{cab.name}</div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[130px]">{voiceName}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => onToggleMonitoring(cab.code)}
                      aria-pressed={isMonitored}
                      aria-label={isMonitored ? `Detener escucha de cabina ${cab.name}` : `Escuchar cabina de ${cab.name} en auriculares`}
                      className={`px-3 py-1.5 rounded-2xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                        isMonitored
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200'
                      }`}
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      <span>{isMonitored ? 'Escuchando' : 'Escuchar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onPreviewVoice(cab.code)}
                      disabled={isAuditioning}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
                        isAuditioning 
                          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 animate-pulse' 
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                      }`}
                      title="Audicionar muestra de voz"
                      aria-label={`Audicionar voz para ${cab.name}`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deslizadores de Precisión ElevenLabs sin línea divisoria rígida */}
          <div className="pt-3 space-y-3.5">
            <ElevenSlider
              label="Cadencia / Décalage de Traducción"
              value={decalageValue}
              min={0}
              max={100}
              step={5}
              leftLabel="⚡ Rápido (3s)"
              rightLabel="🎙️ Ponencia (6s)"
              formatValue={(val) => (val < 40 ? 'Ágil' : 'Ponencia')}
              onChange={onDecalageChange}
            />

            <ElevenSlider
              label="Volumen de Auriculares"
              value={boothVolume}
              min={0}
              max={100}
              step={5}
              leftLabel="Silencio"
              rightLabel="Máx"
              formatValue={(val) => `${val}%`}
              onChange={onVolumeChange}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
