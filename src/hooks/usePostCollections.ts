import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PostCollection {
  id: string;
  user_id: string;
  name: string;
  cover_url: string | null;
  theme?: number | null;
  sort_order: number;
  created_at: string;
  posts_count?: number;
}

export const usePostCollections = (userId?: string) => {
  const { user } = useAuth();
  const [collections, setCollections] = useState<PostCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [collectionPosts, setCollectionPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const targetUserId = userId || user?.id;

  const fetchCollections = useCallback(async () => {
    if (!targetUserId) { setCollections([]); setIsLoading(false); return; }
    
    try {
      const { data, error } = await supabase
        .from('post_collections')
        .select('*')
        .eq('user_id', targetUserId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setCollections([]);
        setIsLoading(false);
        return;
      }

      // Count items per collection
      const { data: items } = await supabase
        .from('post_collection_items')
        .select('collection_id')
        .in('collection_id', data.map(c => c.id));

      const countMap = new Map<string, number>();
      items?.forEach(i => countMap.set(i.collection_id, (countMap.get(i.collection_id) || 0) + 1));

      setCollections(data.map(c => ({ ...c, posts_count: countMap.get(c.id) || 0 })));
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  const fetchCollectionPosts = useCallback(async (collectionId: string) => {
    const { data: items } = await supabase
      .from('post_collection_items')
      .select('post_id')
      .eq('collection_id', collectionId)
      .order('sort_order', { ascending: true });

    if (!items || items.length === 0) { setCollectionPosts([]); return; }

    const postIds = items.map(i => i.post_id);
    const { data: posts } = await supabase
      .from('posts')
      .select('*')
      .in('id', postIds);

    if (!posts) { setCollectionPosts([]); return; }

    // Get profiles
    const userIds = [...new Set(posts.map(p => p.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', userIds);

    const enriched = posts.map(p => ({
      ...p,
      author: profiles?.find(pr => pr.id === p.user_id) || null,
    }));

    // Maintain order from collection items
    const ordered = postIds.map(pid => enriched.find(p => p.id === pid)).filter(Boolean);
    setCollectionPosts(ordered);
  }, []);

  const createCollection = async (name: string, theme?: number) => {
    if (!user) return null;

    const sort_order = collections.length;
    const themeValue = Number.isFinite(theme as number) ? (theme as number) : (collections.length % 6);

    const attemptWithTheme = await supabase
      .from('post_collections')
      .insert({ user_id: user.id, name, sort_order, theme: themeValue })
      .select()
      .single();

    if (!attemptWithTheme.error) {
      await fetchCollections();
      return attemptWithTheme.data;
    }

    const msg = (attemptWithTheme.error as any)?.message || String(attemptWithTheme.error);
    if (/theme/i.test(msg) && /(column|field)/i.test(msg)) {
      const attemptWithoutTheme = await supabase
        .from('post_collections')
        .insert({ user_id: user.id, name, sort_order })
        .select()
        .single();
      if (attemptWithoutTheme.error) {
        console.error(attemptWithoutTheme.error);
        return null;
      }
      await fetchCollections();
      return attemptWithoutTheme.data;
    }

    console.error(attemptWithTheme.error);
    return null;
  };

  const updateCollection = async (id: string, updates: { name?: string; cover_url?: string | null; theme?: number | null }) => {
    const { error } = await supabase.from('post_collections').update(updates).eq('id', id);
    if (!error) {
      await fetchCollections();
      return;
    }

    const msg = (error as any)?.message || String(error);
    if ('theme' in updates && /theme/i.test(msg) && /(column|field)/i.test(msg)) {
      const { theme: _theme, ...rest } = updates;
      const retry = await supabase.from('post_collections').update(rest).eq('id', id);
      if (!retry.error) await fetchCollections();
      else console.error(retry.error);
      return;
    }

    console.error(error);
  };

  const deleteCollection = async (id: string) => {
    const { error } = await supabase.from('post_collections').delete().eq('id', id);
    if (!error) { await fetchCollections(); if (selectedCollectionId === id) setSelectedCollectionId(null); }
  };

  const addPostToCollection = async (collectionId: string, postId: string) => {
    const { error } = await supabase.from('post_collection_items').insert({ collection_id: collectionId, post_id: postId });
    if (error) console.error(error);
    else await fetchCollections();
  };

  const removePostFromCollection = async (collectionId: string, postId: string) => {
    const { error } = await supabase.from('post_collection_items').delete()
      .eq('collection_id', collectionId).eq('post_id', postId);
    if (!error) await fetchCollections();
  };

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  useEffect(() => {
    if (selectedCollectionId) fetchCollectionPosts(selectedCollectionId);
    else setCollectionPosts([]);
  }, [selectedCollectionId, fetchCollectionPosts]);

  return {
    collections, isLoading, selectedCollectionId, collectionPosts,
    setSelectedCollectionId, fetchCollections,
    createCollection, updateCollection, deleteCollection,
    addPostToCollection, removePostFromCollection, fetchCollectionPosts,
  };
};
