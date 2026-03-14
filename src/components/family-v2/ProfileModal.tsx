import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Baby,
  Edit2,
  ImagePlus,
  Link,
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
import { FamilyMember } from '@/types/family';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { MergedProfilesManager } from './MergedProfilesManager';
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
  onReorderMergedProfiles?: (profiles: MergedProfileData[]) => void;
  hasParents?: boolean;
  hasSpouse?: boolean;
  canAddChild?: boolean;
  mergedProfiles?: MergedProfileData[];
  // Spouse lock props
  isSpouseLocked?: boolean;
  onToggleSpouseLock?: () => void;
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
}: ProfileModalProps) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [birthYear, setBirthYear] = useState(member.birthYear?.toString() || '');
  const [deathYear, setDeathYear] = useState(member.deathYear?.toString() || '');
  const [photoUrl, setPhotoUrl] = useState(member.photoUrl || '');

  const [cropperState, setCropperState] = useState<{ isOpen: boolean; imageUrl: string }>({
    isOpen: false,
    imageUrl: '',
  });

  // Check if this member is linked to the current user (protected)
  const isCurrentUserProfile = member.linkedUserId === user?.id;
  const isLiveProfile = !!member.linkedUserId;
  const canMessage = isLiveProfile && !isCurrentUserProfile;

  const showAddParents = !hasParents && !!onAddParents;
  const showAddSpouse = !hasSpouse && !!onAddSpouse;
  const showAddChild = canAddChild && !!onAddChild;
  const showInvite = !!(member.name && !member.linkedUserId && onSendInvitation);
  const showProfileView = true;
  const actionCount = [showAddParents, showAddSpouse, showAddChild, canMessage, showInvite, showProfileView].filter(Boolean).length;

  const effectivePhotoUrl = isCurrentUserProfile ? (profile?.avatar_url || photoUrl) : photoUrl;

  const hasChanges = 
    name !== member.name ||
    birthYear !== (member.birthYear?.toString() || '') ||
    deathYear !== (member.deathYear?.toString() || '') ||
    photoUrl !== (member.photoUrl || '');

  const handleSave = () => {
    onUpdate(member.id, {
      name: name || "Noma'lum",
      birthYear: birthYear ? parseInt(birthYear) : undefined,
      deathYear: deathYear ? parseInt(deathYear) : undefined,
      photoUrl: photoUrl || undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(member.name);
    setBirthYear(member.birthYear?.toString() || '');
    setDeathYear(member.deathYear?.toString() || '');
    setPhotoUrl(member.photoUrl || '');
    setIsEditing(false);
  };

  const handleDelete = () => {
    // Don't allow deleting own profile
    if (isCurrentUserProfile) {
      return;
    }
    if (confirm("Ushbu a'zoni o'chirmoqchimisiz?")) {
      onDelete(member.id);
      onClose();
    }
  };

  const handleAction = (action: () => void) => {
    onClose();
    action();
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
      setCropperState({ isOpen: true, imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const uploadCroppedAvatar = async (croppedUrl: string): Promise<void> => {
    try {
      const response = await fetch(croppedUrl);
      const blob = await response.blob();
      const file = new File([blob], `family_avatar_${member.id}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressed = await compressImage(file);
      const url = await uploadToR2(compressed, `family-members/${member.id}`);
      setPhotoUrl(url);
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
      <DialogContent className="sm:max-w-[360px] max-h-[52vh] p-0 overflow-visible rounded-3xl border border-white/10 bg-background/80 backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Profil</DialogTitle>
        </DialogHeader>

        {/* Avatar - true overlap (does not consume card height) */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-12 z-10">
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

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
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
              ) : (
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
                onClick={() => handleAction(() => navigate(`/create?memberId=${member.id}`))}
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
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ism kiriting"
                className="text-center text-base font-medium rounded-2xl bg-muted/40 border-muted/60 focus:border-primary/40 h-12"
                autoFocus
              />

              <div className="flex gap-2">
                <Input
                  type="number"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="Tug'ilgan yil"
                  min="1800"
                  max={new Date().getFullYear()}
                  className="rounded-2xl bg-muted/40 border-muted/60 focus:border-primary/40 h-11 text-sm"
                />
                <Input
                  type="number"
                  value={deathYear}
                  onChange={(e) => setDeathYear(e.target.value)}
                  placeholder="Vafot yili"
                  min="1800"
                  max={new Date().getFullYear()}
                  className="rounded-2xl bg-muted/40 border-muted/60 focus:border-primary/40 h-11 text-sm"
                />
              </div>

              {mergedProfiles.length > 0 && onReorderMergedProfiles && (
                <MergedProfilesManager
                  profiles={[
                    { id: member.id, name: member.name, photoUrl: member.photoUrl, gender: member.gender },
                    ...mergedProfiles,
                  ]}
                  onReorder={onReorderMergedProfiles}
                />
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
              {member.mergedProfiles && member.mergedProfiles.length > 0 && (
                <div className="rounded-2xl bg-muted/30 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Birlashgan profillar ({member.mergedProfiles.length + 1})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {/* Primary profile */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-primary/50",
                        isMale ? "bg-sky-500" : "bg-pink-500"
                      )}>
                        {member.photoUrl ? (
                          <img src={member.photoUrl} alt={member.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-white">{(member.name || '?')[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <span className="text-[9px] text-primary font-medium max-w-[50px] truncate">Asosiy</span>
                    </div>
                    {/* Merged profiles */}
                    {member.mergedProfiles.map((mp) => (
                      <div key={mp.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center opacity-80",
                          mp.gender === 'male' ? "bg-sky-500" : "bg-pink-500"
                        )}>
                          {mp.photoUrl ? (
                            <img src={mp.photoUrl} alt={mp.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-white">{(mp.name || '?')[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <span className="text-[9px] text-muted-foreground max-w-[50px] truncate">{mp.name || '?'}</span>
                      </div>
                    ))}
                  </div>
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
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(() => onSendInvitation(member))}
                    className={cn(
                      "rounded-2xl h-10 text-sm font-medium border-muted/60 hover:bg-muted/50"
                    )}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Taklif
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
                        navigate(`/user/${member.id}?memorial=true`);
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
          aspectRatio={1}
          shape="circle"
          onCropComplete={uploadCroppedAvatar}
        />
      </DialogContent>
    </Dialog>
  );
};
