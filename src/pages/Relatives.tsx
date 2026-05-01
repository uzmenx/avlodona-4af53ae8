import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { FamilyTreeV2 } from '@/components/family-v2';

const Relatives = () => {
  const [hideBars, setHideBars] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ transparent?: boolean } | undefined>;
      setHideBars(!!ce.detail?.transparent);
    };
    window.addEventListener('app:transparentBars', handler);
    return () => window.removeEventListener('app:transparentBars', handler);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyHeight = body.style.height;

    html.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.height = '100%';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.height = prevHtmlHeight;
      body.style.overflow = prevBodyOverflow;
      body.style.height = prevBodyHeight;
    };
  }, []);

  return (
    <AppLayout showSafeAreaPadding={false}>
      <div className="w-full relative h-[100dvh] overflow-hidden bg-background">
        {!hideBars && (
          <div
            className="absolute top-0 left-0 right-0 h-[100px] pointer-events-none z-10 bg-gradient-to-b from-sky-200/70 via-sky-200/30 to-transparent dark:from-slate-950/85 dark:via-slate-950/35 backdrop-blur-md"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          />
        )}

        <FamilyTreeV2 />

        {!hideBars && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[100px] pointer-events-none z-10 bg-gradient-to-t from-sky-200/70 via-sky-200/30 to-transparent dark:from-slate-950/85 dark:via-slate-950/35 backdrop-blur-md"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Relatives;
