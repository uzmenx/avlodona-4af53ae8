import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const ResetPassword = () => {
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleResendOTP = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { email, purpose: 'reset' }
      });
      if (error) {
        let errMsg = error.message;
        if (error.context && typeof error.context.json === 'function') {
          try {
            const errData = await error.context.json();
            if (errData.error) errMsg = errData.error;
          } catch (e) {}
        }
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);

      setResendTimer(60);
      toast({ title: "Muaffaqiyatli", description: "Kod qayta yuborildi" });
    } catch (error: any) {
      toast({ title: t("error") || "Xato", description: error.message || "Xatolik yuz berdi", variant: "destructive" });
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast({ title: t("error") || "Xato", description: "Kodni to'liq kiriting", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: t("error") || "Xato", description: "Parol kamida 6ta belgi bo'lishi kerak", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke("verify-otp", {
        body: { email, otp, password, purpose: "reset" },
      });

      if (response.error) {
        let errMsg = response.error.message;
        if (response.error.context && typeof response.error.context.json === 'function') {
          try {
            const errData = await response.error.context.json();
            if (errData.error) errMsg = errData.error;
          } catch (e) {}
        }
        throw new Error(errMsg);
      }

      const data = response.data;
      if (data?.access_token && data?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (sessionError) throw sessionError;

        toast({ title: "Muaffaqiyatli", description: "Parolingiz muvaffaqiyatli yangilandi!" });
        navigate("/");
      } else {
        if (data?.error) throw new Error(data.error);
        throw new Error("Authentication failed");
      }
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

  if (!email) return null;

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
          onClick={() => navigate('/forgot-password')}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <LangSwitcher glow />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md my-auto pb-8">
        <div className="w-full backdrop-blur-xl bg-white/8 border border-white/20 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Tasdiqlash kodi</h1>
            <p className="text-white/70 text-sm mb-4">
              {email} manziliga yuborilgan 6 xonali kodni va yangi parolni kiriting.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-6">
            <div className="flex justify-center mb-6">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value)}
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot 
                      key={index} 
                      index={index} 
                      className="w-10 h-12 text-lg bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)] rounded-xl text-white focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e] transition-all backdrop-blur-sm"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90 ml-1">Yangi parol</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60 pointer-events-none z-10" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Yangi parolni kiriting"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 pr-12 h-12 bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)] rounded-xl text-white placeholder-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.3)] focus:bg-[rgba(255,255,255,0.12)] transition-all duration-300 backdrop-blur-sm"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors z-10"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white font-bold transition-all duration-300 transform hover:scale-[1.02] shadow-lg shadow-[rgba(34,197,94,0.4)]"
              disabled={isLoading || otp.length !== 6 || password.length < 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Tasdiqlanmoqda...
                </>
              ) : (
                "Tasdiqlash"
              )}
            </Button>
          </form>

          <div className="text-center pt-2">
            <p className="text-sm text-white/60">
              Kod kelmadimi?{' '}
              {resendTimer > 0 ? (
                <span className="text-white/80">{resendTimer} soniyadan so'ng</span>
              ) : (
                <button 
                  onClick={handleResendOTP}
                  className="text-[#22c55e] hover:text-[#16a34a] font-medium transition-colors"
                >
                  Qayta yuborish
                </button>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 w-full mt-2">
        <LegalFooter />
      </div>
    </div>
  );
};

export default ResetPassword;
