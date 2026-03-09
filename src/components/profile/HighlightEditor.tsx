import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Check, Image as ImageIcon } from 'lucide-react';
import { useStoryHighlights, type StoryHighlight } from '@/hooks/useStoryHighlights';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { uploadMedia } from '@/lib/r2Upload';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface HighlightEditorProps {
  highlight?: StoryHighlight;
  open: boolean;
  onClose: () => void;
  isNew?: boolean;
}

interface StoryItem {
  id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
}

export function HighlightEditor({ highlight, open, onClose, isNew }: HighlightEditorProps) {
  const { user } = useAuth();
  const { createHighlight, updateHighlight, deleteHighlight, addItemToHighlight, removeItemFromHighlight, fetchHighlights } = useStoryHighlights();
  const [name, setName] = useState(highlight?.name || new Date().getFullYear().toString());
  const [coverUrl, setCoverUrl] = useState(highlight?.cover_url || '');
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set(highlight?.items.map(i => i.story_id) || []));
  const [allStories, setAllStories] = useState<StoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'selected' | 'stories'>('stories');
  const [isSaving, setIsSaving] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Fetch all past stories (including expired)
  useEffect(() => {
    if (!user || !open) return;
    (async () => {
      const { data } = await supabase
        .from('stories')
        .select('id, media_url, media_type, caption, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setAllStories(data || []);
    })();
  }, [user, open]);

  const toggleStory = (id: string) => {
    setSelectedStoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const url = await uploadMedia(file, 'highlights', user.id);
      setCoverUrl(url);
    } catch (err) {
      toast.error("Rasm yuklashda xatolik");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nom kiriting"); return; }
    setIsSaving(true);
    try {
      if (isNew || !highlight) {
        const created = await createHighlight(name, coverUrl || undefined);
        if (created) {
          for (const storyId of selectedStoryIds) {
            const story = allStories.find(s => s.id === storyId);
            if (story) await addItemToHighlight(created.id, story.id, story.media_url, story.media_type, story.caption);
          }
        }
      } else {
        await updateHighlight(highlight.id, { name, cover_url: coverUrl || null });
        // Sync items: remove deselected, add new
        const existingIds = new Set(highlight.items.map(i => i.story_id));
        for (const item of highlight.items) {
          if (!selectedStoryIds.has(item.story_id)) await removeItemFromHighlight(item.id);
        }
        for (const storyId of selectedStoryIds) {
          if (!existingIds.has(storyId)) {
            const story = allStories.find(s => s.id === storyId);
            if (story) await addItemToHighlight(highlight.id, story.id, story.media_url, story.media_type, story.caption);
          }
        }
      }
      await fetchHighlights();
      toast.success("Saqlandi!");
      onClose();
    } catch (err) {
      toast.error("Xatolik yuz berdi");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!highlight) return;
    await deleteHighlight(highlight.id);
    toast.success("O'chirildi");
    onClose();
  };

  const selectedStories = allStories.filter(s => selectedStoryIds.has(s.id));
  const displayCover = coverUrl || selectedStories[0]?.media_url;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 flex-row items-center justify-between">
          <DialogTitle>{isNew ? 'Yangi highlight' : 'Tahrirlash'}</DialogTitle>
          <div className="flex gap-2">
            {highlight && !isNew && (
              <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? '...' : 'Saqlash'}
            </Button>
          </div>
        </DialogHeader>

        <div className="px-4 space-y-3">
          {/* Cover preview */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => coverInputRef.current?.click()}
              className="w-20 h-20 rounded-full border-2 border-dashed border-border overflow-hidden bg-muted flex items-center justify-center"
            >
              {displayCover ? (
                <img src={displayCover} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </button>
            <button onClick={() => coverInputRef.current?.click()} className="text-xs text-primary">
              Muqova tanlash
            </button>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </div>

          {/* Name */}
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nom" className="text-center font-medium" />
        </div>

        {/* Story selection tabs */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 grid grid-cols-2">
            <TabsTrigger value="selected">Tanlangan ({selectedStoryIds.size})</TabsTrigger>
            <TabsTrigger value="stories">Hikoyalar</TabsTrigger>
          </TabsList>

          <TabsContent value="selected" className="flex-1 overflow-y-auto p-4">
            {selectedStories.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Hikoya tanlanmagan</p>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {selectedStories.map(s => (
                  <StoryThumbnail key={s.id} story={s} selected onClick={() => toggleStory(s.id)} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stories" className="flex-1 overflow-y-auto p-4">
            {allStories.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Hikoyalar topilmadi</p>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {allStories.map(s => (
                  <StoryThumbnail key={s.id} story={s} selected={selectedStoryIds.has(s.id)} onClick={() => toggleStory(s.id)} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function StoryThumbnail({ story, selected, onClick }: { story: StoryItem; selected: boolean; onClick: () => void }) {
  const date = new Date(story.created_at);
  return (
    <button onClick={onClick} className="relative aspect-[9/16] rounded-lg overflow-hidden bg-muted">
      {story.media_type === 'video' ? (
        <video src={story.media_url} className="w-full h-full object-cover" muted />
      ) : (
        <img src={story.media_url} alt="" className="w-full h-full object-cover" />
      )}
      {/* Date badge */}
      <span className="absolute top-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">
        {date.getDate()}/{date.getMonth() + 1}
      </span>
      {/* Selection indicator */}
      <div className={cn(
        "absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center",
        selected ? "bg-primary border-primary" : "border-white/70 bg-black/30"
      )}>
        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
    </button>
  );
}
