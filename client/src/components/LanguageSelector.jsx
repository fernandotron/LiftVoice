import React from 'react';
import { Volume2, Check, Radio, Sparkles, User } from 'lucide-react';
import CountryFlag from './shared/CountryFlag.jsx';

export const SUPPORTED_LANGUAGES = [
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    voice: 'Voz en directo',
    description: 'Audio y transcripción en español',
    accentColor: '#ffffff'
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    voice: 'Direct Voice',
    description: 'Real-time audio & captions',
    accentColor: '#ffffff'
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    voice: 'Voce in diretta',
    description: 'Audio e sottotitoli in tempo reale',
    accentColor: '#ffffff'
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    voice: 'Voz em direto',
    description: 'Áudio e legendas em tempo real',
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
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            const listenerCount = languageBreakdown[lang.code] || 0;

            return (
              <button
                key={lang.code}
                type="button"
                disabled={disabled}
                onClick={() => onSelectLanguage(lang.code)}
                className={`relative group p-4 sm:p-4.5 rounded-2xl text-left transition-all duration-150 cursor-pointer overflow-hidden border ${
                  isSelected
                    ? 'bg-zinc-100/90 dark:bg-zinc-800/90 border-zinc-400/80 dark:border-zinc-600 ring-1 ring-zinc-400/40 dark:ring-zinc-600/40 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'bg-white dark:bg-zinc-900/70 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
              >
                {/* Top Row: Flag & Selection / Listener Count */}
                <div className="flex items-center justify-between mb-2.5">
                  <CountryFlag code={lang.code} className="w-7 h-7" title={lang.nativeName} />

                  {isSelected ? (
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  ) : listenerCount > 0 ? (
                    <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 font-mono">
                      {listenerCount} {listenerCount === 1 ? 'oyente' : 'oyentes'}
                    </span>
                  ) : null}
                </div>

                {/* Second Row: Language Name */}
                <div className="space-y-0.5 min-w-0">
                  <div className="font-semibold text-sm sm:text-base truncate flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                    <span>{lang.nativeName}</span>
                    <span className="text-xs font-mono font-normal text-zinc-400 dark:text-zinc-500">
                      ({lang.code})
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Accent Description & Active Status */}
                <div className={`flex items-center justify-between text-xs pt-2.5 mt-2.5 border-t ${
                  isSelected ? 'border-zinc-300 dark:border-zinc-700' : 'border-zinc-100 dark:border-zinc-800'
                }`}>
                  <span className="truncate text-xs text-zinc-400 dark:text-zinc-500">
                    {lang.description}
                  </span>
                  {isSelected && (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-semibold flex-shrink-0 ml-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Sintonizado
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
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                }`}
              >
                <CountryFlag code={lang.code} className="w-4 h-4" title={lang.nativeName} />
                <span>{lang.nativeName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
