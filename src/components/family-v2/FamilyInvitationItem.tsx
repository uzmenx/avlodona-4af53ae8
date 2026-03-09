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
    <div className="flex items-center gap-3 p-4 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={invitation.sender?.avatar_url || undefined} />
          <AvatarFallback className="bg-emerald-500 text-white">
            {getInitials(invitation.sender?.name)}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background flex items-center justify-center">
          <TreeDeciduous className="h-3 w-3 text-emerald-600" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          <span className="font-semibold">
            {invitation.sender?.name || invitation.sender?.username || 'Foydalanuvchi'}
          </span>{' '}
          sizni oila daraxtiga taklif qildi
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatTime(invitation.created_at)}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-9 w-9 p-0 border-destructive/50 text-destructive hover:bg-destructive/10"
          onClick={() => onReject(invitation)}
          disabled={isProcessing}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          className="h-9 w-9 p-0 bg-emerald-500 hover:bg-emerald-600"
          onClick={() => onAccept(invitation)}
          disabled={isProcessing}
        >
          <Check className="h-4 w-4 text-white" />
        </Button>
      </div>
    </div>
  );
};
