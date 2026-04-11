import { useState, useCallback, useEffect, useRef } from 'react';
import { FamilyMember, AddMemberData, MergedProfileInfo } from '@/types/family';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { parseFamilyTreeData } from '@/utils/treeParser';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Unique client ID to prevent real-time feedback loops
const CLIENT_ID = crypto.randomUUID();
const generateId = () => crypto.randomUUID();

export const useLocalFamilyTree = () => {
  const { user, profile } = useAuth();
  const [members, setMembers] = useState<Record<string, FamilyMember>>({});
  const [rootId, setRootId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [isSharedNetwork, setIsSharedNetwork] = useState(false);
  
  // Prevent updates while dragging
  const isDraggingRef = useRef(false);
  const pendingUpdatesRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Get or create family network for current user
  const getOrCreateNetworkId = useCallback(async (): Promise<string | null> => {
    if (!user?.id) return null;
    
    // Check if user already has a network
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('family_network_id')
      .eq('id', user.id)
      .single();
    
    if (userProfile?.family_network_id) {
      return userProfile.family_network_id;
    }
    
    // Create new network
    const { data: newNetwork, error } = await supabase
      .from('family_networks')
      .insert({})
      .select('id')
      .single();
    
    if (error || !newNetwork) {
      console.error('Error creating network:', error);
      return null;
    }
    
    // Update user profile with network ID
    await supabase
      .from('profiles')
      .update({ family_network_id: newNetwork.id })
      .eq('id', user.id);
    
    return newNetwork.id;
  }, [user?.id]);

  const queryClient = useQueryClient();

  const { data: treeData, isLoading: isQueryLoading, refetch: refetchTree } = useQuery({
    queryKey: ['familyTree', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Not logged in');
      
      const userNetworkId = await getOrCreateNetworkId();
      if (!userNetworkId) throw new Error('No network ID');

      const { data: networkUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_network_id', userNetworkId);
      
      const userIds = networkUsers?.map(u => u.id) || [user.id];
      const isShared = (networkUsers?.length || 1) > 1;

      const [membersRes, positionsRes] = await Promise.all([
        supabase.from('family_tree_members').select('*').in('owner_id', userIds),
        supabase.from('node_positions').select('*').eq('network_id', userNetworkId)
      ]);

      if (membersRes.error) throw membersRes.error;
      if (positionsRes.error) throw positionsRes.error;

      const dbMembers = membersRes.data || [];
      const dbPositions = positionsRes.data || [];

      const { membersMap, rootId: newRootId, newPositions } = parseFamilyTreeData(
        dbMembers,
        dbPositions,
        user.id
      );

      // Save any auto-corrected positions silently in background
      if (newPositions.length > 0) {
        const BATCH_SIZE = 50;
        await Promise.all(
          Array.from({ length: Math.ceil(newPositions.length / BATCH_SIZE) }).map((_, i) => {
            const batch = newPositions.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE).map((pos) => ({
              member_id: pos.member_id,
              owner_id: user.id,
              x: pos.x,
              y: pos.y,
              updated_by: CLIENT_ID,
              network_id: userNetworkId,
            }));
            return supabase.from('node_positions').upsert(batch, { onConflict: 'member_id,network_id' });
          })
        ).catch(err => console.error("Auto-correction save failed:", err));
      }

      return { membersMap, newRootId, userNetworkId, isShared };
    },
    enabled: !!user?.id,
    staleTime: 0, // Always check for updates on remount (navigation)
    gcTime: 10 * 60 * 1000,   // 10 minutes garbage collection
  });

  // Sync data to local editor state when query finishes
  useEffect(() => {
    if (isQueryLoading) {
      if (Object.keys(members).length === 0) setIsLoading(true);
    } else {
      setIsLoading(false);
      setIsRefreshing(false);
    }

    if (treeData && !isDraggingRef.current) {
      setMembers(treeData.membersMap);
      setRootId(treeData.newRootId);
      setNetworkId(treeData.userNetworkId);
      setIsSharedNetwork(treeData.isShared);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeData, isQueryLoading]);

  // Handle case when not logged in
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Keep loadData wrapper for external calls
  const loadData = useCallback(async (isInitial = true) => {
    if (isInitial) setIsLoading(true);
    else setIsRefreshing(true);
    await refetchTree();
  }, [refetchTree]);

  // Listen for manual reload requests
  useEffect(() => {
    const handleReload = () => loadData(false);
    window.addEventListener('family-tree-reload', handleReload);
    return () => window.removeEventListener('family-tree-reload', handleReload);
  }, [loadData]);
 
  // Real-time subscriptions
  useEffect(() => {
    if (!user?.id || !networkId) return;

    const channel = supabase
      .channel('family_tree_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'family_tree_members' },
        (payload) => {
          // Reload on any member change in network (will filter by network in loadData)
          loadData(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'node_positions', filter: `owner_id=eq.${user.id}` },
        (payload) => {
          if (isDraggingRef.current) {
            const p = payload.new as { member_id: string; x: number; y: number; updated_by: string };
            if (p) pendingUpdatesRef.current.set(p.member_id, { x: p.x, y: p.y });
            return;
          }
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const p = payload.new as { member_id: string; x: number; y: number; updated_by: string };
            if (p.updated_by === CLIENT_ID) return;
            
            setMembers((prev) => {
              if (!prev[p.member_id]) return prev;
              return {
                ...prev,
                [p.member_id]: { ...prev[p.member_id], position: { x: p.x, y: p.y } },
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, networkId, loadData]);

  // Update position
  const updatePosition = useCallback(async (memberId: string, position: { x: number; y: number }) => {
    if (!user?.id) return;
    
    isDraggingRef.current = false;

    pendingUpdatesRef.current.forEach((pos, id) => {
      if (id !== memberId) {
        setMembers((prev) => {
          if (!prev[id]) return prev;
          return { ...prev, [id]: { ...prev[id], position: pos } };
        });
      }
    });
    pendingUpdatesRef.current.clear();

    setMembers((prev) => {
      if (!prev[memberId]) return prev;
      return { ...prev, [memberId]: { ...prev[memberId], position } };
    });

    await supabase
      .from('node_positions')
      .upsert({
        member_id: memberId,
        owner_id: user.id,
        network_id: networkId,
        x: position.x,
        y: position.y,
        updated_by: CLIENT_ID,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'member_id,network_id' });
      
    // Invalidate query to ensure cache stays synced with local state
    queryClient.invalidateQueries({ queryKey: ['familyTree', user.id] });
  }, [user?.id, networkId, queryClient]);

  // Add initial couple
  const addInitialCouple = useCallback(async () => {
    if (!user?.id) return { husbandId: '', wifeId: '' };

    const husbandId = generateId();
    const wifeId = generateId();

    try {
      await supabase.from('family_tree_members').insert([
        {
          id: husbandId,
          owner_id: user.id,
          member_name: '',
          gender: 'male',
          relation_type: 'self',
          is_placeholder: true,
          avatar_url: null,
          birth_year: null,
          death_year: null,
        },
        {
          id: wifeId,
          owner_id: user.id,
          member_name: '',
          gender: 'female',
          relation_type: `spouse_of_${husbandId}`,
          is_placeholder: true,
          avatar_url: null,
          birth_year: null,
          death_year: null,
        },
      ]);

      await supabase.from('node_positions').insert([
        { member_id: husbandId, owner_id: user.id, x: 0, y: 0, updated_by: CLIENT_ID },
        { member_id: wifeId, owner_id: user.id, x: 180, y: 0, updated_by: CLIENT_ID },
      ]);

      setMembers({
        [husbandId]: {
          id: husbandId,
          name: '',
          gender: 'male',
          spouseId: wifeId,
          position: { x: 0, y: 0 },
          childrenIds: [],
          birthYear: undefined,
          deathYear: undefined,
          photoUrl: undefined,
        },
        [wifeId]: {
          id: wifeId,
          name: '',
          gender: 'female',
          spouseId: husbandId,
          position: { x: 180, y: 0 },
          childrenIds: [],
          birthYear: undefined,
          deathYear: undefined,
          photoUrl: undefined,
        },
      });
      setRootId(husbandId);

      return { husbandId, wifeId };
    } catch (error) {
      console.error('Error creating initial couple:', error);
      return { husbandId: '', wifeId: '' };
    }
  }, [user?.id]);

  // Update member info
  const updateMember = useCallback(async (id: string, updates: Partial<FamilyMember>) => {
    if (!user?.id) return;

    // Get current member to find linkedUserId
    const currentMember = members[id];
    const linkedUserId = currentMember?.linkedUserId;

    setMembers((prev) => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], ...updates } };
    });

    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.member_name = updates.name;
    if (updates.photoUrl !== undefined) dbUpdates.avatar_url = updates.photoUrl || null;
    if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
    if (updates.birthYear !== undefined) dbUpdates.birth_year = updates.birthYear ?? null;
    if (updates.deathYear !== undefined) dbUpdates.death_year = updates.deathYear ?? null;
    if (updates.coverUrl !== undefined) dbUpdates.cover_url = updates.coverUrl || null;

    if (Object.keys(dbUpdates).length > 0) {
      if (linkedUserId) {
        // Sync across ALL trees that have this linked user
        await supabase
          .from('family_tree_members')
          .update(dbUpdates)
          .eq('linked_user_id', linkedUserId);

        // If this IS our own linked profile, also update the main profiles table
        if (linkedUserId === user.id) {
          const profileUpdates: Record<string, unknown> = {};
          if (updates.name !== undefined) profileUpdates.name = updates.name;
          if (updates.photoUrl !== undefined) profileUpdates.avatar_url = updates.photoUrl || null;
          if (updates.coverUrl !== undefined) profileUpdates.cover_url = updates.coverUrl || null;

          if (Object.keys(profileUpdates).length > 0) {
            await supabase.from('profiles').update(profileUpdates).eq('id', user.id);
          }
        }
      } else {
        // Regular non-linked member: update only the specific row
        await supabase
          .from('family_tree_members')
          .update(dbUpdates)
          .eq('id', id)
          .or(`owner_id.eq.${user.id},linked_user_id.eq.${user.id}`);
      }
    }
  }, [user?.id, members]);

  // Remove member
  const removeMember = useCallback(async (id: string) => {
    if (!user?.id) return;

    setMembers((prev) => {
      const member = prev[id];
      if (!member) return prev;

      const next = { ...prev };
      delete next[id];

      if (member.spouseId && next[member.spouseId]) {
        next[member.spouseId] = { ...next[member.spouseId], spouseId: undefined };
      }
      member.parentIds?.forEach((pid) => {
        if (next[pid]) {
          next[pid] = { ...next[pid], childrenIds: next[pid].childrenIds?.filter((c) => c !== id) };
        }
      });
      member.childrenIds?.forEach((cid) => {
        if (next[cid]) {
          next[cid] = { ...next[cid], parentIds: next[cid].parentIds?.filter((p) => p !== id) };
        }
      });

      return next;
    });

    await supabase.from('family_tree_members').delete().eq('id', id).eq('owner_id', user.id);
  }, [user?.id]);

  // Add parents
  const addParents = useCallback(async (childId: string, fatherData: AddMemberData, motherData: AddMemberData) => {
    if (!user?.id) return { fatherId: '', motherId: '' };

    const child = members[childId];
    const childPos = child?.position || { x: 0, y: 0 };
    const fatherId = generateId();
    const motherId = generateId();

    const fatherPos = { x: childPos.x - 90, y: childPos.y - 200 };
    const motherPos = { x: childPos.x + 90, y: childPos.y - 200 };

    try {
      await supabase.from('family_tree_members').insert([
        {
          id: fatherId,
          owner_id: user.id,
          member_name: fatherData.name || '',
          gender: 'male',
          relation_type: `father_of_${childId}`,
          is_placeholder: true,
          avatar_url: fatherData.photoUrl || null,
          birth_year: fatherData.birthYear ?? null,
          death_year: fatherData.deathYear ?? null,
        },
        {
          id: motherId,
          owner_id: user.id,
          member_name: motherData.name || '',
          gender: 'female',
          relation_type: `mother_of_${childId}`,
          is_placeholder: true,
          avatar_url: motherData.photoUrl || null,
          birth_year: motherData.birthYear ?? null,
          death_year: motherData.deathYear ?? null,
        },
      ]);

      await supabase.from('node_positions').insert([
        { member_id: fatherId, owner_id: user.id, x: fatherPos.x, y: fatherPos.y, updated_by: CLIENT_ID },
        { member_id: motherId, owner_id: user.id, x: motherPos.x, y: motherPos.y, updated_by: CLIENT_ID },
      ]);

      setMembers((prev) => ({
        ...prev,
        [fatherId]: {
          id: fatherId,
          name: fatherData.name || '',
          gender: 'male',
          spouseId: motherId,
          position: fatherPos,
          childrenIds: [childId],
          photoUrl: fatherData.photoUrl,
          birthYear: fatherData.birthYear,
          deathYear: fatherData.deathYear,
        },
        [motherId]: {
          id: motherId,
          name: motherData.name || '',
          gender: 'female',
          spouseId: fatherId,
          position: motherPos,
          childrenIds: [childId],
          photoUrl: motherData.photoUrl,
          birthYear: motherData.birthYear,
          deathYear: motherData.deathYear,
        },
        [childId]: { ...prev[childId], parentIds: [fatherId, motherId] },
      }));

      return { fatherId, motherId };
    } catch (error) {
      console.error('Error adding parents:', error);
      return { fatherId: '', motherId: '' };
    }
  }, [user?.id, members]);

  // Add spouse
  const addSpouse = useCallback(async (memberId: string, spouseData: AddMemberData) => {
    const member = members[memberId];
    if (!member || !user?.id) return null;

    const spouseId = generateId();
    const memberPos = member.position || { x: 0, y: 0 };
    const spousePos = { x: memberPos.x + (member.gender === 'male' ? 180 : -180), y: memberPos.y };

    try {
      await supabase.from('family_tree_members').insert({
        id: spouseId,
        owner_id: user.id,
        member_name: spouseData.name || '',
        gender: spouseData.gender,
        relation_type: `spouse_of_${memberId}`,
        is_placeholder: true,
        avatar_url: spouseData.photoUrl || null,
        birth_year: spouseData.birthYear ?? null,
        death_year: spouseData.deathYear ?? null,
      });

      await supabase.from('node_positions').insert({
        member_id: spouseId,
        owner_id: user.id,
        x: spousePos.x,
        y: spousePos.y,
        updated_by: CLIENT_ID,
      });

      setMembers((prev) => ({
        ...prev,
        [memberId]: { ...prev[memberId], spouseId },
        [spouseId]: {
          id: spouseId,
          name: spouseData.name || '',
          gender: spouseData.gender,
          spouseId: memberId,
          position: spousePos,
          childrenIds: [],
          photoUrl: spouseData.photoUrl,
          birthYear: spouseData.birthYear,
          deathYear: spouseData.deathYear,
        },
      }));

      return spouseId;
    } catch (error) {
      console.error('Error adding spouse:', error);
      return null;
    }
  }, [user?.id, members]);

  // Add child
  const addChild = useCallback(async (parentId: string, childData: AddMemberData) => {
    const parent = members[parentId];
    if (!parent || !user?.id) return null;

    const childId = generateId();
    const parentPos = parent.position || { x: 0, y: 0 };
    const spousePos = parent.spouseId ? members[parent.spouseId]?.position : null;
    
    const centerX = spousePos ? (parentPos.x + spousePos.x) / 2 : parentPos.x;
    const siblingCount = parent.childrenIds?.length || 0;
    const childPos = { x: centerX + (siblingCount * 150), y: parentPos.y + 200 };

    const parentIds = parent.spouseId ? [parentId, parent.spouseId] : [parentId];

    try {
      await supabase.from('family_tree_members').insert({
        id: childId,
        owner_id: user.id,
        member_name: childData.name || '',
        gender: childData.gender,
        relation_type: `child_of_${parentId}_${siblingCount + 1}`,
        is_placeholder: true,
        avatar_url: childData.photoUrl || null,
        birth_year: childData.birthYear ?? null,
        death_year: childData.deathYear ?? null,
      });

      await supabase.from('node_positions').insert({
        member_id: childId,
        owner_id: user.id,
        x: childPos.x,
        y: childPos.y,
        updated_by: CLIENT_ID,
      });

      setMembers((prev) => {
        const updates: Record<string, FamilyMember> = {
          [childId]: {
            id: childId,
            name: childData.name || '',
            gender: childData.gender,
            parentIds,
            position: childPos,
            childrenIds: [],
            photoUrl: childData.photoUrl,
            birthYear: childData.birthYear,
            deathYear: childData.deathYear,
          },
        };
        
        parentIds.forEach((pid) => {
          if (prev[pid]) {
            updates[pid] = { ...prev[pid], childrenIds: [...(prev[pid].childrenIds || []), childId] };
          }
        });

        return { ...prev, ...updates };
      });

      return childId;
    } catch (error) {
      console.error('Error adding child:', error);
      return null;
    }
  }, [user?.id, members]);

  // Create self node - with DB-level duplicate check
  const creatingSelfRef = useRef(false);
  const createSelfNode = useCallback(async (gender: 'male' | 'female') => {
    if (!user?.id) return null;

    // Prevent concurrent calls (double-click / race condition)
    if (creatingSelfRef.current) return null;
    creatingSelfRef.current = true;

    try {
      // Check local state
      const existingMembers = Object.values(members);
      const selfExists = existingMembers.some(m => m.linkedUserId === user.id);
      if (selfExists) return null;

      // DB-level check: does a self node already exist for this user?
      const { data: existing } = await supabase
        .from('family_tree_members')
        .select('id')
        .eq('owner_id', user.id)
        .eq('linked_user_id', user.id)
        .limit(1);

      if (existing && existing.length > 0) {
        // Already exists in DB, just reload
        await loadData();
        return existing[0].id;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, username, avatar_url')
        .eq('id', user.id)
        .single();

      const selfId = generateId();
      const memberName = profileData?.name || profileData?.username || "Men";

      await supabase.from('family_tree_members').insert({
        id: selfId,
        owner_id: user.id,
        member_name: memberName,
        gender: gender,
        relation_type: 'self',
        is_placeholder: false,
        linked_user_id: user.id,
        avatar_url: profileData?.avatar_url,
        birth_year: null,
        death_year: null,
      });

      await supabase.from('node_positions').insert({
        member_id: selfId,
        owner_id: user.id,
        x: 0,
        y: 0,
        updated_by: CLIENT_ID,
      });

      setMembers((prev) => ({
        ...prev,
        [selfId]: {
          id: selfId,
          name: memberName,
          gender: gender,
          photoUrl: profileData?.avatar_url || undefined,
          birthYear: undefined,
          deathYear: undefined,
          position: { x: 0, y: 0 },
          childrenIds: [],
          linkedUserId: user.id,
        },
      }));

      setRootId(selfId);
      return selfId;
    } catch (error) {
      console.error('Error creating self node:', error);
      return null;
    } finally {
      creatingSelfRef.current = false;
    }
  }, [user?.id, members, loadData]);

  // Reorder merged profiles
  const reorderMergedProfiles = useCallback(async (newOrderIds: string[]) => {
    if (!user?.id || newOrderIds.length < 2) return;
    
    // newOrderIds[0] is the new primary. The rest should merge into it.
    const newPrimaryId = newOrderIds[0];
    const newMergedIds = newOrderIds.slice(1);

    try {
      // 1. Un-merge the new primary if it was merged into something else (make it the master)
      await supabase
        .from('family_tree_members')
        .update({ merged_into: null })
        .eq('id', newPrimaryId);

      // 2. Point all others to the new primary
      if (newMergedIds.length > 0) {
        await supabase
          .from('family_tree_members')
          .update({ merged_into: newPrimaryId })
          .in('id', newMergedIds);
      }
      
      // Reload the tree
      await loadData(false);
    } catch (error) {
      console.error('Error reordering merged profiles:', error);
    }
  }, [user?.id, loadData]);

  // Detach (fork) network - creates an independent copy of the shared tree
  const detachNetwork = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !networkId) return false;

    try {
      // 1. Get all users in current network
      const { data: networkUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_network_id', networkId);

      const otherUserIds = (networkUsers || [])
        .map(u => u.id)
        .filter(id => id !== user.id);

      if (otherUserIds.length === 0) return false; // Nothing to detach from

      // 2. Load ALL members from other users in the network
      const { data: otherMembers } = await supabase
        .from('family_tree_members')
        .select('*')
        .in('owner_id', otherUserIds);

      if (!otherMembers || otherMembers.length === 0) {
        // Just leave network — create new one
        const { data: newNet } = await supabase
          .from('family_networks')
          .insert({})
          .select('id')
          .single();
        if (newNet) {
          await supabase.from('profiles').update({ family_network_id: newNet.id }).eq('id', user.id);
        }
        await loadData(false);
        return true;
      }

      // 3. Build ID remapping: old other-user member ID -> new cloned ID
      const idMap = new Map<string, string>();
      for (const m of otherMembers) {
        idMap.set(m.id, generateId());
      }

      // Helper to remap an ID in a relation_type string
      const remapRelationType = (relType: string): string => {
        let result = relType;
        idMap.forEach((newId, oldId) => {
          result = result.split(oldId).join(newId);
        });
        return result;
      };

      // 4. Clone records for other users with new IDs, remapped relations, current owner
      const clonedInserts = otherMembers.map(m => ({
        id: idMap.get(m.id as string)!,
        owner_id: user.id,
        member_name: (m.member_name as string) || '',
        gender: (m.gender as string) || 'male',
        avatar_url: (m.avatar_url as string) || null,
        is_placeholder: (m.is_placeholder as boolean) || false,
        merged_into: m.merged_into ? (idMap.get(m.merged_into as string) ?? null) : null,
        relation_type: remapRelationType((m.relation_type as string) || ''),
        linked_user_id: (m.linked_user_id as string) || null,
      }));

      // 5. Current user's own members also need their relation_type remapped (where they reference other members)
      const { data: myMembers } = await supabase
        .from('family_tree_members')
        .select('*')
        .eq('owner_id', user.id);

      const myMemberUpdates = (myMembers || []).map(m => ({
        id: m.id as string,
        relation_type: remapRelationType((m.relation_type as string) || ''),
        merged_into: m.merged_into ? (idMap.get(m.merged_into as string) ?? (m.merged_into as string)) : null,
      }));

      // MUTUAL CLONING for remaining network members:
      // We pick the first other user to own the clones of myMembers in the old network
      const targetOtherId = otherUserIds[0];
      
      const myIdMap = new Map<string, string>();
      for (const m of (myMembers || [])) {
        myIdMap.set(m.id as string, generateId());
      }
      
      const remapMyRelationType = (relType: string): string => {
        let result = relType;
        myIdMap.forEach((newId, oldId) => {
          result = result.split(oldId).join(newId);
        });
        return result;
      };

      const clonedMyMembers = (myMembers || []).map(m => ({
        id: myIdMap.get(m.id as string)!,
        owner_id: targetOtherId,
        member_name: (m.member_name as string) || '',
        gender: (m.gender as string) || 'male',
        avatar_url: (m.avatar_url as string) || null,
        is_placeholder: (m.is_placeholder as boolean) || false,
        merged_into: m.merged_into ? (myIdMap.get(m.merged_into as string) ?? (m.merged_into as string)) : null,
        relation_type: remapMyRelationType((m.relation_type as string) || ''),
        linked_user_id: (m.linked_user_id as string) || null,
      }));
      
      const otherMemberUpdates = otherMembers.map(m => ({
        id: m.id as string,
        relation_type: remapMyRelationType((m.relation_type as string) || ''),
        merged_into: m.merged_into ? (myIdMap.get(m.merged_into as string) ?? (m.merged_into as string)) : null,
      }));

      // 6. Create a new network for the current user
      const { data: newNetwork } = await supabase
        .from('family_networks')
        .insert({})
        .select('id')
        .single();

      if (!newNetwork) throw new Error('Failed to create new network');

      // 7. Insert cloned members + update relations + update profile network
      await Promise.all([
        supabase.from('family_tree_members').insert(clonedInserts),
        supabase.from('family_tree_members').insert(clonedMyMembers),
        ...myMemberUpdates.map(u =>
          supabase.from('family_tree_members')
            .update({ relation_type: u.relation_type, merged_into: u.merged_into })
            .eq('id', u.id)
        ),
        ...otherMemberUpdates.map(u =>
          supabase.from('family_tree_members')
            .update({ relation_type: u.relation_type, merged_into: u.merged_into })
            .eq('id', u.id)
        ),
        supabase.from('profiles').update({ family_network_id: newNetwork.id }).eq('id', user.id),
      ]);

      await loadData(false);
      return true;
    } catch (error) {
      console.error('Error detaching network:', error);
      return false;
    }
  }, [user?.id, networkId, loadData]);

  // Derived counts
  const totalCount = Object.keys(members).length;
  const activeCount = Object.values(members).filter((m) => !!m.linkedUserId).length;

  return {
    members,
    rootId,
    totalCount,
    activeCount,
    isLoading,
    isRefreshing,
    networkId,
    isSharedNetwork,
    addInitialCouple,
    updateMember,
    updatePosition,
    addParents,
    addSpouse,
    addChild,
    removeMember,
    createSelfNode,
    reorderMergedProfiles,
    detachNetwork,
    reload: loadData,
  };
};
