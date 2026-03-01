import { useEffect, useState, useCallback } from 'react';
import { TreeDeciduous, X, GitMerge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FamilyTreeCanvas } from './FamilyTreeCanvas';
import { AddMemberModal } from './AddMemberModal';
import { ProfileModal } from './ProfileModal';
import { SendInvitationModal } from './SendInvitationModal';
import { GenderSelectionModal } from './GenderSelectionModal';
import { UnifiedMergeDialog } from './UnifiedMergeDialog';
import { TreePostHeader } from './TreePostHeader';
import { TreeHistoryDrawer } from './TreeHistoryDrawer';
import { TreeOverlayLayer } from './TreeOverlayLayer';
import { TreePublishDialog } from './TreePublishDialog';
import { TreeFullscreenView } from './TreeFullscreenView';
import { useLocalFamilyTree } from '@/hooks/useLocalFamilyTree';
import { useFamilyInvitations, MergeDialogData } from '@/hooks/useFamilyInvitations';
import { useMergeMode } from '@/hooks/useMergeMode';
import { useSpouseLock } from '@/hooks/useSpouseLock';
import { useTreePosts, TreeOverlay } from '@/hooks/useTreePosts';
import { FamilyMember, AddMemberData } from '@/types/family';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { FamilyInvitationItem } from './FamilyInvitationItem';
import { toast } from 'sonner';

type ModalState = {
  type: 'none' | 'addParentFather' | 'addParentMother' | 'addSpouse' | 'addChild' | 'profile' | 'invitation' | 'genderSelect';
  targetId?: string;
  member?: FamilyMember;
  fatherData?: AddMemberData;
};

