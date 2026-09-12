import React, { useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';

function FloatingCapsuleInput({
  id,
  type = 'text',
  label,
  value,
  onChange,
  required = false,
  autoFocus = false,
  autoComplete
}) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = Boolean(value && String(value).length > 0);
  const isFloated = isFocused || hasValue;

  return (
    <div className="relative w-full">
      {/* Smoothly Gliding Floating Label */}
      <label
        htmlFor={id}
        className={`absolute px-1.5 transition-all duration-200 ease-out select-none pointer-events-none z-10 ${
          isFloated
            ? '-top-2.5 left-4 text-xs font-medium bg-white dark:bg-black ' +
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
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`w-full h-12 rounded-2xl px-5 text-sm text-zinc-900 dark:text-white transition-all duration-200 outline-none ${
          isFocused
            ? 'border-2 border-zinc-950 dark:border-white bg-transparent dark:bg-black'
            : hasValue
            ? 'border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121214]'
            : 'border border-zinc-200 dark:border-zinc-800/90 bg-zinc-50/70 dark:bg-[#121214] hover:border-zinc-300 dark:hover:border-zinc-700'
        }`}
      />
    </div>
  );
}

export default function AttendeeLobbyView({
  roomId = 'MAIN',
  onBack = () => {},
  onSubmit = () => {}
}) {
  const [name, setName] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lv_attendee_profile') || '{}');
      return saved.name || '';
    } catch {
      return '';
    }
  });

  const [email, setEmail] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lv_attendee_profile') || '{}');
      return saved.email || '';
    } catch {
      return '';
    }
  });

  const [phone, setPhone] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lv_attendee_profile') || '{}');
      return saved.phone || '';
    } catch {
      return '';
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidEmail = email.trim().includes('@') && email.trim().includes('.');
  const isFormValid = name.trim().length >= 2 && isValidEmail;

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim()
    });
  };

  return (
    <div className="relative min-h-dvh w-screen flex flex-col items-center justify-center bg-white dark:bg-black text-zinc-900 dark:text-white px-4 py-8 transition-colors">
      
      {/* Top Left Back Button (Circular design with ArrowLeft) */}
      <button
        type="button"
        onClick={onBack}
        className="absolute top-5 left-5 sm:top-7 sm:left-7 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-100 dark:bg-zinc-800/90 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shadow-xs"
        aria-label="Volver al inicio"
        title="Volver"
      >
        <ArrowLeft className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
      </button>

      {/* Central Minimalist Auth Container */}
      <div className="w-full max-w-[360px] sm:max-w-[380px] flex flex-col items-center animate-fadeIn">
        
        {/* Header */}
        <div className="text-center mb-8 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Entrar
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Bienvenido a la sala de conferencias
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono pt-0.5">
            Sala <span className="font-semibold text-zinc-700 dark:text-zinc-300">{roomId}</span>
          </p>
        </div>

        {/* Form with Capsule Inputs & Monochromatic Notched Floating Labels */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          
          {/* Nombre y Apellido */}
          <FloatingCapsuleInput
            id="name"
            label="Nombre y apellido"
            placeholder="Introduce tu nombre y apellido"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            autoComplete="name"
          />

          {/* Correo Electrónico */}
          <FloatingCapsuleInput
            id="email"
            type="email"
            label="Correo electrónico"
            placeholder="Introduce tu correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          {/* WhatsApp / Teléfono (Opcional) */}
          <FloatingCapsuleInput
            id="phone"
            type="tel"
            label="WhatsApp (opcional)"
            placeholder="WhatsApp (opcional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />

          {/* Primary CTA Button: 'Continuar' (Separated with mt-5) */}
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 mt-5 cursor-pointer ${
              isFormValid
                ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-md hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.99]'
                : 'bg-zinc-100 dark:bg-[#141416] text-zinc-400 dark:text-zinc-600 cursor-not-allowed border border-zinc-200 dark:border-zinc-800/60'
            }`}
          >
            <span>Continuar</span>
            {isSubmitting && (
              <span className="animate-spin">
                <Loader2 className="w-4 h-4" />
              </span>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
