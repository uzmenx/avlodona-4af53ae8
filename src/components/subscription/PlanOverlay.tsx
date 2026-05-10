import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Zap, Check, Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
      <DialogContent className="w-[90vw] max-w-md bg-card/95 backdrop-blur-xl border-border/50 rounded-3xl !z-[250] [&>button]:h-11 [&>button]:w-11 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button>svg]:h-5 [&>button>svg]:w-5 [&>button]:top-4 [&>button]:right-4 [&>button]:bg-muted/50 [&>button]:rounded-full">
        <DialogHeader className="text-center pb-2 pt-2">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent inline-flex items-center justify-center gap-2">
            <Zap className="h-6 w-6 text-purple-500 fill-current" /> Avlodona Pro
          </DialogTitle>
          <DialogDescription className="text-center font-medium mt-2">
            Yuqori imkoniyatlar bilan yanada ko'proq foydalaning!
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 max-h-[60vh] overflow-y-auto no-scrollbar">
          {/* Free Plan */}
          <div className="rounded-2xl border border-border/40 bg-muted/30 p-5 text-center flex flex-col justify-center">
            <h3 className="font-bold text-muted-foreground mb-1 text-sm uppercase tracking-wider">Bepul tarif</h3>
            <p className="text-2xl font-bold mb-4 text-foreground">0 <span className="text-sm font-normal text-muted-foreground">so'm /oy</span></p>
            <ul className="text-sm text-left space-y-3 text-muted-foreground font-medium mx-auto max-w-[200px] sm:max-w-full">
              <li className="flex gap-2 items-center"><Check className="h-4 w-4 shrink-0 text-muted-foreground/60" /> 50 AI xabari/kun</li>
              <li className="flex gap-2 items-center"><Check className="h-4 w-4 shrink-0 text-muted-foreground/60" /> Har 15 soatda 1 rasm</li>
              <li className="flex gap-2 items-center"><Check className="h-4 w-4 shrink-0 text-muted-foreground/60" /> 200 MB xotira</li>
              <li className="flex gap-2 items-center"><Check className="h-4 w-4 shrink-0 text-muted-foreground/60" /> 10 daqiqalik aloqa</li>
            </ul>
          </div>
          
          {/* Pro Plan */}
          <div className="rounded-2xl border-2 border-purple-500/50 bg-purple-500/5 p-5 text-center relative overflow-hidden shadow-lg shadow-purple-500/10 flex flex-col justify-center">
            <div className="absolute -top-3 -right-3 h-[100px] w-[100px] bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-3 -left-3 h-[80px] w-[80px] bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <h3 className="font-bold text-purple-600 mb-1 flex justify-center items-center gap-1.5 text-sm uppercase tracking-wider relative z-10">
              Pro tarif <Star className="h-4 w-4 fill-current text-yellow-400" />
            </h3>
            <p className="text-2xl font-bold mb-1 bg-gradient-to-br from-indigo-500 to-purple-500 bg-clip-text text-transparent relative z-10">
              29 900 <span className="text-sm font-normal text-muted-foreground">so'm /oy</span>
            </p>
            <p className="text-[10px] text-muted-foreground mb-4 relative z-10">(~$2.99)</p>
            
            <ul className="text-sm text-left space-y-3 font-semibold text-foreground relative z-10 mx-auto max-w-[200px] sm:max-w-full">
              <li className="flex gap-2 items-center"><Check className="h-4 w-4 text-purple-500 shrink-0" /> 500 AI xabari/kun</li>
              <li className="flex gap-2 items-center"><Check className="h-4 w-4 text-purple-500 shrink-0" /> 20 ta rasm /kun</li>
              <li className="flex gap-2 items-center"><Check className="h-4 w-4 text-purple-500 shrink-0" /> 2 GB xotira</li>
              <li className="flex gap-2 items-center"><Check className="h-4 w-4 text-purple-500 shrink-0" /> 60 daqiqalik aloqa</li>
            </ul>
          </div>
        </div>

        <Button 
          disabled={loading || isPro} 
          onClick={handleUpgrade}
          className="relative w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-xl shadow-purple-500/30 transition-all active:scale-[0.98] overflow-hidden group border-0"
        >
          {/* Shimmer animation */}
          {!loading && !isPro && (
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12" />
          )}
          
          <div className="relative flex items-center justify-center gap-2 font-bold text-lg tracking-wide z-10">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isPro ? (
              "Sizda allaqachon Pro tarif!"
            ) : (
              <>
                Pro tarifga o'tish
              </>
            )}
          </div>
        </Button>
      </DialogContent>
    </Dialog>
  );
};
