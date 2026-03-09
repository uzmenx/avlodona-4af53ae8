import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/types';

export interface MentionedPost extends Post {
  mentionedAt: string;
}

export interface CollabRequest {
  id: string;
  post_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  post?: {
    id: string;
    content: string | null;
    media_urls: string[] | null;
    user_id: string;
  };
  author?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export const useMentionsCollabs = (userId?: string) => {
  const { user } = useAuth();
  const targetId = userId || user?.id;
  const [mentionedPosts, setMentionedPosts] = useState<Post[]>([]);
  const [collabPosts, setCollabPosts] = useState<Post[]>([]);
  const [pendingCollabs, setPendingCollabs] = useState<CollabRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMentionedPosts = useCallback(async () => {
    if (!targetId) return;
    try {
      const { data: mentions } = await supabase
        .from('post_mentions')
        .select('post_id, created_at')
        .eq('mentioned_user_id', targetId)
        .order('created_at', { ascending: false });

      if (!mentions || mentions.length === 0) {
        setMentionedPosts([]);
        return;
      }

      const postIds = mentions.map(m => m.post_id);
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .in('id', postIds)
        .order('created_at', { ascending: false });

      if (!posts || posts.length === 0) {
        setMentionedPosts([]);
        return;
      }

      const authorIds = [...new Set(posts.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, email, bio')
        .in('id', authorIds);

      const enriched = posts.map(post => ({
        ...post,
        media_urls: post.media_urls || [],
        author: profiles?.find(p => p.id === post.user_id)
          ? {
              id: post.user_id,
              email: profiles.find(p => p.id === post.user_id)?.email || '',
              full_name: profiles.find(p => p.id === post.user_id)?.name || '',
              username: profiles.find(p => p.id === post.user_id)?.username || '',
              bio: profiles.find(p => p.id === post.user_id)?.bio || '',
              avatar_url: profiles.find(p => p.id === post.user_id)?.avatar_url || '',
              cover_url: '',
              instagram: '',
              telegram: '',
              followers_count: 0,
              following_count: 0,
              relatives_count: 0,
              created_at: post.created_at,
            }
          : undefined,
      }));

      setMentionedPosts(enriched);
    } catch (e) {
      console.error('Error fetching mentioned posts:', e);
    }
  }, [targetId]);

  const fetchCollabPosts = useCallback(async () => {
    if (!targetId) return;
    try {
      const { data: collabs } = await supabase
        .from('post_collabs')
        .select('post_id')
        .eq('user_id', targetId)
        .eq('status', 'accepted');

      if (!collabs || collabs.length === 0) {
        setCollabPosts([]);
        return;
      }

      const postIds = collabs.map(c => c.post_id);
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .in('id', postIds)
        .order('created_at', { ascending: false });

      if (!posts || posts.length === 0) {
        setCollabPosts([]);
        return;
      }

      const authorIds = [...new Set(posts.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, email, bio')
        .in('id', authorIds);

      const enriched = posts.map(post => ({
        ...post,
        media_urls: post.media_urls || [],
        author: profiles?.find(p => p.id === post.user_id)
          ? {
              id: post.user_id,
              email: profiles.find(p => p.id === post.user_id)?.email || '',
              full_name: profiles.find(p => p.id === post.user_id)?.name || '',
              username: profiles.find(p => p.id === post.user_id)?.username || '',
              bio: profiles.find(p => p.id === post.user_id)?.bio || '',
              avatar_url: profiles.find(p => p.id === post.user_id)?.avatar_url || '',
              cover_url: '',
              instagram: '',
              telegram: '',
              followers_count: 0,
              following_count: 0,
              relatives_count: 0,
              created_at: post.created_at,
            }
          : undefined,
      }));

      setCollabPosts(enriched);
    } catch (e) {
      console.error('Error fetching collab posts:', e);
    }
  }, [targetId]);

  const fetchPendingCollabs = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('post_collabs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!data || data.length === 0) {
        setPendingCollabs([]);
        return;
      }

      // Fetch post info
      const postIds = data.map(c => c.post_id);
      const { data: posts } = await supabase
        .from('posts')
        .select('id, content, media_urls, user_id')
        .in('id', postIds);

      // Fetch authors
      const authorIds = [...new Set((posts || []).map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', authorIds);

      const enriched: CollabRequest[] = data.map(collab => ({
        ...collab,
        status: collab.status as 'pending' | 'accepted' | 'rejected',
        post: posts?.find(p => p.id === collab.post_id) || undefined,
        author: (() => {
          const post = posts?.find(p => p.id === collab.post_id);
          return post ? profiles?.find(p => p.id === post.user_id) || undefined : undefined;
        })(),
      }));

      setPendingCollabs(enriched);
    } catch (e) {
      console.error('Error fetching pending collabs:', e);
    }
  }, [user?.id]);

  const respondToCollab = async (collabId: string, accept: boolean) => {
    try {
      const collab = pendingCollabs.find(c => c.id === collabId);
      
      await supabase
        .from('post_collabs')
        .update({ status: accept ? 'accepted' : 'rejected', updated_at: new Date().toISOString() })
        .eq('id', collabId);

      setPendingCollabs(prev => prev.filter(c => c.id !== collabId));

      if (accept && collab?.post?.user_id && user?.id) {
        // Send collab_accepted notification
        await supabase.from('notifications').insert({
          user_id: collab.post.user_id,
          actor_id: user.id,
          type: 'collab_accepted',
          post_id: collab.post_id,
        });

        // Send a message to the post author
        const authorId = collab.post.user_id;
        // Find or create conversation
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${authorId}),and(participant1_id.eq.${authorId},participant2_id.eq.${user.id})`)
          .maybeSingle();

        let convId = existing?.id;
        if (!convId) {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({ participant1_id: user.id, participant2_id: authorId })
            .select('id')
            .single();
          convId = newConv?.id;
        }

        if (convId) {
          await supabase.from('messages').insert({
            conversation_id: convId,
            sender_id: user.id,
            content: `✅ Hamkorlik so'rovini qabul qildim! Postingizda hamkor sifatida ko'rinaman.`,
          });
          // Update conversation timestamp
          await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', convId);
        }

        fetchCollabPosts();
      }
    } catch (e) {
      console.error('Error responding to collab:', e);
    }
  };

  const addMentions = async (postId: string, userIds: string[]) => {
    if (userIds.length === 0) return;
    try {
      const rows = userIds.map(uid => ({ post_id: postId, mentioned_user_id: uid }));
      const { error: mentionError } = await supabase.from('post_mentions').insert(rows);
      if (mentionError) {
        console.error('Mention insert error:', mentionError);
        return;
      }

      // Send notifications
      for (const uid of userIds) {
        if (uid !== user?.id) {
          const { error: notifError } = await supabase.from('notifications').insert({
            user_id: uid,
            actor_id: user!.id,
            type: 'mention',
            post_id: postId,
          });
          if (notifError) console.error('Mention notification error:', notifError);
        }
      }
    } catch (e) {
      console.error('Error adding mentions:', e);
    }
  };

  const addCollabs = async (postId: string, userIds: string[]) => {
    if (userIds.length === 0) return;
    try {
      const rows = userIds.map(uid => ({ post_id: postId, user_id: uid }));
      const { error: collabError } = await supabase.from('post_collabs').insert(rows);
      if (collabError) {
        console.error('Collab insert error:', collabError);
        return;
      }

      // Send notifications
      for (const uid of userIds) {
        if (uid !== user?.id) {
          const { error: notifError } = await supabase.from('notifications').insert({
            user_id: uid,
            actor_id: user!.id,
            type: 'collab_request',
            post_id: postId,
          });
          if (notifError) console.error('Collab notification error:', notifError);
        }
      }
    } catch (e) {
      console.error('Error adding collabs:', e);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchMentionedPosts(), fetchCollabPosts(), fetchPendingCollabs()])
      .finally(() => setIsLoading(false));
  }, [fetchMentionedPosts, fetchCollabPosts, fetchPendingCollabs]);

  return {
    mentionedPosts,
    collabPosts,
    pendingCollabs,
    isLoading,
    addMentions,
    addCollabs,
    respondToCollab,
    refetchMentions: fetchMentionedPosts,
    refetchCollabs: fetchCollabPosts,
    refetchPending: fetchPendingCollabs,
  };
};
