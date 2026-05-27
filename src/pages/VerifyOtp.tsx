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
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 via-background to-accent/20 p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Button 
            variant="ghost" 
            size="icon"
            className="absolute left-4 top-4"
            onClick={() => navigate('/auth')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Kodni kiriting</CardTitle>
          <CardDescription>
            {email} ga yuborilgan 6 xonali kodni kiriting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => setOtp(value)}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button 
            className="w-full" 
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
            <p className="text-sm text-muted-foreground">
              Kod kelmadimi?{' '}
              {resendTimer > 0 ? (
                <span>{resendTimer} soniyadan keyin qayta yuborish mumkin</span>
              ) : (
                <Button 
                  variant="link" 
                  className="p-0 h-auto"
                  onClick={handleResendOTP}
                >
                  Qayta yuborish
                </Button>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <LegalFooter className="mt-6" />
    </div>
  );
};

export default VerifyOtp;
