import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FamilyMember } from '@/types/family';

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
        supabase.from('node_positions').select('*').eq('owner_id', userId),
      ]);

      const dbMembers = membersRes.data || [];
      const dbPositions = posRes.data || [];

      const posMap: Record<string, { x: number; y: number }> = {};
      dbPositions.forEach((p: any) => {
        posMap[p.member_id] = { x: p.x, y: p.y };
      });

      // Build members map (same logic as useLocalFamilyTree)
      const mergedMap = new Map<string, string>();
      const membersMap: Record<string, FamilyMember> = {};

      // Identify merged
      dbMembers.forEach((m: any) => {
        const relType = m.relation_type || '';
        const mergedMatch = relType.match(/merged_into_([a-f0-9-]+)/);
        if (mergedMatch) mergedMap.set(m.id, mergedMatch[1]);
        if (m.merged_into) mergedMap.set(m.id, m.merged_into);
      });

      // Create members
      dbMembers.forEach((m: any) => {
        if (mergedMap.has(m.id)) return;
        membersMap[m.id] = {
          id: m.id,
          name: m.member_name || '',
          gender: (m.gender as 'male' | 'female') || 'male',
          photoUrl: m.avatar_url || undefined,
          position: posMap[m.id] || { x: 0, y: 0 },
          childrenIds: [],
          parentIds: [],
          linkedUserId: m.linked_user_id || undefined,
          supabaseId: m.id,
        };
      });

      const resolveId = (id: string): string => mergedMap.get(id) || id;

      // Build relationships
      dbMembers.forEach((m: any) => {
        const effectiveId = mergedMap.has(m.id) ? mergedMap.get(m.id)! : m.id;
        if (!membersMap[effectiveId]) return;
        const relType = (m.relation_type || '').split('|')[0];

        if (relType.startsWith('spouse_of_')) {
          const partnerId = resolveId(relType.replace('spouse_of_', ''));
          if (membersMap[partnerId] && membersMap[effectiveId]) {
            membersMap[effectiveId].spouseId = partnerId;
            membersMap[partnerId].spouseId = effectiveId;
          }
        }
        if (relType.startsWith('father_of_') || relType.startsWith('mother_of_')) {
          const childId = resolveId(relType.replace(/^(father|mother)_of_/, ''));
          if (membersMap[childId] && membersMap[effectiveId]) {
            if (!membersMap[childId].parentIds) membersMap[childId].parentIds = [];
            if (!membersMap[childId].parentIds.includes(effectiveId))
              membersMap[childId].parentIds.push(effectiveId);
            if (!membersMap[effectiveId].childrenIds) membersMap[effectiveId].childrenIds = [];
            if (!membersMap[effectiveId].childrenIds.includes(childId))
              membersMap[effectiveId].childrenIds.push(childId);
          }
        }
        if (relType.startsWith('child_of_')) {
          const match = relType.match(/child_of_([a-f0-9-]+)/);
          if (match) {
            const parentId = resolveId(match[1]);
            if (membersMap[parentId] && membersMap[effectiveId]) {
              if (!membersMap[effectiveId].parentIds) membersMap[effectiveId].parentIds = [];
              if (!membersMap[effectiveId].parentIds.includes(parentId))
                membersMap[effectiveId].parentIds.push(parentId);
              if (!membersMap[parentId].childrenIds) membersMap[parentId].childrenIds = [];
              if (!membersMap[parentId].childrenIds.includes(effectiveId))
                membersMap[parentId].childrenIds.push(effectiveId);
            }
          }
        }
      });

      // Infer spouse from shared children
      Object.values(membersMap).forEach((member) => {
        (member.childrenIds || []).forEach((childId) => {
          const child = membersMap[childId];
          if (child?.parentIds && child.parentIds.length >= 2) {
            const other = child.parentIds.find(pid => pid !== member.id);
            if (other && membersMap[other] && member.gender !== membersMap[other].gender && !member.spouseId) {
              membersMap[member.id].spouseId = other;
              membersMap[other].spouseId = member.id;
            }
          }
        });
      });

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
