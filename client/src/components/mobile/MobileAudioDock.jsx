import React, { useState, useRef } from 'react';
import { Volume2, VolumeX, Hand, Globe, Check, Type, Users } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../LanguageSelector.jsx';
import CountryFlag from '../shared/CountryFlag.jsx';
import GeminiFluidWave from '../shared/GeminiFluidWave.jsx';
import { useI18n } from '../../contexts/I18nContext.jsx';

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
  isQAEnabled = false,
  captionSize = 'md',
  onCycleCaptionSize = () => {},
  onTogglePlay = () => {},
  onToggleMute = () => {},
  onOpenLanguageSheet,
  onOpenAudienceSheet = () => {},
  onOpenQA = () => {},
  attendeesCount = 0,
  profileName = 'Oyente'
}) {
  const { t } = useI18n();
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [showSizeToast, setShowSizeToast] = useState(false);
  const sizeToastTimerRef = useRef(null);

  const sizeNames = {
    sm: t('mobileAudioDock.sizeNames.sm') || 'Pequeño (A-)',
    md: t('mobileAudioDock.sizeNames.md') || 'Normal (A)',
    lg: t('mobileAudioDock.sizeNames.lg') || 'Grande (A+)',
    xl: t('mobileAudioDock.sizeNames.xl') || 'Inmersivo (A++)'
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

    setIsLanguageMenuOpen((prev) => !prev);
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
        navigator.vibrate(isLive ? 24 : [16, 28]);
      }
    } catch (e) {}
    if (!isUnlocked) {
      onTogglePlay();
    } else {
      onToggleMute();
    }
  };

  const handleAttendeesClick = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch (e) {}
    setIsLanguageMenuOpen(false);
    onOpenAudienceSheet();
  };

  const isLive = isUnlocked && !isMuted;
  const activeLangCode = selectedLanguage || currentLanguage?.code || 'es';
  const sizeLabels = { sm: 'A-', md: 'A', lg: 'A+', xl: 'A++' };
  const captionSizeLabel = sizeLabels[captionSize] || 'A';
  const effectiveAttendeesCount = Math.max(
    attendeesCount || 0,
    Object.values(languageBreakdown || {}).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0),
    1
  );

  return (
    <nav 
      aria-label={t('mobileAudioDock.navAria')}
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-12 px-2.5 sm:px-4 pointer-events-none select-none"
    >
      {/* Capa de difuminado progresivo inferior (Frosted Glass con gradiente y desenfoque) */}
      <div 
        aria-hidden="true" 
        className="dock-difuminado-inferior" 
      />

      <div className="relative z-10 flex items-center justify-center gap-2.5 sm:gap-3 pointer-events-auto">
        
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

              <div
                role="menu"
                aria-orientation="vertical"
                aria-label={t('mobileAudioDock.languageMenuAria')}
                className="absolute bottom-[calc(100%+14px)] left-0 z-50 w-64 max-w-[calc(100vw-24px)] rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800 shadow-2xl p-1.5 pointer-events-auto animate-fadeIn origin-bottom-left"
              >
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
                            ? 'bg-transparent text-zinc-900 dark:text-zinc-100 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                            : 'bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
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

          {/* Botón Disparador Satélite Izquierdo (Idioma) */}
          <button
            type="button"
            onClick={handleGlobeClick}
            aria-haspopup="menu"
            aria-expanded={isLanguageMenuOpen}
            className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 ${
              isLanguageMenuOpen
                ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
            title={t('mobileAudioDock.globeTitle', { language: currentLanguage.nativeName })}
            aria-label={t('mobileAudioDock.globeAria', { language: currentLanguage.nativeName })}
          >
            <Globe className="w-5.5 h-5.5" strokeWidth={1.6} />
          </button>
        </div>

        {/* Satélite 2: Ajuste de Tamaño de Subtítulos (Icono centrado limpio) */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={handleFontSizeClick}
            className="w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            title={t('mobileAudioDock.fontSizeTitle', { size: captionSizeName })}
            aria-label={t('mobileAudioDock.fontSizeAria', { size: captionSizeName })}
          >
            <Type className="w-5.5 h-5.5" strokeWidth={1.6} />
          </button>

          {/* Micro-toast flotante de confirmación de tamaño al pulsar */}
          {showSizeToast && (
            <div
              className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-zinc-900/90 dark:bg-zinc-800/95 text-white dark:text-zinc-100 border border-zinc-200/20 dark:border-zinc-700/60 text-[10px] font-normal whitespace-nowrap shadow-lg backdrop-blur-md pointer-events-none animate-fadeIn flex items-center gap-1 z-50"
              aria-live="polite"
            >
              <span>{t('mobileAudioDock.toastPrefix')}</span>
              <span className="font-normal">{captionSizeName}</span>
            </div>
          )}
        </div>

        {/* Centro HERO: Master Audio Dynamic Morphing Capsule 2026 */}
        <div className="relative inline-flex items-center justify-center shrink-0">
          {isLive && (
            <div
              className="absolute -inset-1.5 rounded-full gemini-aura-glow opacity-60 pointer-events-none transition-opacity duration-300 will-change-transform"
              aria-hidden="true"
            />
          )}

          <button
            type="button"
            onClick={handleMuteClick}
            className={`relative h-12 rounded-full font-medium text-xs tracking-tight flex items-center justify-center shadow-xs cursor-pointer active:scale-95 touch-manipulation select-none overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width,background-color] ${
              isLive
                ? 'w-[118px] sm:w-[124px] border border-white/30 shadow-lg shadow-purple-500/25'
                : 'w-12 px-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
            title={!isUnlocked ? t('mobileAudioDock.audioButton.tuneTitle') : isMuted ? t('mobileAudioDock.audioButton.unmuteTitle') : t('mobileAudioDock.audioButton.liveMuteTitle')}
            aria-label={!isUnlocked ? t('mobileAudioDock.audioButton.tuneAria') : isMuted ? t('mobileAudioDock.audioButton.unmuteAria') : t('mobileAudioDock.audioButton.liveMuteAria')}
          >
            {/* Contenido en Estado ACTIVO: Gemini Fluid Wave viva */}
            <div 
              className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out ${
                isLive 
                  ? 'opacity-100 scale-100 delay-75 pointer-events-auto' 
                  : 'opacity-0 scale-75 pointer-events-none absolute'
              }`}
            >
              <GeminiFluidWave />
            </div>

            {/* Contenido en Estado REPOSO / SILENCIADO: Icono Centrado Puro (Sin texto ruidoso) */}
            <div 
              className={`flex items-center justify-center transition-all duration-150 ease-out ${
                !isLive 
                  ? 'opacity-100 scale-100' 
                  : 'opacity-0 scale-75 pointer-events-none absolute'
              }`}
            >
              {!isUnlocked ? (
                <Volume2 className="w-5.5 h-5.5 text-zinc-700 dark:text-zinc-300 animate-pulse" strokeWidth={1.6} />
              ) : (
                <VolumeX className="w-5.5 h-5.5 text-zinc-600 dark:text-zinc-400" strokeWidth={1.6} />
              )}
            </div>
          </button>
        </div>

        {/* Satélite 4: Audiencia en Sala (Abre AudienceBottomSheet) */}
        <button
          type="button"
          onClick={handleAttendeesClick}
          className="relative w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title={t('mobileAudioDock.audienceButton.title')}
          aria-label={t('mobileAudioDock.audienceButton.aria')}
        >
          <Users className="w-5 h-5" strokeWidth={1.7} />
        </button>

        {/* Satélite Derecho: Q&A / Pedir la palabra (Diseño 100% neutro, mano estática) */}
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={handleQAClick}
          className={`relative w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 ${
            !isQAEnabled && qaState === 'idle'
              ? 'text-zinc-400 dark:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
          title={
            !isQAEnabled && qaState === 'idle'
              ? t('listenerView.assistant.qa.disabledNotice', 'El ponente no ha habilitado todavía la opción de preguntas')
              : qaState === 'requested'
              ? t('mobileAudioDock.qaButton.requestedTitle')
              : qaState === 'speaking'
              ? t('mobileAudioDock.qaButton.speakingTitle')
              : t('mobileAudioDock.qaButton.defaultTitle')
          }
          aria-label={
            !isQAEnabled && qaState === 'idle'
              ? t('listenerView.assistant.qa.disabledNotice', 'El ponente no ha habilitado todavía la opción de preguntas')
              : qaState === 'requested'
              ? t('mobileAudioDock.qaButton.requestedAria')
              : qaState === 'speaking'
              ? t('mobileAudioDock.qaButton.speakingAria')
              : t('mobileAudioDock.qaButton.defaultAria')
          }
        >
          <Hand className={`w-5.5 h-5.5 transition-colors ${
            qaState === 'requested'
              ? 'text-amber-500'
              : qaState === 'speaking'
              ? 'text-emerald-500'
              : !isQAEnabled
              ? 'text-zinc-400 dark:text-zinc-600'
              : 'text-zinc-700 dark:text-zinc-300'
          }`} strokeWidth={1.6} />
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
