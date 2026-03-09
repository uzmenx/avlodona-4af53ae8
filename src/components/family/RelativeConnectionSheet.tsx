import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, X } from 'lucide-react';
import { FamilyTreeCanvas } from '@/components/family-v2/FamilyTreeCanvas';
import { useOtherUserTree } from '@/hooks/useOtherUserTree';
import { useLocalFamilyTree } from '@/hooks/useLocalFamilyTree';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FamilyMember } from '@/types/family';

interface RelativeConnectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string | undefined;
  targetUserName: string;
}

export const RelativeConnectionSheet = ({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
}: RelativeConnectionSheetProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'their' | 'mine'>('their');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedFromTab, setSelectedFromTab] = useState<'their' | 'mine' | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Load target user's tree
  const {
    members: theirMembers,
    positions: theirPositions,
    isLoading: theirLoading,
  } = useOtherUserTree(open ? targetUserId : undefined);

  // Current user's tree
  const {
    members: myMembers,
    isLoading: myLoading,
  } = useLocalFamilyTree();

  // Build positions from myMembers
  const myPositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    Object.values(myMembers).forEach((m) => {
      if (m.position) pos[m.id] = m.position;
    });
    return pos;
  }, [myMembers]);

  const selectedMember = useMemo(() => {
    if (!selectedNodeId) return null;
    if (selectedFromTab === 'their') return theirMembers[selectedNodeId] || null;
    if (selectedFromTab === 'mine') return myMembers[selectedNodeId] || null;
    return null;
  }, [selectedNodeId, selectedFromTab, theirMembers, myMembers]);

  const handleNodeSelect = (member: FamilyMember, fromTab: 'their' | 'mine') => {
    if (selectedNodeId === member.id && selectedFromTab === fromTab) {
      setSelectedNodeId(null);
      setSelectedFromTab(null);
    } else {
      setSelectedNodeId(member.id);
      setSelectedFromTab(fromTab);
    }
  };

  const handleConnect = async () => {
    if (!user?.id || !targetUserId || !selectedNodeId || isSending) return;

    setIsSending(true);
    try {
      const memberId = selectedNodeId;

      // Check if invitation already exists
      const { data: existing } = await supabase
        .from('family_invitations')
        .select('id')
        .eq('sender_id', user.id)
        .eq('receiver_id', targetUserId)
        .eq('member_id', memberId)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        toast({ title: "Bu a'zo uchun allaqachon so'rov yuborilgan", variant: 'destructive' });
        setIsSending(false);
        return;
      }

      // Send family invitation (same as existing flow)
      await supabase.from('family_invitations').insert({
        sender_id: user.id,
        receiver_id: targetUserId,
        member_id: memberId,
        relation_type: 'family_member',
      });

      // Notify
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        actor_id: user.id,
        type: 'family_invitation',
      });

      toast({
        title: "So'rov yuborildi!",
        description: `${targetUserName} ga qo'shilish so'rovi yuborildi`,
      });

      setSelectedNodeId(null);
      setSelectedFromTab(null);
      onOpenChange(false);
    } catch (err) {
      console.error('Error sending connection request:', err);
      toast({ title: 'Xatolik', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSelectedNodeId(null);
    setSelectedFromTab(null);
    onOpenChange(false);
  };

  const theirMemberCount = Object.keys(theirMembers).length;
  const myMemberCount = Object.keys(myMembers).length;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="p-0 rounded-t-2xl border-t border-border bg-background/95 backdrop-blur-xl flex flex-col"
        style={{ height: '85vh' }}
      >
        <SheetHeader className="px-4 pt-4 pb-2 text-left flex-shrink-0">
          <SheetTitle className="text-base font-extrabold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Qarindosh qo'shish
          </SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'their' | 'mine')}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="mx-4 mb-2 flex-shrink-0">
            <TabsTrigger value="their" className="flex-1 text-xs">
              {targetUserName} daraxti ({theirMemberCount})
            </TabsTrigger>
            <TabsTrigger value="mine" className="flex-1 text-xs">
              Sizning daraxtingiz ({myMemberCount})
            </TabsTrigger>
          </TabsList>

          {/* Their tree */}
          <TabsContent value="their" className="flex-1 m-0 min-h-0">
            {theirLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
              </div>
            ) : theirMemberCount === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Bu foydalanuvchining daraxti bo'sh</p>
              </div>
            ) : (
              <div style={{ width: '100%', height: '100%' }}>
                <FamilyTreeCanvas
                  members={theirMembers}
                  positions={theirPositions}
                  onOpenProfile={(m) => handleNodeSelect(m, 'their')}
                  onPositionChange={() => {}}
                  isMergeMode={true}
                  mergeSelectedIds={selectedFromTab === 'their' && selectedNodeId ? [selectedNodeId] : []}
                />
              </div>
            )}
          </TabsContent>

          {/* My tree */}
          <TabsContent value="mine" className="flex-1 m-0 min-h-0">
            {myLoading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
              </div>
            ) : myMemberCount === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Sizning daraxtingiz bo'sh</p>
              </div>
            ) : (
              <div style={{ width: '100%', height: '100%' }}>
                <FamilyTreeCanvas
                  members={myMembers}
                  positions={myPositions}
                  onOpenProfile={(m) => handleNodeSelect(m, 'mine')}
                  onPositionChange={() => {}}
                  isMergeMode={true}
                  mergeSelectedIds={selectedFromTab === 'mine' && selectedNodeId ? [selectedNodeId] : []}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Bottom actions */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-background/95 backdrop-blur-sm">
          {selectedMember ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {selectedMember.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedFromTab === 'their'
                    ? `${targetUserName} daraxtidan tanlandi`
                    : 'Sizning daraxtingizdan tanlandi'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedNodeId(null);
                  setSelectedFromTab(null);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Bekor
              </Button>
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={isSending}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                {isSending ? 'Yuborilmoqda...' : "Qo'shish"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-center text-muted-foreground">
              Daraxtdan profilni tanlang va "Qo'shish" tugmasini bosing
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
