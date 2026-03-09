import { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, Plus, HelpCircle, Heart, MoreHorizontal, Baby, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FamilyMember, FAMILY_LIMITS } from '@/hooks/useFamilyTree';
import { useZoomPan } from '@/hooks/useZoomPan';
import { MemberCardDialog } from './MemberCardDialog';
import { SendInvitationDialog } from './SendInvitationDialog';
import { AddSpouseDialog } from './AddSpouseDialog';
import { AddFamilyMemberDialog } from './AddFamilyMemberDialog';
import { FamilyConnectorLines } from './FamilyConnectorLines';
import { useAIConnectorLines } from '@/hooks/useAIConnectorLines';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface User {
  id: string;
  full_name: string;
  avatar_url: string;
}

interface FamilyTreeProps {
  members: FamilyMember[];
  currentUser: User | null;
  userGender: 'male' | 'female' | null;
  onAddRelative: () => void;
  isOwner?: boolean;
  onSendInvitation?: (memberId: string, receiverId: string) => void;
  onDeleteMember?: (memberId: string) => void;
  onAddSpouse?: (memberId: string, spouseData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }, isSecond: boolean) => void;
  onAddChild?: (memberId: string, childData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => void;
  onAddFather?: (memberId: string, data: { name: string; avatarUrl?: string }) => void;
  onAddMother?: (memberId: string, data: { name: string; avatarUrl?: string }) => void;
  countSpousesForMember?: (memberId: string) => number;
  countChildrenForMember?: (memberId: string) => number;
  countFathersForMember?: (memberId: string) => number;
  countMothersForMember?: (memberId: string) => number;
  isFatherSpouseAsMother?: (memberId: string) => boolean;
  isMotherSpouseAsFather?: (memberId: string) => boolean;
}

// Relation labels mapping (these are private labels, only shown to profile owner)
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

