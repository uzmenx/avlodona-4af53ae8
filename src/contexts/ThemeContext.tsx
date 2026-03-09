import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type BackgroundTheme = 'none' | 'aurora' | 'sunset' | 'ocean';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  bgTheme: BackgroundTheme;
  setBgTheme: (bg: BackgroundTheme) => void;
  setOverride: (override: { mode?: ThemeMode; bgTheme?: BackgroundTheme } | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useLocalStorage<ThemeMode>('theme-mode', 'dark');
  const [bgTheme, setBgTheme] = useLocalStorage<BackgroundTheme>('bg-theme', 'none');
  const [override, setOverride] = useState<{ mode?: ThemeMode; bgTheme?: BackgroundTheme } | null>(null);

  const effectiveMode = override?.mode ?? mode;
  const effectiveBgTheme = override?.bgTheme ?? bgTheme;

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (effectiveMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      applyTheme(effectiveMode === 'dark');
    }
  }, [effectiveMode]);

  return (
    <ThemeContext.Provider
      value={useMemo(
        () => ({
          mode: effectiveMode,
          setMode,
          bgTheme: effectiveBgTheme,
          setBgTheme,
          setOverride,
        }),
        [effectiveBgTheme, effectiveMode, setBgTheme, setMode]
      )}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
