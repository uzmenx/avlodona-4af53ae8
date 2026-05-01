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

/** Update theme-color meta tag and Capacitor StatusBar (if available) */
const applyStatusBar = async (isDark: boolean) => {
  // 1. PWA meta tag
  const color = isDark ? '#000000' : '#ffffff';
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;

  // 2. Capacitor native StatusBar (Android / iOS)
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    
    // Set icon style (white or black icons)
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    
    // CRITICAL: Make status bar transparent and overlay the webview
    // This allows the app background to stretch to the very top
    await StatusBar.setOverlaysWebView({ overlay: true });
    
    // On some Android versions, we might still need to set color to transparent explicitly
    // Note: Use a very light alpha if pure transparent is ignored by the OS
    try {
      await StatusBar.setBackgroundColor({ color: '#00000000' }); // Hex with 00 alpha
    } catch {
      // BackgroundColor might fail if overlay is active on some platforms, ignore
    }
  } catch {
    // Web or plugin not available — ignore silently
  }
};

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
      void applyStatusBar(isDark);
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
