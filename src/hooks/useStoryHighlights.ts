import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface StoryHighlight {
  id: string;
  user_id: string;
  name: string;
  cover_url: string | null;
  sort_order: number;
  created_at: string;
  items: StoryHighlightItem[];
}

export interface StoryHighlightItem {
  id: string;
  highlight_id: string;
  story_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export const useStoryHighlights = (userId?: string) => {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<StoryHighlight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const targetUserId = userId || user?.id;

  const fetchHighlights = useCallback(async () => {
    if (!targetUserId) { setHighlights([]); setIsLoading(false); return; }
    
    try {
      const { data, error } = await supabase
        .from('story_highlights')
        .select('*')
        .eq('user_id', targetUserId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        setHighlights([]);
        setIsLoading(false);
        return;
      }

      // Fetch items for all highlights
      const { data: items } = await supabase
        .from('story_highlight_items')
        .select('*')
        .in('highlight_id', data.map(h => h.id))
        .order('sort_order', { ascending: true });

      const highlightsWithItems: StoryHighlight[] = data.map(h => ({
        ...h,
        items: (items || []).filter(i => i.highlight_id === h.id),
      }));

      setHighlights(highlightsWithItems);
    } catch (error) {
      console.error('Error fetching highlights:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  const createHighlight = async (name: string, coverUrl?: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('story_highlights')
      .insert({ user_id: user.id, name, cover_url: coverUrl || null, sort_order: highlights.length })
      .select()
      .single();
    if (error) { console.error(error); return null; }
    await fetchHighlights();
    return data;
  };

  const updateHighlight = async (id: string, updates: { name?: string; cover_url?: string | null }) => {
    const { error } = await supabase.from('story_highlights').update(updates).eq('id', id);
    if (error) console.error(error);
    else await fetchHighlights();
  };

  const deleteHighlight = async (id: string) => {
    const { error } = await supabase.from('story_highlights').delete().eq('id', id);
    if (error) console.error(error);
    else await fetchHighlights();
  };

  const addItemToHighlight = async (highlightId: string, storyId: string, mediaUrl: string, mediaType: string, caption?: string | null) => {
    const { error } = await supabase.from('story_highlight_items').insert({
      highlight_id: highlightId, story_id: storyId, media_url: mediaUrl, media_type: mediaType, caption: caption || null,
    });
    if (error) console.error(error);
    else await fetchHighlights();
  };

  const removeItemFromHighlight = async (itemId: string) => {
    const { error } = await supabase.from('story_highlight_items').delete().eq('id', itemId);
    if (error) console.error(error);
    else await fetchHighlights();
  };

  const autoSaveStoryToHighlight = async (storyId: string, mediaUrl: string, mediaType: string, caption?: string | null) => {
    if (!user) return;
    const year = new Date().getFullYear().toString();
    
    // Find or create year highlight
    let yearHighlight = highlights.find(h => h.name === year);
    if (!yearHighlight) {
      const created = await createHighlight(year);
      if (!created) return;
      yearHighlight = { ...created, items: [] };
    }

    await addItemToHighlight(yearHighlight.id, storyId, mediaUrl, mediaType, caption);
  };

  useEffect(() => { fetchHighlights(); }, [fetchHighlights]);

  return {
    highlights, isLoading, fetchHighlights,
    createHighlight, updateHighlight, deleteHighlight,
    addItemToHighlight, removeItemFromHighlight,
    autoSaveStoryToHighlight,
  };
};
