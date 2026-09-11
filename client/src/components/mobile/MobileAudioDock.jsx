import React, { useState, useRef } from 'react';
import { Volume2, VolumeX, Hand, Globe, Check, Type } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../LanguageSelector.jsx';
import CountryFlag from '../shared/CountryFlag.jsx';
import GeminiFluidWave from '../shared/GeminiFluidWave.jsx';

export default function MobileAudioDock({
  currentLanguage = { code: 'es', nativeName: 'Español' },
  selectedLanguage = 'es',
  onSelectLanguage,
  languageBreakdown = {},
  isPlaying = false,
  isUnlocked = true,
  isMuted = false,
  latency = 14,
  qaState = 'idle', // 'idle' | 'requested' | 'speaking' | 'completed'
  captionSize = 'md',
  onCycleCaptionSize = () => {},
  onTogglePlay = () => {},
  onToggleMute = () => {},
  onOpenLanguageSheet,
  onOpenQA = () => {}
}) {
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [showSizeToast, setShowSizeToast] = useState(false);
  const sizeToastTimerRef = useRef(null);

  const sizeNames = {
    sm: 'Pequeño (A-)',
    md: 'Normal (A)',
    lg: 'Grande (A+)',
    xl: 'Inmersivo (A++)'
  };
  const captionSizeName = sizeNames[captionSize] || 'Normal (A)';

  const handleFontSizeClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    } catch (e) {}
    onCycleCaptionSize();
    setShowSizeToast(true);
    if (sizeToastTimerRef.current) clearTimeout(sizeToastTimerRef.current);
    sizeToastTimerRef.current = setTimeout(() => {
      setShowSizeToast(false);
    }, 1400);
  };

  const handleGlobeClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch (e) {}

    if (onSelectLanguage) {
      setIsLanguageMenuOpen((prev) => !prev);
    } else if (onOpenLanguageSheet) {
      onOpenLanguageSheet();
    }
  };

  const handleLanguageSwitch = (code) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch (e) {}

    if (onSelectLanguage) {
      onSelectLanguage(code);
    }
    setIsLanguageMenuOpen(false);
  };

  const handlePlayClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch (e) {}
    if (!isUnlocked) {
      onTogglePlay();
    } else {
      onToggleMute();
    }
  };

  const handleQAClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch (e) {}
    onOpenQA();
  };

  const handleMuteClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch (e) {}
    if (!isUnlocked) {
      onTogglePlay();
    } else {
      onToggleMute();
    }
  };

  const isLive = isUnlocked && !isMuted;
  const activeLangCode = selectedLanguage || currentLanguage?.code || 'es';
  const sizeLabels = { sm: 'A-', md: 'A', lg: 'A+', xl: 'A++' };
  const captionSizeLabel = sizeLabels[captionSize] || 'A';

  return (
    <nav 
      aria-label="Controles de audio del oyente"
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-10 px-4 bg-gradient-to-t from-white via-white/95 via-45% to-transparent dark:from-zinc-950 dark:via-zinc-950/95 dark:via-45% dark:to-transparent pointer-events-none"
    >
      <div className="flex items-center justify-center gap-2 pointer-events-auto">
        
        {/* Satélite Izquierdo: Selector de Idioma con Menú de Acciones Superior */}
        <div className="relative flex-shrink-0">

          {/* Menú de Acciones Flotante estilo standalone-assistant */}
          {isLanguageMenuOpen && (
            <>
              {/* Telón invisible para cerrar al tocar fuera sin oscurecer ni aplicar blur */}
              <div
                className="fixed inset-0 z-40 bg-transparent pointer-events-auto"
                onClick={() => setIsLanguageMenuOpen(false)}
                aria-hidden="true"
              />

              {/* Tarjeta flotante emergente encima del botón */}
              <div
                role="menu"
                aria-orientation="vertical"
                aria-label="Seleccionar idioma de traducción"
                className="absolute bottom-[calc(100%+14px)] left-0 z-50 w-64 max-w-[calc(100vw-24px)] rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800 shadow-2xl p-1.5 pointer-events-auto animate-fadeIn origin-bottom-left"
              >
                <div className="px-2.5 pt-1.5 pb-1">
                  <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    Idioma de traducción
                  </span>
                </div>

                <div className="space-y-0.5">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isSelected = activeLangCode === lang.code;
                    const count = languageBreakdown[lang.code] || 0;

                    return (
                      <button
                        key={lang.code}
                        role="menuitem"
                        type="button"
                        onClick={() => handleLanguageSwitch(lang.code)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CountryFlag code={lang.code} className="w-5 h-5 shrink-0" title={lang.nativeName} />
                          <span className="truncate font-medium">{lang.nativeName}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {count > 0 && !isSelected && (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                              {count}
                            </span>
                          )}
                          {isSelected ? (
                            <div className="w-4 h-4 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-2xs">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700 shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Flecha indicadora apuntando hacia el botón Globe */}
                <div
                  className="absolute -bottom-1.5 left-4.5 w-3 h-3 bg-white dark:bg-zinc-900 border-r border-b border-zinc-200/90 dark:border-zinc-800 rotate-45 pointer-events-none"
                  aria-hidden="true"
                />
              </div>
            </>
          )}

          {/* Botón Disparador Satélite Izquierdo */}
          {/* Botón Disparador Satélite Izquierdo (Idioma) */}
          <button
            type="button"
            onClick={handleGlobeClick}
            aria-haspopup="menu"
            aria-expanded={isLanguageMenuOpen}
            className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 ${
              isLanguageMenuOpen
                ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
            title={`Idioma: ${currentLanguage.nativeName}. Toca para cambiar.`}
            aria-label={`Idioma actual: ${currentLanguage.nativeName}. Toca para cambiar.`}
          >
            <Globe className="w-5 h-5" />
          </button>
        </div>

        {/* Satélite 2: Ajuste de Tamaño de Subtítulos (Icono centrado limpio) */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={handleFontSizeClick}
            className="w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            title={`Tamaño de subtítulos: ${captionSizeName}. Toca para cambiar.`}
            aria-label={`Tamaño de subtítulos: ${captionSizeName}. Toca para cambiar.`}
          >
            <Type className="w-5 h-5" />
          </button>

          {/* Micro-toast flotante de confirmación de tamaño al pulsar */}
          {showSizeToast && (
            <div
              className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-zinc-900/90 dark:bg-zinc-800/95 text-white dark:text-zinc-100 border border-zinc-200/20 dark:border-zinc-700/60 text-[10px] font-medium whitespace-nowrap shadow-lg backdrop-blur-md pointer-events-none animate-fadeIn flex items-center gap-1 z-50"
              aria-live="polite"
            >
              <span>Subtítulos:</span>
              <strong className="font-semibold">{captionSizeName}</strong>
            </div>
          )}
        </div>

        {/* Centro: Master Audio Visualizer (Gemini Live 2026 Pure Living AI Pill) */}
        <div className="flex items-center justify-center">
          <div className="relative w-24 sm:w-28 h-11 flex items-center justify-center">
            {isLive && (
              <div
                className="absolute -inset-1.5 rounded-full gemini-aura-glow opacity-60 pointer-events-none"
                aria-hidden="true"
              />
            )}

            <button
              type="button"
              onClick={handleMuteClick}
              className={`relative w-24 sm:w-28 h-11 rounded-full font-medium text-xs tracking-tight flex items-center justify-center transition-all cursor-pointer active:scale-95 touch-manipulation select-none overflow-hidden ${
                !isUnlocked
                  ? 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 shadow-xs'
                  : isMuted
                  ? 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 shadow-xs'
                  : 'text-white shadow-lg shadow-purple-500/25 border border-white/30'
              }`}
              title={!isUnlocked ? 'Toca para sintonizar audio' : isMuted ? 'Toca para activar sonido' : 'Audio en vivo activo'}
              aria-label={!isUnlocked ? 'Sintonizar audio' : isMuted ? 'Activar sonido' : 'Audio en vivo activo'}
            >
              {isLive ? (
                <GeminiFluidWave />
              ) : isMuted ? (
                <span className="relative z-10 text-[11px] font-medium tracking-tight text-zinc-500 dark:text-zinc-400 select-none">
                  Silenciado
                </span>
              ) : !isUnlocked ? (
                <span className="relative z-10 text-[11px] font-semibold tracking-tight text-zinc-700 dark:text-zinc-300 select-none">
                  Sintonizar
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Satélite: Botón Mute / Sonido (Diseño 100% neutro) */}
        <button
          type="button"
          onClick={handleMuteClick}
          className="relative w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title={!isUnlocked ? 'Sintonizar audio' : isMuted ? 'Activar sonido' : 'Silenciar audio'}
          aria-label={!isUnlocked ? 'Sintonizar audio' : isMuted ? 'Activar sonido' : 'Silenciar audio'}
        >
          {!isUnlocked ? (
            <Volume2 className="w-5 h-5 text-zinc-700 dark:text-zinc-300 transition-colors" />
          ) : isMuted ? (
            <VolumeX className="w-5 h-5 text-rose-500 transition-colors" />
          ) : (
            <Volume2 className="w-5 h-5 text-zinc-700 dark:text-zinc-300 transition-colors" />
          )}
        </button>

        {/* Satélite Derecho: Q&A / Pedir la palabra (Diseño 100% neutro, mano estática) */}
        <button
          type="button"
          onClick={handleQAClick}
          className="relative w-11 h-11 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title={qaState === 'requested' ? 'Mano levantada (esperando turno)' : qaState === 'speaking' ? 'Tienes la palabra' : 'Pedir la palabra / Q&A'}
          aria-label={qaState === 'requested' ? 'Mano levantada (esperando turno)' : qaState === 'speaking' ? 'Tienes la palabra' : 'Pedir la palabra al ponente'}
        >
          <Hand className={`w-5 h-5 transition-colors ${
            qaState === 'requested'
              ? 'text-amber-500'
              : qaState === 'speaking'
              ? 'text-emerald-500'
              : 'text-zinc-700 dark:text-zinc-300'
          }`} />
          {qaState === 'requested' && (
            <span className="absolute top-0.5 right-0.5 flex h-3 w-3 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-white dark:border-zinc-900" />
            </span>
          )}
          {qaState === 'speaking' && (
            <span className="absolute top-0.5 right-0.5 flex h-3 w-3 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white dark:border-zinc-900" />
            </span>
          )}
        </button>

      </div>
    </nav>
  );
}
