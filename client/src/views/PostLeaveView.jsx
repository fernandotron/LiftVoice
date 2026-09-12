import React, { useState } from 'react';
import { Copy, Check, X, AlertCircle } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../components/LanguageSelector.jsx';
import Modal from '../components/shared/Modal.jsx';
import Banner from '../components/shared/Banner.jsx';
import CountryFlag from '../components/shared/CountryFlag.jsx';

/**
 * PostLeaveView — LiftVoice 2026 (Estilo Reness Bottom Sheet)
 * - Sin textos en mayúsculas forzadas ni códigos técnicos
 * - Botón de cierre en la esquina superior derecha
 * - Tarjeta central refinada con bandera vectorial proporcionada y botón Copiar
 * - Botones de acción "Entendido" y "Volver a unirse" alineados lado a lado
 */
export default function PostLeaveView({
  roomId,
  selectedLanguage = 'es',
  leaveReason = 'voluntary', // 'voluntary' | 'kicked' | 'ended'
  leaveMessage = '',
  onRejoin = () => {},
  onNavigateHome = () => {}
}) {
  const [hasCopied, setHasCopied] = useState(false);
  const langObj = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];
  const isKicked = leaveReason === 'kicked';

  const handleCopyCode = () => {
    if (!roomId) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}/join?room=${roomId}&lang=${selectedLanguage}`;
    navigator.clipboard?.writeText(fullUrl).then(() => {
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }).catch(() => {
      navigator.clipboard?.writeText(roomId);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onNavigateHome}
      variant="sheet"
      showHandle={false}
      titleId="post-leave-title"
      header={
        <div className="flex items-start justify-between gap-3 text-left">
          <div className="space-y-1 min-w-0">
            <div className="mb-1.5">
              <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                {isKicked ? 'Sesión finalizada' : 'Sesión cerrada'}
              </span>
            </div>
            <h2 id="post-leave-title" className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
              {isKicked ? 'Has sido retirado de la sala' : 'Has salido de la reunión'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed pt-0.5">
              {isKicked
                ? (leaveMessage || 'El anfitrión ha finalizado tu sesión en esta sala.')
                : 'La conexión de audio en directo y los subtítulos simultáneos se han detenido.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateHome}
            className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center cursor-pointer transition-colors shrink-0 -mr-1 mt-0.5"
            aria-label="Cerrar y volver al inicio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      }
      footer={
        <div className="w-full">
          {!isKicked ? (
            <div className="grid grid-cols-2 gap-2.5 w-full">
              <button
                type="button"
                onClick={onNavigateHome}
                className="h-12 rounded-full bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm font-semibold flex items-center justify-center transition-colors cursor-pointer"
              >
                Entendido
              </button>
              <button
                type="button"
                onClick={() => onRejoin(roomId, selectedLanguage)}
                className="h-12 rounded-full text-xs sm:text-sm font-semibold flex items-center justify-center shadow-xs transition-all cursor-pointer bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 active:scale-[0.99]"
              >
                Volver a unirse
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onNavigateHome}
              className="w-full h-12 rounded-full bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs sm:text-sm font-semibold flex items-center justify-center transition-colors cursor-pointer"
            >
              Entendido
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3 pt-1">
        {isKicked && (
          <Banner
            icon={<AlertCircle className="w-4 h-4 text-white" strokeWidth={2.4} />}
            color="#f43f5e"
            title="Acceso restringido"
            desc={leaveMessage || "No es posible volver a ingresar a esta sala debido a la moderación del anfitrión."}
          />
        )}

        {/* Room & Audio Channel Card */}
        <div className="p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800 space-y-3 text-left">
          {/* Room Code Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs text-zinc-400 dark:text-zinc-500 block">
                Sala de conferencia
              </span>
              <span className="font-mono text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight block truncate">
                {roomId || '—'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              title={hasCopied ? "Enlace copiado" : "Copiar enlace de la sala"}
              aria-label={hasCopied ? "Enlace copiado" : "Copiar enlace de la sala"}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer active:scale-95 flex-shrink-0"
            >
              {hasCopied ? (
                <Check className="w-4 h-4 text-emerald-500 stroke-[2.5]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Language Booth Row with Symmetrical 2-Line Height */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-700/70">
            <div className="min-w-0">
              <span className="text-xs text-zinc-400 dark:text-zinc-500 block">
                Canal de audio
              </span>
              <div className="flex items-center gap-2">
                <CountryFlag code={selectedLanguage} className="w-3.5 h-3.5 shrink-0" title={langObj.nativeName} />
                <span className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight block truncate">
                  {langObj.nativeName || langObj.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
