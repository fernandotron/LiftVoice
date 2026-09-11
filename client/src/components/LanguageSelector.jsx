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
                    ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-white text-white dark:text-zinc-900 shadow-md ring-1 ring-zinc-900/10 dark:ring-white/20'
                    : 'bg-white dark:bg-zinc-900/70 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
              >
                {/* Top Row: Flag & Selection / Listener Count */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl flex-shrink-0">{lang.flag}</span>

                  {isSelected ? (
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-xs font-bold shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  ) : (
                    <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 font-mono">
                      {listenerCount} {listenerCount === 1 ? 'oyente' : 'oyentes'}
                    </span>
                  )}
                </div>

                {/* Second Row: Language Name & Voice Model */}
                <div className="space-y-0.5 min-w-0">
                  <div className={`font-semibold text-xs sm:text-sm truncate flex items-center gap-1.5 ${
                    isSelected ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-zinc-100'
                  }`}>
                    <span>{lang.nativeName}</span>
                    <span className={`text-[10px] font-mono font-normal ${
                      isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'
                    }`}>
                      ({lang.code})
                    </span>
                  </div>
                  <div className={`text-[10px] font-mono truncate ${
                    isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                  }`}>
                    {lang.voice}
                  </div>
                </div>

                {/* Bottom Row: Accent Description & Active Status */}
                <div className={`flex items-center justify-between text-[11px] pt-2 mt-2 border-t ${
                  isSelected ? 'border-white/15 dark:border-zinc-900/15' : 'border-zinc-100 dark:border-zinc-800'
                }`}>
                  <span className={`truncate text-[10px] sm:text-xs ${
                    isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'
                  }`}>
                    {lang.description}
                  </span>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-emerald-400 dark:text-emerald-600 font-mono text-[10px] font-semibold flex-shrink-0 ml-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-600 animate-pulse" />
                      Activo
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {variant === 'pills' && (
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-x-auto scrollbar-thin">
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
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
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
