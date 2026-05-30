import { useState, useEffect } from 'react';
import { Search, Send, User, Users, UserPlus, Phone, Link as LinkIcon, CheckCircle2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FamilyMember } from '@/types/family';
import { cn } from '@/lib/utils';
import { StarUsername } from '@/components/user/StarUsername';
import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';

interface SendInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: FamilyMember | null;
}

interface UserProfile {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  gender: string | null;
}

export const SendInvitationModal = ({
  isOpen,
  onClose,
  member,
}: SendInvitationModalProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingFollows, setIsLoadingFollows] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [roleInput, setRoleInput] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // The gender that the invited person should be (matches the placeholder member's gender)
  const requiredGender = member?.gender;

  // Fetch followers and following when modal opens
  useEffect(() => {
    if (isOpen && user?.id) {
      fetchFollowData();
      setCopiedLink(false);
      setIsSearchFocused(false);
    }
  }, [isOpen, user?.id]);

  const fetchFollowData = async () => {
    if (!user?.id) return;

    setIsLoadingFollows(true);
    try {
      // Fetch followers
      const { data: followersData } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id);

      if (followersData && followersData.length > 0) {
        const followerIds = followersData.map(f => f.follower_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url, gender')
          .in('id', followerIds);
        setFollowers(profiles || []);
      } else {
        setFollowers([]);
      }

      // Fetch following
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map(f => f.following_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url, gender')
          .in('id', followingIds);
        setFollowing(profiles || []);
      } else {
        setFollowing([]);
      }
    } catch (error) {
      console.error('Error fetching follow data:', error);
    } finally {
      setIsLoadingFollows(false);
    }
  };

  const createInviteToken = async () => {
    if (!member || !user?.id) return null;
    
    setIsGeneratingLink(true);
    try {
      const { data, error } = await (supabase as any)
        .from('family_invites')
        .insert({
          invited_by: user.id,
          tree_node_id: member.id,
          relation_type: roleInput.trim() || 'oila a\'zosi', 
        })
        .select('token')
        .single();
        
      if (error) throw error;
      return data?.token;
    } catch (error) {
      console.error('Error creating invite token:', error);
      toast({
        title: "Xato",
        description: "Havola yaratishda xatolik ro'y berdi",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const getBaseUrl = () => {
    let url = window.location.origin;
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      url = 'https://avlodona.com'; // Fallback to production URL for Capacitor apps
    }
    return url;
  };

  const handleCopyLink = async () => {
    const token = await createInviteToken();
    if (!token) return;
    
    const baseUrl = getBaseUrl();
    const inviteLink = `${baseUrl}/invite/${token}`;
    const senderName = profile?.name || "foydalanuvchi";
    const roleText = roleInput.trim() ? `${roleInput.trim()} sifatida` : "oila a'zosi sifatida";
    const message = `Sizni ${senderName} o'zining oila daraxtiga ${roleText} taklif qildi. Havola orqali tasdiqlagan holda joyingizni egallang:\n${inviteLink}`;
    
    try {
      await navigator.clipboard.writeText(message);
      setCopiedLink(true);
      toast({
        title: "Nusxalandi!",
        description: "Taklif havolasi xotiraga nusxalandi",
      });
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast({
        title: "Xato",
        description: "Havolani nusxalash imkonsiz",
        variant: "destructive",
      });
    }
  };

  const handlePickContactAndSend = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast({
        title: "Platforma qo'llab-quvvatlanmaydi",
        description: "Kontaktlardan tanlash faqat mobil ilovada mavjud.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const permission = await Contacts.requestPermissions();
      if (permission.contacts !== 'granted') {
        toast({
          title: "Ruxsat yo'q",
          description: "Kontaktlarga kirishga ruxsat berilmadi",
          variant: "destructive",
        });
        return;
      }

      const result = await Contacts.pickContact({ projection: { name: true, phones: true } });
      const contact = result.contact;
      
      if (!contact || !contact.phones || contact.phones.length === 0) {
        toast({
          title: "Raqam yo'q",
          description: "Tanlangan kontaktda telefon raqami mavjud emas",
          variant: "destructive",
        });
        return;
      }
      
      const phoneNumber = contact.phones[0].number;
      const token = await createInviteToken();
      if (!token) return;
      
      const baseUrl = getBaseUrl();
      const inviteLink = `${baseUrl}/invite/${token}`;
      const senderName = profile?.name || "foydalanuvchi";
      const roleText = roleInput.trim() ? `${roleInput.trim()} sifatida` : "oila a'zosi sifatida";
      const message = `Sizni ${senderName} o'zining oila daraxtiga ${roleText} taklif qildi. Havola orqali tasdiqlagan holda joyingizni egallang:\n${inviteLink}`;
      
      // Open native SMS composer correctly for Android/iOS
      const separator = Capacitor.getPlatform() === 'ios' ? '&' : '?';
      window.location.href = `sms:${phoneNumber}${separator}body=${encodeURIComponent(message)}`;
      
      handleClose();
      
    } catch (err) {
      console.log('Error or cancellation during contact picking:', err);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, gender')
        .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
        .neq('id', user?.id)
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Xato",
        description: "Qidirishda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendInvitation = async (userId: string) => {
    if (!member || !user?.id) return;

    setIsSending(true);
    try {
      // Check if invitation already exists
      const { data: existing } = await supabase
        .from('family_invitations')
        .select('id')
        .eq('sender_id', user.id)
        .eq('receiver_id', userId)
        .eq('member_id', member.supabaseId || member.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        toast({
          title: "Mavjud",
          description: "Bu foydalanuvchiga allaqachon taklifnoma yuborilgan",
          variant: "destructive",
        });
        setIsSending(false);
        return;
      }

      const { error } = await supabase
        .from('family_invitations')
        .insert({
          sender_id: user.id,
          receiver_id: userId,
          member_id: member.supabaseId || member.id,
          relation_type: 'family_member',
        });

      if (error) throw error;

      // Create notification for receiver
      await supabase.from('notifications').insert({
        user_id: userId,
        actor_id: user.id,
        type: 'family_invitation',
      });

      toast({
        title: "Yuborildi!",
        description: "Taklifnoma muvaffaqiyatli yuborildi",
      });
      handleClose();
    } catch (error) {
      console.error('Send invitation error:', error);
      toast({
        title: "Xato",
        description: error instanceof Error ? error.message : "Taklifnoma yuborishda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setRoleInput('');
    setIsSearchFocused(false);
    onClose();
  };

  // Filter users by gender if required
  const filterByGender = (users: UserProfile[]) => {
    if (!requiredGender) return users;
    return users.filter(u => u.gender === requiredGender || !u.gender);
  };

  const renderUserList = (users: UserProfile[], emptyMessage: string) => {
    const filteredUsers = filterByGender(users);
    
    if (filteredUsers.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredUsers.map((profileListMember) => {
          const isGenderMatch = !requiredGender || profileListMember.gender === requiredGender;
          const genderMismatch = requiredGender && profileListMember.gender && profileListMember.gender !== requiredGender;
          
          return (
            <div
              key={profileListMember.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-2xl border transition-colors bg-background/40 backdrop-blur-sm",
                genderMismatch 
                  ? "border-border/50 opacity-50" 
                  : "border-border/50 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profileListMember.avatar_url || undefined} />
                  <AvatarFallback className={cn(
                    profileListMember.gender === 'male' ? "bg-sky-500" : "bg-pink-500",
                    "text-primary-foreground"
                  )}>
                    {profileListMember.name?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{profileListMember.name || "Noma'lum"}</p>
                    {profileListMember.gender && (
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          profileListMember.gender === 'male' 
                            ? "border-sky-500/50 text-sky-600 dark:text-sky-400" 
                            : "border-pink-500/50 text-pink-600 dark:text-pink-400"
                        )}
                      >
                        {profileListMember.gender === 'male' ? 'Erkak' : 'Ayol'}
                      </Badge>
                    )}
                  </div>
                  {profileListMember.username && (
                    <div className="truncate">
                      <StarUsername username={profileListMember.username} textClassName="text-sm" />
                    </div>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleSendInvitation(profileListMember.id)}
                disabled={isSending || genderMismatch}
                className={cn(
                  genderMismatch 
                    ? "bg-muted text-muted-foreground" 
                    : "text-white bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/20 hover:from-emerald-300 hover:to-emerald-600"
                )}
              >
                <Send className="w-4 h-4 mr-1" />
                Yuborish
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent hideCloseButton className="sm:max-w-md w-[92vw] max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-3xl border border-white/10 bg-background/80 backdrop-blur-2xl shadow-2xl">
        <DialogHeader className="px-4 pt-3.5 pb-2.5 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-[14px] font-bold tracking-tight">Taklifnoma yuborish</DialogTitle>
              {requiredGender && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "rounded-full px-2 py-0 h-4 flex items-center justify-center text-[9px] font-semibold leading-none",
                    requiredGender === 'male' 
                      ? "border-sky-500/50 text-sky-600 dark:text-sky-400 bg-sky-500/5" 
                      : "border-pink-500/50 text-pink-600 dark:text-pink-400 bg-pink-500/5"
                  )}
                >
                  {requiredGender === 'male' ? 'Faqat erkaklar' : 'Faqat ayollar'}
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 rounded-xl bg-muted/30 hover:bg-muted/50"
              aria-label="Yopish"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-3 px-4 py-3">
          {!isSearchFocused && (
            <>
              <div className="px-0.5">
                <Input
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  placeholder="Qarindoshlik (Masalan: Ota, Ona, Aka...)"
                  className="h-9 rounded-xl bg-muted/30 border-border/50 text-center font-medium text-xs"
                />
              </div>

              {/* New prominent action buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <Button 
                  variant="outline" 
                  onClick={handlePickContactAndSend}
                  disabled={isGeneratingLink}
                  className="h-[74px] flex flex-col gap-1 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 shadow-sm"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <Phone className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                  <div className="text-center leading-tight">
                    <div className="text-[12px] font-semibold">Kontaktlar</div>
                    <div className="text-[10px] text-muted-foreground">SMS orqali yuborish</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopyLink}
                  disabled={isGeneratingLink}
                  className="h-[74px] flex flex-col gap-1 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 shadow-sm"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-colors border",
                    copiedLink ? "bg-emerald-500/10 border-emerald-500/20" : "bg-primary/10 border-primary/20"
                  )}>
                    {copiedLink ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <LinkIcon className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <div className="text-center leading-tight">
                    <div className="text-[12px] font-semibold">Havola</div>
                    <div className="text-[10px] text-muted-foreground">Nusxalash</div>
                  </div>
                </Button>
              </div>

              <div className="relative flex items-center py-0.5">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink-0 mx-3 text-[9px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1 opacity-70">
                  <UserPlus className="w-2.5 h-2.5" /> Yoki tizim ichidan
                </span>
                <div className="flex-grow border-t border-border"></div>
              </div>
            </>
          )}

          {/* Search Input Layout */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Ism yoki username bo'yicha qidirish..."
                className="pl-9 h-9 rounded-xl bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:border-primary/40 text-xs"
              />
            </div>
            {isSearchFocused && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSearchFocused(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded-xl"
              >
                Orqaga
              </Button>
            )}
          </div>

          {/* Search Results or Tabs */}
          <div className="flex-1 min-h-[140px] overflow-hidden flex flex-col">
            {searchQuery.length >= 2 ? (
              <ScrollArea className="flex-grow h-full">
                <div className="pr-3">
                  <p className="text-[11px] text-muted-foreground mb-1.5">Qidiruv natijalari</p>
                  {isSearching ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      Qidirilmoqda...
                    </div>
                  ) : (
                    renderUserList(searchResults, "Foydalanuvchi topilmadi")
                  )}
                </div>
              </ScrollArea>
            ) : (
              <Tabs defaultValue="followers" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="w-full rounded-xl bg-muted/30 p-0.5 border border-border/50 h-8">
                  <TabsTrigger value="followers" className="flex-1 rounded-lg text-xs py-1 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    Kuzatuvchilar
                  </TabsTrigger>
                  <TabsTrigger value="following" className="flex-1 rounded-lg text-xs py-1 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    Kuzatilmoqda
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="followers" className="mt-2.5 flex-1 overflow-hidden focus-visible:ring-0 focus-visible:outline-none">
                  <ScrollArea className="h-full">
                    <div className="pr-3 pb-3">
                      {isLoadingFollows ? (
                        <div className="text-center py-6 text-muted-foreground text-xs">
                          Yuklanmoqda...
                        </div>
                      ) : (
                        renderUserList(followers, "Kuzatuvchilar yo'q")
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="following" className="mt-2.5 flex-1 overflow-hidden focus-visible:ring-0 focus-visible:outline-none">
                  <ScrollArea className="h-full">
                    <div className="pr-3 pb-3">
                      {isLoadingFollows ? (
                        <div className="text-center py-6 text-muted-foreground text-xs">
                          Yuklanmoqda...
                        </div>
                      ) : (
                        renderUserList(following, "Hech kimni kuzatmayapsiz")
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
