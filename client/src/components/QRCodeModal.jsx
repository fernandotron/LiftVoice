import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode, Copy, Check, Download, Maximize2, Minimize2, X,
  Headphones, Globe, Wifi, Smartphone, Loader2, Radio,
  Sparkles, AlertCircle, ShieldAlert
} from 'lucide-react';
import CountryFlag from './shared/CountryFlag.jsx';
import Banner from './shared/Banner.jsx';

export default function QRCodeModal({
  roomId = 'MAIN',
  roomTitle = 'Keynote 2026',
  isOpen = false,
  onClose = () => {},
  localIp = '192.168.1.12'
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [networkMode, setNetworkMode] = useState('local'); // 'local' | 'public' | 'custom'
  const [publicUrl, setPublicUrl] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [isGeneratingTunnel, setIsGeneratingTunnel] = useState(false);
  const [tunnelError, setTunnelError] = useState(null);
  const [detectedLocalIp, setDetectedLocalIp] = useState(localIp || '192.168.1.12');
  const [customIp, setCustomIp] = useState('');
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [availableIps, setAvailableIps] = useState([]);
  const modalContainerRef = useRef(null);

  // Auto-detect local network IP and public tunnel info
  useEffect(() => {
    fetch('/api/network-info')
      .then(res => res.json())
      .then(data => {
        if (data.localIp) setDetectedLocalIp(data.localIp);
        if (data.publicUrl) setPublicUrl(data.publicUrl);
        if (Array.isArray(data.interfaces)) setAvailableIps(data.interfaces);
      })
      .catch(() => {});
  }, []);

  // Sync state with native browser Fullscreen API
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcut: Escape to exit fullscreen or close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else if (isFullScreen) {
          setIsFullScreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  if (!isOpen) return null;

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const el = modalContainerRef.current || document.documentElement;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        }
        setIsFullScreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        setIsFullScreen(false);
      }
    } catch (err) {
      console.warn('Native fullscreen request fallback:', err);
      setIsFullScreen((prev) => !prev);
    }
  };

  const handleClose = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    onClose();
  };

  const isLoopback = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const effectiveIp = customIp.trim() || detectedLocalIp || localIp || '192.168.1.12';

  // Build active attendee URL based on selected network mode
  let activeBaseUrl = '';
  if (!isLoopback) {
    // In cloud (Railway, production domain, etc.) the current origin IS universal
    activeBaseUrl = window.location.origin;
  } else if (networkMode === 'public' && publicUrl) {
    activeBaseUrl = publicUrl;
  } else if (networkMode === 'custom' && customDomain.trim()) {
    activeBaseUrl = customDomain.trim().startsWith('http') ? customDomain.trim() : `https://${customDomain.trim()}`;
  } else {
    const host = effectiveIp;
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    activeBaseUrl = `${protocol}//${host}${port}`;
  }

  const listenUrl = `${activeBaseUrl}/join?room=${encodeURIComponent(roomId)}`;

  const handleStartTunnel = async () => {
    setIsGeneratingTunnel(true);
    setTunnelError(null);
    try {
      const token = localStorage.getItem('liftvoice_admin_token') || '';
      const res = await fetch('/api/tunnel/start', { 
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.publicUrl) {
        setPublicUrl(data.publicUrl);
        setNetworkMode('public');
      } else {
        setTunnelError(data.error || 'No se pudo generar el túnel público 4G/5G. Utiliza la conexión Wi-Fi local.');
        setNetworkMode('local');
      }
    } catch (err) {
      console.warn('Could not start public tunnel:', err);
      setTunnelError('Error al contactar con el túnel público. Utiliza la Red Wi-Fi local de la sala.');
      setNetworkMode('local');
    } finally {
      setIsGeneratingTunnel(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(listenUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedRoomCode(true);
    setTimeout(() => setCopiedRoomCode(false), 2000);
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('liftvoice-room-qr');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 60;
      canvas.height = img.height + 60;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 30, 30);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `LiftVoice_QR_${roomId}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (isFullScreen) {
    return (
      <div
        ref={modalContainerRef}
        className="fixed inset-0 z-[1000] w-screen h-screen min-h-screen bg-zinc-950 text-white flex flex-col justify-between p-6 sm:p-10 lg:p-12 select-none overflow-y-auto animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-label="Modo Auditorio - Acceso a la Sala"
      >
        {/* Barra Superior Discreta de Control */}
        <header className="flex items-center justify-between w-full max-w-7xl mx-auto shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-6 bg-white rounded-full" />
              <div className="w-1.5 h-4 bg-white/70 rounded-full" />
            </div>
            <span className="font-semibold text-lg sm:text-xl tracking-tight text-white">
              LiftVoice
            </span>
            <span className="text-zinc-700 hidden sm:inline">•</span>
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-xs font-mono font-medium text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sintonización en vivo abierta</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleFullScreen}
              className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-zinc-200 hover:text-white text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors shadow-2xs active:scale-95"
              title="Salir de pantalla completa (Esc)"
            >
              <Minimize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Salir de pantalla completa</span>
              <span className="sm:hidden">Salir</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-zinc-200 hover:text-white flex items-center justify-center cursor-pointer transition-colors shadow-2xs active:scale-95"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Contenido Principal de Proyección: Centrado, Alto Impacto, Legible a 20 metros */}
        <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-16 max-w-7xl mx-auto w-full my-auto py-6 sm:py-10">
          {/* Columna Izquierda: Código QR Gigante y Código de Sala */}
          <div className="flex flex-col items-center justify-center text-center space-y-5 shrink-0">
            <div className="p-6 sm:p-8 bg-white rounded-[32px] sm:rounded-[40px] shadow-[0_20px_80px_rgba(0,0,0,0.8)] ring-4 ring-white/10 flex items-center justify-center">
              <QRCodeSVG
                id="liftvoice-room-qr"
                value={listenUrl}
                size={340}
                level="H"
                includeMargin={false}
                fgColor="#09090b"
                bgColor="#ffffff"
              />
            </div>

            {/* Código de Sala Destacado */}
            <div className="flex items-center justify-center gap-3 px-6 py-2.5 rounded-2xl bg-white/5 border border-white/10 w-full max-w-xs shadow-inner">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Sala:
              </span>
              <span className="font-mono text-xl sm:text-2xl font-bold text-white tracking-widest">
                {roomId}
              </span>
            </div>

            <p className="font-mono text-xs sm:text-sm text-zinc-400 max-w-sm truncate select-all">
              {listenUrl}
            </p>
          </div>

          {/* Columna Derecha: Título de Conferencia y Pasos para la Audiencia */}
          <div className="flex flex-col justify-center space-y-6 sm:space-y-8 text-left max-w-xl">
            <div>
              <div className="sm:hidden inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-xs font-mono font-medium text-emerald-400 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Audio en vivo abierto</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
                {roomTitle || 'Traducción Simultánea de Voz'}
              </h1>
              <p className="text-base sm:text-lg text-zinc-400 mt-3 leading-relaxed">
                Escucha la conferencia traducida en tiempo real directamente desde tu teléfono móvil.
              </p>
            </div>

            {/* 3 Pasos Grandes y Visibles */}
            <div className="space-y-3.5">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-white text-zinc-950 font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                  1
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Escanea el código QR con tu móvil
                  </h3>
                  <p className="text-sm text-zinc-400 mt-0.5 leading-relaxed">
                    Abre la cámara de tu smartphone. Conexión instantánea sin descargas ni registros.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-white text-zinc-950 font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                  2
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Conecta tus auriculares
                  </h3>
                  <p className="text-sm text-zinc-400 mt-0.5 leading-relaxed">
                    Usa auriculares Bluetooth o con cable para una escucha nítida sin interferir con la sala.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-white text-zinc-950 font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                  3
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-white">
                    Elige tu cabina de idioma
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-medium text-zinc-200">
                      <CountryFlag code="en" className="w-4 h-4 rounded-full shrink-0" />
                      <span>English</span>
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-medium text-zinc-200">
                      <CountryFlag code="es" className="w-4 h-4 rounded-full shrink-0" />
                      <span>Español</span>
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-medium text-zinc-200">
                      <CountryFlag code="it" className="w-4 h-4 rounded-full shrink-0" />
                      <span>Italiano</span>
                    </span>
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-medium text-zinc-200">
                      <CountryFlag code="pt" className="w-4 h-4 rounded-full shrink-0" />
                      <span>Português</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Pie Discreto de Proyección */}
        <footer className="flex items-center justify-between text-xs text-zinc-500 border-t border-white/10 pt-4 w-full max-w-7xl mx-auto shrink-0">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-zinc-400" />
            <span>Red Wi-Fi: {effectiveIp}:{typeof window !== 'undefined' && window.location.port ? window.location.port : '5174'}</span>
          </div>
          <span className="text-zinc-500 hidden sm:inline">Presiona Esc para salir del modo proyector</span>
        </footer>
      </div>
    );
  }

  return (
    <div 
      ref={modalContainerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/60 dark:bg-black/75 backdrop-blur-[4px] transition-all duration-200 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Modal Container con estética Studio 2026 */}
      <div 
        className="relative flex flex-col w-full max-w-3xl max-h-[92dvh] bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 rounded-[28px] sm:rounded-[32px] shadow-2xl transition-all duration-300 overflow-hidden select-none text-left animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Línea de acento degradada Studio en la parte superior */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500/20 dark:via-blue-400/20 to-transparent pointer-events-none" />

        {/* ── 1. CABECERA DEL MODAL ─────────────────────────────────── */}
        <header className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-zinc-200/80 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 shadow-2xs shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="qr-modal-title" className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                Acceso a la Sala • Audiencia
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                Escaneo instantáneo para sintonizar las cabinas de voz en directo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleFullScreen}
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Modo Auditorio / Proyector (Pantalla completa)"
              aria-label="Modo Auditorio"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Cerrar modal"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── 2. CUERPO UNIFICADO DE 2 COLUMNAS (GRID RESPONSIVE) ───── */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 items-center">

          {/* COLUMNA IZQUIERDA: Código QR, Código de Sala y Selector de Red */}
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            {/* Tarjeta contenedora del código QR en blanco puro con sombra Studio */}
            <div className="p-5 sm:p-6 bg-white rounded-3xl border border-zinc-200/80 shadow-md ring-1 ring-black/5 flex items-center justify-center">
              <QRCodeSVG
                id="liftvoice-room-qr"
                value={listenUrl}
                size={210}
                level="H"
                includeMargin={false}
                fgColor="#09090b"
                bgColor="#ffffff"
              />
            </div>

            {/* Píldora destacada del Código de Sala con copia en 1 clic */}
            <div className="flex items-center justify-between gap-3 px-4 py-2 bg-zinc-100/90 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl w-full max-w-[280px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-mono font-medium text-zinc-400 dark:text-zinc-500">
                  Sala:
                </span>
                <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-wider truncate">
                  {roomId}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyRoomCode}
                className="p-1.5 rounded-xl hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer flex-shrink-0"
                title="Copiar código de sala"
                aria-label="Copiar código de sala"
              >
                {copiedRoomCode ? <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Selector de Red Segmentado (Wi-Fi vs 4G en local, o Universal en Cloud) */}
            {isLoopback ? (
              <div className="w-full max-w-[280px] space-y-2">
                <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100/80 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      setNetworkMode('local');
                      setTunnelError(null);
                    }}
                    className={`h-9 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                      networkMode === 'local'
                        ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-2xs border border-zinc-200/60 dark:border-white/10'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-transparent'
                    }`}
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Red Wi-Fi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!publicUrl) handleStartTunnel();
                      else setNetworkMode('public');
                    }}
                    className={`h-9 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                      networkMode === 'public'
                        ? 'bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-2xs border border-zinc-200/60 dark:border-white/10'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-transparent'
                    }`}
                  >
                    {isGeneratingTunnel ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Smartphone className="w-3.5 h-3.5" />
                    )}
                    <span>Datos 4G/5G</span>
                  </button>
                </div>

                {/* Banner de aviso / error estilo Reness unificado */}
                {tunnelError && (
                  <Banner
                    icon={<ShieldAlert className="w-4 h-4 text-white" strokeWidth={2.2} />}
                    color="#f59e0b"
                    title={
                      tunnelError.toLowerCase().includes('unauthorized') || tunnelError.toLowerCase().includes('admin')
                        ? 'Acceso administrativo'
                        : 'Aviso de conexión'
                    }
                    desc={
                      tunnelError.toLowerCase().includes('unauthorized') || tunnelError.toLowerCase().includes('admin')
                        ? 'Se requiere acceso de administrador para activar el túnel 4G/5G. Utiliza la Red Wi-Fi local.'
                        : tunnelError
                    }
                    action={
                      <button
                        type="button"
                        onClick={() => setTunnelError(null)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        title="Cerrar aviso"
                        aria-label="Cerrar aviso"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    }
                    className="animate-fadeIn shadow-xs"
                    style={{ padding: '12px 14px', borderRadius: 20 }}
                  />
                )}
              </div>
            ) : (
              <div className="w-full max-w-[280px]">
                <Banner
                  icon={<Globe className="w-4 h-4 text-white" strokeWidth={2.2} />}
                  color="#10b981"
                  title="QR universal seguro"
                  desc="Válido para conexión Wi-Fi y datos móviles 4G/5G."
                  className="shadow-xs"
                  style={{ padding: '12px 14px', borderRadius: 20 }}
                />
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: Instrucciones para la audiencia y diagnóstico */}
          <div className="flex flex-col space-y-6 text-left">
            {/* Título de sala y badge de emisión */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Audio simultáneo en vivo</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-snug">
                {roomTitle || 'Traducción Simultánea de Voz'}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Escucha la conferencia en tu idioma con tus auriculares en tiempo real.
              </p>
            </div>

            {/* Los 3 Pasos Clave para Asistentes (Timeline Studio 2026) */}
            <div className="space-y-4">
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 transition-colors">
                <div className="w-7 h-7 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  1
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Escanea el código QR
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Abre la cámara de tu teléfono móvil (iOS o Android). No requiere descargar aplicaciones.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 transition-colors">
                <div className="w-7 h-7 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  2
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Conecta tus auriculares
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    AirPods, Bluetooth o cable. Puedes apagar la pantalla y la sintonía seguirá sonando.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 transition-colors">
                <div className="w-7 h-7 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  3
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Elige tu cabina de idioma
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200/60 dark:border-white/10 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 shadow-2xs">
                      <CountryFlag code="en" className="w-3.5 h-3.5 rounded-full shrink-0" />
                      <span>English</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200/60 dark:border-white/10 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 shadow-2xs">
                      <CountryFlag code="es" className="w-3.5 h-3.5 rounded-full shrink-0" />
                      <span>Español</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200/60 dark:border-white/10 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 shadow-2xs">
                      <CountryFlag code="it" className="w-3.5 h-3.5 rounded-full shrink-0" />
                      <span>Italiano</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200/60 dark:border-white/10 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 shadow-2xs">
                      <CountryFlag code="pt" className="w-3.5 h-3.5 rounded-full shrink-0" />
                      <span>Português</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnóstico de red & Selector de IPs alternativas */}
            <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-200">
                  <Wifi className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>Wi-Fi local: {effectiveIp}:{typeof window !== 'undefined' && window.location.port ? window.location.port : '5174'}</span>
                </div>
                {isLoopback && availableIps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIsEditingIp(!isEditingIp)}
                    className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer font-medium underline transition-colors"
                  >
                    {isEditingIp ? 'Cerrar' : 'Cambiar IP'}
                  </button>
                )}
              </div>

              {isEditingIp && (
                <div className="pt-2 space-y-2 animate-fadeIn border-t border-zinc-200 dark:border-white/10">
                  <div className="text-[11px] text-zinc-500">Selecciona el adaptador de red de tu Wi-Fi:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableIps.map((iface, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCustomIp(iface.address);
                          setIsEditingIp(false);
                        }}
                        className={`text-[10px] px-2.5 py-1 rounded-xl border font-mono transition-colors cursor-pointer ${
                          effectiveIp === iface.address
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white font-semibold shadow-2xs'
                            : 'bg-white dark:bg-white/5 border-zinc-200/80 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/15 hover:text-zinc-900 dark:hover:text-white dark:hover:border-white/20'
                        }`}
                      >
                        {iface.name}: {iface.address}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. PIE DE ACCIONES (ESTILO STUDIO 2026) ────────────────── */}
        <footer className="px-6 sm:px-8 py-4 bg-zinc-50/80 dark:bg-zinc-900/40 border-t border-zinc-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="w-full sm:w-auto flex-1 min-w-0 text-left">
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Vínculo directo de oyente
            </div>
            <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-full sm:max-w-md mt-0.5 select-all">
              {listenUrl}
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none h-10 px-4 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/80 dark:bg-white/5 hover:bg-zinc-200/80 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200 font-medium text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-all active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
                  <span>Enlace copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>Copiar enlace</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadQR}
              className="flex-1 sm:flex-none h-10 px-4 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/80 dark:bg-white/5 hover:bg-zinc-200/80 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200 font-medium text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-all active:scale-95"
              title="Descargar código QR"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Descargar código QR</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
