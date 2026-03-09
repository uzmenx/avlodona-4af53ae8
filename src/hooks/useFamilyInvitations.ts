import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTreeMerging, MergeResult, MergeCandidate, ChildProfile, ChildMergeSuggestion, CoupleGroup } from './useTreeMerging';

export interface FamilyInvitation {
  id: string;
  sender_id: string;
  receiver_id: string;
  member_id: string;
  relation_type: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  sender?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface MergeDialogData {
  senderName: string;
  receiverName: string;
  parentMerges: MergeCandidate[];
  coupleGroups: CoupleGroup[];
  // backward compat
  childSuggestions: ChildMergeSuggestion[];
  allSourceChildren: ChildProfile[];
  allTargetChildren: ChildProfile[];
}

export const useFamilyInvitations = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { findMergeCandidates, executeParentMerge, executeChildMerge } = useTreeMerging();
  
  const [pendingInvitations, setPendingInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Merge dialog state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeData, setMergeData] = useState<MergeDialogData | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  // Fetch pending invitations for current user
  const fetchInvitations = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('family_invitations')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const senderIds = [...new Set(data.map(inv => inv.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', senderIds);

        const enriched = data.map(inv => ({
          ...inv,
          status: inv.status as 'pending' | 'accepted' | 'rejected',
          sender: profiles?.find(p => p.id === inv.sender_id),
        }));

        setPendingInvitations(enriched);
      } else {
        setPendingInvitations([]);
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const linkToSameNetwork = async (senderId: string, receiverId: string): Promise<string | null> => {
    try {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('family_network_id')
        .eq('id', senderId)
        .single();
      
      let networkId = senderProfile?.family_network_id;
      
      if (!networkId) {
        const { data: newNetwork } = await supabase
          .from('family_networks')
          .insert({})
          .select('id')
          .single();
        
        if (newNetwork) {
          networkId = newNetwork.id;
          await supabase
            .from('profiles')
            .update({ family_network_id: networkId })
            .eq('id', senderId);
        }
      }
      
      if (!networkId) return null;
      
      await supabase
        .from('profiles')
        .update({ family_network_id: networkId })
        .eq('id', receiverId);
      
      return networkId;
    } catch (error) {
      console.error('Error linking to network:', error);
      return null;
    }
  };

  const acceptInvitation = async (invitation: FamilyInvitation) => {
    if (!user?.id || !profile) return false;

    try {
      const { error: updateError } = await supabase
        .from('family_invitations')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      const networkId = await linkToSameNetwork(invitation.sender_id, user.id);
      if (networkId) {
        await refreshProfile?.();
      }

      const { error: linkError } = await supabase
        .from('family_tree_members')
        .update({ 
          linked_user_id: user.id,
          member_name: profile.name || profile.username || 'Foydalanuvchi',
          avatar_url: profile.avatar_url,
          is_placeholder: false,
          gender: profile.gender || undefined,
        })
        .eq('id', invitation.member_id);

      if (linkError) throw linkError;

      await supabase.from('notifications').insert({
        user_id: invitation.sender_id,
        actor_id: user.id,
        type: 'family_invitation_accepted',
      });

      // CRITICAL: Find merge candidates BEFORE self-merge
      // Otherwise receiver's self node gets merged_into set and findMergeCandidates can't find it
      const result = await findMergeCandidates(
        invitation.sender_id,
        user.id,
        invitation.member_id
      );

      // NOW do the self-merge AFTER finding candidates
      const { data: receiverSelfNode } = await supabase
        .from('family_tree_members')
        .select('id')
        .eq('owner_id', user.id)
        .eq('linked_user_id', user.id)
        .is('merged_into', null)
        .single();

      if (receiverSelfNode && receiverSelfNode.id !== invitation.member_id) {
        await executeParentMerge([{
          sourceId: invitation.member_id,
          targetId: receiverSelfNode.id,
          sourceName: profile.name || '',
          targetName: profile.name || '',
          relationship: 'self',
        }]);
      }

      // Auto-merge parent/grandparent immediately so the tree doesn't show duplicates
      if (result.parentMerges.length > 0) {
        const autoMerges = result.parentMerges.filter(m => m.relationship === 'parent' || m.relationship === 'grandparent');
        if (autoMerges.length > 0) {
          await executeParentMerge(autoMerges);
          result.parentMerges = result.parentMerges.filter(m => !autoMerges.some(am => am.sourceId === m.sourceId && am.targetId === m.targetId));
          result.coupleGroups = result.coupleGroups.map(g => ({
            ...g,
            parentMerges: g.parentMerges.filter(pm => !autoMerges.some(am => am.sourceId === pm.sourceId && am.targetId === pm.targetId))
          }));
        }
      }

      // Delete ALL positions for both users to force fresh auto-layout after merge
      await Promise.all([
        supabase.from('node_positions').delete().eq('owner_id', user.id),
        supabase.from('node_positions').delete().eq('owner_id', invitation.sender_id),
      ]);

      const hasParentMerges = result.parentMerges.length > 0;
      const hasCoupleGroups = result.coupleGroups.length > 0;
      const hasChildren = result.allSourceChildren.length > 0 || result.allTargetChildren.length > 0;

      if (hasParentMerges || hasCoupleGroups || hasChildren) {
        setMergeData({
          senderName: invitation.sender?.name || invitation.sender?.username || 'Foydalanuvchi',
          receiverName: profile.name || profile.username || 'Siz',
          parentMerges: result.parentMerges,
          coupleGroups: result.coupleGroups,
          childSuggestions: result.childSuggestions,
          allSourceChildren: result.allSourceChildren,
          allTargetChildren: result.allTargetChildren,
        });
        setShowMergeDialog(true);
      } else {
        toast({
          title: "Qabul qilindi!",
          description: "Siz oila daraxtiga muvaffaqiyatli qo'shildingiz.",
        });

        window.dispatchEvent(new CustomEvent('family-tree-reload'));
      }

      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error accepting invitation:', err);
      toast({
        title: "Xato",
        description: err.message || "Taklifni qabul qilishda xatolik",
        variant: "destructive",
      });
      return false;
    }
  };

  const executeMerge = async (
    childMerges: { sourceId: string; targetId: string }[]
  ) => {
    if (!mergeData) return;
    
    setIsMerging(true);
    
    try {
      if (mergeData.parentMerges.length > 0) {
        await executeParentMerge(mergeData.parentMerges);
      }
      
      for (const merge of childMerges) {
        await executeChildMerge(merge.sourceId, merge.targetId);
      }
      
      toast({
        title: "Birlashtirildi!",
        description: "Oila daraxti muvaffaqiyatli birlashtirildi",
      });
      
      setShowMergeDialog(false);
      setMergeData(null);
      
      window.location.reload();
    } catch (error) {
      console.error('Error executing merge:', error);
      toast({
        title: "Xato",
        description: "Birlashtirish jarayonida xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setIsMerging(false);
    }
  };

  const closeMergeDialog = () => {
    setShowMergeDialog(false);
    setMergeData(null);
    window.location.reload();
  };

  const rejectInvitation = async (invitation: FamilyInvitation) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('family_invitations')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', invitation.id);

      if (error) throw error;

      toast({
        title: "Rad etildi",
        description: "Taklifnoma rad etildi",
      });

      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      return true;
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error rejecting invitation:', err);
      toast({
        title: "Xato",
        description: err.message || "Taklifni rad etishda xatolik",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('family_invitations_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'family_invitations',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          fetchInvitations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchInvitations]);

  return {
    pendingInvitations,
    isLoading,
    fetchInvitations,
    acceptInvitation,
    rejectInvitation,
    showMergeDialog,
    setShowMergeDialog,
    mergeData,
    setMergeData,
    executeMerge,
    closeMergeDialog,
    isMerging,
  };
};
