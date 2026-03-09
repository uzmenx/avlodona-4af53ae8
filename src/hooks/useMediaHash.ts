import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

async function computeFileHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const useMediaHash = () => {
  const { user } = useAuth();

  const checkDuplicate = useCallback(async (file: File | Blob): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      const hash = await computeFileHash(file);
      const { data } = await supabase
        .from('media_hashes')
        .select('file_url')
        .eq('user_id', user.id)
        .eq('file_hash', hash)
        .maybeSingle();
      return data?.file_url || null;
    } catch {
      return null;
    }
  }, [user?.id]);

  const registerMedia = useCallback(async (file: File | Blob, url: string) => {
    if (!user?.id) return;
    try {
      const hash = await computeFileHash(file);
      await supabase.from('media_hashes').upsert({
        user_id: user.id,
        file_hash: hash,
        file_url: url,
        file_size: file.size,
      }, { onConflict: 'user_id,file_hash' });
    } catch (e) {
      console.warn('Failed to register media hash:', e);
    }
  }, [user?.id]);

  return { checkDuplicate, registerMedia };
};
