import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface GroupMessageComment {
  id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export const useGroupMessageComments = (messageId: string | null) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<GroupMessageComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!messageId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('group_message_comments')
        .select(`
          id,
          content,
          created_at,
          user:profiles(id, name, username, avatar_url)
        `)
        .eq('message_id', messageId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // The return type of user is a single object because it's a many-to-one relationship
      const formattedComments: GroupMessageComment[] = (data || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user: Array.isArray(c.user) ? c.user[0] : c.user,
      }));

      setComments(formattedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Izohlarni yuklashda xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Real-time updates
  useEffect(() => {
    if (!messageId) return;

    const channel = supabase
      .channel(`group_message_comments_${messageId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_message_comments',
          filter: `message_id=eq.${messageId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageId, fetchComments]);

  const addComment = async (content: string) => {
    if (!user?.id || !messageId || !content.trim()) return false;

    try {
      const { error } = await supabase
        .from('group_message_comments')
        .insert({
          message_id: messageId,
          user_id: user.id,
          content: content.trim()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Izoh qo\'shishda xatolik yuz berdi');
      return false;
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!user?.id) return false;
    
    try {
      const { error } = await supabase
        .from('group_message_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id); // Additional safety
        
      if (error) throw error;
      
      setComments(prev => prev.filter(c => c.id !== commentId));
      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Izohni o\'chirishda xatolik yuz berdi');
      return false;
    }
  };

  return {
    comments,
    isLoading,
    addComment,
    deleteComment,
    refresh: fetchComments
  };
};
