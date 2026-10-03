import { useEffect, useState, type ReactNode } from 'react';
import { THEME_KEY, ThemeContext, type ResolvedTheme, type ThemePreference } from './theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
// Culoarea barei browserului pe telefon, pe fiecare tema
const BAR_COLOR: Record<ResolvedTheme, string> = { light: '#2563eb', dark: '#0b1120' };

function storedPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

// Tema se aplica pe <html data-theme="...">; index.css remapeaza culorile pentru "dark".
// Scriptul din index.html face acelasi lucru inainte de React, ca pagina sa nu clipeasca alb.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(storedPreference);
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);
  const resolved: ResolvedTheme = preference === 'system' ? system : preference;

  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY);
    if (!mq) return;
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[resolved]);
  }, [resolved]);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    try {
      if (p === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, p);
    } catch {
      /* stocare indisponibila: tema ramane doar pentru sesiunea curenta */
    }
  };

  return <ThemeContext.Provider value={{ preference, resolved, setPreference }}>{children}</ThemeContext.Provider>;
}
