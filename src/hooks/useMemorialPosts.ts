import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadMedia } from '@/lib/r2Upload';

export interface MemorialPost {
  id: string;
  family_member_id: string;
  created_by: string;
  media_url: string | null;
  media_type: string | null;
  caption: string | null;
  created_at: string;
}

export function useMemorialPosts(familyMemberId: string | undefined) {
  const [posts, setPosts] = useState<MemorialPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!familyMemberId) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('memorial_posts')
      .select('*')
      .eq('family_member_id', familyMemberId)
      .order('created_at', { ascending: false });
    setPosts((data || []) as MemorialPost[]);
    setLoading(false);
  }, [familyMemberId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  async function addPost(file: File, caption: string) {
    if (!familyMemberId) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Upload to R2 via edge function
    const mediaUrl = await uploadMedia(file, 'memorial', user.id);

    const { data: newPost } = await (supabase as any)
      .from('memorial_posts')
      .insert({
        family_member_id: familyMemberId,
        created_by: user.id,
        media_url: mediaUrl,
        media_type: file.type.startsWith('video') ? 'video' : 'image',
        caption: caption || '',
      })
      .select()
      .single();

    if (newPost) {
      setPosts(prev => [newPost as MemorialPost, ...prev]);
    }
    return newPost;
  }

  return { posts, loading, addPost, refetch: fetchPosts };
}
