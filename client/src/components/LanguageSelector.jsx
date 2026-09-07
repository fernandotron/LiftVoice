import React from 'react';
import { Volume2, Check, Radio, Sparkles, User } from 'lucide-react';

export const SUPPORTED_LANGUAGES = [
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    voice: 'Nova Neural',
    description: 'Natural & Enérgica',
    accentColor: '#ffffff'
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    voice: 'Alloy / Orion',
    description: 'Crisp & Professional',
    accentColor: '#ffffff'
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    voice: 'Elsa Neural',
    description: 'Espressivo & Caldo',
    accentColor: '#ffffff'
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    voice: 'Francisca Neural',
    description: 'Suave & Dinâmico',
    accentColor: '#ffffff'
  }
];

export default function LanguageSelector({
  selectedLanguage = 'en',
  onSelectLanguage,
  languageBreakdown = {},
  variant = 'grid', // 'grid' | 'pills'
  disabled = false
}) {
  return (
    <div className="w-full">
      {variant === 'grid' && (
        <div className="grid grid-cols-2 gap-3">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            const listenerCount = languageBreakdown[lang.code] || 0;

            return (
              <button
                key={lang.code}
                type="button"
                disabled={disabled}
                onClick={() => onSelectLanguage(lang.code)}
                className={`relative group p-3 sm:p-3.5 rounded-xl text-left transition-all duration-150 cursor-pointer overflow-hidden border ${
                  isSelected
                    ? 'bg-zinc-900 border-white text-white shadow-lg ring-1 ring-white/20'
                    : 'bg-zinc-950/80 border-white/10 text-zinc-300 hover:border-white/25 hover:bg-zinc-900/60'
                }`}
              >
                {/* Top Row: Flag & Selection / Listener Count */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl flex-shrink-0">{lang.flag}</span>

                  {isSelected ? (
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-white text-black text-xs font-bold shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-900/90 border border-white/10 text-zinc-400 font-mono">
                      {listenerCount} {listenerCount === 1 ? 'oyente' : 'oyentes'}
                    </span>
                  )}
                </div>

                {/* Second Row: Language Name & Voice Model */}
                <div className="space-y-0.5 min-w-0">
                  <div className="font-semibold text-xs sm:text-sm text-white truncate flex items-center gap-1.5">
                    <span>{lang.nativeName}</span>
                    <span className="text-[10px] font-mono text-zinc-400 font-normal">({lang.code.toUpperCase()})</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono truncate">
                    {lang.voice}
                  </div>
                </div>

                {/* Bottom Row: Accent Description & Active Status */}
                <div className="flex items-center justify-between text-[11px] pt-2 mt-2 border-t border-white/5">
                  <span className="text-zinc-500 truncate text-[10px] sm:text-xs">{lang.description}</span>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px] font-semibold flex-shrink-0 ml-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      ACTIVO
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {variant === 'pills' && (
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-950 border border-zinc-800 overflow-x-auto scrollbar-thin">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                disabled={disabled}
                onClick={() => onSelectLanguage(lang.code)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                  isSelected
                    ? 'bg-white text-black shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
