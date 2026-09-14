import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Radio, Headphones, Trash2, Loader2, AlertCircle,
  Lock, Copy, Check, QrCode, ExternalLink, ArrowLeft, Search, X,
  Clock, ChevronRight, User
} from 'lucide-react';
import { adminAuthService } from '../../services/adminAuthService.js';
import SelectDropdown from '../shared/SelectDropdown.jsx';
import CountryFlag from '../shared/CountryFlag.jsx';
import QRCodeModal from '../QRCodeModal.jsx';
import { DegradadoPie } from './AdminStickyFooter.jsx';

const FILTER_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Estados' },
  { value: 'live', label: 'En directo' },
  { value: 'paused', label: 'En pausa' }
];

const CABINS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' }
];

const LANGUAGE_LABELS = {
  es: 'Español (es-ES)',
  en: 'English (en-US)',
  it: 'Italiano (it-IT)',
  pt: 'Português (pt-BR)',
  auto: 'Detección Automática'
};

export default function RoomsSection({
  variant = 'modal',
  footerSlot = null,
  selectedRoom: controlledSelectedRoom,
  onSelectRoom: controlledOnSelectRoom,
  roomSubSection = 'session',
  onRoomSubSectionChange
}) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  // Barra de búsqueda y filtro de estado
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  // Sala seleccionada para la vista detallada (soporta modo controlado o local)
  const [internalSelectedRoom, setInternalSelectedRoom] = useState(null);
  const selectedRoom = controlledSelectedRoom !== undefined ? controlledSelectedRoom : internalSelectedRoom;
  const setSelectedRoom = controlledOnSelectRoom || setInternalSelectedRoom;
  const selectedRoomRef = useRef(selectedRoom);
  selectedRoomRef.current = selectedRoom;
  const setSelectedRoomRef = useRef(setSelectedRoom);
  setSelectedRoomRef.current = setSelectedRoom;

  // Estados de interacción
  const [copiedId, setCopiedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [activeQrRoom, setActiveQrRoom] = useState(null);
  const [isClosingRoom, setIsClosingRoom] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Timer para uptime en vivo
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getAdminToken = () => adminAuthService.getToken();

  // Sincronización en tiempo real: silenciosa en segundo plano (isSilent = true) sin parpadeos
  const fetchRooms = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);
      setIsUnauthorized(false);

      const token = getAdminToken();
      const res = await fetch('/api/admin/rooms', {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });

      if (res.status === 401) {
        setIsUnauthorized(true);
        adminAuthService.clearToken();
        window.dispatchEvent(new CustomEvent('liftvoice_admin_unauthorized'));
        return;
      }

      if (!res.ok) throw new Error('Error al cargar la lista de salas activas');
      const data = await res.json();
      const roomsList = Array.isArray(data) ? data : [];
      setRooms(roomsList);

      // Si hay una sala abierta en detalle, actualizar sus métricas en vivo en su sitio sin alterar la sub-sección activa
      const currentSelected = selectedRoomRef.current;
      if (currentSelected) {
        const updated = roomsList.find(r => r.roomId === currentSelected.roomId);
        if (updated && setSelectedRoomRef.current) {
          setSelectedRoomRef.current(updated);
        }
      }
    } catch (err) {
      if (!isSilent) setError(err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const fetchRoomsRef = useRef(fetchRooms);
  fetchRoomsRef.current = fetchRooms;

  // Heartbeat autónomo de telemetría en tiempo real (cada 3.5s si la pestaña está activa)
  useEffect(() => {
    fetchRoomsRef.current(false);

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchRoomsRef.current(true);
      }
    }, 3500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRoomsRef.current(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleCopyLink = (roomId) => {
    const origin = window.location.origin;
    const url = `${origin}/join?room=${roomId}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedId(roomId);
        setTimeout(() => setCopiedId(null), 2000);
      }).catch(() => {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = url;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          setCopiedId(roomId);
          setTimeout(() => setCopiedId(null), 2000);
        } catch (e) {}
      });
    } else {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopiedId(roomId);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (e) {}
    }
  };

  const handleExecuteDelete = async (roomId) => {
    try {
      setIsClosingRoom(true);
      const token = getAdminToken();
      const res = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });

      if (res.status === 401) {
        setIsUnauthorized(true);
        adminAuthService.clearToken();
        window.dispatchEvent(new CustomEvent('liftvoice_admin_unauthorized'));
        return;
      }

      if (!res.ok) throw new Error('Error al cerrar la sala');
      setConfirmDeleteId(null);
      if (selectedRoom?.roomId === roomId) {
        setSelectedRoom(null);
      }
      fetchRooms(true);
    } catch (err) {
      alert(err.message || 'Error al cerrar la sala');
    } finally {
      setIsClosingRoom(false);
    }
  };

  const formatUptime = (createdAt) => {
    if (!createdAt) return 'En directo';
    const diffMs = Math.max(0, now - Number(createdAt));
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getLanguageLabel = (langCode) => {
    return LANGUAGE_LABELS[langCode] || langCode?.toUpperCase() || 'Español';
  };

  // Filtrado de salas
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = room.title && room.title.toLowerCase().includes(q);
        const matchId = room.roomId && room.roomId.toLowerCase().includes(q);
        const matchHost = room.hostName && room.hostName.toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchHost) return false;
      }

      if (filterStatus !== 'ALL') {
        const isLive = Boolean(room.isHostOnline);
        if (filterStatus === 'live' && !isLive) return false;
        if (filterStatus === 'paused' && isLive) return false;
      }

      return true;
    });
  }, [rooms, searchQuery, filterStatus]);

  // ══════════════════════════════════════════════════════════════════════════════
  // SESIÓN EXPIRADA
  // ══════════════════════════════════════════════════════════════════════════════
  if (isUnauthorized) {
    return (
      <div className="p-8 my-6 text-center rounded-[28px] bg-zinc-50/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 max-w-md mx-auto space-y-4 animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-2xs">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Sesión de Administrador Requerida
          </h4>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Tu sesión ha expirado. Inicia sesión con la contraseña maestra para supervisar las emisiones.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            adminAuthService.clearToken();
            window.dispatchEvent(new CustomEvent('liftvoice_admin_unauthorized'));
          }}
          className="h-11 px-5 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs sm:text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm cursor-pointer"
        >
          Iniciar Sesión de Administrador
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // VISTA DETALLADA DE LA SALA (AL HACER CLIC EN CUALQUIER SALA DE LA LISTA)
  // ══════════════════════════════════════════════════════════════════════════════
  if (selectedRoom) {
    const isLive = Boolean(selectedRoom.isHostOnline);
    const breakdown = selectedRoom.languageBreakdown || {};
    const origin = window.location.origin;
    const listenerUrl = `${origin}/join?room=${selectedRoom.roomId}`;

    const isPage = variant === 'page';

    const footerSystemStatus = (
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 truncate">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">LiftVoice Studio</span>
        <span className="text-zinc-300 dark:text-zinc-700 select-none hidden sm:inline">/</span>
        <span className="hidden sm:inline">
          {roomSubSection === 'cabins'
            ? `${selectedRoom.totalListeners || 0} oyentes activos`
            : isLive
            ? 'Emisión en directo'
            : 'Emisión en espera'}
        </span>
      </div>
    );

    const footerElement = (
      <footer
        className={`relative z-30 border-t border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md transition-colors duration-150 ${
          isPage
            ? 'sticky bottom-0 w-full py-3.5 sm:py-4 px-4 sm:px-6 lg:px-8 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.4)]'
            : 'flex-shrink-0 px-6 sm:px-8 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
        }`}
        data-testid="admin-room-sticky-footer"
      >
        <DegradadoPie />

        <div
          className={
            isPage
              ? 'w-full max-w-7xl mx-auto flex items-center justify-between gap-4'
              : 'w-full flex items-center justify-between gap-3'
          }
        >
          {/* Estado de la emisión */}
          {footerSystemStatus}
        </div>
      </footer>
    );

    return (
      <>
        <div className="flex flex-col min-h-full animate-fadeIn relative" data-testid="admin-detalle-sala">
        <div className="space-y-8 flex-1 pb-6">
          {/* En móvil: enlace para regresar a la lista de salas cuando el carril lateral está oculto */}
          <div className="md:hidden pb-1">
            <button
              type="button"
              onClick={() => setSelectedRoom(null)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a salas</span>
            </button>
          </div>

          {/* ── SUB-SECCIÓN 1: SESIÓN Y EMISIÓN ── */}
          {roomSubSection === 'session' && (
            <div className="space-y-8 animate-fadeIn" data-testid="admin-room-section-session">

              {/* Bloque 1: Parámetros y estado de la conferencia */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Anfitrión de la sala */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Anfitrión de la sala
                    </label>
                    <span className={`text-[11px] font-medium flex items-center gap-1.5 ${
                      selectedRoom.isHostOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'
                    }`}>
                      {selectedRoom.isHostOnline ? 'En directo' : 'Desconectado'}
                    </span>
                  </div>
                  <div className="w-full h-11 px-4 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm flex items-center gap-2.5">
                    <User className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span className="truncate font-medium">{selectedRoom.hostName || 'Ponente Principal'}</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                    {selectedRoom.isHostOnline
                      ? 'El ponente está conectado y emitiendo audio en directo.'
                      : 'Esperando que el orador inicie la emisión desde la interfaz de anfitrión.'}
                  </p>
                </div>

                {/* Idioma de origen del ponente */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Idioma de origen del ponente
                    </label>
                    <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                      Captura matriz
                    </span>
                  </div>
                  <div className="w-full h-11 px-4 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm flex items-center gap-2.5">
                    <CountryFlag code={selectedRoom.sourceLanguage || 'es'} className="w-5 h-5 shrink-0 shadow-2xs" />
                    <span className="truncate">{getLanguageLabel(selectedRoom.sourceLanguage || 'es')}</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                    Canal acústico principal que se transcribe y distribuye a las cabinas de traducción.
                  </p>
                </div>

                {/* Tiempo de emisión */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Tiempo de emisión
                    </label>
                    <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                      Uptime
                    </span>
                  </div>
                  <div className="w-full h-11 px-4 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm flex items-center gap-2.5 font-mono">
                    <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>{formatUptime(selectedRoom.createdAt)}</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                    {selectedRoom.createdAt
                      ? `Transmisión iniciada a las ${new Date(Number(selectedRoom.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
                      : 'Sesión activa en el servidor.'}
                  </p>
                </div>

                {/* Audiencia conectada */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Audiencia conectada
                    </label>
                    <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                      4 cabinas
                    </span>
                  </div>
                  <div className="w-full h-11 px-4 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm flex items-center gap-2.5">
                    <Headphones className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span className="font-semibold">{selectedRoom.totalListeners || 0}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">{selectedRoom.totalListeners === 1 ? 'oyente en directo' : 'oyentes en directo'}</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                    Desglose: ES ({breakdown.es || 0}) • EN ({breakdown.en || 0}) • IT ({breakdown.it || 0}) • PT ({breakdown.pt || 0}).
                  </p>
                </div>

                {/* Enlace de acceso directo para oyentes */}
                <div className="md:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    Enlace de acceso directo para oyentes
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={listenerUrl}
                      readOnly
                      className="flex-1 h-11 px-4 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm font-mono truncate focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(selectedRoom.roomId)}
                      className="h-11 px-4 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/70 dark:bg-white/5 hover:bg-zinc-200/60 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm font-medium transition-all active:scale-95 shadow-2xs flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      {copiedId === selectedRoom.roomId ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar enlace</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-[65ch]">
                    URL pública directa para que los oyentes sigan la interpretación simultánea desde sus dispositivos.
                  </p>
                </div>
              </div>

              {/* Separador estandarizado */}
              <hr className="border-t border-zinc-200/80 dark:border-white/10 my-8" />

              {/* Bloque 2: Control y accesos de la conferencia (Tarjetas nativas con estilo exacto) */}
              <div>
                <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
                  Control y accesos de la conferencia
                </h4>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
                  Herramientas para proyectar en el auditorio, comprobar la emisión como oyente y finalizar la sala.
                </p>

                <div className="space-y-3 mt-4">
                  {/* Proyección QR */}
                  <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-zinc-500" />
                        <span>Proyección de código QR</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[60ch] leading-relaxed">
                        Muestra el código QR en pantalla gigante para que los asistentes en el auditorio escaneen y se conecten instantáneamente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveQrRoom(selectedRoom)}
                      className="h-10 px-4 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/70 dark:bg-white/5 hover:bg-zinc-200/60 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Proyectar código QR</span>
                    </button>
                  </div>

                  {/* Acceso directo oyente */}
                  <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Headphones className="w-4 h-4 text-zinc-500" />
                        <span>Acceso directo como oyente</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[60ch] leading-relaxed">
                        Abre la vista de oyente en una pestaña nueva para comprobar el audio sintetizado o las transcripciones en vivo.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.open(listenerUrl, '_blank', 'noopener,noreferrer')}
                      className="h-10 px-4 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer shrink-0 shadow-xs"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Entrar como oyente</span>
                    </button>
                  </div>

                  {/* Finalizar sala */}
                  <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-rose-500" />
                        <span>Finalizar y cerrar conferencia</span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[60ch] leading-relaxed">
                        Cierra la conferencia definitivamente, desconecta todos los sockets y libera los recursos del servidor.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(selectedRoom.roomId)}
                      className="h-10 px-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs sm:text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Finalizar sala</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── SUB-SECCIÓN 2: CABINAS DE TRADUCCIÓN ── */}
          {roomSubSection === 'cabins' && (
            <div className="space-y-6 sm:space-y-8 animate-fadeIn" data-testid="admin-room-section-cabins">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Canales idiomáticos activos
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Distribución de oyentes y balance lingüístico en tiempo real.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-semibold px-3.5 py-2 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 shrink-0 self-start sm:self-auto">
                  <Headphones className="w-4 h-4 text-zinc-400" />
                  <span>{selectedRoom.totalListeners || 0} oyentes activos en total</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                {CABINS.map((cab) => {
                  const count = breakdown[cab.code] || 0;
                  const hasListeners = count > 0;
                  return (
                    <div
                      key={cab.code}
                      className="p-5 sm:p-6 rounded-2xl bg-zinc-50/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex items-center justify-between gap-4 sm:gap-5 transition-all"
                    >
                      <div className="flex items-center gap-4 sm:gap-4.5 min-w-0">
                        <CountryFlag code={cab.code} className="w-6 h-6 shrink-0 rounded-full shadow-2xs" />
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {cab.label}
                          </div>
                          <div className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                            {hasListeners ? `${count} oyente${count === 1 ? '' : 's'} en directo` : 'Sin oyentes (en reposo)'}
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-full shrink-0 ${
                        hasListeners
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:border dark:border-emerald-800/40 dark:text-emerald-400'
                          : 'bg-zinc-200/60 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 sm:p-4.5 rounded-2xl bg-zinc-100/60 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-3">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 stroke-[2.5]" />
                <span>Las cabinas operan con arquitectura Lazy Cabins: se activan y traducen únicamente cuando hay oyentes escuchando.</span>
              </div>
            </div>
          )}


        </div>

        </div>

        {/* Modal QR proyectable */}
        <QRCodeModal
          isOpen={!!activeQrRoom}
          roomId={activeQrRoom?.roomId}
          roomTitle={activeQrRoom?.title}
          onClose={() => setActiveQrRoom(null)}
        />

        {/* Diálogo de Confirmación para Cerrar Sala */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[100020] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-6 shadow-2xl space-y-4 text-left">
              <h4 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                ¿Finalizar esta conferencia?
              </h4>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                La sala <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{confirmDeleteId}</span> será cerrada de inmediato y los participantes conectados serán desconectados.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={isClosingRoom}
                  className="h-10 px-4 rounded-2xl border border-zinc-200 dark:border-white/10 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteDelete(confirmDeleteId)}
                  disabled={isClosingRoom}
                  className="h-10 px-4 rounded-2xl bg-red-600 text-white hover:bg-red-700 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {isClosingRoom && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Finalizar sala</span>
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Footer montado vía Portal en el slot 3 de AdminSettingsShell para igualar tamaño y posición exactos a AdminStickyFooter */}
      {footerSlot ? createPortal(footerElement, footerSlot) : footerElement}
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PROPUESTA A: VISTA EXTERIOR DE SALAS EN LISTA DE TARJETAS HORIZONTALES
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 animate-fadeIn" data-testid="admin-salas-lista">
      {/* Barra de Controles — Misma altura estándar h-11 que Usuarios */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Buscador de salas */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar sala por título, código o anfitrión..."
            className="w-full h-11 pl-10 pr-9 text-xs sm:text-sm border border-zinc-200/80 dark:border-white/10 rounded-2xl bg-zinc-100/70 dark:bg-white/5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-white/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtro de Estado y Botón Actualizar */}
        <div className="flex items-center gap-2.5">
          <div className="w-36 sm:w-40">
            <SelectDropdown
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={FILTER_STATUS_OPTIONS}
              aria-label="Filtrar por estado"
              className="w-full"
            />
          </div>

          {(filterStatus !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setFilterStatus('ALL');
                setSearchQuery('');
              }}
              className="h-11 px-3 text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              title="Restablecer filtros"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center text-xs sm:text-sm text-zinc-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
          <span>Cargando salas activas...</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs sm:text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* ── LISTA DE SALAS (ESTILO USUARIOS: SIN FONDO FIJO, SIN BORDE FIJO, HOVER Y DIVIDE-Y) ── */}
      {!loading && !error && (
        <div className="w-full text-left text-sm font-medium space-y-1">
          {/* Micro-contador */}
          <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 font-normal px-1">
            <span>
              {filteredRooms.length === rooms.length
                ? `${rooms.length} ${rooms.length === 1 ? 'sala activa' : 'salas activas'}`
                : `Mostrando ${filteredRooms.length} de ${rooms.length} salas`}
            </span>
          </div>

          {/* Filas de salas separadas por divide-y (igual que Usuarios) */}
          <div className="divide-y divide-zinc-200/60 dark:divide-white/5">
            {filteredRooms.map((room) => {
              const isLive = Boolean(room.isHostOnline);
              const totalListeners = room.totalListeners || 0;
              const breakdown = room.languageBreakdown || {};

              return (
                <div
                  key={room.roomId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRoom(room)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedRoom(room);
                    }
                  }}
                  className="group py-3 sm:py-3.5 px-3 sm:px-4 rounded-2xl transition-colors hover:bg-zinc-100/70 dark:hover:bg-white/5 cursor-pointer flex flex-col gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-white/30"
                >
                  {/* Fila 1: Cabecera de la Sala */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar circular Radio neutro */}
                      <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
                        <Radio className="w-4.5 h-4.5" />
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {room.title || 'Sala de Conferencia'}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 font-mono">
                          <span>{room.roomId}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLink(room.roomId);
                            }}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
                            title="Copiar enlace de invitación"
                          >
                            {copiedId === room.roomId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Badges de Estado, Tiempo y Chevron a la derecha */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isLive
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:border dark:border-emerald-800/40 dark:text-emerald-400'
                          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                      }`}>
                        <span>{isLive ? 'En directo' : 'En pausa'}</span>
                      </span>

                      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-mono text-zinc-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatUptime(room.createdAt)}</span>
                      </span>

                      <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 group-hover:translate-x-0.5 transition-all ml-0.5" />
                    </div>
                  </div>

                  {/* Fila 2: Resumen de Telemetría alineado con el título */}
                  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs text-zinc-500 dark:text-zinc-400 sm:pl-[52px]">
                    {/* Ponente e Idioma de Origen */}
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {room.hostName || (isLive ? 'Ponente activo' : 'Sin anfitrión')}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700 select-none">/</span>
                      <div className="flex items-center gap-1.5">
                        <CountryFlag code={room.sourceLanguage || 'es'} className="w-4 h-4 rounded-full shrink-0 shadow-2xs" />
                        <span>{getLanguageLabel(room.sourceLanguage || 'es')}</span>
                      </div>
                    </div>

                    {/* Oyentes Totales y Micro-desglose de Cabinas */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                        <Headphones className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{totalListeners} {totalListeners === 1 ? 'oyente' : 'oyentes'}</span>
                      </div>

                      {/* Banderas de cabinas con conteo */}
                      <div className="flex items-center gap-1.5">
                        {CABINS.map((c) => {
                          const count = breakdown[c.code] || 0;
                          return (
                            <span
                              key={c.code}
                              className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono flex items-center gap-1 ${
                                count > 0
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40'
                                  : 'bg-zinc-100/70 dark:bg-white/5 text-zinc-400'
                              }`}
                              title={`${c.label}: ${count} oyentes`}
                            >
                              <CountryFlag code={c.code} className="w-3.5 h-3.5 rounded-full shrink-0" />
                              <span>{count}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredRooms.length === 0 && (
              <div className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No se encontraron salas con los filtros aplicados.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
