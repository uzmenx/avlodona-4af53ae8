import { useState, useCallback, useEffect, useRef } from 'react';
import { FamilyMember, AddMemberData, MergedProfileInfo } from '@/types/family';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

  // Load data based on family_network_id (to see merged trees)
  const loadData = useCallback(async (isInitial = true) => {
    if (!user?.id) return;
    
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      // First, get user's network ID
      const userNetworkId = await getOrCreateNetworkId();
      setNetworkId(userNetworkId);
      
      if (!userNetworkId) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      
      // Get all users in the same network
      const { data: networkUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_network_id', userNetworkId);
      
      const userIds = networkUsers?.map(u => u.id) || [user.id];
      
      // Load members from ALL users in the network
      const [membersRes, positionsRes] = await Promise.all([
        supabase.from('family_tree_members').select('*').in('owner_id', userIds),
        supabase.from('node_positions').select('*').eq('owner_id', user.id) // Positions are still per-user
      ]);

      if (membersRes.error) throw membersRes.error;
      if (positionsRes.error) throw positionsRes.error;

      const dbMembers = membersRes.data || [];
      const dbPositions = positionsRes.data || [];

      // Build positions map
      const posMap = new Map<string, { x: number; y: number }>();
      dbPositions.forEach((p: any) => {
        posMap.set(p.member_id, { x: p.x, y: p.y });
      });

      // Build members map - first pass: create all members (exclude merged ones)
      const membersMap: Record<string, FamilyMember> = {};
      const mergedMap = new Map<string, string>(); // sourceId -> targetId (merged into)
      const mergedProfilesMap = new Map<string, MergedProfileInfo[]>(); // primaryId -> merged profiles
      
      // First, identify merged members and collect their data
      dbMembers.forEach((m: any) => {
        const relType = m.relation_type || '';
        const mergedMatch = relType.match(/merged_into_([a-f0-9-]+)/);
        if (mergedMatch) {
          mergedMap.set(m.id, mergedMatch[1]);
          const targetId = mergedMatch[1];
          const existing = mergedProfilesMap.get(targetId) || [];
          existing.push({
            id: m.id,
            name: m.member_name || '',
            photoUrl: m.avatar_url || undefined,
            gender: (m.gender as 'male' | 'female') || 'male',
            ownerName: undefined, // will fill from profiles
            linkedUserId: m.linked_user_id || undefined,
          });
          mergedProfilesMap.set(targetId, existing);
        }
        // Also check merged_into column
        if (m.merged_into) {
          mergedMap.set(m.id, m.merged_into);
          const targetId = m.merged_into;
          // Avoid duplicates
          const existing = mergedProfilesMap.get(targetId) || [];
          if (!existing.some(p => p.id === m.id)) {
            existing.push({
              id: m.id,
              name: m.member_name || '',
              photoUrl: m.avatar_url || undefined,
              gender: (m.gender as 'male' | 'female') || 'male',
              linkedUserId: m.linked_user_id || undefined,
            });
            mergedProfilesMap.set(targetId, existing);
          }
        }
      });
      
      // Create members, skipping merged ones
      dbMembers.forEach((m: any) => {
        // Skip members that are merged into another
        if (mergedMap.has(m.id)) return;
        
        const pos = posMap.get(m.id);
        const mergedInfos = mergedProfilesMap.get(m.id) || [];
        membersMap[m.id] = {
          id: m.id,
          name: m.member_name || '',
          gender: (m.gender as 'male' | 'female') || 'male',
          photoUrl: m.avatar_url || undefined,
          birthYear: m.birth_year ?? undefined,
          deathYear: m.death_year ?? undefined,
          position: pos || { x: 0, y: 0 },
          childrenIds: [],
          parentIds: [],
          linkedUserId: m.linked_user_id || undefined,
          supabaseId: m.id,
          mergedProfiles: mergedInfos.length > 0 ? mergedInfos : undefined,
        };
      });

      // Helper to resolve merged IDs to their source (munosabatlar saqlanadi)
      // Har bir bola o'z ota-onasi bilan qoladi; yetim faqat ikki tomonda ham ota-ona yo'q bo'lsa.
      const resolveId = (id: string): string => {
        return mergedMap.get(id) || id;
      };

      // Second pass: establish ALL relationships from relation_type
      // IMPORTANT: Process ALL members including merged ones to preserve their relationships
      dbMembers.forEach((m: any) => {
        const effectiveId = mergedMap.has(m.id) ? mergedMap.get(m.id)! : m.id;
        // Skip if the effective (resolved) member doesn't exist in our map
        if (!membersMap[effectiveId]) return;
        
        const relType = (m.relation_type || '').split('|')[0];
        
        // Handle spouse relationships (bidirectional)
        if (relType.startsWith('spouse_of_')) {
          const rawPartnerId = relType.replace('spouse_of_', '');
          const partnerId = resolveId(rawPartnerId);
          if (membersMap[partnerId] && membersMap[effectiveId]) {
            membersMap[effectiveId].spouseId = partnerId;
            membersMap[partnerId].spouseId = effectiveId;
          }
        }
        
        // Handle father_of_ relationships
        if (relType.startsWith('father_of_')) {
          const rawChildId = relType.replace('father_of_', '');
          const childId = resolveId(rawChildId);
          if (membersMap[childId] && membersMap[effectiveId]) {
            if (!membersMap[childId].parentIds) membersMap[childId].parentIds = [];
            if (!membersMap[childId].parentIds.includes(effectiveId)) {
              membersMap[childId].parentIds.push(effectiveId);
            }
            if (!membersMap[effectiveId].childrenIds) membersMap[effectiveId].childrenIds = [];
            if (!membersMap[effectiveId].childrenIds.includes(childId)) {
              membersMap[effectiveId].childrenIds.push(childId);
            }
          }
        }
        
        // Handle mother_of_ relationships
        if (relType.startsWith('mother_of_')) {
          const rawChildId = relType.replace('mother_of_', '');
          const childId = resolveId(rawChildId);
          if (membersMap[childId] && membersMap[effectiveId]) {
            if (!membersMap[childId].parentIds) membersMap[childId].parentIds = [];
            if (!membersMap[childId].parentIds.includes(effectiveId)) {
              membersMap[childId].parentIds.push(effectiveId);
            }
            if (!membersMap[effectiveId].childrenIds) membersMap[effectiveId].childrenIds = [];
            if (!membersMap[effectiveId].childrenIds.includes(childId)) {
              membersMap[effectiveId].childrenIds.push(childId);
            }
          }
        }
        
        // Handle child_of_ relationships
        if (relType.startsWith('child_of_')) {
          const match = relType.match(/child_of_([a-f0-9-]+)/);
          if (match) {
            const rawParentId = match[1];
            const parentId = resolveId(rawParentId);
            if (membersMap[parentId] && membersMap[effectiveId]) {
              if (!membersMap[effectiveId].parentIds) membersMap[effectiveId].parentIds = [];
              if (!membersMap[effectiveId].parentIds.includes(parentId)) {
                membersMap[effectiveId].parentIds.push(parentId);
              }
              if (!membersMap[parentId].childrenIds) membersMap[parentId].childrenIds = [];
              if (!membersMap[parentId].childrenIds.includes(effectiveId)) {
                membersMap[parentId].childrenIds.push(effectiveId);
              }
              if (membersMap[parentId].spouseId && membersMap[membersMap[parentId].spouseId!]) {
                const spouseId = membersMap[parentId].spouseId!;
                if (!membersMap[effectiveId].parentIds.includes(spouseId)) {
                  membersMap[effectiveId].parentIds.push(spouseId);
                }
                if (!membersMap[spouseId].childrenIds) membersMap[spouseId].childrenIds = [];
                if (!membersMap[spouseId].childrenIds.includes(effectiveId)) {
                  membersMap[spouseId].childrenIds.push(effectiveId);
                }
              }
            }
          }
        }
      });
      
      // Third pass: infer spouse relationships from shared children
      Object.values(membersMap).forEach((member) => {
        if (member.childrenIds && member.childrenIds.length > 0) {
          member.childrenIds.forEach((childId) => {
            const child = membersMap[childId];
            if (child && child.parentIds && child.parentIds.length >= 2) {
              const otherParentId = child.parentIds.find(pid => pid !== member.id);
              if (otherParentId && membersMap[otherParentId]) {
                const otherParent = membersMap[otherParentId];
                if (member.gender !== otherParent.gender && !member.spouseId) {
                  membersMap[member.id].spouseId = otherParentId;
                  membersMap[otherParentId].spouseId = member.id;
                }
              }
            }
          });
        }
      });
      
      // Fourth pass: link spouse's children
      Object.values(membersMap).forEach((member) => {
        if (member.spouseId && membersMap[member.spouseId]) {
          const spouse = membersMap[member.spouseId];
          const allChildren = new Set([...(member.childrenIds || []), ...(spouse.childrenIds || [])]);
          const childrenArray = Array.from(allChildren);
          membersMap[member.id].childrenIds = childrenArray;
          membersMap[spouse.id].childrenIds = childrenArray;
          
          childrenArray.forEach((childId) => {
            if (membersMap[childId]) {
              if (!membersMap[childId].parentIds) membersMap[childId].parentIds = [];
              if (!membersMap[childId].parentIds.includes(member.id)) {
                membersMap[childId].parentIds.push(member.id);
              }
              if (!membersMap[childId].parentIds.includes(spouse.id)) {
                membersMap[childId].parentIds.push(spouse.id);
              }
            }
          });
        }
      });

      // Smart auto-layout: tree-centered algorithm
      const membersWithoutPos = Object.values(membersMap).filter(m => !posMap.has(m.id));
      const totalMemberCount = Object.keys(membersMap).length;
      // Only run full layout when >40% of nodes are unpositioned (after merge/fresh start)
      const needsFullLayout = totalMemberCount > 0 && membersWithoutPos.length > totalMemberCount * 0.4;
      
      if (needsFullLayout) {
        const VERTICAL_GAP = 200;
        const SPOUSE_GAP = 180;
        const CHILD_GAP = 80; // gap between sibling subtrees
        const MIN_NODE_WIDTH = 140; // minimum width for a single node
        
        // Find root or any starting node
        const selfMemberId = dbMembers.find((m: any) => m.linked_user_id === user.id && membersMap[m.id])?.id;
        const startId = selfMemberId || Object.keys(membersMap)[0];
        
        if (startId && membersMap[startId]) {
          const placed = new Map<string, { x: number; y: number }>();
          
          // Get the "couple unit" for a member (returns [male, female] or [single])
          const getCoupleUnit = (id: string): string[] => {
            const m = membersMap[id];
            if (!m) return [id];
            if (m.spouseId && membersMap[m.spouseId]) {
              const spouse = membersMap[m.spouseId];
              return m.gender === 'male' ? [id, m.spouseId] : [m.spouseId, id];
            }
            return [id];
          };
          
          // Get unique children of a couple unit
          const getCoupleChildren = (ids: string[]): string[] => {
            const childSet = new Set<string>();
            ids.forEach(id => {
              (membersMap[id]?.childrenIds || []).forEach(cid => {
                if (membersMap[cid]) childSet.add(cid);
              });
            });
            return Array.from(childSet);
          };
          
          // Calculate subtree width bottom-up
          const widthCache = new Map<string, number>();
          const calcSubtreeWidth = (id: string, visited: Set<string>): number => {
            if (widthCache.has(id)) return widthCache.get(id)!;
            const unit = getCoupleUnit(id);
            const unitKey = unit.join('-');
            if (visited.has(unitKey)) {
              const w = unit.length > 1 ? SPOUSE_GAP : MIN_NODE_WIDTH;
              widthCache.set(id, w);
              return w;
            }
            visited.add(unitKey);
            
            const children = getCoupleChildren(unit);
            // Group children into their couple units (avoid double counting)
            const childUnits: string[][] = [];
            const seen = new Set<string>();
            children.forEach(cid => {
              if (seen.has(cid)) return;
              const cu = getCoupleUnit(cid);
              cu.forEach(x => seen.add(x));
              childUnits.push(cu);
            });
            
            const ownWidth = unit.length > 1 ? SPOUSE_GAP : MIN_NODE_WIDTH;
            
            if (childUnits.length === 0) {
              widthCache.set(id, ownWidth);
              return ownWidth;
            }
            
            let totalChildWidth = 0;
            childUnits.forEach((cu, i) => {
              totalChildWidth += calcSubtreeWidth(cu[0], visited);
              if (i < childUnits.length - 1) totalChildWidth += CHILD_GAP;
            });
            
            const width = Math.max(ownWidth, totalChildWidth);
            widthCache.set(id, width);
            return width;
          };
          
          // Place a couple unit and all descendants recursively
          const placeSubtree = (rootIds: string[], centerX: number, y: number, visitedUnits: Set<string>) => {
            const unitKey = rootIds.join('-');
            if (visitedUnits.has(unitKey)) return;
            visitedUnits.add(unitKey);
            
            // Place the couple/single node
            if (rootIds.length === 2) {
              // Couple: male left, female right
              const [leftId, rightId] = rootIds;
              if (!placed.has(leftId)) placed.set(leftId, { x: centerX - SPOUSE_GAP / 2, y });
              if (!placed.has(rightId)) placed.set(rightId, { x: centerX + SPOUSE_GAP / 2, y });
            } else {
              if (!placed.has(rootIds[0])) placed.set(rootIds[0], { x: centerX, y });
            }
            
            // Place children below
            const children = getCoupleChildren(rootIds);
            const childUnits: string[][] = [];
            const seen = new Set<string>();
            children.forEach(cid => {
              if (seen.has(cid)) return;
              const cu = getCoupleUnit(cid);
              cu.forEach(x => seen.add(x));
              childUnits.push(cu);
            });
            
            if (childUnits.length === 0) return;
            
            // Calculate total width needed for children
            const childWidths = childUnits.map(cu => calcSubtreeWidth(cu[0], new Set()));
            let totalWidth = 0;
            childWidths.forEach((w, i) => {
              totalWidth += w;
              if (i < childWidths.length - 1) totalWidth += CHILD_GAP;
            });
            
            // Start placing children centered under parent
            let startX = centerX - totalWidth / 2;
            childUnits.forEach((cu, i) => {
              const childCenterX = startX + childWidths[i] / 2;
              placeSubtree(cu, childCenterX, y + VERTICAL_GAP, visitedUnits);
              startX += childWidths[i] + CHILD_GAP;
            });
          };
          
          // BFS upward to find topmost ancestor, then lay out top-down
          const findTopmostAncestor = (id: string): string => {
            let current = id;
            const visited = new Set<string>();
            while (true) {
              visited.add(current);
              const parents = membersMap[current]?.parentIds || [];
              const unvisitedParent = parents.find(pid => !visited.has(pid) && membersMap[pid]);
              if (!unvisitedParent) break;
              current = unvisitedParent;
            }
            return current;
          };
          
          const topAncestor = findTopmostAncestor(startId);
          const topUnit = getCoupleUnit(topAncestor);
          
          // Pre-calculate widths
          calcSubtreeWidth(topUnit[0], new Set());
          
          // Place the entire tree
          placeSubtree(topUnit, 0, 0, new Set());
          
          // Also handle disconnected components
          const allPlacedIds = new Set(placed.keys());
          const unplaced = Object.keys(membersMap).filter(id => !allPlacedIds.has(id) && !posMap.has(id));
          
          if (unplaced.length > 0) {
            // Find disconnected subtrees and lay them out separately
            const processed = new Set<string>();
            let offsetX = (placed.size > 0 ? Math.max(...Array.from(placed.values()).map(p => p.x)) : 0) + 300;
            
            unplaced.forEach(id => {
              if (processed.has(id)) return;
              const subRoot = findTopmostAncestor(id);
              const subUnit = getCoupleUnit(subRoot);
              calcSubtreeWidth(subUnit[0], new Set());
              const subWidth = widthCache.get(subUnit[0]) || MIN_NODE_WIDTH;
              placeSubtree(subUnit, offsetX + subWidth / 2, 0, new Set());
              
              // Mark all newly placed as processed
              placed.forEach((_, pid) => processed.add(pid));
              offsetX += subWidth + 300;
            });
          }
          
          // Save ALL calculated positions (overwrite existing for full consistency)
          const newPositions: { member_id: string; owner_id: string; x: number; y: number; updated_by: string }[] = [];
          placed.forEach((pos, id) => {
            membersMap[id].position = pos;
            newPositions.push({
              member_id: id,
              owner_id: user.id,
              x: pos.x,
              y: pos.y,
              updated_by: CLIENT_ID,
            });
          });
          
          if (newPositions.length > 0) {
            const BATCH_SIZE = 50;
            for (let i = 0; i < newPositions.length; i += BATCH_SIZE) {
              const batch = newPositions.slice(i, i + BATCH_SIZE);
              await supabase.from('node_positions').upsert(batch, { onConflict: 'member_id' });
            }
          }
        }
      }

      setMembers(membersMap);

      // Set root (self member)
      const selfMember = dbMembers.find((m: any) => m.linked_user_id === user.id);
      setRootId(selfMember?.id || dbMembers[0]?.id || null);

    } catch (error) {
      console.error('Error loading family tree:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, getOrCreateNetworkId]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

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
            const p = payload.new as any;
            if (p) pendingUpdatesRef.current.set(p.member_id, { x: p.x, y: p.y });
            return;
          }
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const p = payload.new as any;
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
        x: position.x,
        y: position.y,
        updated_by: CLIENT_ID,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'member_id' });
  }, [user?.id]);

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

    setMembers((prev) => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], ...updates } };
    });

    const dbUpdates: Record<string, any> = {};
    if (updates.name !== undefined) dbUpdates.member_name = updates.name;
    if (updates.photoUrl !== undefined) dbUpdates.avatar_url = updates.photoUrl || null;
    if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
    if (updates.birthYear !== undefined) dbUpdates.birth_year = updates.birthYear ?? null;
    if (updates.deathYear !== undefined) dbUpdates.death_year = updates.deathYear ?? null;

    if (Object.keys(dbUpdates).length > 0) {
      // Update any member the user owns or is linked to
      await supabase
        .from('family_tree_members')
        .update(dbUpdates)
        .eq('id', id)
        .or(`owner_id.eq.${user.id},linked_user_id.eq.${user.id}`);
    }
  }, [user?.id]);

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

  return {
    members,
    rootId,
    isLoading,
    networkId,
    addInitialCouple,
    updateMember,
    updatePosition,
    addParents,
    addSpouse,
    addChild,
    removeMember,
    createSelfNode,
    reload: loadData,
  };
};
