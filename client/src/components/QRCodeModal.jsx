import React, { useState, useEffect } from 'react';
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

  if (!isOpen) return null;

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

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-6 transition-all duration-200 ${
        isFullScreen 
          ? 'bg-zinc-950 p-0' 
          : 'bg-black/60 dark:bg-black/75 backdrop-blur-[4px]'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      onClick={(e) => {
        if (!isFullScreen && e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal Container con estética Studio 2026 */}
      <div 
        className={`relative flex flex-col w-full bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-2xl transition-all duration-300 overflow-hidden select-none text-left ${
          isFullScreen 
            ? 'w-screen h-screen max-w-none rounded-none p-6 sm:p-10 justify-between' 
            : 'max-w-3xl max-h-[92dvh] rounded-[28px] sm:rounded-[32px] animate-fadeIn'
        }`}
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
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title={isFullScreen ? "Salir de pantalla completa" : "Modo Auditorio / Proyector"}
              aria-label={isFullScreen ? "Salir de pantalla completa" : "Modo Auditorio"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Cerrar modal"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── 2. CUERPO UNIFICADO DE 2 COLUMNAS (GRID RESPONSIVE) ───── */}
        <div className={`flex-1 overflow-y-auto min-h-0 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 items-center ${
          isFullScreen ? 'max-w-5xl mx-auto w-full my-auto' : ''
        }`}>

          {/* COLUMNA IZQUIERDA: Código QR, Código de Sala y Selector de Red */}
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            {/* Tarjeta contenedora del código QR en blanco puro con sombra Studio */}
            <div className="p-5 sm:p-6 bg-white rounded-3xl border border-zinc-200/80 shadow-md ring-1 ring-black/5 flex items-center justify-center">
              <QRCodeSVG
                id="liftvoice-room-qr"
                value={listenUrl}
                size={isFullScreen ? 280 : 210}
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
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
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
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white font-semibold'
                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100'
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
