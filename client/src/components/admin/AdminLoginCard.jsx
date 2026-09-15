import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, ArrowLeft, ShieldAlert, X } from 'lucide-react';
import { adminAuthService } from '../../services/adminAuthService.js';

function FloatingCapsuleInput({
  id,
  type = 'text',
  label,
  value,
  onChange,
  required = false,
  autoFocus = false,
  autoComplete,
  disabled = false,
  rightElement = null
}) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = Boolean(value && String(value).length > 0);
  const isFloated = isFocused || hasValue;

  return (
    <div className="relative w-full">
      {/* Smoothly Gliding Floating Label with Notched Cut-out matching AttendeeLobbyView */}
      <label
        htmlFor={id}
        className={`absolute px-1.5 transition-all duration-200 ease-out select-none pointer-events-none z-10 ${
          isFloated
            ? '-top-2.5 left-4 text-xs font-medium bg-white dark:bg-[#121214] ' +
              (isFocused ? 'text-zinc-950 dark:text-white' : 'text-zinc-500 dark:text-zinc-400')
            : 'top-3.5 left-4 text-sm bg-transparent text-zinc-400 dark:text-zinc-500'
        }`}
      >
        {label}
      </label>

      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        disabled={disabled}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`w-full h-12 rounded-2xl pl-5 ${rightElement ? 'pr-12' : 'pr-5'} text-sm text-zinc-900 dark:text-white transition-all duration-200 outline-none ${
          isFocused
            ? 'border-2 border-zinc-950 dark:border-white bg-transparent dark:bg-[#121214]'
            : hasValue
            ? 'border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121214]'
            : 'border border-zinc-200 dark:border-zinc-800/90 bg-zinc-50/70 dark:bg-[#121214] hover:border-zinc-300 dark:hover:border-zinc-700'
        }`}
      />
      {rightElement && (
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 z-10">
          {rightElement}
        </div>
      )}
    </div>
  );
}

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
    if (e && e.preventDefault) e.preventDefault();
    if (!password.trim() || lockoutSeconds > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      await adminAuthService.login({ email: email.trim(), password: password.trim() });
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

  const formContent = (
    <>
      {/* Header matching AttendeeLobbyView */}
      <div className="text-center mb-8 space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Entrar
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Acceso al panel de administración
        </p>
        {roomId && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono pt-0.5">
            Sala <span className="font-semibold text-zinc-700 dark:text-zinc-300">{roomId}</span>
          </p>
        )}
      </div>

      {/* Form with Capsule Inputs matching AttendeeLobbyView */}
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <FloatingCapsuleInput
          id="admin-email"
          type="email"
          label="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading || lockoutSeconds > 0}
        />

        <FloatingCapsuleInput
          id="admin-password"
          type={showPassword ? 'text' : 'password'}
          label="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          autoComplete="current-password"
          disabled={loading || lockoutSeconds > 0}
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer transition-colors"
              title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />

        {lockoutSeconds > 0 ? (
          <div className="px-4 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs font-medium text-amber-700 dark:text-amber-300 text-center flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Bloqueo temporal: {Math.floor(lockoutSeconds / 60)}:{(lockoutSeconds % 60).toString().padStart(2, '0')} min</span>
          </div>
        ) : error ? (
          <div className="px-4 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-600 dark:text-rose-400 text-center">
            {error}
          </div>
        ) : null}

        {/* Primary CTA Button: 'Continuar' / 'Acceder' matching AttendeeLobbyView */}
        <button
          type="submit"
          disabled={!password.trim() || loading || lockoutSeconds > 0}
          className={`w-full h-12 rounded-full sm:rounded-2xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 mt-5 cursor-pointer ${
            password.trim() && !loading && lockoutSeconds === 0
              ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-md hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.99]'
              : 'bg-zinc-100 dark:bg-[#141416] text-zinc-400 dark:text-zinc-600 cursor-not-allowed border border-zinc-200 dark:border-zinc-800/60'
          }`}
        >
          <span>
            {lockoutSeconds > 0 ? `Reintento en ${lockoutSeconds}s` : (loading ? 'Verificando...' : 'Continuar')}
          </span>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
        </button>
      </form>

      {onCancel && (
        <div className="mt-5 text-center">
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
    </>
  );

  // MODAL VARIANT: Clean single card without double borders or nested frames
  if (variant === 'modal') {
    return (
      <div className="relative w-full h-full h-dvh md:h-auto md:max-w-[390px] rounded-none md:rounded-[32px] bg-white dark:bg-[#121214] border-0 md:border border-zinc-200/90 dark:border-zinc-800/90 shadow-none md:shadow-2xl p-6 sm:p-7 md:p-9 text-center animate-fadeIn mx-auto my-auto flex flex-col justify-center items-center">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95 touch-manipulation z-10"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="w-full max-w-[360px]">
          {formContent}
        </div>
      </div>
    );
  }

  // PAGE VARIANT: Exact 1:1 match with AttendeeLobbyView layout
  return (
    <div className="relative min-h-dvh w-screen flex flex-col items-center justify-center bg-white dark:bg-black text-zinc-900 dark:text-white px-4 py-8 transition-colors">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-5 left-5 sm:top-7 sm:left-7 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-100 dark:bg-zinc-800/90 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs"
          aria-label={roomId ? 'Volver a la sala' : 'Volver al inicio'}
          title="Volver"
        >
          <ArrowLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </button>
      )}

      <div className="w-full max-w-[360px] sm:max-w-[380px] flex flex-col items-center animate-fadeIn">
        {formContent}
      </div>
    </div>
  );
}
