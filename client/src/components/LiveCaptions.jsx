import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, ArrowDown, Mic } from 'lucide-react';

export default function LiveCaptions({
  transcriptHistory = [],
  interimText = '',
  currentLanguage = 'en',
  showOriginal = true,
  className = '',
  maxHeightClass = 'min-h-[220px] max-h-[500px]',
  medicalMode = false,
  medicalSpecialty = 'general',
  captionSize = 'md'
}) {
  const fontClassMap = {
    sm: 'text-xs sm:text-sm leading-relaxed',
    md: 'text-sm sm:text-base leading-relaxed',
    lg: 'text-base sm:text-lg leading-relaxed',
    xl: 'text-lg sm:text-xl font-medium leading-loose'
  };
  const activeFontClass = fontClassMap[captionSize] || fontClassMap.md;

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const isUserScrolledUpRef = useRef(false);
  const [copiedId, setCopiedId] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef(transcriptHistory.length);

  // Anti-flicker: preserve recent interim text briefly while backend translates and final card arrives
  const [displayedInterim, setDisplayedInterim] = useState(interimText || '');
  const [isConsolidating, setIsConsolidating] = useState(false);
  const consolidatingTimerRef = useRef(null);

  useEffect(() => {
    if (interimText) {
      if (consolidatingTimerRef.current) clearTimeout(consolidatingTimerRef.current);
      setDisplayedInterim(interimText);
      setIsConsolidating(false);
    } else if (displayedInterim && !isConsolidating) {
      setIsConsolidating(true);
      consolidatingTimerRef.current = setTimeout(() => {
        setDisplayedInterim('');
        setIsConsolidating(false);
      }, 1200);
    }
  }, [interimText]);

  useEffect(() => {
    if (transcriptHistory.length > prevCountRef.current) {
      if (consolidatingTimerRef.current) clearTimeout(consolidatingTimerRef.current);
      setDisplayedInterim('');
      setIsConsolidating(false);
    }
  }, [transcriptHistory.length]);

  // Automatic scrolling: smoothly follow live subtitles and interim dictation stream without stutter
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const isNewItem = transcriptHistory.length > prevCountRef.current;
    prevCountRef.current = transcriptHistory.length;

    if (autoScroll && !isUserScrolledUpRef.current) {
      requestAnimationFrame(() => {
        if (isNewItem && bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else {
          el.scrollTop = el.scrollHeight;
        }
      });
      setUnreadCount(0);
    } else if (isNewItem && isUserScrolledUpRef.current) {
      setUnreadCount(prev => prev + 1);
    }
  }, [transcriptHistory, interimText, autoScroll]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    
    // If user scrolled up by more than 80px, pause auto-scroll to let them read history
    if (distanceFromBottom > 80) {
      isUserScrolledUpRef.current = true;
      if (autoScroll) setAutoScroll(false);
    } else {
      isUserScrolledUpRef.current = false;
      if (!autoScroll) {
        setAutoScroll(true);
        setUnreadCount(0);
      }
    }
  };

  const scrollToBottom = () => {
    isUserScrolledUpRef.current = false;
    setAutoScroll(true);
    setUnreadCount(0);
    requestAnimationFrame(() => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    });
  };

  const handleCopy = (item) => {
    const textToCopy = item.translations?.[currentLanguage] || item.originalText;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={`flex flex-col h-full relative bg-transparent transition-colors duration-150 ${className}`}>
      {/* Captions Stream List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto px-4 sm:px-6 bg-transparent ${
          transcriptHistory.length === 0 && !displayedInterim
            ? 'flex items-center justify-center'
            : 'py-2.5 sm:py-3 space-y-3.5'
        } ${maxHeightClass}`}
        role="log"
        aria-live="polite"
      >
        {transcriptHistory.length === 0 && !displayedInterim ? (
          <div className="flex flex-col items-center justify-center text-center text-zinc-400 dark:text-zinc-500 px-4 py-12 select-none animate-fadeIn">
            <div className="text-zinc-400 dark:text-zinc-600 font-serif text-5xl font-light leading-none mb-3 tracking-wider select-none">
              T
            </div>
            <p className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300">
              No hay transcripción disponible
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs">
              La transcripción y subtítulos aparecerán aquí en cuanto el orador comience a hablar.
            </p>
          </div>
        ) : (
          transcriptHistory.map((item, index) => {
            const isLast = index === transcriptHistory.length - 1;
            const translatedText = item.translations?.[currentLanguage] || item.originalText;

            return (
              <div
                key={item.id || index}
                className={`group relative p-4 rounded-2xl border transition-all duration-150 ${
                  isLast
                    ? 'bg-zinc-50/90 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-700 shadow-xs'
                    : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 font-mono mb-2">
                  <div className="flex items-center gap-1.5">
                    <span>
                      {new Date(item.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {item.detectedLanguage && (
                      <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[9px] font-mono border border-zinc-200 dark:border-zinc-700">
                        {item.detectedLanguage}
                      </span>
                    )}
                    {(item.engineUsed?.includes('Clinical') || medicalMode) && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-mono text-[9px] border border-emerald-200 dark:border-emerald-800">
                        Clínico
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(item)}
                      className="p-1 rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Copiar texto"
                      aria-label="Copiar texto del subtítulo"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Primary Translated text */}
                <p className={`${activeFontClass} font-medium text-zinc-900 dark:text-zinc-100`}>
                  {translatedText}
                </p>

                {/* Original source text */}
                {showOriginal && item.originalText && item.originalText !== translatedText && (
                  <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 italic border-t border-zinc-100 dark:border-zinc-800 pt-1.5">
                    "{item.originalText}"
                  </p>
                )}
              </div>
            );
          })
        )}

        {/* Real-Time Live Speech Stream Box (Track 1 - Zero Lag & Anti-flicker with Gemini Live aesthetic) */}
        {displayedInterim && (
          <div className={`p-3.5 rounded-xl border transition-all duration-200 ${
            isConsolidating
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30 opacity-85'
              : 'border-cyan-400/50 dark:border-cyan-500/40 bg-gradient-to-r from-cyan-50/40 via-blue-50/20 to-purple-50/40 dark:from-cyan-950/20 dark:via-blue-950/15 dark:to-purple-950/20 ring-1 ring-cyan-400/30 shadow-xs animate-fadeIn'
          }`}>
            <div className="flex items-center gap-2 text-[10px] font-mono mb-1.5">
              <div className="flex items-center gap-0.5 h-3">
                <span className={`w-1 h-2 rounded-full ${isConsolidating ? 'bg-amber-500 animate-pulse' : 'bg-cyan-400 animate-gemini-wave'}`} />
                <span className={`w-1 h-3 rounded-full ${isConsolidating ? 'bg-amber-500 animate-pulse' : 'bg-blue-500 animate-gemini-wave delay-1'}`} />
                <span className={`w-1 h-2 rounded-full ${isConsolidating ? 'bg-amber-500 animate-pulse' : 'bg-purple-500 animate-gemini-wave delay-2'}`} />
              </div>
              <span className={isConsolidating ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-cyan-700 dark:text-cyan-300 font-semibold'}>
                {isConsolidating ? 'Consolidando traducción...' : 'Transcripción y dictado IA en vivo...'}
              </span>
            </div>
            <p className={`${activeFontClass} ${
              isConsolidating 
                ? 'text-zinc-700 dark:text-zinc-300 italic' 
                : 'gemini-text-stream font-semibold italic'
            }`}>
              "{displayedInterim}..."
            </p>
          </div>
        )}

        {/* Scroll anchor at the bottom of the feed */}
        {(transcriptHistory.length > 0 || displayedInterim) && (
          <div ref={bottomRef} className="h-4 sm:h-2 w-full pointer-events-none flex-shrink-0" />
        )}
      </div>

      {/* Floating Pill when user scrolled up and new text arrives */}
      {unreadCount > 0 && (
        <div className="absolute bottom-24 sm:bottom-3 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium shadow-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
            aria-label="Ver las nuevas frases recibidas"
          >
            <ArrowDown className="w-3 h-3" />
            <span>Nuevas frases ({unreadCount})</span>
          </button>
        </div>
      )}
    </div>
  );
}
