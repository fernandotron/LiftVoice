import React, { useEffect, useRef, useState } from 'react';
import { MessageSquareText, Copy, Check, Sparkles, Globe, Bookmark, AudioLines, Download, ArrowDown, Type, Stethoscope } from 'lucide-react';

export default function LiveCaptions({
  transcriptHistory = [],
  interimText = '',
  currentLanguage = 'en',
  showOriginal = true,
  className = '',
  maxHeightClass = 'min-h-[220px] max-h-[500px]',
  medicalMode = false,
  medicalSpecialty = 'general'
}) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const isUserScrolledUpRef = useRef(false);
  const [copiedId, setCopiedId] = useState(null);
  const [bookmarks, setBookmarks] = useState(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState(1); // 0: small, 1: normal, 2: large
  const prevCountRef = useRef(transcriptHistory.length);

  // Automatic scrolling: smoothly follow live subtitles and interim dictation stream
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const isNewItem = transcriptHistory.length > prevCountRef.current;
    prevCountRef.current = transcriptHistory.length;

    if (autoScroll && !isUserScrolledUpRef.current) {
      requestAnimationFrame(() => {
        if (bottomRef.current) {
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

  const toggleBookmark = (id) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportText = () => {
    if (transcriptHistory.length === 0) return;
    const lines = transcriptHistory.map((item) => {
      const time = new Date(item.timestamp || Date.now()).toLocaleTimeString();
      const text = item.translations?.[currentLanguage] || item.originalText;
      return `[${time}] ${text}\n(Original: "${item.originalText}")\n`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LiftVoice_Transcript_${currentLanguage.toUpperCase()}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fontSizes = ['text-xs', 'text-sm', 'text-base'];
  const originalFontSizes = ['text-[11px]', 'text-xs', 'text-sm'];

  const displayedList = onlyBookmarks
    ? transcriptHistory.filter(item => bookmarks.has(item.id))
    : transcriptHistory;

  return (
    <div className={`flex flex-col h-full relative bg-white ${className}`}>
      {/* Studio Subtitles Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 uppercase tracking-wider">
          <AudioLines className="w-3.5 h-3.5 text-zinc-900" />
          <span>Subtítulos en Vivo ({currentLanguage.toUpperCase()})</span>
          {medicalMode && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-mono border border-emerald-200">
              <Stethoscope className="w-2.5 h-2.5 text-emerald-600" />
              <span>CLÍNICO</span>
            </span>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5">
          {/* Font Size Button */}
          <button
            onClick={() => setFontSizeLevel((fontSizeLevel + 1) % 3)}
            className="p-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 hover:text-zinc-900 text-xs transition-colors cursor-pointer"
            title="Cambiar tamaño de texto"
          >
            <Type className="w-3.5 h-3.5" />
          </button>

          {/* Bookmark filter button */}
          <button
            onClick={() => setOnlyBookmarks(!onlyBookmarks)}
            className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer flex items-center gap-1 ${
              onlyBookmarks
                ? 'bg-amber-50 text-amber-800 border border-amber-300'
                : 'bg-zinc-50 text-zinc-600 hover:text-zinc-900 border border-zinc-200'
            }`}
            title="Ver solo destacados"
          >
            <Bookmark className={`w-3 h-3 ${onlyBookmarks ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>{bookmarks.size > 0 ? bookmarks.size : ''}</span>
          </button>

          {/* Export TXT button */}
          <button
            onClick={handleExportText}
            disabled={transcriptHistory.length === 0}
            className="p-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer disabled:opacity-40"
            title="Descargar transcripción completa (.txt)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Auto-scroll indicator */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono transition-all cursor-pointer border ${
              autoScroll
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-zinc-50 text-zinc-500 border-zinc-200'
            }`}
          >
            {autoScroll ? 'AUTO' : 'MANUAL'}
          </button>
        </div>
      </div>

      {/* Captions Stream List */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto p-4 space-y-2.5 bg-white ${maxHeightClass}`}
      >
        {displayedList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center text-zinc-400">
            <AudioLines className="w-8 h-8 mb-2 opacity-30 text-zinc-400" />
            <p className="text-xs text-zinc-600 font-medium">
              {onlyBookmarks ? 'No tienes frases guardadas en favoritos.' : 'Esperando locución del orador...'}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              {onlyBookmarks ? 'Toca el icono de marcador en cualquier frase para destacarla.' : 'Los subtítulos traducidos aparecerán aquí en tiempo real.'}
            </p>
          </div>
        ) : (
          displayedList.map((item, index) => {
            const isLast = index === displayedList.length - 1;
            const translatedText = item.translations?.[currentLanguage] || item.originalText;
            const isBookmarked = bookmarks.has(item.id);

            return (
              <div
                key={item.id || index}
                className={`group relative p-3.5 rounded-xl border transition-all duration-150 ${
                  isLast
                    ? 'bg-zinc-50/80 border-zinc-300 shadow-xs'
                    : 'bg-white border-zinc-200 hover:border-zinc-300'
                }`}
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span>
                      {new Date(item.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {item.detectedLanguage && (
                      <span className="px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 uppercase text-[9px] border border-zinc-200">
                        {item.detectedLanguage}
                      </span>
                    )}
                    {(item.engineUsed?.includes('Clinical') || medicalMode) && (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-mono text-[9px] border border-emerald-200">
                        CIE-11
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleBookmark(item.id)}
                      className={`p-1 rounded hover:bg-zinc-100 transition-colors cursor-pointer ${
                        isBookmarked ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-700'
                      }`}
                      title="Guardar marcador"
                    >
                      <Bookmark className={`w-3 h-3 ${isBookmarked ? 'fill-amber-500' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleCopy(item)}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
                      title="Copiar texto"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Primary Translated text */}
                <p className={`${fontSizes[fontSizeLevel]} font-medium text-zinc-900 leading-relaxed`}>
                  {translatedText}
                </p>

                {/* Original source text */}
                {showOriginal && item.originalText && item.originalText !== translatedText && (
                  <p className={`mt-1.5 ${originalFontSizes[fontSizeLevel]} text-zinc-500 italic border-t border-zinc-100 pt-1.5`}>
                    "{item.originalText}"
                  </p>
                )}
              </div>
            );
          })
        )}

        {/* Real-Time Live Speech Stream Box (Track 1 - Zero Lag) */}
        {interimText && (
          <div className="p-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-left animate-fadeIn">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-mono mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              <span>DETECTANDO VOZ EN VIVO</span>
            </div>
            <p className={`${fontSizes[fontSizeLevel]} text-zinc-800 italic leading-relaxed font-medium`}>
              "{interimText}..."
            </p>
          </div>
        )}

        {/* Scroll anchor at the bottom of the feed */}
        <div ref={bottomRef} className="h-px w-full pointer-events-none" />
      </div>

      {/* Floating Pill when user scrolled up and new text arrives */}
      {unreadCount > 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-medium shadow-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <ArrowDown className="w-3 h-3" />
            <span>Nuevas frases ({unreadCount})</span>
          </button>
        </div>
      )}
    </div>
  );
}
