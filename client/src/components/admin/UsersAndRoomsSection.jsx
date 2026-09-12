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
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-zinc-950 dark:text-zinc-100 tracking-tight flex items-center gap-2">
            Gestión de Usuarios y Salas
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Administra cuentas, asigna roles, y monitorea salas activas en tiempo real.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeSubTab === 'users' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Usuarios y Participantes</div>
        </button>
        <button
          onClick={() => setActiveSubTab('rooms')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeSubTab === 'rooms' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          <div className="flex items-center gap-2"><Radio className="w-4 h-4" /> Salas en Directo</div>
        </button>
      </div>

      {loading && <div className="text-sm text-zinc-500">Cargando datos...</div>}
      {error && <div className="text-sm text-red-500">Error: {error}</div>}

      {/* USERS TAB */}
      {activeSubTab === 'users' && !loading && !error && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Buscar por nombre, email o ID..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden overflow-x-auto shadow-sm">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">ID / Última Sala</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{u.name || 'Sin nombre'}</div>
                      <div className="text-xs text-zinc-500">{u.email || u.phone || 'Sin contacto'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-zinc-500 font-mono">{u.id}</div>
                      <div className="text-xs text-blue-500">{u.lastRoom || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${u.role === 'admin_master' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : u.role === 'host' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                        {u.role === 'admin_master' ? <Shield className="w-3 h-3 mr-1" /> : null}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${u.status === 'Activo' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'}`}>
                        <Circle className="w-2 h-2 mr-1 fill-current" />
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditingUser(u)} className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-zinc-500">No se encontraron usuarios.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ROOMS TAB */}
      {activeSubTab === 'rooms' && !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map(room => (
            <div key={room.roomId} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{room.title}</h3>
                    <div className="text-xs font-mono text-zinc-500">{room.roomId}</div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${room.isHostOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                    {room.isHostOnline ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                    {room.isHostOnline ? 'En Vivo' : 'Pausada'}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
                  <div className="flex items-center gap-1">
                    <Headphones className="w-4 h-4 text-zinc-400" />
                    <span>{room.totalListeners} oyentes</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {Object.entries(room.languageBreakdown || {}).map(([lang, count]) => (
                    <span key={lang} className="text-[10px] uppercase bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400">
                      {lang}: {count}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button onClick={() => handleDeleteRoom(room.roomId)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors">
                  <Trash2 className="w-3 h-3" /> Forzar Cierre
                </button>
              </div>
            </div>
          ))}
          {rooms.length === 0 && (
            <div className="col-span-full py-12 text-center text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl">
              <Radio className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No hay salas activas en este momento.</p>
            </div>
          )}
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">Editar Perfil de Usuario</h3>
              <button onClick={() => setEditingUser(null)} className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-5">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{editingUser.name || 'Sin nombre'}</div>
                <div className="text-xs text-zinc-500">{editingUser.email || editingUser.id}</div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Rol del Usuario</label>
                  <select 
                    id="role-select"
                    defaultValue={editingUser.role} 
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="listener">Oyente (Listener)</option>
                    <option value="host">Ponente Autorizado (Host)</option>
                    <option value="admin_master">Súper Administrador (Master)</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Estado de la Cuenta</label>
                  <select 
                    id="status-select"
                    defaultValue={editingUser.status} 
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Suspendido">Bloqueado / Suspendido</option>
                  </select>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800/30 flex gap-2 items-start mt-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                    Si suspendes a un usuario, será expulsado inmediatamente si está en una sala y no podrá volver a unirse.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                Cancelar
              </button>
              <button 
                onClick={() => handleUpdateUser(editingUser.id, document.getElementById('role-select').value, document.getElementById('status-select').value)} 
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
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
