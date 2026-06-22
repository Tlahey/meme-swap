import React, { createContext, useContext, useState, useEffect } from 'react';
import { en } from './locales/en';
import { fr } from './locales/fr';

export type Locale = 'en' | 'fr';

const translations = { en, fr };

interface I18nContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

function getNestedValue(obj: any, path: string): string {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return path; // Fallback to path key itself
    }
  }
  return typeof current === 'string' ? current : path;
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('meme-swap-locale') as Locale;
      if (saved === 'en' || saved === 'fr') {
        setLocaleState(saved);
      } else {
        const browserLang = navigator.language.split('-')[0];
        if (browserLang === 'fr') {
          setLocaleState('fr');
        }
      }
      setIsMounted(true);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('meme-swap-locale', newLocale);
    }
  };

  const t = (key: string): string => {
    const dict = translations[locale] || en;
    return getNestedValue(dict, key);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
