import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Copy, Check, ExternalLink, Download, Maximize2, Minimize2, X, Headphones, Globe, Wifi, Smartphone, Sparkles, Loader2, Radio, Lock } from 'lucide-react';

export default function QRCodeModal({
  roomId = 'MAIN',
  roomTitle = 'Keynote 2026',
  isOpen = false,
  onClose = () => {},
  localIp = '192.168.1.12'
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [networkMode, setNetworkMode] = useState('local'); // 'local' | 'public' | 'custom'
  const [publicUrl, setPublicUrl] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [isGeneratingTunnel, setIsGeneratingTunnel] = useState(false);
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
    try {
      const res = await fetch('/api/tunnel/start', { method: 'POST' });
      const data = await res.json();
      if (data.publicUrl) {
        setPublicUrl(data.publicUrl);
        setNetworkMode('public');
      }
    } catch (err) {
      console.warn('Could not start public tunnel:', err);
    }
    setIsGeneratingTunnel(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(listenUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className={`fixed inset-0 z-50 flex ${
      isFullScreen 
        ? 'items-center justify-center p-0 bg-zinc-950' 
        : 'flex-col justify-end sm:justify-center sm:items-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-4 bg-black/40 backdrop-blur-[3px]'
    } transition-all duration-150`}>
      {/* Backdrop tap to dismiss on mobile */}
      {!isFullScreen && (
        <div 
          className="flex-1 sm:hidden cursor-pointer" 
          onClick={onClose} 
          aria-label="Cerrar ventana" 
        />
      )}
      <div className={`relative w-full transition-all duration-150 overflow-hidden shadow-2xl ${
        isFullScreen
          ? 'w-screen h-screen max-w-none rounded-none p-8 sm:p-12 flex flex-col justify-between bg-zinc-950 text-white'
          : 'sm:max-w-md rounded-[28px] p-5 sm:p-7 bg-white dark:bg-[#1f1f1f] border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-zinc-100 max-h-[88dvh] sm:max-h-[90dvh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-7 animate-sheet-up sm:zoom-in-95 duration-200'
      }`}>
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isFullScreen ? 'bg-zinc-900 border border-zinc-800 text-white' : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
            }`}>
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`font-semibold text-sm tracking-tight ${isFullScreen ? 'text-white' : 'text-zinc-900 dark:text-zinc-50'}`}>
                {isFullScreen ? 'Proyección de Sala en Auditorio' : 'Acceso de Asistentes'}
              </h3>
              <p className={`text-[11px] ${isFullScreen ? 'text-zinc-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                {isFullScreen ? 'Escaneo directo para audiencia en vivo' : 'Escaneo de sala y selección de canal de voz'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isFullScreen
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title={isFullScreen ? "Salir de pantalla completa" : "Modo Auditorio / Proyector"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isFullScreen
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Network Mode Switcher or Universal Cloud QR Badge */}
        {!isFullScreen && (
          isLoopback ? (
            <div className="my-3.5 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
              <button
                onClick={() => setNetworkMode('local')}
                className={`flex-1 py-1 px-2.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  networkMode === 'local'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Red Wi-Fi</span>
              </button>

              <button
                onClick={() => {
                  if (!publicUrl) handleStartTunnel();
                  else setNetworkMode('public');
                }}
                className={`flex-1 py-1 px-2.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  networkMode === 'public'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {isGeneratingTunnel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                )}
                <span>Datos 4G/5G</span>
              </button>
            </div>
          ) : (
            <div className="my-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-950">QR Universal para toda la sala</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-800 font-bold">
                    Wi-Fi + 4G/5G
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-tight">
                  Válido tanto para la Wi-Fi del auditorio como para datos móviles. Si la Wi-Fi falla o cambia a 4G/5G, la conexión se mantiene intacta.
                </p>
              </div>
            </div>
          )
        )}

        {/* Center QR Display */}
        {isFullScreen ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto items-center">
            <div className="lg:col-span-6 flex flex-col items-center justify-center text-center space-y-5">
              <div className="p-6 bg-white rounded-3xl shadow-2xl border-4 border-zinc-800">
                <QRCodeSVG
                  id="liftvoice-room-qr"
                  value={listenUrl}
                  size={300}
                  level="H"
                  includeMargin={false}
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>

              <div className="inline-flex items-center gap-3 px-5 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-xs font-mono text-zinc-400">Código de sala:</span>
                <span className="text-xl font-mono font-bold text-white tracking-widest">{roomId}</span>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6 text-left">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-medium mb-3">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  Audio neuronal en directo
                </span>
                <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                  {roomTitle || 'Traducción Simultánea de Voz'}
                </h1>
                <p className="text-sm text-zinc-400 mt-2">
                  Escucha la conferencia en tu idioma nativo con auriculares en tiempo real.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Escanea el código QR con tu móvil</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Abre la cámara de tu smartphone para acceder directamente a la sintonía.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Conecta tus auriculares</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      AirPods, Bluetooth o cable. Puedes bloquear la pantalla y el audio seguirá sonando.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Elige tu canal de idioma</h4>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2.5 py-1 rounded-md bg-zinc-800 text-xs text-white font-medium border border-zinc-700">
                        🇺🇸 English
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-zinc-800 text-xs text-white font-medium border border-zinc-700">
                        🇪🇸 Español
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-zinc-800 text-xs text-white font-medium border border-zinc-700">
                        🇮🇹 Italiano
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-zinc-800 text-xs text-white font-medium border border-zinc-700">
                        🇧🇷 Português
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center space-y-3.5 my-2">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700">
              <QRCodeSVG
                id="liftvoice-room-qr"
                value={listenUrl}
                size={180}
                level="H"
                includeMargin={false}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-xs text-zinc-700 dark:text-zinc-200">
                <span className="text-zinc-400 dark:text-zinc-500 font-semibold">SALA:</span>
                <span className="text-zinc-900 dark:text-zinc-100 text-sm tracking-widest font-bold">{roomId}</span>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
                <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                  <Headphones className="w-3 h-3" />
                  Usa auriculares
                </span>
                <span>&bull;</span>
                <span>🇺🇸 EN</span>
                <span>🇪🇸 ES</span>
                <span>🇮🇹 IT</span>
                <span>🇧🇷 PT</span>
              </div>
            </div>
          </div>
        )}

        {/* Network Connection Tip */}
        <div className={`mt-3 p-3 rounded-xl text-[11px] text-left space-y-2 ${
          isFullScreen ? 'bg-zinc-900 border border-zinc-800 text-zinc-400' : 'bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
        }`}>
          {!isLoopback ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Enlace Cloud Público Seguro (HTTPS)</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 font-semibold">
                  Universal
                </span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Este código QR es único y universal. La audiencia puede conectarse mediante la red Wi-Fi del evento o con sus propios datos móviles (4G/5G). Si un asistente se desconecta de la Wi-Fi o apaga y enciende la pantalla, la conexión se recupera al instante sin reiniciar la app.
              </p>
            </>
          ) : networkMode === 'local' ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Wi-Fi: {effectiveIp}:{typeof window !== 'undefined' && window.location.port ? window.location.port : '5174'}</span>
                </div>
                {availableIps.length > 1 && (
                  <button
                    onClick={() => setIsEditingIp(!isEditingIp)}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {isEditingIp ? 'Cerrar' : 'Cambiar IP'}
                  </button>
                )}
              </div>

              {isEditingIp && (
                <div className="pt-1 space-y-1.5 animate-fadeIn">
                  <input
                    type="text"
                    value={customIp || effectiveIp}
                    onChange={(e) => setCustomIp(e.target.value)}
                    placeholder="Ej: 192.168.1.12"
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-900 dark:text-zinc-100 font-mono"
                  />
                  {availableIps.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {availableIps.map((iface, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setCustomIp(iface.address);
                            setIsEditingIp(false);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded border cursor-pointer font-mono ${
                            (customIp || effectiveIp) === iface.address
                              ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white'
                              : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {iface.name}: {iface.address}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                El teléfono móvil debe estar conectado a la misma red Wi-Fi. Si navegas con datos móviles de tu operador (4G/5G), pulsa la pestaña <strong>Datos 4G/5G</strong> arriba.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Enlace Público Seguro HTTPS</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Accesible desde cualquier móvil con datos 4G/5G o cualquier red Wi-Fi sin necesidad de estar en la misma red local.
              </p>
            </>
          )}
        </div>

        {/* Footer Link & Actions */}
        <div className={`mt-4 pt-3 border-t flex flex-col sm:flex-row items-center gap-2.5 justify-between ${
          isFullScreen ? 'border-zinc-800' : 'border-zinc-200 dark:border-zinc-800'
        }`}>
          <div className="w-full sm:w-auto flex-1 truncate text-left">
            <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5">
              <span>Enlace Directo</span>
              {networkMode === 'public' && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 font-medium">
                  4G/5G público
                </span>
              )}
            </div>
            <div className={`text-xs font-mono truncate max-w-[280px] ${isFullScreen ? 'text-zinc-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
              {listenUrl}
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 sm:flex-none h-10 sm:h-9 px-4 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors flex items-center justify-center gap-1.5 active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Enlace</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadQR}
              className="flex-1 sm:flex-none h-10 sm:h-9 px-4 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors flex items-center justify-center gap-1.5 active:scale-95"
              title="Descargar imagen PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar PNG</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
