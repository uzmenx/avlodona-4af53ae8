import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Megaphone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { GroupChat } from '@/hooks/useGroupChats';
import { useLanguage } from '@/contexts/LanguageContext';

interface GroupChatItemProps {
  chat: GroupChat;
  onClick: () => void;
}

export const GroupChatItem = ({ chat, onClick }: GroupChatItemProps) => {
  const { t } = useLanguage();
  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: uz });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150 active:scale-[0.99] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10"
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={chat.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10">
            {chat.avatar_url ? getInitials(chat.name) : (
              chat.type === 'group' ? (
                <Users className="h-5 w-5 text-primary" />
              ) : (
                <Megaphone className="h-5 w-5 text-primary" />
              )
            )}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{chat.name}</h3>
            {chat.type === 'channel' && (
              <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          {chat.lastMessage && (
            <span className="text-xs text-muted-foreground">
              {formatTime(chat.lastMessage.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground truncate flex-1">
            {chat.lastMessage?.content || (
              <span className="italic">{t('noMessagesYet')}</span>
            )}
          </p>
          <span className="text-xs text-muted-foreground">
            {chat.memberCount} {t('members')}
          </span>
        </div>
      </div>
    </div>
  );
};
