import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { uploadMedia } from '@/lib/r2Upload';
import { type StoryRingId } from '@/components/stories/storyRings';
import { useStoryHighlights } from '@/hooks/useStoryHighlights';
import InstagramMediaCapture from '@/components/create/InstagramMediaCapture';

const CreateStory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { autoSaveStoryToHighlight } = useStoryHighlights();
  
  const [isUploading, setIsUploading] = useState(false);
  const [selectedRingId, setSelectedRingId] = useState<StoryRingId>('default');

  const handleMediaFromCapture = useCallback(async (
    items: { file: File; filter: string; gifOverlays?: Array<{ id: string; url: string; originalUrl?: string; x: number; y: number; scale: number; rotation: number }> }[],
    captionText?: string,
    music?: { audio_url: string; audio_title: string; audio_artist?: string } | null,
  ) => {
    const item = items[0];
    if (!item?.file) return;
    const file = item.file;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      toast.error('Faqat rasm yoki video yuklash mumkin');
      return;
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Fayl hajmi juda katta. Maksimum: ${isVideo ? '50MB' : '10MB'}`);
      return;
    }

    if (!user) {
      toast.error('Avval tizimga kiring');
      return;
    }

    setIsUploading(true);
    try {
      const gifOverlays = item.gifOverlays || [];

      const publicUrl = await uploadMedia(file, 'stories', user.id);
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          media_url: publicUrl,
          media_type: mediaType,
          caption: captionText || null,
          ring_id: selectedRingId,
          audio_url: music?.audio_url ?? null,
          audio_title: music?.audio_title ?? null,
          audio_artist: music?.audio_artist ?? null,
          media_metadata: gifOverlays.length > 0 ? { gifOverlays } : null,
        })
        .select()
        .single();

      if (storyError) throw storyError;

      try {
        const { data: followers } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id);

        const followerIds = (followers || []).map((f: any) => f.follower_id).filter(Boolean);
        if (followerIds.length > 0) {
          const rows = followerIds.map((fid: string) => ({
            user_id: fid,
            actor_id: user.id,
            type: 'story',
            post_id: null,
            comment_id: null,
            message_id: null,
            is_read: false,
          }));
          await supabase.from('notifications').insert(rows as any);
        }
      } catch {
        // ignore
      }

      if (storyData) {
        await autoSaveStoryToHighlight(storyData.id, publicUrl, mediaType, captionText || null);
      }

      toast.success('Hikoya yuklandi!');
      navigate('/');
    } catch (error) {
      console.error('Error creating story:', error);
      toast.error('Hikoya yuklashda xatolik yuz berdi');
    } finally {
      setIsUploading(false);
    }
  }, [autoSaveStoryToHighlight, navigate, selectedRingId, user]);

  return (
    <InstagramMediaCapture
      onClose={() => navigate(-1)}
      onNext={handleMediaFromCapture}
      maxItems={1}
      nextLabel="Yuklash"
      isSubmitting={isUploading}
      storyRingId={selectedRingId}
      onStoryRingIdChange={setSelectedRingId}
    />
  );
};

export default CreateStory;
