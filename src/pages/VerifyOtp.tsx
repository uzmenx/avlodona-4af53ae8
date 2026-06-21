import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Users, ArrowLeft, Loader2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { LegalFooter } from '@/components/legal/LegalFooter';

const VerifyOtp = () => {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const email = location.state?.email;
  const password = location.state?.password;
  const username = location.state?.username;
  const gender = location.state?.gender;

  useEffect(() => {
    if (!email || !password) {
      navigate('/auth');
      return;
    }
  }, [email, password, navigate]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;
    
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('verify-otp', {
        body: { email, otp, password, username, gender }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (data.access_token && data.refresh_token) {
        // Set the session
        const { error } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        });

        if (error) throw error;

        toast({ 
          title: "Muvaffaqiyatli!", 
          description: "Tizimga kirdingiz" 
        });
        
        navigate('/');
      } else {
        throw new Error("Authentication failed");
      }
    } catch (error: any) {
      toast({ 
        title: "Xato", 
        description: error.message || "Kod noto'g'ri", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      const response = await supabase.functions.invoke('send-otp', {
        body: { email }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setResendTimer(60);
      toast({ 
        title: "Kod qayta yuborildi!", 
        description: "Email pochtangizni tekshiring" 
      });
    } catch (error: any) {
      toast({ 
        title: "Xato", 
        description: error.message || "Kod yuborishda xato", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-between items-center relative overflow-hidden bg-gradient-to-br from-[#0a0a1a] via-[#1a1a3e] to-[#0a0a1a] px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-4 sm:pb-6">
      {/* Animated Bokeh Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-32 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute bottom-32 left-40 w-56 h-56 bg-green-500/20 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md my-auto py-2">
        {/* Glass Card */}
        <div className="w-full backdrop-blur-xl bg-white/8 border border-white/20 rounded-3xl shadow-2xl p-4 sm:p-5 space-y-4 relative">
          
          <Button 
            variant="ghost" 
            size="icon"
            className="absolute left-4 top-4 text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
            onClick={() => navigate('/auth')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="text-center pt-6 mb-2 flex flex-col items-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
              <Users className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 leading-tight px-2">Kodni kiriting</h1>
            <p className="text-white/70 text-xs sm:text-sm leading-relaxed max-w-[280px] mx-auto">
              {email} ga yuborilgan 6 xonali kodni kiriting
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value)}
                containerClassName="gap-2"
              >
                <InputOTPGroup className="gap-1.5 sm:gap-2">
                  <InputOTPSlot index={0} className="w-10 h-10 sm:w-12 sm:h-12 border bg-white/8 border-white/15 text-white text-lg font-bold rounded-xl first:rounded-xl last:rounded-xl" />
                  <InputOTPSlot index={1} className="w-10 h-10 sm:w-12 sm:h-12 border bg-white/8 border-white/15 text-white text-lg font-bold rounded-xl first:rounded-xl last:rounded-xl" />
                  <InputOTPSlot index={2} className="w-10 h-10 sm:w-12 sm:h-12 border bg-white/8 border-white/15 text-white text-lg font-bold rounded-xl first:rounded-xl last:rounded-xl" />
                  <InputOTPSlot index={3} className="w-10 h-10 sm:w-12 sm:h-12 border bg-white/8 border-white/15 text-white text-lg font-bold rounded-xl first:rounded-xl last:rounded-xl" />
                  <InputOTPSlot index={4} className="w-10 h-10 sm:w-12 sm:h-12 border bg-white/8 border-white/15 text-white text-lg font-bold rounded-xl first:rounded-xl last:rounded-xl" />
                  <InputOTPSlot index={5} className="w-10 h-10 sm:w-12 sm:h-12 border bg-white/8 border-white/15 text-white text-lg font-bold rounded-xl first:rounded-xl last:rounded-xl" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button 
              className="w-full h-10 rounded-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white font-bold text-sm transition-all duration-300 transform hover:scale-105 shadow-lg shadow-[rgba(34,197,94,0.4)] tracking-[0.04em]"
              onClick={handleVerifyOTP}
              disabled={otp.length !== 6 || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Tekshirilmoqda...
                </>
              ) : (
                "Tasdiqlash"
              )}
            </Button>

            <div className="text-center">
              <p className="text-xs sm:text-sm text-white/60">
                Kod kelmadimi?{' '}
                {resendTimer > 0 ? (
                  <span className="text-white/80 font-medium">{resendTimer} soniyadan keyin qayta yuborish mumkin</span>
                ) : (
                  <button 
                    className="text-[#22c55e] font-bold hover:text-[#16a34a] transition-colors bg-transparent border-none p-0 cursor-pointer"
                    onClick={handleResendOTP}
                  >
                    Qayta yuborish
                  </button>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Anchored Footer */}
      <div className="relative z-10 w-full mt-2">
        <LegalFooter />
      </div>
    </div>
  );
};

export default VerifyOtp;
