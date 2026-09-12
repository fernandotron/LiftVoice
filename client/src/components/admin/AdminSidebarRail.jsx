import React, { useState, useMemo } from 'react';
import { Search, X, LogOut, Shield, Mic, Volume2, Cpu, Stethoscope, Users, Key, Palette } from 'lucide-react';
import { adminAuthService } from '../../services/adminAuthService.js';

const TAB_CATEGORIES = [
  {
    name: 'Conferencia & Audio',
    ids: ['stt', 'tts']
  },
  {
    name: 'Inteligencia Artificial',
    ids: ['ai', 'medical']
  },
  {
    name: 'Gestión & Seguridad',
    ids: ['users-rooms', 'keys', 'appearance']
  }
];

export default function AdminSidebarRail({
  tabs,
  activeTab,
  onTabChange,
  engineSummary,
  onLogout = null
}) {
  const [search, setSearch] = useState('');
  const adminUser = adminAuthService.getAdminUser();

  const filteredTabs = useMemo(() => {
    if (!search.trim()) return tabs;
    const q = search.toLowerCase();
    return tabs.filter(t => 
      t.label.toLowerCase().includes(q) || 
      (t.badge && t.badge.toLowerCase().includes(q))
    );
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

  return (
    <div className="w-full flex-1 flex flex-col justify-between overflow-hidden">
      {/* Search Input Box */}
      <div className="p-3 sm:p-3.5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex-shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sección..."
            className="w-full h-9 pl-9 pr-8 bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/70 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-100 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation Body */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
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
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Icon size={15} className="flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{tab.label}</span>
                    {tab.badge && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                        isActive
                          ? 'bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-950'
                          : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
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
                <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 select-none">
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
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold shadow-2xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        <Icon size={15} className="flex-shrink-0" />
                        <span className="flex-1 text-left truncate">{tab.label}</span>
                        {tab.badge && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                            isActive
                              ? 'bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-950'
                              : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}>
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Admin Session Profile Card (Footer of Rail) */}
      <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-2xs">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {adminUser?.email || 'admin@liftvoice.ai'}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1 py-0.2 rounded border border-emerald-200 dark:border-emerald-800/50">
                  MASTER
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogoutClick}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer flex-shrink-0"
            title="Cerrar sesión de administrador"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
