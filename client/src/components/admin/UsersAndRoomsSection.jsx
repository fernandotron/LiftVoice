import React, { useState, useEffect } from 'react';
import { Users, Radio, Search, Shield, Play, Pause, Trash2, Download, AlertCircle, X, Circle, Headphones } from 'lucide-react';

export default function UsersAndRoomsSection() {
  const [activeSubTab, setActiveSubTab] = useState('users'); // 'users' or 'rooms'
  
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editingUser, setEditingUser] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('lv_admin_token') || localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error fetching users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('lv_admin_token') || localStorage.getItem('adminToken');
      const res = await fetch('/api/admin/rooms', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error fetching rooms');
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'users') fetchUsers();
    else fetchRooms();
  }, [activeSubTab]);

  const handleUpdateUser = async (id, role, status) => {
    try {
      const token = localStorage.getItem('lv_admin_token') || localStorage.getItem('adminToken');
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role, status })
      });
      if (!res.ok) throw new Error('Error updating user');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('¿Estás seguro de que deseas cerrar esta sala forzosamente? Todos los usuarios serán desconectados.')) return;
    try {
      const token = localStorage.getItem('lv_admin_token') || localStorage.getItem('adminToken');
      const res = await fetch(`/api/admin/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error deleting room');
      fetchRooms();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExportCSV = () => {
    const token = localStorage.getItem('lv_admin_token') || localStorage.getItem('adminToken');
    window.location.href = `/api/admin/export-csv?token=${token}`;
  };

  const filteredUsers = users.filter(u => 
    (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.id && u.id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h4 className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-tight">
            Gestión de Usuarios y Salas
          </h4>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-[65ch] leading-relaxed">
            Administra cuentas, asigna roles y monitorea salas activas en tiempo real.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-100/70 dark:bg-white/5 p-1 rounded-2xl w-fit border border-zinc-200/80 dark:border-white/10">
        <button
          type="button"
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'users'
              ? 'bg-white dark:bg-zinc-800 shadow-xs text-zinc-900 dark:text-zinc-100 font-semibold'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Usuarios y Participantes</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('rooms')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'rooms'
              ? 'bg-white dark:bg-zinc-800 shadow-xs text-zinc-900 dark:text-zinc-100 font-semibold'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4" />
            <span>Salas en Directo</span>
          </div>
        </button>
      </div>

      {loading && <div className="text-xs sm:text-sm text-zinc-500">Cargando datos...</div>}
      {error && <div className="text-xs sm:text-sm text-rose-500">Error: {error}</div>}

      {/* USERS TAB */}
      {activeSubTab === 'users' && !loading && !error && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Buscar por nombre, email o ID..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-4 text-xs sm:text-sm border border-zinc-200/80 dark:border-white/10 rounded-2xl bg-zinc-100/70 dark:bg-white/5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>
            <button 
              type="button"
              onClick={handleExportCSV} 
              className="h-11 flex items-center justify-center gap-2 px-5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 rounded-2xl overflow-hidden overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
              <thead className="bg-zinc-50/80 dark:bg-zinc-800/60 border-b border-zinc-200/80 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Usuario</th>
                  <th className="px-5 py-3.5 font-medium">ID / Última Sala</th>
                  <th className="px-5 py-3.5 font-medium">Rol</th>
                  <th className="px-5 py-3.5 font-medium">Estado</th>
                  <th className="px-5 py-3.5 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-white/5">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{u.name || 'Sin nombre'}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{u.email || u.phone || 'Sin contacto'}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-xs text-zinc-500 font-mono">{u.id}</div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-0.5">{u.lastRoom || '-'}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${u.role === 'admin_master' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : u.role === 'host' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                        {u.role === 'admin_master' ? <Shield className="w-3 h-3 mr-1" /> : null}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase border ${u.status === 'Activo' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'}`}>
                        <Circle className="w-1.5 h-1.5 mr-1.5 fill-current" />
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button 
                        type="button"
                        onClick={() => setEditingUser(u)} 
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2 cursor-pointer"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-5 py-10 text-center text-zinc-500">No se encontraron usuarios.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ROOMS TAB */}
      {activeSubTab === 'rooms' && !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map(room => (
            <div key={room.roomId} className="bg-zinc-50/50 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">{room.title}</h3>
                    <div className="text-xs font-mono text-zinc-500 mt-0.5">{room.roomId}</div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${room.isHostOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                    {room.isHostOnline ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                    {room.isHostOnline ? 'En Vivo' : 'Pausada'}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs sm:text-sm text-zinc-600 dark:text-zinc-300">
                  <div className="flex items-center gap-1.5">
                    <Headphones className="w-4 h-4 text-zinc-400" />
                    <span>{room.totalListeners} oyentes</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(room.languageBreakdown || {}).map(([lang, count]) => (
                    <span key={lang} className="text-[10px] font-mono uppercase bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 px-2 py-0.5 rounded-full text-zinc-600 dark:text-zinc-400">
                      {lang}: {count}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end pt-3.5 border-t border-zinc-200/80 dark:border-white/10">
                <button 
                  type="button"
                  onClick={() => handleDeleteRoom(room.roomId)} 
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> <span>Forzar Cierre</span>
                </button>
              </div>
            </div>
          ))}
          {rooms.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl">
              <Radio className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs sm:text-sm">No hay salas activas en este momento.</p>
            </div>
          )}
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[32px] max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-zinc-200/80 dark:border-white/10">
            <div className="p-6 border-b border-zinc-200/80 dark:border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100">Editar Perfil de Usuario</h3>
              <button 
                type="button"
                onClick={() => setEditingUser(null)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{editingUser.name || 'Sin nombre'}</div>
                <div className="text-xs text-zinc-500 font-mono">{editingUser.email || editingUser.id}</div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="role-select" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    Rol del Usuario
                  </label>
                  <select 
                    id="role-select"
                    defaultValue={editingUser.role} 
                    className="w-full h-11 px-4 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/40 focus:outline-none cursor-pointer"
                  >
                    <option value="listener">Oyente (Listener)</option>
                    <option value="host">Ponente Autorizado (Host)</option>
                    <option value="admin_master">Súper Administrador (Master)</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="status-select" className="block text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                    Estado de la Cuenta
                  </label>
                  <select 
                    id="status-select"
                    defaultValue={editingUser.status} 
                    className="w-full h-11 px-4 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/40 focus:outline-none cursor-pointer"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Suspendido">Bloqueado / Suspendido</option>
                  </select>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/30 flex gap-2.5 items-start mt-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed max-w-[65ch]">
                    Si suspendes a un usuario, será expulsado inmediatamente si está en una sala y no podrá volver a unirse.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 sm:p-5 bg-zinc-50/80 dark:bg-zinc-950 border-t border-zinc-200/80 dark:border-white/10 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setEditingUser(null)} 
                className="h-11 px-5 text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => handleUpdateUser(editingUser.id, document.getElementById('role-select').value, document.getElementById('status-select').value)} 
                className="h-11 px-6 text-xs sm:text-sm font-medium text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-2xl transition-colors shadow-sm cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
