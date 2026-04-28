import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Users, Megaphone, MoreVertical, Send, X } from 'lucide-react';
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
import { toast } from 'sonner';
import { ChatMediaPicker } from '@/components/chat/ChatMediaPicker';
import { VoiceRecorderButton } from '@/components/chat/VoiceRecorderButton';
import { MediaMessage } from '@/components/chat/MediaMessage';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { MediaFullscreen } from '@/components/chat/MediaFullscreen';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { GroupSettingsSheet } from '@/components/groups/GroupSettingsSheet';
import { MessageContextMenu } from '@/components/chat/MessageContextMenu';
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog';
import { ReplyPreview } from '@/components/chat/ReplyPreview';
import { MessageWithReactions } from '@/components/chat/MessageWithReactions';
import { GroupMessageCommentsSheet } from '@/components/chat/GroupMessageCommentsSheet';
import { uploadMedia, uploadToR2 } from '@/lib/r2Upload';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { uz } from 'date-fns/locale';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import ChatWallpaperPicker from '@/components/chat/ChatWallpaperPicker';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  sender?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: 'group' | 'channel';
  visibility: 'public' | 'private';
  owner_id: string;
  invite_link: string | null;
  memberCount: number;
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

const GroupChat = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Media handling
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const voiceRecorder = useVoiceRecorder();

  // Settings sheet
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Clear history (telegram-style)
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [clearedAt, setClearedAt] = useState<number>(0);
  const [inviteCache, setInviteCache] = useState<Record<string, InvitePreview | null>>({});
  const [inviteMemberCache, setInviteMemberCache] = useState<Record<string, boolean>>({});
  const inviteLoadingRef = useRef<Set<string>>(new Set());

  // Reply & Forward
  const [replyTo, setReplyTo] = useState<{ id: string; content: string } | null>(null);
  const [forwardMessage, setForwardMessage] = useState<{ content: string; mediaUrl?: string | null; mediaType?: string | null } | null>(null);

  // Comments
  const [selectedMessageForComments, setSelectedMessageForComments] = useState<string | null>(null);

  // Deleted messages (local storage for "delete for me")
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(new Set());

  // Wallpaper
  const wallpaperKey = groupId ? `group_chat_wallpaper_${groupId}` : 'group_chat_wallpaper';
  const [chatWallpaper, setChatWallpaper] = useLocalStorage(wallpaperKey, 'none');
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchGroupInfo = useCallback(async () => {
    if (!groupId) return;
    try {
      const { data: group, error } = await supabase
        .from('group_chats').select('*').eq('id', groupId).single();
      if (error) throw error;

      const { count: memberCount } = await supabase
        .from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', groupId);

      setGroupInfo({ ...group, type: (group.type || 'group') as 'channel' | 'group', visibility: (group.visibility || 'private') as 'private' | 'public', memberCount: (memberCount || 0) } as any);

      if (group.owner_id === user?.id) {
        setIsMember(true);
        setCanSend(true);
      } else {
        const { data: membership } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', groupId)
          .eq('user_id', user?.id)
          .maybeSingle();

        const member = !!membership;
        setIsMember(member);

        if (group.type === 'group') {
          setCanSend(member);
        } else {
          setCanSend(false);
        }
      }
    } catch (error) {
      console.error('Error fetching group info:', error);
      toast.error('Guruh topilmadi');
      navigate('/messages');
    }
  }, [groupId, user?.id, navigate]);

  const handleJoin = useCallback(async () => {
    if (!groupId || !user?.id) return;
    if (isJoining) return;
    setIsJoining(true);
    try {
      const { error } = await supabase.from('group_members').upsert(
        {
          group_id: groupId,
          user_id: user.id,
          role: 'member',
        } as { group_id: string; user_id: string; role: string },
        { onConflict: 'group_id,user_id' }
      );
      if (error) throw error;
      toast.success("Qo'shildingiz");
      await fetchGroupInfo();
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || 'Xatolik yuz berdi');
    } finally {
      setIsJoining(false);
    }
  }, [fetchGroupInfo, groupId, isJoining, user?.id]);

  const fetchMessages = useCallback(async () => {
    if (!groupId) return;
    try {
      const { data: messagesData, error } = await supabase
        .from('group_messages').select('*').eq('group_id', groupId).order('created_at', { ascending: true });
      if (error) throw error;

      if (messagesData && messagesData.length > 0) {
        const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles').select('id, name, username, avatar_url').in('id', senderIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        setMessages(messagesData.map(m => ({ ...m, sender: profileMap.get(m.sender_id) })));
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  const markAsRead = useCallback(async () => {
    if (!groupId || !user?.id) return;
    try {
      await supabase
        .from('group_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('group_id', groupId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error marking group as read:', error);
    }
  }, [groupId, user?.id]);

  useEffect(() => {
    fetchGroupInfo();
    fetchMessages();
    markAsRead();
    const stored = localStorage.getItem(`deleted_group_messages_${groupId}`);
    if (stored) setDeletedMessageIds(new Set(JSON.parse(stored)));

    const clearedRaw = localStorage.getItem(`cleared_group_${groupId}`);
    if (clearedRaw) {
      const ts = Number(clearedRaw);
      if (Number.isFinite(ts) && ts > 0) setClearedAt(ts);
    }
  }, [fetchGroupInfo, fetchMessages, markAsRead, groupId]);

  const clearHistoryForMe = useCallback(() => {
    if (!groupId) return;
    const ts = Date.now();
    setClearedAt(ts);
    localStorage.setItem(`cleared_group_${groupId}`, String(ts));
    toast.success("Tarix tozalandi (faqat siz uchun)");
  }, [groupId]);

  const clearHistoryForAll = useCallback(async () => {
    if (!groupId) return;
    if (groupInfo?.owner_id !== user?.id) return;
    try {
      const { error } = await supabase
        .from('group_messages')
        .delete()
        .eq('group_id', groupId);
      if (error) throw error;

      const ts = Date.now();
      setClearedAt(ts);
      localStorage.setItem(`cleared_group_${groupId}`, String(ts));
      setDeletedMessageIds(new Set());
      localStorage.removeItem(`deleted_group_messages_${groupId}`);
      toast.success('Tarix barcha uchun tozalandi');
      await fetchMessages();
      window.dispatchEvent(new Event('avlodona:new-message'));
    } catch (error) {
      console.error('Error clearing group history:', error);
      toast.error('Xatolik yuz berdi');
    }
  }, [fetchMessages, groupId, groupInfo?.owner_id, user?.id]);

  // Realtime
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const newMsg = payload.new as Record<string, unknown>;
          const { data: profile } = await supabase.from('profiles').select('id, name, username, avatar_url').eq('id', newMsg.sender_id as string).single();
          setMessages(prev => [...prev, { ...newMsg, sender: profile } as GroupMessage]);
          markAsRead();
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== (payload.old as Record<string, unknown>).id));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, markAsRead]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const [voiceRecorderObj, setVoiceRecorderObj] = useState<ReturnType<typeof useVoiceRecorder>>(voiceRecorder);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const handleSendMessage = async () => {
    if (!groupId || !user?.id || (!newMessage.trim() && !selectedMedia.length && !voiceRecorder.audioBlob)) return;
    if (isSending) return;
    setIsSending(true);
    try {
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;
      let content = newMessage.trim();

      if (replyTo) {
        const replyPreview = replyTo.content.length > 30 ? replyTo.content.substring(0, 30) + '...' : replyTo.content;
        content = `↩️ "${replyPreview}"\n${content}`;
        setReplyTo(null);
      }

      const timestampForId = new Date().toISOString();

      if (voiceRecorder.audioBlob) {
        const audioFile = new File([voiceRecorder.audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        const voiceId = `voice-${user.id}-${timestampForId}`;
        mediaUrl = await uploadToR2(
          audioFile, 
          `group-messages/${user.id}`, 
          undefined, 
          (prog) => setUploadProgress(prev => ({ ...prev, [voiceId]: prog }))
        );
        mediaType = 'audio';
        content = content || '🎤 Ovozli xabar';
        voiceRecorder.cancelRecording();
        setUploadProgress(prev => { const n = { ...prev }; delete n[voiceId]; return n; });
      }

      if (selectedMedia.length > 0) {
        for (let i = 0; i < selectedMedia.length; i++) {
          const media = selectedMedia[i];
          const mediaId = `media-${user.id}-${timestampForId}`; 
          const mUrl = await uploadMedia(
            media.file, 
            'group-messages', 
            user.id, 
            (prog) => setUploadProgress(prev => ({ ...prev, [mediaId]: prog }))
          );
          const mType = media.type;
          const { error } = await supabase.from('group_messages').insert({
            group_id: groupId, 
            sender_id: user.id, 
            content: (media.type === 'image' ? '📷 Rasm' : '🎬 Video'),
            media_url: mUrl, 
            media_type: mType,
            created_at: timestampForId
          });
          if (error) throw error;
          URL.revokeObjectURL(media.preview);
          setUploadProgress(prev => { const n = { ...prev }; delete n[mediaId]; return n; });
        }
        setSelectedMedia([]);
      }

      if (newMessage.trim() || voiceRecorder.audioBlob) {
        const { error } = await supabase.from('group_messages').insert({
          group_id: groupId, sender_id: user.id, content: content || 'Xabar',
          media_url: mediaUrl, media_type: mediaType,
          created_at: timestampForId
        });
        if (error) throw error;
      }
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Xabar yuborilmadi');
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = (messageId: string, content: string) => setReplyTo({ id: messageId, content });
  const handleForward = (messageId: string, content: string) => {
    const msg = messages.find(m => m.id === messageId);
    setForwardMessage({ content, mediaUrl: msg?.media_url, mediaType: msg?.media_type });
  };
  const handleDeleteForMe = (messageId: string) => {
    const newDeleted = new Set(deletedMessageIds);
    newDeleted.add(messageId);
    setDeletedMessageIds(newDeleted);
    localStorage.setItem(`deleted_group_messages_${groupId}`, JSON.stringify([...newDeleted]));
    toast.success('Xabar o\'chirildi');
  };
  const handleDeleteForAll = async (messageId: string) => {
    try {
      const { error } = await supabase.from('group_messages').delete().eq('id', messageId);
      if (error) throw error;
      toast.success('Xabar barcha uchun o\'chirildi');
    } catch { toast.error('Xatolik yuz berdi'); }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatMessageTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Bugun';
    if (isYesterday(d)) return 'Kecha';
    return format(d, 'd MMMM', { locale: uz });
  };

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
      const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, string>) => { maybeSingle: () => Promise<{ data: InvitePreview | null; error: Error | null }> } })
        .rpc('get_group_invite_preview', { invite: inviteLink })
        .maybeSingle();
      if (error) throw error;

      setInviteCache((prev) => ({ ...prev, [inviteLink]: data || null }));

      if (data?.id && user?.id) {
        if ((data as InvitePreview & { owner_id?: string }).owner_id === user.id) {
          setInviteMemberCache((prev) => ({ ...prev, [inviteLink]: true }));
        } else {
          const { data: membership } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', (data as InvitePreview).id)
            .eq('user_id', user.id)
            .maybeSingle();
          setInviteMemberCache((prev) => ({ ...prev, [inviteLink]: !!membership }));
        }
      }
    } catch {
      setInviteCache((prev) => ({ ...prev, [inviteLink]: null }));
    } finally {
      inviteLoadingRef.current.delete(inviteLink);
    }
  }, [inviteCache, user?.id]);

  const joinFromInvite = useCallback(async (group: InvitePreview) => {
    if (!user?.id) return;
    try {
      const { error } = await (supabase as any).rpc('join_group_via_invite', {
        invite_str: group.invite_link,
      });

      if (error) {
        // Fallback for public groups if RPC doesn't exist yet
        const { error: fallbackError } = await supabase.from('group_members').upsert(
          {
            group_id: group.id,
            user_id: user.id,
            role: 'member',
          } as { group_id: string; user_id: string; role: string },
          { onConflict: 'group_id,user_id' }
        );
        if (fallbackError) throw fallbackError;
      }

      toast.success("Qo'shildingiz");
      navigate(`/group-chat/${group.id}`);
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || 'Xatolik yuz berdi');
    }
  }, [navigate, user?.id]);

  const renderMessageContent = (message: GroupMessage) => {
    const isOwn = message.sender_id === user?.id;
    if (message.media_type === 'audio' && message.media_url) {
      return (
        <VoiceMessage
          audioUrl={message.media_url}
          isMine={isOwn}
          uploadProgress={uploadProgress[`voice-${message.sender_id}-${new Date(message.created_at).getTime()}`]}
        />
      );
    }
    if ((message.media_type === 'image' || message.media_type === 'video') && message.media_url) {
      return (
        <MediaMessage
          mediaUrl={message.media_url}
          mediaType={message.media_type as 'image' | 'video'}
          isMine={isOwn}
          onFullscreen={() => setFullscreenMedia({ url: message.media_url!, type: message.media_type as 'image' | 'video' })}
          uploadProgress={uploadProgress[`media-${message.sender_id}-${new Date(message.created_at).getTime()}-0`]} // Assuming single media per message for simplicity here, or adjust tempId logic
        />
      );
    }

    const joinInvite = extractJoinInvite(message.content);
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
            <p className="break-words whitespace-pre-wrap">{joinInvite.messageText}</p>
          )}
          <div className="w-[280px] max-w-[75vw] overflow-hidden rounded-3xl border border-white/10 bg-black/20 backdrop-blur-md text-left shadow-lg">
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
              className="w-full py-2.5 text-center text-xs font-extrabold tracking-wide border-t border-white/10 text-white/90 hover:bg-white/5 transition-colors"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      );
    }

    return <p className="break-words whitespace-pre-wrap">{message.content}</p>;
  };

  const visibleMessages = messages.filter(m => {
    if (deletedMessageIds.has(m.id)) return false;
    if (!clearedAt) return true;
    const created = new Date(m.created_at).getTime();
    if (!Number.isFinite(created)) return true;
    return created > clearedAt;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col relative overflow-hidden" style={{ height: '100dvh' }}>
      {/* Wallpaper background */}
      {chatWallpaper !== 'none' && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(/wallpapers/chat-${chatWallpaper}.jpg)` }}
        />
      )}

      {/* Premium Header */}
      <div className="sticky top-0 z-40 bg-background/50 backdrop-blur-xl border-b border-border/20 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/messages')} className="h-9 w-9 rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setSettingsOpen(true)}>
            <Avatar className="h-9 w-9 ring-2 ring-primary/20">
              <AvatarImage src={groupInfo?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10">
                {groupInfo?.type === 'group' ? (
                  <Users className="h-5 w-5 text-primary" />
                ) : (
                  <Megaphone className="h-5 w-5 text-primary" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold truncate text-sm">{groupInfo?.name}</h1>
              <p className="text-[11px] text-muted-foreground">
                {groupInfo?.memberCount} a'zo · {groupInfo?.type === 'group' ? 'Guruh' : 'Kanal'}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                Sozlamalar
              </DropdownMenuItem>
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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 relative z-10 min-h-0">
        <div className="space-y-1 max-w-2xl mx-auto">
          {visibleMessages.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                {groupInfo?.type === 'group' ? <Users className="h-8 w-8 text-primary/60" /> : <Megaphone className="h-8 w-8 text-primary/60" />}
              </div>
              <p className="text-muted-foreground font-medium">Hozircha xabarlar yo'q</p>
              <p className="text-xs text-muted-foreground mt-1">Birinchi xabarni yuboring!</p>
            </div>
          ) : (
            visibleMessages.map((message, index) => {
              const isOwn = message.sender_id === user?.id;
              const showSender = !isOwn && (index === 0 || visibleMessages[index - 1].sender_id !== message.sender_id);
              const showDate = index === 0 || !isSameDay(new Date(message.created_at), new Date(visibleMessages[index - 1].created_at));

              return (
                <div key={message.id} className="group">
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="text-[11px] text-muted-foreground bg-background/60 backdrop-blur-md px-3 py-1 rounded-full border border-border/30">
                        {formatDateLabel(message.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={cn('flex mb-1', isOwn ? 'justify-end' : 'justify-start')}>
                    <MessageContextMenu
                      messageContent={message.content}
                      messageId={message.id}
                      isMine={isOwn}
                      isPrivateChat={false}
                      showReactions={true}
                      onReply={handleReply}
                      onForward={handleForward}
                      onDeleteForMe={handleDeleteForMe}
                      onDeleteForAll={isOwn || groupInfo?.owner_id === user?.id ? handleDeleteForAll : undefined}
                    >
                      <MessageWithReactions
                        messageId={message.id}
                        isOwn={isOwn}
                        senderName={message.sender?.name || message.sender?.username}
                        senderAvatar={message.sender?.avatar_url}
                        showSender={showSender}
                        time={formatMessageTime(message.created_at)}
                        isChannelAdminMessage={groupInfo?.type === 'channel'}
                        commentsCount={(message as any).comments_count || 0}
                        onCommentClick={() => setSelectedMessageForComments(message.id)}
                      >
                        {renderMessageContent(message)}
                      </MessageWithReactions>
                    </MessageContextMenu>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reply Preview */}
      {replyTo && <ReplyPreview replyToContent={replyTo.content} onCancel={() => setReplyTo(null)} />}

      {/* Join Bar (Telegram-style) */}
      {!canSend && !isMember && groupInfo?.visibility === 'public' && user?.id !== groupInfo?.owner_id ? (
        <div className="sticky bottom-0 bg-background/70 backdrop-blur-xl border-t border-border/50 p-3">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={handleJoin}
              disabled={isJoining}
              className="w-full h-11 rounded-2xl bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(263,70%,50%)] text-white"
            >
              {isJoining ? 'Qo\'shilmoqda...' : 'JOIN'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Premium Input Bar */}
      {canSend ? (
        <div className="sticky bottom-0 bg-background/50 backdrop-blur-xl border-t border-border/20 p-2 z-20">
          {voiceRecorder.isRecording && (
            <div className="mb-2 flex items-center gap-3 px-4 py-2 bg-destructive/10 rounded-2xl mx-1">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm flex-1">Yozib olinmoqda... {formatDuration(voiceRecorder.duration)}</span>
              <Button variant="ghost" size="sm" onClick={voiceRecorder.cancelRecording} className="h-7 text-xs rounded-xl">
                Bekor
              </Button>
            </div>
          )}
          {selectedMedia.map((media, idx) => (
            <div key={idx} className="mb-2 mx-1 relative inline-block">
              <div className="h-20 w-20 rounded-2xl overflow-hidden border border-border/50">
                {media.type === 'image' ? (
                  <img src={media.preview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <video src={media.preview} className="w-full h-full object-cover" />
                )}
              </div>
              <button 
                onClick={() => {
                  const next = [...selectedMedia];
                  URL.revokeObjectURL(next[idx].preview);
                  next.splice(idx, 1);
                  setSelectedMedia(next);
                }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center shadow-lg"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1.5 bg-card/50 backdrop-blur-md border border-border/50 rounded-[24px] px-2 py-1">
            <ChatMediaPicker selectedMedia={selectedMedia} onMediaSelect={setSelectedMedia} />
            {!voiceRecorder.isRecording && !voiceRecorder.audioBlob ? (
              <>
                <input
                  placeholder="Xabar yozing..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="flex-1 bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground h-9 text-sm px-1"
                />
                {newMessage.trim() || selectedMedia.length > 0 ? (
                  <button onClick={handleSendMessage} disabled={isSending}
                    className="w-9 h-9 rounded-full bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(263,70%,50%)] flex items-center justify-center text-white shadow-lg shadow-primary/30 transition-transform active:scale-90">
                    <Send className="h-4 w-4" />
                  </button>
                ) : (
                  <VoiceRecorderButton
                    isRecording={voiceRecorder.isRecording}
                    hasAudio={!!voiceRecorder.audioBlob}
                    duration={voiceRecorder.duration}
                    formatDuration={formatDuration}
                    onStartRecording={voiceRecorder.startRecording}
                    onStopRecording={voiceRecorder.stopRecording}
                    onCancelRecording={voiceRecorder.cancelRecording}
                    onSendAudio={handleSendMessage}
                  />
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-end gap-2">
                <VoiceRecorderButton
                  isRecording={voiceRecorder.isRecording}
                  hasAudio={!!voiceRecorder.audioBlob}
                  duration={voiceRecorder.duration}
                  formatDuration={formatDuration}
                  onStartRecording={voiceRecorder.startRecording}
                  onStopRecording={voiceRecorder.stopRecording}
                  onCancelRecording={voiceRecorder.cancelRecording}
                  onSendAudio={handleSendMessage}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="sticky bottom-0 bg-muted/30 backdrop-blur-xl border-t border-border/20 p-4 text-center z-20">
          <p className="text-sm text-muted-foreground">
            {groupInfo?.type === 'channel'
              ? 'Faqat kanal egasi xabar yuborishi mumkin'
              : 'Xabar yozish uchun guruhga qo\'shiling'}
          </p>
        </div>
      )}

      {fullscreenMedia && (
        <MediaFullscreen mediaUrl={fullscreenMedia.url} mediaType={fullscreenMedia.type} onClose={() => setFullscreenMedia(null)} />
      )}

      {groupInfo && (
        <GroupSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} groupInfo={groupInfo} onGroupUpdated={fetchGroupInfo} />
      )}

      <AlertDialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tarixni tozalash</AlertDialogTitle>
            <AlertDialogDescription>
              Xabarlar tarixini faqat siz uchun yashirish yoki (faqat egasi) barcha uchun butunlay o'chirish.
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
              disabled={groupInfo?.owner_id !== user?.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40"
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

      {forwardMessage && (
        <ForwardMessageDialog
          open={!!forwardMessage}
          onOpenChange={(open) => !open && setForwardMessage(null)}
          messageContent={forwardMessage?.content || ''}
          mediaUrl={forwardMessage?.mediaUrl}
          mediaType={forwardMessage?.mediaType}
        />
      )}

      {/* Comments Sheet for Channel Messages */}
      <GroupMessageCommentsSheet
        messageId={selectedMessageForComments}
        open={!!selectedMessageForComments}
        onOpenChange={(open) => !open && setSelectedMessageForComments(null)}
      />

      {/* Wallpaper Picker */}
      <ChatWallpaperPicker
        open={showWallpaperPicker}
        onClose={() => setShowWallpaperPicker(false)}
        currentWallpaper={chatWallpaper}
        onSelect={setChatWallpaper}
      />
    </div>
  );
};

export default GroupChat;
