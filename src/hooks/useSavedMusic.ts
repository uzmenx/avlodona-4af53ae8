import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type SavedMusicRow = {
  id: string;
  user_id: string;
  audio_url: string;
  audio_title: string | null;
  audio_artist: string | null;
  created_at: string;
};

export function useSavedMusic() {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedMusicRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const savedUrlSet = useMemo(() => new Set(items.map((i) => i.audio_url)), [items]);

  const fetchSaved = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('saved_tracks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data || []) as SavedMusicRow[]);
    } catch (e) {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchSaved();
  }, [fetchSaved]);

  const isSaved = useCallback(
    (audioUrl?: string | null) => {
      if (!audioUrl) return false;
      return savedUrlSet.has(audioUrl);
    },
    [savedUrlSet]
  );

  const save = useCallback(
    async (payload: { audio_url: string; audio_title?: string | null; audio_artist?: string | null }) => {
      if (!user) return;
      await (supabase as any).from('saved_tracks').upsert(
        {
          user_id: user.id,
          audio_url: payload.audio_url,
          audio_title: payload.audio_title ?? null,
          audio_artist: payload.audio_artist ?? null,
        },
        { onConflict: 'user_id,audio_url' }
      );
      await fetchSaved();
    },
    [fetchSaved, user]
  );

  const unsave = useCallback(
    async (audioUrl: string) => {
      if (!user) return;
      await (supabase as any).from('saved_tracks').delete().eq('user_id', user.id).eq('audio_url', audioUrl);
      await fetchSaved();
    },
    [fetchSaved, user]
  );

  return {
    items,
    isLoading,
    fetchSaved,
    isSaved,
    save,
    unsave,
  };
}
