import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Megaphone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { GroupChat } from '@/hooks/useGroupChats';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

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
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative flex items-center gap-4 px-4 py-4 cursor-pointer transition-all duration-300 rounded-[24px] border border-white/5 bg-white/[0.03] backdrop-blur-md hover:bg-white/[0.08] hover:border-white/10 active:bg-white/[0.12]"
    >
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-tr from-primary/20 to-violet-500/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
        <Avatar className="h-14 w-14 border border-white/10 shadow-lg relative">
          <AvatarImage src={chat.avatar_url || undefined} className="object-cover" />
          <AvatarFallback className="bg-gradient-to-br from-primary/10 to-violet-500/10 text-primary">
            {chat.avatar_url ? getInitials(chat.name) : (
              chat.type === 'group' ? (
                <Users className="h-6 w-6" />
              ) : (
                <Megaphone className="h-6 w-6" />
              )
            )}
          </AvatarFallback>
        </Avatar>
        <div className={cn(
          "absolute -bottom-1 -right-1 h-5 w-5 rounded-lg border-2 border-background flex items-center justify-center shadow-md",
          chat.type === 'group' ? "bg-primary text-primary-foreground" : "bg-indigo-500 text-white"
        )}>
          {chat.type === 'group' ? <Users className="h-2.5 w-2.5" /> : <Megaphone className="h-2.5 w-2.5" />}
        </div>
      </div>

      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
            {chat.name}
          </h3>
          {chat.lastMessage && (
            <span className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground/60 whitespace-nowrap">
              {formatTime(chat.lastMessage.created_at)}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground/80 truncate flex-1 leading-snug">
            {chat.lastMessage?.content || (
              <span className="italic text-muted-foreground/40">{t('noMessagesYet')}</span>
            )}
          </p>
          <div className="h-5 px-2 rounded-full border border-white/5 bg-white/5 flex items-center shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground/70">
              {chat.memberCount} {t('members')}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
