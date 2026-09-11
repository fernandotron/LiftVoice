import React from 'react';
import { Mic, Headphones, QrCode, Settings, Radio, Sparkles, Activity, Layers, AudioLines, Search, Bell, HelpCircle, FileText, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';

export default function Navbar({
  currentRole = null, // 'host' | 'listener' | null
  roomId = null,
  latency = 14,
  isConnected = true,
  onOpenQR = () => {},
  onOpenSettings = () => {},
  onNavigateHome = () => {}
}) {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const [hasCopied, setHasCopied] = React.useState(false);
  const handleCopyLink = () => {
    if (!roomId) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/?room=${roomId}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md pt-safe transition-colors duration-150">
      <div className="w-full max-w-full px-3.5 sm:px-6 flex items-center justify-between h-14">
        
        {/* Left: Brand Logo II LiftVoice */}
        <div className="flex items-center gap-2.5 sm:gap-6 min-w-0">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 sm:gap-2.5 text-left cursor-pointer group select-none min-w-0"
          >
            {/* Minimalist "II" Soundwave Bars Icon mimicking ElevenLabs logo */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="w-1.5 h-5 bg-zinc-900 dark:bg-zinc-100 rounded-full group-hover:bg-zinc-700 dark:group-hover:bg-zinc-300 transition-colors" />
              <div className="w-1.5 h-3.5 bg-zinc-900 dark:bg-zinc-100 rounded-full group-hover:bg-zinc-700 dark:group-hover:bg-zinc-300 transition-colors" />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="font-semibold text-base text-zinc-900 dark:text-zinc-50 tracking-tight">
                LiftVoice
              </span>
              <span className="text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-400 hidden sm:inline-block">
                Studio 2026
              </span>
            </div>
          </button>

          {/* Breadcrumb info with one-click Google Meet room copy */}
          {roomId && (
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 border-l border-zinc-200 dark:border-zinc-800 pl-6">
              <span>{currentRole === 'host' ? 'Estudio de Emisión' : 'Cabina de Oyente'}</span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <button
                onClick={handleCopyLink}
                title="Copiar vínculo de la reunión"
                className="font-mono font-medium text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 px-2.5 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <span>{roomId}</span>
                {hasCopied ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-medium">¡Copiado!</span>
                ) : (
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans font-normal">Copiar</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Center: Search Bar (Buscar en todo... ⌘K) */}
        <div className="hidden lg:flex items-center flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              readOnly
              placeholder="Buscar en todo..."
              className="w-full h-8 pl-8 pr-12 text-xs bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-800 rounded-xl placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-zinc-700 dark:text-zinc-200 cursor-pointer focus:outline-none transition-colors"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-400 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded shadow-2xs">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Subtle Help Links */}
          <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-2">
            <button
              onClick={onOpenSettings}
              className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            >
              Configuración
            </button>
            <a
              href="#docs"
              onClick={(e) => { e.preventDefault(); onOpenSettings(); }}
              className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Documentación
            </a>
          </div>

          {/* Connection Status Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span>{latency}ms</span>
          </div>

          {currentRole === 'host' && (
            <button
              onClick={onOpenQR}
              className="h-8.5 px-4.5 rounded-full bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium flex items-center gap-2 cursor-pointer shadow-2xs transition-all"
              title="Proyectar Código QR en Sala"
            >
              <QrCode className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <span className="hidden sm:inline">Proyectar QR</span>
            </button>
          )}

          {/* Quick Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer shadow-2xs"
            title={`Tema actual: ${theme === 'system' ? 'Sistema (' + resolvedTheme + ')' : theme}. Clic para alternar claro/oscuro.`}
            aria-label="Alternar tema claro y oscuro"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 hover:text-amber-300 transition-transform active:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-700 hover:text-zinc-900 transition-transform active:-rotate-12" />
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer shadow-2xs"
            title="Ajustes de API Keys & Motores"
            aria-label="Ajustes de configuración"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User Profile Avatar */}
          <div className="w-8 h-8 sm:w-7.5 sm:h-7.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-[11px] font-semibold flex items-center justify-center cursor-pointer select-none">
            LV
          </div>
        </div>

      </div>
    </header>
  );
}
