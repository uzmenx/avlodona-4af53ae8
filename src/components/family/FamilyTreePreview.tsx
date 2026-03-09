import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, HelpCircle, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FamilyMember } from '@/hooks/useFamilyTree';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FamilyTreePreviewProps {
  members: FamilyMember[];
  currentUser: {
    id: string;
    full_name: string;
    avatar_url: string;
    gender?: 'male' | 'female' | null;
  } | null;
  selectedMemberId?: string | null;
  onSelectMember?: (member: FamilyMember) => void;
  selectable?: boolean;
  showFullscreenButton?: boolean;
}

// Relation labels mapping
const relationLabels: Record<string, string> = {
  father: 'Ota',
  mother: 'Ona',
  grandfather: 'Bobo',
  grandmother: 'Momo',
  brother: 'Aka',
  younger_brother: 'Ukasi',
  sister: 'Opa',
  younger_sister: 'Singil',
  son: "O'g'il",
  daughter: 'Qiz',
  husband: 'Er',
  wife: 'Xotin',
  uncle: "Tog'a/Amaki",
  aunt: 'Xola/Amma',
  nephew: 'Jiyan',
  niece: 'Jiyan',
  grandson: 'Nevara',
  granddaughter: 'Nevara',
  sibling: 'Aka/Uka/Opa/Singil',
  child: 'Farzand',
  spouse: "Turmush o'rtog'i",
  grandparent: 'Buvi/Bobiyo',
  grandchild: 'Nevara',
  cousin: 'Amakivachcha',
};

