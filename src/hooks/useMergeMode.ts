import { useState, useCallback, useMemo } from 'react';
import { FamilyMember } from '@/types/family';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  MergeCandidate, 
  ChildProfile, 
  ChildMergeSuggestion, 
  CoupleGroup, 
  calculateSimilarity,
  computeMatchScore,
  birthYearScore,
} from './useTreeMerging';
import { MergeDialogData } from './useFamilyInvitations';

export interface MergeSuggestion {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  reason: string;
  gender: 'male' | 'female';
}

export interface MergedProfile {
  primaryId: string;
  mergedIds: string[];
  mergedNames: string[];
}

export const useMergeMode = (members: Record<string, FamilyMember>) => {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergedProfiles, setMergedProfiles] = useState<Map<string, MergedProfile>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  const startMergeMode = useCallback((memberId: string) => {
    setIsActive(true);
    setSelectedIds([memberId]);
  }, []);

  const toggleSelection = useCallback((memberId: string) => {
    if (!isActive) return;
    
    const member = members[memberId];
    const firstMember = members[selectedIds[0]];
    
    if (firstMember && member && firstMember.gender !== member.gender) {
      toast.error("Faqat bir xil jinsdagi profillarni birlashtirish mumkin");
      return;
    }
    
    setSelectedIds(prev => {
      if (prev.includes(memberId)) {
        if (prev[0] === memberId) {
          cancelMerge();
          return [];
        }
        return prev.filter(id => id !== memberId);
      }
      return [...prev, memberId];
    });
  }, [isActive, members, selectedIds]);

  const cancelMerge = useCallback(() => {
    setIsActive(false);
    setSelectedIds([]);
  }, []);

  /**
   * Tanlangan profillardan MergeDialogData yaratish
   */
  const computeMergeData = useCallback((): MergeDialogData | null => {
    if (selectedIds.length < 2) return null;
    
    const primaryId = selectedIds[0];
    const primary = members[primaryId];
    if (!primary) return null;
    
    const parentMerges: MergeCandidate[] = [];
    const coupleGroups: CoupleGroup[] = [];
    
    for (const otherId of selectedIds.slice(1)) {
      const other = members[otherId];
      if (!other) continue;
      
      // Asosiy birlashtirish: tanlangan profillar
      parentMerges.push({
        sourceId: primaryId,
        targetId: otherId,
        sourceName: primary.name,
        targetName: other.name,
        sourcePhotoUrl: primary.photoUrl,
        targetPhotoUrl: other.photoUrl,
        relationship: 'parent',
      });
      
      // Ota-onalarni birlashtirish tavsiyasi
      const primaryParentIds = primary.parentIds || [];
      const otherParentIds = other.parentIds || [];
      
      const coupleParentMerges: MergeCandidate[] = [];
      const matchedPrimary = new Set<string>();
      const matchedOther = new Set<string>();
      
      for (const ppId of primaryParentIds) {
        const pp = members[ppId];
        if (!pp) continue;
        for (const opId of otherParentIds) {
          const op = members[opId];
          if (!op) continue;
          if (pp.gender === op.gender && ppId !== opId && !matchedPrimary.has(ppId) && !matchedOther.has(opId)) {
            const merge: MergeCandidate = {
              sourceId: ppId,
              targetId: opId,
              sourceName: pp.name,
              targetName: op.name,
              sourcePhotoUrl: pp.photoUrl,
              targetPhotoUrl: op.photoUrl,
              relationship: 'parent',
            };
            parentMerges.push(merge);
            coupleParentMerges.push(merge);
            matchedPrimary.add(ppId);
            matchedOther.add(opId);
          }
        }
      }
      
      // Farzandlarni topish (birthYear 30% ball uchun)
      const getChildren = (memberId: string): ChildProfile[] => {
        const m = members[memberId];
        if (!m) return [];
        const childIds = new Set(m.childrenIds || []);
        if (m.spouseId && members[m.spouseId]) {
          (members[m.spouseId].childrenIds || []).forEach(id => childIds.add(id));
        }
        return [...childIds]
          .filter(id => members[id])
          .map(id => ({
            id,
            name: members[id].name,
            photoUrl: members[id].photoUrl,
            gender: members[id].gender,
            birthYear: members[id].birthYear,
          }));
      };

      const sourceChildren = getChildren(primaryId);
      const targetChildren = getChildren(otherId);

      // Tavsiyalar: ball bo‘yicha eng yaxshi juftliklar birinchi (keraklisi keraklisi bilan)
      const allPairs: { source: ChildProfile; target: ChildProfile; score: number }[] = [];
      const MERGE_THRESHOLD = 1;

      for (const sc of sourceChildren) {
        for (const t of targetChildren) {
          if (t.gender !== sc.gender) continue;
          const nameSim = calculateSimilarity(sc.name, t.name);
          const birthSim = birthYearScore(sc.birthYear, t.birthYear);
          const score = computeMatchScore(nameSim, birthSim, 100, 0);
          if (score >= MERGE_THRESHOLD) {
            allPairs.push({ source: sc, target: t, score });
          }
        }
      }
      allPairs.sort((a, b) => b.score - a.score);

      const childSuggestions: ChildMergeSuggestion[] = [];
      const usedSourceIds = new Set<string>();
      const usedTargetIds = new Set<string>();
      for (const { source, target, score } of allPairs) {
        if (usedSourceIds.has(source.id) || usedTargetIds.has(target.id)) continue;
        childSuggestions.push({ sourceChild: source, targetChild: target, similarity: score });
        usedSourceIds.add(source.id);
        usedTargetIds.add(target.id);
      }
      
      if (sourceChildren.length > 0 || targetChildren.length > 0) {
        coupleGroups.push({
          label: `${primary.name} va ${other.name}`,
          parentMerges: coupleParentMerges,
          sourceChildren,
          targetChildren,
          childSuggestions,
        });
      }
    }
    
    return {
      senderName: primary.name,
      receiverName: selectedIds.slice(1).map(id => members[id]?.name || '').join(', '),
      parentMerges,
      coupleGroups,
      childSuggestions: coupleGroups.flatMap(g => g.childSuggestions),
      allSourceChildren: coupleGroups.flatMap(g => g.sourceChildren),
      allTargetChildren: coupleGroups.flatMap(g => g.targetChildren),
    };
  }, [selectedIds, members]);

  // Direct merge execution (backward compat)
  const executeMerge = useCallback(async () => {
    if (selectedIds.length < 2 || !user?.id) return;
    
    setIsProcessing(true);
    
    try {
      const primaryId = selectedIds[0];
      const primary = members[primaryId];
      if (!primary) throw new Error('Primary member not found');
      
      const mergedIds = selectedIds.slice(1);
      const mergedNames = mergedIds.map(id => members[id]?.name || 'Noma\'lum');
      
      for (const mergedId of mergedIds) {
        const merged = members[mergedId];
        if (!merged) continue;
        
        await supabase
          .from('family_tree_members')
          .update({ 
            merged_into: primaryId,
            updated_at: new Date().toISOString()
          })
          .eq('id', mergedId);
        
        if (merged.linkedUserId && !primary.linkedUserId) {
          await supabase
            .from('family_tree_members')
            .update({ 
              linked_user_id: merged.linkedUserId,
              is_placeholder: false 
            })
            .eq('id', primaryId);
        }
      }
      
      setMergedProfiles(prev => {
        const next = new Map(prev);
        const existing = next.get(primaryId);
        next.set(primaryId, {
          primaryId,
          mergedIds: existing ? [...existing.mergedIds, ...mergedIds] : mergedIds,
          mergedNames: existing ? [...existing.mergedNames, ...mergedNames] : mergedNames,
        });
        return next;
      });
      
      toast.success(`${mergedIds.length} ta profil birlashtirildi`);
      cancelMerge();
      
      window.dispatchEvent(new CustomEvent('family-tree-reload'));
      
    } catch (error) {
      console.error('Error executing merge:', error);
      toast.error('Birlashtirishda xatolik');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, members, user?.id, cancelMerge]);

  const suggestions = useMemo((): MergeSuggestion[] => {
    if (selectedIds.length < 2) return [];
    // Keeping for backward compat but suggestions now go through computeMergeData
    return [];
  }, [selectedIds]);

  const applySuggestion = useCallback((suggestion: MergeSuggestion) => {
    setSelectedIds(prev => {
      const newIds = [...prev];
      if (!newIds.includes(suggestion.sourceId)) newIds.push(suggestion.sourceId);
      if (!newIds.includes(suggestion.targetId)) newIds.push(suggestion.targetId);
      return newIds;
    });
  }, []);

  return {
    isActive,
    selectedIds,
    mergedProfiles,
    suggestions,
    isProcessing,
    startMergeMode,
    toggleSelection,
    cancelMerge,
    executeMerge,
    computeMergeData,
    applySuggestion,
  };
};
