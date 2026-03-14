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
import { TreePostEditor } from './TreePostEditor';
import { SearchRelativesFlow } from './SearchRelativesFlow';
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
  const [showSearchRelatives, setShowSearchRelatives] = useState(false);

  // New UI states
  const [showHistory, setShowHistory] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
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
  }, [currentPostId, currentPost]);

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
        // Instead of automatically creating self node, show the search relatives flow
        setShowSearchRelatives(true);
      }
    }
  }, [isLoading, user?.id, profile, members]);

  const handleGenderSelect = async (gender: 'male' | 'female') => {
    if (!user?.id || isSelectingGender) return;
    setIsSelectingGender(true);
    try {
      await supabase.from('profiles').update({ gender }).eq('id', user.id);
      await refreshProfile();
      // Wait for the next render to show the search flow
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
    setShowPublish(true);
  };

  const handleConfirmPublish = async (publishOverlays: TreeOverlay[], caption: string, viewport: { x: number; y: number; zoom: number }) => {
    setIsPublishing(true);
    let postId = currentPostId;

    const positionsWithViewport = {
      ...positions,
      __viewport: viewport
    };

    if (!postId) {
      postId = await createTreePost(members, positionsWithViewport);
      if (postId) setCurrentPostId(postId);
    }
    if (!postId) { setIsPublishing(false); return; }
    
    // Also save viewport to existing positions if we already had a postId
    if (postId === currentPostId) {
      updatePosition('__viewport', viewport);
    }

    await saveOverlays(postId, publishOverlays);
    await publishPost(postId, caption);
    setOverlays([]); // Clear overlays from tree view after publish
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

      {/* Show Search Relatives Flow if the tree is empty and user has a gender */}
      {showSearchRelatives && !showGenderSelect && profile?.gender && Object.keys(members).length === 0 && (
        <div className="flex-1 overflow-y-auto">
          <SearchRelativesFlow 
            onCancel={async () => {
              // If they explicitly cancel and want to create a new tree
              await createSelfNode(profile.gender as 'male' | 'female');
              setShowSearchRelatives(false);
            }} 
          />
        </div>
      )}

      {/* Main Tree View */}
      {(!showSearchRelatives || Object.keys(members).length > 0) && (
        <>
          {/* Merge Mode Bar */}
      {isMergeMode && (
        <div className="fixed inset-x-0 top-0 z-50">
          <div className="bg-background/70 backdrop-blur-2xl border-b border-white/10">
            <div className="mx-auto max-w-6xl px-3 sm:px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelMerge}
                    className="h-11 w-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10"
                    aria-label="Yopish"
                    title="Yopish"
                  >
                    <X className="h-5 w-5" />
                  </Button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-emerald-500/25 via-teal-500/20 to-sky-500/25 border border-white/10 flex items-center justify-center shrink-0">
                        <GitMerge className="h-4.5 w-4.5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground leading-tight truncate">Birlashtirish rejimi</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-tight">
                          Tanlandi:
                          <span className="ml-1 inline-flex items-center justify-center min-w-6 h-5 px-2 rounded-full bg-primary/10 text-primary font-bold">
                            {mergeSelectedIds.length}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleOpenManualMergeDialog}
                  disabled={mergeSelectedIds.length < 2 || isMergeProcessing}
                  className="h-11 rounded-2xl px-4 sm:px-5 gap-2 font-bold shadow-lg shadow-emerald-500/15 disabled:opacity-60"
                >
                  <GitMerge className="h-4 w-4" />
                  {isMergeProcessing ? 'Tayyorlanmoqda...' : 'Birlashtirish'}
                </Button>
              </div>
            </div>
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
          memberCount={Object.keys(members || {}).length}
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

      {/* Tree Post Editor (fullscreen publish flow) */}
      <TreePostEditor
        isOpen={showPublish}
        onClose={() => setShowPublish(false)}
        members={members}
        positions={positions}
        initialOverlays={overlays}
        onPublish={handleConfirmPublish}
        isPublishing={isPublishing}
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
        </>
      )}
    </section>
  );
};
