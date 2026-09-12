import React from 'react';

export default function AdminSidebarRail({ tabs, activeTab, onTabChange, engineSummary }) {
  return (
    <div className="w-full md:w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 space-y-6 overflow-y-auto">
      <div className="space-y-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-100/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400'} />
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.badge && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${
                  isActive
                    ? 'bg-indigo-200/50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {engineSummary && (
        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Motor Activo
          </h4>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {engineSummary}
          </p>
        </div>
      )}
    </div>
  );
}
