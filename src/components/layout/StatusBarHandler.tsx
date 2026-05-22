import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { Capacitor } from '@capacitor/core';

export const StatusBarHandler = () => {
  const { mode } = useTheme();

  useEffect(() => {
    const initStatusBar = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
      } catch (e) {
        console.error('Failed to configure status bar', e);
      }
    };

    void initStatusBar();
  }, [mode]);

  return null;
};
