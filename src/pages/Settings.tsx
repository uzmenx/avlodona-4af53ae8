import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useTheme, ThemeMode, BackgroundTheme } from '@/contexts/ThemeContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, LogOut, Moon, Sun, Monitor, Shield, Mail, Globe, Palette, EyeOff, Lock, WifiOff, BookOpen, FolderLock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';

const langLabels: Record<Language, string> = {
  uz: "O'zbek",
  ru: "Русский",
  en: "English",
};

const themeTranslations = {
  themeMode: { uz: "Rejim", ru: "Режим", en: "Mode" },
  light: { uz: "Yorug'", ru: "Светлая", en: "Light" },
  dark: { uz: "Qorong'u", ru: "Тёмная", en: "Dark" },
  system: { uz: "Tizim", ru: "Система", en: "System" },
  background: { uz: "Fon", ru: "Фон", en: "Background" },
  bgNone: { uz: "Oddiy", ru: "Обычный", en: "Default" },
  bgAurora: { uz: "Aurora", ru: "Аврора", en: "Aurora" },
  bgSunset: { uz: "Quyosh", ru: "Закат", en: "Sunset" },
  bgOcean: { uz: "Okean", ru: "Океан", en: "Ocean" },
} as const;

const themeModes: { key: ThemeMode; icon: typeof Sun }[] = [
  { key: 'light', icon: Sun },
  { key: 'dark', icon: Moon },
  { key: 'system', icon: Monitor },
];

const bgOptions: { key: BackgroundTheme; preview: string }[] = [
  { key: 'none', preview: 'bg-card' },
  { key: 'aurora', preview: 'bg-aurora' },
  { key: 'sunset', preview: 'bg-sunset' },
  { key: 'ocean', preview: 'bg-ocean' },
];

const bgLabelMap: Record<BackgroundTheme, keyof typeof themeTranslations> = {
  none: 'bgNone',
  aurora: 'bgAurora',
  sunset: 'bgSunset',
  ocean: 'bgOcean',
};

const Settings = () => {
  const { user, profile, logout, refreshProfile } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const { mode, setMode, bgTheme, setBgTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  type ProfileData = { hide_highlights?: boolean; hide_collections?: boolean; is_private?: boolean; hide_online_status?: boolean; };
  const profileData = profile as ProfileData | undefined;
  const hideHighlights = profileData?.hide_highlights === true;
  const hideCollections = profileData?.hide_collections === true;
  const isPrivate = profileData?.is_private === true;
  const hideOnlineStatus = profileData?.hide_online_status === true;

  const toggleVisibility = async (field: 'hide_highlights' | 'hide_collections' | 'is_private' | 'hide_online_status', current: boolean) => {
    if (!user) return;
    await supabase.from('profiles').update({ [field]: !current } as never).eq('id', user.id);
    window.location.reload();
  };

  const tt = (key: keyof typeof themeTranslations) => themeTranslations[key][lang];

  const persistAppearance = async (updates: Partial<{ theme_mode: ThemeMode; bg_theme: BackgroundTheme }>) => {
    if (!user?.id) return;
    try {
      await supabase.from('profiles').update(updates as never).eq('id', user.id);
      await refreshProfile();
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    await logout();
    toast({ title: t('loggedOut'), description: t('loggedOutDesc') });
    navigate('/auth');
  };

  return (
    <AppLayout showNav={false}>
      <div className="p-4">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold truncate">{t('settings')}</h1>
          </div>

          {user?.email && (
            <div
              className={cn(
                'flex items-center gap-1.5 max-w-[52%] px-2 py-1 rounded-full',
                'border border-border/40 bg-background/70 backdrop-blur-sm'
              )}
            >
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* Language */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t('language')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1.5">
                {(Object.keys(langLabels) as Language[]).map((l) => (
                  <Button
                    key={l}
                    variant={lang === l ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setLang(l)}
                  >
                    {langLabels[l]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Appearance — Theme Mode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {t('appearance')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">{tt('themeMode')}</Label>
                <div className="flex gap-1.5">
                  {themeModes.map(({ key, icon: Icon }) => (
                    <Button
                      key={key}
                      variant={mode === key ? "default" : "outline"}
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => {
                        setMode(key);
                        void persistAppearance({ theme_mode: key });
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tt(key)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Background themes */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">{tt('background')}</Label>
                <div className="grid grid-cols-4 gap-1">
                  {bgOptions.map(({ key, preview }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setBgTheme(key);
                        void persistAppearance({ bg_theme: key });
                      }}
                      className={cn(
                        "relative rounded-lg aspect-[3/4] overflow-hidden border-2 transition-all",
                        bgTheme === key
                          ? "border-primary ring-2 ring-primary/30 scale-105"
                          : "border-border/40 hover:border-border"
                      )}
                    >
                      <div className={cn("absolute inset-0", preview)} />
                      <span className="absolute bottom-0 inset-x-0 text-[10px] font-medium py-0.5 text-center bg-background/70 backdrop-blur-sm text-foreground">
                        {tt(bgLabelMap[key])}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy / Visibility */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <EyeOff className="h-4 w-4" />
                Maxfiylik
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={cn(
                'rounded-2xl border border-border/40 overflow-hidden',
                'bg-background/60 backdrop-blur-xl'
              )}>
                <div className="p-3 flex items-start gap-2.5 border-b border-border/30">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Maxfiylik</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t('securityDesc')}</p>
                  </div>
                </div>

                <div className="divide-y divide-border/30">
                  <div className="px-3 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Yopiq akkaunt</p>
                        <p className="text-xs text-muted-foreground">Faqat kuzatuvchilar postlaringizni ko'rsin</p>
                      </div>
                    </div>
                    <Switch checked={isPrivate} onCheckedChange={() => toggleVisibility('is_private', isPrivate)} />
                  </div>

                  <div className="px-3 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Onlaynlikni yashirish</p>
                        <p className="text-xs text-muted-foreground">Boshqalar online holatni ko'rmasin</p>
                      </div>
                    </div>
                    <Switch checked={hideOnlineStatus} onCheckedChange={() => toggleVisibility('hide_online_status', hideOnlineStatus)} />
                  </div>

                  <div className="px-3 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Hikoya lentani yashirish</p>
                        <p className="text-xs text-muted-foreground">Profildan highlights ko'rinmasin</p>
                      </div>
                    </div>
                    <Switch checked={hideHighlights} onCheckedChange={() => toggleVisibility('hide_highlights', hideHighlights)} />
                  </div>

                  <div className="px-3 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <FolderLock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Post ro'yxatlarni yashirish</p>
                        <p className="text-xs text-muted-foreground">Collections boshqalarga ko'rinmasin</p>
                      </div>
                    </div>
                    <Switch checked={hideCollections} onCheckedChange={() => toggleVisibility('hide_collections', hideCollections)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logout */}
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t('logout')}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
