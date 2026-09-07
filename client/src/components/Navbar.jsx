import React from 'react';
import { Mic, Headphones, QrCode, Settings, Radio, Sparkles, Activity, Layers, AudioLines, Search, Bell, HelpCircle, FileText } from 'lucide-react';

export default function Navbar({
  currentRole = null, // 'host' | 'listener' | null
  roomId = null,
  latency = 14,
  isConnected = true,
  onOpenQR = () => {},
  onOpenSettings = () => {},
  onNavigateHome = () => {}
}) {
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
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="w-full max-w-full px-3.5 sm:px-6 flex items-center justify-between h-14">
        
        {/* Left: Brand Logo II LiftVoice */}
        <div className="flex items-center gap-2.5 sm:gap-6 min-w-0">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 sm:gap-2.5 text-left cursor-pointer group select-none min-w-0"
          >
            {/* Minimalist "II" Soundwave Bars Icon mimicking ElevenLabs logo */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="w-1.5 h-5 bg-zinc-900 rounded-full group-hover:bg-zinc-700 transition-colors" />
              <div className="w-1.5 h-3.5 bg-zinc-900 rounded-full group-hover:bg-zinc-700 transition-colors" />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="font-semibold text-base text-zinc-900 tracking-tight">
                LiftVoice
              </span>
              <span className="text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 hidden sm:inline-block">
                Studio 2026
              </span>
            </div>
          </button>

          {/* Breadcrumb info with one-click Google Meet room copy */}
          {roomId && (
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500 border-l border-zinc-200 pl-6">
              <span>{currentRole === 'host' ? 'Estudio de Emisión' : 'Cabina de Oyente'}</span>
              <span className="text-zinc-300">•</span>
              <button
                onClick={handleCopyLink}
                title="Copiar vínculo de la reunión"
                className="font-mono font-medium text-xs text-zinc-800 bg-zinc-100 hover:bg-zinc-200/80 px-2.5 py-0.5 rounded-md border border-zinc-200 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <span>{roomId}</span>
                {hasCopied ? (
                  <span className="text-[10px] text-emerald-600 font-sans font-medium">¡Copiado!</span>
                ) : (
                  <span className="text-[10px] text-zinc-400 font-sans font-normal">Copiar</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Center: Search Bar (Buscar en todo... ⌘K) */}
        <div className="hidden lg:flex items-center flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              readOnly
              placeholder="Buscar en todo..."
              className="w-full h-8 pl-8 pr-12 text-xs bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-xl placeholder:text-zinc-400 text-zinc-700 cursor-pointer focus:outline-none transition-colors"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-white border border-zinc-200 rounded shadow-2xs">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Subtle Help Links */}
          <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-zinc-500 mr-2">
            <button
              onClick={onOpenSettings}
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Configuración
            </button>
            <a
              href="#docs"
              onClick={(e) => { e.preventDefault(); onOpenSettings(); }}
              className="hover:text-zinc-900 transition-colors"
            >
              Documentación
            </a>
          </div>

          {/* Connection Status Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-200 text-[11px] font-mono text-zinc-600">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span>{latency}ms</span>
          </div>

          {currentRole === 'host' && (
            <button
              onClick={onOpenQR}
              className="h-8.5 px-4.5 rounded-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 text-xs font-medium flex items-center gap-2 cursor-pointer shadow-2xs transition-all"
              title="Proyectar Código QR en Sala"
            >
              <QrCode className="w-3.5 h-3.5 text-zinc-600" />
              <span className="hidden sm:inline">Proyectar QR</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-xl hover:bg-zinc-100 border border-zinc-200 text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer shadow-2xs"
            title="Ajustes de API Keys & Motores"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User Profile Avatar */}
          <div className="w-7 h-7 rounded-full bg-zinc-900 text-white text-[11px] font-semibold flex items-center justify-center cursor-pointer select-none">
            LV
          </div>
        </div>

      </div>
    </header>
  );
}
