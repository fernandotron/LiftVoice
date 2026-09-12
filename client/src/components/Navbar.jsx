import React from 'react';
import { QrCode, Settings, Sun, Moon } from 'lucide-react';
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
    const url = `${origin}/join?room=${roomId}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md pt-safe transition-colors duration-150">
      <div className="w-full max-w-full px-4 sm:px-8 flex items-center justify-between h-15 sm:h-16">
        
        {/* Left: Brand Logo II LiftVoice */}
        <div className="flex items-center gap-2.5 sm:gap-6 min-w-0">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 sm:gap-2.5 text-left cursor-pointer group select-none min-w-0"
          >
            {/* Minimalist "II" Soundwave Bars Icon mimicking ElevenLabs logo */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="w-1 h-5 bg-zinc-900 dark:bg-zinc-100 rounded-full group-hover:bg-zinc-700 dark:group-hover:bg-zinc-300 transition-colors" />
              <div className="w-1 h-3.5 bg-zinc-900 dark:bg-zinc-100 rounded-full group-hover:bg-zinc-700 dark:group-hover:bg-zinc-300 transition-colors" />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="font-semibold text-base text-zinc-900 dark:text-zinc-50 tracking-tight">
                LiftVoice
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
                className="font-mono font-medium text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
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


        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Subtle Help Links - Only visible to host */}
          {currentRole === 'host' && (
            <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-2">
              <button
                onClick={onOpenSettings}
                className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              >
                Ajustes de Sala
              </button>
            </div>
          )}

          {/* Connection Status Pill - Only visible when inside a room */}
          {roomId && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span>{latency}ms</span>
            </div>
          )}

          {currentRole === 'host' && (
            <button
              onClick={onOpenQR}
              className="h-9 sm:h-10 px-4 rounded-full bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-2xs transition-all"
              title="Proyectar Código QR en Sala"
            >
              <QrCode className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <span className="hidden sm:inline">Proyectar QR</span>
            </button>
          )}

          {/* Quick Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer shadow-2xs"
            title={`Tema actual: ${theme === 'system' ? 'Sistema (' + resolvedTheme + ')' : theme}. Clic para alternar claro/oscuro.`}
            aria-label="Alternar tema claro y oscuro"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-transform active:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-transform active:-rotate-12" />
            )}
          </button>

          {/* Settings Button - Only visible to host */}
          {currentRole === 'host' && (
            <button
              onClick={onOpenSettings}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer shadow-2xs"
              title="Ajustes de Sala"
              aria-label="Ajustes de Sala"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
