import type { AppSettings } from '../db/types';

export type ThemeSetting = AppSettings['theme'];

export function applyTheme(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  // only daylight supported - ensure class present
  root.classList.add('theme-daylight');
  body.classList.add('theme-daylight');
  // apply background from CSS variable if present
  try {
    const cs = getComputedStyle(root);
    const bg = cs.getPropertyValue('--bg-page') || '';
    if (bg) body.style.background = bg.trim();
  } catch (e) {}
}

export function watchAutoTheme(): () => void {
  return () => undefined;
}

