import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, Search, Shield, Download, ArrowLeft, Pencil, X, Check, Loader2, AlertCircle, Lock
} from 'lucide-react';
import { adminAuthService } from '../../services/adminAuthService.js';
import SelectDropdown from '../shared/SelectDropdown.jsx';
import { DegradadoPie } from './AdminStickyFooter.jsx';

const ROLE_OPTIONS = [
  { value: 'listener', label: 'Oyente', description: 'Participa en salas y escucha traducción en directo' },
  { value: 'host', label: 'Ponente autorizado', description: 'Puede iniciar emisiones de audio y conferencias' },
  { value: 'admin_master', label: 'Administrador master', description: 'Control total de configuración y gestión de salas' }
];

const FILTER_ROLE_OPTIONS = [
  { value: 'ALL', label: 'Roles' },
  { value: 'host', label: 'Ponente' },
  { value: 'listener', label: 'Oyente' },
  { value: 'admin_master', label: 'Admin Master' }
];

const FILTER_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Estados' },
  { value: 'Activo', label: 'Activo' },
  { value: 'Suspendido', label: 'Suspendido' }
];

export default function UsersSection({
  variant = 'modal',
  footerSlot = null
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  // Filters (single row matching media_1789313626551.png)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // In-modal user editing state
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('listener');
  const [editStatus, setEditStatus] = useState('Activo');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const getAdminToken = () => {
    return adminAuthService.getToken();
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsUnauthorized(false);
      const token = getAdminToken();
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });

      if (res.status === 401) {
        setIsUnauthorized(true);
        adminAuthService.clearToken();
        window.dispatchEvent(new CustomEvent('liftvoice_admin_unauthorized'));
        return;
      }

      if (!res.ok) throw new Error('Error al cargar la lista de usuarios');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenUserDetail = (u) => {
    setEditingUser(u);
    setEditName(u.name || '');
    setEditRole(u.role || 'listener');
    setEditStatus(u.status || 'Activo');
    setSaveSuccessMsg('');
  };

  const handleSaveUserDetail = async (e) => {
    if (e) e.preventDefault();
    if (!editingUser) return;

    try {
      setIsSavingUser(true);
      const token = getAdminToken();

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          role: editRole,
          status: editStatus,
          name: editName
        })
      });

      if (res.status === 401) {
        setIsUnauthorized(true);
        adminAuthService.clearToken();
        window.dispatchEvent(new CustomEvent('liftvoice_admin_unauthorized'));
        return;
      }

      if (!res.ok) throw new Error('Error al actualizar el usuario');

      setUsers(prev => prev.map(u => u.id === editingUser.id ? {
        ...u,
        name: editName,
        role: editRole,
        status: editStatus
      } : u));

      setSaveSuccessMsg('Usuario actualizado correctamente');
      setTimeout(() => {
        setEditingUser(null);
        setSaveSuccessMsg('');
      }, 500);
    } catch (err) {
      alert(err.message || 'Error al guardar los cambios');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleQuickToggleStatus = async (u, e) => {
    if (e) e.stopPropagation();
    const newStatus = u.status === 'Activo' ? 'Suspendido' : 'Activo';
    try {
      const token = getAdminToken();
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.status === 401) {
        setIsUnauthorized(true);
        adminAuthService.clearToken();
        window.dispatchEvent(new CustomEvent('liftvoice_admin_unauthorized'));
        return;
      }
      if (!res.ok) throw new Error('Error al cambiar el estado');
      setUsers(prev => prev.map(item => item.id === u.id ? { ...item, status: newStatus } : item));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExportCSV = async () => {
    const token = getAdminToken();
    try {
      const res = await fetch(`/api/admin/export-csv?token=${encodeURIComponent(token)}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (res.status === 401) {
        setIsUnauthorized(true);
        adminAuthService.clearToken();
        window.dispatchEvent(new CustomEvent('liftvoice_admin_unauthorized'));
        return;
      }
      if (!res.ok) throw new Error('Error al exportar CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LiftVoice_Usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(d);
    } catch (e) {
      return dateStr;
    }
  };

  const formatLastSeen = (dateStr) => {
    if (!dateStr) return 'Sin actividad';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 2) return 'En línea ahora';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(d);
    } catch (e) {
      return dateStr;
    }
  };

  const renderRoleBadge = (role) => {
    if (role === 'admin_master') {
      return (
        <span className="text-purple-600 dark:text-purple-400 font-semibold text-sm leading-tight flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          <span>Admin Master</span>
        </span>
      );
    }
    if (role === 'host') {
      return (
        <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm leading-tight">
          Ponente
        </span>
      );
    }
    return (
      <span className="text-zinc-900 dark:text-zinc-100 font-semibold text-sm leading-tight">
        Oyente
      </span>
    );
  };

  const renderAvatar = (u) => {
    if (u.avatarUrl) {
      return (
        <img
          src={u.avatarUrl}
          alt={u.name || 'Usuario'}
          className="w-10 h-10 rounded-full object-cover shrink-0 border border-black/10 dark:border-white/10"
        />
      );
    }
    
    const initial = (u.name || u.email || 'U').charAt(0).toUpperCase();
    const isMaster = u.role === 'admin_master';
    const isHost = u.role === 'host';

    let colorClass = 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700';
    if (isMaster) {
      colorClass = 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800/60';
    } else if (isHost) {
      colorClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
    }

    return (
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 border ${colorClass}`}>
        {initial}
      </div>
    );
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = u.name && u.name.toLowerCase().includes(q);
        const matchEmail = u.email && u.email.toLowerCase().includes(q);
        const matchId = u.id && u.id.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchId) return false;
      }

      // Filter role
      if (filterRole !== 'ALL') {
        const userRole = u.role || 'listener';
        if (userRole !== filterRole) return false;
      }

      // Filter status
      if (filterStatus !== 'ALL') {
        const userStatus = u.status || 'Activo';
        if (userStatus.toLowerCase() !== filterStatus.toLowerCase()) return false;
      }

      return true;
    });
  }, [users, searchQuery, filterRole, filterStatus]);

  // ══════════════════════════════════════════════════════════════════════════════
  // IN-MODAL EDIT VIEW (REPLACES TABLE IN THE SAME MODAL, LIKE standalone-assistant)
  // ══════════════════════════════════════════════════════════════════════════════
  if (editingUser) {
    const formattedRegDate = formatDate(editingUser.registeredAt || editingUser.createdAt);
    const formattedLastSeen = formatLastSeen(editingUser.lastSeen);
    const lastRoomLabel = editingUser.lastRoom ? `Sala ${editingUser.lastRoom}` : 'Sin sala vinculada';
    const isPage = variant === 'page';

    const footerElement = (
      <footer
        className={`relative z-30 border-t border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md transition-colors duration-150 ${
          isPage
            ? 'sticky bottom-0 w-full py-3.5 sm:py-4 px-4 sm:px-6 lg:px-8 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.4)]'
            : 'flex-shrink-0 px-6 sm:px-8 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
        }`}
        data-testid="admin-user-sticky-footer"
      >
        <DegradadoPie />
        <div
          className={
            isPage
              ? 'w-full max-w-7xl mx-auto flex items-center justify-between gap-4'
              : 'w-full flex items-center justify-between gap-3'
          }
        >
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 min-w-0">
            {saveSuccessMsg ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 truncate">
                <Check className="w-4 h-4 stroke-[2.5] shrink-0" />
                <span>{saveSuccessMsg}</span>
              </span>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">LiftVoice Studio</span>
                <span className="text-zinc-300 dark:text-zinc-700 select-none hidden sm:inline">•</span>
                <span className="hidden sm:inline">Edición de usuario</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/70 dark:bg-white/5 hover:bg-zinc-200/70 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-medium transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              Cancelar
            </button>

            <button
              type="submit"
              form="admin-user-edit-form"
              onClick={handleSaveUserDetail}
              disabled={isSavingUser}
              className="h-9 sm:h-10 px-5 sm:px-6 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 text-xs sm:text-sm font-medium transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
            >
              {isSavingUser && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Guardar cambios</span>
            </button>
          </div>
        </div>
      </footer>
    );

    return (
      <>
        <div className="flex flex-col h-full min-h-0 animate-fadeIn" data-testid="admin-detalle-usuario">
          {/* Navigation Bar to return to the list */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-200/80 dark:border-white/10">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              <span>Volver a usuarios</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
              <span className="hidden sm:inline">ID:</span>
              <span>{editingUser.id}</span>
            </div>
          </div>

          <form id="admin-user-edit-form" onSubmit={handleSaveUserDetail} className="space-y-8 flex-1">
            {/* Section 1: Información del Usuario */}
            <div className="space-y-4">
              <h4 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Información del usuario
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="usuario-nombre">
                    Nombre completo
                  </label>
                  <input
                    id="usuario-nombre"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nombre del usuario"
                    className="w-full h-11 px-4 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="usuario-email">
                    Correo electrónico
                  </label>
                  <input
                    id="usuario-email"
                    type="email"
                    value={editingUser.email || editingUser.phone || 'Sin correo registrado'}
                    disabled
                    className="w-full h-11 px-4 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-sm font-mono disabled:opacity-60 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="usuario-rol">
                    Rol de acceso
                  </label>
                  <SelectDropdown
                    id="usuario-rol"
                    value={editRole}
                    onChange={(val) => setEditRole(val)}
                    options={ROLE_OPTIONS}
                    aria-label="Seleccionar rol de usuario"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="usuario-sala">
                    Última sala vinculada
                  </label>
                  <input
                    id="usuario-sala"
                    type="text"
                    value={lastRoomLabel}
                    disabled
                    className="w-full h-11 px-4 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-sm font-mono disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Actividad y Conexión */}
            <div className="space-y-4 pt-2">
              <h4 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Actividad y conexión
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="usuario-lastseen">
                    Última actividad en salas
                  </label>
                  <input
                    id="usuario-lastseen"
                    type="text"
                    value={formattedLastSeen}
                    disabled
                    className="w-full h-11 px-4 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-sm disabled:opacity-60 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="usuario-registro">
                    Fecha de registro
                  </label>
                  <input
                    id="usuario-registro"
                    type="text"
                    value={formattedRegDate}
                    disabled
                    className="w-full h-11 px-4 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-zinc-100 text-sm disabled:opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Estado de la Cuenta con Switch Animado */}
            <div className="space-y-4 pt-2">
              <h4 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Estado de la cuenta
              </h4>

              <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {editStatus === 'Activo' ? 'Cuenta activa' : 'Cuenta suspendida'}
                  </label>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[60ch] leading-relaxed">
                    {editStatus === 'Activo'
                      ? 'El usuario tiene acceso normal a las salas y servicios de interpretación simultánea.'
                      : 'El usuario será desconectado inmediatamente si está en una sala y no podrá ingresar a ninguna conferencia.'}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={editStatus === 'Activo'}
                  onClick={() => setEditStatus(prev => prev === 'Activo' ? 'Suspendido' : 'Activo')}
                  className={`relative shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                    editStatus === 'Activo' ? 'bg-blue-600 dark:bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      editStatus === 'Activo' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Footer montado vía Portal en el slot 3 de AdminSettingsShell */}
        {footerSlot ? createPortal(footerElement, footerSlot) : footerElement}
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // UNAUTHORIZED STATE (CLEAN RE-LOGIN PROMPT)
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
            Tu sesión ha expirado o se reinició el servidor. Inicia sesión con la contraseña maestra para acceder.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            adminAuthService.clearToken();
            window.dispatchEvent(new CustomEvent('liftvoice_admin_unauthorized'));
          }}
          className="h-10 px-5 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs sm:text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-sm cursor-pointer"
        >
          Iniciar Sesión de Administrador
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN LIST VIEW (EXACTLY MATCHING media_1789313626551.png - SINGLE CLEAN ROW)
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Controls Bar — Executive Single-Strip Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input — Altura original h-11 rounded-2xl */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, correo o ID..."
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

        {/* Filters & CSV Export Toolbar */}
        <div className="flex items-center gap-2.5">
          {/* Micro-filter Rol */}
          <div className="w-36 sm:w-40">
            <SelectDropdown
              value={filterRole}
              onChange={(val) => setFilterRole(val)}
              options={FILTER_ROLE_OPTIONS}
              aria-label="Filtrar por rol"
              className="w-full"
            />
          </div>

          {/* Micro-filter Estado */}
          <div className="w-36 sm:w-40">
            <SelectDropdown
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              options={FILTER_STATUS_OPTIONS}
              aria-label="Filtrar por estado"
              className="w-full"
            />
          </div>

          {/* Limpiar filtros si hay alguno activo */}
          {(filterRole !== 'ALL' || filterStatus !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setFilterRole('ALL');
                setFilterStatus('ALL');
                setSearchQuery('');
              }}
              className="h-11 px-3 text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              title="Restablecer todos los filtros"
            >
              Limpiar
            </button>
          )}

          {/* Botón Exportar CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-11 px-4 rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-zinc-100/70 dark:bg-white/5 hover:bg-zinc-200/60 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
            title="Descargar reporte en formato CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center text-xs sm:text-sm text-zinc-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
          <span>Cargando usuarios...</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs sm:text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* ── USERS TABLE ──────────────────────────────────────────────────────── */}
      {!loading && !error && (
        <div className="w-full text-left text-sm font-medium space-y-1">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 font-normal px-1">
            <span>
              {filteredUsers.length === users.length
                ? `${users.length} usuarios registrados`
                : `Mostrando ${filteredUsers.length} de ${users.length} usuarios`}
            </span>
          </div>

          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-[1fr_200px_170px_110px_48px] items-center h-[52px] border-b border-zinc-200/80 dark:border-white/5 text-xs text-zinc-400 font-normal">
            <div className="px-6">Usuario</div>
            <div className="px-6">Rol / Sala</div>
            <div className="px-6">Última conexión / Registro</div>
            <div className="px-6 text-center">Estado</div>
            <div className="text-right pr-4"><span className="sr-only">Acciones</span></div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-zinc-200/60 dark:divide-white/5">
            {filteredUsers.map((u) => {
              const role = u.role || 'listener';
              const lastRoomLabel = u.lastRoom ? `Sala: ${u.lastRoom}` : 'Sin sala asignada';

              return (
                <div
                  key={u.id}
                  onClick={() => handleOpenUserDetail(u)}
                  className="group py-2.5 sm:py-0 sm:h-16 rounded-2xl transition-colors hover:bg-zinc-100/70 dark:hover:bg-white/5 cursor-pointer flex flex-col sm:grid sm:grid-cols-[1fr_200px_170px_110px_48px] sm:items-center gap-3 sm:gap-0"
                >
                  {/* Columna 1: Usuario (Avatar + Nombre + Email/ID) */}
                  <div className="flex items-center gap-3 min-w-0 px-4 sm:px-6">
                    {renderAvatar(u)}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-zinc-900 dark:text-zinc-100 font-semibold text-sm leading-tight">
                        {u.name || 'Sin nombre'}
                      </span>
                      <span className="truncate text-xs text-zinc-500 dark:text-zinc-400 font-normal mt-0.5">
                        {u.email || u.phone || u.id}
                      </span>
                    </div>
                  </div>

                  {/* Columna 2: Rol & Sala */}
                  <div className="flex flex-col justify-center min-w-0 px-4 sm:px-6">
                    <div className="flex items-center">
                      {renderRoleBadge(role)}
                    </div>
                    <span className="truncate text-xs text-zinc-500 dark:text-zinc-400 font-mono leading-tight mt-0.5">
                      {lastRoomLabel}
                    </span>
                  </div>

                  {/* Columna 3: Última Actividad & Registro */}
                  <div className="flex flex-col justify-center min-w-0 px-4 sm:px-6 text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
                      {formatLastSeen(u.lastSeen)}
                    </span>
                    <span className="truncate text-xs leading-tight mt-0.5">
                      {formatDate(u.registeredAt || u.createdAt)}
                    </span>
                  </div>

                  {/* Columna 4: Estado (Pill Badge con alternancia rápida) */}
                  <div className="px-4 sm:px-6 text-left sm:text-center">
                    <button
                      type="button"
                      onClick={(e) => handleQuickToggleStatus(u, e)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        u.status === 'Activo'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:border dark:border-emerald-800/40 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                          : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:border dark:border-red-800/40 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                      }`}
                      title={u.status === 'Activo' ? 'Suspender cuenta' : 'Activar cuenta'}
                    >
                      {u.status === 'Activo' ? 'Activo' : 'Suspendido'}
                    </button>
                  </div>

                  {/* Columna 5: Acción Editar */}
                  <div className="hidden sm:flex items-center justify-end pr-4 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenUserDetail(u);
                      }}
                      className="p-1.5 rounded-xl hover:bg-zinc-200/70 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Editar usuario"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No se encontraron usuarios con los filtros aplicados.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
