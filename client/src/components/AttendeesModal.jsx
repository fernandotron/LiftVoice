import React, { useState, useEffect } from 'react';
import { Users, Download, X, Search, Mail, Phone, Globe, UserX, RotateCcw } from 'lucide-react';

export default function AttendeesModal({
  roomId = 'MAIN',
  isOpen = false,
  onClose = () => {},
  attendees = [],
  onKickAttendee = () => {},
  onUnbanAttendee = () => {}
}) {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredAttendees = attendees.filter(a => {
    const term = searchTerm.toLowerCase();
    return (
      (a.name && a.name.toLowerCase().includes(term)) ||
      (a.email && a.email.toLowerCase().includes(term)) ||
      (a.phone && a.phone.includes(term)) ||
      (a.currentLang && a.currentLang.toLowerCase().includes(term)) ||
      (a.id && a.id.toLowerCase().includes(term)) ||
      (a.attendeeId && a.attendeeId.toLowerCase().includes(term))
    );
  });

  const handleDownloadCsv = () => {
    window.open(`/api/rooms/${roomId}/export-csv`, '_blank');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendees-dialog-title"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden rounded-[28px] sm:rounded-[32px] bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-2xl text-left text-zinc-900 dark:text-zinc-100">
        
        {/* Header matching AdminSettingsShell modal */}
        <header className="relative z-20 flex shrink-0 items-center justify-between gap-4 px-6 sm:px-8 py-5 border-b border-zinc-200/80 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0 shadow-2xs">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 id="attendees-dialog-title" className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                  Registro de Asistentes
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
                  {attendees.length}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 truncate">
                Participantes y oyentes registrados en la sala <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{roomId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={attendees.length === 0}
              className="h-9 px-3.5 sm:px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 font-medium text-xs sm:text-sm transition-colors cursor-pointer shrink-0 shadow-2xs flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Descargar reporte en formato CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden xs:inline">Exportar reporte</span>
              <span className="xs:hidden">CSV</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal de asistentes"
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="px-6 sm:px-8 py-5 flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
          
          {/* Search Filter */}
          <div className="relative w-full shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, correo, teléfono o idioma..."
              className="w-full h-11 pl-10 pr-4 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all shadow-2xs"
            />
          </div>

          {/* Table / List Container */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xs flex-1 flex flex-col min-h-0">
            {filteredAttendees.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-14 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center text-zinc-400 dark:text-zinc-500 shadow-2xs">
                  <Users className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {searchTerm ? 'No se encontraron asistentes' : 'No hay asistentes registrados aún'}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    {searchTerm
                      ? 'Prueba modificando los términos del buscador.'
                      : 'Los participantes aparecerán aquí automáticamente en tiempo real al unirse a la sala.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table (>= sm:) */}
                <div className="hidden sm:block flex-1 overflow-y-auto min-h-0">
                  <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
                    <thead className="sticky top-0 z-10 bg-zinc-50/90 dark:bg-zinc-800/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-white/10 text-zinc-500 dark:text-zinc-400 font-medium">
                      <tr>
                        <th className="px-5 py-3 font-medium">Asistente</th>
                        <th className="px-5 py-3 font-medium">Contacto</th>
                        <th className="px-5 py-3 font-medium">Canal</th>
                        <th className="px-5 py-3 font-medium">Hora</th>
                        <th className="px-5 py-3 font-medium">Estado</th>
                        <th className="px-5 py-3 font-medium text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/60 dark:divide-white/5">
                      {filteredAttendees.map((att, idx) => (
                        <tr key={att.id || att.attendeeId || idx} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
                                {att.name ? att.name.charAt(0).toUpperCase() : 'A'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-zinc-900 dark:text-zinc-100">{att.name || 'Anónimo'}</div>
                                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                                  ID: {(att.id || att.attendeeId || '—').slice(-6)}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono space-y-0.5">
                              {att.email ? (
                                <div className="flex items-center gap-1.5">
                                  <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                                  <span>{att.email}</span>
                                </div>
                              ) : null}
                              {att.phone ? (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
                                  <span>{att.phone}</span>
                                </div>
                              ) : null}
                              {!att.email && !att.phone && <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-xs font-mono text-zinc-700 dark:text-zinc-300 font-medium">
                              <Globe className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span className="uppercase">{att.currentLang || 'ES'}</span>
                            </span>
                          </td>

                          <td className="px-5 py-3.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                            {att.joinedAt ? new Date(att.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>

                          <td className="px-5 py-3.5">
                            {att.isKicked ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                                <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-red-500" />
                                Expulsado
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500" />
                                Activo
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-right">
                            {att.isKicked ? (
                              <button
                                type="button"
                                onClick={() => onUnbanAttendee(att.id || att.attendeeId)}
                                className="h-8 px-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/80 text-emerald-700 dark:text-emerald-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Readmitir asistente"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Readmitir</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onKickAttendee(att.id || att.attendeeId, att.name)}
                                className="h-8 px-3 rounded-xl border border-zinc-200/80 dark:border-white/10 hover:border-red-200 hover:bg-red-50 dark:hover:border-red-800/60 dark:hover:bg-red-950/40 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Expulsar asistente"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>Expulsar</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List (< sm:) */}
                <div className="sm:hidden flex-1 overflow-y-auto min-h-0 divide-y divide-zinc-200/60 dark:divide-white/5">
                  {filteredAttendees.map((att, idx) => (
                    <div key={att.id || att.attendeeId || idx} className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-300 shrink-0">
                            {att.name ? att.name.charAt(0).toUpperCase() : 'A'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">{att.name || 'Anónimo'}</div>
                            <div className="text-[10px] text-zinc-400 font-mono">ID: {(att.id || att.attendeeId || '—').slice(-6)}</div>
                          </div>
                        </div>
                        {att.isKicked ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 shrink-0">
                            Expulsado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400 shrink-0">
                            Activo
                          </span>
                        )}
                      </div>

                      {(att.email || att.phone) && (
                        <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 pl-10.5 space-y-1">
                          {att.email && (
                            <div className="truncate flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span>{att.email}</span>
                            </div>
                          )}
                          {att.phone && (
                            <div className="truncate flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span>{att.phone}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-white/5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 font-medium">
                          <Globe className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                          <span className="uppercase">{att.currentLang || 'ES'}</span>
                        </span>

                        {att.isKicked ? (
                          <button
                            type="button"
                            onClick={() => onUnbanAttendee(att.id || att.attendeeId)}
                            className="h-7 px-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Readmitir</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onKickAttendee(att.id || att.attendeeId, att.name)}
                            className="h-7 px-2.5 rounded-lg border border-zinc-200/80 dark:border-white/10 text-zinc-500 hover:text-red-600 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <UserX className="w-3 h-3" />
                            <span>Expulsar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer matching AdminSettingsShell modal */}
        <footer className="px-6 sm:px-8 py-4 bg-zinc-50/80 dark:bg-zinc-900/60 border-t border-zinc-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400 font-mono flex-shrink-0">
          <div className="flex items-center gap-2">
            <span>{filteredAttendees.length} de {attendees.length} asistentes registrados</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Sincronizado en tiempo real &bull; Exportable a .CSV</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
