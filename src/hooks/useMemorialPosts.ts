import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadMedia } from '@/lib/r2Upload';

export interface MemorialPostAuthor {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export interface MemorialPost {
  id: string;
  family_member_id: string;
  created_by: string;
  media_url: string | null;
  media_type: string | null;
  caption: string | null;
  created_at: string;
  likes_count?: number;
  views_count?: number;
  author?: MemorialPostAuthor | null;
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
      .select('*, author:profiles!memorial_posts_created_by_fkey(id, name, username, avatar_url)')
      .eq('family_member_id', familyMemberId)
      .order('created_at', { ascending: false });

    // If the join failed, fall back to plain select and do a manual profile lookup
    if (!data || (data.length > 0 && data[0].author === undefined)) {
      const { data: plain } = await (supabase as any)
        .from('memorial_posts')
        .select('*')
        .eq('family_member_id', familyMemberId)
        .order('created_at', { ascending: false });

      const plainPosts = (plain || []) as MemorialPost[];

      // Batch fetch author profiles
      const creatorIds = [...new Set(plainPosts.map((p) => p.created_by))];
      let profiles: MemorialPostAuthor[] = [];
      if (creatorIds.length > 0) {
        const { data: profileData } = await (supabase as any)
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', creatorIds);
        profiles = (profileData || []) as MemorialPostAuthor[];
      }

      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      setPosts(plainPosts.map((p) => ({ ...p, author: profileMap.get(p.created_by) ?? null })));
    } else {
      setPosts((data || []) as MemorialPost[]);
    }

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
      // Fetch author profile for the new post
      const { data: authorData } = await (supabase as any)
        .from('profiles')
        .select('id, name, username, avatar_url')
        .eq('id', user.id)
        .single();

      setPosts(prev => [{ ...newPost as MemorialPost, author: authorData ?? null }, ...prev]);
    }
    return newPost;
  }

  return { posts, loading, addPost, refetch: fetchPosts };
}
