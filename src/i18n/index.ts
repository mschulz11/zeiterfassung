import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './de.json';
import en from './en.json';

const stored = (typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null) as
  | 'de'
  | 'en'
  | null;

void i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
  },
  lng: stored ?? 'de',
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: 'de' | 'en'): void {
  void i18n.changeLanguage(lang);
  if (typeof localStorage !== 'undefined') localStorage.setItem('lang', lang);
}

export default i18n;
