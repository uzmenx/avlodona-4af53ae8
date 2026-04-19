import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StarUsername } from '@/components/user/StarUsername';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadMedia } from '@/lib/r2Upload';
import { Check, AtSign, Users, ChevronRight, X, ChevronLeft, Video, Music, MapPin, Loader2 } from 'lucide-react';
import { MusicPicker, type SelectedMusic } from '@/components/create/MusicPicker';
import InstagramMediaCapture from '@/components/create/InstagramMediaCapture';
import { STORY_RINGS, type StoryRingId } from '@/components/stories/storyRings';
import { StoryRingPreview } from '@/components/stories/StoryRingPreview';
import { useMentionsCollabs } from '@/hooks/useMentionsCollabs';
import { usePostCollections } from '@/hooks/usePostCollections';
import { useStoryHighlights } from '@/hooks/useStoryHighlights';
import { UserSearchPicker } from '@/components/post/UserSearchPicker';
import { startBackgroundPublish } from '@/lib/backgroundPublish';

interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

type Step = 'media' | 'publish';

const CreateContent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const memoryMemberId = searchParams.get('memberId');
  const { user } = useAuth();

  const { collections: postCollections, createCollection: createPostCollection } = usePostCollections();
  const { highlights: storyHighlights, createHighlight: createStoryHighlight } = useStoryHighlights();

  const [step, setStep] = useState<Step>('media');
  const [editedFiles, setEditedFiles] = useState<{file: File;filter: string;}[]>([]);
  const [caption, setCaption] = useState('');
  const [sharePost, setSharePost] = useState(true);
  const [shareStory, setShareStory] = useState(false);
  const [storySelected, setStorySelected] = useState<Set<number>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedRingId, setSelectedRingId] = useState<StoryRingId>('default');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [collabIds, setCollabIds] = useState<string[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showCollabPicker, setShowCollabPicker] = useState(false);
  const [mentionProfiles, setMentionProfiles] = useState<any[]>([]);
  const [collabProfiles, setCollabProfiles] = useState<any[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<SelectedMusic | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const { addMentions, addCollabs } = useMentionsCollabs();

  const [selectedPostCollectionIds, setSelectedPostCollectionIds] = useState<Set<string>>(new Set());
  const [showNewPostCollection, setShowNewPostCollection] = useState(false);
  const [newPostCollectionName, setNewPostCollectionName] = useState('');

  const [selectedStoryHighlightId, setSelectedStoryHighlightId] = useState<string | null>(null);
  const [showNewStoryHighlight, setShowNewStoryHighlight] = useState(false);
  const [newStoryHighlightName, setNewStoryHighlightName] = useState('');

  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<NominatimPlace[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<NominatimPlace | null>(null);

  useEffect(() => {
    if (mentionIds.length > 0) {
      supabase.from('profiles').select('id, name, username, avatar_url').in('id', mentionIds).
      then(({ data }) => setMentionProfiles(data || []));
    } else setMentionProfiles([]);
  }, [mentionIds]);

  useEffect(() => {
    if (collabIds.length > 0) {
      supabase.from('profiles').select('id, name, username, avatar_url').in('id', collabIds).
      then(({ data }) => setCollabProfiles(data || []));
    } else setCollabProfiles([]);
  }, [collabIds]);

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

  const handleMediaFromCapture = useCallback((items: {file: File;filter: string;}[], captureCaption?: string) => {
    setEditedFiles(items);
    if (memoryMemberId && user) {
      startBackgroundPublish({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        userId: user.id,
        files: items.map((m) => m.file),
        storyFiles: [],
        audioFile: null,
        audioMeta: null,
        caption: captureCaption || '',
        sharePost: true,
        shareStory: false,
        ringId: 'default',
        mentionIds: [],
        collabIds: [],
        postCollectionIds: [],
        storyHighlightId: null,
        memoryMemberId
      });
      toast.success('Xotira yuklanmoqda…');
      navigate('/');
    } else {
      if (captureCaption) setCaption(captureCaption);
      setStep('publish');
    }
  }, [memoryMemberId, user, navigate]);

  useEffect(() => {
    if (memoryMemberId) {
      setSharePost(true);
      setShareStory(false);
    }
  }, [memoryMemberId]);

  useEffect(() => {
    if (!shareStory) {
      setStorySelected(new Set());
      return;
    }
    setStorySelected(new Set(editedFiles.map((_, idx) => idx)));
  }, [editedFiles, shareStory]);

  const storyFiles = editedFiles.
  map((m, idx) => ({ m, idx })).
  filter(({ idx }) => storySelected.has(idx)).
  map(({ m }) => m.file);

  const storyPreviewSrc = storyFiles[0] ? URL.createObjectURL(storyFiles[0]) : editedFiles[0] ? URL.createObjectURL(editedFiles[0].file) : '';

  const handleBack = useCallback(() => {
    if (step === 'publish') setStep('media');else
    navigate(-1);
  }, [step, navigate]);

  const handlePublish = async () => {
    if (!user || editedFiles.length === 0) return;
    if (!sharePost && !shareStory) {
      toast.error("Post yoki Story-dan kamida birini tanlang");
      return;
    }
    try {
      const shortLocation = (full: string) => {
        const parts = full.split(',').map((p) => p.trim()).filter(Boolean);
        return parts.slice(Math.max(parts.length - 2, 0)).join(', ');
      };

      const finalCaption = selectedLocation ?
      `${caption || ''}${caption ? '\n\n' : ''}📍 ${shortLocation(selectedLocation.display_name)} || ${selectedLocation.lat},${selectedLocation.lon}` :
      caption || '';

      startBackgroundPublish({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        userId: user.id,
        files: editedFiles.map((m) => m.file),
        storyFiles: shareStory ? storyFiles : [],
        audioFile: null,
        audioMeta: selectedMusic,
        caption: finalCaption,
        sharePost,
        shareStory,
        ringId: selectedRingId,
        mentionIds,
        collabIds,
        postCollectionIds: sharePost ? Array.from(selectedPostCollectionIds) : [],
        storyHighlightId: shareStory ? selectedStoryHighlightId : null,
        memoryMemberId
      });

      toast.success('Yuklanmoqda…');
      navigate('/');
    } catch (err: any) {
      console.error('Publish error:', err);
      toast.error(err.message || "Yuklashda xatolik yuz berdi");
    }
  };

  if (showSuccess) {
    return null;
  }

  if (step === 'media') {
    return (
      <InstagramMediaCapture
        memoryMemberId={memoryMemberId}
        onClose={() => navigate(-1)}
        onNext={handleMediaFromCapture} />);
  }

  // Publish form - minimalist modern design
  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
        <button onClick={handleBack} className="flex items-center gap-0.5 text-sm text-muted-foreground active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold">Yangi post</h1>
        <Button
          size="sm"
          className="h-8 px-4 rounded-full text-xs font-semibold"
          onClick={handlePublish}
          disabled={editedFiles.length === 0}>
          Ulashish
        </Button>
      </header>

      {memoryMemberId && (
        <div className="bg-primary/10 px-4 py-2 border-b border-primary/20 flex items-center gap-2">
          <AtSign className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">Bu post xotira sifatida saqlanadi</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-3 py-3 space-y-3">
          {/* Media preview - horizontal scroll */}
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {editedFiles.map((m, i) =>
            <button
              key={i}
              type="button"
              onClick={() => {
                if (!shareStory) return;
                setStorySelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);else
                  next.add(i);
                  return next;
                });
              }}
              className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-muted">
              
                {m.file.type.startsWith('video/') ?
              <div className="relative w-full h-full">
                    <video src={URL.createObjectURL(m.file)} className="w-full h-full object-cover" />
                    <Video className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow" />
                  </div> :

              <img src={URL.createObjectURL(m.file)} alt="" className="w-full h-full object-cover" />
              }
                {shareStory && storySelected.has(i) &&
              <div className="absolute top-1 left-1 rounded-full bg-black/55 backdrop-blur px-2 py-0.5">
                    <span className="text-[10px] font-semibold text-white">Story</span>
                  </div>
              }
                {shareStory && !storySelected.has(i) &&
              <div className="absolute inset-0 bg-black/35" />
              }
              </button>
            )}
          </div>

          {/* Caption - clean minimal */}
          <div className="py-0 my-[4px]">
            <Textarea
              placeholder="Izoh yozing..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="resize-none text-sm rounded-xl border-border/50 bg-muted/30 focus:bg-background transition-colors min-h-0" />
            
            <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{caption.length}/2200</p>
          </div>

          {/* Tag & Collab - clean rows */}
          {!memoryMemberId && (
            <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/50 my-[3px]">
              <button
                onClick={() => setShowMentionPicker(true)}
                className="w-full flex items-center px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors gap-[10px]">
                
                <AtSign className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left text-xs font-medium">Belgilash</span>
                {mentionIds.length > 0 &&
                <span className="text-[10px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-full">{mentionIds.length}</span>
                }
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              </button>
              <button
                onClick={() => setShowCollabPicker(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors">
                
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left text-xs font-medium">Hamkorlik</span>
                {collabIds.length > 0 &&
                <span className="text-[10px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-full">{collabIds.length}</span>
                }
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              </button>

              {!selectedLocation ?
              <button
                onClick={() => {
                  setShowLocationSearch((prev) => {
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
                className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors">
                
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left text-xs font-medium">Joylashuv qo'shish</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                </button> :

              <div className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-background">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left text-xs font-medium truncate">{selectedLocation.display_name}</span>
                  <button
                  onClick={() => {
                    setSelectedLocation(null);
                    setLocationQuery('');
                    setLocationResults([]);
                    setLocationError(null);
                    setShowLocationSearch(false);
                  }}
                  aria-label="Joylashuvni o'chirish">
                  
                    <X className="h-3.5 w-3.5 text-muted-foreground/70" />
                  </button>
                </div>
              }
            </div>
          )}

          {memoryMemberId && (
            <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/50 my-[3px]">
              {!selectedLocation ?
              <button
                onClick={() => {
                  setShowLocationSearch((prev) => {
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
                className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors">
                
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left text-xs font-medium">Joylashuv qo'shish</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                </button> :

              <div className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-background">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left text-xs font-medium truncate">{selectedLocation.display_name}</span>
                  <button
                  onClick={() => {
                    setSelectedLocation(null);
                    setLocationQuery('');
                    setLocationResults([]);
                    setLocationError(null);
                    setShowLocationSearch(false);
                  }}
                  aria-label="Joylashuvni o'chirish">
                  
                    <X className="h-3.5 w-3.5 text-muted-foreground/70" />
                  </button>
                </div>
              }
            </div>
          )}

          {showLocationSearch && !selectedLocation &&
          <div className="rounded-xl border border-border/50 p-3 space-y-2">
              <div className="relative">
                <Input
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Joy qidiring..."
                className="h-9 text-sm rounded-xl border-border/50 bg-muted/30 focus:bg-background transition-colors pr-9"
                autoFocus />
              
                {locationLoading &&
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
              }
              </div>

              {locationError &&
            <p className="text-xs text-destructive">{locationError}</p>
            }

              {locationResults.length > 0 &&
            <div className="space-y-2">
                  {locationResults.map((p) =>
              <button
                key={p.place_id}
                onClick={() => {
                  setSelectedLocation(p);
                  setShowLocationSearch(false);
                  setLocationResults([]);
                  setLocationError(null);
                }}
                className="w-full text-left px-3 py-2.5 rounded-xl border border-border/50 bg-background hover:bg-muted/30 transition-colors">
                
                      <p className="text-xs font-medium">{p.display_name}</p>
                    </button>
              )}
                </div>
            }

              {!locationLoading && !locationError && locationQuery.trim().length >= 2 && locationResults.length === 0 &&
            <p className="text-xs text-muted-foreground">Hech narsa topilmadi</p>
            }
            </div>
          }

          {/* Audio/Music picker */}
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <button
              onClick={() => setShowMusicPicker(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors">
              
              <Music className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left text-xs font-medium">Musiqa qo'shish</span>
              {selectedMusic &&
              <span className="text-[10px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">
                  {selectedMusic.audio_title}
                </span>
              }
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </button>
          </div>

          {/* Selected chips */}
          {!memoryMemberId && (mentionProfiles.length > 0 || collabProfiles.length > 0) &&
          <div className="flex flex-wrap gap-1.5">
              {mentionProfiles.map((u) =>
            <div key={u.id} className="flex items-center gap-1 px-2 py-0.5 bg-primary/8 rounded-full">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px]">U</AvatarFallback>
                  </Avatar>
                  <StarUsername
                username={u.username || u.name || 'user'}
                textClassName="text-[10px] font-medium text-foreground"
                iconClassName="h-3 w-3" />
              
                  <button onClick={() => setMentionIds((prev) => prev.filter((id) => id !== u.id))}>
                    <X className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
            )}
              {collabProfiles.map((u) =>
            <div key={u.id} className="flex items-center gap-1 px-2 py-0.5 bg-accent/15 rounded-full">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px]">U</AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] font-medium">{u.name || u.username}</span>
                  <button onClick={() => setCollabIds((prev) => prev.filter((id) => id !== u.id))}>
                    <X className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
            )}
            </div>
          }

          {/* Share destination */}
          {!memoryMemberId && (
            <div className="rounded-xl border border-border/50 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Qayerga</p>
              <label className="flex items-center gap-2.5 cursor-pointer py-1.5">
                <Checkbox checked={sharePost} onCheckedChange={(v) => setSharePost(!!v)} className="h-4 w-4" />
                <div className="flex-1">
                  <p className="text-xs font-medium">📸 Post</p>
                </div>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer py-1.5">
                <Checkbox
                  checked={shareStory}
                  onCheckedChange={(v) => {
                    const next = !!v;
                    setShareStory(next);
                    if (next) setStorySelected(new Set(editedFiles.map((_, idx) => idx)));else
                    setStorySelected(new Set());
                  }}
                  className="h-4 w-4" />
                
                <div className="flex-1">
                  <p className="text-xs font-medium">⏳ Story</p>
                  {shareStory &&
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                      {storySelected.size}/{editedFiles.length} tanlandi
                    </p>
                  }
                </div>
              </label>
            </div>
          )}

          {/* Post collections */}
          {!memoryMemberId && sharePost &&
          <div className="rounded-xl border border-border/50 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Post ro'yxati</p>
              <div className="space-y-2">
                {postCollections.map((c) => {
                const selected = selectedPostCollectionIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedPostCollectionIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id);else
                        next.add(c.id);
                        return next;
                      });
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border/50 bg-background hover:bg-muted/30 transition-colors">
                    
                      <span className="text-xs font-medium">{c.name}</span>
                      {selected &&
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                    }
                    </button>);

              })}

                {showNewPostCollection ?
              <div className="flex gap-2">
                    <Input
                  value={newPostCollectionName}
                  onChange={(e) => setNewPostCollectionName(e.target.value)}
                  placeholder="Ro'yxat nomi"
                  className="h-9 text-sm rounded-xl border-border/50 bg-muted/30 focus:bg-background transition-colors"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key !== 'Enter') return;
                    const name = newPostCollectionName.trim();
                    if (!name) return;
                    const created = await createPostCollection(name);
                    if (created?.id) {
                      setSelectedPostCollectionIds((prev) => new Set(prev).add(created.id));
                      setNewPostCollectionName('');
                      setShowNewPostCollection(false);
                    }
                  }} />
                
                    <Button
                  size="sm"
                  className="h-9 rounded-xl"
                  disabled={!newPostCollectionName.trim()}
                  onClick={async () => {
                    const name = newPostCollectionName.trim();
                    if (!name) return;
                    const created = await createPostCollection(name);
                    if (created?.id) {
                      setSelectedPostCollectionIds((prev) => new Set(prev).add(created.id));
                      setNewPostCollectionName('');
                      setShowNewPostCollection(false);
                    }
                  }}>
                  
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-xl"
                  onClick={() => {
                    setShowNewPostCollection(false);
                    setNewPostCollectionName('');
                  }}>
                  
                      <X className="h-4 w-4" />
                    </Button>
                  </div> :

              <button
                onClick={() => setShowNewPostCollection(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border/60 text-muted-foreground text-xs hover:bg-muted/20 transition-colors">
                
                    <span className="text-sm leading-none">+</span>
                    Yangi ro'yxat yaratish
                  </button>
              }
              </div>
            </div>
          }

          {/* Story ring selector */}
          {!memoryMemberId && shareStory &&
          <div className="rounded-xl border border-border/50 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Halqa</p>
              <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {STORY_RINGS.map((ring) =>
              <StoryRingPreview
                key={ring.id}
                ringId={ring.id}
                avatarSrc={storyPreviewSrc}
                size="sm"
                selected={selectedRingId === ring.id}
                onClick={() => setSelectedRingId(ring.id)}
                label={ring.label} />

              )}
              </div>
            </div>
          }

          {/* Story collections (highlights) */}
          {!memoryMemberId && shareStory &&
          <div className="rounded-xl border border-border/50 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Story kolleksiya</p>
              <div className="space-y-2">
                {storyHighlights.map((h) => {
                const selected = selectedStoryHighlightId === h.id;
                return (
                  <button
                    key={h.id}
                    onClick={() => setSelectedStoryHighlightId(selected ? null : h.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border/50 bg-background hover:bg-muted/30 transition-colors">
                    
                      <span className="text-xs font-medium">{h.name}</span>
                      {selected &&
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                    }
                    </button>);

              })}

                {showNewStoryHighlight ?
              <div className="flex gap-2">
                    <Input
                  value={newStoryHighlightName}
                  onChange={(e) => setNewStoryHighlightName(e.target.value)}
                  placeholder="Kolleksiya nomi"
                  className="h-9 text-sm rounded-xl border-border/50 bg-muted/30 focus:bg-background transition-colors"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key !== 'Enter') return;
                    const name = newStoryHighlightName.trim();
                    if (!name) return;
                    const created = await createStoryHighlight(name);
                    if (created?.id) {
                      setSelectedStoryHighlightId(created.id);
                      setNewStoryHighlightName('');
                      setShowNewStoryHighlight(false);
                    }
                  }} />
                
                    <Button
                  size="sm"
                  className="h-9 rounded-xl"
                  disabled={!newStoryHighlightName.trim()}
                  onClick={async () => {
                    const name = newStoryHighlightName.trim();
                    if (!name) return;
                    const created = await createStoryHighlight(name);
                    if (created?.id) {
                      setSelectedStoryHighlightId(created.id);
                      setNewStoryHighlightName('');
                      setShowNewStoryHighlight(false);
                    }
                  }}>
                  
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-xl"
                  onClick={() => {
                    setShowNewStoryHighlight(false);
                    setNewStoryHighlightName('');
                  }}>
                  
                      <X className="h-4 w-4" />
                    </Button>
                  </div> :

              <button
                onClick={() => setShowNewStoryHighlight(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border/60 text-muted-foreground text-xs hover:bg-muted/20 transition-colors">
                
                    <span className="text-sm leading-none">+</span>
                    Yangi kolleksiya
                  </button>
              }
              </div>
            </div>
          }

          {/* Big publish button */}
          <Button
            className="w-full h-11 text-sm font-semibold rounded-xl"
            onClick={handlePublish}
            disabled={isUploading || editedFiles.length === 0 || !sharePost && !shareStory}>
            
            {isUploading ?
            <span className="flex items-center gap-2">
                <span className="animate-spin h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                {uploadProgress}%
              </span> :

            sharePost && shareStory ? 'Post & Story' : sharePost ? 'Post ulashish' : 'Story ulashish'
            }
          </Button>
          <div className="h-4" />
        </div>
      </div>

      {showMentionPicker &&
      <UserSearchPicker
        open={showMentionPicker}
        onClose={() => setShowMentionPicker(false)}
        selectedIds={mentionIds}
        onSelectionChange={setMentionIds}
        title="Odamlarni belgilash" />

      }
      {showCollabPicker &&
      <UserSearchPicker
        open={showCollabPicker}
        onClose={() => setShowCollabPicker(false)}
        selectedIds={collabIds}
        onSelectionChange={setCollabIds}
        title="Hamkor qo'shish"
        maxSelection={5} />

      }
      <MusicPicker
        open={showMusicPicker}
        onOpenChange={setShowMusicPicker}
        onSelect={setSelectedMusic}
        selectedMusic={selectedMusic}
        onRemove={() => setSelectedMusic(null)} />
      
    </div>);

};

export default CreateContent;