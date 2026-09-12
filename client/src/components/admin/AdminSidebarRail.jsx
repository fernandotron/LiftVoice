import React, { useState, useMemo } from 'react';
import { Search, X, LogOut } from 'lucide-react';
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
    ids: ['users-rooms', 'keys', 'appearance']
  }
];

export default function AdminSidebarRail({
  tabs,
  activeTab,
  onTabChange,
  onLogout = null
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
