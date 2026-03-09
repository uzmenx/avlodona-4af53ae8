import { useState, useEffect } from 'react';
import { Search, Send, User, Users, UserPlus } from 'lucide-react';
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingFollows, setIsLoadingFollows] = useState(false);

  // The gender that the invited person should be (matches the placeholder member's gender)
  const requiredGender = member?.gender;

  // Fetch followers and following when modal opens
  useEffect(() => {
    if (isOpen && user?.id) {
      fetchFollowData();
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
    } catch (error: any) {
      console.error('Send invitation error:', error);
      toast({
        title: "Xato",
        description: error.message || "Taklifnoma yuborishda xatolik",
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
        {filteredUsers.map((profile) => {
          const isGenderMatch = !requiredGender || profile.gender === requiredGender;
          const genderMismatch = requiredGender && profile.gender && profile.gender !== requiredGender;
          
          return (
            <div
              key={profile.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                genderMismatch 
                  ? "border-border/50 opacity-50" 
                  : "border-border hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className={cn(
                    profile.gender === 'male' ? "bg-sky-500" : "bg-pink-500",
                    "text-primary-foreground"
                  )}>
                    {profile.name?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{profile.name || "Noma'lum"}</p>
                    {profile.gender && (
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          profile.gender === 'male' 
                            ? "border-sky-500/50 text-sky-600 dark:text-sky-400" 
                            : "border-pink-500/50 text-pink-600 dark:text-pink-400"
                        )}
                      >
                        {profile.gender === 'male' ? 'Erkak' : 'Ayol'}
                      </Badge>
                    )}
                  </div>
                  {profile.username && (
                    <div className="truncate">
                      <StarUsername username={profile.username} textClassName="text-sm" />
                    </div>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleSendInvitation(profile.id)}
                disabled={isSending || genderMismatch}
                className={cn(
                  genderMismatch 
                    ? "bg-muted text-muted-foreground" 
                    : "bg-emerald-500 hover:bg-emerald-600 text-primary-foreground"
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
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-center">
            Taklifnoma yuborish
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {member && (
            <div className="text-center">
              <p className="text-muted-foreground text-sm">
                <span className="font-medium text-foreground">{member.name || "Noma'lum"}</span> uchun foydalanuvchi tanlang
              </p>
              {requiredGender && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "mt-2",
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

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Ism yoki username bo'yicha qidirish..."
              className="pl-10"
            />
          </div>

          {/* Search Results or Tabs */}
          <div className="flex-1 overflow-hidden">
            {searchQuery.length >= 2 ? (
              <ScrollArea className="h-[300px]">
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
              <Tabs defaultValue="followers" className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="followers" className="flex-1">
                    <Users className="h-4 w-4 mr-2" />
                    Kuzatuvchilar
                  </TabsTrigger>
                  <TabsTrigger value="following" className="flex-1">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Kuzatilmoqda
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="followers" className="mt-4">
                  <ScrollArea className="h-[250px]">
                    <div className="pr-4">
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

                <TabsContent value="following" className="mt-4">
                  <ScrollArea className="h-[250px]">
                    <div className="pr-4">
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
