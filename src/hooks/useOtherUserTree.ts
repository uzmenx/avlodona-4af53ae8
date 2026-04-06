import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FamilyMember } from '@/types/family';
import { parseFamilyTreeData } from '@/utils/treeParser';

/**
 * Load another user's family tree (members + positions) for read-only display.
 * Reuses the same relation_type parsing logic from useLocalFamilyTree.
 */
export const useOtherUserTree = (userId: string | undefined) => {
  const [members, setMembers] = useState<Record<string, FamilyMember>>({});
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      // Get user's network
      const { data: prof } = await supabase
        .from('profiles')
        .select('family_network_id')
        .eq('id', userId)
        .single();

      let userIds = [userId];
      if (prof?.family_network_id) {
        const { data: networkUsers } = await supabase
          .from('profiles')
          .select('id')
          .eq('family_network_id', prof.family_network_id);
        if (networkUsers?.length) userIds = networkUsers.map(u => u.id);
      }

      // Load members + positions (use the target user's positions)
      const [membersRes, posRes] = await Promise.all([
        supabase.from('family_tree_members').select('*').in('owner_id', userIds),
        prof?.family_network_id
          ? supabase.from('node_positions').select('*').eq('network_id', prof.family_network_id)
          : supabase.from('node_positions').select('*').eq('owner_id', userId),
      ]);

      const dbMembers = membersRes.data || [];
      const dbPositions = posRes.data || [];

      const { membersMap, posMap } = parseFamilyTreeData(dbMembers, dbPositions, userId);

      setMembers(membersMap);
      setPositions(posMap);
    } catch (err) {
      console.error('Error loading other user tree:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { members, positions, isLoading, reload: load };
};
