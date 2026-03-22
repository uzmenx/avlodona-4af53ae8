import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, MessageCircle, BookHeart, ExternalLink, Skull, UserCheck, X, Camera } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FamilyMember } from '@/types/family';
import { cn } from '@/lib/utils';

interface TreeStatsDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'all' | 'active';
  members: FamilyMember[];
}

const MemberAvatar = ({ member, size = 'md' }: { member: FamilyMember; size?: 'sm' | 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-9 h-9 text-sm' : 'w-11 h-11 text-base';
  const genderGradient = member.gender === 'female'
    ? 'from-rose-500 to-pink-500'
    : 'from-blue-500 to-indigo-500';

  if (member.photoUrl) {
    return (
      <img
        src={member.photoUrl}
        alt={member.name}
        className={cn('rounded-2xl object-cover flex-shrink-0 ring-2 ring-white/10', sizeClass)}
      />
    );
  }

  return (
    <div className={cn('rounded-2xl flex-shrink-0 bg-gradient-to-br flex items-center justify-center font-bold text-white ring-2 ring-white/10', sizeClass, genderGradient)}>
      {member.name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
};

const MemberRow = ({ member, onClose }: { member: FamilyMember; onClose: () => void }) => {
  const navigate = useNavigate();
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
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 dark:bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
      <MemberAvatar member={member} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate text-foreground">
            {member.name || "Noma'lum"}
          </span>
          {isLive && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 shadow-sm shadow-emerald-400/50" />
          )}
        </div>
        {yearRange && (
          <span className="text-[11px] text-muted-foreground font-medium">{yearRange}</span>
        )}
        {!isLive && member.deathYear && (
          <span className="text-[10px] text-rose-400/80 font-medium flex items-center gap-0.5 mt-0.5">
            <Skull className="w-2.5 h-2.5" /> Vafot etgan
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isLive ? (
          <>
            <button
              onClick={handleMessage}
              className="w-8 h-8 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 flex items-center justify-center transition-colors"
              title="Habar yuborish"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            <button
              onClick={handleGoProfile}
              className="w-8 h-8 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
              title="Profiliga o'tish"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleMemorialPost}
              className="w-8 h-8 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 flex items-center justify-center transition-colors"
              title="Xotira post qoldirish"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={handleGoProfile}
              className="w-8 h-8 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
              title="Xotira sahifasiga o'tish"
            >
              <BookHeart className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export const TreeStatsDrawer = ({ open, onOpenChange, mode, members }: TreeStatsDrawerProps) => {
  const [tab, setTab] = useState<'active' | 'memorial'>('active');

  const displayedAll = members;
  const displayedActive = members.filter(m => !!m.linkedUserId);
  const displayedInactive = members.filter(m => !m.linkedUserId);

  const isAllMode = mode === 'all';
  const title = isAllMode ? `Barcha profillar (${members.length})` : `Faol foydalanuvchilar (${displayedActive.length})`;
  const icon = isAllMode ? Users : UserCheck;
  const IconC = icon;

  const listToShow = isAllMode
    ? (tab === 'active' ? displayedActive : displayedInactive)
    : displayedActive;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[80vh] rounded-t-3xl bg-background/95 backdrop-blur-2xl border-t border-white/10 p-0"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base font-bold">
              <div className={cn(
                'w-9 h-9 rounded-2xl flex items-center justify-center',
                isAllMode
                  ? 'bg-slate-700/80 text-slate-200'
                  : 'bg-emerald-600/30 text-emerald-400'
              )}>
                <IconC className="w-4 h-4" />
              </div>
              {title}
            </SheetTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/40 hover:bg-muted/70 text-muted-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs for "all" mode */}
          {isAllMode && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setTab('active')}
                className={cn(
                  'flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors',
                  tab === 'active'
                    ? 'bg-emerald-600/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-muted/30 border-white/10 text-muted-foreground hover:bg-muted/50'
                )}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Jonli ({displayedActive.length})
              </button>
              <button
                onClick={() => setTab('memorial')}
                className={cn(
                  'flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors',
                  tab === 'memorial'
                    ? 'bg-slate-700/60 border-white/20 text-slate-200'
                    : 'bg-muted/30 border-white/10 text-muted-foreground hover:bg-muted/50'
                )}
              >
                <Skull className="w-3.5 h-3.5" />
                Xotira ({displayedInactive.length})
              </button>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="h-full px-4 py-3">
          <div className="space-y-2 pb-20">
            {listToShow.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-16 h-16 rounded-3xl bg-muted/30 flex items-center justify-center">
                  {tab === 'active' || !isAllMode
                    ? <UserCheck className="w-7 h-7 text-muted-foreground/50" />
                    : <Skull className="w-7 h-7 text-muted-foreground/50" />}
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  {tab === 'active' || !isAllMode
                    ? "Hech qanday faol foydalanuvchi yo'q"
                    : "Xotira profillari mavjud emas"}
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
