import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Phone, ArrowLeft, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LegalFooter } from '@/components/legal/LegalFooter';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type Step = 'phone' | 'otp';

const PhoneAuth = () => {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const formatPhoneDisplay = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
    setPhone(value);
  };

  const handleSendOTP = async () => {
    if (phone.length < 9) {
      toast({
        title: "Xato",
        description: "Telefon raqamni to'liq kiriting",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-phone-otp', {
        body: { phone: `998${phone}` }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Muvaffaqiyatli!",
        description: "Tasdiqlash kodi yuborildi"
      });
      setStep('otp');
      setResendTimer(60);
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message || "SMS yuborishda xato",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Xato",
        description: "6 xonali kodni kiriting",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
        body: {
          phone: `998${phone}`,
          otp,
          username: username || phone,
          gender
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Set session
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      });

      if (sessionError) throw sessionError;

      toast({
        title: "Muvaffaqiyatli!",
        description: "Tizimga kirdingiz"
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message || "Kodni tekshirishda xato",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    await handleSendOTP();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="p-4">
        <button
          onClick={() => step === 'otp' ? setStep('phone') : navigate(-1)}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-8 pt-8">
        {step === 'phone' ? (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">Telefon raqam</h1>
              <p className="text-muted-foreground">SMS orqali kiring yoki ro'yxatdan o'ting</p>
            </div>

            <div className="space-y-5 flex-1">
              <div className="space-y-2">
                <Label htmlFor="phone" className="sr-only">Telefon</Label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-5 w-5" />
                    <span className="font-medium text-foreground">+998</span>
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="90 123 45 67"
                    value={formatPhoneDisplay(phone)}
                    onChange={handlePhoneChange}
                    className="pl-28 h-14 bg-muted/50 border-0 rounded-xl text-base tracking-wider"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Ism (ixtiyoriy)</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Ismingiz"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-14 bg-muted/50 border-0 rounded-xl text-base"
                />
              </div>

              <div className="space-y-3 py-2">
                <Label className="text-muted-foreground">Jins (ixtiyoriy)</Label>
                <RadioGroup
                  value={gender}
                  onValueChange={(value) => setGender(value as 'male' | 'female')}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="phone-male" className="border-sky-500 text-sky-500" />
                    <Label htmlFor="phone-male" className="cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-sky-500"></div>
                      Erkak
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="phone-female" className="border-pink-500 text-pink-500" />
                    <Label htmlFor="phone-female" className="cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-pink-500"></div>
                      Ayol
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Button
                onClick={handleSendOTP}
                className="w-full h-14 rounded-xl text-base font-semibold"
                disabled={isLoading || phone.length < 9}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Yuborilmoqda...
                  </>
                ) : (
                  "KOD YUBORISH"
                )}
              </Button>

              <p className="text-xs text-muted-foreground leading-relaxed">
                By continuing, you agree to our{' '}
                <Link to="/terms" className="text-foreground/90 hover:text-foreground underline underline-offset-4">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="text-foreground/90 hover:text-foreground underline underline-offset-4">
                  Privacy Policy
                </Link>.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="mb-8 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Tasdiqlash kodi</h1>
              <p className="text-muted-foreground">
                +998 {formatPhoneDisplay(phone)} raqamiga kod yuborildi
              </p>
            </div>

            <div className="space-y-6 flex-1 flex flex-col items-center">
              <InputOTP
                value={otp}
                onChange={setOtp}
                maxLength={6}
                className="gap-3"
              >
                <InputOTPGroup className="gap-3">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="w-12 h-14 text-xl rounded-xl border-2"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <Button
                onClick={handleVerifyOTP}
                className="w-full h-14 rounded-xl text-base font-semibold"
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Tekshirilmoqda...
                  </>
                ) : (
                  "TASDIQLASH"
                )}
              </Button>

              <p className="text-xs text-muted-foreground leading-relaxed text-center">
                By continuing, you agree to our{' '}
                <Link to="/terms" className="text-foreground/90 hover:text-foreground underline underline-offset-4">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy-policy" className="text-foreground/90 hover:text-foreground underline underline-offset-4">
                  Privacy Policy
                </Link>.
              </p>

              <div className="text-center">
                {resendTimer > 0 ? (
                  <span className="text-muted-foreground text-sm">
                    Qayta yuborish: {resendTimer}s
                  </span>
                ) : (
                  <button
                    onClick={handleResendOTP}
                    disabled={isLoading}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    Kodni qayta yuborish
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="py-8 text-center">
          <span className="text-sm text-muted-foreground">
            Email orqali{' '}
            <Link to="/auth" className="text-primary font-semibold hover:underline">
              Kirish
            </Link>
            {' '}yoki{' '}
            <Link to="/signup" className="text-primary font-semibold hover:underline">
              Ro'yxatdan o'tish
            </Link>
          </span>
        </div>

        <LegalFooter className="pb-4" />
      </div>
    </div>
  );
};

export default PhoneAuth;
