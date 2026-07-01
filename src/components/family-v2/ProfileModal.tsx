import { useRef, useState, useEffect, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Baby,
  Edit2,
  ImagePlus,
  Link,
  Link2Off,
  MessageCircle,
  MoreVertical,
  Send,
  ShieldCheck,
  Trash2,
  Unlink,
  UserPlus,
  Users,
  BookHeart,
  Plus,
} from 'lucide-react';
import { Icon } from '@iconify/react';
import { FamilyMember } from '@/types/family';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { MergedProfilesManager } from './MergedProfilesManager';
import { YearScrollPicker } from './YearScrollPicker';
import { ImageCropper } from '@/components/profile';
import { compressImage, uploadToR2 } from '@/lib/r2Upload';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MergedProfileData {
  id: string;
  name: string;
  photoUrl?: string;
  gender: 'male' | 'female';
  linkedUserId?: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember;
  onUpdate: (id: string, updates: Partial<FamilyMember>) => void;
  onDelete: (id: string) => void;
  onAddParents?: (id: string) => void;
  onAddSpouse?: (id: string) => void;
  onAddChild?: (id: string) => void;
  onSendInvitation?: (member: FamilyMember) => void;
  onReorderMergedProfiles?: (profiles: MergedProfileData[]) => Promise<void> | void;
  hasParents?: boolean;
  hasSpouse?: boolean;
  canAddChild?: boolean;
  mergedProfiles?: MergedProfileData[];
  // Spouse lock props
  isSpouseLocked?: boolean;
  onToggleSpouseLock?: () => void;
  onDetachNetwork?: () => Promise<boolean>;
  isSharedNetwork?: boolean;
}

