import React from 'react';

/**
 * CountryFlag — Renderiza la bandera visual correspondiente a cada idioma
 * Soluciona el problema de compatibilidad en Windows (donde las banderas emoji
 * nativas se renderizan como letras 'ES', 'US', 'IT', 'BR') y cuenta con un
 * borde circular sutil al estilo del botón de selección.
 */
export default function CountryFlag({
  code = 'es',
  className = 'w-6 h-6',
  title = '',
  bordered = true
}) {
  const content = (() => {
    switch (code) {
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

      case 'en':
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

      case 'it':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label={title || 'Bandera de Italia'}>
            <rect width="12" height="36" fill="#009246" />
            <rect x="12" width="12" height="36" fill="#ffffff" />
            <rect x="24" width="12" height="36" fill="#ce2b37" />
          </svg>
        );

      case 'pt':
        return (
          <svg viewBox="0 0 36 36" className="w-full h-full block" role="img" aria-label={title || 'Bandera de Brasil'}>
            <rect width="36" height="36" fill="#009b3a" />
            <polygon points="18,4 33,18 18,32 3,18" fill="#fedf00" />
            <circle cx="18" cy="18" r="7.5" fill="#002776" />
            <path d="M11 19.5 C 14 16.5, 22 16.5, 25 20.5" stroke="#ffffff" strokeWidth="1.6" fill="none" />
          </svg>
        );

      default:
        return <span className="text-base leading-none">🌐</span>;
    }
  })();

  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden shrink-0 ${
        bordered ? 'border border-zinc-300 dark:border-zinc-700 shadow-2xs' : ''
      } ${className} rounded-full`}
    >
      {content}
    </span>
  );
}
