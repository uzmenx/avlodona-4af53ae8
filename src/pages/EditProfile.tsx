import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { InstagramPhotoPicker, SocialLinksEditor, SocialLink } from '@/components/profile';
import { ChatMediaPicker } from '@/components/chat/ChatMediaPicker';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Loader2, Check, AlertCircle, Camera, User, ImagePlus, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { uploadToR2, compressImage } from '@/lib/r2Upload';
import { cn } from '@/lib/utils';
import { validateUsername } from '@/utils/usernameUtils';
import { isVideoUrl, transcodeVideo } from '@/lib/videoUtils';

const EditProfile = () => {
  const { profile, user, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [originalUsername, setOriginalUsername] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    bio: '',
    avatar_url: '',
    cover_url: '',
    gender: '' as 'male' | 'female' | '',
    social_links: [] as SocialLink[]
  });

  const [cropperState, setCropperState] = useState<{
    isOpen: boolean;
    imageUrl: string;
    type: 'avatar' | 'cover';
  }>({ isOpen: false, imageUrl: '', type: 'avatar' });
  const [showSocialLinks, setShowSocialLinks] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const BIO_MAX_LENGTH = 300;

  useEffect(() => {
    if (profile) {
      setOriginalUsername(profile.username || '');
      setFormData({
        name: profile.name || '',
        username: profile.username || user?.email?.split('@')[0] || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || '',
        cover_url: (profile as { cover_url?: string }).cover_url || '',
        gender: profile.gender as 'male' | 'female' || '',
        social_links: ((profile as { social_links?: unknown }).social_links as SocialLink[]) || []
      });
    } else if (user && !isLoading) {
      // Fallback: only fetch if profile from context is completely missing
      const fetchProfileData = async () => {
        const { data } = await supabase.
          from('profiles').
          select('*').
          eq('id', user.id).
          maybeSingle();

        if (data) {
          setOriginalUsername(data.username || '');
          setFormData({
            name: data.name || '',
            username: data.username || '',
            bio: data.bio || '',
            avatar_url: data.avatar_url || '',
            cover_url: (data as { cover_url?: string }).cover_url || '',
            gender: data.gender as 'male' | 'female' || '',
            social_links: (data.social_links as unknown as SocialLink[]) || []
          });
        }
      };
      fetchProfileData();
    }
  }, [profile, user, isLoading]);

  useEffect(() => {
    const checkUsername = async () => {
      const val = formData.username;
      if (!val) return;

      const validation = validateUsername(val);
      if (!validation.isValid) {
        setUsernameStatus('idle');
        setUsernameError(validation.error || "");
        return;
      }
      setUsernameError(""); 

      if (val === originalUsername) {
        setUsernameStatus('idle');
        return; 
      }

      setUsernameStatus('checking');
      
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', val)
        .maybeSingle();
        
      if (data) {
        setUsernameStatus('taken');
        setUsernameError("Kechirasiz, bu username band qilingan");
      } else {
        setUsernameStatus('available');
        setUsernameError("");
      }
    };

    const handler = setTimeout(checkUsername, 500);
    return () => clearTimeout(handler);
  }, [formData.username, originalUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (usernameError) {
      toast({ title: t('error'), description: usernameError, variant: "destructive" });
      return;
    }

    setIsLoading(true);


    try {
      const { error } = await supabase.
      from('profiles').
      update({
        name: formData.name,
        username: formData.username,
        bio: formData.bio.slice(0, BIO_MAX_LENGTH),
        avatar_url: formData.avatar_url,
        cover_url: formData.cover_url,
        gender: formData.gender || null,
        social_links: formData.social_links.filter((l) => l.url.trim()) as unknown as never
      }).
      eq('id', user.id);

      if (error) throw error;

      await refreshProfile();

      toast({ title: t('saved'), description: t('profileUpdated') });
      navigate('/profile');
    } catch (error: unknown) {
      const supabaseError = error as { code?: string; message?: string };
      if (supabaseError.code === '23505' || supabaseError.message?.includes('duplicate key')) {
        setUsernameError("Kechirasiz, ushbu username band qilingan.");
        toast({
          title: t('error'),
          description: "Kechirasiz, ushbu username band qilingan.",
          variant: "destructive"
        });
      } else {
        toast({
          title: t('error'),
          description: supabaseError.message || t('updateError'),
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getGenderRingColor = () => {
    if (formData.gender === 'male') return 'ring-sky-400';
    if (formData.gender === 'female') return 'ring-pink-400';
    return 'ring-muted';
  };

  const getGenderBgColor = () => {
    if (formData.gender === 'male') return 'bg-sky-500';
    if (formData.gender === 'female') return 'bg-pink-500';
    return 'bg-primary';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
    if (isGif && user?.id) {
      try {
        const url = await uploadToR2(file, `${type === 'avatar' ? 'avatars' : 'covers'}/${user.id}`);
        if (type === 'avatar') setFormData((prev) => ({ ...prev, avatar_url: url }));else
        setFormData((prev) => ({ ...prev, cover_url: url }));
      } catch {
        toast({ title: t('error'), description: t('uploadError'), variant: 'destructive' });
      } finally {
        e.target.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropperState({
        isOpen: true,
        imageUrl: reader.result as string,
        type
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const uploadCroppedImage = async (croppedUrl: string): Promise<void> => {
    if (!user) return;

    if (croppedUrl.includes('giphy.com')) {
      if (cropperState.type === 'avatar') {
        setFormData((prev) => ({ ...prev, avatar_url: croppedUrl }));
      } else {
        setFormData((prev) => ({ ...prev, cover_url: croppedUrl }));
      }
      return;
    }

    try {
      const response = await fetch(croppedUrl);
      const blob = await response.blob();
      let url = '';
      if (blob.type.startsWith('video/')) {
        const file = new File([blob], `${cropperState.type}_${Date.now()}.mp4`, { type: blob.type });
        const transcodedBlob = await transcodeVideo(file, 10, 1080);
        url = await uploadToR2(transcodedBlob, `${cropperState.type === 'avatar' ? 'avatars' : 'covers'}/${user.id}`);
      } else {
        const file = new File([blob], `${cropperState.type}_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const compressed = await compressImage(
          file,
          cropperState.type === 'avatar' ? 1024 : 3200,
          cropperState.type === 'avatar' ? 1024 : 3200,
          0.98
        );
        url = await uploadToR2(compressed, `${cropperState.type === 'avatar' ? 'avatars' : 'covers'}/${user.id}`);
      }

      if (cropperState.type === 'avatar') {
        setFormData((prev) => ({ ...prev, avatar_url: url }));
      } else {
        setFormData((prev) => ({ ...prev, cover_url: url }));
      }
    } catch (error) {
      toast({ title: t('error'), description: t('uploadError'), variant: "destructive" });
    }

    URL.revokeObjectURL(croppedUrl);
  };

  return (
    <AppLayout showNav={false}>
      <div className="min-h-screen">
        <form id="edit-profile-form" onSubmit={handleSubmit} className="pb-10">
          <div className="sticky top-0 z-40 border-b border-white/10 bg-background/30 backdrop-blur-2xl">
            <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10">
                
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold tracking-tight truncate">{t('editProfile')}</div>
                <div className="text-[11px] text-muted-foreground truncate">{t('profileInfo')}</div>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
                className="rounded-2xl h-10 px-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-95">
                
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
              </Button>
            </div>
          </div>

          <div className="max-w-md mx-auto">
            {/* Cover Image Section */}
            <div
              className="relative h-[100px] cursor-pointer overflow-hidden rounded-b-2xl rounded-t-none"
              onClick={() => { setCropperState({ isOpen: true, imageUrl: '', type: 'cover' }); }}>
              
              {formData.cover_url ?
                isVideoUrl(formData.cover_url) ? (
                  <video
                    src={formData.cover_url}
                    className="w-full h-full object-cover"
                    autoPlay loop muted playsInline
                    ref={(el) => {
                      if (el) {
                        el.addEventListener('timeupdate', () => {
                          if (el.currentTime >= 10) {
                            el.currentTime = 0;
                            el.play().catch(() => {});
                          }
                        });
                      }
                    }}
                  />
                ) : (
                  <img src={formData.cover_url} alt="Cover" className="w-full h-full object-cover" />
                )
              :
              <div className="w-full h-full bg-gradient-to-br from-indigo-500/25 via-purple-500/15 to-cyan-500/25" />
              }
              <div className="absolute inset-0 bg-black/20" />
            </div>

            <div className="px-4">
              {/* Avatar */}
              <div className="relative -mt-10 mb-2 flex flex-col items-center">
                <div
                  className={cn(
                    `relative rounded-full p-1 ring-2 ${getGenderRingColor()} bg-background cursor-pointer`,
                    'shadow-lg'
                  )}
                  onClick={() => { setCropperState({ isOpen: true, imageUrl: '', type: 'avatar' }); }}>
                  
                  <Avatar className="h-20 w-20">
                    {isVideoUrl(formData.avatar_url) ? (
                      <video
                        src={formData.avatar_url}
                        className="w-full h-full object-cover rounded-full"
                        autoPlay loop muted playsInline
                        ref={(el) => {
                          if (el) {
                            el.addEventListener('timeupdate', () => {
                              if (el.currentTime >= 10) {
                                el.currentTime = 0;
                                el.play().catch(() => {});
                              }
                            });
                          }
                        }}
                      />
                    ) : (
                      <AvatarImage src={formData.avatar_url || undefined} className="object-cover" />
                    )}
                    <AvatarFallback className={cn('text-xl text-white', getGenderBgColor())}>
                      {getInitials(formData.name) || <User className="h-6 w-6" />}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <button 
                  type="button" 
                  className="text-primary text-xs font-semibold mt-1.5"
                  onClick={() => { setCropperState({ isOpen: true, imageUrl: '', type: 'avatar' }); }}
                >
                  Rasmni o'zgartirish
                </button>
              </div>

              <div className="mt-4 space-y-3">
              {/* Name */}
               <div className="space-y-1">
                 <div className="flex items-center justify-between">
                   <Label htmlFor="name" className="text-sm text-muted-foreground font-medium">{t('fullName')} <span className="font-normal text-xs">(Ixtiyoriy)</span></Label>
                   {formData.name.length > 0 && (
                     <span className={`text-[10px] ${formData.name.length >= 25 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                       {formData.name.length}/25
                     </span>
                   )}
                 </div>
                 <Input id="name" placeholder={t('yourName')} value={formData.name} className="h-11"
                      maxLength={25}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value.slice(0, 25) }))} />
              </div>

              {/* Username */}
              <div className="space-y-1">
                <Label htmlFor="username" className="text-sm text-muted-foreground font-medium">{t('userHandle')}</Label>
                <div className="relative">
                  <Input
                    id="username"
                    placeholder="username"
                    value={formData.username}
                    className={cn("h-11", usernameError ? "border-destructive focus-visible:ring-destructive pr-10" : "pr-10")}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
                      setFormData((prev) => ({ ...prev, username: val }));
                    }} />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      {usernameStatus === 'checking' && (
                        <motion.div key="checking" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </motion.div>
                      )}
                      {usernameStatus === 'available' && !usernameError && (
                        <motion.div key="available" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                          <Check className="h-4 w-4 text-emerald-500" />
                        </motion.div>
                      )}
                      {(usernameStatus === 'taken' || usernameError) && (
                        <motion.div key="taken" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                
                <AnimatePresence>
                  {usernameError && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <p className="text-[11px] text-destructive mt-1">{usernameError}</p>
                    </motion.div>
                  )}
                  {usernameStatus === 'available' && !usernameError && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <p className="text-[11px] text-emerald-500 mt-1">Bu username mavjud</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bio */}
              <div className="space-y-1">
                 <div className="flex items-center justify-between">
                   <Label htmlFor="bio" className="text-sm text-muted-foreground font-medium">Bio</Label>
                   <span className={`text-xs ${formData.bio.length > BIO_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                     {formData.bio.length}/{BIO_MAX_LENGTH}
                   </span>
                 </div>
                 <Textarea id="bio" placeholder={t('bioPlaceholder')} value={formData.bio}
                      className="resize-none h-[72px]"
                      onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value.slice(0, BIO_MAX_LENGTH + 50) }))}
                      maxLength={BIO_MAX_LENGTH + 50} />
                 {formData.bio.length > BIO_MAX_LENGTH &&
                      <p className="text-xs text-destructive">
                      Bio {BIO_MAX_LENGTH} {t('bioLimit')}
                    </p>
                      }
              </div>

              {/* Gender Selection */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground font-medium">{t('gender')}</Label>
                <RadioGroup
                        value={formData.gender}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, gender: value as 'male' | 'female' }))}
                        className="flex gap-2">
                        
                  <div>
                    <RadioGroupItem value="male" id="male" className="sr-only" />
                    <Label
                            htmlFor="male"
                            className={cn(
                              'h-9 rounded-full border border-border/50 bg-muted/20 px-4 flex items-center justify-center cursor-pointer select-none transition-colors w-max',
                              formData.gender === 'male' && 'bg-sky-500/10 border-sky-500/40 text-sky-400'
                            )}>
                      <span className="text-sm font-medium">
                        {t('male')}
                      </span>
                    </Label>
                  </div>

                  <div>
                    <RadioGroupItem value="female" id="female" className="sr-only" />
                    <Label
                            htmlFor="female"
                            className={cn(
                              'h-9 rounded-full border border-border/50 bg-muted/20 px-4 flex items-center justify-center cursor-pointer select-none transition-colors w-max',
                              formData.gender === 'female' && 'bg-pink-500/10 border-pink-500/40 text-pink-400'
                            )}>
                      <span className="text-sm font-medium">
                        {t('female')}
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Social links */}
              <div className="space-y-1 pb-10">
                <button
                  type="button"
                  onClick={() => setShowSocialLinks(!showSocialLinks)}
                  className="flex items-center text-primary text-sm font-semibold mt-1"
                >
                  {showSocialLinks ? "Ijtimoiy havolalarni yopish" : `+ Ijtimoiy havola qo'shish (${formData.social_links.length}/3)`}
                </button>
                {showSocialLinks && (
                  <div className="pt-2">
                    <SocialLinksEditor
                      links={formData.social_links}
                      onChange={(links) => setFormData((prev) => ({ ...prev, social_links: links }))}
                      maxLinks={3} />
                  </div>
                )}
              </div>

              </div>
            </div>
          </div>
        </form>

      {/* Image Cropper */}
      <InstagramPhotoPicker
          isOpen={cropperState.isOpen}
          onClose={() => setCropperState((prev) => ({ ...prev, isOpen: false }))}
          onCropComplete={uploadCroppedImage}
          initialImage={cropperState.imageUrl}
          type={cropperState.type} />
          

        
    </div>
  </AppLayout>);


};

export default EditProfile;