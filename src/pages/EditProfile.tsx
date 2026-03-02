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
 import { ImageCropper, SocialLinksEditor, SocialLink } from '@/components/profile';
 import { ArrowLeft, Camera, Loader2, User, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { uploadToR2, compressImage } from '@/lib/r2Upload';
import { cn } from '@/lib/utils';

const EditProfile = () => {
  const { profile, user, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
 
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
 
   const avatarInputRef = useRef<HTMLInputElement>(null);
   const coverInputRef = useRef<HTMLInputElement>(null);
 
   const BIO_MAX_LENGTH = 300;

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
         if (data) {
           setFormData({
             name: data.name || '',
             username: data.username || '',
             bio: data.bio || '',
             avatar_url: data.avatar_url || '',
             cover_url: (data as any).cover_url || '',
             gender: (data.gender as 'male' | 'female') || '',
             social_links: ((data as any).social_links as SocialLink[]) || []
           });
         }
      }
    };
    
    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);

 
     try {
       const { error } = await supabase
         .from('profiles')
         .update({
           name: formData.name,
           username: formData.username,
           bio: formData.bio.slice(0, BIO_MAX_LENGTH),
           avatar_url: formData.avatar_url,
           cover_url: formData.cover_url,
           gender: formData.gender || null,
           social_links: formData.social_links.filter(l => l.url.trim())
         } as any)
         .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      
      toast({ title: t('saved'), description: t('profileUpdated') });
      navigate('/profile');
    } catch (error: any) {
      toast({ 
        title: t('error'), 
        description: error.message || t('updateError'), 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
 
   const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
     const file = e.target.files?.[0];
     if (!file) return;
     
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
     
     try {
       const response = await fetch(croppedUrl);
       const blob = await response.blob();
       const file = new File([blob], `${cropperState.type}_${Date.now()}.jpg`, { type: 'image/jpeg' });
       const compressed = await compressImage(file);
       const url = await uploadToR2(compressed, `avatars/${user.id}`);
       
       if (cropperState.type === 'avatar') {
         setFormData(prev => ({ ...prev, avatar_url: url }));
       } else {
         setFormData(prev => ({ ...prev, cover_url: url }));
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
                className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10"
              >
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
                className="rounded-2xl h-10 px-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-95"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
              </Button>
            </div>
          </div>

          <div className="max-w-md mx-auto">
            {/* Cover Image Section */}
            <div
              className="relative h-40 cursor-pointer overflow-hidden"
              onClick={() => coverInputRef.current?.click()}
            >
              {formData.cover_url ? (
                <img
                  src={formData.cover_url}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-500/25 via-purple-500/15 to-cyan-500/25" />
              )}
              <div className="absolute inset-0 bg-black/35" />

              <div className="absolute left-0 right-0 bottom-0 px-4 pb-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    coverInputRef.current?.click();
                  }}
                  className="text-white/90 text-xs font-semibold px-3 py-2 rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 hover:bg-black/45 transition-colors"
                >
                  {t('changeCover')}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    avatarInputRef.current?.click();
                  }}
                  className="text-white/90 text-xs font-semibold px-3 py-2 rounded-2xl bg-black/35 backdrop-blur-md border border-white/10 hover:bg-black/45 transition-colors"
                >
                  {t('changeAvatar')}
                </button>
              </div>

              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'cover')}
              />
            </div>

            <div className="px-4">
              {/* Avatar */}
              <div className="relative -mt-12 mb-5 flex justify-center">
                <div
                  className={cn(
                    `relative rounded-full p-1 ring-4 ${getGenderRingColor()} bg-background cursor-pointer`,
                    'shadow-[0_16px_50px_-30px_rgba(0,0,0,0.85)]'
                  )}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={formData.avatar_url || undefined} />
                    <AvatarFallback className={cn('text-2xl text-white', getGenderBgColor())}>
                      {getInitials(formData.name) || <User className="h-8 w-8" />}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, 'avatar')}
                  />
                </div>
              </div>

              <Card className="border-white/10 bg-background/40 backdrop-blur-xl rounded-3xl shadow-[0_22px_70px_-44px_rgba(0,0,0,0.9)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-extrabold tracking-tight">{t('profileInfo')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
              {/* Gender Selection */}
              <div className="space-y-3">
                <Label>{t('gender')}</Label>
                <RadioGroup 
                  value={formData.gender} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value as 'male' | 'female' }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" className="border-sky-500 text-sky-500" />
                    <Label htmlFor="male" className="cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-sky-500"></div>
                      {t('male')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" className="border-pink-500 text-pink-500" />
                    <Label htmlFor="female" className="cursor-pointer flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-pink-500"></div>
                      {t('female')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Name */}
               <div className="space-y-2">
                 <Label htmlFor="name">{t('fullName')}</Label>
                 <Input id="name" placeholder={t('yourName')} value={formData.name}
                   onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} />
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">{t('username')}</Label>
                <Input
                  id="username"
                  placeholder="username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                 <div className="flex items-center justify-between">
                   <Label htmlFor="bio">Bio</Label>
                   <span className={`text-xs ${formData.bio.length > BIO_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                     {formData.bio.length}/{BIO_MAX_LENGTH}
                   </span>
                 </div>
                 <Textarea id="bio" placeholder={t('bioPlaceholder')} value={formData.bio}
                    onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value.slice(0, BIO_MAX_LENGTH + 50) }))}
                   rows={3}
                    maxLength={BIO_MAX_LENGTH + 50} />
                 {formData.bio.length > BIO_MAX_LENGTH && (
                    <p className="text-xs text-destructive">
                      Bio {BIO_MAX_LENGTH} {t('bioLimit')}
                    </p>
                  )}
              </div>

              {/* Social links */}
              <SocialLinksEditor
                links={formData.social_links}
                onChange={(links) => setFormData(prev => ({ ...prev, social_links: links }))}
                maxLinks={3}
              />

                  </div>
                </CardContent>
              </Card>

              <div className="pt-5 pb-2">
                <Button
                  type="submit"
                  className="w-full h-11 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black hover:opacity-95"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('saving')}</>
                  ) : (
                    t('save')
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>

      {/* Image Cropper */}
      <ImageCropper
        isOpen={cropperState.isOpen}
        onClose={() => setCropperState(prev => ({ ...prev, isOpen: false }))}
        imageUrl={cropperState.imageUrl}
        aspectRatio={cropperState.type === 'avatar' ? 1 : 3}
        shape={cropperState.type === 'avatar' ? 'circle' : 'rect'}
        onCropComplete={uploadCroppedImage}
        title={cropperState.type === 'avatar' ? t('cropAvatar') : t('cropCover')}
      />
    </div>
  </AppLayout>
);

};

export default EditProfile;