export const FamilyTree = ({ 
  members, 
  currentUser, 
  userGender, 
  onAddRelative,
  isOwner = true,
  onSendInvitation,
  onDeleteMember,
  onAddSpouse,
  onAddChild,
  onAddFather,
  onAddMother,
  countSpousesForMember,
  countChildrenForMember,
  countFathersForMember,
  countMothersForMember,
  isFatherSpouseAsMother,
  isMotherSpouseAsFather,
}: FamilyTreeProps) => {
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [memberCardOpen, setMemberCardOpen] = useState(false);
  const [sendInvitationOpen, setSendInvitationOpen] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [addSpouseDialogOpen, setAddSpouseDialogOpen] = useState(false);
  const [spouseTargetMember, setSpouseTargetMember] = useState<FamilyMember | null>(null);
  const [isSecondSpouse, setIsSecondSpouse] = useState(false);
  
  // New dialog states
  const [addChildDialogOpen, setAddChildDialogOpen] = useState(false);
  const [addFatherDialogOpen, setAddFatherDialogOpen] = useState(false);
  const [addMotherDialogOpen, setAddMotherDialogOpen] = useState(false);
  const [targetMemberForAction, setTargetMemberForAction] = useState<FamilyMember | null>(null);

  // Zoom and Pan state
  const {
    scale,
    translateX,
    translateY,
    resetZoom,
    zoomIn,
    zoomOut,
    handlers: zoomPanHandlers,
    handleWheel,
  } = useZoomPan({ minScale: 0.2, maxScale: 3, initialScale: 1 });

  // Refs for connection lines
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomContainerRef = useRef<HTMLDivElement>(null);
  const memberElementsRef = useRef<Map<string, HTMLElement | null>>(new Map());
  const heartElementsRef = useRef<Map<string, HTMLElement | null>>(new Map());
  const [renderKey, setRenderKey] = useState(0);
  const [useAI, setUseAI] = useState(false); // Disabled - using fallback path generation

  // Attach wheel event for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Force re-render after members update to recalculate lines
  useEffect(() => {
    const timer = setTimeout(() => setRenderKey(prev => prev + 1), 200);
    return () => clearTimeout(timer);
  }, [members, scale, translateX, translateY]);

  // Ref setter functions
  const setMemberRef = useCallback((id: string, el: HTMLElement | null) => {
    memberElementsRef.current.set(id, el);
  }, []);

  const setHeartRef = useCallback((id: string, el: HTMLElement | null) => {
    heartElementsRef.current.set(id, el);
  }, []);

  // Calculate connections with AI - use zoomContainerRef for accurate positioning
  const { connections, isCalculating, recalculate } = useAIConnectorLines(
    zoomContainerRef,
    memberElementsRef.current,
    members,
    heartElementsRef.current,
    useAI
  );

  // Categorize members - include new relation types
  const parents = members.filter(r => ['father', 'mother'].includes(r.relation_type) || r.relation_type.includes('father_of_') || r.relation_type.includes('mother_of_'));
  const grandparents = members.filter(r => ['grandfather', 'grandmother', 'grandparent'].includes(r.relation_type));
  const siblings = members.filter(r => ['brother', 'younger_brother', 'sister', 'younger_sister', 'sibling'].includes(r.relation_type));
  const spouses = members.filter(r => ['husband', 'wife', 'spouse', 'spouse_2'].includes(r.relation_type));
  const children = members.filter(r => ['son', 'daughter', 'child'].includes(r.relation_type) || r.relation_type.startsWith('child_of_'));
  const others = members.filter(r => 
    !['father', 'mother', 'grandfather', 'grandmother', 'grandparent', 'brother', 'younger_brother', 'sister', 'younger_sister', 'sibling', 'husband', 'wife', 'spouse', 'spouse_2', 'son', 'daughter', 'child'].includes(r.relation_type) &&
    !r.relation_type.includes('spouse_of_') &&
    !r.relation_type.includes('spouse_2_of_') &&
    !r.relation_type.startsWith('child_of_') &&
    !r.relation_type.includes('father_of_') &&
    !r.relation_type.includes('mother_of_')
  );

  // Find spouses for a member by linked relationships (faqat birinchi juft)
  const findSpousesForMember = (memberId: string): FamilyMember[] => {
    return members.filter(m => m.relation_type === `spouse_of_${memberId}`);
  };

  const hasSpouse = (memberId: string): boolean => {
    return members.some(m => m.relation_type === `spouse_of_${memberId}`);
  };

  const getSpouseOfMember = (memberId: string): FamilyMember | null => {
    return members.find(m => m.relation_type === `spouse_of_${memberId}`) || null;
  };

  const getChildrenOfMember = (memberId: string): FamilyMember[] => {
    return members.filter(m => m.relation_type.startsWith(`child_of_${memberId}`));
  };

  // Get father of member - supports both legacy "father" type and dynamic "father_of_MEMBER_ID"
  const getFatherOfMember = (memberId: string): FamilyMember | null => {
    // For "self" (current user), check legacy "father" relation type first
    if (memberId === 'self') {
      const legacyFather = members.find(m => m.relation_type === 'father');
      if (legacyFather) return legacyFather;
    }
    // Then check dynamic relation type
    return members.find(m => m.relation_type === `father_of_${memberId}`) || null;
  };

  // Get mother of member - supports both legacy "mother" type and dynamic "mother_of_MEMBER_ID"
  const getMotherOfMember = (memberId: string): FamilyMember | null => {
    // For "self" (current user), check legacy "mother" relation type first
    if (memberId === 'self') {
      const legacyMother = members.find(m => m.relation_type === 'mother');
      if (legacyMother) return legacyMother;
    }
    // Then check dynamic relation type
    return members.find(m => m.relation_type === `mother_of_${memberId}`) || null;
  };

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

  const handleMemberClick = (member: FamilyMember) => {
    setSelectedMember(member);
    setMemberCardOpen(true);
  };

  const handleSendInvitation = () => {
    if (selectedMember) {
      setPendingMemberId(selectedMember.id);
      setSendInvitationOpen(true);
    }
  };

  const handleSelectUser = (userId: string) => {
    if (pendingMemberId && onSendInvitation) {
      onSendInvitation(pendingMemberId, userId);
      setPendingMemberId(null);
    }
  };

  const handleDeleteMember = () => {
    if (selectedMember && onDeleteMember) {
      onDeleteMember(selectedMember.id);
    }
  };

  const handleAddSpouse = (member: FamilyMember, isSecond: boolean = false) => {
    setSpouseTargetMember(member);
    setIsSecondSpouse(isSecond);
    setAddSpouseDialogOpen(true);
  };

  const handleSpouseAdded = (spouseData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => {
    if (spouseTargetMember && onAddSpouse) {
      onAddSpouse(spouseTargetMember.id, spouseData, isSecondSpouse);
    }
    setAddSpouseDialogOpen(false);
    setSpouseTargetMember(null);
  };

  const handleAddChild = (member: FamilyMember) => {
    setTargetMemberForAction(member);
    setAddChildDialogOpen(true);
  };

  const handleChildAdded = (childData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => {
    if (targetMemberForAction && onAddChild) {
      onAddChild(targetMemberForAction.id, childData);
    }
    setAddChildDialogOpen(false);
    setTargetMemberForAction(null);
  };

  const handleAddFather = (member: FamilyMember) => {
    setTargetMemberForAction(member);
    setAddFatherDialogOpen(true);
  };

  const handleFatherAdded = (data: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => {
    if (targetMemberForAction && onAddFather) {
      onAddFather(targetMemberForAction.id, { name: data.name, avatarUrl: data.avatarUrl });
    }
    setAddFatherDialogOpen(false);
    setTargetMemberForAction(null);
  };

  const handleAddMother = (member: FamilyMember) => {
    setTargetMemberForAction(member);
    setAddMotherDialogOpen(true);
  };

  const handleMotherAdded = (data: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => {
    if (targetMemberForAction && onAddMother) {
      onAddMother(targetMemberForAction.id, { name: data.name, avatarUrl: data.avatarUrl });
    }
    setAddMotherDialogOpen(false);
    setTargetMemberForAction(null);
  };

  // Render half-heart SVG icon (left or right half)
  const HalfHeartIcon = ({ side }: { side: 'left' | 'right' }) => (
    <svg 
      width="10" 
      height="16" 
      viewBox="0 0 10 16"
      className="fill-red-500"
    >
      {side === 'left' ? (
        // Left half of heart
        <path d="M10 4.5C10 2 8 0 5.5 0C3.5 0 2 1.2 0.5 3L0 16C3 13 10 8 10 4.5Z" />
      ) : (
        // Right half of heart
        <path d="M0 4.5C0 2 2 0 4.5 0C6.5 0 8 1.2 9.5 3L10 16C7 13 0 8 0 4.5Z" />
      )}
    </svg>
  );

  // Render full heart connector between couple - with ref for line connections
  const renderHeartConnector = (memberId: string) => (
    <div 
      className="flex items-center justify-center mx-1"
      ref={(el) => setHeartRef(memberId, el)}
    >
      <Heart className="h-5 w-5 text-red-500 fill-red-500" />
    </div>
  );

  // RECURSIVE render of parents chain (going up infinitely)
  const renderParentsChain = (memberId: string, showLabel: boolean = true, depth: number = 0): React.ReactNode => {
    const father = getFatherOfMember(memberId);
    const mother = getMotherOfMember(memberId);
    
    if (!father && !mother) return null;

    // Get parents of parents (recursive up)
    const fatherParentsChain = father ? renderParentsChain(father.id, showLabel, depth + 1) : null;
    const motherParentsChain = mother ? renderParentsChain(mother.id, showLabel, depth + 1) : null;

    return (
      <div className="flex flex-col items-center gap-8">
        {/* Parents of father and mother (grandparents row) */}
        {(fatherParentsChain || motherParentsChain) && (
          <div className="flex items-start gap-20 justify-center">
            {fatherParentsChain && (
              <div className="flex flex-col items-center">
                {fatherParentsChain}
              </div>
            )}
            {motherParentsChain && (
              <div className="flex flex-col items-center">
                {motherParentsChain}
              </div>
            )}
          </div>
        )}

        {/* Current parents row (father and mother as couple) */}
        <div className="flex items-center gap-6 justify-center">
          {/* Father on left */}
          {father && (
            <div className="flex flex-col items-center" ref={(el) => setMemberRef(father.id, el)}>
              {renderSingleMember(father, showLabel, 
                countSpousesForMember ? countSpousesForMember(father.id) : 0,
                countChildrenForMember ? countChildrenForMember(father.id) : 0,
                countFathersForMember ? countFathersForMember(father.id) : 0,
                countMothersForMember ? countMothersForMember(father.id) : 0
              )}
            </div>
          )}
          
          {/* Heart connector between parents */}
          <div 
            className="flex items-center justify-center mx-3"
            ref={(el) => setHeartRef(`parents-of-${memberId}`, el)}
          >
            {father && mother ? (
              <Heart className="h-6 w-6 text-red-500 fill-red-500" />
            ) : father ? (
              <HalfHeartIcon side="left" />
            ) : (
              <HalfHeartIcon side="right" />
            )}
          </div>
          
          {/* Mother on right */}
          {mother && (
            <div className="flex flex-col items-center" ref={(el) => setMemberRef(mother.id, el)}>
              {renderSingleMember(mother, showLabel,
                countSpousesForMember ? countSpousesForMember(mother.id) : 0,
                countChildrenForMember ? countChildrenForMember(mother.id) : 0,
                countFathersForMember ? countFathersForMember(mother.id) : 0,
                countMothersForMember ? countMothersForMember(mother.id) : 0
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render member with spouse as a couple unit (faqat bitta juft)
  // Children rendered below, parents rendered above (via separate chain)
  const renderMemberWithSpouses = (member: FamilyMember, showLabel: boolean = true, showParents: boolean = true) => {
    const spouse = getSpouseOfMember(member.id);
    const memberSpouseCount = countSpousesForMember ? countSpousesForMember(member.id) : 0;
    const memberChildCount = countChildrenForMember ? countChildrenForMember(member.id) : 0;
    const memberFatherCount = countFathersForMember ? countFathersForMember(member.id) : 0;
    const memberMotherCount = countMothersForMember ? countMothersForMember(member.id) : 0;

    const memberChildren = getChildrenOfMember(member.id);
    
    // Get parents chain only if showParents is true
    const parentsChain = showParents ? renderParentsChain(member.id, showLabel) : null;

    return (
      <div key={member.id} className="flex flex-col items-center gap-8">
        {/* Parents chain ABOVE member (recursive going up) */}
        {parentsChain}

        {/* Main member with spouse */}
        <div className="flex items-center gap-6">
          {/* Main member */}
          <div ref={(el) => setMemberRef(member.id, el)}>
            {renderSingleMember(member, showLabel, memberSpouseCount, memberChildCount, memberFatherCount, memberMotherCount)}
          </div>
          
          {/* Spouse on right */}
          {spouse && (
            <>
              {renderHeartConnector(member.id)}
              <div ref={(el) => setMemberRef(spouse.id, el)}>
                {renderSingleMember(spouse, showLabel, 
                  countSpousesForMember ? countSpousesForMember(spouse.id) : 0,
                  countChildrenForMember ? countChildrenForMember(spouse.id) : 0,
                  countFathersForMember ? countFathersForMember(spouse.id) : 0,
                  countMothersForMember ? countMothersForMember(spouse.id) : 0
                )}
              </div>
            </>
          )}
        </div>

        {/* Children of this member (recursive going down) */}
        {memberChildren.length > 0 && (
          <div className="flex flex-col items-center gap-8">
            <div className="flex gap-16 flex-wrap justify-center">
              {memberChildren.map(child => (
                <div key={child.id}>
                  {/* Child with their own parents is false since we're going DOWN */}
                  {renderMemberWithSpouses(child, true, false)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSingleMember = (
    member: FamilyMember, 
    showLabel: boolean = true, 
    spouseCount: number = 0, 
    childCount: number = 0,
    fatherCount: number = 0,
    motherCount: number = 0
  ) => {
    const displayGender = member.linked_profile?.gender as 'male' | 'female' | null || member.gender;
    const colors = getGenderColors(displayGender);
    const displayName = member.linked_profile?.name || member.member_name;
    const displayAvatar = member.linked_profile?.avatar_url || member.avatar_url;
    const isPlaceholder = member.is_placeholder;
    const isSpouseRelation = member.relation_type.includes('spouse_of_');
    const isChildRelation = member.relation_type.includes('child_of_');
    const isParentRelation = member.relation_type.includes('father_of_') || member.relation_type.includes('mother_of_');

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
        return parentName ? `${parentName}ning 2-jufti` : "2-juft";
      }
      if (relationType.includes('spouse_of_')) {
        return parentName ? `${parentName}ning jufti` : "Juft";
      }
      if (relationType.includes('child_of_')) {
        return parentName ? `${parentName}ning farzandi` : "Farzand";
      }
      if (relationType.includes('father_2_of_')) {
        return parentName ? `${parentName}ning 2-otasi` : "2-ota";
      }
      if (relationType.includes('father_of_')) {
        return parentName ? `${parentName}ning otasi` : "Ota";
      }
      if (relationType.includes('mother_2_of_')) {
        return parentName ? `${parentName}ning 2-onasi` : "2-ona";
      }
      if (relationType.includes('mother_of_')) {
        return parentName ? `${parentName}ning onasi` : "Ona";
      }
      return relationLabels[relationType] || relationType;
    };
    
    return (
      <div
        className="flex flex-col items-center gap-2 group relative"
      >
        <button
          onClick={() => handleMemberClick(member)}
          className="flex flex-col items-center gap-1"
        >
          <div className={cn("rounded-full p-1 relative", colors.ring, "ring-3")}>
            <Avatar className={cn("h-20 w-20 border-2", colors.border)}>
              <AvatarImage src={displayAvatar || undefined} />
              <AvatarFallback className={cn(colors.bg, "text-white text-2xl")}>
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isPlaceholder && (
              <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center">
                <HelpCircle className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
          <div className="text-center max-w-[120px]">
            <p className="font-semibold text-sm text-foreground truncate">{displayName}</p>
            {showLabel && isOwner && (
              <p className="text-xs text-muted-foreground truncate">
                {getRelationLabel(member.relation_type)}
              </p>
            )}
          </div>
        </button>
      </div>
    );
  };

  const renderCurrentUser = () => {
    const colors = getGenderColors(userGender);
    const currentUserSpouse = spouses[0];
    const secondSpouse = spouses[1];
    
    // Determine spouse gender for add button (opposite of user's gender)
    const spouseGender: 'male' | 'female' = userGender === 'male' ? 'female' : 'male';
    
    return (
      <div className="flex items-center gap-6">
        {/* Second spouse on left */}
        {secondSpouse && (
          <>
            <div ref={(el) => setMemberRef(secondSpouse.id, el)}>
              {renderSingleMember(secondSpouse, false, 0, 0, 0, 0)}
            </div>
            {renderHeartConnector('current-user')}
          </>
        )}

        {/* Current user */}
        <div className="flex flex-col items-center gap-3">
          <div className={cn("rounded-full p-1.5", colors.ring, "ring-4")}>
            <Avatar className={cn("h-24 w-24 border-3", colors.border)}>
              <AvatarImage src={currentUser?.avatar_url} />
              <AvatarFallback className={cn(colors.bg, "text-white text-2xl")}>
                {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : <UserIcon className="h-10 w-10" />}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="text-center">
            <p className="font-bold text-base text-foreground">{currentUser?.full_name || 'Siz'}</p>
            <p className="text-xs text-muted-foreground">Siz</p>
          </div>

          {/* Add spouse button for current user */}
          {isOwner && spouses.length === 0 && (
            <button
              onClick={onAddRelative}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                spouseGender === 'male' ? 'bg-sky-500 hover:bg-sky-600' : 'bg-pink-500 hover:bg-pink-600',
                "text-white shadow-sm"
              )}
              title="Juft qo'shish"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          
          {/* Second spouse dropdown for current user */}
          {isOwner && spouses.length === 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-all text-muted-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onClick={onAddRelative}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ikkinchi juft qo'shish
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* First spouse on right */}
        {currentUserSpouse && (
          <>
            {renderHeartConnector('current-user')}
            <div ref={(el) => setMemberRef(currentUserSpouse.id, el)}>
              {renderSingleMember(currentUserSpouse, false, 0, 0, 0, 0)}
            </div>
          </>
        )}
      </div>
    );
  };

  // Filter out members that are shown as spouses/children of other members
  // IMPORTANT: We need to find all "root" members that should start their own tree
  // A "root" member is one that:
  // 1. Is not a spouse of someone else (spouse_of_X)
  // 2. Is not a child of someone else (child_of_X)
  // 3. Is a parent (father_of_X, mother_of_X) - these are roots for their tree
  // 4. Legacy types like father, mother, brother, etc.
  
  // Build a set of all member IDs that will be rendered via renderParentsChain or renderMemberWithSpouses
  // to avoid duplicate rendering
  const buildRenderedMemberIds = (): Set<string> => {
    const rendered = new Set<string>();
    
    // Helper: recursively mark all ancestors of a member
    const markAncestors = (memberId: string, visited: Set<string> = new Set()) => {
      if (visited.has(memberId)) return;
      visited.add(memberId);
      
      const father = members.find(m => m.relation_type === `father_of_${memberId}`);
      const mother = members.find(m => m.relation_type === `mother_of_${memberId}`);
      
      if (father) {
        rendered.add(father.id);
        // Father's spouse (mother or otherwise)
        const fatherSpouse = members.find(m => m.relation_type === `spouse_of_${father.id}`);
        if (fatherSpouse) rendered.add(fatherSpouse.id);
        markAncestors(father.id, visited);
      }
      if (mother) {
        rendered.add(mother.id);
        // Mother's spouse (father or otherwise)
        const motherSpouse = members.find(m => m.relation_type === `spouse_of_${mother.id}`);
        if (motherSpouse) rendered.add(motherSpouse.id);
        markAncestors(mother.id, visited);
      }
    };
    
    // Helper: recursively mark all descendants of a member
    const markDescendants = (memberId: string, visited: Set<string> = new Set()) => {
      if (visited.has(memberId)) return;
      visited.add(memberId);
      
      const memberChildren = members.filter(m => m.relation_type.startsWith(`child_of_${memberId}`));
      memberChildren.forEach(child => {
        rendered.add(child.id);
        // Child's spouse
        const childSpouse = members.find(m => m.relation_type === `spouse_of_${child.id}`);
        if (childSpouse) rendered.add(childSpouse.id);
        markDescendants(child.id, visited);
      });
    };
    
    // Start from "self" - current user
    // Mark legacy parents (father, mother)
    const legacyFather = members.find(m => m.relation_type === 'father');
    const legacyMother = members.find(m => m.relation_type === 'mother');
    if (legacyFather) {
      rendered.add(legacyFather.id);
      markAncestors(legacyFather.id);
    }
    if (legacyMother) {
      rendered.add(legacyMother.id);
      markAncestors(legacyMother.id);
    }
    
    // Mark dynamic parents of "self" (if any - though unlikely with current ID system)
    markAncestors('self');
    
    // Mark siblings
    siblings.forEach(s => rendered.add(s.id));
    
    // Mark spouses (legacy types)
    spouses.forEach(s => rendered.add(s.id));
    
    // Mark legacy children (non-dynamic)
    children.filter(c => !c.relation_type.includes('_of_')).forEach(child => {
      rendered.add(child.id);
      markDescendants(child.id);
    });
    
    // Now process all root members that have already been marked
    // and mark their entire trees
    members.forEach(m => {
      if (rendered.has(m.id)) {
        markAncestors(m.id);
        markDescendants(m.id);
        // Also mark spouse
        const spouse = members.find(sp => sp.relation_type === `spouse_of_${m.id}`);
        if (spouse) rendered.add(spouse.id);
      }
    });
    
    return rendered;
  };
  
  // Get members that are already rendered through the main tree
  const renderedViaMainTree = buildRenderedMemberIds();
  
  // Find orphan members that need their own tree (not connected to main tree)
  const findOrphanRoots = (): FamilyMember[] => {
    const roots: FamilyMember[] = [];
    const processedIds = new Set<string>();
    
    // For each unrendered member, find its tree root
    const findTreeRoot = (member: FamilyMember, visited: Set<string> = new Set()): FamilyMember => {
      if (visited.has(member.id)) return member;
      visited.add(member.id);
      
      // If spouse, go to partner
      if (member.relation_type.includes('spouse_of_')) {
        const match = member.relation_type.match(/^spouse(?:_2)?_of_(.+)$/);
        if (match) {
          const partner = members.find(m => m.id === match[1]);
          if (partner) return findTreeRoot(partner, visited);
        }
      }
      
      // If child, go to parent
      if (member.relation_type.startsWith('child_of_')) {
        const match = member.relation_type.match(/^child_of_(.+?)(?:_\d+)?$/);
        if (match) {
          const parent = members.find(m => m.id === match[1]);
          if (parent) return findTreeRoot(parent, visited);
        }
      }
      
      // Check if this member has parents above
      const myFather = members.find(m => m.relation_type === `father_of_${member.id}`);
      const myMother = members.find(m => m.relation_type === `mother_of_${member.id}`);
      
      if (myFather) return findTreeRoot(myFather, visited);
      if (myMother) return findTreeRoot(myMother, visited);
      
      return member;
    };
    
    members.forEach(member => {
      // Skip if already rendered in main tree
      if (renderedViaMainTree.has(member.id)) return;
      
      const root = findTreeRoot(member);
      if (!processedIds.has(root.id) && !renderedViaMainTree.has(root.id)) {
        roots.push(root);
        processedIds.add(root.id);
      }
    });
    
    return roots;
  };
  
  // Get orphan root members
  const orphanRoots = findOrphanRoots();
  
  // Separate orphan members by type for structured rendering
  const orphanParentRoots = orphanRoots.filter(m => 
    m.relation_type.startsWith('father_of_') || 
    m.relation_type.startsWith('mother_of_')
  );
  const orphanOtherRoots = orphanRoots.filter(m => 
    !m.relation_type.startsWith('father_of_') && 
    !m.relation_type.startsWith('mother_of_')
  );
  
  const topLevelMembers = [...grandparents, ...parents.filter(p => !p.relation_type.includes('_of_')), ...siblings, ...children.filter(c => !c.relation_type.includes('_of_')), ...others];
  
  return (
    <div 
      ref={containerRef} 
      className="relative min-h-[80vh] overflow-hidden touch-none select-none"
      {...zoomPanHandlers}
    >
      {/* Zoom controls - fixed position */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-border/50">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={zoomIn}
          title="Yaqinlashtirish"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={zoomOut}
          title="Uzoqlashtirish"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
        <div className="h-px bg-border/50" />
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={resetZoom}
          title="Markazga qaytish"
        >
          <RotateCcw className="h-5 w-5" />
        </Button>
        <div className="h-px bg-border/50" />
        {/* AI Toggle */}
        <Button
          variant={useAI ? "default" : "ghost"}
          size="icon"
          className={cn("h-10 w-10 text-xs font-bold", useAI && "bg-primary text-primary-foreground")}
          onClick={() => {
            setUseAI(!useAI);
            setTimeout(recalculate, 100);
          }}
          title={useAI ? "AI chizish yoqilgan" : "AI chizish o'chirilgan"}
        >
          AI
        </Button>
        {isCalculating && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
        )}
        <span className="text-[10px] text-center text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
      </div>

      {/* Zoomable/Pannable container - no width constraints for horizontal spread */}
      <div
        ref={zoomContainerRef}
        className="min-w-max min-h-[80vh] flex flex-col items-center py-12 origin-center transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          willChange: 'transform',
        }}
      >
        {/* SVG Connection Lines */}
        <FamilyConnectorLines 
          key={renderKey}
          containerRef={zoomContainerRef} 
          connections={connections} 
        />

        {/* Dotted background pattern for chess-like feel */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 min-w-max space-y-16 px-16">
          {/* Current user with full parent chain above and children below */}
          <div className="flex flex-col items-center gap-8">
            {/* Parents chain of current user (recursive upward) */}
            {currentUser && renderParentsChain('self', true)}
            
            {/* Current user + spouse + siblings row */}
            <div className="flex items-start justify-center gap-20">
              {/* Siblings on left */}
              {siblings.length > 0 && (
                <div className="flex gap-16 items-start">
                  {siblings.map(sibling => (
                    <div key={sibling.id}>
                      {renderMemberWithSpouses(sibling, true, true)}
                    </div>
                  ))}
                </div>
              )}

              {/* Current user with spouse(s) in center */}
              {renderCurrentUser()}
            </div>

            {/* Children of current user (direct, not dynamic) */}
            {children.filter(c => !c.relation_type.includes('_of_')).length > 0 && (
              <div className="flex justify-center gap-20">
                {children.filter(c => !c.relation_type.includes('_of_')).map(child => (
                  <div key={child.id}>
                    {renderMemberWithSpouses(child, true, true)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Orphan parent roots - parents of disconnected trees */}
          {orphanParentRoots.length > 0 && (
            <div className="flex justify-center gap-20 mt-16">
              {orphanParentRoots.map(parent => (
                <div key={parent.id}>
                  {renderMemberWithSpouses(parent, true, true)}
                </div>
              ))}
            </div>
          )}

          {/* Orphan other roots - other disconnected members */}
          {orphanOtherRoots.length > 0 && (
            <div className="flex justify-center gap-20 mt-16">
              {orphanOtherRoots.map(member => (
                <div key={member.id}>
                  {renderMemberWithSpouses(member, true, true)}
                </div>
              ))}
            </div>
          )}

          {/* Legacy others */}
          {others.filter(o => !renderedViaMainTree.has(o.id)).length > 0 && (
            <div className="flex justify-center gap-20 mt-16">
              {others.filter(o => !renderedViaMainTree.has(o.id)).map(other => (
                <div key={other.id}>
                  {renderMemberWithSpouses(other, true, true)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add relative floating button - only show for owner */}
      {isOwner && (
        <button
          onClick={onAddRelative}
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg flex items-center justify-center transition-colors z-50"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Member card dialog */}
      <MemberCardDialog
        open={memberCardOpen}
        onOpenChange={setMemberCardOpen}
        member={selectedMember}
        isOwner={isOwner}
        onSendInvitation={handleSendInvitation}
        onDelete={handleDeleteMember}
        onAddSpouse={(isSecond) => {
          if (selectedMember) {
            handleAddSpouse(selectedMember, isSecond);
            setMemberCardOpen(false);
          }
        }}
        onAddChild={() => {
          if (selectedMember) {
            handleAddChild(selectedMember);
            setMemberCardOpen(false);
          }
        }}
        onAddFather={() => {
          if (selectedMember) {
            handleAddFather(selectedMember);
            setMemberCardOpen(false);
          }
        }}
        onAddMother={() => {
          if (selectedMember) {
            handleAddMother(selectedMember);
            setMemberCardOpen(false);
          }
        }}
        spouseCount={selectedMember ? (countSpousesForMember ? countSpousesForMember(selectedMember.id) : 0) : 0}
        childCount={selectedMember ? (countChildrenForMember ? countChildrenForMember(selectedMember.id) : 0) : 0}
        fatherCount={selectedMember ? (countFathersForMember ? countFathersForMember(selectedMember.id) : 0) : 0}
        motherCount={selectedMember ? (countMothersForMember ? countMothersForMember(selectedMember.id) : 0) : 0}
        members={members}
      />

      {/* Send invitation dialog */}
      <SendInvitationDialog
        open={sendInvitationOpen}
        onOpenChange={setSendInvitationOpen}
        onSelectUser={handleSelectUser}
      />

      {/* Add spouse dialog */}
      <AddSpouseDialog
        open={addSpouseDialogOpen}
        onOpenChange={setAddSpouseDialogOpen}
        targetMember={spouseTargetMember}
        isSecondSpouse={isSecondSpouse}
        onAddSpouse={handleSpouseAdded}
      />

      {/* Add child dialog */}
      <AddFamilyMemberDialog
        open={addChildDialogOpen}
        onOpenChange={setAddChildDialogOpen}
        title="Farzand qo'shish"
        showGenderSelect={true}
        onAdd={handleChildAdded}
      />

      {/* Add father dialog */}
      <AddFamilyMemberDialog
        open={addFatherDialogOpen}
        onOpenChange={setAddFatherDialogOpen}
        title="Ota qo'shish"
        gender="male"
        onAdd={handleFatherAdded}
      />

      {/* Add mother dialog */}
      <AddFamilyMemberDialog
        open={addMotherDialogOpen}
        onOpenChange={setAddMotherDialogOpen}
        title="Ona qo'shish"
        gender="female"
        onAdd={handleMotherAdded}
      />
    </div>
  );
};