export const FamilyTreePreview = ({ 
  members, 
  currentUser,
  selectedMemberId,
  onSelectMember,
  selectable = false,
  showFullscreenButton = false,
}: FamilyTreePreviewProps) => {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  // Categorize members
  const parents = members.filter(r => ['father', 'mother'].includes(r.relation_type));
  const grandparents = members.filter(r => ['grandfather', 'grandmother', 'grandparent'].includes(r.relation_type));
  const siblings = members.filter(r => ['brother', 'younger_brother', 'sister', 'younger_sister', 'sibling'].includes(r.relation_type));
  const spouse = members.filter(r => ['husband', 'wife', 'spouse'].includes(r.relation_type));
  const children = members.filter(r => ['son', 'daughter', 'child'].includes(r.relation_type));
  const others = members.filter(r => 
    !['father', 'mother', 'grandfather', 'grandmother', 'grandparent', 'brother', 'younger_brother', 'sister', 'younger_sister', 'sibling', 'husband', 'wife', 'spouse', 'son', 'daughter', 'child'].includes(r.relation_type)
  );

  const getGenderColors = (gender: 'male' | 'female' | null | undefined) => {
    if (gender === 'male') {
      return {
        ring: 'ring-sky-400',
        bg: 'bg-sky-500',
        border: 'border-sky-400',
      };
    } else if (gender === 'female') {
      return {
        ring: 'ring-pink-400',
        bg: 'bg-pink-500',
        border: 'border-pink-400',
      };
    }
    return {
      ring: 'ring-muted',
      bg: 'bg-muted',
      border: 'border-muted',
    };
  };

  const renderMemberNode = (member: FamilyMember, size: 'sm' | 'md' = 'sm') => {
    const displayGender = member.linked_profile?.gender as 'male' | 'female' | null || member.gender;
    const colors = getGenderColors(displayGender);
    const displayName = member.linked_profile?.name || member.member_name;
    const displayAvatar = member.linked_profile?.avatar_url || member.avatar_url;
    const isPlaceholder = member.is_placeholder;
    const isSelected = selectedMemberId === member.id;
    
    const sizeClasses = size === 'sm' 
      ? 'h-10 w-10' 
      : 'h-14 w-14';
    
    const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
    
    return (
      <button
        key={member.id}
        onClick={() => selectable && onSelectMember?.(member)}
        disabled={!selectable || !isPlaceholder}
        className={cn(
          "flex flex-col items-center gap-1 transition-all",
          selectable && isPlaceholder && "cursor-pointer hover:scale-105",
          selectable && !isPlaceholder && "opacity-50 cursor-not-allowed",
          isSelected && "scale-110"
        )}
      >
        <div className={cn(
          "rounded-full p-0.5 relative transition-all",
          colors.ring,
          isSelected ? "ring-4 ring-green-500" : "ring-2"
        )}>
          <Avatar className={cn(sizeClasses, "border", colors.border)}>
            <AvatarImage src={displayAvatar || undefined} />
            <AvatarFallback className={cn(colors.bg, "text-white", size === 'sm' ? 'text-xs' : 'text-sm')}>
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isPlaceholder && (
            <div className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center">
              <HelpCircle className="h-2.5 w-2.5 text-white" />
            </div>
          )}
        </div>
        <div className="text-center">
          <p className={cn("font-medium text-foreground truncate max-w-[60px]", textSize)}>{displayName}</p>
          <p className={cn("text-muted-foreground truncate max-w-[60px]", size === 'sm' ? 'text-[10px]' : 'text-xs')}>
            {relationLabels[member.relation_type] || member.relation_type}
          </p>
        </div>
      </button>
    );
  };

  const renderCurrentUser = (size: 'sm' | 'md' = 'sm') => {
    const colors = getGenderColors(currentUser?.gender);
    
    const sizeClasses = size === 'sm' 
      ? 'h-12 w-12' 
      : 'h-16 w-16';
    
    return (
      <div className="flex flex-col items-center gap-1">
        <div className={cn("rounded-full p-0.5", colors.ring, "ring-2")}>
          <Avatar className={cn(sizeClasses, "border", colors.border)}>
            <AvatarImage src={currentUser?.avatar_url} />
            <AvatarFallback className={cn(colors.bg, "text-white", size === 'sm' ? 'text-sm' : 'text-lg')}>
              {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="text-center">
          <p className={cn("font-bold text-foreground truncate max-w-[70px]", size === 'sm' ? 'text-xs' : 'text-sm')}>{currentUser?.full_name || 'Siz'}</p>
          <p className="text-[10px] text-muted-foreground">Siz</p>
        </div>
      </div>
    );
  };

  const renderTreeContent = (size: 'sm' | 'md' = 'sm') => (
    <div className="flex flex-col items-center justify-center space-y-4 py-4">
      {/* Parents row */}
      {parents.length > 0 && (
        <div className="flex justify-center gap-4 flex-wrap">
          {parents.map(m => renderMemberNode(m, size))}
        </div>
      )}

      {/* Current user + spouse + siblings row */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {siblings.slice(0, 2).map(m => renderMemberNode(m, size))}
        {renderCurrentUser(size)}
        {spouse.map(m => renderMemberNode(m, size))}
      </div>

      {/* Children row */}
      {children.length > 0 && (
        <div className="flex justify-center gap-3 flex-wrap">
          {children.slice(0, 3).map(m => renderMemberNode(m, size))}
        </div>
      )}

      {/* Other relatives */}
      {others.length > 0 && (
        <div className="pt-2 border-t border-border/50 w-full">
          <p className="text-[10px] font-medium text-muted-foreground mb-2 text-center">Boshqa qarindoshlar</p>
          <div className="flex justify-center gap-3 flex-wrap">
            {others.slice(0, 4).map(m => renderMemberNode(m, size))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="relative bg-gradient-to-b from-emerald-500/20 via-teal-500/20 to-green-500/20 rounded-xl p-3">
        {showFullscreenButton && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={() => setFullscreenOpen(true)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        )}
        
        {renderTreeContent('sm')}
      </div>

      {/* Fullscreen dialog */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Oila daraxti</DialogTitle>
          </DialogHeader>
          <div className="bg-gradient-to-b from-emerald-500/20 via-teal-500/20 to-green-500/20 rounded-xl p-4">
            {renderTreeContent('md')}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
