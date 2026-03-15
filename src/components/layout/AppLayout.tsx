import { ReactNode, useEffect, useState } from 'react';
import { BottomNav } from './BottomNav';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { onPublishProgress } from '@/lib/backgroundPublish';
import { Cloud } from 'lucide-react';
import { LegalFooter } from '@/components/legal/LegalFooter';
import { toast } from 'sonner';

interface AppLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

const bgClassMap: Record<string, string> = {
  none: '',
  aurora: 'bg-aurora',
  sunset: 'bg-sunset',
  ocean: 'bg-ocean',
};

export const AppLayout = ({ children, showNav = true }: AppLayoutProps) => {
  const { bgTheme } = useTheme();
  const bgClass = bgClassMap[bgTheme] || '';
  const [forceHideNav, setForceHideNav] = useState(false);
  const [globalUploadProgress, setGlobalUploadProgress] = useState<number | null>(null);

  const CloudIndicator = ({ progress }: { progress: number }) => {
    const pct = Math.max(0, Math.min(100, Math.round(progress)));
    return (
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[80] pointer-events-none"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/40 bg-background/75 backdrop-blur-md shadow-sm">
          <div className="relative h-5 w-5">
            <Cloud className="h-5 w-5 text-muted-foreground/40" />
            <svg
              viewBox="0 0 24 24"
              className="absolute inset-0 h-5 w-5"
              fill="none"
            >
              <path
                d="M20 17.58A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 4 16.25"
                className="cloud-dash"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="10 22"
              />
            </svg>
          </div>
          <span className="text-[11px] font-semibold text-foreground/80 tabular-nums">{pct}%</span>
          <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <style>{`
          @keyframes cloudDash {
            0% { stroke-dashoffset: 0; opacity: .35; }
            50% { opacity: 1; }
            100% { stroke-dashoffset: -64; opacity: .35; }
          }
          .cloud-dash { animation: cloudDash 1.4s linear infinite; }
        `}</style>
      </div>
    );
  };


  const [transparentBars, setTransparentBars] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ transparent?: boolean } | undefined>;
      setTransparentBars(!!ce.detail?.transparent);
    };
    window.addEventListener('app:transparentBars', handler);
    return () => window.removeEventListener('app:transparentBars', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ hide?: boolean } | undefined>;
      setForceHideNav(!!ce.detail?.hide);
    };
    window.addEventListener('app:forceHideNav', handler);
    return () => window.removeEventListener('app:forceHideNav', handler);
  }, []);

  useEffect(() => {
    return onPublishProgress((evt) => {
      if (evt.status === 'uploading') {
        setGlobalUploadProgress(evt.progress);
        return;
      }
      // success / error -> hide bar
      setGlobalUploadProgress(null);

      if (evt.status === 'error') {
        toast.error(evt.message || "Yuklashda xatolik yuz berdi");
      }
    });
  }, []);

  const effectiveShowNav = showNav && !forceHideNav;

  return (
    <div className={cn('min-h-screen relative w-full')}>
      <div
        className={cn(
          'fixed inset-0 z-0 pointer-events-none transition-colors duration-500',
          transparentBars ? 'bg-transparent' : (bgClass || 'bg-background')
        )}
      />
      {globalUploadProgress !== null && globalUploadProgress > 0 && globalUploadProgress < 100 && (
        <CloudIndicator progress={globalUploadProgress} />
      )}
      <div
        className={cn(
          'fixed top-0 left-0 right-0 z-[20] pointer-events-none h-[env(safe-area-inset-top,0px)] transition-colors duration-500',
          transparentBars ? 'bg-transparent' : (bgClass || 'bg-background')
        )}
      />
      <main
        className={cn(
          effectiveShowNav ? 'pb-20' : '',
          'relative z-10 pt-[env(safe-area-inset-top,0px)]'
        )}
      >
        {children}
      </main>
      {effectiveShowNav && <BottomNav />}
    </div>
  );
};
