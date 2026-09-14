import React from 'react';

/**
 * CountryFlag — Renderiza la bandera visual correspondiente a cada idioma
 * Soluciona el problema de compatibilidad en Windows (donde las banderas emoji
 * nativas se renderizan como letras 'ES', 'US', 'IT', 'BR') y cuenta con un
 * borde circular sutil al estilo del botón de selección.
 */
export default function CountryFlag({
  code,
  languageCode,
  className = 'w-6 h-6',
  title = '',
  bordered = true
}) {
  const rawCode = (code || languageCode || 'es').toString().toLowerCase().trim();
  let normalizedCode = rawCode;
  if (rawCode === 'pt-br' || rawCode === 'br' || rawCode === 'pt') normalizedCode = 'br';
  else if (rawCode === 'pt-pt') normalizedCode = 'pt';
  else if (rawCode === 'gb' || rawCode === 'uk' || rawCode === 'en-uk' || rawCode === 'en-gb') normalizedCode = 'gb';
  else if (rawCode.startsWith('en')) normalizedCode = 'gb'; // Usar bandera británica como en la captura
  else if (rawCode.startsWith('de')) normalizedCode = 'de';
  else if (rawCode.startsWith('it')) normalizedCode = 'it';
  else if (rawCode.startsWith('fr')) normalizedCode = 'fr';
  else if (rawCode.startsWith('es')) normalizedCode = 'es';
  else if (rawCode === 'auto') normalizedCode = 'auto';
  else if (rawCode === 'all' || rawCode === 'global' || rawCode === 'multi' || rawCode === 'multilingual') normalizedCode = 'all';

  const content = (() => {
    switch (normalizedCode) {
      case 'es':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label={title || 'Bandera de España'}>
            <rect width="36" height="36" fill="#c60b1e" />
            <rect y="9" width="36" height="18" fill="#ffc400" />
            <g transform="translate(6, 12)">
              <rect width="6" height="11" rx="2" fill="#c60b1e" stroke="#ffc400" strokeWidth="0.8" />
              <circle cx="3" cy="5.5" r="1.5" fill="#0038a8" />
              <path d="M1 2 Q3 0 5 2" stroke="#ffc400" strokeWidth="1" fill="none" />
            </g>
          </svg>
        );

      case 'gb':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label={title || 'Bandera de Reino Unido'}>
            <rect width="36" height="36" fill="#012169" />
            <path d="M0,0 L36,36 M36,0 L0,36" stroke="#ffffff" strokeWidth="6" />
            <path d="M0,0 L36,36 M36,0 L0,36" stroke="#c8102e" strokeWidth="2.5" />
            <path d="M18,0 V36 M0,18 H36" stroke="#ffffff" strokeWidth="9" />
            <path d="M18,0 V36 M0,18 H36" stroke="#c8102e" strokeWidth="5" />
          </svg>
        );

      case 'us':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label={title || 'Bandera de Estados Unidos'}>
            <rect width="36" height="36" fill="#b22234" />
            <rect y="2.77" width="36" height="2.77" fill="#ffffff" />
            <rect y="8.31" width="36" height="2.77" fill="#ffffff" />
            <rect y="13.85" width="36" height="2.77" fill="#ffffff" />
            <rect y="19.38" width="36" height="2.77" fill="#ffffff" />
            <rect y="24.92" width="36" height="2.77" fill="#ffffff" />
            <rect y="30.46" width="36" height="2.77" fill="#ffffff" />
            <rect width="16" height="19.38" fill="#3c3b6e" />
            <circle cx="3.5" cy="3.5" r="1" fill="#ffffff" />
            <circle cx="8" cy="3.5" r="1" fill="#ffffff" />
            <circle cx="12.5" cy="3.5" r="1" fill="#ffffff" />
            <circle cx="5.7" cy="7" r="1" fill="#ffffff" />
            <circle cx="10.2" cy="7" r="1" fill="#ffffff" />
            <circle cx="3.5" cy="10.5" r="1" fill="#ffffff" />
            <circle cx="8" cy="10.5" r="1" fill="#ffffff" />
            <circle cx="12.5" cy="10.5" r="1" fill="#ffffff" />
            <circle cx="5.7" cy="14" r="1" fill="#ffffff" />
            <circle cx="10.2" cy="14" r="1" fill="#ffffff" />
            <circle cx="3.5" cy="17" r="1" fill="#ffffff" />
            <circle cx="8" cy="17" r="1" fill="#ffffff" />
            <circle cx="12.5" cy="17" r="1" fill="#ffffff" />
          </svg>
        );

      case 'de':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label={title || 'Bandera de Alemania'}>
            <rect width="36" height="12" fill="#000000" />
            <rect y="12" width="36" height="12" fill="#dd0000" />
            <rect y="24" width="36" height="12" fill="#ffce00" />
          </svg>
        );

      case 'it':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label={title || 'Bandera de Italia'}>
            <rect width="12" height="36" fill="#009246" />
            <rect x="12" width="12" height="36" fill="#ffffff" />
            <rect x="24" width="12" height="36" fill="#ce2b37" />
          </svg>
        );

      case 'br':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label={title || 'Bandera de Brasil'}>
            <rect width="36" height="36" fill="#009b3a" />
            <polygon points="18,4 33,18 18,32 3,18" fill="#fedf00" />
            <circle cx="18" cy="18" r="7.5" fill="#002776" />
            <path d="M11 19.5 C 14 16.5, 22 16.5, 25 20.5" stroke="#ffffff" strokeWidth="1.6" fill="none" />
          </svg>
        );

      case 'pt':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label={title || 'Bandera de Portugal'}>
            <rect width="15" height="36" fill="#006600" />
            <rect x="15" width="21" height="36" fill="#ff0000" />
            <circle cx="15" cy="18" r="6.5" fill="#ffff00" stroke="#000000" strokeWidth="0.5" />
            <circle cx="15" cy="18" r="4.5" fill="#ffffff" stroke="#003399" strokeWidth="0.8" />
            <rect x="13.5" y="16.5" width="3" height="3" fill="#003399" />
          </svg>
        );

      case 'fr':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label={title || 'Bandera de Francia'}>
            <rect width="12" height="36" fill="#002395" />
            <rect x="12" width="12" height="36" fill="#ffffff" />
            <rect x="24" width="12" height="36" fill="#ed2939" />
          </svg>
        );

      case 'auto':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label="Detección Automática">
            <rect width="36" height="36" fill="#3f3f46" />
            <circle cx="18" cy="18" r="10" fill="none" stroke="#ffffff" strokeWidth="1.8" />
            <ellipse cx="18" cy="18" rx="5" ry="10" fill="none" stroke="#ffffff" strokeWidth="1.4" />
            <line x1="8" y1="18" x2="28" y2="18" stroke="#ffffff" strokeWidth="1.4" />
          </svg>
        );

      case 'all':
      default:
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label={title || 'Multilingüe Global'}>
            <rect width="36" height="36" className="fill-zinc-100 dark:fill-zinc-950" />
            <circle cx="18" cy="18" r="14" className="fill-sky-100 dark:fill-[#082f49] stroke-sky-600 dark:stroke-sky-400" strokeWidth="1.8" />
            <ellipse cx="18" cy="18" rx="7" ry="14" fill="none" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth="1.4" />
            <line x1="4" y1="18" x2="32" y2="18" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth="1.4" />
            <line x1="18" y1="4" x2="18" y2="32" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth="1.4" />
            <line x1="7" y1="11" x2="29" y2="11" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth="1.1" strokeOpacity="0.85" />
            <line x1="7" y1="25" x2="29" y2="25" className="stroke-sky-600 dark:stroke-sky-400" strokeWidth="1.1" strokeOpacity="0.85" />
          </svg>
        );
    }
  })();

  const hasCustomRadius = className && /rounded-(?:none|xs|sm|md|lg|xl|2xl|3xl|full)/.test(className);

  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden shrink-0 bg-white dark:bg-zinc-900 ${
        bordered ? 'border border-zinc-300 dark:border-zinc-700 shadow-2xs' : ''
      } ${className} ${hasCustomRadius ? '' : 'rounded-full'}`}
    >
      {content}
    </span>
  );
}
