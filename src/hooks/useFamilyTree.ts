import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface FamilyMember {
  id: string;
  owner_id: string;
  linked_user_id: string | null;
  member_name: string;
  relation_type: string;
  avatar_url: string | null;
  gender: 'male' | 'female' | null;
  is_placeholder: boolean;
  created_at: string;
  updated_at: string;
  // Joined profile data for linked users
  linked_profile?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    gender: string | null;
  } | null;
  // Owner profile data (for showing who created this member)
  owner_profile?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export interface FamilyInvitation {
  id: string;
  sender_id: string;
  receiver_id: string;
  member_id: string;
  relation_type: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  // Joined data
  sender_profile?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  member?: FamilyMember | null;
}

// Relationship limits - vaqtinchalik 1 ta ota, 1 ta ona, 1 ta juft
export const FAMILY_LIMITS = {
  MAX_SPOUSES: 1,
  MAX_FATHERS: 1,
  MAX_MOTHERS: 1,
  MAX_CHILDREN: 8,
};

export const useFamilyTree = (userId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [networkUsers, setNetworkUsers] = useState<string[]>([]);

  const targetUserId = userId || user?.id;

  // Get or create family network for user
  const ensureFamilyNetwork = useCallback(async (userId: string): Promise<string | null> => {
    try {
      // Check if user already has a network
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_network_id')
        .eq('id', userId)
        .single();

      if (profile?.family_network_id) {
        return profile.family_network_id;
      }

      // Create new network
      const { data: newNetwork, error: networkError } = await supabase
        .from('family_networks')
        .insert({})
        .select()
        .single();

      if (networkError) throw networkError;

      // Assign network to user
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ family_network_id: newNetwork.id })
        .eq('id', userId);

      if (updateError) throw updateError;

      return newNetwork.id;
    } catch (error) {
      console.error('Error ensuring family network:', error);
      return null;
    }
  }, []);

  // Get all users in the same family network
  const fetchNetworkUsers = useCallback(async () => {
    if (!targetUserId) return [];

    try {
      // First get the user's network
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_network_id')
        .eq('id', targetUserId)
        .single();

      if (!profile?.family_network_id) {
        // User doesn't have a network yet, just return themselves
        setNetworkUsers([targetUserId]);
        return [targetUserId];
      }

      // Get all users in this network
      const { data: networkProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_network_id', profile.family_network_id);

      const users = networkProfiles?.map(p => p.id) || [targetUserId];
      setNetworkUsers(users);
      return users;
    } catch (error) {
      console.error('Error fetching network users:', error);
      return [targetUserId];
    }
  }, [targetUserId]);

  // Get network users for current user - helper for add functions
  const getNetworkUsersForCurrentUser = useCallback(async (): Promise<string[]> => {
    if (!user?.id) return [];
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('family_network_id')
        .eq('id', user.id)
        .single();

      if (!profile?.family_network_id) {
        return [user.id];
      }

      const { data: networkProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_network_id', profile.family_network_id);

      return networkProfiles?.map(p => p.id) || [user.id];
    } catch (error) {
      console.error('Error fetching network users:', error);
      return [user.id];
    }
  }, [user?.id]);

  // Merge two family networks when invitation is accepted
  const mergeNetworks = useCallback(async (user1Id: string, user2Id: string): Promise<boolean> => {
    try {
      console.log('Merging networks for users:', user1Id, user2Id);
      
      // Get both users' networks
      const { data: profiles, error: fetchError } = await supabase
        .from('profiles')
        .select('id, family_network_id')
        .in('id', [user1Id, user2Id]);

      if (fetchError) {
        console.error('Error fetching profiles:', fetchError);
        return false;
      }

      if (!profiles || profiles.length !== 2) {
        console.error('Could not find both profiles:', profiles);
        return false;
      }

      const profile1 = profiles.find(p => p.id === user1Id);
      const profile2 = profiles.find(p => p.id === user2Id);
      
      const network1 = profile1?.family_network_id;
      const network2 = profile2?.family_network_id;

      console.log('Current networks:', { network1, network2 });

      // If both have the same network, nothing to merge
      if (network1 && network1 === network2) {
        console.log('Users already in same network');
        return true;
      }

      // Determine target network
      let targetNetworkId: string | null = null;

      if (network1 && network2) {
        // Both have networks - merge network2 users into network1
        targetNetworkId = network1;
        
        const { error: moveError } = await supabase
          .from('profiles')
          .update({ family_network_id: targetNetworkId })
          .eq('family_network_id', network2);

        if (moveError) {
          console.error('Error moving users from network2:', moveError);
          throw moveError;
        }
        console.log('Moved users from network2 to network1');
      } else if (network1) {
        // Only user1 has network - add user2 to it
        targetNetworkId = network1;
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ family_network_id: targetNetworkId })
          .eq('id', user2Id);

        if (updateError) {
          console.error('Error adding user2 to network:', updateError);
          throw updateError;
        }
        console.log('Added user2 to network1');
      } else if (network2) {
        // Only user2 has network - add user1 to it
        targetNetworkId = network2;
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ family_network_id: targetNetworkId })
          .eq('id', user1Id);

        if (updateError) {
          console.error('Error adding user1 to network:', updateError);
          throw updateError;
        }
        console.log('Added user1 to network2');
      } else {
        // Neither has a network - create one and add both
        const { data: newNetwork, error: networkError } = await supabase
          .from('family_networks')
          .insert({})
          .select()
          .single();

        if (networkError) {
          console.error('Error creating new network:', networkError);
          throw networkError;
        }

        targetNetworkId = newNetwork.id;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ family_network_id: targetNetworkId })
          .in('id', [user1Id, user2Id]);

        if (updateError) {
          console.error('Error adding both users to new network:', updateError);
          throw updateError;
        }
        console.log('Created new network and added both users');
      }

      console.log('Networks merged successfully, target:', targetNetworkId);
      return true;
    } catch (error) {
      console.error('Error merging networks:', error);
      return false;
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!targetUserId) return;

    try {
      // First get all users in the network
      const users = await fetchNetworkUsers();

      // Fetch all members from all users in the network
      // MUHIM: merged_into bo'lgan yoki relation_type 'merged_into_' bilan boshlangan nodelarni filtrlash
      const { data, error } = await supabase
        .from('family_tree_members')
        .select('*')
        .in('owner_id', users)
        .is('merged_into', null) // Filter out merged nodes
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Qo'shimcha filtrlash: legacy merged_into_ relation_type larni ham chiqarib tashlash
      const filteredData = (data || []).filter(m => 
        !m.relation_type.startsWith('merged_into_')
      );

      // Get all unique owner_ids and linked_user_ids to fetch profiles
      const ownerIds = [...new Set(filteredData.map(m => m.owner_id))];
      const linkedUserIds = [...new Set(filteredData.filter(m => m.linked_user_id).map(m => m.linked_user_id))];
      const allProfileIds = [...new Set([...ownerIds, ...linkedUserIds.filter(Boolean)])];

      // Fetch all profiles in one query
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, gender')
        .in('id', allProfileIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Map members with profiles
      const membersWithProfiles: FamilyMember[] = filteredData.map(member => {
        const ownerProfile = profilesMap.get(member.owner_id);
        const linkedProfile = member.linked_user_id ? profilesMap.get(member.linked_user_id) : null;

        return {
          ...member,
          gender: member.gender as 'male' | 'female' | null,
          linked_profile: linkedProfile ? {
            id: linkedProfile.id,
            name: linkedProfile.name,
            username: linkedProfile.username,
            avatar_url: linkedProfile.avatar_url,
            gender: linkedProfile.gender
          } : null,
          owner_profile: ownerProfile ? {
            id: ownerProfile.id,
            name: ownerProfile.name,
            username: ownerProfile.username,
            avatar_url: ownerProfile.avatar_url
          } : null
        };
      });

      setMembers(membersWithProfiles);
    } catch (error: any) {
      console.error('Error fetching family members:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, fetchNetworkUsers]);

  const fetchInvitations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('family_invitations')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sender profiles
      const invitationsWithData = await Promise.all(
        (data || []).map(async (inv) => {
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url')
            .eq('id', inv.sender_id)
            .single();

          const { data: memberData } = await supabase
            .from('family_tree_members')
            .select('*')
            .eq('id', inv.member_id)
            .single();

          return {
            ...inv,
            status: inv.status as 'pending' | 'accepted' | 'rejected',
            sender_profile: senderProfile,
            member: memberData ? {
              ...memberData,
              gender: memberData.gender as 'male' | 'female' | null,
              linked_profile: null
            } : null
          };
        })
      );

      setInvitations(invitationsWithData);
    } catch (error: any) {
      console.error('Error fetching invitations:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, [fetchMembers, fetchInvitations]);

  // Subscribe to realtime updates for invitations and family members
  useEffect(() => {
    if (!user?.id) return;

    const invitationsChannel = supabase
      .channel('family_invitations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_invitations',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          fetchInvitations();
        }
      )
      .subscribe();

    const membersChannel = supabase
      .channel('family_members_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'family_tree_members'
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(invitationsChannel);
      supabase.removeChannel(membersChannel);
    };
  }, [user?.id, fetchInvitations, fetchMembers]);

  const addMember = async (memberData: {
    member_name: string;
    relation_type: string;
    avatar_url?: string;
    gender?: 'male' | 'female';
  }) => {
    if (!user?.id) return null;

    try {
      // Ensure user has a network before adding member
      await ensureFamilyNetwork(user.id);

      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          owner_id: user.id,
          member_name: memberData.member_name,
          relation_type: memberData.relation_type,
          avatar_url: memberData.avatar_url || null,
          gender: memberData.gender || null,
          is_placeholder: true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "Qo'shildi!",
        description: `${memberData.member_name} oila daraxtiga qo'shildi`,
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const sendInvitation = async (receiverId: string, memberId: string, relationType: string) => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('family_invitations')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          member_id: memberId,
          relation_type: relationType,
        });

      if (error) throw error;

      toast({
        title: "Yuborildi!",
        description: "Taklifnoma muvaffaqiyatli yuborildi",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const respondToInvitation = async (invitationId: string, accept: boolean) => {
    if (!user?.id) return false;

    try {
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) return false;

      // Update invitation status
      const { error: updateError } = await supabase
        .from('family_invitations')
        .update({ status: accept ? 'accepted' : 'rejected' })
        .eq('id', invitationId);

      if (updateError) throw updateError;

      if (accept) {
        // Merge the family networks of sender and receiver
        await mergeNetworks(invitation.sender_id, user.id);

        // Link the user to the family member
        const { error: linkError } = await supabase
          .from('family_tree_members')
          .update({ 
            linked_user_id: user.id,
            is_placeholder: false 
          })
          .eq('id', invitation.member_id);

        if (linkError) throw linkError;
      }

      await fetchInvitations();
      await fetchMembers();

      toast({
        title: accept ? "Qabul qilindi!" : "Rad etildi",
        description: accept ? "Siz oila daraxtiga qo'shildingiz va endi barcha a'zolarni ko'rishingiz mumkin" : "Taklifnoma rad etildi",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const linkExistingMemberToUser = async (memberId: string, targetUserId: string) => {
    if (!user?.id) return false;

    try {
      // First check if there's already a pending invitation
      const { data: existing } = await supabase
        .from('family_invitations')
        .select('id')
        .eq('member_id', memberId)
        .eq('receiver_id', targetUserId)
        .eq('status', 'pending')
        .single();

      if (existing) {
        toast({
          title: "Taklifnoma mavjud",
          description: "Bu inson uchun allaqachon taklifnoma yuborilgan",
        });
        return false;
      }

      // Get the member to send invitation
      const member = members.find(m => m.id === memberId);
      if (!member) return false;

      return await sendInvitation(targetUserId, memberId, member.relation_type);
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteMember = async (memberId: string) => {
    if (!user?.id) return false;

    try {
      // Also delete any spouses of this member
      const spouseRelations = members.filter(m => 
        m.relation_type === `spouse_of_${memberId}` || 
        m.relation_type === `spouse_2_of_${memberId}`
      );
      
      // Also delete any children of this member
      const childRelations = members.filter(m => 
        m.relation_type === `child_of_${memberId}` ||
        m.relation_type.startsWith(`child_`) && m.relation_type.includes(memberId)
      );

      // Delete spouses first
      for (const spouse of spouseRelations) {
        await supabase
          .from('family_tree_members')
          .delete()
          .eq('id', spouse.id);
      }

      // Delete children
      for (const child of childRelations) {
        await supabase
          .from('family_tree_members')
          .delete()
          .eq('id', child.id);
      }

      const { error } = await supabase
        .from('family_tree_members')
        .delete()
        .eq('id', memberId)
        .eq('owner_id', user.id);

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "O'chirildi!",
        description: "Qarindosh oila daraxtidan o'chirildi",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  // Count spouses for a member
  // Barcha holatlarni tekshiradi:
  // 1. Bu profilga juft qo'shilganmi (spouse_of_${memberId})
  // 2. Bu profil o'zi boshqa profilga juft sifatida qo'shilganmi
  // 3. Bu profil ota bo'lsa va shu farzandning onasi ham bormi (yoki aksincha)
  // 4. Bu profil biror memberning otasi bo'lsa va shu memberning onasi ham alohida qo'shilgan bo'lsa
  const countSpousesForMember = (memberId: string): number => {
    // Tekshirish 1: bu profilga juft qo'shilganmi
    const spousesAdded = members.filter(m => 
      m.relation_type === `spouse_of_${memberId}`
    ).length;
    
    if (spousesAdded > 0) return spousesAdded;
    
    const memberSelf = members.find(m => m.id === memberId);
    if (!memberSelf) return 0;
    
    // Tekshirish 2: bu profil o'zi boshqa profilga juft sifatida qo'shilganmi
    if (memberSelf.relation_type.startsWith('spouse_of_')) {
      return 1;
    }
    
    // Tekshirish 3: Bu profil ota yoki ona bo'lsa (father_of_X / mother_of_X formatida)
    // va shu farzandning teskari ota-onasi ham bormi
    const fatherMatch = memberSelf.relation_type.match(/^father_of_(.+)$/);
    if (fatherMatch) {
      const childId = fatherMatch[1];
      // Shu farzandning onasi bormi? Yoki otaga juft qo'shilganmi?
      const hasMotherPair = members.some(m => m.relation_type === `mother_of_${childId}`);
      const hasSpouseAdded = members.some(m => m.relation_type === `spouse_of_${memberId}`);
      if (hasMotherPair || hasSpouseAdded) return 1;
    }
    
    const motherMatch = memberSelf.relation_type.match(/^mother_of_(.+)$/);
    if (motherMatch) {
      const childId = motherMatch[1];
      // Shu farzandning otasi bormi? Yoki onaga juft qo'shilganmi?
      const hasFatherPair = members.some(m => m.relation_type === `father_of_${childId}`);
      const hasSpouseAdded = members.some(m => m.relation_type === `spouse_of_${memberId}`);
      if (hasFatherPair || hasSpouseAdded) return 1;
    }
    
    // Tekshirish 4: Bu profil biror memberning otasi bo'lsa va shu memberning onasi ham alohida qo'shilgan bo'lsa
    // Masalan: "father" legacy type
    if (memberSelf.relation_type === 'father') {
      // Legacy father - ona bormi?
      const hasMother = members.some(m => m.relation_type === 'mother');
      if (hasMother) return 1;
    }
    
    if (memberSelf.relation_type === 'mother') {
      // Legacy mother - ota bormi?
      const hasFather = members.some(m => m.relation_type === 'father');
      if (hasFather) return 1;
    }
    
    return 0;
  };

  // Count children for a member
  // MUHIM: Agar member kimningdir jufti bo'lsa, juftining bolalari ham shu memberga tegishli
  const countChildrenForMember = (memberId: string): number => {
    // 1. To'g'ridan-to'g'ri shu memberning bolalari
    const directChildren = members.filter(m => 
      m.relation_type.startsWith(`child_of_${memberId}`)
    ).length;
    
    if (directChildren > 0) return directChildren;
    
    // 2. Agar bu member kimningdir jufti bo'lsa - juftining bolalarini qaytaramiz
    const memberSelf = members.find(m => m.id === memberId);
    if (memberSelf) {
      // spouse_of_X formatidan X ni topamiz
      const spouseMatch = memberSelf.relation_type.match(/^spouse_of_(.+)$/);
      if (spouseMatch) {
        const partnerId = spouseMatch[1];
        // Juftning bolalari = mening bolalarim
        const partnerChildren = members.filter(m => 
          m.relation_type.startsWith(`child_of_${partnerId}`)
        ).length;
        return partnerChildren;
      }
    }
    
    return 0;
  };

  // Count parents (fathers) for a member
  // TO'G'RI QOIDA: Har qanday odam o'z ota-onasiga ega bo'lishi mumkin
  // child_of_ orqali yaratilgan bo'lsa HAM - bu faqat BITTA juftlikdan yaratilganini bildiradi
  // lekin shu farzandning o'z ALOHIDA ota-onasi bo'lishi ham mumkin (masalan: asrab olgan ota-ona)
  // LEKIN: child_of_X dagi X ning O'ZI ota yoki ona hisoblanadi
  const countFathersForMember = (memberId: string): number => {
    const memberSelf = members.find(m => m.id === memberId);
    if (!memberSelf) return 0;
    
    // Agar bu member child_of_X orqali yaratilgan bo'lsa
    // X ning jinsi tekshiriladi - agar X erkak bo'lsa - u OTA
    const childMatch = memberSelf.relation_type.match(/^child_of_([^_]+)/);
    if (childMatch) {
      const parentId = childMatch[1];
      const parent = members.find(m => m.id === parentId);
      if (parent) {
        const parentGender = parent.gender || parent.linked_profile?.gender;
        // Agar parent erkak bo'lsa - bu OTA
        if (parentGender === 'male') {
          return 1; // Ota bor (parent o'zi)
        }
        // Agar parent ayol bo'lsa (ONA) - otani spouse orqali tekshiramiz
        if (parentGender === 'female') {
          const parentSpouse = members.find(m => m.relation_type === `spouse_of_${parentId}`);
          if (parentSpouse) {
            return 1; // Ota bor (ona jufti)
          }
          return 0; // Ota yo'q - qo'shish mumkin (lekin ona ota-onasi emas!)
        }
      }
      // Agar parent topilmasa yoki jins aniqlanmasa - 0
      return 0;
    }
    
    // To'g'ridan-to'g'ri father_of_ relation bilan qo'shilgan ota
    const directFatherCount = members.filter(m => 
      m.relation_type === `father_of_${memberId}`
    ).length;
    
    if (directFatherCount > 0) return directFatherCount;
    
    // Agar ona bor va onaga juft qo'shilgan bo'lsa - bu ota
    const mother = members.find(m => m.relation_type === `mother_of_${memberId}`);
    if (mother) {
      const motherSpouse = members.find(m => m.relation_type === `spouse_of_${mother.id}`);
      if (motherSpouse) {
        return 1; // Ota bor (ona jufti sifatida)
      }
    }
    
    return 0;
  };

  // Count parents (mothers) for a member
  // TO'G'RI QOIDA: Har qanday odam o'z ota-onasiga ega bo'lishi mumkin
  const countMothersForMember = (memberId: string): number => {
    const memberSelf = members.find(m => m.id === memberId);
    if (!memberSelf) return 0;
    
    // Agar bu member child_of_X orqali yaratilgan bo'lsa
    // X ning jinsi tekshiriladi - agar X ayol bo'lsa - u ONA
    const childMatch = memberSelf.relation_type.match(/^child_of_([^_]+)/);
    if (childMatch) {
      const parentId = childMatch[1];
      const parent = members.find(m => m.id === parentId);
      if (parent) {
        const parentGender = parent.gender || parent.linked_profile?.gender;
        // Agar parent ayol bo'lsa - bu ONA
        if (parentGender === 'female') {
          return 1; // Ona bor (parent o'zi)
        }
        // Agar parent erkak bo'lsa (OTA) - onani spouse orqali tekshiramiz
        if (parentGender === 'male') {
          const parentSpouse = members.find(m => m.relation_type === `spouse_of_${parentId}`);
          if (parentSpouse) {
            return 1; // Ona bor (ota jufti)
          }
          return 0; // Ona yo'q - qo'shish mumkin
        }
      }
      return 0;
    }
    
    // To'g'ridan-to'g'ri mother_of_ relation bilan qo'shilgan ona
    const directMotherCount = members.filter(m => 
      m.relation_type === `mother_of_${memberId}`
    ).length;
    
    if (directMotherCount > 0) return directMotherCount;
    
    // Agar ota bor va otaga juft qo'shilgan bo'lsa - bu ona
    const father = members.find(m => m.relation_type === `father_of_${memberId}`);
    if (father) {
      const fatherSpouse = members.find(m => m.relation_type === `spouse_of_${father.id}`);
      if (fatherSpouse) {
        return 1; // Ona bor (ota jufti sifatida)
      }
    }
    
    return 0;
  };
  
  // Ota jufti = ona ekanligini tekshirish
  // Agar memberga ota qo'shilgan bo'lsa va shu otaga juft qo'shilsa - bu ona
  // Shuning uchun "Ona qo'shish" tugmasi yo'qolishi kerak
  const isFatherSpouseAsMother = (memberId: string): boolean => {
    const father = members.find(m => m.relation_type === `father_of_${memberId}`);
    if (father) {
      const fatherSpouse = members.find(m => m.relation_type === `spouse_of_${father.id}`);
      return !!fatherSpouse;
    }
    return false;
  };
  
  // Ona jufti = ota ekanligini tekshirish
  const isMotherSpouseAsFather = (memberId: string): boolean => {
    const mother = members.find(m => m.relation_type === `mother_of_${memberId}`);
    if (mother) {
      const motherSpouse = members.find(m => m.relation_type === `spouse_of_${mother.id}`);
      return !!motherSpouse;
    }
    return false;
  };

  // Add spouse to an existing member
  // Barcha network userlarning memberlarini tekshiradi
  const addSpouseToMember = async (
    memberId: string, 
    spouseData: { name: string; gender: 'male' | 'female'; avatarUrl?: string },
    isSecondSpouse: boolean = false
  ) => {
    if (!user?.id) return null;

    try {
      // Fetch fresh data from ALL network users to get accurate spouse count
      const users = await getNetworkUsersForCurrentUser();
      
      const { data: existingSpouses, error: countError } = await supabase
        .from('family_tree_members')
        .select('id, relation_type')
        .in('owner_id', users)
        .or(`relation_type.eq.spouse_of_${memberId},relation_type.eq.spouse_2_of_${memberId}`);

      if (countError) throw countError;

      const currentSpouseCount = existingSpouses?.length || 0;
      
      if (currentSpouseCount >= FAMILY_LIMITS.MAX_SPOUSES) {
        toast({
          title: "Limit",
          description: `Maksimal ${FAMILY_LIMITS.MAX_SPOUSES} ta juft qo'shish mumkin`,
          variant: "destructive",
        });
        return null;
      }

      // Ensure user has a network before adding member
      await ensureFamilyNetwork(user.id);

      const relationType = isSecondSpouse ? `spouse_2_of_${memberId}` : `spouse_of_${memberId}`;

      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          owner_id: user.id,
          member_name: spouseData.name,
          relation_type: relationType,
          avatar_url: spouseData.avatarUrl || null,
          gender: spouseData.gender,
          is_placeholder: true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "Juft qo'shildi!",
        description: `${spouseData.name} juft sifatida qo'shildi`,
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  // Add child to a member (requires spouse)
  // Barcha network userlarning memberlarini tekshiradi
  // MUHIM: Agar member kimningdir jufti bo'lsa (spouse_of_X), bolani X ga bog'laymiz
  const addChildToMember = async (
    memberId: string,
    childData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }
  ) => {
    if (!user?.id) return null;

    try {
      // Avval bu memberning o'zi kimningdir jufti ekanligini tekshiramiz
      const memberSelf = members.find(m => m.id === memberId);
      let targetParentId = memberId;
      
      if (memberSelf) {
        const spouseMatch = memberSelf.relation_type.match(/^spouse_of_(.+)$/);
        if (spouseMatch) {
          // Bu member kimningdir jufti - bolani asosiy ota/onaga bog'laymiz
          targetParentId = spouseMatch[1];
        }
      }

      // Fetch fresh data from ALL network users to get accurate child count
      const users = await getNetworkUsersForCurrentUser();
      
      const { data: existingChildren, error: countError } = await supabase
        .from('family_tree_members')
        .select('id, relation_type')
        .in('owner_id', users)
        .like('relation_type', `child_of_${targetParentId}%`);

      if (countError) throw countError;

      const currentChildCount = existingChildren?.length || 0;
      
      if (currentChildCount >= FAMILY_LIMITS.MAX_CHILDREN) {
        toast({
          title: "Limit",
          description: `Maksimal ${FAMILY_LIMITS.MAX_CHILDREN} ta farzand qo'shish mumkin`,
          variant: "destructive",
        });
        return null;
      }

      await ensureFamilyNetwork(user.id);

      const childNumber = currentChildCount + 1;
      const relationType = `child_of_${targetParentId}_${childNumber}`;

      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          owner_id: user.id,
          member_name: childData.name,
          relation_type: relationType,
          avatar_url: childData.avatarUrl || null,
          gender: childData.gender,
          is_placeholder: true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "Farzand qo'shildi!",
        description: `${childData.name} farzand sifatida qo'shildi`,
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  // Add father to a member (faqat bitta ota)
  // Barcha network userlarning memberlarini tekshiradi
  const addFatherToMember = async (
    memberId: string,
    fatherData: { name: string; avatarUrl?: string }
  ) => {
    if (!user?.id) return null;

    try {
      // Fetch fresh data from ALL network users to get accurate count
      const users = await getNetworkUsersForCurrentUser();
      
      const { data: existingFathers, error: countError } = await supabase
        .from('family_tree_members')
        .select('id, relation_type')
        .in('owner_id', users)
        .eq('relation_type', `father_of_${memberId}`);

      if (countError) throw countError;

      const currentFatherCount = existingFathers?.length || 0;

      if (currentFatherCount >= FAMILY_LIMITS.MAX_FATHERS) {
        toast({
          title: "Limit",
          description: `Maksimal ${FAMILY_LIMITS.MAX_FATHERS} ta ota qo'shish mumkin`,
          variant: "destructive",
        });
        return null;
      }

      await ensureFamilyNetwork(user.id);

      const relationType = `father_of_${memberId}`;

      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          owner_id: user.id,
          member_name: fatherData.name,
          relation_type: relationType,
          avatar_url: fatherData.avatarUrl || null,
          gender: 'male',
          is_placeholder: true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "Ota qo'shildi!",
        description: `${fatherData.name} ota sifatida qo'shildi`,
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  // Add mother to a member (faqat bitta ona)
  // Barcha network userlarning memberlarini tekshiradi
  const addMotherToMember = async (
    memberId: string,
    motherData: { name: string; avatarUrl?: string }
  ) => {
    if (!user?.id) return null;

    try {
      // Fetch fresh data from ALL network users to get accurate count
      const users = await getNetworkUsersForCurrentUser();
      
      const { data: existingMothers, error: countError } = await supabase
        .from('family_tree_members')
        .select('id, relation_type')
        .in('owner_id', users)
        .eq('relation_type', `mother_of_${memberId}`);

      if (countError) throw countError;

      const currentMotherCount = existingMothers?.length || 0;

      if (currentMotherCount >= FAMILY_LIMITS.MAX_MOTHERS) {
        toast({
          title: "Limit",
          description: `Maksimal ${FAMILY_LIMITS.MAX_MOTHERS} ta ona qo'shish mumkin`,
          variant: "destructive",
        });
        return null;
      }

      await ensureFamilyNetwork(user.id);

      const relationType = `mother_of_${memberId}`;

      const { data, error } = await supabase
        .from('family_tree_members')
        .insert({
          owner_id: user.id,
          member_name: motherData.name,
          relation_type: relationType,
          avatar_url: motherData.avatarUrl || null,
          gender: 'female',
          is_placeholder: true,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchMembers();
      toast({
        title: "Ona qo'shildi!",
        description: `${motherData.name} ona sifatida qo'shildi`,
      });

      return data;
    } catch (error: any) {
      toast({
        title: "Xato",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  return {
    members,
    invitations,
    isLoading,
    networkUsers,
    addMember,
    addSpouseToMember,
    addChildToMember,
    addFatherToMember,
    addMotherToMember,
    countSpousesForMember,
    countChildrenForMember,
    countFathersForMember,
    countMothersForMember,
    isFatherSpouseAsMother,
    isMotherSpouseAsFather,
    sendInvitation,
    respondToInvitation,
    linkExistingMemberToUser,
    deleteMember,
    refetch: fetchMembers,
    refetchInvitations: fetchInvitations,
  };
};
