import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMessages, Message } from '@/hooks/useMessages';
import { useConversations } from '@/hooks/useConversations';
import { useVideoCall } from '@/hooks/useVideoCall';
import { supabase } from '@/integrations/supabase/client';
import { Post } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StarUsername } from '@/components/user/StarUsername';
import { ArrowLeft, Phone, Video, MoreVertical, Check, CheckCheck, Clock, Download, Trash, Copy, Forward, Reply, Mic, MicOff, Volume2, VolumeX, Loader2, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { VideoCallUI } from '@/components/chat/VideoCallUI';
import { ChatInput } from '@/components/chat/ChatInput';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { MediaMessage } from '@/components/chat/MediaMessage';
import { MediaFullscreen } from '@/components/chat/MediaFullscreen';
import { MessageContextMenu } from '@/components/chat/MessageContextMenu';
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';
import { ReplyPreview } from '@/components/chat/ReplyPreview';
import { UnifiedFullScreenViewer } from '@/components/feed/UnifiedFullScreenViewer';
import type { Short } from '@/components/shorts/YouTubeShortsSection';
import ChatWallpaperPicker from '@/components/chat/ChatWallpaperPicker';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from 'sonner';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useReactions } from '@/hooks/useReactions';
import { ReactionSummary } from '@/components/post/ReactionSummary';
import { AnimatePresence, motion } from 'framer-motion';

interface UserProfile {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  last_seen: string | null;
  hide_online_status?: boolean;
}

type InvitePreview = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: 'group' | 'channel';
  visibility: 'public' | 'private';
  owner_id: string;
  invite_link: string | null;
};

// Small component so each message can independently subscribe to its reactions
const PrivateMessageReactions = ({ messageId, isMine }: { messageId: string; isMine: boolean }) => {
  const { reactions, toggleReaction } = useReactions({ type: 'message', targetId: messageId });
  if (reactions.length === 0) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        className="mt-0.5"
      >
        <ReactionSummary
          reactions={reactions}
          onReactionClick={(emoji) => void toggleReaction(emoji)}
        />
      </motion.div>
    </AnimatePresence>
  );
};


