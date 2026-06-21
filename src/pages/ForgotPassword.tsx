import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { LegalFooter } from "@/components/legal/LegalFooter";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: t("error") || "Xato", description: "Email yoki username kiriting", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      let targetEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
        const { data: resolved, error: resolveErr } = await supabase.functions.invoke("resolve-identifier", {
          body: { identifier: targetEmail },
        });
        if (resolveErr || resolved?.error || !resolved?.email) {
          throw new Error(resolved?.error || "Bunday foydalanuvchi topilmadi");
        }
        targetEmail = resolved.email;
      }

      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email: targetEmail, purpose: "reset" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Muaffaqiyatli", description: "Tasdiqlash kodi yuborildi" });
      navigate("/reset-password", { state: { email: targetEmail } });
    } catch (error: any) {
      toast({ 
        title: t("error") || "Xato", 
        description: error.message || "Xatolik yuz berdi", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-[100dvh] flex flex-col justify-between items-center relative overflow-hidden bg-gradient-to-br from-[#0a0a1a] via-[#1a1a3e] to-[#0a0a1a] px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-4 sm:pb-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-32 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute bottom-32 left-40 w-56 h-56 bg-green-500/20 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      <div className="relative z-10 w-full flex justify-between items-center max-w-md mx-auto mb-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/auth')}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <LangSwitcher glow />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md my-auto pb-8">
        <div className="w-full backdrop-blur-xl bg-white/8 border border-white/20 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Parolni tiklash</h1>
            <p className="text-white/70 text-sm">
              Akkauntingizga ulangan email manzilini kiriting. Biz sizga tasdiqlash kodini yuboramiz.
            </p>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90 ml-1">Email</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('email') || "Emailingizni kiriting"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-12 bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)] rounded-xl text-white placeholder-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.3)] focus:bg-[rgba(255,255,255,0.12)] transition-all duration-300 backdrop-blur-sm"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white font-bold transition-all duration-300 transform hover:scale-[1.02] shadow-lg shadow-[rgba(34,197,94,0.4)]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Yuborilmoqda...
                </>
              ) : (
                "Kodni yuborish"
              )}
            </Button>
          </form>
        </div>
      </div>

      <div className="relative z-10 w-full mt-2">
        <LegalFooter />
      </div>
    </div>
  );
};

export default ForgotPassword;
