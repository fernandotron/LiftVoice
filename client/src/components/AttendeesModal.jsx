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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6 overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-neutral-900">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-800 shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-neutral-950 tracking-tight">Registro de Asistentes & Leads</h3>
                <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200 text-[10px] font-mono text-neutral-600 font-semibold">
                  {attendees.length} registrados
                </span>
              </div>
              <p className="text-[11px] text-neutral-500">Datos capturados de los oyentes conectados a la sala {roomId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              disabled={attendees.length === 0}
              className="h-8.5 px-4 rounded-full bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search filter */}
        <div className="mb-4 relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, correo electrónico, teléfono o idioma..."
            className="w-full h-10 bg-neutral-50/80 hover:bg-neutral-50 focus:bg-white border border-neutral-200 rounded-xl pl-10 pr-4 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 focus:ring-1 focus:ring-neutral-950 transition-all shadow-xs"
          />
        </div>

        {/* Attendees Table */}
        <div className="flex-1 overflow-y-auto border border-neutral-200 rounded-xl bg-white shadow-xs">
          {filteredAttendees.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 space-y-2">
              <Users className="w-8 h-8 opacity-30 mx-auto" />
              <p className="text-xs font-semibold text-neutral-700">No hay asistentes registrados aún.</p>
              <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                Los datos aparecerán aquí automáticamente en cuanto los oyentes escaneen el QR o ingresen a la sala.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/60 text-neutral-500 font-mono text-[10px] uppercase">
                  <th className="py-2.5 px-4">Asistente</th>
                  <th className="py-2.5 px-4">Correo</th>
                  <th className="py-2.5 px-4">Teléfono</th>
                  <th className="py-2.5 px-4">Canal</th>
                  <th className="py-2.5 px-4">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700">
                {filteredAttendees.map((att, idx) => (
                  <tr key={att.id || idx} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-neutral-950 flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center text-[10px] uppercase text-neutral-800 font-bold">
                        {att.name ? att.name.charAt(0) : 'A'}
                      </div>
                      <span>{att.name || 'Anónimo'}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600">
                      {att.email || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600">
                      {att.phone || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200 text-[10px] font-mono text-neutral-700 uppercase font-semibold">
                        <Globe className="w-2.5 h-2.5 text-neutral-600" />
                        {att.currentLang || 'ES'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-400 text-[10px]">
                      {att.joinedAt ? new Date(att.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-neutral-200 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
          <span>Total en base de datos: {attendees.length} asistentes</span>
          <span>Formato de descarga: .CSV compatible con Excel & CRM</span>
        </div>
      </div>
    </div>
  );
}
