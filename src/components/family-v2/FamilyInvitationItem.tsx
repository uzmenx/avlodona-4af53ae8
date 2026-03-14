import { Check, X, TreeDeciduous } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { FamilyInvitation } from '@/hooks/useFamilyInvitations';

interface FamilyInvitationItemProps {
  invitation: FamilyInvitation;
  onAccept: (invitation: FamilyInvitation) => void;
  onReject: (invitation: FamilyInvitation) => void;
  isProcessing?: boolean;
}

export const FamilyInvitationItem = ({
  invitation,
  onAccept,
  onReject,
  isProcessing = false,
}: FamilyInvitationItemProps) => {
  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: uz });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-md shadow-black/5 dark:shadow-black/30 p-3">
        <div className="relative shrink-0">
          <Avatar className="h-12 w-12">
          <AvatarImage src={invitation.sender?.avatar_url || undefined} />
          <AvatarFallback className="bg-emerald-500 text-white">
            {getInitials(invitation.sender?.name)}
          </AvatarFallback>
        </Avatar>
          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background/90 dark:bg-background/80 border border-white/10 flex items-center justify-center">
            <TreeDeciduous className="h-3 w-3 text-emerald-600" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug text-foreground">
            <span className="font-bold">
              {invitation.sender?.name || invitation.sender?.username || 'Foydalanuvchi'}
            </span>{' '}
            sizni oila daraxtiga taklif qildi
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatTime(invitation.created_at)}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-11 w-11 p-0 rounded-2xl border-white/15 bg-white/50 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10 text-destructive hover:text-destructive"
            onClick={() => onReject(invitation)}
            disabled={isProcessing}
            aria-label="Rad etish"
            title="Rad etish"
          >
            <X className="h-5 w-5" />
          </Button>
          <Button
            size="sm"
            className="h-11 w-11 p-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-600"
            onClick={() => onAccept(invitation)}
            disabled={isProcessing}
            aria-label="Qabul qilish"
            title="Qabul qilish"
          >
            <Check className="h-5 w-5 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
};