const Chat = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { getOrCreateConversation } = useConversations();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [sharedPosts, setSharedPosts] = useState<Post[]>([]);
  const [sharedPostsLoading, setSharedPostsLoading] = useState(false);
  const [sharedShorts, setSharedShorts] = useState<Short[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTab, setViewerTab] = useState<'posts' | 'shorts'>('posts');
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [chatWallpaper, setChatWallpaper] = useLocalStorage('chat_wallpaper', 'none');
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [clearedAt, setClearedAt] = useState<number>(0);
  const [inviteCache, setInviteCache] = useState<Record<string, InvitePreview | null>>({});
  const [inviteMemberCache, setInviteMemberCache] = useState<Record<string, boolean>>({});
  const inviteLoadingRef = useRef<Set<string>>(new Set());

  const { isBlocked, isBlockedBy, isEitherBlocked } = useBlockedUsers();
  const isChatBlocked = !!(userId && isEitherBlocked(userId));

  const { messages, isLoading, isLoadingMore, hasMore, otherUserTyping, sendMessage, setTyping, loadOlder, refetch } = useMessages(conversationId);
  
  const {
    isInCall,
    isCreatingRoom,
    incomingCall,
    cameraOn,
    micOn,
    callObject,
    remoteParticipant,
    lastRoomUrl,
    wasInCall,
    startCall,
    answerCall,
    rejoinCall,
    declineCall,
    leaveCall,
    endCallPermanently,
    toggleCamera,
    toggleMic,
  } = useVideoCall(userId || null);

  // Reply & Forward
  const [replyTo, setReplyTo] = useState<{ id: string; content: string } | null>(null);
  const [forwardMessage, setForwardMessage] = useState<{ content: string; mediaUrl?: string | null; mediaType?: string | null } | null>(null);

  // Deleted messages (local storage for "delete for me")
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set());

  // Initialize conversation
  useEffect(() => {
    if (!userId || !user?.id) return;

    // Update own last_seen (fire-and-forget)
    supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then();

    // Fetch other user's profile in background
    supabase
      .from('profiles')
      .select('id, name, username, avatar_url, last_seen, hide_online_status')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data: profile }) => {
        setOtherUser(profile as UserProfile | null);
      });

    // Create/get conversation id in background
    getOrCreateConversation(userId).then((convId) => {
      setConversationId(convId);

      if (!convId) return;
      const stored = localStorage.getItem(`deleted_messages_${convId}`);
      if (stored) {
        setDeletedMessageIds(new Set(JSON.parse(stored)));
      }

      const clearedRaw = localStorage.getItem(`cleared_chat_${convId}`);
      if (clearedRaw) {
        const ts = Number(clearedRaw);
        if (Number.isFinite(ts) && ts > 0) setClearedAt(ts);
      }
    });
  }, [userId, user?.id, getOrCreateConversation]);

  const clearHistoryForMe = useCallback(() => {
    if (!conversationId) return;
    const ts = Date.now();
    setClearedAt(ts);
    localStorage.setItem(`cleared_chat_${conversationId}`, String(ts));
    toast.success("Tarix tozalandi (faqat siz uchun)");
  }, [conversationId]);

  const clearHistoryForAll = useCallback(async () => {
    if (!conversationId) return;
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);
      if (error) throw error;

      const ts = Date.now();
      setClearedAt(ts);
      localStorage.setItem(`cleared_chat_${conversationId}`, String(ts));
      setDeletedMessageIds(new Set());
      localStorage.removeItem(`deleted_messages_${conversationId}`);
      toast.success('Tarix barcha uchun tozalandi');
      refetch();
      window.dispatchEvent(new Event('avlodona:new-message'));
    } catch (error) {
      console.error('Error clearing chat for all:', error);
      toast.error(t('errorOccurred'));
    }
  }, [conversationId, refetch, t]);

  const extractJoinInvite = useCallback((content: string | null | undefined) => {
    if (!content) return null;
    const m = content.match(/\/(?:join)\/([A-Za-z0-9_-]+)/);
    if (!m) return null;
    const inviteLink = m[1];
    const cleaned = content
      .replace(new RegExp('https?://\\S*' + m[0].replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&')), '')
      .replace(m[0], '')
      .trim();
    return { inviteLink, messageText: cleaned };
  }, []);

  const ensureInviteLoaded = useCallback(async (inviteLink: string) => {
    if (!inviteLink) return;
    if (inviteLink in inviteCache) return;
    if (inviteLoadingRef.current.has(inviteLink)) return;
    inviteLoadingRef.current.add(inviteLink);
    try {
      const { data, error } = await (supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => { maybeSingle: () => Promise<{ data: unknown, error: unknown }> } })
        .rpc('get_group_invite_preview', { invite: inviteLink })
        .maybeSingle();
      if (error) throw error;
      setInviteCache((prev) => ({ ...prev, [inviteLink]: (data as unknown as InvitePreview) || null }));

      if (data && typeof data === 'object' && 'id' in data && user?.id) {
        if ('owner_id' in data && data.owner_id === user.id) {
          setInviteMemberCache((prev) => ({ ...prev, [inviteLink]: true }));
        } else {
          const { data: membership } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', data.id as string)
            .eq('user_id', user.id)
            .maybeSingle();
          setInviteMemberCache((prev) => ({ ...prev, [inviteLink]: !!membership }));
        }
      }
    } catch (e) {
      setInviteCache((prev) => ({ ...prev, [inviteLink]: null }));
    } finally {
      inviteLoadingRef.current.delete(inviteLink);
    }
  }, [inviteCache, user?.id]);

  const joinFromInvite = useCallback(async (group: InvitePreview) => {
    if (!user?.id) return;
    if (group.visibility !== 'public') {
      toast.error('Bu yopiq guruh/kanal');
      return;
    }
    try {
      const { error } = await supabase.from('group_members').upsert(
        {
          group_id: group.id,
          user_id: user.id,
          role: 'member',
        } as never,
        { onConflict: 'group_id,user_id' }
      );
      if (error) throw error;
      toast.success("Qo'shildingiz");
      navigate(`/group-chat/${group.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    }
  }, [navigate, user?.id]);

  const extractSharedPost = (content: string | null | undefined) => {
    if (!content) return null;
    const markerMatch = content.match(/\[\[POST:([^\]]+)\]\]/);
    if (!markerMatch) return null;
    const postId = markerMatch[1];
    const cleaned = content
      .replace(markerMatch[0], '')
      .replace(/\n?📎\s*(Post|Shorts):\s*\S+/g, '')
      .trim();
    return { postId, messageText: cleaned };
  };

  const extractSharedShort = (content: string | null | undefined) => {
    if (!content) return null;
    const markerMatch = content.match(/\[\[SHORT:([^\]]+)\]\]/);
    if (!markerMatch) return null;
    const shortId = markerMatch[1];
    const cleaned = content
      .replace(markerMatch[0], '')
      .replace(/\n?📎\s*(Post|Shorts):\s*\S+/g, '')
      .trim();
    return { shortId, messageText: cleaned };
  };

  const buildSharedShortsFromMessages = useCallback((msgs: Message[]): Short[] => {
    const found: Short[] = [];
    const seen = new Set<string>();

    for (const m of msgs) {
      const content = m.content || '';
      const matches = content.matchAll(/\[\[SHORT:([^\]]+)\]\]/g);
      for (const match of matches) {
        const id = match[1];
        if (!id || seen.has(id)) continue;
        seen.add(id);
        found.push({
          id,
          title: 'YouTube Shorts',
          channelTitle: 'YouTube',
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        });
      }
    }
    return found;
  }, []);

  const enrichPostsWithAuthors = async (postsData: Record<string, unknown>[]): Promise<Post[]> => {
    if (!postsData || postsData.length === 0) return [];
    const userIds = [...new Set(postsData.map(p => p.user_id as string))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);
    return postsData.map((post: Record<string, unknown>) => {
      const profile = profiles?.find((p: { id: string }) => p.id === post.user_id);
      return {
        ...post,
        media_urls: post.media_urls || [],
        author: profile ? {
          id: post.user_id,
          full_name: profile.name || 'Foydalanuvchi',
          username: profile.username || 'user',
          bio: profile.bio || '',
          avatar_url: profile.avatar_url || '',
          cover_url: '',
          instagram: '',
          telegram: '',
          followers_count: 0,
          following_count: 0,
          relatives_count: 0,
          created_at: post.created_at,
        } : undefined
      } as Post;
    });
  };

  const loadSharedPosts = async (): Promise<Post[]> => {
    if (sharedPosts.length > 0) return sharedPosts;
    if (sharedPostsLoading) return sharedPosts;
    setSharedPostsLoading(true);
    try {
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const enriched = await enrichPostsWithAuthors(postsData || []);
      setSharedPosts(enriched);
      return enriched;
    } catch (e) {
      console.error('Failed to load posts for shared preview:', e);
      return [];
    } finally {
      setSharedPostsLoading(false);
    }
  };

  const openSharedPostViewer = async (postId: string) => {
    const postsList = await loadSharedPosts();

    let nextPosts = postsList;
    if (nextPosts.length === 0) {
      try {
        const { data: onePost, error } = await supabase
          .from('posts')
          .select('*')
          .eq('id', postId)
          .maybeSingle();
        if (error) throw error;
        const enriched = await enrichPostsWithAuthors(onePost ? [onePost] : []);
        nextPosts = enriched;
        setSharedPosts(enriched);
      } catch (e) {
        console.error('Failed to load shared post:', e);
        return;
      }
    }

    const idx = nextPosts.findIndex((p) => p.id === postId);
    setViewerTab('posts');
    setViewerInitialIndex(Math.max(0, idx));
    setViewerOpen(true);
  };

  const openSharedShortViewer = (shortId: string) => {
    const shortsList = buildSharedShortsFromMessages(messages.filter((m) => !deletedMessageIds.has(m.id)));
    setSharedShorts(shortsList);
    const idx = shortsList.findIndex((s) => s.id === shortId);
    setViewerTab('shorts');
    setViewerInitialIndex(Math.max(0, idx));
    setViewerOpen(true);
  };

  // Real-time online status subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`presence-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newLastSeen = payload.new?.last_seen;
          const newHideStatus = payload.new?.hide_online_status;
          if (newLastSeen !== undefined || newHideStatus !== undefined) {
            setOtherUser(prev => prev ? { 
              ...prev, 
              ...(newLastSeen !== undefined && { last_seen: newLastSeen }),
              ...(newHideStatus !== undefined && { hide_online_status: newHideStatus })
            } : prev);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Auto-start video call if ?startCall=true
  useEffect(() => {
    if (searchParams.get('startCall') === 'true' && otherUser && !isInCall && !isCreatingRoom) {
      setSearchParams({}, { replace: true });
      startCall();
    }
  }, [searchParams, otherUser, isInCall, isCreatingRoom, startCall, setSearchParams]);

  // Auto-answer video call if ?answerCall=true
  useEffect(() => {
    if (searchParams.get('answerCall') === 'true' && incomingCall && !isInCall) {
      setSearchParams({}, { replace: true });
      answerCall();
    }
  }, [searchParams, incomingCall, isInCall, answerCall, setSearchParams]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const chatSkeleton = useMemo(() => {
    return (
      <div className="space-y-3 py-2">
        <div className="flex justify-start">
          <div className="h-10 w-[68%] max-w-[360px] rounded-2xl bg-muted/40 animate-pulse" />
        </div>
        <div className="flex justify-end">
          <div className="h-8 w-[52%] max-w-[320px] rounded-2xl bg-muted/30 animate-pulse" />
        </div>
        <div className="flex justify-start">
          <div className="h-12 w-[74%] max-w-[420px] rounded-2xl bg-muted/40 animate-pulse" />
        </div>
        <div className="flex justify-end">
          <div className="h-10 w-[62%] max-w-[380px] rounded-2xl bg-muted/30 animate-pulse" />
        </div>
        <div className="flex justify-start">
          <div className="h-9 w-[46%] max-w-[280px] rounded-2xl bg-muted/40 animate-pulse" />
        </div>
        <div className="flex justify-end">
          <div className="h-11 w-[70%] max-w-[420px] rounded-2xl bg-muted/30 animate-pulse" />
        </div>
      </div>
    );
  }, []);

  // If chat contains shared posts, fetch some posts so previews render
  useEffect(() => {
    if (sharedPosts.length > 0) return;
    if (sharedPostsLoading) return;
    const hasSharedPost = messages.some((m) => (m.content || '').includes('[[POST:'));
    if (!hasSharedPost) return;
    loadSharedPosts().then();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally not depending on loadSharedPosts identity
  }, [messages, sharedPosts.length, sharedPostsLoading]);

  // Scroll detection for scroll-to-bottom button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollDown(distanceFromBottom > 200);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSendMessage = async (content: string, mediaUrl?: string, mediaType?: string) => {
    if (isChatBlocked) {
      toast.error('Xabar yuborish mumkin emas');
      return;
    }
    let finalContent = content;
    
    // Add reply prefix if replying
    if (replyTo) {
      const replyPreview = replyTo.content.length > 30 
        ? replyTo.content.substring(0, 30) + '...'
        : replyTo.content;
      finalContent = `↩️ "${replyPreview}"\n${content}`;
      setReplyTo(null);
    }

    await sendMessage(finalContent, mediaUrl, mediaType);
    setTyping(false);
  };

  const handleReply = (messageId: string, content: string) => {
    setReplyTo({ id: messageId, content });
  };

  const handleForward = (messageId: string, content: string) => {
    const msg = messages.find(m => m.id === messageId);
    setForwardMessage({
      content,
      mediaUrl: msg?.media_url,
      mediaType: msg?.media_type
    });
  };

  const handleDeleteForMe = (messageId: string) => {
    const newDeleted = new Set(deletedMessageIds);
    newDeleted.add(messageId);
    setDeletedMessageIds(newDeleted);
    localStorage.setItem(`deleted_messages_${conversationId}`, JSON.stringify([...newDeleted]));
    toast.success(t('msgDeleted'));
  };

  const handleDeleteForAll = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      toast.success(t('msgDeletedAll'));
      refetch();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error(t('errorOccurred'));
    }
  };

  const formatMessageTime = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm');
  };

  const formatLastActivity = (dateStr: string | null | undefined) => {
    if (!dateStr) return t('lastActivity');
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 2 * 60 * 1000) return null; // online — handled separately
    if (otherUser?.hide_online_status) return "yaqinda onlayn edi";
    if (isToday(date)) return `${t('today')} ${format(date, 'HH:mm')} da`;
    if (isYesterday(date)) return `${t('yesterday')} ${format(date, 'HH:mm')} da`;
    return format(date, 'd MMMM HH:mm', { locale: uz }) + ' da';
  };

  const isOnline = otherUser?.last_seen 
    ? (Date.now() - new Date(otherUser.last_seen).getTime()) < 2 * 60 * 1000 
    : false;
  
  const displayOnline = isOnline && !otherUser?.hide_online_status;

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return t('today');
    if (isYesterday(date)) return t('yesterday');
    return format(date, 'd MMMM', { locale: uz });
  };

  const shouldShowDateSeparator = (currentMsg: Message, prevMsg: Message | undefined) => {
    if (!prevMsg) return true;
    return !isSameDay(new Date(currentMsg.created_at), new Date(prevMsg.created_at));
  };

  const getStatusIcon = (status: string, isMine: boolean) => {
    if (!isMine) return null;
    
    switch (status) {
      case 'sending':
        return <Clock className="h-3 w-3 text-muted-foreground animate-pulse" />;
      case 'sent':
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'seen':
        return <CheckCheck className="h-3 w-3 text-primary" />;
      default:
        return null;
    }
  };

  const renderMessageContent = (msg: Message, isMine: boolean, uploadProgress?: number) => {
    const joinInvite = extractJoinInvite(msg.content);
    if (joinInvite) {
      void ensureInviteLoaded(joinInvite.inviteLink);
      const group = inviteCache[joinInvite.inviteLink];
      const isMember = inviteMemberCache[joinInvite.inviteLink] || false;
      const typeLabel = group?.type === 'channel' ? 'Kanal' : 'Guruh';
      const buttonLabel = isMember
        ? 'Ochish'
        : (group?.type === 'channel' ? 'OBUNA' : 'JOIN');

      return (
        <div className="space-y-2">
          {joinInvite.messageText && (
            <p className="text-sm whitespace-pre-wrap break-words select-text">{joinInvite.messageText}</p>
          )}
          <div
            className={cn(
              'w-[280px] max-w-[75vw] overflow-hidden rounded-3xl border bg-black/20 backdrop-blur-md text-left shadow-lg',
              isMine ? 'border-white/20' : 'border-border/20'
            )}
          >
            <div className="p-3 flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl overflow-hidden bg-black/25 border border-white/10 shrink-0">
                {group?.avatar_url ? (
                  <img src={group.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white/70 text-xs font-semibold">
                    {typeLabel}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white/90 truncate">
                  {group?.name || 'Taklif'}
                </div>
                <div className="mt-0.5 text-[11px] text-white/70 truncate">
                  {group ? `${typeLabel} · ${group.visibility === 'public' ? 'Ommaviy' : 'Yopiq'}` : 'Yuklanmoqda...'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!group) {
                  navigate(`/join/${joinInvite.inviteLink}`);
                  return;
                }
                if (isMember) {
                  navigate(`/group-chat/${group.id}`);
                } else {
                  void joinFromInvite(group);
                }
              }}
              className={cn(
                'w-full py-2.5 text-center text-xs font-extrabold tracking-wide',
                'border-t border-white/10 text-white/90 hover:bg-white/5 transition-colors'
              )}
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      );
    }

    const shared = extractSharedPost(msg.content);
    if (shared) {
      const previewPost = sharedPosts.find((p) => p.id === shared.postId);
      const mediaUrl = previewPost?.media_urls?.[0] || previewPost?.image_url;
      const isVideo = !!mediaUrl && (mediaUrl.includes('.mp4') || mediaUrl.includes('.mov') || mediaUrl.includes('.webm'));

      return (
        <div className="space-y-2">
          {shared.messageText && (
            <p className="text-sm whitespace-pre-wrap break-words select-text">{shared.messageText}</p>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openSharedPostViewer(shared.postId);
            }}
            className={cn(
              'w-[280px] max-w-[75vw] overflow-hidden rounded-3xl border border-white/10 bg-black/20 backdrop-blur-md text-left shadow-lg',
              isMine ? 'border-white/20' : 'border-border/20'
            )}
          >
            <div className="relative w-full aspect-[4/5] bg-black/30">
              {mediaUrl ? (
                isVideo ? (
                  <>
                    <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
                    <div className="absolute left-3 top-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-white">
                      Video
                    </div>
                  </>
                ) : (
                  <>
                    <img src={mediaUrl} className="h-full w-full object-cover" alt="Shared post" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
                  </>
                )
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs text-white/70">Post</div>
              )}
            </div>
            <div className="p-3">
              <div className="text-xs font-semibold text-white/90">
                {previewPost?.author?.username ? `@${previewPost.author.username}` : 'Post'}
              </div>
              {previewPost?.content && (
                <div className="mt-1 text-[12px] leading-snug text-white/75 line-clamp-2">{previewPost.content}</div>
              )}
              {!previewPost && (
                <div className="mt-1 text-[12px] text-white/70">Yuklanmoqda...</div>
              )}
            </div>
          </button>
        </div>
      );
    }

    const sharedShort = extractSharedShort(msg.content);
    if (sharedShort) {
      const thumb = `https://i.ytimg.com/vi/${sharedShort.shortId}/hqdefault.jpg`;
      return (
        <div className="space-y-2">
          {sharedShort.messageText && (
            <p className="text-sm whitespace-pre-wrap break-words select-text">{sharedShort.messageText}</p>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openSharedShortViewer(sharedShort.shortId);
            }}
            className={cn(
              'w-[240px] max-w-[65vw] overflow-hidden rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md text-left',
              isMine ? 'border-white/20' : 'border-border/20'
            )}
          >
            <div className="w-full aspect-[4/5] bg-black/30">
              <img src={thumb} className="h-full w-full object-cover" alt="Shared shorts" />
            </div>
            <div className="p-2.5">
              <div className="text-xs font-semibold text-white/90">Shorts</div>
              <div className="mt-0.5 text-[11px] text-white/70 line-clamp-2">YouTube Shorts</div>
            </div>
          </button>
        </div>
      );
    }

    // Voice message
    if (msg.media_type === 'audio') {
      return (
        <VoiceMessage
          audioUrl={msg.media_url || ''}
          isMine={isMine}
          uploadProgress={uploadProgress}
          deliveryStatus={msg.status === 'seen' ? 'read' : msg.status}
          senderAvatarUrl={!isMine ? otherUser?.avatar_url || undefined : undefined}
        />
      );
    }

    // Image or video message
    if (msg.media_type === 'image' || msg.media_type === 'video') {
      return (
        <MediaMessage
          mediaUrl={msg.media_url || ''}
          mediaType={msg.media_type}
          isMine={isMine}
          onFullscreen={() => setFullscreenMedia({ url: msg.media_url!, type: msg.media_type as 'image' | 'video' })}
          uploadProgress={uploadProgress}
        />
      );
    }

    // Text message
    return (
      <p className="text-sm whitespace-pre-wrap break-words select-text">{msg.content}</p>
    );
  };

  // Filter out deleted messages
  const visibleMessages = messages.filter(m => {
    if (deletedMessageIds.has(m.id)) return false;
    if (!clearedAt) return true;
    const created = new Date(m.created_at).getTime();
    if (!Number.isFinite(created)) return true;
    return created > clearedAt;
  });

  const pendingScrollAdjustRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);

  useEffect(() => {
    const pending = pendingScrollAdjustRef.current;
    const container = containerRef.current;
    if (!pending || !container) return;
    const newHeight = container.scrollHeight;
    const diff = newHeight - pending.prevHeight;
    container.scrollTop = pending.prevTop + diff;
    pendingScrollAdjustRef.current = null;
  }, [visibleMessages.length]);

  return (
    <>
      {viewerOpen && (
        <UnifiedFullScreenViewer
          posts={sharedPosts}
          shorts={sharedShorts}
          initialTab={viewerTab}
          initialIndex={viewerInitialIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {/* Fullscreen media viewer */}
      {fullscreenMedia && (
        <MediaFullscreen
          mediaUrl={fullscreenMedia.url}
          mediaType={fullscreenMedia.type}
          onClose={() => setFullscreenMedia(null)}
        />
      )}

      {/* Video Call UI */}
      {isInCall && callObject && (
        <VideoCallUI
          callObject={callObject}
          remoteParticipant={remoteParticipant}
          cameraOn={cameraOn}
          micOn={micOn}
          onToggleCamera={toggleCamera}
          onToggleMic={toggleMic}
          onEndCall={leaveCall}
        />
      )}

      <div className="flex flex-col relative overflow-hidden" style={{ height: '100dvh' }}>
        {/* Wallpaper background */}
        {chatWallpaper !== 'none' && (
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(/wallpapers/chat-${chatWallpaper}.jpg)` }}
          />
        )}
        {/* Header - 50% transparent */}
        <div className="sticky top-0 z-40 bg-background/50 backdrop-blur-xl border-b border-border/20 px-4 py-2.5 relative pt-[env(safe-area-inset-top,0px)]">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/messages')} className="p-1.5 rounded-full hover:bg-muted/50 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative">
              <Avatar 
                className="h-9 w-9 cursor-pointer ring-2 ring-primary/20" 
                onClick={() => navigate(`/user/${userId}`)}
              >
                <AvatarImage src={otherUser?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{getInitials(otherUser?.name)}</AvatarFallback>
              </Avatar>
              {isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
              )}
            </div>
            <div className="flex-1 min-w-0" onClick={() => navigate(`/user/${userId}`)}>
              <h1 className={cn("font-semibold text-sm truncate", !otherUser && "text-muted-foreground")}>{otherUser?.name || t('user')}</h1>
              {otherUserTyping && !otherUser?.hide_online_status ? (
                <p className="text-[11px] text-primary font-medium">{t('typing')}</p>
              ) : displayOnline ? (
                <p className="text-[11px] text-green-500 font-medium">Online</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">{otherUser?.hide_online_status ? "yaqinda onlayn edi" : formatLastActivity(otherUser?.last_seen || null)}</p>
              )}
            </div>
            <button 
              onClick={startCall}
              disabled={isCreatingRoom || isInCall}
              className="p-2 rounded-full hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {isCreatingRoom ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Video className="h-5 w-5" />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-full hover:bg-muted/50 transition-colors">
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setShowWallpaperPicker(true)}>
                  Chat fonini o'zgartirish
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setClearHistoryOpen(true)}
                >
                  Tarixni tozalash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
        </div>

        {/* Rejoin Call UI - visible when user is in chat but disconnected from active call */}
        {!isInCall && wasInCall && lastRoomUrl && (
          <div className="mx-4 mt-2 p-3 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Video className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">Video qo'ng'iroq</p>
                <p className="text-[10px] text-muted-foreground">Siz suhbatdan chiqdingiz</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 text-[11px] font-medium hover:bg-black/5" 
                onClick={endCallPermanently}
              >
                Yopish
              </Button>
              <Button 
                size="sm" 
                className="h-8 text-[11px] font-bold rounded-full px-4 shadow-sm" 
                onClick={rejoinCall}
              >
                Qaytish
              </Button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto px-3 py-3 relative z-10 min-h-0"
          style={{ 
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch'
          }}
          onScroll={() => {
            const el = containerRef.current;
            if (!el) return;
            if (el.scrollTop > 40) return;
            if (!hasMore || isLoadingMore) return;
            pendingScrollAdjustRef.current = { prevHeight: el.scrollHeight, prevTop: el.scrollTop };
            void loadOlder();
          }}
        >
          {isLoading && visibleMessages.length === 0 ? (
            <div className="h-full flex flex-col justify-end">
              {chatSkeleton}
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Avatar className="h-16 w-16 mx-auto mb-3 ring-2 ring-primary/20">
                  <AvatarImage src={otherUser?.avatar_url || undefined} />
                  <AvatarFallback className="text-xl">{getInitials(otherUser?.name)}</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-sm">{otherUser?.name || t('user')}</h3>
                <StarUsername username={otherUser?.username || 'username'} />
                <p className="text-xs text-muted-foreground mt-3">{t('startChat')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1 pb-20">
              {isLoadingMore && (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {visibleMessages.map((msg, index) => {
                const isMine = msg.sender_id === user?.id;
                const prevMsg = visibleMessages[index - 1];
                const nextMsg = visibleMessages[index + 1];
                const showDateSeparator = shouldShowDateSeparator(msg, prevMsg);
                
                // Telegram-style grouping: consecutive messages from same sender
                const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id || showDateSeparator;
                const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id || shouldShowDateSeparator(nextMsg, msg);
                
                // Telegram-style bubble tail logic
                const getBubbleRadius = () => {
                  if (isMine) {
                    if (isFirstInGroup && isLastInGroup) return "rounded-2xl rounded-br-sm";
                    if (isFirstInGroup) return "rounded-2xl rounded-br-sm";
                    if (isLastInGroup) return "rounded-2xl rounded-br-sm";
                    return "rounded-2xl rounded-r-lg";
                  } else {
                    if (isFirstInGroup && isLastInGroup) return "rounded-2xl rounded-bl-sm";
                    if (isFirstInGroup) return "rounded-2xl rounded-bl-sm";
                    if (isLastInGroup) return "rounded-2xl rounded-bl-sm";
                    return "rounded-2xl rounded-l-lg";
                  }
                };

                const hasMedia = (msg.media_type === 'image' || msg.media_type === 'video') && msg.media_url;

                return (
                  <div key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-4">
                        <span className="text-[10px] text-muted-foreground/80 bg-muted/40 backdrop-blur-lg px-3.5 py-1 rounded-full font-medium">
                          {formatDateSeparator(msg.created_at)}
                        </span>
                      </div>
                    )}
                  <div className={cn(
                    "flex",
                    isMine ? "justify-end" : "justify-start",
                    !isLastInGroup ? "mb-[2px]" : "mb-1.5"
                  )}>
                    <div className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}>
                      <MessageContextMenu
                        messageContent={msg.content}
                        messageId={msg.id}
                        isMine={isMine}
                        isPrivateChat={true}
                        showReactions={true}
                        reactionType="message"
                        onReply={handleReply}
                        onForward={handleForward}
                        onDeleteForMe={handleDeleteForMe}
                        onDeleteForAll={isMine ? handleDeleteForAll : undefined}
                      >
                        <div className={cn(
                          "max-w-[80%] px-3 py-1.5 shadow-md",
                          getBubbleRadius(),
                          hasMedia && "px-1.5 py-1.5",
                          isMine 
                            ? "text-white" 
                            : "bg-muted/80 backdrop-blur-md text-foreground"
                        )}
                        style={isMine ? { background: 'linear-gradient(135deg, hsl(217 91% 60%), hsl(263 70% 50%))' } : undefined}
                        >
                          {renderMessageContent(msg, isMine, (msg as Message & { uploadProgress?: number }).uploadProgress)}
                          <div className={cn(
                            "flex items-center gap-1 mt-0.5",
                            hasMedia && "px-1.5",
                            isMine ? "justify-end" : "justify-start"
                          )}>
                            <span className={cn(
                              "text-[10px] tabular-nums",
                              isMine ? "text-white/60" : "text-muted-foreground/60"
                            )}>
                              {formatMessageTime(msg.created_at)}
                            </span>
                            {getStatusIcon(msg.status, isMine)}
                          </div>
                        </div>
                      </MessageContextMenu>
                      {/* Reaction summary below bubble */}
                      <PrivateMessageReactions messageId={msg.id} isMine={isMine} />
                    </div>
                  </div>
                </div>
                );
              })}
              {/* Typing indicator */}
              {otherUserTyping && (
                <div className="flex justify-start">
                  <div className="bg-card/80 backdrop-blur-md border border-border/10 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary/20 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}

          {showScrollDown && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-20 right-4 w-10 h-10 rounded-full bg-background/60 backdrop-blur-xl border border-border/30 flex items-center justify-center shadow-lg hover:bg-background/80 transition-all z-20 pointer-events-auto"
            >
              <ChevronDown className="h-5 w-5 text-foreground/70" />
            </button>
          )}
        </div>

        {/* Bottom bar - always visible */}
        <div className="relative z-20 flex-shrink-0">
          {replyTo && (
            <div className="bg-background/50 backdrop-blur-xl border-t border-border/20">
              <ReplyPreview
                replyToContent={replyTo.content}
                onCancel={() => setReplyTo(null)}
              />
            </div>
          )}
          {isChatBlocked ? (
            <div className="px-3 py-3 bg-background/50 backdrop-blur-xl border-t border-border/20">
              <p className="text-xs text-muted-foreground text-center">
                {userId && isBlocked(userId)
                  ? 'Siz bu foydalanuvchini bloklagansiz.'
                  : userId && isBlockedBy(userId)
                    ? 'Siz bloklangansiz.'
                    : 'Xabar yozish cheklangan.'}
              </p>
            </div>
          ) : (
            <ChatInput
              conversationId={conversationId}
              onSendMessage={handleSendMessage}
              onTyping={setTyping}
            />
          )}
        </div>
      </div>

      {/* Forward Dialog */}
      {forwardMessage && (
        <ForwardMessageDialog
          open={!!forwardMessage}
          onOpenChange={(open) => !open && setForwardMessage(null)}
          messageContent={forwardMessage.content}
          mediaUrl={forwardMessage.mediaUrl}
          mediaType={forwardMessage.mediaType}
        />
      )}

      {/* Wallpaper Picker */}
      <ChatWallpaperPicker
        open={showWallpaperPicker}
        onClose={() => setShowWallpaperPicker(false)}
        currentWallpaper={chatWallpaper}
        onSelect={setChatWallpaper}
      />

      <AlertDialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tarixni tozalash</AlertDialogTitle>
            <AlertDialogDescription>
              Uchirganingizdan keyin qaytarish funksiyasi yuq.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Bekor</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearHistoryForMe();
                setClearHistoryOpen(false);
              }}
            >
              Faqat men uchun
            </Button>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await clearHistoryForAll();
                setClearHistoryOpen(false);
              }}
            >
              Barcha uchun
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Chat;
