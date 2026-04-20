import { FamilyMember, MergedProfileInfo } from '@/types/family';

export interface ParseResult {
  membersMap: Record<string, FamilyMember>;
  posMap: Record<string, { x: number; y: number }>;
  rootId: string | null;
  newPositions: { member_id: string; x: number; y: number }[];
}

// We can define a basic shape for DBMember to satisfy ESLint
interface DBMember {
  id: string;
  relation_type?: string;
  merged_into?: string;
  member_name?: string;
  avatar_url?: string;
  gender?: string;
  linked_user_id?: string;
  birth_year?: string | number;
  death_year?: string | number;
  cover_url?: string;
  [key: string]: unknown;
}

export function parseFamilyTreeData(
  dbMembers: DBMember[],
  dbPositions: Record<string, unknown>[],
  targetUserId?: string
): ParseResult {
  // Build positions map
  const posMap = new Map<string, { x: number; y: number }>();
  dbPositions.forEach((p) => {
    if (typeof p.member_id === 'string' && typeof p.x === 'number' && typeof p.y === 'number') {
      posMap.set(p.member_id, { x: p.x, y: p.y });
    }
  });

  const membersMap: Record<string, FamilyMember> = {};
  const mergedMap = new Map<string, string>(); // sourceId -> targetId
  const mergedProfilesMap = new Map<string, MergedProfileInfo[]>(); // primaryId -> merged profiles

  // Pass 1a: Build mergedMap ONLY
  dbMembers.forEach((m) => {
    const relType = m.relation_type || '';
    const mergedMatch = relType.match(/merged_into_([a-f0-9-]+)/);
    if (mergedMatch) {
      mergedMap.set(m.id, mergedMatch[1]);
    }
    if (m.merged_into) {
      mergedMap.set(m.id, m.merged_into);
    }
  });

  // Build a set of ALL member IDs present in the data (for validating merge targets)
  const allDbMemberIds = new Set<string>(dbMembers.map((m) => m.id));

  // Helper to resolve merged IDs to their ultimate primary profile
  // SAFETY: if a merge target doesn't exist in the data, return the original ID
  const resolveId = (id: string): string => {
    let current = id;
    const visited = new Set<string>();
    while (mergedMap.has(current) && !visited.has(current)) {
      visited.add(current);
      const next = mergedMap.get(current)!;
      // If the merge target doesn't exist in our data, stop here
      if (!allDbMemberIds.has(next)) {
        console.warn(`[treeParser] Merge target ${next} not found in data for node ${current}. Breaking merge chain.`);
        // Remove the broken merge from the map so the node is shown
        mergedMap.delete(current);
        return current;
      }
      current = next;
    }
    return current;
  };

  // Pass 1b: Collect merged profiles data into the ULTIMATE primary node
  dbMembers.forEach((m) => {
    if (mergedMap.has(m.id)) {
      const targetId = resolveId(m.id);
      // If resolveId broke the chain and returned m.id itself, skip merging
      if (targetId === m.id) return;
      const existing = mergedProfilesMap.get(targetId) || [];
      if (!existing.some((p) => p.id === m.id)) {
        existing.push({
          id: m.id,
          name: m.member_name || '',
          photoUrl: m.avatar_url || undefined,
          gender: (m.gender as 'male' | 'female') || 'male',
          ownerName: undefined,
          linkedUserId: m.linked_user_id || undefined,
        });
        mergedProfilesMap.set(targetId, existing);
      }
    }
  });

  // Pass 1c: Create members, skipping merged ones
  // SAFETY: if a merged node's target doesn't exist, restore it as a standalone node
  dbMembers.forEach((m) => {
    if (mergedMap.has(m.id)) {
      // Double-check: does the merge target exist?
      const targetId = resolveId(m.id);
      if (targetId !== m.id) return; // Target exists, skip this merged node
      // Target doesn't exist — this node was orphaned by a broken merge.
      // Fall through and create it as a normal node.
      console.warn(`[treeParser] Recovering orphaned node: ${m.id} (${m.member_name})`);
    }

    const pos = posMap.get(m.id);
    const mergedInfos = mergedProfilesMap.get(m.id) || [];
    const liveUserId = m.linked_user_id || mergedInfos.find((i) => i.linkedUserId)?.linkedUserId;

    membersMap[m.id] = {
      id: m.id,
      name: m.member_name || '',
      gender: (m.gender as 'male' | 'female') || 'male',
      photoUrl: m.avatar_url || undefined,
      birthYear: (m.birth_year as number) ?? undefined,
      deathYear: (m.death_year as number) ?? undefined,
      position: pos || { x: 0, y: 0 },
      childrenIds: [],
      parentIds: [],
      linkedUserId: liveUserId || undefined,
      supabaseId: m.id,
      mergedProfiles: mergedInfos.length > 0 ? mergedInfos : undefined,
      coverUrl: m.cover_url || undefined,
    };
  });

  // Second pass: establish ALL relationships from relation_type
  dbMembers.forEach((m) => {
    const effectiveId = resolveId(m.id);
    if (!membersMap[effectiveId]) return;

    const relType = (m.relation_type || '').split('|')[0];

    // Spouse
    if (relType.startsWith('spouse_of_')) {
      const partnerId = resolveId(relType.replace('spouse_of_', ''));
      if (membersMap[partnerId] && membersMap[effectiveId]) {
        membersMap[effectiveId].spouseId = partnerId;
        membersMap[partnerId].spouseId = effectiveId;
      }
    }

    // Father/Mother
    if (relType.startsWith('father_of_') || relType.startsWith('mother_of_')) {
      const childId = resolveId(relType.replace(/^(father|mother)_of_/, ''));
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

    // Child
    if (relType.startsWith('child_of_')) {
      const match = relType.match(/child_of_([a-f0-9-]+)/);
      if (match) {
        const parentId = resolveId(match[1]);
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
          const otherParentId = child.parentIds.find((pid) => pid !== member.id);
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

  const newPositions: { member_id: string; x: number; y: number }[] = [];

  // Smart auto-layout: tree-centered algorithm
  const membersWithoutPos = Object.values(membersMap).filter((m) => !posMap.has(m.id));
  const totalMemberCount = Object.keys(membersMap).length;
  // Run full layout when >40% of nodes are unpositioned
  let needsFullLayout = totalMemberCount > 0 && membersWithoutPos.length > totalMemberCount * 0.4;

  // Pre-analysis: Check for severely broken spouse positions
  if (!needsFullLayout) {
    const MAX_SPOUSE_GAP = 400; // Hardcoded fallback or use value
    Object.values(membersMap).forEach((m) => {
      if (m.spouseId && membersMap[m.spouseId] && posMap.has(m.id) && posMap.has(m.spouseId)) {
        const p1 = posMap.get(m.id)!;
        const p2 = posMap.get(m.spouseId)!;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // If absolute distance is too large or too small (but ignore Y angle to preserve diagonal drag)
        if (dist > MAX_SPOUSE_GAP || dist < 120) {
          console.log(`Layout auto-correction triggered for ${m.name} and spouse. Dist: ${dist}`);
          needsFullLayout = true;
        }
      }
    });

    if (needsFullLayout) {
      // Clear positions so it fully recalculates cleanly
      posMap.clear();
      Object.values(membersMap).forEach(m => m.position = undefined);
    }
  }

  if (needsFullLayout) {
    const VERTICAL_GAP = 200;
    const SPOUSE_GAP = 180;
    const CHILD_GAP = 80;
    const MIN_NODE_WIDTH = 140;

    let startId = Object.keys(membersMap)[0];
    if (targetUserId) {
      const selfMember = dbMembers.find((m) => m.linked_user_id === targetUserId && membersMap[m.id]);
      if (selfMember) startId = selfMember.id;
    }

    if (startId && membersMap[startId]) {
      const placed = new Map<string, { x: number; y: number }>();

      const getCoupleUnit = (id: string): string[] => {
        const m = membersMap[id];
        if (!m) return [id];
        if (m.spouseId && membersMap[m.spouseId]) {
          return m.gender === 'male' ? [id, m.spouseId] : [m.spouseId, id];
        }
        return [id];
      };

      const getCoupleChildren = (ids: string[]): string[] => {
        const childSet = new Set<string>();
        ids.forEach((id) => {
          (membersMap[id]?.childrenIds || []).forEach((cid) => {
            if (membersMap[cid]) childSet.add(cid);
          });
        });
        return Array.from(childSet);
      };

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
        const childUnits: string[][] = [];
        const seen = new Set<string>();
        children.forEach((cid) => {
          if (seen.has(cid)) return;
          const cu = getCoupleUnit(cid);
          cu.forEach((x) => seen.add(x));
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

      const placeSubtree = (rootIds: string[], centerX: number, y: number, visitedUnits: Set<string>) => {
        const unitKey = rootIds.join('-');
        if (visitedUnits.has(unitKey)) return;
        visitedUnits.add(unitKey);

        if (rootIds.length === 2) {
          const [leftId, rightId] = rootIds;
          if (!placed.has(leftId)) placed.set(leftId, { x: centerX - SPOUSE_GAP / 2, y });
          if (!placed.has(rightId)) placed.set(rightId, { x: centerX + SPOUSE_GAP / 2, y });
        } else {
          if (!placed.has(rootIds[0])) placed.set(rootIds[0], { x: centerX, y });
        }

        const children = getCoupleChildren(rootIds);
        const childUnits: string[][] = [];
        const seen = new Set<string>();
        children.forEach((cid) => {
          if (seen.has(cid)) return;
          const cu = getCoupleUnit(cid);
          cu.forEach((x) => seen.add(x));
          childUnits.push(cu);
        });

        if (childUnits.length === 0) return;

        const childWidths = childUnits.map((cu) => calcSubtreeWidth(cu[0], new Set()));
        let totalWidth = 0;
        childWidths.forEach((w, i) => {
          totalWidth += w;
          if (i < childWidths.length - 1) totalWidth += CHILD_GAP;
        });

        let startX = centerX - totalWidth / 2;
        childUnits.forEach((cu, i) => {
          const childCenterX = startX + childWidths[i] / 2;
          placeSubtree(cu, childCenterX, y + VERTICAL_GAP, visitedUnits);
          startX += childWidths[i] + CHILD_GAP;
        });
      };

      const findTopmostAncestor = (id: string): string => {
        let current = id;
        const visited = new Set<string>();
        while (true) {
          visited.add(current);
          const parents = membersMap[current]?.parentIds || [];
          const unvisitedParent = parents.find((pid) => !visited.has(pid) && membersMap[pid]);
          if (!unvisitedParent) break;
          current = unvisitedParent;
        }
        return current;
      };

      const topAncestor = findTopmostAncestor(startId);
      const topUnit = getCoupleUnit(topAncestor);

      calcSubtreeWidth(topUnit[0], new Set());
      placeSubtree(topUnit, 0, 0, new Set());

      // Handle disconnected components
      const allPlacedIds = new Set(placed.keys());
      const unplaced = Object.keys(membersMap).filter((id) => !allPlacedIds.has(id) && !posMap.has(id));

      if (unplaced.length > 0) {
        const processed = new Set<string>();
        let offsetX = (placed.size > 0 ? Math.max(...Array.from(placed.values()).map((p) => p.x)) : 0) + 300;

        unplaced.forEach((id) => {
          if (processed.has(id)) return;
          const subRoot = findTopmostAncestor(id);
          const subUnit = getCoupleUnit(subRoot);
          calcSubtreeWidth(subUnit[0], new Set());
          const subWidth = widthCache.get(subUnit[0]) || MIN_NODE_WIDTH;
          placeSubtree(subUnit, offsetX + subWidth / 2, 0, new Set());

          placed.forEach((_, pid) => processed.add(pid));
          offsetX += subWidth + 300;
        });
      }

      placed.forEach((pos, id) => {
        membersMap[id].position = pos;
        newPositions.push({
          member_id: id,
          x: pos.x,
          y: pos.y,
        });
      });
    }
  }

  // Format posMap to return
  const finalPosMap: Record<string, { x: number; y: number }> = {};
  Object.keys(membersMap).forEach((id) => {
    finalPosMap[id] = membersMap[id].position!;
  });

  // Set root (self member)
  const selfMember = dbMembers.find((m) => m.linked_user_id === targetUserId);
  let newRootId = null;
  if (selfMember) {
    newRootId = resolveId(selfMember.id);
  } else if (dbMembers.length > 0) {
    newRootId = resolveId(dbMembers[0].id);
  }

  return { membersMap, posMap: finalPosMap, rootId: newRootId, newPositions };
}
