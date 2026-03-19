import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { LangSwitcher } from "@/components/LangSwitcher";
import { LegalFooter } from "@/components/legal/LegalFooter";

const Signup = () => {
  const [username, setUsername] = useState("");
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
    if (!email || !password || !username) {
      toast({ title: t("error"), description: t("fillAllFields"), variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: t("error"), description: t("passMinLength"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Direct signup without OTP (Resend temporarily disabled)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            name: username,
            gender: gender || null,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Create/update profile
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username,
          name: username,
          email,
          gender: gender || null,
        });

        toast({ title: t("success"), description: "Ro'yxatdan o'tdingiz!" });
        navigate("/");
      }
    } catch (error: any) {
      toast({ title: t("error"), description: error.message || t("signupError"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: t("error"), description: error.message || t("googleError"), variant: "destructive" });
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#0a0a1a] via-[#1a1a3e] to-[#0a0a1a]">
      {/* Animated Bokeh Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-32 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute bottom-32 left-40 w-56 h-56 bg-green-500/20 rounded-full blur-3xl animate-pulse delay-2000" />
        <div className="absolute top-60 left-1/2 w-40 h-40 bg-purple-400/15 rounded-full blur-2xl animate-pulse delay-500" />
        <div className="absolute bottom-20 right-20 w-52 h-52 bg-teal-400/15 rounded-full blur-2xl animate-pulse delay-1500" />
      </div>

      {/* Header: registratsiyada ortga tugmasi, til tugmasi nur bilan */}
      <div className="relative z-10 p-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white/10 rounded-full transition-all duration-300 backdrop-blur-sm"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <LangSwitcher glow />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-4">
        {/* Glass Card */}
        <div className="w-full max-w-md backdrop-blur-xl bg-white/8 border border-white/20 rounded-3xl shadow-2xl p-6 space-y-4">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-white mb-1">{t('welcome')}</h1>
            <p className="text-white/70">{t('createAccount')}</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="username" className="sr-only">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
                <Input
                  id="username"
                  type="text"
                  placeholder={t('username')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-12 h-12 bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)] rounded-2xl text-white placeholder-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.3)] focus:bg-[rgba(255,255,255,0.12)] transition-all duration-300 backdrop-blur-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="sr-only">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-12 bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)] rounded-2xl text-white placeholder-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.3)] focus:bg-[rgba(255,255,255,0.12)] transition-all duration-300 backdrop-blur-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="sr-only">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="•••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 pr-12 h-12 bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.15)] rounded-2xl text-white placeholder-[rgba(255,255,255,0.4)] focus:border-[rgba(255,255,255,0.3)] focus:bg-[rgba(255,255,255,0.12)] transition-all duration-300 backdrop-blur-sm"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.6)] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Gender Toggle */}
            <div className="space-y-2 py-1 text-center">
              <Label className="text-[rgba(255,255,255,0.7)] text-sm">{t('gender')}</Label>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setGender("male")}
                  className={`h-8 px-4 rounded-full border transition-all duration-200 ease-in-out text-[13px] font-medium ${
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
                  className={`h-8 px-4 rounded-full border transition-all duration-200 ease-in-out text-[13px] font-medium ${
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
              className="w-full h-12 rounded-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white font-bold text-sm transition-all duration-300 transform hover:scale-105 shadow-lg shadow-[rgba(34,197,94,0.4)] tracking-[0.04em]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('signingUp')}
                </>
              ) : (
                t('signup')
              )}
            </Button>
          </form>

          <p className="text-xs text-white/60 leading-relaxed">
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-white/80 hover:text-white underline underline-offset-4">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy-policy" className="text-white/80 hover:text-white underline underline-offset-4">
              Privacy Policy
            </Link>.
          </p>

          <div className="relative py-3">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[rgba(255,255,255,0.15)]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-transparent px-4 text-[rgba(255,255,255,0.5)]">{t('or')}</span>
            </div>
          </div>

          {/* Google Signup Only */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-full bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.3)] transition-all duration-300 backdrop-blur-sm"
            onClick={handleGoogleSignup}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <div className="flex items-center justify-center gap-3">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
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
                <span className="text-white font-medium text-sm">{t('socialSignup')}</span>
              </div>
            )}
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <span className="text-sm text-white/60">
            Akkauntingiz bormi?{" "}
            <Link to="/auth" className="text-sky-200/80 font-semibold hover:text-sky-100 transition-colors">
              Kirish
            </Link>
          </span>
        </div>

        <LegalFooter className="mt-4" />
      </div>
    </div>
  );
};

export default Signup;
