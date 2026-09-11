import React, { useState } from 'react';
import { Users, Download, X, Search, Mail, Phone, Globe, Calendar, CheckCircle2 } from 'lucide-react';

export default function AttendeesModal({
  roomId = 'MAIN',
  isOpen = false,
  onClose = () => {},
  attendees = []
}) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredAttendees = attendees.filter(a => {
    const term = searchTerm.toLowerCase();
    return (
      (a.name && a.name.toLowerCase().includes(term)) ||
      (a.email && a.email.toLowerCase().includes(term)) ||
      (a.phone && a.phone.includes(term)) ||
      (a.currentLang && a.currentLang.toLowerCase().includes(term))
    );
  });

  const handleDownloadCsv = () => {
    window.open(`/api/rooms/${roomId}/export-csv`, '_blank');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-backdrop-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-3xl rounded-t-[28px] sm:rounded-2xl border-t sm:border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 overflow-hidden shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] text-zinc-900 dark:text-zinc-100 animate-sheet-up sm:animate-fadeIn transition-colors duration-150">
        
        {/* Pull Handle táctil móvil */}
        <div className="sm:hidden -mt-2 pb-2 flex justify-center">
          <div className="sheet-pull-handle my-0" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 sm:pb-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-800 dark:text-zinc-200 shadow-xs flex-shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-50 tracking-tight truncate">Registro de Asistentes</h3>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 font-semibold flex-shrink-0">
                  {attendees.length}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 truncate">Oyentes en sala {roomId}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={handleDownloadCsv}
              disabled={attendees.length === 0}
              className="h-8 sm:h-8.5 px-3 sm:px-4 rounded-full bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-[11px] sm:text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Exportar CSV</span>
              <span className="xs:hidden">CSV</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Cerrar modal de asistentes"
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search filter */}
        <div className="mb-3 sm:mb-4 relative flex-shrink-0">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, correo o idioma..."
            className="w-full h-10 bg-zinc-50/80 dark:bg-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-zinc-400 focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-400 transition-all shadow-xs"
          />
        </div>

        {/* Attendees List / Table */}
        <div className="flex-1 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/60 shadow-xs no-scrollbar sm:scroll-auto">
          {filteredAttendees.length === 0 ? (
            <div className="py-12 sm:py-16 text-center text-zinc-400 dark:text-zinc-500 space-y-2 p-4">
              <Users className="w-8 h-8 opacity-30 mx-auto" />
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No hay asistentes registrados aún.</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 max-w-sm mx-auto">
                Los datos aparecerán aquí automáticamente en cuanto los oyentes ingresen a la sala.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card List (< sm:) */}
              <div className="sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredAttendees.map((att, idx) => (
                  <div key={att.id || idx} className="p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {att.name ? att.name.charAt(0) : 'A'}
                        </div>
                        <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">{att.name || 'Anónimo'}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
                        <Globe className="w-2.5 h-2.5 text-zinc-500 dark:text-zinc-400" />
                        {att.currentLang || 'es'}
                      </span>
                    </div>
                    {(att.email || att.phone) && (
                      <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 pl-9 space-y-0.5">
                        {att.email && <div className="truncate flex items-center gap-1"><Mail className="w-3 h-3 text-zinc-400" /> {att.email}</div>}
                        {att.phone && <div className="truncate flex items-center gap-1"><Phone className="w-3 h-3 text-zinc-400" /> {att.phone}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= sm:) */}
              <table className="hidden sm:table w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-mono text-[10px]">
                    <th className="py-2.5 px-4">Asistente</th>
                    <th className="py-2.5 px-4">Correo</th>
                    <th className="py-2.5 px-4">Teléfono</th>
                    <th className="py-2.5 px-4">Canal</th>
                    <th className="py-2.5 px-4">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {filteredAttendees.map((att, idx) => (
                    <tr key={att.id || idx} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-800 dark:text-zinc-200 font-bold">
                          {att.name ? att.name.charAt(0) : 'A'}
                        </div>
                        <span>{att.name || 'Anónimo'}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                        {att.email || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                        {att.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 font-semibold">
                          <Globe className="w-2.5 h-2.5 text-zinc-500 dark:text-zinc-400" />
                          {att.currentLang || 'es'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400 dark:text-zinc-500 text-[10px]">
                        {att.joinedAt ? new Date(att.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-mono flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:pb-0">
          <span>{attendees.length} en base de datos</span>
          <span>Formato .CSV para Excel/CRM</span>
        </div>
      </div>
    </div>
  );
}
