import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, LogOut, ArrowLeft, Radio, Headphones, Sliders, Clock, Copy, Check } from 'lucide-react';
import { adminAuthService } from '../../services/adminAuthService.js';

const TAB_CATEGORIES = [
  {
    name: 'Conferencia y audio',
    ids: ['stt', 'tts']
  },
  {
    name: 'Inteligencia artificial',
    ids: ['ai', 'medical']
  },
  {
    name: 'Gestión y seguridad',
    ids: ['users', 'rooms', 'keys', 'appearance']
  }
];

const ROOM_SUBSECTIONS = [
  { id: 'session', label: 'Sesión y emisión', icon: Radio },
  { id: 'cabins', label: 'Cabinas de traducción', icon: Headphones }
];

export default function AdminSidebarRail({
  tabs,
  activeTab,
  onTabChange,
  onLogout = null,
  selectedRoom = null,
  roomSubSection = 'session',
  onRoomSubSectionChange = null,
  onBackToRooms = null
}) {
  const [search, setSearch] = useState('');
  const adminUser = adminAuthService.getAdminUser();

  const filteredTabs = useMemo(() => {
    if (!search.trim()) return tabs;
    const q = search.toLowerCase();
    return tabs.filter(t => t.label.toLowerCase().includes(q));
  }, [tabs, search]);

  const initials = useMemo(() => {
    const email = adminUser?.email || 'AD';
    return email.slice(0, 2).toUpperCase();
  }, [adminUser]);

  const handleLogoutClick = async () => {
    await adminAuthService.logout();
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!selectedRoom?.createdAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [selectedRoom?.createdAt]);

  const uptime = useMemo(() => {
    if (!selectedRoom?.createdAt) return '';
    const diffMs = Math.max(0, now - Number(selectedRoom.createdAt));
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [now, selectedRoom?.createdAt]);

  const handleCopyRoomId = async (e) => {
    e?.stopPropagation?.();
    if (!selectedRoom?.roomId) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selectedRoom.roomId);
      } else {
        const ta = document.createElement('textarea');
        ta.value = selectedRoom.roomId;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy room id:', err);
    }
  };

  // ── CARRIL CONMUTADO: SUB-MENÚ DE LA SALA (ESTILO STANDALONE-ASSISTANT) ────
  if (selectedRoom) {
    const isLive = Boolean(selectedRoom.isHostOnline);
    return (
      <div className="w-full flex-1 flex flex-col justify-between overflow-hidden animate-fadeIn" data-testid="admin-sidebar-room-rail">
        {/* Fila superior: Volver a salas */}
        <div className="p-3 sm:p-3.5 border-b border-zinc-200/80 dark:border-white/10 flex-shrink-0">
          <button
            type="button"
            onClick={onBackToRooms}
            aria-label="Volver a la lista de salas"
            className="w-full flex items-center gap-2.5 h-11 px-3 rounded-2xl text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-white/5 transition-colors cursor-pointer group"
            data-testid="admin-sidebar-volver-salas"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white" />
            <span className="truncate">Volver a salas</span>
          </button>
        </div>

        {/* Opciones del sub-menú de la sala */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-custom scrollbar-fina">
          {/* Identidad de la sala activa: arriba del todo, justo arriba de Opciones de sala */}
          <div className="p-3 rounded-2xl bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 flex items-center gap-3 shadow-2xs">
            {/* Avatar distintivo con pulso en vivo */}
            <div
              className="relative shrink-0 w-10 h-10 rounded-2xl bg-zinc-200/60 dark:bg-white/10 flex items-center justify-center text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-white/10"
              title={isLive ? 'Emisión en directo' : 'Emisión en pausa'}
            >
              <Radio className="w-5 h-5" />
              {isLive ? (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              ) : (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {selectedRoom.title || 'Sala de Conferencia'}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                <span className="truncate">{selectedRoom.roomId}</span>
                <button
                  type="button"
                  onClick={handleCopyRoomId}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 transition-colors cursor-pointer shrink-0"
                  title="Copiar código de sala"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
                {uptime && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-700 select-none">/</span>
                    <span className="flex items-center gap-1 shrink-0 text-zinc-400">
                      <Clock className="w-3 h-3" />
                      <span>{uptime}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sub-secciones navegables */}
          <div className="space-y-0.5 pt-1">
            <h5 className="px-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 select-none mb-2">
              Opciones de sala
            </h5>
            {ROOM_SUBSECTIONS.map((sub) => {
              const SubIcon = sub.icon;
              const isActive = roomSubSection === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onRoomSubSectionChange?.(sub.id)}
                  className={`w-full flex items-center gap-3 h-10 px-3 rounded-2xl text-xs sm:text-sm font-medium transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white font-semibold shadow-2xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  data-testid={`admin-room-subsection-${sub.id}`}
                >
                  <SubIcon size={17} className="flex-shrink-0" />
                  <span className="flex-1 truncate">{sub.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pie del carril: Perfil de sesión del administrador (homogéneo con todas las pestañas) */}
        <div className="px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-zinc-200/80 dark:border-white/10 flex items-center justify-between gap-3 flex-shrink-0 min-h-[81px]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-zinc-200/80 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center flex-shrink-0 shadow-2xs">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {adminUser?.email || 'admin@liftvoice.ai'}
              </div>
              <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 leading-tight mt-0.5">
                Admin Master
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogoutClick}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
            title="Cerrar sesión de administrador"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col justify-between overflow-hidden">
      {/* Search Input Box - 44px rounded-2xl as in standalone-assistant */}
      <div className="p-3 sm:p-3.5 border-b border-zinc-200/80 dark:border-white/10 flex-shrink-0">
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          autoComplete="off"
          className="relative"
        >
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="admin-sidebar-section-search"
            name="section_search_query"
            type="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sección..."
            className="w-full h-11 pl-10 pr-8 bg-zinc-100/70 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:focus:ring-white/20 transition-all [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>

      {/* Tabs Navigation Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-custom scrollbar-fina">
        {search.trim() ? (
          /* Search results flat list */
          <div className="space-y-1">
            {filteredTabs.length === 0 ? (
              <p className="px-3 py-4 text-xs text-zinc-400 text-center">
                No se encontraron secciones
              </p>
            ) : (
              filteredTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`w-full flex items-center gap-3 h-10 px-3 rounded-2xl text-xs sm:text-sm font-medium transition-colors text-left cursor-pointer ${
                      isActive
                        ? 'bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Icon size={17} className="flex-shrink-0" />
                    <span className="flex-1 truncate">{tab.label}</span>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          /* Categorized Navigation */
          TAB_CATEGORIES.map((cat) => {
            const catTabs = tabs.filter(t => cat.ids.includes(t.id));
            if (catTabs.length === 0) return null;

            return (
              <div key={cat.name} className="space-y-1">
                <h4 className="px-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 select-none mb-2">
                  {cat.name}
                </h4>
                <div className="space-y-0.5">
                  {catTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`w-full flex items-center gap-3 h-10 px-3 rounded-2xl text-xs sm:text-sm font-medium transition-colors text-left cursor-pointer ${
                          isActive
                            ? 'bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white font-semibold'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        <Icon size={17} className="flex-shrink-0" />
                        <span className="flex-1 truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Admin Session Profile (Footer of Rail) - Aligned height with AdminStickyFooter */}
      <div className="px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-zinc-200/80 dark:border-white/10 flex items-center justify-between gap-3 flex-shrink-0 min-h-[81px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-zinc-200/80 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center flex-shrink-0 shadow-2xs">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {adminUser?.email || 'admin@liftvoice.ai'}
            </div>
            <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 leading-tight mt-0.5">
              Admin Master
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogoutClick}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
          title="Cerrar sesión de administrador"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}
