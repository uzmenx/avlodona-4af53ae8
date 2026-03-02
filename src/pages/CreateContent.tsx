import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StarUsername } from '@/components/user/StarUsername';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadMedia } from '@/lib/r2Upload';
import { Check, AtSign, Users, ChevronRight, X, ChevronLeft, Video, Music } from 'lucide-react';
import { AudioPicker } from '@/components/create/AudioPicker';
import InstagramMediaCapture from '@/components/create/InstagramMediaCapture';
import { STORY_RINGS, type StoryRingId } from '@/components/stories/storyRings';
import { StoryRingPreview } from '@/components/stories/StoryRingPreview';
import { useMentionsCollabs } from '@/hooks/useMentionsCollabs';
import { UserSearchPicker } from '@/components/post/UserSearchPicker';
import { startBackgroundPublish } from '@/lib/backgroundPublish';

type Step = 'media' | 'publish';

const CreateContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('media');
  const [editedFiles, setEditedFiles] = useState<{ file: File; filter: string }[]>([]);
  const [caption, setCaption] = useState('');
  const [sharePost, setSharePost] = useState(true);
  const [shareStory, setShareStory] = useState(false);
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
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const { addMentions, addCollabs } = useMentionsCollabs();

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

  const handleMediaFromCapture = useCallback((items: { file: File; filter: string }[]) => {
    setEditedFiles(items);
    setStep('publish');
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'publish') setStep('media');
    else navigate(-1);
  }, [step, navigate]);

  const handlePublish = async () => {
    if (!user || editedFiles.length === 0) return;
    if (!sharePost && !shareStory) {
      toast.error("Post yoki Story-dan kamida birini tanlang");
      return;
    }
    try {
      startBackgroundPublish({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        userId: user.id,
        files: editedFiles.map((m) => m.file),
        audioFile: selectedAudio || null,
        caption,
        sharePost,
        shareStory,
        ringId: selectedRingId,
        mentionIds,
        collabIds,
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
        onClose={() => navigate(-1)}
        onNext={handleMediaFromCapture}
      />
    );
  }

  // Publish form - minimalist modern design
  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {isUploading && false && (
        <div className="absolute top-0 left-0 right-0 z-50">
          <Progress value={uploadProgress} className="h-0.5 rounded-none" />
        </div>
      )}

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
          disabled={editedFiles.length === 0}
        >
          Ulashish
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-3 py-3 space-y-3">
          {/* Media preview - horizontal scroll */}
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {editedFiles.map((m, i) => (
              <div key={i} className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-muted">
                {m.file.type.startsWith('video/') ? (
                  <div className="relative w-full h-full">
                    <video src={URL.createObjectURL(m.file)} className="w-full h-full object-cover" />
                    <Video className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow" />
                  </div>
                ) : (
                  <img src={URL.createObjectURL(m.file)} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ))}
          </div>

          {/* Caption - clean minimal */}
          <div>
            <Textarea
              placeholder="Izoh yozing..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="resize-none text-sm rounded-xl border-border/50 bg-muted/30 focus:bg-background transition-colors min-h-0"
            />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{caption.length}/2200</p>
          </div>

          {/* Tag & Collab - clean rows */}
          <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/50">
            <button
              onClick={() => setShowMentionPicker(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors"
            >
              <AtSign className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left text-xs font-medium">Belgilash</span>
              {mentionIds.length > 0 && (
                <span className="text-[10px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-full">{mentionIds.length}</span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </button>
            <button
              onClick={() => setShowCollabPicker(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors"
            >
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left text-xs font-medium">Hamkorlik</span>
              {collabIds.length > 0 && (
                <span className="text-[10px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-full">{collabIds.length}</span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </button>
          </div>

          {/* Audio/Music picker */}
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <button
              onClick={() => setShowAudioPicker(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-background hover:bg-muted/30 transition-colors"
            >
              <Music className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left text-xs font-medium">Musiqa qo'shish</span>
              {selectedAudio && (
                <span className="text-[10px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">
                  {selectedAudio.name}
                </span>
              )}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </button>
          </div>
          {selectedAudio && (
            <AudioPicker
              open={false}
              onOpenChange={() => {}}
              onSelect={setSelectedAudio}
              selectedAudio={selectedAudio}
              onRemove={() => setSelectedAudio(null)}
            />
          )}

          {/* Selected chips */}
          {(mentionProfiles.length > 0 || collabProfiles.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {mentionProfiles.map(u => (
                <div key={u.id} className="flex items-center gap-1 px-2 py-0.5 bg-primary/8 rounded-full">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px]">U</AvatarFallback>
                  </Avatar>
                  <StarUsername
                    username={u.username || u.name || 'user'}
                    textClassName="text-[10px] font-medium text-foreground"
                    iconClassName="h-3 w-3"
                  />
                  <button onClick={() => setMentionIds(prev => prev.filter(id => id !== u.id))}>
                    <X className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
              {collabProfiles.map(u => (
                <div key={u.id} className="flex items-center gap-1 px-2 py-0.5 bg-accent/15 rounded-full">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px]">U</AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] font-medium">{u.name || u.username}</span>
                  <button onClick={() => setCollabIds(prev => prev.filter(id => id !== u.id))}>
                    <X className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Share destination */}
          <div className="rounded-xl border border-border/50 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Qayerga</p>
            <label className="flex items-center gap-2.5 cursor-pointer py-1.5">
              <Checkbox checked={sharePost} onCheckedChange={(v) => setSharePost(!!v)} className="h-4 w-4" />
              <div className="flex-1">
                <p className="text-xs font-medium">📸 Post</p>
              </div>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer py-1.5">
              <Checkbox checked={shareStory} onCheckedChange={(v) => setShareStory(!!v)} className="h-4 w-4" />
              <div className="flex-1">
                <p className="text-xs font-medium">⏳ Story</p>
              </div>
            </label>
          </div>

          {/* Story ring selector */}
          {shareStory && (
            <div className="rounded-xl border border-border/50 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Halqa</p>
              <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {STORY_RINGS.map((ring) => (
                  <StoryRingPreview
                    key={ring.id}
                    ringId={ring.id}
                    avatarSrc={editedFiles[0] ? URL.createObjectURL(editedFiles[0].file) : ''}
                    size="sm"
                    selected={selectedRingId === ring.id}
                    onClick={() => setSelectedRingId(ring.id)}
                    label={ring.label}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Big publish button */}
          <Button
            className="w-full h-11 text-sm font-semibold rounded-xl"
            onClick={handlePublish}
            disabled={isUploading || editedFiles.length === 0 || (!sharePost && !shareStory)}
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                {uploadProgress}%
              </span>
            ) : (
              sharePost && shareStory ? 'Post & Story' : sharePost ? 'Post ulashish' : 'Story ulashish'
            )}
          </Button>
          <div className="h-4" />
        </div>
      </div>

      {showMentionPicker && (
        <UserSearchPicker
          open={showMentionPicker}
          onClose={() => setShowMentionPicker(false)}
          selectedIds={mentionIds}
          onSelectionChange={setMentionIds}
          title="Odamlarni belgilash"
        />
      )}
      {showCollabPicker && (
        <UserSearchPicker
          open={showCollabPicker}
          onClose={() => setShowCollabPicker(false)}
          selectedIds={collabIds}
          onSelectionChange={setCollabIds}
          title="Hamkor qo'shish"
          maxSelection={5}
        />
      )}
      <AudioPicker
        open={showAudioPicker}
        onOpenChange={setShowAudioPicker}
        onSelect={setSelectedAudio}
        selectedAudio={selectedAudio}
        onRemove={() => setSelectedAudio(null)}
      />
    </div>
  );
};

export default CreateContent;
