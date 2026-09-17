import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { translations, SUPPORTED_I18N_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n/index.js';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  // Detect language from localStorage or navigator
  const [language, setLanguageState] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('lv_preferred_lang');
        if (saved && SUPPORTED_I18N_LANGUAGES.includes(saved.toLowerCase())) {
          return saved.toLowerCase();
        }
      }
      if (typeof navigator !== 'undefined') {
        const navLang = (navigator.language || navigator.userLanguage || '').slice(0, 2).toLowerCase();
        if (SUPPORTED_I18N_LANGUAGES.includes(navLang)) {
          return navLang;
        }
      }
    } catch (e) {
      console.warn('[I18n] Error detecting initial language:', e);
    }
    return DEFAULT_LANGUAGE;
  });

  const setLanguage = useCallback((newLang) => {
    if (!newLang) return;
    const cleanLang = String(newLang).slice(0, 2).toLowerCase();
    if (SUPPORTED_I18N_LANGUAGES.includes(cleanLang)) {
      setLanguageState(cleanLang);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('lv_preferred_lang', cleanLang);
        }
      } catch (e) {
        console.warn('[I18n] Error saving language preference:', e);
      }
    }
  }, []);

  // Sync across tabs / storage events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (e) => {
      if (e.key === 'lv_preferred_lang' && e.newValue) {
        const clean = e.newValue.slice(0, 2).toLowerCase();
        if (SUPPORTED_I18N_LANGUAGES.includes(clean)) {
          setLanguageState(clean);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  /**
   * t(path, params, maybeDefault)
   * Examples:
   *   t('languages.es', 'Español')
   *   t('listenerView.header.audioBanner.title')
   *   t('audienceBottomSheet.activeListenersDesc', { count: 5, room: 'Main' })
   *   t('host.qa.activeSpeakerTitle', { name: 'Oyente', defaultValue: 'Oyente está hablando' })
   */
  const t = useCallback((path, params = {}, maybeDefault = null) => {
    if (!path || typeof path !== 'string') return '';

    // Extract defaultValue and interpolation parameters
    let defaultValue = '';
    let interpolationParams = {};

    if (typeof params === 'string') {
      defaultValue = params;
      interpolationParams = typeof maybeDefault === 'object' && maybeDefault !== null ? maybeDefault : {};
    } else if (typeof params === 'object' && params !== null) {
      interpolationParams = params;
      if (typeof params.defaultValue === 'string') {
        defaultValue = params.defaultValue;
      } else if (typeof maybeDefault === 'string') {
        defaultValue = maybeDefault;
      }
    } else if (typeof maybeDefault === 'string') {
      defaultValue = maybeDefault;
    }

    const keys = path.split('.');

    // Search in current language
    let current = translations[language];
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        current = undefined;
        break;
      }
    }

    // Fallback to default language if not found
    if (current === undefined && language !== DEFAULT_LANGUAGE) {
      let fallback = translations[DEFAULT_LANGUAGE];
      for (const key of keys) {
        if (fallback && typeof fallback === 'object' && key in fallback) {
          fallback = fallback[key];
        } else {
          fallback = undefined;
          break;
        }
      }
      current = fallback;
    }

    // If current is an object with a 'name', 'label' or 'title' property (e.g. languages.es -> { name: 'Español' })
    if (current && typeof current === 'object') {
      if (typeof current.name === 'string') {
        current = current.name;
      } else if (typeof current.label === 'string') {
        current = current.label;
      } else if (typeof current.title === 'string') {
        current = current.title;
      }
    }

    // If still missing or not string/number, fallback to defaultValue or key path
    if (current === undefined || (typeof current !== 'string' && typeof current !== 'number')) {
      return defaultValue || path;
    }

    if (typeof current !== 'string') {
      current = String(current);
    }

    // Interpolate variables: {{name}} or {name}
    return current.replace(/\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g, (_, match1, match2) => {
      const varName = match1 || match2;
      return interpolationParams[varName] !== undefined ? interpolationParams[varName] : `{{${varName}}}`;
    });
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    supportedLanguages: SUPPORTED_I18N_LANGUAGES,
    isRtl: false
  }), [language, setLanguage, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export default I18nContext;
