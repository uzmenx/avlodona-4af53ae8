import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'avlodona:cookie-consent:v1';
type ConsentValue = 'accepted' | 'necessary';

const applyConsent = (consent: ConsentValue) => {
  try {
    (window as any).__avlodonaCookieConsent = consent;
    (window as any).__avlodonaAllowAnalytics = consent === 'accepted';
    (window as any).__avlodonaAllowYoutubeCookies = consent === 'accepted';
    (window as any).__avlodonaAllowDailyTracking = consent === 'accepted';
    window.dispatchEvent(new CustomEvent('avlodona:cookie-consent', { detail: { consent } }));
  } catch {
    // ignore
  }
};

export const CookieBanner = () => {
  const [open, setOpen] = useState(false);

  const storedConsent = useMemo(() => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === 'accepted' || value === 'necessary') return value;
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (storedConsent) {
      applyConsent(storedConsent);
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [storedConsent]);

  const acceptAll = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      // Ignore localStorage error
    }
    applyConsent('accepted');
    setOpen(false);
  };

  const necessaryOnly = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'necessary');
    } catch {
      // Ignore localStorage error
    }
    applyConsent('necessary');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[90]">
      <div className="max-w-lg mx-auto rounded-2xl border border-white/10 bg-background/80 backdrop-blur-xl shadow-[0_16px_50px_rgba(0,0,0,0.25)] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
        <p className="text-xs text-white/70 flex-1 leading-relaxed">
          We use cookies. You can accept all cookies, or allow necessary cookies only.
        </p>
        <div className="flex items-center gap-2 justify-end flex-wrap">
          <Link
            to="/privacy-policy#cookies"
            className="text-xs font-semibold text-white/70 hover:text-white underline-offset-4 hover:underline whitespace-nowrap"
          >
            Learn More
          </Link>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={necessaryOnly}>
            Necessary Only
          </Button>
          <Button size="sm" className="rounded-xl" onClick={acceptAll}>
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
};
