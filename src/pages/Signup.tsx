import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { ensureUniqueUsername, generateBaseUsername } from "@/utils/usernameUtils";
import { signInWithGoogle } from "@/lib/googleSignIn";

const Signup = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: t("error"), description: t("fillAllFields"), variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: t("error"), description: t("passMinLength"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const baseUser = generateBaseUsername(email);
      const uniqueUsername = await ensureUniqueUsername(supabase, baseUser);

      // Send OTP code to email; account is created after verification
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: t("success"), description: "Tasdiqlash kodi emailingizga yuborildi" });
      navigate("/verify-otp", {
        state: {
          email,
          password,
          username: uniqueUsername,
          gender: gender || null,
          name: fullName.trim() || null,
        },
      });
    } catch (err: unknown) {
      const error = err as any;
      toast({ title: t("error"), description: error?.message || t("signupError"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result.redirected) {
        toast({ title: t("success"), description: "Ro'yxatdan o'tdingiz!" });
        navigate("/");
      }
    } catch (error: unknown) {
      toast({ title: t("error"), description: (error as Error).message || t("googleError"), variant: "destructive" });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div
      style={{ height: '100%', minHeight: '-webkit-fill-available' }}
      className="flex flex-col justify-between items-center relative overflow-hidden bg-gradient-to-br from-[#0a0a1a] via-[#1a1a3e] to-[#0a0a1a] px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-4 sm:pb-6"
    >
      {/* Static Bokeh Background — no animate-pulse to avoid re-layout on focus */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-20 left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" style={{ willChange: 'auto' }} />
        <div className="absolute top-40 right-32 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl" style={{ willChange: 'auto' }} />
        <div className="absolute bottom-32 left-40 w-56 h-56 bg-green-500/20 rounded-full blur-3xl" style={{ willChange: 'auto' }} />
        <div className="absolute top-60 left-1/2 w-40 h-40 bg-purple-400/15 rounded-full blur-2xl" style={{ willChange: 'auto' }} />
        <div className="absolute bottom-20 right-20 w-52 h-52 bg-teal-400/15 rounded-full blur-2xl" style={{ willChange: 'auto' }} />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md my-auto py-2">
        {/* Glass Card */}
        <div className="w-full backdrop-blur-xl bg-white/8 border border-white/20 rounded-3xl shadow-2xl p-4 sm:p-5 space-y-3 relative">
          
          {/* Top Controls inside card */}
          <div className="absolute top-4 right-4 z-20">
            <LangSwitcher glow />
          </div>

          <div className="text-center pt-6 mb-2 flex flex-col items-center">
            <img 
              src="/app-logo.png" 
              alt="Avlodona Logo" 
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain mb-2 rounded-2xl" 
            />
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 leading-tight px-2">{t('landingH1')}</h1>
            <p className="text-white/70 text-xs sm:text-sm leading-relaxed max-w-[280px] mx-auto">{t('landingTagline')}</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-2.5">
            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60 z-10 pointer-events-none" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder={t('nameOptional')}
                  value={fullName}
                  maxLength={25}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  className="pl-12 h-10 bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)] rounded-xl text-white placeholder-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.3)] focus:bg-[rgba(255,255,255,0.12)] transition-all duration-300 backdrop-blur-sm text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="sr-only">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60 z-10 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="pl-12 h-10 bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)] rounded-xl text-white placeholder-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.3)] focus:bg-[rgba(255,255,255,0.12)] transition-all duration-300 backdrop-blur-sm text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="sr-only">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60 z-10 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="•••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pl-12 pr-12 h-10 bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)] rounded-xl text-white placeholder-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.3)] focus:bg-[rgba(255,255,255,0.12)] transition-all duration-300 backdrop-blur-sm text-sm"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)] transition-colors z-10"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Gender Toggle */}
            <div className="py-0.5 text-center">
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setGender("male")}
                  className={`h-7 px-3.5 rounded-full border transition-all duration-200 ease-in-out text-xs font-medium ${
                    gender === "male"
                      ? "bg-[rgba(59,130,246,0.25)] border-[#3b82f6] text-white font-semibold"
                      : "bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.5)]"
                  }`}
                >
                  {t('male')}
                </button>
                <button
                  type="button"
                  onClick={() => setGender("female")}
                  className={`h-7 px-3.5 rounded-full border transition-all duration-200 ease-in-out text-xs font-medium ${
                    gender === "female"
                      ? "bg-[rgba(236,72,153,0.25)] border-[#ec4899] text-white font-semibold"
                      : "bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.5)]"
                  }`}
                >
                  {t('female')}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 rounded-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white font-bold text-sm transition-all duration-300 transform hover:scale-105 shadow-lg shadow-[rgba(34,197,94,0.4)] tracking-[0.04em]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('signingUp')}
                </>
              ) : (
                t('signup')
              )}
            </Button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[rgba(255,255,255,0.15)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-transparent px-3 text-[rgba(255,255,255,0.5)]">{t('or')}</span>
            </div>
          </div>

          {/* Google Signup Only */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-10 rounded-full bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.3)] transition-all duration-300 backdrop-blur-sm"
            onClick={handleGoogleSignup}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <div className="flex items-center justify-center gap-3">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span className="text-white font-medium text-xs">{t('socialSignup')}</span>
              </div>
            )}
          </Button>
        </div>

        {/* Footer Link */}
        <div className="mt-4 text-center">
          <span className="text-xs text-white/60">
            Akkauntingiz bormi?{" "}
            <Link to="/auth" className="text-sky-200/80 font-semibold hover:text-sky-100 transition-colors">
              Kirish
            </Link>
          </span>
        </div>
      </div>

      {/* Anchored Footer */}
      <div className="relative z-10 w-full mt-2">
        <LegalFooter />
      </div>
    </div>
  );
};

export default Signup;
