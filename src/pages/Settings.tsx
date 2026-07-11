import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useTheme, ThemeMode, BackgroundTheme } from '@/contexts/ThemeContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, LogOut, Moon, Sun, Monitor, Shield, Globe, Palette, EyeOff, Lock, WifiOff, BookOpen, FolderLock, AtSign, Bookmark, Star, Zap, Info, ChevronRight, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

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
  const [isUpdating, setIsUpdating] = useState(false);
  const hideHighlights = profile?.hide_highlights === true;
  const hideCollections = profile?.hide_collections === true;
  const isPrivate = profile?.is_private === true;
  const hideOnlineStatus = profile?.hide_online_status === true;
  const hideMentions = profile?.hide_mentions === true;
  const hideSavedPosts = profile?.hide_saved_posts === true;

  const toggleVisibility = async (field: 'hide_highlights' | 'hide_collections' | 'is_private' | 'hide_online_status' | 'hide_mentions' | 'hide_saved_posts', current: boolean) => {
    if (!user || isUpdating) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('profiles').update({ [field]: !current } as never).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: t('success'), description: t('settingsUpdated') });
    } catch (e) {
      console.error(e);
      toast({ title: t('error'), description: t('settingsUpdateError'), variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
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
      <div className="p-4 pb-20">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0 h-11 w-11">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold truncate">Sozlamalar</h1>
        </div>

        <div className="space-y-4">
          {/* 1. Language */}
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
                    className="flex-1 min-h-[44px]"
                    onClick={() => setLang(l)}
                  >
                    {langLabels[l]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 2. Appearance — Theme Mode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {t('appearance')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">{tt('themeMode')}</Label>
                <div className="flex gap-2">
                  {themeModes.map(({ key, icon: Icon }) => (
                    <Button
                      key={key}
                      variant={mode === key ? "default" : "outline"}
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      title={tt(key)}
                      onClick={() => {
                        setMode(key);
                        void persistAppearance({ theme_mode: key });
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </Button>
                  ))}
                </div>
              </div>

              {/* Background themes */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">{tt('background')}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {bgOptions.map(({ key, preview }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setBgTheme(key);
                        void persistAppearance({ bg_theme: key });
                      }}
                      className={cn(
                        "relative rounded-xl aspect-[3/4] overflow-hidden border-2 transition-all",
                        bgTheme === key
                          ? "border-primary ring-2 ring-primary/30 scale-105 shadow-md shadow-primary/20"
                          : "border-border/40 hover:border-border"
                      )}
                    >
                      <div className={cn("absolute inset-0", preview)} />
                      <span className="absolute bottom-0 inset-x-0 text-[10px] font-medium py-1 text-center bg-background/80 backdrop-blur-md text-foreground">
                        {tt(bgLabelMap[key])}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Privacy / Visibility */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <EyeOff className="h-4 w-4" />
                {t('privacy')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={cn(
                'rounded-2xl border border-border/40 overflow-hidden',
                'bg-background/60 backdrop-blur-xl'
              )}>
                <div className="p-4 flex items-start gap-3 border-b border-border/30">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t('privacy')}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{t('securityDesc')}</p>
                  </div>
                </div>

                <div className="divide-y divide-border/30">
                  <div className="px-4 min-h-[64px] py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('privateAccount')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('privateAccountDesc')}</p>
                      </div>
                    </div>
                    <div className="scale-125 origin-right shrink-0">
                      <Switch disabled={isUpdating} checked={isPrivate} onCheckedChange={() => toggleVisibility('is_private', isPrivate)} />
                    </div>
                  </div>

                  <div className="px-4 min-h-[64px] py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('hideOnline')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('hideOnlineDesc')}</p>
                      </div>
                    </div>
                    <div className="scale-125 origin-right shrink-0">
                      <Switch disabled={isUpdating} checked={hideOnlineStatus} onCheckedChange={() => toggleVisibility('hide_online_status', hideOnlineStatus)} />
                    </div>
                  </div>

                  <div className="px-4 min-h-[64px] py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('hideHighlights')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('hideHighlightsDesc')}</p>
                      </div>
                    </div>
                    <div className="scale-125 origin-right shrink-0">
                      <Switch disabled={isUpdating} checked={hideHighlights} onCheckedChange={() => toggleVisibility('hide_highlights', hideHighlights)} />
                    </div>
                  </div>

                  <div className="px-4 min-h-[64px] py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <FolderLock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('hideCollections')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('hideCollectionsDesc')}</p>
                      </div>
                    </div>
                    <div className="scale-125 origin-right shrink-0">
                      <Switch disabled={isUpdating} checked={hideCollections} onCheckedChange={() => toggleVisibility('hide_collections', hideCollections)} />
                    </div>
                  </div>
                  
                  <div className="px-4 min-h-[64px] py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <AtSign className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('hideMentions')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('hideMentionsDesc')}</p>
                      </div>
                    </div>
                    <div className="scale-125 origin-right shrink-0">
                      <Switch disabled={isUpdating} checked={hideMentions} onCheckedChange={() => toggleVisibility('hide_mentions', hideMentions)} />
                    </div>
                  </div>

                  <div className="px-4 min-h-[64px] py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <Bookmark className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t('hideSaved')}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('hideSavedDesc')}</p>
                      </div>
                    </div>
                    <div className="scale-125 origin-right shrink-0">
                      <Switch disabled={isUpdating} checked={hideSavedPosts} onCheckedChange={() => toggleVisibility('hide_saved_posts', hideSavedPosts)} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3.5. Ma'lumotlar va xotira (Telegram kabi kesh boshqaruvi) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Ma'lumotlar va xotira
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-between min-h-[56px] h-auto py-3 px-4 hover:bg-primary/5 hover:text-primary transition-all font-medium border-border/60 rounded-xl"
                onClick={() => navigate('/settings/storage')}
              >
                <div className="flex flex-col items-start text-left mr-3">
                  <span className="font-medium">Kesh va media xotira</span>
                  <span className="text-xs text-muted-foreground font-normal mt-0.5">
                    Yuklab olingan fayllarni boshqarish.
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>

          {/* 4. Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Dastur haqida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-between min-h-[56px] h-auto py-3 px-4 hover:bg-primary/5 hover:text-primary transition-all font-medium border-border/60 rounded-xl"
                onClick={() => navigate('/about')}
              >
                <span className="text-left whitespace-normal leading-tight mr-3">Biz haqimizda (Avlodona qanday tizim?)</span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>

          {/* 5. Subscription */}
          <Card className="border-emerald-500/30 shadow-sm shadow-emerald-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-emerald-500" />
                  Obuna
                </div>
                {profile?.subscription_tier === 'pro' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-full">
                    PRO Plan
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full h-14 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                onClick={() => window.dispatchEvent(new Event('show-plan-overlay'))}
              >
                <Zap className="h-5 w-5 fill-current text-yellow-300" />
                <span className="text-base tracking-wide">
                  {profile?.subscription_tier === 'pro' ? "Pro rejani ko'rish" : "Tez kunda Pro ta'rif"}
                </span>
              </Button>
            </CardContent>
          </Card>

          {/* 6. Logout */}
          <Button 
            variant="destructive" 
            className="w-full h-14 rounded-xl font-bold text-base mt-2"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-5 w-5" />
            {t('logout')}
          </Button>

          {/* 7. Delete Account */}
          <Button
            variant="ghost"
            className="w-full h-12 rounded-xl text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all border border-border/40"
            onClick={() => navigate('/delete-account')}
          >
            Akkauntni o'chirish / Удалить аккаунт
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
