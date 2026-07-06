import type { AppSettings } from '../db/types';

export type ThemeSetting = AppSettings['theme'];

function prefersDark(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(theme: ThemeSetting): 'light' | 'dark' {
  if (theme === 'auto') return prefersDark() ? 'dark' : 'light';
  return theme;
}

export function applyTheme(theme: ThemeSetting): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark');
}

export function watchAutoTheme(theme: ThemeSetting, onChange: () => void): () => void {
  if (typeof window === 'undefined' || theme !== 'auto') return () => undefined;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
