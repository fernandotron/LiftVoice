import React, { useEffect, useRef } from 'react';
import { X, Check, Mic, SlidersHorizontal, Activity } from 'lucide-react';
import CountryFlag from '../shared/CountryFlag.jsx';
import ElevenSlider from '../ElevenSlider.jsx';
import SelectDropdown from '../shared/SelectDropdown.jsx';
import { SPEAKER_LANGUAGES } from '../../views/HostView.jsx';

/**
 * StudioSettingsBottomSheet — LiftVoice Studio 2026
 * Panel deslizable ergonómico para la configuración del estudio móvil:
 * - Idioma del ponente (STT) con opción Auto
 * - Selector de micrófono de entrada
 * - Deslizadores de locución y cadencia
 * - Vúmetro reactivo de audio en tiempo real
 */
export default function StudioSettingsBottomSheet({
  isOpen = false,
  onClose = () => {},
  sourceLanguage = 'es-ES',
  onSelectSourceLanguage = () => {},
  onToggleAutoLanguage = () => {},
  devices = [],
  selectedDevice = 'default',
  onChangeDevice = () => {},
  speechRate = 1.0,
  onChangeSpeechRate = () => {},
  decalageValue = 20,
  onChangeDecalage = () => {},
  isBroadcasting = false,
  audioRecorderService = null
}) {
  const meterBarRef = useRef(null);
  const meterTextRef = useRef(null);

  // Prevenir scroll en body al estar abierto y soportar Escape
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

  // Vúmetro reactivo de nivel de micrófono
  useEffect(() => {
    if (!isOpen || !audioRecorderService?.onAudioLevel) return;
    const unsub = audioRecorderService.onAudioLevel((lvl) => {
      const normalized = Math.min(100, Math.max(0, lvl));
      if (meterBarRef.current) {
        meterBarRef.current.style.transform = `scaleX(${normalized / 100})`;
      }
      if (meterTextRef.current) {
        meterTextRef.current.textContent = `${Math.round(normalized)}%`;
      }
    });
    return () => unsub();
  }, [isOpen, audioRecorderService]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-[3px] animate-backdrop-in sm:items-center sm:justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-settings-sheet-title"
    >
      {/* Backdrop Tap to Close */}
      <div
        className="flex-1 w-full cursor-pointer"
        onClick={onClose}
        aria-label="Cerrar panel de ajustes de estudio"
      />

      {/* Sheet Container */}
      <div className="relative w-full sm:max-w-md rounded-[28px] bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl overflow-hidden animate-sheet-up flex flex-col max-h-[88dvh]">
        {/* Header Ergonómico con botón de cierre estandarizado */}
        <div className="px-5 pt-4 pb-2.5 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 id="studio-settings-sheet-title" className="font-bold text-sm text-zinc-900 dark:text-white">
              Ajustes de Estudio
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Idioma del ponente, micrófono y locución
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de ajustes de estudio"
            className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95 touch-manipulation flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido Scrolleable Táctil */}
        <div className="p-5 space-y-4 overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] no-scrollbar">

          {/* 1. SECCIÓN: IDIOMA DEL PONENTE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block truncate">
                  Idioma del Ponente
                </label>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  Reconocimiento de voz de tu locución
                </p>
              </div>

              {/* Toggle Detección Automática sin borde ni fondo */}
              <label
                className="inline-flex items-center gap-2 cursor-pointer select-none group py-0.5 outline-none shrink-0"
                title="Detección automática del idioma del ponente"
              >
                <input
                  type="checkbox"
                  checked={sourceLanguage === 'auto'}
                  onChange={onToggleAutoLanguage}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                    sourceLanguage === 'auto'
                      ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-zinc-900 shadow-2xs'
                      : 'bg-transparent border-zinc-300 dark:border-zinc-700 group-hover:border-zinc-400 dark:group-hover:border-zinc-500'
                  }`}
                >
                  {sourceLanguage === 'auto' && (
                    <Check className="w-3 h-3 stroke-[3]" />
                  )}
                </div>
                <span className={`text-xs transition-colors ${
                  sourceLanguage === 'auto'
                    ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 font-medium group-hover:text-zinc-700 dark:group-hover:text-zinc-300'
                }`}>
                  Auto
                </span>
              </label>
            </div>

            {/* Grid 2x2 de Idiomas */}
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              {SPEAKER_LANGUAGES.filter(l => l.code !== 'auto').map((lang) => {
                const isSelected = sourceLanguage !== 'auto' && (
                  sourceLanguage === lang.langCode ||
                  sourceLanguage === lang.code ||
                  sourceLanguage.startsWith(lang.code)
                );

                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => onSelectSourceLanguage(lang.langCode)}
                    className={`p-3 min-h-[58px] rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between select-none active:scale-[0.98] ${
                      isSelected
                        ? 'bg-zinc-100 dark:bg-zinc-850 border-zinc-400 dark:border-zinc-600 ring-1 ring-zinc-400/30 dark:ring-zinc-600/40 shadow-xs'
                        : 'bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200/80 dark:border-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-7 h-7 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center border border-zinc-200/60 dark:border-zinc-700/60 overflow-hidden shadow-2xs">
                        <CountryFlag code={lang.code} className="w-4.5 h-4.5 rounded-full object-cover" />
                      </div>
                      {isSelected ? (
                        <span className="w-5 h-5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 inline-flex items-center justify-center shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="h-5 px-2 rounded-full bg-zinc-200/70 dark:bg-zinc-800 border border-zinc-300/60 dark:border-zinc-700/60 text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 inline-flex items-center justify-center">
                          {lang.code.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                        {lang.nativeName}
                      </div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 truncate">
                        {lang.voice}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. SECCIÓN: MICRÓFONO DE ENTRADA */}
          <div className="space-y-1.5 pt-1">
            <label htmlFor="mobile-host-mic-select" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
              Micrófono de Entrada
            </label>
            <SelectDropdown
              id="mobile-host-mic-select"
              aria-label="Micrófono de Entrada"
              value={selectedDevice}
              options={[
                { value: 'default', label: 'Micrófono Predeterminado' },
                ...devices
                  .filter(d => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
                  .map((d, i) => ({
                    value: d.deviceId,
                    label: d.label || `Micrófono ${i + 1}`
                  }))
              ]}
              onChange={async (_, val) => {
                onChangeDevice(val || 'default');
              }}
            />
          </div>

          {/* 3. SECCIÓN: VÚMETRO REACTIVO */}
          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isBroadcasting ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">
                  {isBroadcasting ? 'Señal en directo' : 'Nivel de entrada (Prueba)'}
                </span>
              </div>
              <span ref={meterTextRef} className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100 tabular-nums">0%</span>
            </div>
            <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                ref={meterBarRef}
                className="h-full w-full bg-emerald-500 rounded-full origin-left will-change-transform scale-x-0"
                style={{ transition: 'transform 0.05s linear' }}
              />
            </div>
          </div>

          {/* 4. SECCIÓN: AJUSTES DE LOCUCIÓN */}
          <div className="pt-1 space-y-3.5">
            <ElevenSlider
              label="Velocidad de Locución"
              value={speechRate}
              min={0.7}
              max={1.5}
              step={0.05}
              leftLabel="Más lento"
              rightLabel="Más rápido"
              formatValue={(val) => `${val.toFixed(2)}x`}
              onChange={onChangeSpeechRate}
            />

            <ElevenSlider
              label="Cadencia / Décalage de Traducción"
              value={decalageValue}
              min={0}
              max={100}
              step={5}
              leftLabel="Rápido (3s)"
              rightLabel="Ponencia (6s)"
              formatValue={(val) => (val < 40 ? 'Ágil' : 'Ponencia')}
              onChange={onChangeDecalage}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
