import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FamilyMember } from '@/types/family';
import { TreeOverlay } from '@/hooks/useTreePosts';

export interface FeedTreePost {
  id: string;
  user_id: string;
  title: string | null;
  tree_data: Record<string, FamilyMember>;
  positions_data: Record<string, { x: number; y: number }>;
  overlays: TreeOverlay[];
  caption: string | null;
  created_at: string;
  likes_count: number;
  author?: {
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export const useTreeFeed = () => {
  const [treePosts, setTreePosts] = useState<FeedTreePost[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTreePosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tree_posts')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Tree feed query error:', error);
        throw error;
      }
      if (!data || data.length === 0) { setTreePosts([]); return; }

      // Fetch authors
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Fetch likes counts
      const postIds = data.map(d => d.id);
      const { data: likes } = await supabase
        .from('tree_post_likes')
        .select('tree_post_id')
        .in('tree_post_id', postIds);

      const likesMap = new Map<string, number>();
      ((likes as any[]) || []).forEach((l: any) => {
        likesMap.set(l.tree_post_id, (likesMap.get(l.tree_post_id) || 0) + 1);
      });

      const parsed = data.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        title: d.title,
        tree_data: (typeof d.tree_data === 'string' ? JSON.parse(d.tree_data) : d.tree_data) || {},
        positions_data: (typeof d.positions_data === 'string' ? JSON.parse(d.positions_data) : d.positions_data) || {},
        overlays: (typeof d.overlays === 'string' ? JSON.parse(d.overlays) : d.overlays) || [],
        caption: d.caption,
        created_at: d.created_at,
        likes_count: likesMap.get(d.id) || 0,
        author: profileMap.get(d.user_id) || undefined,
      }));

      console.log('Tree feed loaded:', parsed.length, 'posts');
      setTreePosts(parsed);
    } catch (err) {
      console.error('Error fetching tree feed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTreePosts(); }, [fetchTreePosts]);

  return { treePosts, isLoading, refetch: fetchTreePosts };
};