export const FamilyTreeV2 = () => {
  const { user, profile, refreshProfile } = useAuth();
  const {
    members, rootId, isLoading,
    addInitialCouple, addParents, addSpouse, addChild,
    updateMember, updatePosition, removeMember, createSelfNode
  } = useLocalFamilyTree();

  const {
    pendingInvitations, acceptInvitation, rejectInvitation,
    showMergeDialog, setShowMergeDialog, mergeData, setMergeData,
    executeMerge: executeTreeMerge, closeMergeDialog, isMerging
  } = useFamilyInvitations();

  const {
    isActive: isMergeMode, selectedIds: mergeSelectedIds, mergedProfiles,
    isProcessing: isMergeProcessing, startMergeMode,
    toggleSelection: toggleMergeSelection, cancelMerge, computeMergeData
  } = useMergeMode(members);

  const { isPairLocked, toggleLock } = useSpouseLock();

  // Tree posts
  const {
    posts: treePosts, currentPost, currentPostId, setCurrentPostId,
    createTreePost, saveOverlays, publishPost, deletePost
  } = useTreePosts();

  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [showGenderSelect, setShowGenderSelect] = useState(false);
  const [processingInvitation, setProcessingInvitation] = useState<string | null>(null);
  const [isSelectingGender, setIsSelectingGender] = useState(false);

  // New UI states
  const [showHistory, setShowHistory] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [overlays, setOverlays] = useState<TreeOverlay[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Load overlays when current post changes
  useEffect(() => {
    if (currentPost) {
      setOverlays(currentPost.overlays || []);
    } else {
      setOverlays([]);
    }
  }, [currentPostId]);

  // Build positions map from members
  const positions = Object.fromEntries(
    Object.values(members).filter((m) => m.position).map((m) => [m.id, m.position!])
  );

  // Check if user needs to select gender on first visit
  useEffect(() => {
    if (!isLoading && user?.id && profile) {
      if (!profile.gender) {
        setShowGenderSelect(true);
      } else if (Object.keys(members).length === 0) {
        createSelfNode(profile.gender as 'male' | 'female');
      }
    }
  }, [isLoading, user?.id, profile?.gender, Object.keys(members).length]);

  const handleGenderSelect = async (gender: 'male' | 'female') => {
    if (!user?.id || isSelectingGender) return;
    setIsSelectingGender(true);
    try {
      await supabase.from('profiles').update({ gender }).eq('id', user.id);
      await refreshProfile();
      await createSelfNode(gender);
      setShowGenderSelect(false);
    } catch (error) {
      console.error('Error setting gender:', error);
    } finally {
      setIsSelectingGender(false);
    }
  };

  // Modal handlers
  const handleAddParents = useCallback((id: string) => setModal({ type: 'addParentFather', targetId: id }), []);
  const handleAddSpouse = useCallback((id: string) => setModal({ type: 'addSpouse', targetId: id }), []);
  const handleAddChild = useCallback((id: string) => setModal({ type: 'addChild', targetId: id }), []);
  const handleOpenProfile = useCallback((member: FamilyMember) => setModal({ type: 'profile', member }), []);
  const handleSendInvitation = useCallback((member: FamilyMember) => setModal({ type: 'invitation', member }), []);
  const handleCloseModal = () => setModal({ type: 'none' });

  const handleSaveFather = (data: AddMemberData) => {
    setModal({ type: 'addParentMother', targetId: modal.targetId, fatherData: data });
  };
  const handleSaveMother = (motherData: AddMemberData) => {
    if (modal.targetId && modal.fatherData) addParents(modal.targetId, modal.fatherData, motherData);
    handleCloseModal();
  };
  const handleSaveSpouse = (data: AddMemberData) => {
    if (modal.targetId) {
      const member = members[modal.targetId];
      const spouseGender = member?.gender === 'male' ? 'female' : 'male';
      addSpouse(modal.targetId, { ...data, gender: spouseGender });
    }
    handleCloseModal();
  };
  const handleSaveChild = (data: AddMemberData) => {
    if (modal.targetId) addChild(modal.targetId, data);
    handleCloseModal();
  };

  const handlePositionChange = useCallback((memberId: string, x: number, y: number) => {
    updatePosition(memberId, { x, y });
  }, [updatePosition]);

  // Merge mode handlers
  const handleLongPress = useCallback((memberId: string) => startMergeMode(memberId), [startMergeMode]);
  const handleToggleMergeSelect = useCallback((memberId: string) => toggleMergeSelection(memberId), [toggleMergeSelection]);

  const handleOpenManualMergeDialog = useCallback(() => {
    const data = computeMergeData();
    if (data) { setMergeData(data); setShowMergeDialog(true); }
  }, [computeMergeData, setMergeData, setShowMergeDialog]);

  const handleAcceptInvitation = async (invitation: any) => {
    setProcessingInvitation(invitation.id);
    await acceptInvitation(invitation);
    setProcessingInvitation(null);
  };
  const handleRejectInvitation = async (invitation: any) => {
    setProcessingInvitation(invitation.id);
    await rejectInvitation(invitation);
    setProcessingInvitation(null);
  };

  // Tree post handlers
  const handleCreateNewTree = async () => {
    const id = await createTreePost(members, positions);
    if (id) setCurrentPostId(id);
  };

  const handleSaveTree = async () => {
    if (!currentPostId) {
      // Auto-create if no current post
      const id = await createTreePost(members, positions);
      if (id) {
        setCurrentPostId(id);
        await saveOverlays(id, overlays);
      }
      return;
    }
    setIsSaving(true);
    await saveOverlays(currentPostId, overlays);
    toast.success('Saqlandi');
    setIsSaving(false);
  };

  const handlePublish = () => {
    if (!currentPostId) {
      // Create first then show publish
      handleCreateNewTree().then(() => setShowPublish(true));
    } else {
      setShowPublish(true);
    }
  };

  const handleConfirmPublish = async (caption: string) => {
    if (!currentPostId) return;
    setIsPublishing(true);
    await saveOverlays(currentPostId, overlays);
    await publishPost(currentPostId, caption);
    setIsPublishing(false);
    setShowPublish(false);
  };

  // Overlay handlers
  const handleAddSticker = (emoji: string) => {
    const newOverlay: TreeOverlay = {
      id: crypto.randomUUID(),
      type: 'sticker',
      content: emoji,
      x: 150 + Math.random() * 100,
      y: 200 + Math.random() * 100,
      scale: 1,
      rotation: 0,
    };
    setOverlays(prev => [...prev, newOverlay]);
  };

  const handleAddText = () => {
    const text = prompt('Matn kiriting:');
    if (!text) return;
    const newOverlay: TreeOverlay = {
      id: crypto.randomUUID(),
      type: 'text',
      content: text,
      x: 100 + Math.random() * 100,
      y: 200 + Math.random() * 100,
      scale: 1,
      rotation: 0,
      fontSize: 16,
    };
    setOverlays(prev => [...prev, newOverlay]);
  };

  const handleAddImage = (url: string) => {
    const newOverlay: TreeOverlay = {
      id: crypto.randomUUID(),
      type: 'image',
      content: url,
      x: 120 + Math.random() * 80,
      y: 200 + Math.random() * 80,
      scale: 1,
      rotation: 0,
    };
    setOverlays(prev => [...prev, newOverlay]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <TreeDeciduous className="w-12 h-12 mx-auto text-primary animate-pulse" />
          <p className="mt-4 text-muted-foreground">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-screen flex flex-col">
      <GenderSelectionModal isOpen={showGenderSelect} onSelect={handleGenderSelect} disabled={isSelectingGender} />

      {/* Merge Mode Bar */}
      {isMergeMode && (
        <div className="fixed inset-x-0 top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border shadow-lg">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={cancelMerge}><X className="h-5 w-5" /></Button>
              <div>
                <h3 className="font-semibold text-foreground">Birlashtirish rejimi</h3>
                <p className="text-sm text-muted-foreground">{mergeSelectedIds.length} ta profil tanlandi</p>
              </div>
            </div>
            <Button onClick={handleOpenManualMergeDialog} disabled={mergeSelectedIds.length < 2 || isMergeProcessing} className="gap-2">
              <GitMerge className="h-4 w-4" /> Birlashtirish
            </Button>
          </div>
        </div>
      )}

      {/* Tree Post Header */}
      {!isMergeMode && (
        <TreePostHeader
          onOpenHistory={() => setShowHistory(true)}
          onCreateNew={handleCreateNewTree}
          onSave={handleSaveTree}
          onPublish={handlePublish}
          onFullscreen={() => setShowFullscreen(true)}
          onAddSticker={handleAddSticker}
          onAddText={handleAddText}
          onAddImage={handleAddImage}
          isSaving={isSaving}
          hasCurrentPost={!!currentPostId}
        />
      )}

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="mx-2 mt-2 rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <p className="text-sm font-medium">{pendingInvitations.length} ta taklifnoma kutmoqda</p>
          </div>
          <div className="divide-y divide-border">
            {pendingInvitations.map((inv) => (
              <FamilyInvitationItem
                key={inv.id}
                invitation={inv}
                onAccept={handleAcceptInvitation}
                onReject={handleRejectInvitation}
                isProcessing={processingInvitation === inv.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Canvas with overlays */}
      <div className={cn("flex-1 relative", isMergeMode && "pt-16")}>
        <div className="h-[calc(100vh-110px)] min-h-[500px]">
          <FamilyTreeCanvas
            members={members}
            positions={positions}
            onOpenProfile={handleOpenProfile}
            onPositionChange={handlePositionChange}
            isMergeMode={isMergeMode}
            mergeSelectedIds={mergeSelectedIds}
            mergedProfiles={mergedProfiles}
            onLongPress={handleLongPress}
            onToggleMergeSelect={handleToggleMergeSelect}
            isPairLocked={isPairLocked}
          />
          {/* Overlay layer */}
          <TreeOverlayLayer overlays={overlays} onChange={setOverlays} editable={true} />
        </div>
      </div>

      {/* History Drawer */}
      <TreeHistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        posts={treePosts}
        currentPostId={currentPostId}
        onSelect={setCurrentPostId}
        onDelete={deletePost}
      />

      {/* Publish Dialog */}
      <TreePublishDialog
        isOpen={showPublish}
        onClose={() => setShowPublish(false)}
        onPublish={handleConfirmPublish}
        isPublishing={isPublishing}
        title={currentPost?.title}
      />

      {/* Fullscreen View */}
      <TreeFullscreenView
        isOpen={showFullscreen}
        onClose={() => setShowFullscreen(false)}
        members={members}
        positions={positions}
        overlays={overlays}
        caption={currentPost?.caption}
      />

      {/* Modals */}
      <AddMemberModal isOpen={modal.type === 'addParentFather'} onClose={handleCloseModal} onSave={handleSaveFather} type="parents" gender="male" title="Ota ma'lumotlari" showNextPrompt nextPromptText="Saqlangandan so'ng ona uchun ham ma'lumot kiritasiz" />
      <AddMemberModal isOpen={modal.type === 'addParentMother'} onClose={handleCloseModal} onSave={handleSaveMother} type="parents" gender="female" title="Ona ma'lumotlari" />
      <AddMemberModal isOpen={modal.type === 'addSpouse'} onClose={handleCloseModal} onSave={handleSaveSpouse} type="spouse" gender={members[modal.targetId || '']?.gender === 'male' ? 'female' : 'male'} title="Juft ma'lumotlari" />
      <AddMemberModal isOpen={modal.type === 'addChild'} onClose={handleCloseModal} onSave={handleSaveChild} type="child" gender="male" title="Farzand ma'lumotlari" />

      {modal.member && (
        <ProfileModal
          isOpen={modal.type === 'profile'} onClose={handleCloseModal} member={modal.member}
          onUpdate={updateMember} onDelete={removeMember} onAddParents={handleAddParents}
          onAddSpouse={handleAddSpouse} onAddChild={handleAddChild} onSendInvitation={handleSendInvitation}
          hasParents={(modal.member.parentIds?.length || 0) > 0} hasSpouse={!!modal.member.spouseId}
          canAddChild={!!modal.member.spouseId}
          isSpouseLocked={isPairLocked(modal.member.id, modal.member.spouseId)}
          onToggleSpouseLock={() => toggleLock(modal.member!.id, modal.member!.spouseId)}
        />
      )}

      <SendInvitationModal isOpen={modal.type === 'invitation'} onClose={handleCloseModal} member={modal.member || null} />

      {mergeData !== null && (
        <UnifiedMergeDialog isOpen={showMergeDialog} onClose={closeMergeDialog} data={mergeData} onConfirm={executeTreeMerge} isProcessing={isMerging} />
      )}
    </section>
  );
};
