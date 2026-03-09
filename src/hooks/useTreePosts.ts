import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FamilyMember } from '@/types/family';
import { toast } from 'sonner';

export interface TreeOverlay {
  id: string;
  type: 'text' | 'sticker' | 'image';
  content: string; // text content, emoji, or image URL
  x: number;
  y: number;
  scale: number;
  rotation: number;
  fontSize?: number;
  color?: string;
}

export interface TreePost {
  id: string;
  user_id: string;
  title: string;
  tree_data: Record<string, FamilyMember>;
  positions_data: Record<string, { x: number; y: number }>;
  overlays: TreeOverlay[];
  caption: string | null;
  is_published: boolean;
  is_personal: boolean;
  created_at: string;
  updated_at: string;
}

export const useTreePosts = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<TreePost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tree_posts')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setPosts((data || []).map((d: any) => ({
        ...d,
        tree_data: d.tree_data || {},
        positions_data: d.positions_data || {},
        overlays: d.overlays || [],
      })));
    } catch (err) {
      console.error('Error loading tree posts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const createTreePost = useCallback(async (
    members: Record<string, FamilyMember>,
    positions: Record<string, { x: number; y: number }>,
    title?: string,
    isPersonal = false
  ): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('tree_posts')
        .insert({
          user_id: user.id,
          title: title || `Daraxt - ${new Date().toLocaleDateString('uz')}`,
          tree_data: members as any,
          positions_data: positions as any,
          overlays: [] as any,
          is_personal: isPersonal,
        })
        .select('id')
        .single();

      if (error) throw error;
      await loadPosts();
      toast.success('Yangi daraxt yaratildi');
      return data.id;
    } catch (err) {
      console.error('Error creating tree post:', err);
      toast.error('Xatolik yuz berdi');
      return null;
    }
  }, [user?.id, loadPosts]);

  const saveOverlays = useCallback(async (postId: string, overlays: TreeOverlay[]) => {
    if (!user?.id) return;
    try {
      await supabase
        .from('tree_posts')
        .update({ overlays: overlays as any, updated_at: new Date().toISOString() })
        .eq('id', postId)
        .eq('user_id', user.id);
    } catch (err) {
      console.error('Error saving overlays:', err);
    }
  }, [user?.id]);

  const saveCaption = useCallback(async (postId: string, caption: string) => {
    if (!user?.id) return;
    try {
      await supabase
        .from('tree_posts')
        .update({ caption, updated_at: new Date().toISOString() })
        .eq('id', postId)
        .eq('user_id', user.id);
    } catch (err) {
      console.error('Error saving caption:', err);
    }
  }, [user?.id]);

  const publishPost = useCallback(async (postId: string, caption?: string) => {
    if (!user?.id) return false;
    try {
      const updates: any = { 
        is_published: true, 
        updated_at: new Date().toISOString() 
      };
      if (caption !== undefined) updates.caption = caption;
      
      await supabase
        .from('tree_posts')
        .update(updates)
        .eq('id', postId)
        .eq('user_id', user.id);

      await loadPosts();
      toast.success('Daraxt nashr qilindi!');
      return true;
    } catch (err) {
      console.error('Error publishing:', err);
      toast.error('Xatolik yuz berdi');
      return false;
    }
  }, [user?.id, loadPosts]);

  const deletePost = useCallback(async (postId: string) => {
    if (!user?.id) return;
    try {
      await supabase
        .from('tree_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      await loadPosts();
      if (currentPostId === postId) setCurrentPostId(null);
      toast.success("O'chirildi");
    } catch (err) {
      console.error('Error deleting:', err);
      toast.error('Xatolik yuz berdi');
    }
  }, [user?.id, loadPosts, currentPostId]);

  const updateTitle = useCallback(async (postId: string, title: string) => {
    if (!user?.id) return;
    await supabase
      .from('tree_posts')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', postId)
      .eq('user_id', user.id);
    await loadPosts();
  }, [user?.id, loadPosts]);

  const currentPost = posts.find(p => p.id === currentPostId) || null;

  return {
    posts,
    currentPost,
    currentPostId,
    setCurrentPostId,
    isLoading,
    createTreePost,
    saveOverlays,
    saveCaption,
    publishPost,
    deletePost,
    updateTitle,
    loadPosts,
  };
};
