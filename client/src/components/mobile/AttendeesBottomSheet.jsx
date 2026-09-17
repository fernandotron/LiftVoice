import React, { useState, useEffect } from 'react';
import { X, Search, Users, Radio, Download, Shield } from 'lucide-react';
import CountryFlag from '../shared/CountryFlag.jsx';

/**
 * AttendeesBottomSheet — LiftVoice Studio 2026
 * Panel deslizable táctil exclusivo para Participantes en sala móvil:
 * - Réplica idéntica de la sección de sala de escritorio, pero adaptada ergonómicamente a móvil
 * - Resumen técnico en directo (oyentes, canal ponente, latencia)
 * - Telemetría de administración (STT, LLM, latencias de pipeline)
 * - Fila destacada del Anfitrión con estado en vivo
 * - Lista táctil de oyentes en tiempo real con banderas de país y botón de expulsión
 * - Buscador rápido de asistentes
 * - Enlace directo para descarga de reporte CSV
 */
export default function AttendeesBottomSheet({
  isOpen = false,
  onClose = () => {},
  roomId = '',
  roomStats = {},
  effectiveTotalListeners = 0,
  sourceLanguage = 'es',
  socketLatency = 0,
  isBroadcasting = false,
  isAdminVerified = false,
  activeSttInfo = null,
  activeTelemetry = null,
  onKickAttendee = () => {}
}) {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rawParticipants = roomStats.attendees || [];
  const filteredParticipants = rawParticipants.filter(p => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.lang && p.lang.toLowerCase().includes(term)) ||
      (p.id && p.id.toLowerCase().includes(term))
    );
  });

  const handleDownloadCsv = () => {
    window.open(`/api/rooms/${roomId}/export-csv`, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-[3px] animate-backdrop-in sm:items-center sm:justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendees-sheet-title"
    >
      {/* Backdrop Tap to Close */}
      <div
        className="flex-1 w-full cursor-pointer"
        onClick={onClose}
        aria-label="Cerrar panel de participantes"
      />

      {/* Sheet Container */}
      <div className="relative w-full sm:max-w-md rounded-[28px] bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl overflow-hidden animate-sheet-up flex flex-col max-h-[88dvh]">
        {/* Header Ergonómico */}
        <div className="px-5 pt-4 pb-2.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div>
              <h3 id="attendees-sheet-title" className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                Participantes en Sala
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                Sala <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{roomId}</span> · Oyentes y anfitrión
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de participantes"
            className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95 touch-manipulation flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido Scrolleable */}
        <div className="p-5 space-y-4 overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] no-scrollbar">
          
          {/* Resumen Técnico de Sala */}
          <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/60 space-y-2 text-xs shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Total Oyentes en Directo:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {effectiveTotalListeners}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Canal de Ponente:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 uppercase">
                {sourceLanguage === 'auto' ? 'AUTO' : sourceLanguage.slice(0, 2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Latencia de Red:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {socketLatency}ms
              </span>
            </div>
          </div>

          {/* Telemetría Admin (si está autenticado como administrador) */}
          {isAdminVerified && (
            <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/60 space-y-2 text-xs shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Motor STT Activo:</span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                  {activeSttInfo?.label || 'Deepgram Nova-3'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Modelo STT:</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {activeSttInfo?.model || 'nova-3'}
                </span>
              </div>
              {activeTelemetry && (
                <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px] pt-0.5">
                  <div className="p-1.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/50">
                    <div className="text-[9px] text-zinc-400">STT</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-200">{activeTelemetry.sttMs || 0}ms</div>
                  </div>
                  <div className="p-1.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/50">
                    <div className="text-[9px] text-zinc-400">LLM</div>
                    <div className="font-bold text-zinc-800 dark:text-zinc-200">{activeTelemetry.transMs || 0}ms</div>
                  </div>
                  <div className="p-1.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/50">
                    <div className="text-[9px] text-zinc-400">Total</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">{activeTelemetry.totalLatencyMs || 0}ms</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Buscador de Participantes */}
          {rawParticipants.length > 1 && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre o idioma..."
                className="w-full h-10 pl-10 pr-3.5 rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 dark:focus:ring-zinc-600/30 transition-all touch-manipulation"
              />
            </div>
          )}

          {/* Lista de Usuarios */}
          <div className="space-y-2">
            {/* Fila Pinned del Ponente / Anfitrión */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/70 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center text-xs font-bold border border-zinc-300/60 dark:border-zinc-700/60">
                    P
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    Tú (Anfitrión)
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                    Emisión principal
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-zinc-200/70 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-300/60 dark:border-zinc-700/60 flex items-center gap-1.5 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${isBroadcasting ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span>{isBroadcasting ? 'En Directo' : 'En Sala'}</span>
              </span>
            </div>

            {/* Oyentes Conectados */}
            {rawParticipants.length === 0 ? (
              <div className="py-6 px-4 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-1">
                <Users className="w-5 h-5 text-zinc-400 dark:text-zinc-500 mx-auto" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                  Esperando a que entren oyentes a la sala
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Comparte el código o QR para que la audiencia se conecte.
                </p>
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                No hay participantes que coincidan con &ldquo;{searchTerm}&rdquo;
              </div>
            ) : (
              filteredParticipants.map((att) => {
                const initials = (att.name || 'OY')
                  .split(' ')
                  .map(w => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'OY';

                return (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 shadow-2xs transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-xs font-bold shrink-0 border border-zinc-300/60 dark:border-zinc-700/60">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                          {att.name || 'Oyente'}
                        </span>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium block">
                          {att.isOnline === false ? 'Desconectado' : 'Oyente conectado'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 shadow-2xs">
                        <CountryFlag code={att.lang || 'es'} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                        <span className="text-[10px] font-mono font-medium text-zinc-600 dark:text-zinc-400 uppercase">
                          {att.lang || 'es'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onKickAttendee(att.id, att.name)}
                        className="px-3 py-1 min-h-[32px] text-[11px] text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full transition-colors cursor-pointer active:scale-95 touch-manipulation"
                      >
                        Expulsar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Enlace para Exportar Reporte CSV */}
          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-400 text-[11px]">
              Exportación de registros
            </span>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-xs font-medium cursor-pointer transition-colors active:scale-95 touch-manipulation shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar CSV</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
