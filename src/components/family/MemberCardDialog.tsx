import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FamilyMember, FAMILY_LIMITS } from '@/hooks/useFamilyTree';
import { cn } from '@/lib/utils';
import { Send, Trash2, User, MessageCircle, Link as LinkIcon, Heart, Plus, Baby, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StarUsername } from '@/components/user/StarUsername';

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
  spouse_2: "Ikkinchi juft",
  grandparent: 'Buvi/Bobiyo',
  grandchild: 'Nevara',
  cousin: 'Amakivachcha',
};

interface MemberCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: FamilyMember | null;
  isOwner: boolean;
  onSendInvitation: () => void;
  onDelete: () => void;
  onAddSpouse?: (isSecondSpouse: boolean) => void;
  onAddChild?: () => void;
  onAddFather?: () => void;
  onAddMother?: () => void;
  spouseCount?: number;
  childCount?: number;
  fatherCount?: number;
  motherCount?: number;
}

export const MemberCardDialog = ({
  open,
  onOpenChange,
  member,
  isOwner,
  onSendInvitation,
  onDelete,
  onAddSpouse,
  onAddChild,
  onAddFather,
  onAddMother,
  spouseCount = 0,
  childCount = 0,
  fatherCount = 0,
  motherCount = 0,
  members = [],
}: MemberCardDialogProps & { members?: FamilyMember[] }) => {
  const navigate = useNavigate();

  if (!member) return null;

  const getGenderColors = (gender: 'male' | 'female' | null | undefined) => {
    if (gender === 'male') {
      return { ring: 'ring-sky-400', bg: 'bg-sky-500', border: 'border-sky-400' };
    } else if (gender === 'female') {
      return { ring: 'ring-pink-400', bg: 'bg-pink-500', border: 'border-pink-400' };
    }
    return { ring: 'ring-muted', bg: 'bg-muted', border: 'border-muted' };
  };

  const memberGender = member.gender || member.linked_profile?.gender as any;
  const colors = getGenderColors(memberGender);
  const displayName = member.linked_profile?.name || member.member_name;
  const displayAvatar = member.linked_profile?.avatar_url || member.avatar_url;
  const isLinked = !!member.linked_user_id;
  const isSpouseRelation = member.relation_type.includes('spouse_of_') || member.relation_type.includes('spouse_2_of_');
  const isChildRelation = member.relation_type.includes('child_of_');
  const isParentRelation = member.relation_type.includes('father_of_') || member.relation_type.includes('mother_of_');

  // Spouse gender is opposite of member's gender
  const spouseGender: 'male' | 'female' = memberGender === 'male' ? 'female' : 'male';
  const spouseButtonColor = spouseGender === 'male' ? 'bg-sky-500 hover:bg-sky-600' : 'bg-pink-500 hover:bg-pink-600';

  // Check if can add more
  // Agar jufti bor bo'lsa (spouseCount > 0), JUFT o'rniga FARZAND ko'rsatiladi
  const hasSpouse = spouseCount > 0;
  const canAddSpouse = spouseCount < FAMILY_LIMITS.MAX_SPOUSES;
  const canAddChild = childCount < FAMILY_LIMITS.MAX_CHILDREN && hasSpouse;
  const canAddFather = fatherCount < FAMILY_LIMITS.MAX_FATHERS;
  const canAddMother = motherCount < FAMILY_LIMITS.MAX_MOTHERS;

  const handleViewProfile = () => {
    if (member.linked_user_id) {
      navigate(`/user/${member.linked_user_id}`);
      onOpenChange(false);
    }
  };

  const handleSendMessage = () => {
    if (member.linked_user_id) {
      navigate(`/chat/${member.linked_user_id}`);
      onOpenChange(false);
    }
  };

  // Get display label for relation type - includes parent member name for context
  const getRelationLabel = (relationType: string) => {
    // Find parent member name for contextual label
    const extractParentId = (type: string): string | null => {
      const patterns = [
        /spouse_of_(.+)$/,
        /spouse_2_of_(.+)$/,
        /child_of_(.+?)_\d+$/,
        /child_of_(.+)$/,
        /father_of_(.+)$/,
        /father_2_of_(.+)$/,
        /mother_of_(.+)$/,
        /mother_2_of_(.+)$/,
      ];
      for (const pattern of patterns) {
        const match = type.match(pattern);
        if (match) return match[1];
      }
      return null;
    };

    const parentId = extractParentId(relationType);
    const parentMember = parentId ? members.find(m => m.id === parentId) : null;
    const parentName = parentMember?.member_name || parentMember?.linked_profile?.name;

    if (relationType.includes('spouse_2_of_')) {
      return parentName ? `${parentName}ning 2-jufti` : "Ikkinchi juft";
    }
    if (relationType.includes('spouse_of_')) {
      return parentName ? `${parentName}ning jufti` : "Turmush o'rtog'i";
    }
    if (relationType.includes('child_of_')) {
      return parentName ? `${parentName}ning farzandi` : "Farzand";
    }
    if (relationType.includes('father_2_of_')) {
      return parentName ? `${parentName}ning 2-otasi` : "Ikkinchi ota";
    }
    if (relationType.includes('father_of_')) {
      return parentName ? `${parentName}ning otasi` : "Ota";
    }
    if (relationType.includes('mother_2_of_')) {
      return parentName ? `${parentName}ning 2-onasi` : "Ikkinchi ona";
    }
    if (relationType.includes('mother_of_')) {
      return parentName ? `${parentName}ning onasi` : "Ona";
    }
    return relationLabels[relationType] || relationType;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>A'zo ma'lumotlari</DialogTitle>
        </DialogHeader>

        {/* Header background */}
        <div className="h-24 bg-gradient-to-b from-emerald-500/30 via-teal-500/30 to-green-500/30" />
        
        {/* Avatar - overlapping header */}
        <div className="flex flex-col items-center -mt-14 pb-4 px-4">
          <div className={cn("rounded-full p-1 bg-background", colors.ring, "ring-4")}>
            <Avatar className={cn("h-24 w-24 border-2", colors.border)}>
              <AvatarImage src={displayAvatar || undefined} />
              <AvatarFallback className={cn(colors.bg, "text-white text-2xl")}>
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Name and relation */}
          <div className="text-center mt-3">
            <h3 className="text-xl font-bold">{displayName}</h3>
            <Badge variant="secondary" className="mt-1">
              {getRelationLabel(member.relation_type)}
            </Badge>
            {member.linked_profile?.username && (
              <div className="mt-1">
                <StarUsername username={member.linked_profile.username} textClassName="text-sm" />
              </div>
            )}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 mt-3">
            {isLinked ? (
              <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                <LinkIcon className="h-3 w-3 mr-1" />
                Ulangan
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30">
                Bo'sh profil
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="w-full space-y-2 mt-6">
            {/* Family action buttons - show for ALL members */}
            {isOwner && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {/* Add Father button */}
                {canAddFather && onAddFather && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex flex-col h-auto py-2 bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30"
                    onClick={() => {
                      onAddFather();
                      onOpenChange(false);
                    }}
                  >
                    <Plus className="h-4 w-4 text-sky-500" />
                    <span className="text-[10px] mt-1 text-sky-500">OTA</span>
                  </Button>
                )}

                {/* Add Mother button */}
                {canAddMother && onAddMother && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex flex-col h-auto py-2 bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/30"
                    onClick={() => {
                      onAddMother();
                      onOpenChange(false);
                    }}
                  >
                    <Plus className="h-4 w-4 text-pink-500" />
                    <span className="text-[10px] mt-1 text-pink-500">ONA</span>
                  </Button>
                )}

                {/* Add Spouse button - faqat jufti yo'q bo'lsa ko'rsatiladi */}
                {!hasSpouse && canAddSpouse && onAddSpouse && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex flex-col h-auto py-2 border-red-500/30",
                      "bg-red-500/10 hover:bg-red-500/20"
                    )}
                    onClick={() => {
                      onAddSpouse(false);
                      onOpenChange(false);
                    }}
                  >
                    <Heart className="h-4 w-4 text-red-500" />
                    <span className="text-[10px] mt-1 text-red-500">JUFT</span>
                  </Button>
                )}

                {/* Add Child button - faqat jufti bor bo'lsa ko'rsatiladi (JUFT o'rniga) */}
                {hasSpouse && canAddChild && onAddChild && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex flex-col h-auto py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30"
                    onClick={() => {
                      onAddChild();
                      onOpenChange(false);
                    }}
                  >
                    <Baby className="h-4 w-4 text-emerald-500" />
                    <span className="text-[10px] mt-1 text-emerald-500">FARZAND</span>
                  </Button>
                )}
              </div>
            )}

            {isLinked ? (
              <>
                <Button
                  className="w-full"
                  onClick={handleViewProfile}
                >
                  <User className="h-4 w-4 mr-2" />
                  Profilni ko'rish
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSendMessage}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Xabar yuborish
                </Button>
              </>
            ) : isOwner ? (
              <Button
                className="w-full"
                onClick={() => {
                  onSendInvitation();
                  onOpenChange(false);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Taklifnoma yuborish
              </Button>
            ) : null}

            {isOwner && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  onDelete();
                  onOpenChange(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                O'chirish
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
