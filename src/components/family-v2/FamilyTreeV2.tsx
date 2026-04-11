import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TreeDeciduous, X, GitMerge, Search, Plus, Users, UserPlus, User } from 'lucide-react';
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
    members, rootId, isLoading, isRefreshing,
    totalCount, activeCount,
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
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Computed variables for FAB functionality
  const rootNode = rootId ? members[rootId] : null;
  const hasParents = rootNode ? (rootNode.parentIds?.length || 0) > 0 : false;
  const hasSpouse = rootNode ? !!rootNode.spouseId : false;
  const canAddChild = rootNode ? !!rootNode.spouseId : false;

  let fatherNode: FamilyMember | null = null;
  let motherNode: FamilyMember | null = null;

  if (rootNode?.parentIds) {
    rootNode.parentIds.forEach(pid => {
      const parent = members[pid];
      if (parent) {
        if (parent.gender === 'male') fatherNode = parent;
        if (parent.gender === 'female') motherNode = parent;
      }
    });
  }

  const fatherHasParents = fatherNode ? (fatherNode.parentIds?.length || 0) > 0 : false;
  const fatherCanAddChild = fatherNode ? !!fatherNode.spouseId : false;

  const motherHasParents = motherNode ? (motherNode.parentIds?.length || 0) > 0 : false;
  const motherCanAddChild = motherNode ? !!motherNode.spouseId : false;

  const spouseNode = rootNode?.spouseId ? members[rootNode.spouseId] : null;
  const spouseHasParents = spouseNode ? (spouseNode.parentIds?.length || 0) > 0 : false;
  const spouseCanAddChild = spouseNode ? !!spouseNode.spouseId : false;

  const shouldShowFab = rootNode && (!hasParents || !hasSpouse || canAddChild || fatherNode || motherNode || spouseNode);

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

  const handleAcceptInvitation = async (invitation: { id: string; [key: string]: unknown }) => {
    setProcessingInvitation(invitation.id);
    await acceptInvitation(invitation as Parameters<typeof acceptInvitation>[0]);
    setProcessingInvitation(null);
  };
  const handleRejectInvitation = async (invitation: { id: string; [key: string]: unknown }) => {
    setProcessingInvitation(invitation.id);
    await rejectInvitation(invitation as Parameters<typeof rejectInvitation>[0]);
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

  // Replaced full-screen blocker with non-blocking overlay to keep shell visible

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
          onSave={handleSaveTree}
          onPublish={handlePublish}
          members={members}
          totalCount={totalCount}
          activeCount={activeCount}
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
        
        {/* Background Sync Indicator */}
        {isRefreshing && Object.keys(members).length > 0 && (
          <div className="absolute top-4 left-4 z-50 flex items-center justify-center gap-2 bg-background/80 backdrop-blur text-xs font-medium px-3 py-1.5 rounded-full shadow border text-muted-foreground animate-in fade-in zoom-in duration-200">
            <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Yangilanmoqda...
          </div>
        )}

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

        {/* Full-screen Loading Overlay for initial fetch (Skeleton) */}
        {isLoading && Object.keys(members).length === 0 && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-card/60 backdrop-blur-sm">
            <div className="text-center bg-card/90 p-6 rounded-2xl shadow-xl border border-white/10 dark:border-slate-800 backdrop-blur-md">
              <TreeDeciduous className="w-12 h-12 mx-auto text-primary animate-pulse" />
              <p className="mt-4 text-sm font-medium text-foreground">Shajara yuklanmoqda...</p>
            </div>
          </div>
        )}
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

      {/* Floating Action Button (FAB) for adding relatives */}
      {shouldShowFab && !isMergeMode && !showPublish && !isRelativeSearchOpen && (
        <div className="fixed bottom-[85px] right-4 z-[55] flex flex-col items-end">
          {/* Default overlay for glass effect backdrop */}
          {isFabOpen && (
            <div 
              className="fixed inset-0 bg-background/40 backdrop-blur-sm z-[-1] transition-all duration-500 animate-in fade-in" 
              onClick={() => setIsFabOpen(false)}
            />
          )}

          {/* FAB Grid Menu */}
          <div 
            className={cn(
              "grid grid-cols-2 gap-3 transition-all duration-500 origin-bottom-right mb-6",
              isFabOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-[0.8] translate-y-8 pointer-events-none absolute right-0 bottom-14"
            )}
            style={{ width: '310px' }}
          >
            {/* Component generic classes for individual menu items */}
            {/* Parent nodes first (Ota/Ona tomon) */}
            {fatherNode && !fatherHasParents && (
              <button 
                onClick={() => { setIsFabOpen(false); handleAddParents(fatherNode.id); }} 
                className="flex items-center gap-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl hover:bg-white/80 dark:hover:bg-slate-800/80 active:scale-95 transition-all w-full p-1.5 pr-4 rounded-full border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20"
              >
                <div className="shrink-0 h-11 w-11 rounded-full flex flex-col items-center justify-center text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] bg-gradient-to-b from-blue-500 to-blue-700 ring-1 ring-black/5">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col text-slate-800 dark:text-slate-200 text-[11px] font-bold leading-[1.2] text-left min-w-0 pr-1 tracking-wide">
                  <span>Bobo</span><span>Momo</span>
                </div>
              </button>
            )}

            {motherNode && !motherHasParents && (
              <button 
                onClick={() => { setIsFabOpen(false); handleAddParents(motherNode.id); }} 
                className="flex items-center gap-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl hover:bg-white/80 dark:hover:bg-slate-800/80 active:scale-95 transition-all w-full p-1.5 pr-4 rounded-full border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20"
              >
                <div className="shrink-0 h-11 w-11 rounded-full flex flex-col items-center justify-center text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] bg-gradient-to-b from-purple-500 to-purple-700 ring-1 ring-black/5">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col text-slate-800 dark:text-slate-200 text-[11px] font-bold leading-[1.2] text-left min-w-0 pr-1 tracking-wide">
                  <span>Bobo</span><span>Momo</span>
                </div>
              </button>
            )}

            {/* Amaki/Amma (Siblings of father, added to paternal grandparents) */}
            {fatherNode && fatherHasParents && (
              <button 
                onClick={() => { 
                  setIsFabOpen(false); 
                  const paternalGrandparentId = fatherNode.parentIds!.find(id => members[id]) || fatherNode.parentIds![0];
                  if (paternalGrandparentId) handleAddChild(paternalGrandparentId); 
                }} 
                className="flex items-center gap-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl hover:bg-white/80 dark:hover:bg-slate-800/80 active:scale-95 transition-all w-full p-1.5 pr-4 rounded-full border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20"
              >
                <div className="shrink-0 h-11 w-11 rounded-full flex flex-col items-center justify-center text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] bg-gradient-to-b from-amber-500 to-orange-600 ring-1 ring-black/5">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col text-slate-800 dark:text-slate-200 text-[11px] font-bold leading-[1.2] text-left min-w-0 pr-1 tracking-wide">
                  <span>Amaki</span><span>Amma</span>
                </div>
              </button>
            )}

            {/* Tog'a/Xola (Siblings of mother, added to maternal grandparents) */}
            {motherNode && motherHasParents && (
              <button 
                onClick={() => { 
                  setIsFabOpen(false); 
                  const maternalGrandparentId = motherNode.parentIds!.find(id => members[id]) || motherNode.parentIds![0];
                  if (maternalGrandparentId) handleAddChild(maternalGrandparentId); 
                }} 
                className="flex items-center gap-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl hover:bg-white/80 dark:hover:bg-slate-800/80 active:scale-95 transition-all w-full p-1.5 pr-4 rounded-full border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20"
              >
                <div className="shrink-0 h-11 w-11 rounded-full flex flex-col items-center justify-center text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] bg-gradient-to-b from-indigo-500 to-purple-600 ring-1 ring-black/5">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col text-slate-800 dark:text-slate-200 text-[11px] font-bold leading-[1.2] text-left min-w-0 pr-1 tracking-wide">
                  <span>Tog'a</span><span>Xola</span>
                </div>
              </button>
            )}

            {/* Siblings of the user (Aka-uka / Opa-singil) */}
            {(fatherNode || motherNode) && (
              <button 
                onClick={() => { setIsFabOpen(false); handleAddChild(fatherNode ? fatherNode.id : motherNode!.id); }} 
                className="flex items-center gap-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl hover:bg-white/80 dark:hover:bg-slate-800/80 active:scale-95 transition-all w-full p-1.5 pr-4 rounded-full border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20"
              >
                <div className="shrink-0 h-11 w-11 rounded-full flex flex-col items-center justify-center text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] bg-gradient-to-b from-emerald-500 to-emerald-700 ring-1 ring-black/5">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col text-slate-800 dark:text-slate-200 text-[11px] font-bold leading-[1.2] text-left min-w-0 pr-1 tracking-wide">
                  <span>Aka-uka</span><span>Opa-singil</span>
                </div>
              </button>
            )}

            {/* In-laws (Qaynota/Qaynona) */}
            {spouseNode && !spouseHasParents && (
              <button 
                onClick={() => { setIsFabOpen(false); handleAddParents(spouseNode.id); }} 
                className="flex items-center gap-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl hover:bg-white/80 dark:hover:bg-slate-800/80 active:scale-95 transition-all w-full p-1.5 pr-4 rounded-full border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20"
              >
                <div className="shrink-0 h-11 w-11 rounded-full flex flex-col items-center justify-center text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] bg-gradient-to-b from-sky-400 to-blue-600 ring-1 ring-black/5">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col text-slate-800 dark:text-slate-200 text-[11px] font-bold leading-[1.2] text-left min-w-0 pr-1 tracking-wide">
                  <span>Qaynota</span><span>Qaynona</span>
                </div>
              </button>
            )}

            {/* Children (Farzand) */}
            {canAddChild && (
              <button 
                onClick={() => { setIsFabOpen(false); handleAddChild(rootId!); }} 
                className="flex items-center gap-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl hover:bg-white/80 dark:hover:bg-slate-800/80 active:scale-95 transition-all w-full p-1.5 pr-4 rounded-full border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20"
              >
                <div className="shrink-0 h-11 w-11 rounded-full flex flex-col items-center justify-center text-orange-500 bg-white/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] ring-1 ring-orange-500/20">
                  <User className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col text-slate-800 dark:text-slate-200 text-[12px] font-bold leading-[1.2] text-left min-w-0 pr-1 tracking-wide">
                  <span>Farzand</span>
                </div>
              </button>
            )}

            {/* Core Relatives (If missing - centered spans 2 columns) */}
            {!hasParents && (
              <button 
                onClick={() => { setIsFabOpen(false); handleAddParents(rootId!); }} 
                className="flex items-center gap-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl hover:bg-white/80 dark:hover:bg-slate-800/80 active:scale-95 transition-all w-full p-1.5 pr-4 rounded-full border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20 col-span-2 max-w-[170px] justify-self-center mt-1"
              >
                <div className="shrink-0 h-11 w-11 rounded-full flex flex-col items-center justify-center text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] bg-gradient-to-b from-slate-600 to-slate-800 ring-1 ring-black/5">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col text-slate-800 dark:text-slate-200 text-[12px] font-bold leading-[1.2] text-left pr-2 tracking-wide uppercase">
                  <span>Ota Ona</span>
                </div>
              </button>
            )}
            
            {!hasSpouse && (
              <button 
                onClick={() => { setIsFabOpen(false); handleAddSpouse(rootId!); }} 
                className="flex items-center gap-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl hover:bg-white/80 dark:hover:bg-slate-800/80 active:scale-95 transition-all w-full p-1.5 pr-4 rounded-full border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/20 col-span-2 max-w-[170px] justify-self-center mt-1"
              >
                <div className="shrink-0 h-11 w-11 rounded-full flex flex-col items-center justify-center text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] bg-gradient-to-b from-rose-500 to-rose-700 ring-1 ring-black/5">
                  <UserPlus className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col text-slate-800 dark:text-slate-200 text-[12px] font-bold leading-[1.2] text-left pr-2 tracking-wide uppercase">
                  <span>Juft qo'shish</span>
                </div>
              </button>
            )}
          </div>

          {/* Main FAB Trigger */}
          <button
            onClick={() => setIsFabOpen(!isFabOpen)}
            className="relative group rounded-full h-[64px] w-[64px] shadow-2xl shadow-emerald-500/20 dark:shadow-indigo-500/30 transition-all duration-300 border-0 focus:outline-none ring-0 outline-none hover:-translate-y-1 active:scale-95"
            aria-label="Add relative"
          >
            {/* Glow backing - Adaptive colors */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 dark:from-indigo-500 dark:to-cyan-400 blur-md opacity-40 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Main glass button layer - Adaptive gradients */}
            <div className="relative w-full h-full rounded-full bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-600 dark:from-indigo-600 dark:via-blue-600 dark:to-cyan-600 flex items-center justify-center text-white border border-white/30 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] z-10 overflow-hidden transition-all duration-500">
               {/* Shimmer effect overlay inside button */}
               <div className="absolute inset-0 w-full h-full bg-gradient-to-tr from-transparent via-white/30 to-transparent -translate-x-[120%] group-hover:translate-x-[120%] transition-transform duration-1000 ease-in-out" />
               <Plus className={cn("h-8 w-8 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative z-10 drop-shadow-md", isFabOpen ? "rotate-[225deg]" : "")} />
            </div>
          </button>
        </div>
      )}
        </>
      )}
    </section>
  );
};
