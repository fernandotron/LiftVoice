import React, { useState, useEffect } from 'react';
import { Lock, Loader2, ArrowLeft, Shield, ShieldAlert } from 'lucide-react';
import { adminAuthService } from '../../services/adminAuthService.js';

export function AdminLoginCard({
  onLoginSuccess = () => {},
  onCancel = null,
  variant = 'page',
  roomId = null
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim() || lockoutSeconds > 0) return;
    setError(null);
    setLoading(true);
    try {
      await adminAuthService.login(password.trim());
      onLoginSuccess();
    } catch (err) {
      if (err.status === 429 && err.retryAfter) {
        setLockoutSeconds(err.retryAfter);
      }
      setError(err.message || 'Contraseña incorrecta');
    } finally {
      setLoading(false);
    }
  };

  const card = (
    <div className="bg-white dark:bg-zinc-900/70 border border-zinc-200/90 dark:border-zinc-800 rounded-[28px] p-6 sm:p-7 flex flex-col justify-between shadow-2xs text-left space-y-6 w-full animate-fadeIn">
      <div className="space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-900 dark:text-zinc-100 shadow-2xs">
          <Lock className="w-5 h-5" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Desbloquear panel
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Ingresa la contraseña maestra para administrar modelos de IA, claves y salas.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          id="admin-password-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña de administrador"
          autoFocus
          required
          disabled={lockoutSeconds > 0}
          className="w-full h-12 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 text-sm font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        />

        {lockoutSeconds > 0 ? (
          <div className="px-4 py-2.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs font-medium text-amber-700 dark:text-amber-300 text-center flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Bloqueo temporal por seguridad: {Math.floor(lockoutSeconds / 60)}:{(lockoutSeconds % 60).toString().padStart(2, '0')} min</span>
          </div>
        ) : error ? (
          <div className="px-4 py-2.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-600 dark:text-rose-400 text-center">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || !password.trim() || lockoutSeconds > 0}
          className="w-full h-12 rounded-full bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-sm flex items-center justify-center shadow-sm disabled:opacity-40 cursor-pointer transition-all active:scale-[0.99]"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400 mr-2" />
          ) : null}
          <span>
            {lockoutSeconds > 0 ? `Reintento en ${lockoutSeconds}s` : (loading ? 'Verificando...' : 'Desbloquear')}
          </span>
        </button>
      </form>

      {onCancel && (
        <div className="pt-2 text-center border-t border-zinc-100 dark:border-zinc-800/60">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{roomId ? 'Volver a la sala' : 'Volver al inicio'}</span>
          </button>
        </div>
      )}
    </div>
  );

  if (variant === 'modal') {
    return (
      <div className="w-full max-w-md mx-auto my-auto p-4 sm:p-6">
        {card}
      </div>
    );
  }

  return (
    <div className="my-auto w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-7 sm:space-y-9">
      {/* Clean Hero idéntico a la entrada a la sala */}
      <div className="text-center max-w-xl mx-auto space-y-3.5 sm:space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium shadow-2xs">
          <Shield className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
          <span>Configuración de Administración</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.15]">
          Acceso al panel maestro
        </h1>

        <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Introduce la clave maestra de LiftVoice para acceder al panel de configuración del servidor y salas en directo.
        </p>
      </div>

      {/* Action Card: Diseño exacto de la entrada a la sala */}
      <div className="space-y-4 sm:space-y-6 w-full max-w-md mx-auto">
        {card}
      </div>
    </div>
  );
}
