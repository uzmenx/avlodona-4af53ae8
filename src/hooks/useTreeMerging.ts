import { supabase } from '@/integrations/supabase/client';

/**
 * TOZA BIRLASHTIRISH ALGORITMI
 * 
 * Jarayon:
 * 1. Taklif qabul qilinadi → receiver profilini placeholder ga bog'laymiz
 * 2. Ota-onalarni avtomatik birlashtiramiz (jinsi va munosabat bo'yicha)
 * 3. Farzandlarni juftlik (couple) bo'yicha guruhlash va tavsiya qilish
 * 4. Foydalanuvchi tasdiqlaydi
 * 
 * Qoida: merged_into maydonidan foydalanamiz, relation_type ni O'ZGARTIRMAYMIZ!
 */

// ============= TYPES =============

export interface MergeCandidate {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  sourcePhotoUrl?: string;
  targetPhotoUrl?: string;
  relationship: 'self' | 'parent' | 'grandparent';
}

export interface ChildProfile {
  id: string;
  name: string;
  photoUrl?: string;
  gender: 'male' | 'female';
  /** Tug'ilgan yili (match scoring 30% uchun) */
  birthYear?: number;
}

export interface ChildMergeSuggestion {
  sourceChild: ChildProfile;
  targetChild: ChildProfile;
  /** 0–100: 40% ism, 30% tug'ilgan yil, 30% ota-ona munosabati */
  similarity: number;
}

export interface CoupleGroup {
  label: string;
  parentMerges: MergeCandidate[];
  sourceChildren: ChildProfile[];
  targetChildren: ChildProfile[];
  childSuggestions: ChildMergeSuggestion[];
}

export interface MergeResult {
  parentMerges: MergeCandidate[];
  coupleGroups: CoupleGroup[];
  // backward compat
  childSuggestions: ChildMergeSuggestion[];
  allSourceChildren: ChildProfile[];
  allTargetChildren: ChildProfile[];
}

interface TreeMember {
  id: string;
  owner_id: string;
  member_name: string;
  gender: string | null;
  relation_type: string;
  linked_user_id: string | null;
  avatar_url: string | null;
  created_at: string;
  merged_into: string | null;
  birth_year?: number | null;
}

// ============= HELPER FUNCTIONS =============

