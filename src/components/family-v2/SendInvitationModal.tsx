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

  // The gender that the invited person should be (matches the placeholder member's gender)
  const requiredGender = member?.gender;

  // Fetch followers and following when modal opens
  useEffect(() => {
    if (isOpen && user?.id) {
      fetchFollowData();
      setCopiedLink(false);
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
          relation_type: 'family_member', 
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

  const handleCopyLink = async () => {
    const token = await createInviteToken();
    if (!token) return;
    
    // Base URL dynamically based on environment or fixed
    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}/invite/${token}`;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
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
      
      const baseUrl = window.location.origin;
      const inviteLink = `${baseUrl}/invite/${token}`;
      const senderName = profile?.name || "foydalanuvchi";
      const message = `Siz ${senderName} oila daraxtiga qo'shilishga taklif qilindingiz!\n${inviteLink}`;
      
      // Open native SMS composer
      window.open(`sms:${phoneNumber}?body=${encodeURIComponent(message)}`, '_system');
      
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
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-[28px] border border-white/10 bg-background/80 backdrop-blur-2xl shadow-2xl">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[15px] font-semibold tracking-tight">Taklifnoma yuborish</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-9 w-9 rounded-2xl bg-muted/30 hover:bg-muted/50"
              aria-label="Yopish"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 px-5 py-4">
          {member && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{member.name || "Noma'lum"}</span> uchun foydalanuvchi taklif qiling
              </p>
              {requiredGender && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "mt-2 mb-0 rounded-full px-3 py-1 text-[11px] font-semibold",
                    requiredGender === 'male' 
                      ? "border-sky-500/50 text-sky-600 dark:text-sky-400" 
                      : "border-pink-500/50 text-pink-600 dark:text-pink-400"
                  )}
                >
                  Faqat {requiredGender === 'male' ? 'erkak' : 'ayol'} foydalanuvchilar
                </Badge>
              )}
            </div>
          )}

          {/* New prominent action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              onClick={handlePickContactAndSend}
              disabled={isGeneratingLink}
              className="h-[92px] flex flex-col gap-2 rounded-[22px] border-white/10 bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 shadow-sm"
            >
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Phone className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-center leading-tight">
                <div className="text-[13px] font-semibold">Kontaktlar</div>
                <div className="text-[11px] text-muted-foreground">SMS orqali yuborish</div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyLink}
              disabled={isGeneratingLink}
              className="h-[92px] flex flex-col gap-2 rounded-[22px] border-white/10 bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 shadow-sm"
            >
              <div className={cn(
                "w-9 h-9 rounded-2xl flex items-center justify-center transition-colors border",
                copiedLink ? "bg-emerald-500/10 border-emerald-500/20" : "bg-primary/10 border-primary/20"
              )}>
                {copiedLink ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <LinkIcon className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="text-center leading-tight">
                <div className="text-[13px] font-semibold">Havola</div>
                <div className="text-[11px] text-muted-foreground">Nusxalash</div>
              </div>
            </Button>
          </div>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink-0 mx-4 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1.5 opacity-80">
              <UserPlus className="w-3 h-3" /> Yoki tizim ichidan
            </span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Ism yoki username bo'yicha qidirish..."
              className="pl-10 h-11 rounded-2xl bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:border-primary/40"
            />
          </div>

          {/* Search Results or Tabs */}
          <div className="flex-1 overflow-hidden">
            {searchQuery.length >= 2 ? (
              <ScrollArea className="h-[250px] sm:h-[300px]">
                <div className="pr-4">
                  <p className="text-sm text-muted-foreground mb-2">Qidiruv natijalari</p>
                  {isSearching ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Qidirilmoqda...
                    </div>
                  ) : (
                    renderUserList(searchResults, "Foydalanuvchi topilmadi")
                  )}
                </div>
              </ScrollArea>
            ) : (
              <Tabs defaultValue="followers" className="flex-1 flex flex-col h-[250px] sm:h-[300px]">
                <TabsList className="w-full rounded-2xl bg-muted/30 p-1 border border-border/50">
                  <TabsTrigger value="followers" className="flex-1 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Users className="h-4 w-4 mr-2" />
                    Kuzatuvchilar
                  </TabsTrigger>
                  <TabsTrigger value="following" className="flex-1 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Kuzatilmoqda
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="followers" className="mt-4 flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="pr-4 pb-4">
                      {isLoadingFollows ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Yuklanmoqda...
                        </div>
                      ) : (
                        renderUserList(followers, "Kuzatuvchilar yo'q")
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="following" className="mt-4 flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="pr-4 pb-4">
                      {isLoadingFollows ? (
                        <div className="text-center py-8 text-muted-foreground">
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
