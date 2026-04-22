import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, X, Plus, Check, AtSign, Users, MapPin, Loader2, Music, Navigation, ToggleLeft, ToggleRight, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import InstagramMediaCapture from '@/components/create/InstagramMediaCapture';
import { uploadMedia } from '@/lib/r2Upload';
import { usePostCollections } from '@/hooks/usePostCollections';
import { useMentionsCollabs } from '@/hooks/useMentionsCollabs';
import { UserSearchPicker } from '@/components/post/UserSearchPicker';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarUsername } from "@/components/user/StarUsername";
import { cn } from '@/lib/utils';
import { MusicPicker, type SelectedMusic } from '@/components/create/MusicPicker';

interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
  filter?: string;
  gifOverlays?: Array<{ id: string; url: string; originalUrl?: string; x: number; y: number; scale: number; rotation: number }>;
}

type Step = 'media' | 'caption';

const CreatePost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetMemberId = searchParams.get('memberId');
  const { toast } = useToast();
  const { collections, createCollection, addPostToCollection } = usePostCollections();
  
  const [step, setStep] = useState<Step>('media');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [collabIds, setCollabIds] = useState<string[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showCollabPicker, setShowCollabPicker] = useState(false);
  const [mentionProfiles, setMentionProfiles] = useState<any[]>([]);
  const [collabProfiles, setCollabProfiles] = useState<any[]>([]);
  const { addMentions, addCollabs } = useMentionsCollabs();

  const [selectedMusic, setSelectedMusic] = useState<SelectedMusic | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [targetMemberName, setTargetMemberName] = useState<string | null>(null);

  // Fetch target member name for tribute banner
  useEffect(() => {
    if (!targetMemberId) return;
    supabase
      .from('family_tree_members')
      .select('member_name')
      .eq('id', targetMemberId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.member_name) setTargetMemberName(data.member_name);
      });
  }, [targetMemberId]);

  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<NominatimPlace[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<NominatimPlace | null>(null);
  const [autoLocationEnabled, setAutoLocationEnabled] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const handleMediaFromCapture = (
    items: { file: File; filter: string; gifOverlays?: Array<{ id: string; url: string; originalUrl?: string; x: number; y: number; scale: number; rotation: number }> }[],
    _captionText?: string,
    music?: SelectedMusic | null,
  ) => {
    const newMedia: MediaFile[] = items.map((item) => ({
      file: item.file,
      preview: URL.createObjectURL(item.file),
      type: item.file.type.startsWith('video/') ? 'video' : 'image',
      filter: item.filter,
      gifOverlays: item.gifOverlays,
    }));
    setSelectedMedia(newMedia);
    setSelectedMusic(music || null);
    setStep('caption');
  };

  // Fetch profiles for selected mention/collab users
  useEffect(() => {
    if (mentionIds.length > 0) {
      supabase.from('profiles').select('id, name, username, avatar_url').in('id', mentionIds)
        .then(({ data }) => setMentionProfiles(data || []));
    } else setMentionProfiles([]);
  }, [mentionIds]);

  useEffect(() => {
    if (collabIds.length > 0) {
      supabase.from('profiles').select('id, name, username, avatar_url').in('id', collabIds)
        .then(({ data }) => setCollabProfiles(data || []));
    } else setCollabProfiles([]);
  }, [collabIds]);

  // Auto-detect location on mount if enabled
  const detectCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast({ title: "Xatolik", description: "Geolokatsiya qo'llab-quvvatlanmaydi", variant: "destructive" });
      return;
    }
    setDetectingLocation(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const { latitude, longitude } = pos.coords;
      // Reverse geocode via edge function
      const { data, error } = await supabase.functions.invoke('nominatim-search', {
        body: { 
          lat: latitude.toString(), 
          lon: longitude.toString(),
          reverse: true 
        }
      });

      if (error) throw error;
      if (data && data.length > 0) {
        const place = data[0];
        setSelectedLocation(place);
        setLocationQuery(place.display_name);
        toast({ title: "Manzil aniqlandi", description: place.display_name });
      }
    } catch (err: any) {
      console.error('Auto detect error:', err);
      toast({ title: "Xatolik", description: "Manzilni aniqlab bo'lmadi", variant: "destructive" });
    } finally {
      setDetectingLocation(false);
    }
  }, [toast]);

  // Auto-detect location on mount if enabled
  useEffect(() => {
    const saved = localStorage.getItem('avlodona_auto_location');
    if (saved === 'true') {
      setAutoLocationEnabled(true);
      detectCurrentLocation();
    }
  }, [detectCurrentLocation]);

  const toggleAutoLocation = () => {
    const next = !autoLocationEnabled;
    setAutoLocationEnabled(next);
    localStorage.setItem('avlodona_auto_location', String(next));
    if (next && !selectedLocation) {
      detectCurrentLocation();
    }
  };

  useEffect(() => {
    if (!showLocationSearch) return;
    if (selectedLocation) return;

    const q = locationQuery.trim();
    if (q.length < 2) {
      setLocationResults([]);
      setLocationError(null);
      setLocationLoading(false);
      return;
    }

    const t = window.setTimeout(async () => {
      setLocationLoading(true);
      setLocationError(null);
      try {
        const { data, error } = await supabase.functions.invoke('nominatim-search', {
          body: { q, limit: 5, lang: 'uz' },
        });
        if (error) throw error;
        setLocationResults(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setLocationResults([]);
        setLocationError(e?.message || 'Joy qidirishda xatolik');
      } finally {
        setLocationLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(t);
    };
  }, [locationQuery, showLocationSearch, selectedLocation]);

  const handleBack = () => {
    if (step === 'caption') setStep('media');
    else navigate(-1);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user) return null;
    try { return await uploadMedia(file, 'posts', user.id); }
    catch (error) { console.error('Upload error:', error); return null; }
  };

  const toggleCollection = (id: string) => {
    setSelectedCollectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    const c = await createCollection(newCollectionName.trim());
    if (c) {
      setSelectedCollectionIds(prev => new Set(prev).add(c.id));
      setNewCollectionName('');
      setShowNewCollection(false);
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    if (selectedMedia.length === 0) {
      toast({ title: "Xatolik", description: "Kamida bitta rasm yoki video tanlang", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const finalContent = selectedLocation
        ? `${content || ''}${content ? '\n\n' : ''}📍 ${selectedLocation.display_name}`
        : (content || '');

      const uploadPromises = selectedMedia.map(media => uploadFile(media.file));
      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter((url): url is string => url !== null);
      
      if (validUrls.length === 0) throw new Error('Media yuklashda xatolik');

      const { data: post, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: finalContent || null,
          media_urls: validUrls,
          audio_url: selectedMusic?.audio_url ?? null,
          audio_title: selectedMusic?.audio_title ?? null,
          audio_artist: selectedMusic?.audio_artist ?? null,
          target_member_id: targetMemberId || null,
          visibility: targetMemberId ? 'profile' : 'public',
          // Store GIF overlay metadata per media index so they can be displayed as live animated overlays
          media_metadata: selectedMedia.some(m => m.gifOverlays?.length)
            ? selectedMedia.map(m => ({ gifOverlays: m.gifOverlays || [] }))
            : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to selected collections
      if (post) {
        for (const colId of selectedCollectionIds) {
          await addPostToCollection(colId, post.id);
        }

        // Parse @mentions from caption text
        const captionMentionUsernames = (content.match(/@(\w+)/g) || []).map(m => m.slice(1));
        const allMentionIds = [...mentionIds];
        
        if (captionMentionUsernames.length > 0) {
          const { data: mentionedProfiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('username', captionMentionUsernames);
          
          if (mentionedProfiles) {
            for (const p of mentionedProfiles) {
              if (p.id !== user.id && !allMentionIds.includes(p.id)) {
                allMentionIds.push(p.id);
              }
            }
          }
        }

        // Add mentions and collabs
        if (allMentionIds.length > 0) {
          await addMentions(post.id, allMentionIds);
        }
        if (collabIds.length > 0) {
          await addCollabs(post.id, collabIds);
        }
      }

      selectedMedia.forEach(media => URL.revokeObjectURL(media.preview));
      toast({ title: "Muvaffaqiyat!", description: "Post joylandi" });
      navigate('/');
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({ title: "Xatolik", description: error.message || "Post yaratishda xatolik yuz berdi", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout showNav={false}>
      {step === 'media' ? (
        <InstagramMediaCapture
          onClose={() => navigate(-1)}
          onNext={handleMediaFromCapture}
        />
      ) : (
      <div className="max-w-lg mx-auto min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-40 flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-lg font-semibold">Nashr qilish</h1>
          <Button className="font-semibold" onClick={handlePublish} disabled={isLoading}>
            {isLoading ? "Yuklanmoqda..." : "Ulashish"}
          </Button>
        </header>

        {/* Tribute banner */}
        {targetMemberId && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-sm text-primary">
              <span className="font-medium">{targetMemberName || 'A\'zo'}</span> uchun xotira post
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-4">
          <div className="space-y-4">
            {/* Preview */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {selectedMedia.map((media, index) => (
                <div key={index} className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted">
                  {media.type === 'image' ? (
                    <img src={media.preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <video src={media.preview} className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>
            
            {/* Caption */}
            <div className="space-y-2">
              <Textarea placeholder="Izoh yozing... @username bilan belgilang (ixtiyoriy)" value={content} onChange={(e) => setContent(e.target.value)} rows={4} className="resize-none text-base" />
              <p className="text-xs text-muted-foreground text-right">{content.length}/2200</p>
            </div>

            {/* Mention & Collab buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowMentionPicker(true)}
                className={cn(
                  "flex-1 flex items-center gap-2 px-3 py-3 rounded-xl border transition-colors",
                  mentionIds.length > 0 ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                )}
              >
                <AtSign className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Belgilash</p>
                  <p className="text-xs text-muted-foreground">
                    {mentionIds.length > 0 ? `${mentionIds.length} kishi` : 'Tag'}
                  </p>
                </div>
              </button>
              <button
                onClick={() => setShowCollabPicker(true)}
                className={cn(
                  "flex-1 flex items-center gap-2 px-3 py-3 rounded-xl border transition-colors",
                  collabIds.length > 0 ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                )}
              >
                <Users className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Hamkorlik</p>
                  <p className="text-xs text-muted-foreground">
                    {collabIds.length > 0 ? `${collabIds.length} hamkor` : 'Collab'}
                  </p>
                </div>
              </button>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <div className="flex gap-2">
                {!selectedLocation ? (
                  <>
                    <button
                      onClick={() => {
                        setShowLocationSearch(prev => {
                          const next = !prev;
                          if (!next) {
                            setLocationQuery('');
                            setLocationResults([]);
                            setLocationError(null);
                            setLocationLoading(false);
                          }
                          return next;
                        });
                      }}
                      className={cn(
                        "flex-1 flex items-center gap-2 px-3 py-3 rounded-xl border transition-colors",
                        showLocationSearch ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                      )}
                    >
                      <MapPin className="h-5 w-5 text-primary" />
                      <div className="text-left">
                        <p className="text-sm font-semibold">Joylashuv qo'shish</p>
                        <p className="text-xs text-muted-foreground">Qayerda</p>
                      </div>
                    </button>
                    <button
                      onClick={detectCurrentLocation}
                      disabled={detectingLocation}
                      className={cn(
                        "flex items-center gap-2 px-3 py-3 rounded-xl border transition-colors",
                        "border-border hover:bg-muted",
                      )}
                    >
                      {detectingLocation ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : (
                        <Navigation className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-between px-3 py-3 rounded-xl border border-primary bg-primary/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
                      <p className="text-sm font-medium truncate">{selectedLocation.display_name}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedLocation(null);
                        setLocationQuery('');
                        setLocationResults([]);
                        setLocationError(null);
                        setShowLocationSearch(false);
                      }}
                      className="ml-2"
                      aria-label="Joylashuvni o'chirish"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>

              {/* Auto-location toggle */}
              <button
                onClick={toggleAutoLocation}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {autoLocationEnabled ? (
                  <ToggleRight className="h-4 w-4 text-primary" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
                <span>Har doim joylashuvni avtomatik aniqlash</span>
              </button>

              {showLocationSearch && !selectedLocation && (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      placeholder="Joy qidiring..."
                      className="pr-10"
                      autoFocus
                    />
                    {locationLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    )}
                  </div>

                  {locationError && (
                    <p className="text-xs text-destructive">{locationError}</p>
                  )}

                  {locationResults.length > 0 && (
                    <div className="space-y-2">
                      {locationResults.map((p) => (
                        <button
                          key={p.place_id}
                          onClick={() => {
                            setSelectedLocation(p);
                            setShowLocationSearch(false);
                            setLocationResults([]);
                            setLocationError(null);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors"
                        >
                          <p className="text-sm font-medium">{p.display_name}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {!locationLoading && !locationError && locationQuery.trim().length >= 2 && locationResults.length === 0 && (
                    <p className="text-xs text-muted-foreground">Hech narsa topilmadi</p>
                  )}
                </div>
              )}
            </div>

            {/* Music */}
            <div className="space-y-2">
              <button
                onClick={() => setShowMusicPicker(true)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-3 rounded-xl border transition-colors",
                  selectedMusic ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                )}
              >
                <Music className="h-5 w-5 text-primary" />
                <div className="text-left min-w-0 flex-1">
                  <p className="text-sm font-semibold">Musiqa qo'shish</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedMusic ? `${selectedMusic.audio_title} — ${selectedMusic.audio_artist}` : 'Musiqa tanlang'}
                  </p>
                </div>
              </button>
            </div>

            {/* Selected mention/collab chips */}
            {(mentionProfiles.length > 0 || collabProfiles.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {mentionProfiles.map(u => (
                  <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-full">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">U</AvatarFallback>
                    </Avatar>
                    <StarUsername username={u.username || u.name || 'user'} textClassName="text-xs font-medium text-foreground" />
                    <button onClick={() => setMentionIds(prev => prev.filter(id => id !== u.id))}>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
                {collabProfiles.map(u => (
                  <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 bg-accent/20 rounded-full">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">U</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{u.name || u.username}</span>
                    <button onClick={() => setCollabIds(prev => prev.filter(id => id !== u.id))}>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Collection selection */}
            <div className="space-y-2">
              <p className="text-sm font-semibold">Qayerga joylash</p>
              <div className="space-y-2">
                {collections.map(c => (
                  <button
                    key={c.id}
                    onClick={() => toggleCollection(c.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors",
                      selectedCollectionIds.has(c.id) ? "border-primary bg-primary/10" : "border-border"
                    )}
                  >
                    <span className="text-sm font-medium">{c.name}</span>
                    {selectedCollectionIds.has(c.id) && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}

                {showNewCollection ? (
                  <div className="flex gap-2">
                    <input
                      value={newCollectionName}
                      onChange={e => setNewCollectionName(e.target.value)}
                      placeholder="Ro'yxat nomi"
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleCreateCollection()}
                    />
                    <Button size="sm" onClick={handleCreateCollection} disabled={!newCollectionName.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewCollection(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewCollection(true)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground text-sm hover:bg-secondary/50"
                  >
                    <Plus className="h-4 w-4" />
                    Yangi ro'yxat yaratish
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pickers */}
        <UserSearchPicker
          open={showMentionPicker}
          onClose={() => setShowMentionPicker(false)}
          selectedIds={mentionIds}
          onSelectionChange={setMentionIds}
          title="Odamlarni belgilash"
        />
        <UserSearchPicker
          open={showCollabPicker}
          onClose={() => setShowCollabPicker(false)}
          selectedIds={collabIds}
          onSelectionChange={setCollabIds}
          title="Hamkor qo'shish"
          maxSelection={5}
        />
        <MusicPicker
          open={showMusicPicker}
          onOpenChange={setShowMusicPicker}
          onSelect={setSelectedMusic}
          selectedMusic={selectedMusic}
          onRemove={() => setSelectedMusic(null)}
        />
      </div>
      )}
    </AppLayout>
  );
};

export default CreatePost;
