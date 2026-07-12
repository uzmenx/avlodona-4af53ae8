import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, MessageCircle, Skull, UserCheck, X } from 'lucide-react';
import { Icon } from '@iconify/react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FamilyMember } from '@/types/family';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface TreeStatsDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'all' | 'active';
  members: FamilyMember[];
}

const MemberAvatar = ({ member, size = 'md' }: { member: FamilyMember; size?: 'sm' | 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-9 h-9 text-sm' : 'w-12 h-12 text-base';
  const genderGradient = member.gender === 'female'
    ? 'from-rose-400 via-pink-500 to-fuchsia-500'
    : 'from-blue-400 via-indigo-500 to-violet-500';

  if (member.photoUrl) {
    return (
      <img
        src={member.photoUrl}
        alt={member.name}
        className={cn(
          'rounded-2xl object-cover flex-shrink-0 ring-2 ring-white/20 shadow-lg',
          sizeClass
        )}
      />
    );
  }

  return (
    <div className={cn(
      'rounded-2xl flex-shrink-0 bg-gradient-to-br flex items-center justify-center font-bold text-white ring-2 ring-white/10 shadow-lg',
      sizeClass,
      genderGradient
    )}>
      {member.name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
};

const MemberRow = ({ member, onClose }: { member: FamilyMember; onClose: () => void }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isLive = !!member.linkedUserId;

  const yearRange = (() => {
    if (member.birthYear && member.deathYear) return `${member.birthYear} — ${member.deathYear}`;
    if (member.birthYear) return `${member.birthYear}`;
    return null;
  })();

  const handleGoProfile = () => {
    onClose();
    if (member.linkedUserId) {
      navigate(`/user/${member.linkedUserId}`);
    } else {
      navigate(`/user/${member.id}?memorial=true`);
    }
  };

  const handleMessage = () => {
    onClose();
    if (member.linkedUserId) {
      navigate(`/messages?user=${member.linkedUserId}`);
    }
  };

  const handleMemorialPost = () => {
    onClose();
    navigate(`/create?memberId=${member.id}`);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/5 dark:bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 group">
      
      {/* Clickable avatar + name area */}
      <div
        onClick={handleGoProfile}
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
      >
        <div className="transition-transform duration-200 group-hover:scale-105">
          <MemberAvatar member={member} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors duration-200">
              {member.name || t('unknown')}
            </span>
            {isLive && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 shadow-sm shadow-emerald-400/60 animate-pulse" />
            )}
          </div>
          {yearRange && (
            <span className="text-[11px] text-muted-foreground font-medium">{yearRange}</span>
          )}
          {!isLive && member.deathYear && (
            <span className="text-[10px] text-rose-400/80 font-medium flex items-center gap-0.5 mt-0.5">
              <Skull className="w-2.5 h-2.5" /> {t('deceased')}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/50 group-hover:text-primary/60 transition-colors duration-200 mt-0.5 block">
            {isLive ? t('goToProfile') : t('goToMemorial')}
          </span>
        </div>
      </div>

      {/* Action buttons — right side */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isLive ? (
          <button
            onClick={handleMessage}
            className="w-9 h-9 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm"
            title={t('sendMessage')}
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleMemorialPost}
            className="relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 overflow-hidden group/cam"
            title={t('addMemoryPost')}
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/30 via-orange-400/25 to-rose-400/20 group-hover/cam:from-amber-400/50 group-hover/cam:via-orange-400/40 group-hover/cam:to-rose-400/35 transition-all duration-300" />
            {/* Border */}
            <div className="absolute inset-0 rounded-2xl border border-amber-400/30 group-hover/cam:border-amber-400/60 transition-colors duration-200" />
            {/* Icon */}
            <Icon
              icon="famicons:camera"
              className="w-5 h-5 text-amber-400 group-hover/cam:text-amber-300 transition-colors duration-200 relative z-10 drop-shadow-sm"
            />
          </button>
        )}
      </div>
    </div>
  );
};

export const TreeStatsDrawer = ({ open, onOpenChange, mode, members }: TreeStatsDrawerProps) => {
  const [tab, setTab] = useState<'active' | 'memorial'>('active');
  const { t } = useLanguage();

  const displayedActive = members.filter(m => !!m.linkedUserId);
  const displayedInactive = members.filter(m => !m.linkedUserId);

  const isAllMode = mode === 'all';
  const title = isAllMode 
    ? `${t('allProfiles')} (${members.length})` 
    : `${t('activeUsers')} (${displayedActive.length})`;
  const IconC = isAllMode ? Users : UserCheck;

  const listToShow = isAllMode
    ? (tab === 'active' ? displayedActive : displayedInactive)
    : displayedActive;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[80vh] rounded-t-3xl bg-background/95 backdrop-blur-2xl border-t border-white/10 p-0"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <SheetHeader className="px-5 pt-3 pb-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2.5 text-base font-bold">
              <div className={cn(
                'w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg',
                isAllMode
                  ? 'bg-gradient-to-br from-slate-600 to-slate-700 text-slate-200'
                  : 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 text-emerald-400 border border-emerald-500/20'
              )}>
                <IconC className="w-4.5 h-4.5" />
              </div>
              <span className="text-foreground">{title}</span>
            </SheetTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs for "all" mode */}
          {isAllMode && (
            <div className="flex gap-2 mt-4 p-1 rounded-2xl bg-white/5 border border-white/10">
              <button
                onClick={() => setTab('active')}
                className={cn(
                  'flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200',
                  tab === 'active'
                    ? 'bg-emerald-500/25 text-emerald-300 shadow-sm border border-emerald-500/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {t('liveTab')} ({displayedActive.length})
              </button>
              <button
                onClick={() => setTab('memorial')}
                className={cn(
                  'flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200',
                  tab === 'memorial'
                    ? 'bg-slate-600/60 text-slate-200 shadow-sm border border-white/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                <Icon icon="famicons:camera" className="w-3.5 h-3.5" />
                {t('memorialTab')} ({displayedInactive.length})
              </button>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="h-full px-4 py-3">
          <div className="space-y-2 pb-20">
            {listToShow.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-4 text-center">
                <div className="w-18 h-18 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                  {tab === 'active' || !isAllMode
                    ? <UserCheck className="w-8 h-8 text-muted-foreground/40" />
                    : <Icon icon="famicons:camera" className="w-8 h-8 text-muted-foreground/40" />}
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  {tab === 'active' || !isAllMode
                    ? t('noActiveUsers')
                    : t('noMemorialProfiles')}
                </p>
              </div>
            ) : (
              listToShow.map(member => (
                <MemberRow key={member.id} member={member} onClose={() => onOpenChange(false)} />
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
