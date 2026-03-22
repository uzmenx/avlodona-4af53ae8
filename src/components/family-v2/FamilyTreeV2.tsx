import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TreeDeciduous, X, GitMerge, Search } from 'lucide-react';
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
import { SearchRelativesFlow, RelativeSearchSheet } from './SearchRelativesFlow';
import { RelativeConnectionSheet } from '@/components/family/RelativeConnectionSheet';
import { useLocalFamilyTree } from '@/hooks/useLocalFamilyTree';
import { useFamilyInvitations, MergeDialogData } from '@/hooks/useFamilyInvitations';
import { useMergeMode } from '@/hooks/useMergeMode';
import { useSpouseLock } from '@/hooks/useSpouseLock';
import { useTreePosts, TreeOverlay } from '@/hooks/useTreePosts';
import { FamilyMember, AddMemberData } from '@/types/family';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { FamilyInvitationItem } from './FamilyInvitationItem';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StarUsername } from '@/components/user/StarUsername';
import { toast } from 'sonner';

interface SearchUser {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

type ModalState = {
  type: 'none' | 'addParentFather' | 'addParentMother' | 'addSpouse' | 'addChild' | 'profile' | 'invitation' | 'genderSelect';
  targetId?: string;
  member?: FamilyMember;
  fatherData?: AddMemberData;
};

export const FamilyTreeV2 = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const {
    members, rootId, isLoading,
    addInitialCouple, addParents, addSpouse, addChild,
    updateMember, updatePosition, removeMember, createSelfNode,
    reorderMergedProfiles, detachNetwork, isSharedNetwork
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

  const [isRelativeSearchOpen, setIsRelativeSearchOpen] = useState(false);
  const [selectedRelativeUserId, setSelectedRelativeUserId] = useState<string | undefined>();
  const [selectedRelativeUserName, setSelectedRelativeUserName] = useState<string>('');
  const [isConnectionSheetOpen, setIsConnectionSheetOpen] = useState(false);

  // New UI states
  const [showHistory, setShowHistory] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [overlays, setOverlays] = useState<TreeOverlay[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Unified Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  const handleRelativeSelect = useCallback((userId: string, userName: string) => {
    setIsRelativeSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedRelativeUserId(userId);
    setSelectedRelativeUserName(userName);
    setTimeout(() => setIsConnectionSheetOpen(true), 250);
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, name, avatar_url')
        .or(`username.ilike.%${q.trim()}%,name.ilike.%${q.trim()}%`)
        .limit(10);
      setSearchResults(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
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

  const handleAcceptInvitation = async (invitation: { id: string; [key: string]: any }) => {
    setProcessingInvitation(invitation.id);
    await acceptInvitation(invitation as any);
    setProcessingInvitation(null);
  };
  const handleRejectInvitation = async (invitation: { id: string; [key: string]: any }) => {
    setProcessingInvitation(invitation.id);
    await rejectInvitation(invitation as any);
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
    const ok = await publishPost(postId, caption);
    if (ok) {
      setOverlays([]); // Clear overlays from tree view after publish
      setCurrentPostId(null); // Return to normal tree view after publish (no Save icon)
    }
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
          onOpenRelativeSearch={() => setIsRelativeSearchOpen(true)}
          onSave={handleSaveTree}
          onPublish={handlePublish}
          memberCount={Object.values(members || {}).reduce((count, m) => count + (m.linkedUserId ? 1 : 0) + (m.mergedProfiles?.filter(mp => !!mp.linkedUserId).length || 0), 0)}
          isSaving={isSaving}
          hasCurrentPost={!!currentPostId}
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          onClearSearch={() => handleSearch('')}
        />
      )}

      {/* Unified Search Results Overlay */}
      {searchQuery.trim() !== '' && (
        <div className="fixed top-[74px] left-1/2 -translate-x-1/2 z-[60] w-[390px] max-w-[calc(100vw-24px)]">
          <div className="mx-auto rounded-2xl border border-white/20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl shadow-black/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Qidiruv natijalari</span>
              {isSearching && <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
            </div>
            
            <div className="max-h-[350px] overflow-y-auto p-2 space-y-2">
              {searchResults.length === 0 && !isSearching ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-medium text-slate-500">Hech narsa topilmadi</p>
                </div>
              ) : (
                searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border border-white/5 bg-white/40 dark:bg-white/5 transition-all text-left"
                  >
                    <div 
                      className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() => navigate(`/user/${u.id}`)}
                    >
                      <Avatar className="h-10 w-10 shrink-0 border border-white/10">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold">
                          {(u.name || u.username || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{u.name || u.username}</p>
                        {u.username && <StarUsername username={u.username} className="text-[10px]" />}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRelativeSelect(u.id, u.name || u.username || 'Foydalanuvchi')}
                      className="rounded-xl px-4 h-11 font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-[12px] uppercase tracking-wider shadow-lg shadow-emerald-500/20 border-0 transition-all active:scale-95 shrink-0"
                    >
                      Qarindosh
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <RelativeConnectionSheet
        open={isConnectionSheetOpen}
        onOpenChange={setIsConnectionSheetOpen}
        targetUserId={selectedRelativeUserId}
        targetUserName={selectedRelativeUserName}
      />

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 z-40 w-[390px] max-w-[calc(100vw-16px)] top-[78px]">
          <div className="mx-auto rounded-2xl border border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-lg shadow-black/10 dark:shadow-black/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-sky-500/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-foreground">
                  {pendingInvitations.length} ta taklifnoma kutmoqda
                </p>
                <div className="min-w-6 h-5 px-2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center">
                  {pendingInvitations.length > 99 ? '99+' : pendingInvitations.length}
                </div>
              </div>
            </div>
            <div className="max-h-[220px] overflow-y-auto">
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
        </div>
      )}

      {/* Canvas with overlays */}
      <div className={cn("flex-1 relative", isMergeMode && "pt-16", pendingInvitations.length > 0 && "pt-32")}>
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
          onReorderMergedProfiles={async (profiles) => reorderMergedProfiles(profiles.map(p => p.id))}
          onDetachNetwork={detachNetwork}
          isSharedNetwork={isSharedNetwork}
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
