import React from 'react';
import { Mic, Headphones, Sparkles } from 'lucide-react';

/**
 * StudioSidebar
 * Barra lateral vertical de navegación para el Estudio de LiftVoice.
 * 
 * Replicando la estética minimalista del menú de referencia:
 * 3 opciones de navegación bajo el encabezado principal:
 * 1. Ventana actual del estudio (Estudio)
 * 2. Catálogo de voces (Catálogo)
 * 3. Resumen de IA (Resumen IA)
 */
export default function StudioSidebar({
  activeTab = 'studio', // 'studio' | 'catalog' | 'summary'
  onSelectStudio = () => {},
  onSelectCatalog = () => {},
  onSelectSummary = () => {}
}) {
  const navItems = [
    {
      id: 'studio',
      label: 'Estudio',
      title: 'Ventana actual del estudio',
      icon: Mic,
      onClick: onSelectStudio
    },
    {
      id: 'catalog',
      label: 'Catálogo',
      title: 'Catálogo de voces',
      icon: Headphones,
      onClick: onSelectCatalog
    },
    {
      id: 'summary',
      label: 'Resumen',
      title: 'Resumen de sesión',
      icon: Sparkles,
      onClick: onSelectSummary
    }
  ];

  return (
    <aside
      aria-label="Navegación lateral del estudio"
      className="hidden sm:flex w-[70px] h-full border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex-col items-center py-3 flex-shrink-0 select-none z-20"
    >
      {/* Pila vertical de opciones de navegación */}
      <nav className="flex flex-col items-center gap-4 w-full px-1.5">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              title={item.title}
              aria-label={item.title}
              aria-current={isActive ? 'page' : undefined}
              className="group flex flex-col items-center gap-1.5 w-full cursor-pointer focus:outline-none"
            >
              {/* Contenedor redondeado estilo squircle (idéntico a la imagen) */}
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-zinc-900 dark:bg-zinc-800 text-white shadow-xs'
                    : 'bg-transparent text-zinc-400 dark:text-zinc-500 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800/60 group-hover:text-zinc-800 dark:group-hover:text-zinc-200'
                }`}
              >
                <Icon className="w-5 h-5 stroke-[2]" />
              </div>

              {/* Etiqueta inferior */}
              <span
                className={`text-[10.5px] leading-tight text-center max-w-[62px] truncate transition-colors ${
                  isActive
                    ? 'text-zinc-900 dark:text-white font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 font-medium group-hover:text-zinc-800 dark:group-hover:text-zinc-200'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
