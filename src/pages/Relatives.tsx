import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { FamilyTreeV2 } from '@/components/family-v2';

const Relatives = () => {
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
    <AppLayout>
      <div className="w-full relative h-screen overflow-hidden">
        <FamilyTreeV2 />
      </div>
    </AppLayout>
  );
};

export default Relatives;