export const normalizePersonName = (name: string): string => {
  if (!name) return '';

  const trimmed = name
    .toLowerCase()
    .trim()
    .replace(/[’ʻ`]/g, "'")
    .replace(/\s+/g, ' ');

  const cyrToLat: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
    қ: 'q', ғ: "g'", ў: "o'", ҳ: 'h',
    ә: 'a', ө: 'o', ү: 'u',
  };

  const transliterated = trimmed
    .split('')
    .map((ch) => cyrToLat[ch] ?? ch)
    .join('');

  return transliterated
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const m = a.length;
  const n = b.length;
  const dp = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }

  return dp[n];
};

const tokenOverlapScore = (a: string, b: string): number => {
  if (!a || !b) return 0;
  const ta = a.split(' ').filter(Boolean);
  const tb = b.split(' ').filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  let common = 0;
  for (const t of ta) if (setB.has(t)) common++;
  const denom = Math.max(ta.length, tb.length);
  return Math.round((common / denom) * 100);
};

/** Ism o'xshashligi 0–100 */
export const calculateSimilarity = (name1: string, name2: string): number => {
  const n1 = normalizePersonName(name1);
  const n2 = normalizePersonName(name2);
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 100;

  if (n1.includes(n2) || n2.includes(n1)) {
    const ratio = Math.min(n1.length, n2.length) / Math.max(n1.length, n2.length);
    return Math.round(80 + Math.min(20, ratio * 20));
  }

  const dist = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const levScore = Math.round((1 - dist / maxLen) * 100);
  const overlap = tokenOverlapScore(n1, n2);

  return Math.max(0, Math.min(100, Math.round(levScore * 0.7 + overlap * 0.3)));
};

/** Tug'ilgan yil mosligi 0–100 (30% vazn) */
export const birthYearScore = (y1?: number, y2?: number): number => {
  if (y1 == null || y2 == null) return 0;
  const diff = Math.abs(y1 - y2);
  if (diff === 0) return 100;
  if (diff <= 1) return 90;
  if (diff <= 2) return 75;
  if (diff <= 5) return 50;
  return Math.max(0, 40 - diff);
};

/**
 * Birlashtirish balli: 40% ism, 30% tug'ilgan yil, 20% ota-ona, 10% farzand.
 */
export const computeMatchScore = (
  nameSimilarity: number,
  birthYearSim: number,
  parentsSim: number,
  childrenSim: number
): number => {
  const namePart = (nameSimilarity / 100) * 40;
  const birthPart = (birthYearSim / 100) * 30;
  const parentPart = (parentsSim / 100) * 20;
  const childrenPart = (childrenSim / 100) * 10;
  return Math.round(namePart + birthPart + parentPart + childrenPart);
};

/** Minimal ball: 1% ham bo‘lsa tavsiya qilamiz — katta daraxtda hech kim chetda qolmasin */
const MERGE_SCORE_THRESHOLD = 1;

/**
 * Farzandlar uchun tavsiyalarni hisoblash (40% ism, 30% yil, 30% ota-ona).
 * Qoida: bitta target faqat bitta source bilan juftlanadi (10 kishi 1 profilga tushib qolmasin).
 * Juftliklar eng yuqori ball bo‘yicha tanlanadi — keraklisi keraklisi bilan birlashadi.
 */
const computeChildSuggestions = (
  sourceChildren: ChildProfile[],
  targetChildren: ChildProfile[],
  sameParentGroup: boolean = true
): ChildMergeSuggestion[] => {
  const allPairs: { source: ChildProfile; target: ChildProfile; score: number }[] = [];

  for (const sourceChild of sourceChildren) {
    for (const target of targetChildren) {
      if (target.gender !== sourceChild.gender) continue;
      const nameSim = calculateSimilarity(sourceChild.name, target.name);
      const birthSim = birthYearScore(sourceChild.birthYear, target.birthYear);
      const parentsSim = sameParentGroup ? 100 : 0;
      const score = computeMatchScore(nameSim, birthSim, parentsSim, 0);
      if (score >= MERGE_SCORE_THRESHOLD) {
        allPairs.push({ source: sourceChild, target, score });
      }
    }
  }

  allPairs.sort((a, b) => b.score - a.score);

  const suggestions: ChildMergeSuggestion[] = [];
  const usedSourceIds = new Set<string>();
  const usedTargetIds = new Set<string>();

  for (const { source, target, score } of allPairs) {
    if (usedSourceIds.has(source.id) || usedTargetIds.has(target.id)) continue;
    suggestions.push({
      sourceChild: source,
      targetChild: target,
      similarity: score,
    });
    usedSourceIds.add(source.id);
    usedTargetIds.add(target.id);
  }

  return suggestions;
};

/**
 * Member ning ota-onalarini topish
 */
const findParents = (member: TreeMember, allMembers: TreeMember[]): TreeMember[] => {
  const parents: TreeMember[] = [];
  const relType = member.relation_type || '';
  
  const childMatch = relType.match(/child_of_([a-f0-9-]+)/);
  if (childMatch) {
    const parentId = childMatch[1];
    const parent = allMembers.find(m => m.id === parentId);
    if (parent) {
      parents.push(parent);
      const spouse = allMembers.find(m => 
        m.relation_type === `spouse_of_${parentId}` || 
        parent.relation_type === `spouse_of_${m.id}`
      );
      if (spouse) parents.push(spouse);
    }
  }
  
  allMembers.forEach(m => {
    if (m.relation_type === `father_of_${member.id}` || 
        m.relation_type === `mother_of_${member.id}`) {
      if (!parents.find(p => p.id === m.id)) {
        parents.push(m);
      }
    }
  });
  
  return parents;
};

/**
 * Member ning farzandlarini topish (unique)
 */
const findChildren = (member: TreeMember, allMembers: TreeMember[]): TreeMember[] => {
  const childrenMap = new Map<string, TreeMember>();
  const relType = member.relation_type || '';
  
  // father_of_X / mother_of_X
  if (relType.startsWith('father_of_') || relType.startsWith('mother_of_')) {
    const childId = relType.replace('father_of_', '').replace('mother_of_', '');
    const child = allMembers.find(m => m.id === childId);
    if (child) childrenMap.set(child.id, child);
  }
  
  // child_of_X
  allMembers.forEach(m => {
    if (m.relation_type.includes(`child_of_${member.id}`)) {
      childrenMap.set(m.id, m);
    }
  });
  
  // Spouse children
  const spouseMatch = relType.match(/spouse_of_([a-f0-9-]+)/);
  if (spouseMatch) {
    const spouseId = spouseMatch[1];
    allMembers.forEach(m => {
      if (m.relation_type.includes(`child_of_${spouseId}`)) {
        childrenMap.set(m.id, m);
      }
    });
  }
  
  return Array.from(childrenMap.values());
};

const computeParentsSimilarity = (
  a: TreeMember,
  b: TreeMember,
  aAll: TreeMember[],
  bAll: TreeMember[]
): number => {
  const aParents = findParents(a, aAll);
  const bParents = findParents(b, bAll);
  if (aParents.length === 0 || bParents.length === 0) return 0;

  const bestMatches: number[] = [];
  for (const ap of aParents) {
    const candidates = bParents.filter(bp => !ap.gender || !bp.gender || ap.gender === bp.gender);
    if (candidates.length === 0) continue;
    let best = 0;
    for (const bp of candidates) {
      best = Math.max(best, calculateSimilarity(ap.member_name || '', bp.member_name || ''));
    }
    bestMatches.push(best);
  }

  if (bestMatches.length === 0) return 0;
  const avg = bestMatches.reduce((s, v) => s + v, 0) / bestMatches.length;
  return Math.round(avg);
};

const computeChildrenSimilarity = (
  a: TreeMember,
  b: TreeMember,
  aAll: TreeMember[],
  bAll: TreeMember[]
): number => {
  const aChildren = findChildren(a, aAll);
  const bChildren = findChildren(b, bAll);
  const aNames = aChildren.map(c => c.member_name || '').filter(Boolean);
  const bNames = bChildren.map(c => c.member_name || '').filter(Boolean);
  if (aNames.length === 0 || bNames.length === 0) return 0;

  const small = aNames.length <= bNames.length ? aNames : bNames;
  const big = aNames.length <= bNames.length ? bNames : aNames;

  let matches = 0;
  for (const s of small) {
    let best = 0;
    for (const t of big) {
      best = Math.max(best, calculateSimilarity(s, t));
    }
    if (best >= 80) matches++;
  }

  return Math.round((matches / Math.max(aNames.length, bNames.length)) * 100);
};

/**
 * Ikki ota-onaning barcha farzandlarini topish (combined, unique)
 */
const findCoupleChildren = (
  parents: TreeMember[],
  allMembers: TreeMember[],
  excludeIds: string[]
): TreeMember[] => {
  const childrenMap = new Map<string, TreeMember>();
  
  for (const parent of parents) {
    const children = findChildren(parent, allMembers);
    children.forEach(c => {
      if (!excludeIds.includes(c.id)) {
        childrenMap.set(c.id, c);
      }
    });
  }
  
  return Array.from(childrenMap.values());
};

const toChildProfile = (m: TreeMember): ChildProfile => ({
  id: m.id,
  name: m.member_name || 'Ism kiritilmagan',
  photoUrl: m.avatar_url || undefined,
  gender: (m.gender as 'male' | 'female') || 'male',
  birthYear: m.birth_year ?? undefined,
});

const createMergeEntry = (
  sp: TreeMember,
  rp: TreeMember,
  rel: 'self' | 'parent' | 'grandparent'
): MergeCandidate => {
  const sDate = new Date(sp.created_at);
  const rDate = new Date(rp.created_at);
  const [source, target] = rel === 'self' ? [sp, rp] : (sDate <= rDate ? [sp, rp] : [rp, sp]);
  return {
    sourceId: source.id,
    targetId: target.id,
    sourceName: source.member_name || 'Ism kiritilmagan',
    targetName: target.member_name || 'Ism kiritilmagan',
    sourcePhotoUrl: source.avatar_url || undefined,
    targetPhotoUrl: target.avatar_url || undefined,
    relationship: rel,
  };
};

// ============= MAIN HOOK =============

export const useTreeMerging = () => {
  
  /**
   * Birlashtirish kandidatlarini topish - juftlik (couple) bo'yicha guruhlangan
   */
  const findMergeCandidates = async (
    senderId: string,
    receiverId: string,
    linkedMemberId: string
  ): Promise<MergeResult> => {
    const result: MergeResult = {
      parentMerges: [],
      coupleGroups: [],
      childSuggestions: [],
      allSourceChildren: [],
      allTargetChildren: [],
    };
    
    try {
      const [senderRes, receiverRes] = await Promise.all([
        supabase.from('family_tree_members').select('*')
          .eq('owner_id', senderId)
          .is('merged_into', null),
        supabase.from('family_tree_members').select('*')
          .eq('owner_id', receiverId)
          .is('merged_into', null)
      ]);
      
      const senderMembers = ((senderRes.data || []) as TreeMember[]).filter(
        m => !m.relation_type.startsWith('merged_into_')
      );
      const receiverMembers = ((receiverRes.data || []) as TreeMember[]).filter(
        m => !m.relation_type.startsWith('merged_into_')
      );
      
      if (!senderMembers.length || !receiverMembers.length) return result;
      
      const linkedMember = senderMembers.find(m => m.id === linkedMemberId);
      const receiverSelf = receiverMembers.find(m => m.linked_user_id === receiverId);
      
      if (!linkedMember || !receiverSelf) return result;

      {
        const nameSim = calculateSimilarity(linkedMember.member_name || '', receiverSelf.member_name || '');
        const birthSim = birthYearScore(linkedMember.birth_year ?? undefined, receiverSelf.birth_year ?? undefined);
        const parentsSim = computeParentsSimilarity(linkedMember, receiverSelf, senderMembers, receiverMembers);
        const childrenSim = computeChildrenSimilarity(linkedMember, receiverSelf, senderMembers, receiverMembers);
        const score = computeMatchScore(nameSim, birthSim, parentsSim, childrenSim);
        if (score >= 90) {
          result.parentMerges.push(createMergeEntry(linkedMember, receiverSelf, 'self'));
        }
      }
      
      // === OTA-ONALAR ===
      const senderParents = findParents(linkedMember, senderMembers);
      const receiverParents = findParents(receiverSelf, receiverMembers);
      
      const senderFather = senderParents.find(p => p.gender === 'male');
      const senderMother = senderParents.find(p => p.gender === 'female');
      const receiverFather = receiverParents.find(p => p.gender === 'male');
      const receiverMother = receiverParents.find(p => p.gender === 'female');
      
      // Parent couple merges
      const parentCoupleMerges: MergeCandidate[] = [];
      if (senderFather && receiverFather) {
        const merge = createMergeEntry(senderFather, receiverFather, 'parent');
        parentCoupleMerges.push(merge);
        result.parentMerges.push(merge);
      }
      if (senderMother && receiverMother) {
        const merge = createMergeEntry(senderMother, receiverMother, 'parent');
        parentCoupleMerges.push(merge);
        result.parentMerges.push(merge);
      }
      
      // Parent couple children (siblings of the linked member)
      if (parentCoupleMerges.length > 0) {
        const sChildren = findCoupleChildren(
          [senderFather, senderMother].filter(Boolean) as TreeMember[],
          senderMembers,
          [linkedMemberId]
        );
        const rChildren = findCoupleChildren(
          [receiverFather, receiverMother].filter(Boolean) as TreeMember[],
          receiverMembers,
          [receiverSelf.id]
        );
        
        const sourceChildren = sChildren.map(toChildProfile);
        const targetChildren = rChildren.map(toChildProfile);
        const childSuggestions = computeChildSuggestions(sourceChildren, targetChildren);
        
        result.allSourceChildren.push(...sourceChildren);
        result.allTargetChildren.push(...targetChildren);
        result.childSuggestions.push(...childSuggestions);
        
        if (sourceChildren.length > 0 || targetChildren.length > 0) {
          // Couple label: "Ota + Ona"
          const fatherName = (senderFather || receiverFather)?.member_name || '';
          const motherName = (senderMother || receiverMother)?.member_name || '';
          const label = [fatherName, motherName].filter(Boolean).join(' va ') || 'Ota-ona';
          
          result.coupleGroups.push({
            label,
            parentMerges: parentCoupleMerges,
            sourceChildren,
            targetChildren,
            childSuggestions,
          });
        }
      }
      
      // === BOBO-BUVILAR ===
      const processedPairs = new Set<string>();
      
      for (const sParent of [senderFather, senderMother].filter(Boolean) as TreeMember[]) {
        const matchingRParent = [receiverFather, receiverMother].find(
          r => r && r.gender === sParent.gender
        );
        if (!matchingRParent) continue;
        
        const sGrandparents = findParents(sParent, senderMembers);
        const rGrandparents = findParents(matchingRParent, receiverMembers);
        
        if (sGrandparents.length === 0 || rGrandparents.length === 0) continue;
        
        const grandCoupleMerges: MergeCandidate[] = [];
        
        for (const sgp of sGrandparents) {
          const matchingRgp = rGrandparents.find(rgp => rgp.gender === sgp.gender);
          if (!matchingRgp) continue;
          
          const pairKey = [sgp.id, matchingRgp.id].sort().join('-');
          if (processedPairs.has(pairKey)) continue;
          processedPairs.add(pairKey);
          
          const merge = createMergeEntry(sgp, matchingRgp, 'grandparent');
          grandCoupleMerges.push(merge);
          result.parentMerges.push(merge);
        }
        
        if (grandCoupleMerges.length > 0) {
          // Find children of grandparents (aunts/uncles), excluding the parent itself
          const sGpChildren = findCoupleChildren(
            sGrandparents,
            senderMembers,
            [sParent.id]
          );
          const rGpChildren = findCoupleChildren(
            rGrandparents,
            receiverMembers,
            [matchingRParent.id]
          );
          
          const sourceChildren = sGpChildren.map(toChildProfile);
          const targetChildren = rGpChildren.map(toChildProfile);
          const childSuggestions = computeChildSuggestions(sourceChildren, targetChildren);
          
          result.allSourceChildren.push(...sourceChildren);
          result.allTargetChildren.push(...targetChildren);
          result.childSuggestions.push(...childSuggestions);
          
          if (sourceChildren.length > 0 || targetChildren.length > 0) {
            const gpFather = sGrandparents.find(g => g.gender === 'male');
            const gpMother = sGrandparents.find(g => g.gender === 'female');
            const label = [gpFather?.member_name, gpMother?.member_name]
              .filter(Boolean).join(' va ') || 'Bobo-buvi';
            
            result.coupleGroups.push({
              label,
              parentMerges: grandCoupleMerges,
              sourceChildren,
              targetChildren,
              childSuggestions,
            });
          }
        }
      }
      
      // === FARZANDLAR (Children of the linked member) ===
      const senderChildren = findChildren(linkedMember, senderMembers);
      const receiverChildren = findChildren(receiverSelf, receiverMembers);
      
      if (senderChildren.length > 0 || receiverChildren.length > 0) {
        const sourceChildren = senderChildren.map(toChildProfile);
        const targetChildren = receiverChildren.map(toChildProfile);
        const childSuggestions = computeChildSuggestions(sourceChildren, targetChildren, false);
        
        result.allSourceChildren.push(...sourceChildren);
        result.allTargetChildren.push(...targetChildren);
        result.childSuggestions.push(...childSuggestions);
        
        result.coupleGroups.push({
          label: 'Farzandlar',
          parentMerges: [],
          sourceChildren,
          targetChildren,
          childSuggestions,
        });
      }
      
      // === JUFTLAR (Spouses) ===
      const getSpouses = (m: TreeMember, allMembers: TreeMember[]): TreeMember[] => {
        const spouses: TreeMember[] = [];
        const match = m.relation_type?.match(/spouse_of_([a-f0-9-]+)/);
        if (match) {
          const s = allMembers.find(x => x.id === match[1]);
          if (s) spouses.push(s);
        }
        allMembers.forEach(x => {
          if (x.relation_type === `spouse_of_${m.id}` && !spouses.find(s => s.id === x.id)) {
            spouses.push(x);
          }
        });
        return spouses;
      };
      
      const sSpouses = getSpouses(linkedMember, senderMembers);
      const rSpouses = getSpouses(receiverSelf, receiverMembers);
      
      for (const sSpouse of sSpouses) {
        const matchingRSpouse = rSpouses.find(r => r.gender === sSpouse.gender);
        if (matchingRSpouse) {
          const merge = createMergeEntry(sSpouse, matchingRSpouse, 'self');
          // Don't duplicate if already added
          if (!result.parentMerges.some(m => m.sourceId === merge.sourceId && m.targetId === merge.targetId)) {
            result.parentMerges.push(merge);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('findMergeCandidates error:', error);
      return result;
    }
  };
  
  /**
   * Ota-onalarni avtomatik birlashtirish
   */
  const executeParentMerge = async (merges: MergeCandidate[]): Promise<boolean> => {
    try {
      for (const merge of merges) {
        const [sourceRes, targetRes] = await Promise.all([
          supabase.from('family_tree_members').select('*').eq('id', merge.sourceId).single(),
          supabase.from('family_tree_members').select('*').eq('id', merge.targetId).single()
        ]);
        
        const source = sourceRes.data as TreeMember | null;
        const target = targetRes.data as TreeMember | null;
        
        if (!source || !target) continue;
        
        const updates: Record<string, unknown> = {};
        
        if (target.linked_user_id && !source.linked_user_id) {
          updates.linked_user_id = target.linked_user_id;
          updates.is_placeholder = false;
        }
        if (!source.member_name && target.member_name) {
          updates.member_name = target.member_name;
        }
        if (!source.avatar_url && target.avatar_url) {
          updates.avatar_url = target.avatar_url;
        }
        
        if (Object.keys(updates).length > 0) {
          await supabase
            .from('family_tree_members')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', merge.sourceId);
        }
        
        await supabase
          .from('family_tree_members')
          .update({ 
            merged_into: merge.sourceId,
            updated_at: new Date().toISOString()
          })
          .eq('id', merge.targetId);
        
        console.log(`Merged: ${merge.sourceName} ← ${merge.targetName}`);
      }
      
      return true;
    } catch (error) {
      console.error('executeParentMerge error:', error);
      return false;
    }
  };
  
  /**
   * Farzandlarni birlashtirish
   */
  const executeChildMerge = async (
    sourceId: string, 
    targetId: string
  ): Promise<boolean> => {
    try {
      const [sourceRes, targetRes] = await Promise.all([
        supabase.from('family_tree_members').select('*').eq('id', sourceId).single(),
        supabase.from('family_tree_members').select('*').eq('id', targetId).single()
      ]);
      
      const source = sourceRes.data as TreeMember | null;
      const target = targetRes.data as TreeMember | null;
      
      if (!source || !target) return false;
      
      // Merge the child itself
      const updates: Record<string, unknown> = {};
      
      if (target.linked_user_id && !source.linked_user_id) {
        updates.linked_user_id = target.linked_user_id;
        updates.is_placeholder = false;
      }
      if (!source.member_name && target.member_name) {
        updates.member_name = target.member_name;
      }
      if (!source.avatar_url && target.avatar_url) {
        updates.avatar_url = target.avatar_url;
      }
      
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('family_tree_members')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', sourceId);
      }
      
      await supabase
        .from('family_tree_members')
        .update({ 
          merged_into: sourceId,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetId);
      
      // Also merge spouses if both have one with matching gender
      const sourceSpouseRel = source.relation_type.match(/spouse_of_([a-f0-9-]+)/);
      const targetSpouseRel = target.relation_type.match(/spouse_of_([a-f0-9-]+)/);
      
      if (sourceSpouseRel && targetSpouseRel) {
        const sourceSpouseId = sourceSpouseRel[1];
        const targetSpouseId = targetSpouseRel[1];
        
        if (sourceSpouseId !== targetSpouseId) {
          const [ssRes, tsRes] = await Promise.all([
            supabase.from('family_tree_members').select('*').eq('id', sourceSpouseId).is('merged_into', null).single(),
            supabase.from('family_tree_members').select('*').eq('id', targetSpouseId).is('merged_into', null).single()
          ]);
          
          const sourceSpouse = ssRes.data as TreeMember | null;
          const targetSpouse = tsRes.data as TreeMember | null;
          
          if (sourceSpouse && targetSpouse && sourceSpouse.gender === targetSpouse.gender) {
            // Merge target's spouse into source's spouse
            const spouseUpdates: Record<string, unknown> = {};
            if (targetSpouse.linked_user_id && !sourceSpouse.linked_user_id) {
              spouseUpdates.linked_user_id = targetSpouse.linked_user_id;
              spouseUpdates.is_placeholder = false;
            }
            if (!sourceSpouse.member_name && targetSpouse.member_name) {
              spouseUpdates.member_name = targetSpouse.member_name;
            }
            if (!sourceSpouse.avatar_url && targetSpouse.avatar_url) {
              spouseUpdates.avatar_url = targetSpouse.avatar_url;
            }
            
            if (Object.keys(spouseUpdates).length > 0) {
              await supabase
                .from('family_tree_members')
                .update({ ...spouseUpdates, updated_at: new Date().toISOString() })
                .eq('id', sourceSpouseId);
            }
            
            await supabase
              .from('family_tree_members')
              .update({ 
                merged_into: sourceSpouseId,
                updated_at: new Date().toISOString()
              })
              .eq('id', targetSpouseId);
            
            console.log(`Spouse auto-merged: ${sourceSpouse.member_name} ← ${targetSpouse.member_name}`);
          }
        }
      }
      
      // Check if target has a spouse via reverse lookup (someone is spouse_of_target)
      if (!targetSpouseRel) {
        const { data: reverseSpouses } = await supabase
          .from('family_tree_members')
          .select('*')
          .eq('relation_type', `spouse_of_${targetId}`)
          .is('merged_into', null);
        
        if (reverseSpouses && reverseSpouses.length > 0) {
          // Check if source also has a spouse via reverse lookup
          const { data: sourceReverseSpouses } = await supabase
            .from('family_tree_members')
            .select('*')
            .eq('relation_type', `spouse_of_${sourceId}`)
            .is('merged_into', null);
          
          if (sourceReverseSpouses && sourceReverseSpouses.length > 0) {
            const targetSpouse = reverseSpouses[0] as TreeMember;
            const sourceSpouse = sourceReverseSpouses[0] as TreeMember;
            
            if (targetSpouse.gender === sourceSpouse.gender && targetSpouse.id !== sourceSpouse.id) {
              const spouseUpdates: Record<string, unknown> = {};
              if (targetSpouse.linked_user_id && !sourceSpouse.linked_user_id) {
                spouseUpdates.linked_user_id = targetSpouse.linked_user_id;
                spouseUpdates.is_placeholder = false;
              }
              if (!sourceSpouse.member_name && targetSpouse.member_name) {
                spouseUpdates.member_name = targetSpouse.member_name;
              }
              if (!sourceSpouse.avatar_url && targetSpouse.avatar_url) {
                spouseUpdates.avatar_url = targetSpouse.avatar_url;
              }
              
              if (Object.keys(spouseUpdates).length > 0) {
                await supabase
                  .from('family_tree_members')
                  .update({ ...spouseUpdates, updated_at: new Date().toISOString() })
                  .eq('id', sourceSpouse.id);
              }
              
              await supabase
                .from('family_tree_members')
                .update({ 
                  merged_into: sourceSpouse.id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', targetSpouse.id);
              
              console.log(`Spouse reverse-merged: ${sourceSpouse.member_name} ← ${targetSpouse.member_name}`);
            }
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('executeChildMerge error:', error);
      return false;
    }
  };
  
  return {
    findMergeCandidates,
    executeParentMerge,
    executeChildMerge,
    calculateSimilarity,
  };
};
