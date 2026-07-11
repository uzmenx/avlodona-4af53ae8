import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, UserPlus, AtSign, Check, Trash2, MailOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import type { GroupedNotification } from './groupNotifications';

type Type = GroupedNotification extends { kind: 'group'; type: infer T } ? T : never;

const ICONS: Partial<Record<Type, { icon: React.ReactNode; gradient: string; verb: string }>> = {
  like:       { icon: <Heart className="h-3.5 w-3.5 text-white fill-white" />, gradient: 'from-rose-500 to-pink-500',     verb: 'yoqtirdi' },
  story_like: { icon: <Heart className="h-3.5 w-3.5 text-white fill-white" />, gradient: 'from-rose-500 to-pink-500',     verb: 'hikoyangizni yoqtirdi' },
  comment:    { icon: <MessageCircle className="h-3.5 w-3.5 text-white" />,     gradient: 'from-sky-500 to-blue-500',     verb: 'izoh qoldirdi' },
  mention:    { icon: <AtSign className="h-3.5 w-3.5 text-white" />,            gradient: 'from-purple-500 to-violet-500', verb: 'sizni belgiladi' },
  follow:     { icon: <UserPlus className="h-3.5 w-3.5 text-white" />,          gradient: 'from-violet-500 to-indigo-500', verb: 'sizni kuzata boshladi' },
};

interface Props {
  group: Extract<GroupedNotification, { kind: 'group' }>;
  onMarkRead: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
}

const initials = (s?: string | null) => (s ? s.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U');

export const GroupedNotificationItem = ({ group, onMarkRead, onDelete }: Props) => {
  const navigate = useNavigate();
  const [removing, setRemoving] = useState(false);
  const x = useMotionValue(0);

  // Background colors that intensify as user swipes
  const bgRight = useTransform(x, [0, 80, 160], ['rgba(16,185,129,0)', 'rgba(16,185,129,0.15)', 'rgba(16,185,129,0.35)']);
  const bgLeft  = useTransform(x, [-160, -80, 0], ['rgba(239,68,68,0.35)', 'rgba(239,68,68,0.15)', 'rgba(239,68,68,0)']);
  const opacityRight = useTransform(x, [0, 40, 160], [0, 0, 1]);
  const opacityLeft  = useTransform(x, [-160, -40, 0], [1, 0, 0]);

  const config = ICONS[group.type] ?? { icon: <Heart className="h-3.5 w-3.5 text-white" />, gradient: 'from-slate-500 to-gray-500', verb: '' };
  const firstActor = group.actors[0];
  const extraCount = Math.max(0, group.actorCount - 1);

  // Asosiy matn
  const actorName = firstActor?.name || firstActor?.username || 'Foydalanuvchi';
  const messageText = extraCount > 0
    ? `${actorName} va yana ${extraCount} kishi ${config.verb}`
    : `${actorName} ${config.verb}`;

  const handleClick = () => {
    onMarkRead(group.items.filter(i => !i.is_read).map(i => i.id));
    const n = group.latest;
    if (n.post_id) {
      if (group.type === 'story_like') {
        navigate(`/user/${n.actor_id}?view=stories&storyId=${n.post_id}`);
      } else {
        navigate(`/user/${n.actor_id}?postId=${n.post_id}`);
      }
    } else {
      // follow guruh — birinchi user profilini ochamiz
      navigate(`/user/${firstActor?.id ?? n.actor_id}`);
    }
  };

  const handleSwipeEnd = (_e: PointerEvent, info: { offset: { x: number } }) => {
    const dx = info.offset.x;
    if (dx > 120) {
      // → o'qilgan deb belgilash
      onMarkRead(group.items.filter(i => !i.is_read).map(i => i.id));
      x.set(0);
    } else if (dx < -120) {
      // ← o'chirish
      setRemoving(true);
      setTimeout(() => onDelete(group.items.map(i => i.id)), 250);
    } else {
      x.set(0);
    }
  };

  // Post/story media preview
  const mediaUrl =
    group.latest.story?.media_url ||
    group.latest.post?.media_urls?.[0];
  const isVideo = group.latest.story?.media_type === 'video' || mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);

  return (
    <AnimatePresence>
      {!removing && (
        <motion.div
          layout
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.25 }}
          className="relative overflow-hidden"
        >
          {/* Swipe background indicators */}
          <motion.div
            style={{ backgroundColor: bgRight, opacity: opacityRight }}
            className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none"
          >
            <div className="flex items-center gap-2 text-emerald-500">
              <MailOpen className="h-5 w-5" />
            </div>
          </motion.div>
          <motion.div
            style={{ backgroundColor: bgLeft, opacity: opacityLeft }}
            className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none"
          >
            <div className="flex items-center gap-2 text-rose-500">
              <Trash2 className="h-5 w-5" />
            </div>
          </motion.div>

          {/* Foreground card */}
          <motion.div
            style={{ x }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={handleSwipeEnd as never}
            onClick={handleClick}
            className={cn(
              'relative flex items-center gap-3 px-4 py-3 cursor-pointer select-none',
              'transition-colors',
              group.isRead
                ? 'bg-background hover:bg-white/5'
                : 'bg-primary/[0.06] hover:bg-primary/[0.10]',
            )}
          >
            {!group.isRead && (
              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-gradient-to-b from-primary to-primary/40" />
            )}

            {/* Stacked avatars (Instagram uslubi) */}
            <div className="relative shrink-0 h-12 flex items-center" style={{ width: Math.min(group.actors.length, 3) * 22 + 26 }}>
              {group.actors.slice(0, 3).map((a, i) => (
                <Avatar
                  key={a?.id ?? i}
                  className={cn(
                    'h-11 w-11 absolute border-2 border-background shadow-md',
                    i === 0 && 'z-30',
                    i === 1 && 'z-20',
                    i === 2 && 'z-10',
                  )}
                  style={{ left: i * 18 }}
                >
                  <AvatarImage src={a?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-muted to-muted/50">
                    {initials(a?.name || a?.username)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {/* Type badge — birinchi avatar pastida */}
              <div
                className={cn(
                  'absolute -bottom-0 left-7 h-[22px] w-[22px] rounded-full flex items-center justify-center shadow-lg ring-2 ring-background z-40',
                  'bg-gradient-to-br', config.gradient,
                )}
              >
                {config.icon}
              </div>
            </div>

            {/* Matn */}
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm leading-snug', !group.isRead && 'font-medium')}>
                <span className="font-bold">{actorName}</span>
                {extraCount > 0 && (
                  <span className="text-muted-foreground"> va yana </span>
                )}
                {extraCount > 0 && (
                  <span className="font-semibold">{extraCount} kishi</span>
                )}{' '}
                <span className="text-muted-foreground">{config.verb}</span>
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                {formatDistanceToNow(new Date(group.latestAt), { addSuffix: false, locale: uz })}
              </p>
            </div>

            {/* Media preview */}
            {mediaUrl && (
              <div className="h-12 w-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                {isVideo ? (
                  <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            )}

            {!group.isRead && (
              <div className="h-2 w-2 rounded-full bg-primary shrink-0 shadow-[0_0_6px_2px_hsl(var(--primary)/0.4)]" />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
