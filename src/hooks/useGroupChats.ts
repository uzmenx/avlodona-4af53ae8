import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GroupChat {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: 'group' | 'channel';
  visibility: 'public' | 'private';
  invite_link: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  memberCount?: number;
  lastMessage?: {
    content: string;
    sender_id: string;
    created_at: string;
    sender_name?: string;
  };
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export const useGroupChats = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [channels, setChannels] = useState<GroupChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGroupChats = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Fetch all groups/channels where user is owner or member
      const { data: ownedChats } = await supabase
        .from('group_chats')
        .select('*')
        .eq('owner_id', user.id);

      const { data: memberOf } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      const memberGroupIds = memberOf?.map(m => m.group_id) || [];
      
      let memberChats: any[] = [];
      if (memberGroupIds.length > 0) {
        const { data } = await supabase
          .from('group_chats')
          .select('*')
          .in('id', memberGroupIds);
        memberChats = data || [];
      }

      // Combine and dedupe
      const allChats = [...(ownedChats || []), ...memberChats];
      const uniqueChats = allChats.filter((chat, index, self) => 
        index === self.findIndex(c => c.id === chat.id)
      );

      // Get last messages for each chat
      const chatsWithDetails = await Promise.all(
        uniqueChats.map(async (chat) => {
          const { data: lastMsg } = await supabase
            .from('group_messages')
            .select('content, sender_id, created_at')
            .eq('group_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count: memberCount } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', chat.id);

          return {
            ...chat,
            memberCount: (memberCount || 0) + 1, // +1 for owner
            lastMessage: lastMsg || undefined
          };
        })
      );

      setGroups(chatsWithDetails.filter(c => c.type === 'group'));
      setChannels(chatsWithDetails.filter(c => c.type === 'channel'));
    } catch (error) {
      console.error('Error fetching group chats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchGroupChats();
  }, [fetchGroupChats]);

  const createGroupChat = async (
    name: string,
    type: 'group' | 'channel',
    memberIds: string[],
    description?: string,
    avatarUrl?: string,
    visibility: 'public' | 'private' = 'private'
  ): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      const inviteLink = visibility === 'public' 
        ? `${type}_${Date.now().toString(36)}` 
        : null;

      const { data: newChat, error } = await supabase
        .from('group_chats')
        .insert([{
          name,
          description,
          avatar_url: avatarUrl,
          type,
          visibility,
          invite_link: inviteLink,
          owner_id: user.id,
          created_by: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      // Add members
      if (memberIds.length > 0) {
        const members = memberIds.map(memberId => ({
          group_id: newChat.id,
          user_id: memberId,
          role: 'member'
        }));

        await supabase.from('group_members').upsert(members as any, { onConflict: 'group_id,user_id' });
      }

      await fetchGroupChats();
      return newChat.id;
    } catch (error) {
      console.error('Error creating group chat:', error);
      return null;
    }
  };

  const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
    try {
      const { data: members } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId);

      if (!members) return [];

      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return members.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id)
      }));
    } catch (error) {
      console.error('Error fetching group members:', error);
      return [];
    }
  };

  return {
    groups,
    channels,
    isLoading,
    refetch: fetchGroupChats,
    createGroupChat,
    getGroupMembers
  };
};
