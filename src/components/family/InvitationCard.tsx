import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FamilyInvitation, FamilyMember } from '@/hooks/useFamilyTree';
import { FamilyTreePreview } from './FamilyTreePreview';
import { Check, X, Maximize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

interface InvitationCardProps {
  invitation: FamilyInvitation;
  onAccept: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export const InvitationCard = ({
  invitation,
  onAccept,
  onReject,
  isLoading,
}: InvitationCardProps) => {
  const [showTree, setShowTree] = useState(false);
  const [senderMembers, setSenderMembers] = useState<FamilyMember[]>([]);
  const [senderProfile, setSenderProfile] = useState<{
    id: string;
    full_name: string;
    avatar_url: string;
    gender?: 'male' | 'female' | null;
  } | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);

  const fetchSenderFamilyTree = async () => {
    if (!invitation.sender_id || senderMembers.length > 0) return;
    
    setLoadingTree(true);
    try {
      // Fetch sender's family members
      const { data: membersData } = await supabase
        .from('family_tree_members')
        .select('*')
        .eq('owner_id', invitation.sender_id)
        .order('created_at', { ascending: true });

      // Fetch sender's profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, gender')
        .eq('id', invitation.sender_id)
        .single();

      if (membersData) {
        setSenderMembers(membersData.map(m => ({
          ...m,
          gender: m.gender as 'male' | 'female' | null,
          linked_profile: null
        })));
      }

      if (profileData) {
        setSenderProfile({
          id: profileData.id,
          full_name: profileData.name || '',
          avatar_url: profileData.avatar_url || '',
          gender: profileData.gender as 'male' | 'female' | null,
        });
      }
    } catch (error) {
      console.error('Error fetching sender family tree:', error);
    } finally {
      setLoadingTree(false);
    }
  };

  const handleToggleTree = () => {
    if (!showTree) {
      fetchSenderFamilyTree();
    }
    setShowTree(!showTree);
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={invitation.sender_profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {invitation.sender_profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {invitation.sender_profile?.name || 'Foydalanuvchi'}
            </p>
            <p className="text-sm text-muted-foreground">
              Sizni <span className="font-medium text-foreground">
                {relationLabels[invitation.relation_type] || invitation.relation_type}
              </span> sifatida oila daraxtiga taklif qilmoqda
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={handleToggleTree}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Family tree preview */}
        {showTree && (
          <div className="mt-4 border-t pt-4">
            {loadingTree ? (
              <div className="text-center py-4 text-muted-foreground">
                Yuklanmoqda...
              </div>
            ) : (
              <FamilyTreePreview
                members={senderMembers}
                currentUser={senderProfile}
                showFullscreenButton={true}
              />
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-14 rounded-full border-2 border-red-500 hover:bg-red-500/10"
            onClick={onReject}
            disabled={isLoading}
          >
            <X className="h-6 w-6 text-red-500" />
          </Button>
          <Button
            size="lg"
            className="flex-1 h-14 rounded-full border-2 border-green-500 bg-transparent hover:bg-green-500/10"
            onClick={onAccept}
            disabled={isLoading}
          >
            <Check className="h-6 w-6 text-green-500" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
