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
      <DialogContent className="w-[90vw] max-w-md bg-card/95 backdrop-blur-xl border-border/50 rounded-3xl !z-[250]">
        <DialogHeader className="text-center pb-2">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent inline-flex items-center justify-center gap-2">
            <Zap className="h-6 w-6 text-purple-500 fill-current" /> Avlodona Pro
          </DialogTitle>
          <DialogDescription className="text-center font-medium mt-2">
            Yuqori imkoniyatlar bilan yanada ko'proq foydalaning!
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="rounded-2xl border border-border/40 bg-muted/30 p-4 text-center">
            <h3 className="font-semibold text-muted-foreground mb-1 text-sm">Free Plan</h3>
            <p className="text-xl font-bold mb-4">$0 <span className="text-xs font-normal text-muted-foreground">/oy</span></p>
            <ul className="text-[11px] text-left space-y-2 text-muted-foreground">
              <li className="flex gap-1.5"><Check className="h-3 w-3 shrink-0" /> 50 AI xabari/kun</li>
              <li className="flex gap-1.5"><Check className="h-3 w-3 shrink-0" /> Har 15 soatda 1 ta rasm</li>
              <li className="flex gap-1.5"><Check className="h-3 w-3 shrink-0" /> 200 MB tezkor xotira</li>
              <li className="flex gap-1.5"><Check className="h-3 w-3 shrink-0" /> 10 daqiqalik qo'ng'iroq</li>
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-purple-500/50 bg-purple-500/5 p-4 text-center relative overflow-hidden shadow-lg shadow-purple-500/5">
            <div className="absolute -top-3 -right-3 h-[80px] w-[80px] bg-purple-500/20 rounded-full blur-2xl" />
            <h3 className="font-semibold text-purple-600 mb-1 flex justify-center items-center gap-1 text-sm">
              Pro Plan <Star className="h-3 w-3 fill-current" />
            </h3>
            <p className="text-xl font-bold mb-4 bg-gradient-to-br from-indigo-500 to-purple-500 bg-clip-text text-transparent">
              $2.99 <span className="text-xs font-normal text-muted-foreground">/oy</span>
            </p>
            <ul className="text-[11px] text-left space-y-2 font-medium">
              <li className="flex gap-1.5"><Check className="h-3 w-3 text-purple-500 shrink-0" /> 500 AI xabari/kun</li>
              <li className="flex gap-1.5"><Check className="h-3 w-3 text-purple-500 shrink-0" /> 20 ta rasm / kun</li>
              <li className="flex gap-1.5"><Check className="h-3 w-3 text-purple-500 shrink-0" /> 2 GB tezkor xotira</li>
              <li className="flex gap-1.5"><Check className="h-3 w-3 text-purple-500 shrink-0" /> 60 daqiqalik qo'ng'iroq</li>
            </ul>
          </div>
        </div>

        <Button 
          disabled={loading || isPro} 
          onClick={handleUpgrade}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-xl shadow-purple-500/25 transition-all active:scale-[0.98] font-semibold text-base"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPro ? (
            "Sizda allaqachon Pro reja!"
          ) : (
            "Pro rejaga o'tish"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