export const ProfileModal = ({
  isOpen,
  onClose,
  member,
  onUpdate,
  onDelete,
  onAddParents,
  onAddSpouse,
  onAddChild,
  onSendInvitation,
  onReorderMergedProfiles,
  hasParents = false,
  hasSpouse = false,
  canAddChild = false,
  mergedProfiles = [],
  isSpouseLocked = true,
  onToggleSpouseLock,
  onDetachNetwork,
  isSharedNetwork = false,
}: ProfileModalProps) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [birthYear, setBirthYear] = useState(member.birthYear?.toString() || '');
  const [deathYear, setDeathYear] = useState(member.deathYear?.toString() || '');
  const [photoUrl, setPhotoUrl] = useState(member.photoUrl || '');
  const [coverUrl, setCoverUrl] = useState(member.coverUrl || '');

  const effectiveMemberId = member.supabaseId || member.id;

  const [cropperState, setCropperState] = useState<{ isOpen: boolean; imageUrl: string; cropType: 'avatar' | 'cover' }>({
    isOpen: false,
    imageUrl: '',
    cropType: 'avatar',
  });

  const [memorialPostsCount, setMemorialPostsCount] = useState<number>(0);
  const [localMergedProfiles, setLocalMergedProfiles] = useState<MergedProfileData[]>([]);
  const [isSavingReorder, setIsSavingReorder] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchMemorialCount = async () => {
      const { count } = await supabase
        .from('memorial_posts')
        .select('*', { count: 'exact', head: true })
        .eq('family_member_id', member.id);
        
      setMemorialPostsCount(count || 0);
    };
    
    fetchMemorialCount();
  }, [isOpen, member.id]);

  // Check if this member is linked to the current user (protected)
  const isCurrentUserProfile = member.linkedUserId === user?.id;
  const isLiveProfile = !!member.linkedUserId;
  const canMessage = isLiveProfile && !isCurrentUserProfile;

  const showAddParents = !hasParents && !!onAddParents;
  const showAddSpouse = !hasSpouse && !!onAddSpouse;
  const showAddChild = canAddChild && !!onAddChild;
  const showInvite = !!(!member.linkedUserId && onSendInvitation);
  const showProfileView = true;
  const actionCount = [showAddParents, showAddSpouse, showAddChild, canMessage, showInvite, showProfileView].filter(Boolean).length;

  const effectivePhotoUrl = isCurrentUserProfile ? (profile?.avatar_url || photoUrl) : photoUrl;
  const effectiveCoverUrl = isCurrentUserProfile ? ((profile as unknown as { cover_url?: string })?.cover_url || coverUrl) : coverUrl;

  const hasChanges = 
    name !== member.name ||
    birthYear !== (member.birthYear?.toString() || '') ||
    deathYear !== (member.deathYear?.toString() || '') ||
    photoUrl !== (member.photoUrl || '') ||
    coverUrl !== (member.coverUrl || '');

  // Birlashgan profillarni yig'ish (Asosiy va boshqalar)
  const allMergedProfiles: MergedProfileData[] = [
    { 
      id: member.id, 
      name: member.name, 
      photoUrl: member.photoUrl, 
      gender: member.gender,
      linkedUserId: member.linkedUserId
    },
    ...(member.mergedProfiles || []).map(mp => ({
      id: mp.id,
      name: mp.name,
      photoUrl: mp.photoUrl,
      gender: mp.gender,
      linkedUserId: mp.linkedUserId 
    }))
  ];

  const mergedProfilesKey = member.mergedProfiles?.map(p => p.id).join(',') ?? '';

  useEffect(() => {
    setLocalMergedProfiles(allMergedProfiles);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id, mergedProfilesKey]);

  const handleSave = () => {
    onUpdate(member.id, {
      name: name || "Noma'lum",
      birthYear: birthYear ? parseInt(birthYear) : undefined,
      deathYear: deathYear ? parseInt(deathYear) : undefined,
      photoUrl: photoUrl || undefined,
      coverUrl: coverUrl || undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(member.name);
    setBirthYear(member.birthYear?.toString() || '');
    setDeathYear(member.deathYear?.toString() || '');
    setPhotoUrl(member.photoUrl || '');
    setCoverUrl(member.coverUrl || '');
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (isCurrentUserProfile) {
      return;
    }
    
    const msg = memorialPostsCount > 0 
      ? `Haqiqatdan ushbu a'zoni o'chirmoqchimisiz? Bu profil va unga tegishli ${memorialPostsCount} ta xotira posti butunlay yo'qoladi.`
      : "Ushbu a'zoni o'chirmoqchimisiz?";
      
    handleAction(() => {
      if (confirm(msg)) {
        onDelete(member.id);
      }
    });
  };

  const handleDetach = () => {
    handleAction(() => {
      if (confirm("Ushbu profil bilan aloqani uzmoqchimisiz? Daraxt ikki mustaqil nusxaga bo'linadi va keyingi o'zgarishlar bir-biriga ta'sir qilmaydi.")) {
        onDetachNetwork?.().then(ok => {
          if (!ok) alert("Aloqani uzishda xatolik yuz berdi.");
        });
      }
    });
  };

  const handleAction = (action: () => void) => {
    onClose();
    setTimeout(() => {
      action();
    }, 150);
  };

  const handleMessage = () => {
    if (!member.linkedUserId) return;
    handleAction(() => navigate(`/chat/${member.linkedUserId}`));
  };

  const handleAvatarClick = () => {
    if (!isEditing) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropperState({ isOpen: true, imageUrl: reader.result as string, cropType: 'avatar' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const uploadCroppedAvatar = async (croppedUrl: string): Promise<void> => {
    try {
      const response = await fetch(croppedUrl);
      const blob = await response.blob();
      const file = new File([blob], `family_avatar_${member.id}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressed = await compressImage(file, 1024, 1024, 0.98);
      const url = await uploadToR2(compressed, `family-members/${member.id}`);
      setPhotoUrl(url);
    } finally {
      URL.revokeObjectURL(croppedUrl);
    }
  };

  const handleCoverClick = () => {
    if (!isEditing) return;
    coverInputRef.current?.click();
  };

  const handleCoverFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropperState({ isOpen: true, imageUrl: reader.result as string, cropType: 'cover' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const uploadCroppedCover = async (croppedUrl: string): Promise<void> => {
    try {
      const response = await fetch(croppedUrl);
      const blob = await response.blob();
      const file = new File([blob], `family_cover_${member.id}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressed = await compressImage(file, 3200, 3200, 0.98);
      const url = await uploadToR2(compressed, `family-members/${member.id}-cover`);
      setCoverUrl(url);
    } finally {
      URL.revokeObjectURL(croppedUrl);
    }
  };

  const yearDisplay = member.birthYear
    ? `${member.birthYear}${member.deathYear ? ` — ${member.deathYear}` : ''}`
    : '';

  const isMale = member.gender === 'male';

  const avatarGradient = isMale ? 'from-sky-400 to-blue-600' : 'from-pink-400 to-rose-600';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[360px] max-h-[90vh] p-0 overflow-y-auto overflow-x-hidden rounded-3xl border border-white/10 bg-background/80 backdrop-blur-2xl shadow-2xl flex flex-col hide-scrollbar">
        <DialogHeader className="sr-only">
          <DialogTitle>Profil</DialogTitle>
        </DialogHeader>

        {/* Cover image area */}
        <div 
          className={cn("relative w-full h-32 shrink-0 bg-gradient-to-br from-slate-800 to-slate-900",
           isEditing && "cursor-pointer"
          )}
          onClick={handleCoverClick}
        >
          {effectiveCoverUrl && <img src={effectiveCoverUrl} alt="Cover" className="w-full h-full object-cover" />}
          {isEditing && (
             <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-colors hover:bg-black/50">
               <span className="bg-black/40 text-white text-xs px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-sm font-medium flex items-center gap-2">
                 <ImagePlus className="w-3.5 h-3.5" />
                 Fon rasmini o'zgartirish
               </span>
             </div>
          )}
        </div>
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFileSelect} />

        {/* Avatar - true overlap over the cover */}
        <div className="absolute left-1/2 -translate-x-1/2 top-20 z-10">
          <div
            className={cn(
              'relative w-24 h-24 rounded-full shadow-xl ring-4 ring-background transition-all duration-300 overflow-hidden',
              `bg-gradient-to-br ${avatarGradient}`,
              isEditing && 'cursor-pointer hover:scale-105'
            )}
            role={isEditing ? 'button' : undefined}
            tabIndex={isEditing ? 0 : undefined}
            onClick={handleAvatarClick}
            onKeyDown={(e) => {
              if (!isEditing) return;
              if (e.key === 'Enter' || e.key === ' ') handleAvatarClick();
            }}
          >
            {effectivePhotoUrl ? (
              <img src={effectivePhotoUrl} alt={member.name} className="w-full h-full object-cover" />
            ) : isEditing ? (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <ImagePlus className="w-8 h-8 text-white/80" />
                <span className="text-[10px] text-white/60 mt-1 font-medium">RASM</span>
              </div>
            ) : (
              <span className="w-full h-full flex items-center justify-center text-3xl font-bold text-white">
                {(member.name || '?')[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileSelect}
          />
        </div>

        {/* Top bar over cover */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-3 pb-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-2xl bg-muted/40 hover:bg-muted/70 transition-all"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 rounded-2xl">
              {hasSpouse && onToggleSpouseLock && (
                <DropdownMenuItem onClick={onToggleSpouseLock} className="rounded-xl">
                  {isSpouseLocked ? (
                    <Link className="h-4 w-4 mr-2 text-emerald-500" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-2 text-muted-foreground" />
                  )}
                  {isSpouseLocked ? "Juft bog'langan" : "Juft ajratilgan"}
                </DropdownMenuItem>
              )}

              {hasSpouse && onToggleSpouseLock && <DropdownMenuSeparator />}

              {isCurrentUserProfile ? (
                <DropdownMenuItem disabled className="opacity-100 rounded-xl">
                  <ShieldCheck className="h-4 w-4 mr-2 text-emerald-500" />
                  Himoyalangan
                </DropdownMenuItem>
              ) : isLiveProfile && isSharedNetwork ? (
                // In a shared tree, live profiles can only be unlinked, never deleted
                <DropdownMenuItem
                  onClick={handleDetach}
                  className="text-amber-500 focus:text-amber-500 rounded-xl"
                >
                  <Link2Off className="h-4 w-4 mr-2" />
                  Aloqani uzish
                </DropdownMenuItem>
              ) : (
                // Detached tree OR non-live profile: allow delete
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive rounded-xl"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  O'chirish
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div />

          <div className="flex items-center gap-2">
            {!isEditing && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleAction(() => navigate(`/create?memberId=${effectiveMemberId}`))}
                className="h-9 w-9 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 transition-all"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              className="h-9 w-9 rounded-2xl bg-muted/40 hover:bg-muted/70 transition-all"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative px-5 pb-3 pt-1 overflow-y-auto">
          <div className="h-6" />

          {isEditing ? (
            <div className="space-y-3 mt-1 pb-16">
              <div className="relative">
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 25))}
                  placeholder="Ism kiriting"
                  maxLength={25}
                  className="text-center text-base font-medium rounded-2xl bg-muted/40 border-muted/60 focus:border-primary/40 h-12 pr-14"
                  autoFocus
                />
                <span className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium tabular-nums",
                  name.length >= 23 ? "text-rose-400" : "text-muted-foreground/50"
                )}>{name.length}/25</span>
              </div>

              <div className="flex gap-2">
                <YearScrollPicker
                  value={birthYear}
                  onChange={setBirthYear}
                  placeholder="Tug'ilgan yil"
                  minYear={1800}
                  commitDefaultOnOpen
                  triggerClassName="rounded-2xl bg-muted/40 border-muted/60 hover:bg-muted/50 h-11 text-sm"
                />
                <YearScrollPicker
                  value={deathYear}
                  onChange={setDeathYear}
                  placeholder="Vafot yili"
                  minYear={1800}
                  commitDefaultOnOpen
                  triggerClassName="rounded-2xl bg-muted/40 border-muted/60 hover:bg-muted/50 h-11 text-sm"
                />
              </div>

              {mergedProfiles.length > 0 && onReorderMergedProfiles && (
                <div className="rounded-2xl bg-muted/30 px-1 py-2 mt-4">
                  <MergedProfilesManager
                    profiles={[
                      { id: member.id, name: member.name, photoUrl: member.photoUrl, gender: member.gender, linkedUserId: member.linkedUserId },
                      ...mergedProfiles,
                    ]}
                    onReorder={onReorderMergedProfiles}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <div className="fixed left-1/2 -translate-x-1/2 bottom-3 w-[min(360px,calc(100vw-24px))] px-5">
                  <div className="rounded-2xl border border-white/10 bg-background/80 backdrop-blur-xl p-2 flex gap-2">
                    <Button variant="outline" onClick={handleCancel} className="flex-1 rounded-2xl h-11 border-muted/60">
                      Bekor
                    </Button>
                    {hasChanges && (
                      <Button onClick={handleSave} className="flex-1 rounded-2xl h-11">
                        Saqlash
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-1 space-y-2">
              <div className="rounded-2xl bg-muted/40 px-4 py-2 text-center">
                <p className="text-base font-semibold tracking-tight">{member.name || "Noma'lum"}</p>
              </div>

              {yearDisplay ? (
                <div className="rounded-2xl bg-muted/25 px-4 py-1.5 text-center">
                  <p className="text-[11px] leading-4 text-muted-foreground">{yearDisplay}</p>
                </div>
              ) : null}

              {/* Merged profiles section */}
              {allMergedProfiles.length > 1 && (
                <div className="rounded-2xl bg-muted/30 px-1 py-1">
                  <MergedProfilesManager
                    profiles={localMergedProfiles}
                    isSaving={isSavingReorder}
                    onReorder={async (newOrder) => {
                      setLocalMergedProfiles(newOrder);
                      if (onReorderMergedProfiles) {
                        setIsSavingReorder(true);
                        await onReorderMergedProfiles(newOrder);
                        setIsSavingReorder(false);
                      }
                    }}
                  />
                </div>
              )}

              <div className={cn(
                "grid gap-2 pt-0",
                actionCount > 0 ? "grid-cols-2" : "grid-cols-1"
              )}>
                {showAddParents && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(() => onAddParents(member.id))}
                    className="rounded-2xl h-10 text-sm font-medium border-muted/60 hover:bg-muted/50"
                  >
                    <Users className="w-3.5 h-3.5 mr-1" />
                    Ota-ona
                  </Button>
                )}

                {showAddSpouse && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(() => onAddSpouse(member.id))}
                    className="rounded-2xl h-10 text-sm font-medium border-muted/60 hover:bg-muted/50"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1" />
                    Juft
                  </Button>
                )}

                {showAddChild && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(() => onAddChild(member.id))}
                    className="rounded-2xl h-10 text-sm font-medium border-muted/60 hover:bg-muted/50"
                  >
                    <Baby className="w-3.5 h-3.5 mr-1" />
                    Farzand
                  </Button>
                )}

                {canMessage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMessage}
                    className="rounded-2xl h-10 text-sm font-medium border-muted/60 hover:bg-muted/50"
                  >
                    <MessageCircle className="w-3.5 h-3.5 mr-1" />
                    Xabar
                  </Button>
                )}

                {showInvite && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleAction(() => onSendInvitation(member))}
                    className={cn(
                      "rounded-2xl h-10 text-sm font-semibold border-none relative overflow-hidden",
                      "bg-gradient-to-r from-[#2563eb] via-[#4f46e5] to-[#7c3aed]",
                      "text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]",
                      "hover:shadow-[0_0_25px_rgba(79,70,229,0.85)] hover:scale-[1.05]",
                      "active:scale-[0.95] transition-all duration-300 ease-out",
                      "flex items-center justify-center gap-1.5 group cursor-pointer"
                    )}
                  >
                    {/* Background glow animation */}
                    <span className="absolute inset-0 bg-gradient-to-r from-[#7c3aed] via-[#4f46e5] to-[#2563eb] opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />
                    
                    {/* Subtle shine effect */}
                    <span className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" 
                          style={{
                            animation: 'shimmer 2s infinite linear',
                          }}
                    />
                    
                    <style dangerouslySetInnerHTML={{__html: `
                      @keyframes shimmer {
                        0% { transform: translateX(-100%); }
                        100% { transform: translateX(100%); }
                      }
                    `}} />

                    <Icon 
                      icon="bi:send-plus" 
                      className="w-4 h-4 relative z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" 
                    />
                    <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)] tracking-wide">
                      Taklif
                    </span>
                  </Button>
                )}

                {showProfileView && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(() => {
                      if (member.linkedUserId) {
                        navigate(`/user/${member.linkedUserId}`);
                      } else {
                        navigate(`/user/${effectiveMemberId}?memorial=true`);
                      }
                    })}
                    className={cn(
                      "rounded-2xl h-10 text-sm font-medium border-primary/20 bg-primary/5 text-primary hover:bg-primary/10",
                      (actionCount - 1) % 2 === 0 ? "col-span-2" : undefined
                    )}
                  >
                    <BookHeart className="w-3.5 h-3.5 mr-1" />
                    {member.deathYear ? "Xotira sahifasi" : "Profilga o'tish"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <ImageCropper
          isOpen={cropperState.isOpen}
          onClose={() => setCropperState((prev) => ({ ...prev, isOpen: false }))}
          imageUrl={cropperState.imageUrl}
          aspectRatio={cropperState.cropType === 'cover' ? 16 / 7 : 1}
          shape={cropperState.cropType === 'cover' ? 'rect' : 'circle'}
          title={cropperState.cropType === 'cover' ? 'Fon rasmini kesish' : 'Profil rasmini kesish'}
          onCropComplete={cropperState.cropType === 'cover' ? uploadCroppedCover : uploadCroppedAvatar}
        />
      </DialogContent>
    </Dialog>
  );
};
