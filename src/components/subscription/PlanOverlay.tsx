import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Zap, Star, Loader2, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const FeatureRow = ({ title, free, pro, isLast }: { title: string; free: string | React.ReactNode; pro: string | React.ReactNode; isLast?: boolean }) => (
  <div className={cn("grid grid-cols-[1fr_80px_100px] items-center text-sm transition-colors hover:bg-muted/30", !isLast && "border-b border-border/40")}>
    <div className="p-3 pl-4 font-semibold text-foreground text-xs sm:text-sm leading-tight flex items-center gap-1.5">
      <Check className="h-3 w-3 text-muted-foreground/40 shrink-0 hidden sm:block" />
      {title}
    </div>
    <div className="p-3 text-center text-muted-foreground font-medium text-xs">{free}</div>
    <div className="p-3 text-center text-purple-600 dark:text-purple-400 font-bold bg-purple-500/5 text-xs sm:text-sm">{pro}</div>
  </div>
);

export const PlanOverlay = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('show-plan-overlay', handleOpen);
    return () => window.removeEventListener('show-plan-overlay', handleOpen);
  }, []);

  const handleUpgrade = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          returnUrl: window.location.origin
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Xatolik yuz berdi');

      if (json.url) {
        window.location.href = json.url;
      }
    } catch (e: any) {
      toast.error(e.message || 'To\'lov tizimiga ulanishda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  const isPro = profile?.subscription_tier === 'pro';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[95vw] max-w-md max-h-[92vh] overflow-y-auto bg-card/95 backdrop-blur-2xl border-border/40 rounded-[28px] sm:rounded-[32px] !z-[250] p-4 sm:p-6 shadow-2xl [&>button[aria-label='Close']]:bg-muted/50 [&>button[aria-label='Close']]:rounded-full [&>button[aria-label='Close']]:h-8 [&>button[aria-label='Close']]:w-8 [&>button[aria-label='Close']]:top-3 sm:[&>button[aria-label='Close']]:top-4 [&>button[aria-label='Close']]:right-3 sm:[&>button[aria-label='Close']]:right-4">
        
        <DialogHeader className="text-center pb-1 pt-1 sm:pb-2 sm:pt-2 relative">
          {/* Glowing background blob */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-500/20 blur-[60px] rounded-full pointer-events-none" />
          
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 to-purple-500 p-[2px] rounded-xl sm:rounded-2xl mb-2 sm:mb-4 shadow-xl shadow-purple-500/20 transform rotate-3 relative group cursor-default">
            <div className="absolute inset-0 bg-white/20 blur-md rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-full h-full bg-card rounded-[10px] sm:rounded-[14px] flex items-center justify-center -rotate-3 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
              <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-transparent fill-[url(#zap-gradient)] relative z-10 drop-shadow-md" />
              <svg width="0" height="0" className="absolute">
                <linearGradient id="zap-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop stopColor="#6366f1" offset="0%" />
                  <stop stopColor="#a855f7" offset="100%" />
                </linearGradient>
              </svg>
            </div>
          </div>

          <DialogTitle className="text-2xl sm:text-3xl font-black tracking-tight mb-1 sm:mb-2">
            Avlodona <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent drop-shadow-sm">Pro</span>
          </DialogTitle>
          <DialogDescription className="text-center text-xs sm:text-sm font-medium text-muted-foreground/80 px-1 sm:px-2">
            Cheklovlarni olib tashlang. Yuqori imkoniyatlardan to'liq va erkin foydalaning!
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 mb-4 sm:mt-4 sm:mb-6 rounded-2xl sm:rounded-3xl bg-background/50 border border-border/50 overflow-hidden shadow-inner ring-1 ring-white/5">
          {/* Header Row */}
          <div className="grid grid-cols-[1fr_70px_85px] sm:grid-cols-[1fr_80px_100px] border-b border-border/40 bg-muted/20 items-center">
            <div className="p-2 sm:p-3 pl-3 sm:pl-4 text-[9px] sm:text-[10px] font-bold text-muted-foreground tracking-widest uppercase">Imkoniyat</div>
            <div className="p-2 sm:p-3 text-center text-[9px] sm:text-[10px] font-bold text-muted-foreground tracking-widest uppercase">Bepul</div>
            <div className="p-2 sm:p-3 text-center text-[9px] sm:text-[10px] font-black text-purple-600 dark:text-purple-400 tracking-widest uppercase bg-purple-500/10 border-b-2 border-purple-500 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10" />
              <span className="relative z-10 flex items-center justify-center gap-0.5 sm:gap-1">
                PRO <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-current text-yellow-500/80 drop-shadow-sm" />
              </span>
            </div>
          </div>

          {/* Feature Rows */}
          <FeatureRow title="AI Xabarlari" free="50 / kun" pro="500 / kun" />
          <FeatureRow title="AI Rasm" free="1 / 15 s" pro="20 / kun" />
          <FeatureRow title="Post xotirasi" free="200 MB" pro="2 GB" />
          <FeatureRow title="Video qo'ng'iroq" free="10 daq" pro="60 daq" isLast />

          {/* Pricing Row */}
          <div className="grid grid-cols-[1fr_90px] sm:grid-cols-[1fr_100px] border-t-2 border-purple-500/20 bg-purple-500/5 items-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 pointer-events-none" />
            <div className="p-3 sm:p-4 pl-3 sm:pl-4 relative z-10 flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 p-[1px] shadow-md shadow-purple-500/20">
                <div className="h-full w-full rounded-full bg-card flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                </div>
              </div>
              <div>
                <p className="font-bold text-xs sm:text-sm text-foreground leading-tight">Pro Obuna</p>
                <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground mt-0.5">Avtomatik yangilanadi</p>
              </div>
            </div>
            <div className="p-3 sm:p-4 relative z-10 text-center border-l border-purple-500/10 bg-purple-500/5">
              <p className="text-base sm:text-lg font-black bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent leading-none mb-0.5 sm:mb-1 drop-shadow-sm">
                29.9K
              </p>
              <p className="text-[8px] sm:text-[9px] font-bold text-muted-foreground tracking-wider uppercase">so'm/oy</p>
            </div>
          </div>
        </div>

        {/* Action Button wrapped in div to avoid DialogContent generic button styling bugs */}
        <div className="w-full relative z-20">
          <Button 
            disabled={loading || isPro} 
            onClick={handleUpgrade}
            className="relative w-full h-11 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-xl shadow-purple-500/25 transition-all active:scale-[0.98] overflow-hidden group border-0"
          >
            {/* Premium Metallic Shimmer animation */}
            {!loading && !isPro && (
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
            )}
            
            <div className="relative flex items-center justify-center gap-1.5 sm:gap-2 font-bold text-sm sm:text-base tracking-wide z-10">
              {loading ? (
                <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
              ) : isPro ? (
                "Sizda allaqachon Pro tarif! 🎉"
              ) : (
                <>
                  Tez kunda Pro ta'rif <Zap className="h-4.5 w-4.5 sm:h-5 sm:w-5 fill-current text-yellow-300 drop-shadow-md" />
                </>
              )}
            </div>
          </Button>
          
          <p className="text-center text-[9px] sm:text-[10px] text-muted-foreground/60 mt-2 sm:mt-3 font-medium px-4">
            To'lov Stripe orqali xavfsiz amalga oshiriladi.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
