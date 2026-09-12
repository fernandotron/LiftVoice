import React, { useState, useEffect } from 'react';
import { Lock, Mail, Eye, EyeOff, Loader2, ArrowLeft, Shield, ShieldAlert } from 'lucide-react';
import { adminAuthService } from '../../services/adminAuthService.js';

export function AdminLoginCard({
  onLoginSuccess = () => {},
  onCancel = null,
  variant = 'page',
  roomId = null
}) {
  const initialUser = adminAuthService.getAdminUser();
  const [email, setEmail] = useState(() => initialUser?.email || 'admin@liftvoice.ai');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      await adminAuthService.login({ email: email.trim(), password: password.trim() });
      onLoginSuccess();
    } catch (err) {
      if (err.status === 429 && err.retryAfter) {
        setLockoutSeconds(err.retryAfter);
      }
      setError(err.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  const card = (
    <div className="bg-white dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800 rounded-[28px] p-6 sm:p-7 flex flex-col justify-between shadow-2xs text-left space-y-6 w-full animate-fadeIn">
      <div className="space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-900 dark:text-zinc-100 shadow-2xs">
          <Lock className="w-5 h-5" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Acceso de Administrador
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Ingresa tu correo y contraseña maestra para administrar el pipeline de IA, cabinas y salas.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Email Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
            Correo electrónico
          </label>
          <div className="relative">
            <input
              id="admin-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@liftvoice.ai"
              required
              disabled={loading || lockoutSeconds > 0}
              className="w-full h-11 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-full pl-10 pr-4 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-100 transition-all"
            />
            <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="admin-password-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña maestra"
              autoFocus
              required
              disabled={loading || lockoutSeconds > 0}
              className="w-full h-11 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-full pl-10 pr-11 text-xs sm:text-sm font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-900 dark:focus:border-zinc-100 transition-all"
            />
            <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 cursor-pointer transition-colors"
              title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {lockoutSeconds > 0 ? (
          <div className="px-4 py-2.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs font-medium text-amber-700 dark:text-amber-300 text-center flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Bloqueo temporal: {Math.floor(lockoutSeconds / 60)}:{(lockoutSeconds % 60).toString().padStart(2, '0')} min</span>
          </div>
        ) : error ? (
          <div className="px-4 py-2.5 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-600 dark:text-rose-400 text-center">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || !password.trim() || lockoutSeconds > 0}
          className="w-full h-11 rounded-full bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-semibold text-xs sm:text-sm flex items-center justify-center shadow-xs disabled:opacity-40 cursor-pointer transition-all active:scale-[0.99] mt-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400 mr-2" />
          ) : null}
          <span>
            {lockoutSeconds > 0 ? `Reintento en ${lockoutSeconds}s` : (loading ? 'Verificando credenciales...' : 'Acceder al Panel')}
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
          <span>Seguridad del Sistema</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.15]">
          Acceso al panel maestro
        </h1>

        <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
          Introduce tus credenciales de administrador para configurar motores de voz, modelos de IA y supervisar salas.
        </p>
      </div>

      {/* Action Card */}
      <div className="space-y-4 sm:space-y-6 w-full max-w-md mx-auto">
        {card}
      </div>
    </div>
  );
}
