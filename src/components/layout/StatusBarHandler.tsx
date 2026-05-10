import { useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { Capacitor } from '@capacitor/core';

export const StatusBarHandler = () => {
  const { theme } = useTheme();

  useEffect(() => {
    const initStatusBar = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        
        // Set style based on theme
        // If theme is dark, status bar text should be light (Style.Dark)
        // If theme is light, status bar text should be dark (Style.Light)
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
      } catch (e) {
        console.error('Failed to configure status bar', e);
      }
    };

    void initStatusBar();
  }, [theme]);

  return null;
};
