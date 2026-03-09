import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FamilyMember } from '@/hooks/useFamilyTree';
import { FamilyTreePreview } from './FamilyTreePreview';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SelectMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: FamilyMember[];
  onSelectMember: (member: FamilyMember) => void;
  onCreateNew: () => void;
  targetUserName: string;
}

export const SelectMemberDialog = ({
  open,
  onOpenChange,
  members,
  onSelectMember,
  onCreateNew,
  targetUserName,
}: SelectMemberDialogProps) => {
  const { user, profile } = useAuth();
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [userGender, setUserGender] = useState<'male' | 'female' | null>(null);

  // Fetch user's gender
  useEffect(() => {
    const fetchGender = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', user.id)
          .single();
        
        if (data?.gender) {
          setUserGender(data.gender as 'male' | 'female');
        }
      }
    };
    
    if (open) {
      fetchGender();
    }
  }, [user?.id, open]);

  // Filter only placeholder members (not linked to any user)
  const placeholderMembers = members.filter(m => m.is_placeholder);

  const handleMemberSelect = (member: FamilyMember) => {
    setSelectedMember(member);
  };

  const handleConfirm = () => {
    if (selectedMember) {
      onSelectMember(selectedMember);
      setSelectedMember(null);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedMember(null);
    }
    onOpenChange(isOpen);
  };

  const currentUserForTree = profile ? {
    id: user?.id || '',
    full_name: profile.name || '',
    avatar_url: profile.avatar_url || '',
    gender: userGender,
  } : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {targetUserName} uchun profil tanlang
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {placeholderMembers.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                Oila daraxtingizda bo'sh profil yo'q
              </p>
              <Button onClick={onCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Yangi profil yaratish
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Oila daraxtidan bo'sh profilni tanlang (sariq belgi bilan ko'rsatilgan)
              </p>
              
              <FamilyTreePreview
                members={members}
                currentUser={currentUserForTree}
                selectedMemberId={selectedMember?.id}
                onSelectMember={handleMemberSelect}
                selectable={true}
              />
            </>
          )}

          {placeholderMembers.length > 0 && (
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onCreateNew}
              >
                <Plus className="h-4 w-4 mr-2" />
                Yangi yaratish
              </Button>
              <Button
                className="flex-1"
                disabled={!selectedMember}
                onClick={handleConfirm}
              >
                Taklif qilish
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
