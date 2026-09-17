import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Copy, Check, ArrowDown, Mic } from 'lucide-react';

function LiveCaptions({
  transcriptHistory = [],
  interimText = '',
  currentLanguage = 'en',
  showOriginal = true,
  className = '',
  maxHeightClass = 'min-h-[220px] max-h-[500px]',
  medicalMode = false,
  medicalSpecialty = 'general',
  captionSize = 'md',
  isAdmin = false,
  activeSttInfo = null,
  activePlayingSeqId = null,
  activePlayingPacketId = null,
  activeCoalescedSeqIds = [],
  activeCoalescedPacketIds = [],
  isPlayingAudio = false
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
  const prevLastIdRef = useRef(null);

  // Modo corrida permanente y unificado para subtítulos en vivo
  const viewMode = 'continuous';

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
    const lastItem = transcriptHistory[transcriptHistory.length - 1];
    const currentLastId = lastItem ? (lastItem.id || lastItem.seqId || `${lastItem.timestamp}`) : null;
    const isNewCard = transcriptHistory.length > prevCountRef.current || (currentLastId && currentLastId !== prevLastIdRef.current);

    if (isNewCard) {
      if (consolidatingTimerRef.current) clearTimeout(consolidatingTimerRef.current);
      setDisplayedInterim('');
      setIsConsolidating(false);
    }
  }, [transcriptHistory]);

  // 1. Follow active speech playback sentence smoothly when audio is reading
  useEffect(() => {
    if (!isPlayingAudio || isUserScrolledUpRef.current || !autoScroll) return;

    requestAnimationFrame(() => {
      const activeEl = scrollRef.current?.querySelector('.gemini-reading-highlight');
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    });
  }, [isPlayingAudio, activePlayingSeqId, activePlayingPacketId, activeCoalescedSeqIds, activeCoalescedPacketIds, autoScroll]);

  // 2. Automatic scrolling: follow live streaming subtitles and incoming dictation stream smoothly
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const lastItem = transcriptHistory[transcriptHistory.length - 1];
    const currentLastId = lastItem ? (lastItem.id || lastItem.seqId || `${lastItem.timestamp}`) : null;
    const isNewItem = transcriptHistory.length > prevCountRef.current || (currentLastId && currentLastId !== prevLastIdRef.current);
    prevCountRef.current = transcriptHistory.length;
    prevLastIdRef.current = currentLastId;

    if (autoScroll && !isUserScrolledUpRef.current) {
      requestAnimationFrame(() => {
        // If an audio sentence is currently being read aloud, prioritize keeping that reading focus
        const activeReadingEl = scrollRef.current?.querySelector('.gemini-reading-highlight');
        if (isPlayingAudio && activeReadingEl) {
          activeReadingEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          return;
        }

        // Keep incoming live speech stream comfortably in view without violent jumps
        if (bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: isNewItem ? 'smooth' : 'auto', block: 'nearest' });
        } else {
          el.scrollTop = el.scrollHeight;
        }
      });
      setUnreadCount(0);
    } else if (isNewItem && isUserScrolledUpRef.current) {
      setUnreadCount(prev => prev + 1);
    }
  }, [transcriptHistory, displayedInterim, autoScroll, isPlayingAudio]);

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

  const isItemAudioActive = (item) => {
    if (!isPlayingAudio || !item) return false;
    const isPacketMatch = Boolean(
      activePlayingPacketId && item.id && (
        String(item.id) === String(activePlayingPacketId) ||
        String(activePlayingPacketId).startsWith(String(item.id) + '_') ||
        String(activePlayingPacketId).startsWith(String(item.id) + '-') ||
        String(item.id).startsWith(String(activePlayingPacketId) + '_') ||
        String(item.id).startsWith(String(activePlayingPacketId) + '-')
      )
    );
    const isSeqMatch = Boolean(
      activePlayingSeqId != null &&
      item.seqId != null &&
      Number(item.seqId) === Number(activePlayingSeqId)
    );
    const isCoalescedMatch = Boolean(
      (activeCoalescedPacketIds?.length > 0 && item.id && activeCoalescedPacketIds.some(pid => 
        String(pid) === String(item.id) ||
        String(pid).startsWith(String(item.id) + '_') ||
        String(item.id).startsWith(String(pid) + '_')
      )) ||
      (activeCoalescedSeqIds?.length > 0 && item.seqId != null && activeCoalescedSeqIds.some(sid => Number(sid) === Number(item.seqId)))
    );
    return Boolean(isPacketMatch || isSeqMatch || isCoalescedMatch);
  };

  const paragraphs = useMemo(() => {
    const groups = [];
    let currentGroup = null;

    for (let i = 0; i < transcriptHistory.length; i++) {
      const item = transcriptHistory[i];
      const prevItem = transcriptHistory[i - 1];

      const timeDiff = prevItem ? Math.abs((item.timestamp || 0) - (prevItem.timestamp || 0)) : 0;
      const isNewTurn = !prevItem ||
        Boolean(item.isAudienceQuestion) !== Boolean(prevItem.isAudienceQuestion) ||
        item.attendeeName !== prevItem.attendeeName ||
        timeDiff > 4000;

      if (isNewTurn || !currentGroup) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          id: item.id || `p_${i}`,
          timestamp: item.timestamp,
          isAudienceQuestion: Boolean(item.isAudienceQuestion),
          attendeeName: item.attendeeName,
          detectedLanguage: item.detectedLanguage,
          sttEngineUsed: item.sttEngineUsed,
          sttModel: item.sttModel,
          engineUsed: item.engineUsed,
          items: [item]
        };
      } else {
        currentGroup.items.push(item);
        if (item.sttEngineUsed) currentGroup.sttEngineUsed = item.sttEngineUsed;
        if (item.detectedLanguage) currentGroup.detectedLanguage = item.detectedLanguage;
      }
    }
    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [transcriptHistory]);

  const handleCopy = (item) => {
    const textToCopy = item.translations?.[currentLanguage] || item.originalText;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyParagraph = (p) => {
    const textToCopy = p.items.map(it => it.translations?.[currentLanguage] || it.originalText).join(' ');
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const lastParagraph = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1] : null;
  const lastParagraphItem = lastParagraph?.items?.[lastParagraph.items.length - 1];
  const isTurnRecent = lastParagraphItem ? (Date.now() - (lastParagraphItem.timestamp || 0) <= 4500) : false;
  const canAttachInterimInline = Boolean(
    displayedInterim &&
    lastParagraph &&
    !lastParagraph.isAudienceQuestion &&
    isTurnRecent
  );

  return (
    <div className={`flex flex-col h-full relative bg-transparent transition-colors duration-150 ${className}`}>
      {/* Captions Stream List — w-full para que el scrollbar quede completamente a la derecha */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto w-full bg-transparent scrollbar-custom scrollbar-fina ${maxHeightClass}`}
        role="log"
        aria-live="polite"
      >
        <div className={`w-full max-w-4xl mx-auto px-4 sm:px-6 ${
          transcriptHistory.length === 0 && !displayedInterim
            ? 'h-full flex items-center justify-center pb-24 sm:pb-0'
            : 'pt-2 pb-28 sm:pb-4 space-y-3.5 flex flex-col'
        }`}>
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
              {isAdmin && activeSttInfo?.label && (
                <div className="mt-3 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                  <span>Admin: Motor STT listo ({activeSttInfo.label})</span>
                </div>
              )}
            </div>
          ) : viewMode === 'continuous' ? (
            /* MODO CORRIDA (Continuous Flowing Paragraphs) */
            <>
              {paragraphs.map((p, pIndex) => {
                const isLastParagraph = pIndex === paragraphs.length - 1;
                const isAnyAudioActiveInParagraph = p.items.some(isItemAudioActive);
                const fullTranslated = p.items.map(it => it.translations?.[currentLanguage] || it.originalText).join(' ');
                const fullOriginal = p.items.map(it => it.originalText).filter(Boolean).join(' ');

                return (
                  <div
                    key={p.id || pIndex}
                    className={`group relative p-4 rounded-2xl border transition-all duration-300 ${
                      isAnyAudioActiveInParagraph
                        ? 'gemini-reading-card'
                        : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    {/* Paragraph Meta Header */}
                    <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 font-mono mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>
                          {new Date(p.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        {p.detectedLanguage && (
                          <>
                            <span className="text-zinc-400 dark:text-zinc-600 select-none">·</span>
                            <span>{p.detectedLanguage}</span>
                          </>
                        )}
                        {p.isAudienceQuestion && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium text-[9px] border border-blue-200 dark:border-blue-800">
                            Pregunta de {p.attendeeName || 'Audiencia'}
                          </span>
                        )}
                        {(p.engineUsed?.includes('Clinical') || medicalMode) && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-mono text-[9px] border border-emerald-200 dark:border-emerald-800">
                            Clínico
                          </span>
                        )}
                        {isAdmin && p.sttEngineUsed && (
                          <span
                            className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono text-[9px] border border-zinc-200 dark:border-zinc-700 flex items-center gap-1"
                          >
                            <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                            <span>STT: {p.sttEngineUsed}</span>
                          </span>
                        )}
                      </div>

                      <div className={`flex items-center gap-1 transition-opacity ${copiedId === p.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
                        <button
                          onClick={() => handleCopyParagraph(p)}
                          className="p-1 rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Copiar párrafo completo"
                          aria-label="Copiar texto del párrafo"
                        >
                          {copiedId === p.id ? (
                            <Check className="w-3 h-3 text-zinc-700 dark:text-zinc-200" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Continuous Flowing Paragraph Text */}
                    <p className={`${activeFontClass} font-normal text-zinc-900 dark:text-zinc-100 leading-relaxed tracking-normal`}>
                      {p.items.map((it, itIdx) => {
                        const active = isItemAudioActive(it);
                        const itText = it.translations?.[currentLanguage] || it.originalText;
                        return (
                          <span
                            key={it.id || itIdx}
                            className={active ? 'gemini-reading-highlight' : ''}
                          >
                            {itText}{' '}
                          </span>
                        );
                      })}

                      {/* Streaming interim attached inline at the end of the active sentence */}
                      {isLastParagraph && canAttachInterimInline && (
                        <span className={`transition-opacity duration-150 ${isConsolidating ? 'text-zinc-500 italic' : 'text-purple-600 dark:text-purple-300 font-medium italic'}`}>
                          {displayedInterim}
                          <span className="inline-block w-1.5 h-3.5 ml-1 bg-purple-500 dark:bg-purple-400 animate-pulse align-middle rounded-full" />
                        </span>
                      )}
                    </p>

                    {/* Original text */}
                    {showOriginal && fullOriginal && fullOriginal !== fullTranslated && (
                      <p className="mt-2.5 text-xs text-zinc-500 dark:text-zinc-400 italic border-t border-zinc-100 dark:border-zinc-800/80 pt-1.5 leading-normal">
                        "{fullOriginal}"
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Streaming Interim Box when speech is detected before paragraphs or after a pause */}
              {displayedInterim && !canAttachInterimInline && (
                <div className="p-4 rounded-2xl border border-purple-400/40 dark:border-purple-500/35 bg-purple-50/20 dark:bg-purple-950/15 shadow-xs animate-fadeIn">
                  <p className={`${activeFontClass} text-purple-600 dark:text-purple-300 font-medium italic`}>
                    {displayedInterim}
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-purple-500 dark:bg-purple-400 animate-pulse align-middle rounded-full" />
                  </p>
                </div>
              )}
            </>
          ) : (
            /* MODO BLOQUES / TARJETAS (Legacy Cards Mode) */
            transcriptHistory.map((item, index) => {
              const isLast = index === transcriptHistory.length - 1;
              const translatedText = item.translations?.[currentLanguage] || item.originalText;
              const isAudioActive = isItemAudioActive(item);
              const isCardHighlighted = isAudioActive || (!isPlayingAudio && isLast);

              return (
                <div
                  key={item.id || index}
                  className={`group relative p-4 rounded-2xl border transition-all duration-300 ${
                    isAudioActive
                      ? 'gemini-reading-card'
                      : isCardHighlighted
                      ? 'bg-zinc-50/90 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-700 shadow-xs'
                      : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {/* Meta Header */}
                  <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 font-mono mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>
                        {new Date(item.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      {item.detectedLanguage && (
                        <>
                          <span className="text-zinc-400 dark:text-zinc-600 select-none">·</span>
                          <span>{item.detectedLanguage}</span>
                        </>
                      )}
                      {(item.engineUsed?.includes('Clinical') || medicalMode) && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-mono text-[9px] border border-emerald-200 dark:border-emerald-800">
                          Clínico
                        </span>
                      )}
                      {isAdmin && item.sttEngineUsed && (
                        <span
                          className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono text-[9px] border border-zinc-200 dark:border-zinc-700 flex items-center gap-1"
                          title={`Motor de transcripción: ${item.sttEngineUsed}${item.sttModel ? ` (${item.sttModel})` : ''}`}
                        >
                          <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                          <span>STT: {item.sttEngineUsed}</span>
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center gap-1 transition-opacity ${copiedId === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
                      <button
                        onClick={() => handleCopy(item)}
                        className="p-1 rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Copiar texto"
                        aria-label="Copiar texto del subtítulo"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3 h-3 text-zinc-700 dark:text-zinc-200" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Primary Translated text */}
                  <p className={`${activeFontClass} font-medium ${isAudioActive ? 'gemini-reading-highlight !p-1.5' : 'text-zinc-900 dark:text-zinc-100'}`}>
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

          {/* Real-Time Live Speech Stream Box in Cards Mode */}
          {viewMode === 'cards' && displayedInterim && (
            <div className={`p-3.5 rounded-xl border transition-all duration-200 ${
              isConsolidating
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30 opacity-85'
                : 'border-purple-400/40 dark:border-purple-500/35 bg-purple-50/20 dark:bg-purple-950/15 shadow-xs animate-fadeIn'
            }`}>
              <div className="flex items-center justify-between text-[10px] font-mono mb-1.5 flex-wrap gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 h-3">
                    <span className={`w-1 h-2 rounded-full ${isConsolidating ? 'bg-amber-500 animate-pulse' : 'bg-sky-400 animate-pulse'}`} />
                    <span className={`w-1 h-3 rounded-full ${isConsolidating ? 'bg-amber-500 animate-pulse' : 'bg-purple-400 animate-pulse'}`} />
                    <span className={`w-1 h-2 rounded-full ${isConsolidating ? 'bg-amber-500 animate-pulse' : 'bg-pink-400 animate-pulse'}`} />
                  </div>
                  <span className={isConsolidating ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-purple-700 dark:text-purple-300 font-semibold'}>
                    {isConsolidating
                      ? 'Consolidando traducción...'
                      : isAdmin && activeSttInfo?.label
                      ? `Transcripción: ${activeSttInfo.label}`
                      : 'Transcripción y dictado IA en vivo...'}
                  </span>
                </div>
                {isAdmin && activeSttInfo?.label && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 text-[9px] font-mono shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                    <span>Modelo STT: <strong>{activeSttInfo.label}</strong> ({activeSttInfo.mode === 'streaming' ? 'Streaming' : 'Chunks'})</span>
                  </div>
                )}
              </div>
              <p className={`${activeFontClass} ${
                isConsolidating 
                  ? 'text-zinc-700 dark:text-zinc-300 italic' 
                  : 'text-purple-600 dark:text-purple-300 font-semibold italic'
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

export default React.memo(LiveCaptions);
