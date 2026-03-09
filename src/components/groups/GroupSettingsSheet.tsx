import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StarUsername } from '@/components/user/StarUsername';
import { toast } from 'sonner';
import { Camera, Users, Megaphone, Crown, UserMinus, UserPlus, Link, Copy, Check, Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  profile?: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: 'group' | 'channel';
  visibility: 'public' | 'private';
  owner_id: string;
  invite_link: string | null;
}

interface GroupSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupInfo: GroupInfo;
  onGroupUpdated: () => void;
}

export const GroupSettingsSheet = ({ open, onOpenChange, groupInfo, onGroupUpdated }: GroupSettingsSheetProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(groupInfo.name);
  const [description, setDescription] = useState(groupInfo.description || '');
  const [avatarUrl, setAvatarUrl] = useState(groupInfo.avatar_url || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const isOwner = groupInfo.owner_id === user?.id;

  useEffect(() => {
    if (open) {
      setName(groupInfo.name);
      setDescription(groupInfo.description || '');
      setAvatarUrl(groupInfo.avatar_url || '');
      fetchMembers();
    }
  }, [open, groupInfo]);

  const fetchMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const { data: membersData } = await supabase
        .from('group_members').select('*').eq('group_id', groupInfo.id);
      if (membersData) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles').select('id, name, username, avatar_url').in('id', userIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        setMembers(membersData.map(m => ({ ...m, profile: profileMap.get(m.user_id) })));
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${groupInfo.id}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('group-avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('group-avatars').getPublicUrl(filePath);
      setAvatarUrl(publicUrl);
    } catch (error) {
      toast.error('Rasm yuklanmadi');
    }
  };

  const handleUpdate = async () => {
    if (!name.trim()) { toast.error('Nomni kiriting'); return; }
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('group_chats')
        .update({ name: name.trim(), description: description.trim() || null, avatar_url: avatarUrl || null })
        .eq('id', groupInfo.id);
      if (error) throw error;
      toast.success('Ma\'lumotlar yangilandi');
      onGroupUpdated();
      onOpenChange(false);
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase.from('group_members').delete().eq('id', memberId);
      if (error) throw error;
      toast.success('A\'zo o\'chirildi');
      fetchMembers();
      onGroupUpdated();
    } catch { toast.error('Xatolik yuz berdi'); }
  };

  const handleDeleteGroup = async () => {
    if (!confirm(`${groupInfo.type === 'group' ? 'Guruh' : 'Kanal'}ni o'chirishni xohlaysizmi?`)) return;
    try {
      await supabase.from('group_messages').delete().eq('group_id', groupInfo.id);
      await supabase.from('group_members').delete().eq('group_id', groupInfo.id);
      const { error } = await supabase.from('group_chats').delete().eq('id', groupInfo.id);
      if (error) throw error;
      toast.success(`${groupInfo.type === 'group' ? 'Guruh' : 'Kanal'} o'chirildi`);
      navigate('/messages');
    } catch { toast.error('Xatolik yuz berdi'); }
  };

  const handleMembersAdded = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    try {
      const existingIds = members.map(m => m.user_id);
      const newIds = userIds.filter(id => !existingIds.includes(id) && id !== groupInfo.owner_id);
      if (newIds.length === 0) { toast.info('Bu foydalanuvchilar allaqachon a\'zo'); return; }
      const inserts = newIds.map(uid => ({ group_id: groupInfo.id, user_id: uid, role: 'member' }));
      const { error } = await supabase.from('group_members').upsert(inserts as any, { onConflict: 'group_id,user_id' });
      if (error) throw error;
      toast.success(`${newIds.length} ta a'zo qo'shildi`);
      fetchMembers();
      onGroupUpdated();
    } catch (e: any) {
      toast.error(e?.message || 'Xatolik yuz berdi');
    }
    setAddMemberOpen(false);
  };

  const copyInviteLink = async () => {
    if (!groupInfo.invite_link) return;
    const baseUrl = (import.meta as any).env?.VITE_PUBLIC_APP_URL || window.location.origin;
    const fullLink = `${String(baseUrl).replace(/\/$/, '')}/join/${groupInfo.invite_link}`;
    await navigator.clipboard.writeText(fullLink);
    setLinkCopied(true);
    toast.success('Havola nusxalandi');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const generateInviteLink = async () => {
    if (!isOwner) return;
    if (groupInfo.invite_link) return;
    setIsGeneratingLink(true);
    try {
      const newLink = `${groupInfo.type}_${Date.now().toString(36)}`;
      const { error } = await supabase.from('group_chats').update({ invite_link: newLink }).eq('id', groupInfo.id);
      if (error) throw error;
      toast.success('Havola yaratildi');
      onGroupUpdated();
    } catch (e: any) {
      toast.error(e?.message || 'Xatolik yuz berdi');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Owner profile
  const [ownerProfile, setOwnerProfile] = useState<{ name: string | null; username: string | null; avatar_url: string | null } | null>(null);
  useEffect(() => {
    if (open && groupInfo.owner_id) {
      supabase.from('profiles').select('name, username, avatar_url').eq('id', groupInfo.owner_id).single()
        .then(({ data }) => { if (data) setOwnerProfile(data); });
    }
  }, [open, groupInfo.owner_id]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 border-b border-border/50">
            <SheetTitle className="text-lg">
              {groupInfo.type === 'group' ? 'Guruh sozlamalari' : 'Kanal sozlamalari'}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="p-5 space-y-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar className="h-24 w-24 ring-2 ring-primary/20">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-primary/30 to-primary/10">
                      {groupInfo.type === 'group' ? <Users className="h-10 w-10 text-primary" /> : <Megaphone className="h-10 w-10 text-primary" />}
                    </AvatarFallback>
                  </Avatar>
                  {isOwner && (
                    <label className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 shadow-lg">
                      <Camera className="h-4 w-4" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    </label>
                  )}
                </div>
              </div>

              {/* Editable fields */}
              {isOwner ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Nomi</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)}
                      placeholder={groupInfo.type === 'group' ? 'Guruh nomi' : 'Kanal nomi'}
                      className="rounded-xl bg-card/50 border-border/50" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Tavsif</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="Qisqacha tavsif..." rows={3}
                      className="rounded-xl bg-card/50 border-border/50 resize-none" />
                  </div>
                  <Button onClick={handleUpdate} disabled={isUpdating}
                    className="w-full rounded-xl bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(263,70%,50%)] text-white hover:opacity-90">
                    {isUpdating ? 'Saqlanmoqda...' : 'Saqlash'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-1 text-center">
                  <h3 className="font-semibold text-lg">{groupInfo.name}</h3>
                  {groupInfo.description && <p className="text-sm text-muted-foreground">{groupInfo.description}</p>}
                </div>
              )}

              {/* Invite Link */}
              {(groupInfo.invite_link || isOwner) && (
                <div className="p-3 bg-card/50 border border-border/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Link className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Taklif havolasi</span>
                  </div>
                  {groupInfo.invite_link ? (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted/50 p-2 rounded-lg truncate">{window.location.origin}/join/{groupInfo.invite_link}</code>
                      <Button variant="ghost" size="icon" onClick={copyInviteLink} className="h-8 w-8 rounded-lg">
                        {linkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={generateInviteLink}
                      disabled={isGeneratingLink}
                      className="w-full h-10 rounded-xl bg-primary/10 text-primary hover:bg-primary/15"
                      variant="ghost"
                    >
                      {isGeneratingLink ? 'Yaratilmoqda...' : 'Taklif havolasi yaratish'}
                    </Button>
                  )}
                </div>
              )}

              {/* Members */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">A'zolar</h3>
                  {isOwner && (
                    <Button variant="outline" size="sm" onClick={() => setAddMemberOpen(true)}
                      className="rounded-xl gap-1.5 text-xs h-8 border-primary/30 text-primary hover:bg-primary/10">
                      <UserPlus className="h-3.5 w-3.5" />
                      Qo'shish
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  {/* Owner */}
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-primary/5 border border-primary/10">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={ownerProfile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-yellow-400/30 to-yellow-600/20">
                        <Crown className="h-4 w-4 text-yellow-500" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{ownerProfile?.name || 'Egasi'}</p>
                      <p className="text-xs text-muted-foreground">
                        {user?.id === groupInfo.owner_id ? 'Siz · Egasi' : 'Egasi'}
                      </p>
                    </div>
                  </div>

                  {isLoadingMembers ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Yuklanmoqda...</p>
                  ) : members.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Boshqa a'zolar yo'q</p>
                  ) : (
                    members.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{getInitials(member.profile?.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{member.profile?.name || 'Foydalanuvchi'}</p>
                          <div className="truncate">
                            <StarUsername username={member.profile?.username || 'username'} />
                          </div>
                        </div>
                        {isOwner && (
                          <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 rounded-lg"
                            onClick={() => handleRemoveMember(member.id)}>
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Delete Group */}
              {isOwner && (
                <div className="pt-4 border-t border-border/50">
                  <Button variant="destructive" className="w-full rounded-xl" onClick={handleDeleteGroup}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {groupInfo.type === 'group' ? 'Guruhni o\'chirish' : 'Kanalni o\'chirish'}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AddMemberInlineDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        onComplete={handleMembersAdded}
        existingMemberIds={[groupInfo.owner_id, ...members.map(m => m.user_id)]}
      />
    </>
  );
};

// Inline Add Member Dialog
interface AddMemberInlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (userIds: string[]) => void;
  existingMemberIds: string[];
}

const AddMemberInlineDialog = ({ open, onOpenChange, onComplete, existingMemberIds }: AddMemberInlineDialogProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<{ id: string; name: string | null; username: string | null; avatar_url: string | null }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !open) return;
    setIsLoading(true);
    const fetchUsers = async () => {
      try {
        // Get followers + following
        const [{ data: frs }, { data: fng }] = await Promise.all([
          supabase.from('follows').select('follower_id').eq('following_id', user.id),
          supabase.from('follows').select('following_id').eq('follower_id', user.id),
        ]);
        const ids = [...new Set([...(frs || []).map(f => f.follower_id), ...(fng || []).map(f => f.following_id)])];
        const availableIds = ids.filter(id => !existingMemberIds.includes(id));
        if (availableIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', availableIds);
          setAllUsers(profiles || []);
        } else {
          setAllUsers([]);
        }
      } catch { setAllUsers([]); }
      setIsLoading(false);
    };
    fetchUsers();
  }, [user?.id, open, existingMemberIds]);

  const filteredUsers = allUsers.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.name?.toLowerCase().includes(q)) || (u.username?.toLowerCase().includes(q));
  });

  const toggleUser = (uid: string) => {
    const s = new Set(selectedIds);
    if (s.has(uid)) s.delete(uid); else s.add(uid);
    setSelectedIds(s);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>A'zo qo'shish</span>
            {selectedIds.size > 0 && <span className="text-sm font-normal text-primary">{selectedIds.size} tanlandi</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="relative px-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Qidirish..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-1">
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Yuklanmoqda...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">
                {searchQuery ? 'Hech kim topilmadi' : 'Qo\'shish uchun foydalanuvchi yo\'q'}
              </p>
            ) : (
              filteredUsers.map(u => (
                <div key={u.id} onClick={() => toggleUser(u.id)}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">{(u.name || 'U')[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{u.name || 'Foydalanuvchi'}</p>
                    <div className="truncate">
                      <StarUsername username={u.username || 'username'} />
                    </div>
                  </div>
                  <Checkbox checked={selectedIds.has(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 px-6 pb-4 pt-3 border-t border-border/50">
          <Button variant="ghost" onClick={() => { onOpenChange(false); setSelectedIds(new Set()); }} className="rounded-xl">
            Bekor
          </Button>
          <Button onClick={() => { onComplete(Array.from(selectedIds)); setSelectedIds(new Set()); }}
            disabled={selectedIds.size === 0}
            className="rounded-xl bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(263,70%,50%)] text-white">
            Qo'shish ({selectedIds.size})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
