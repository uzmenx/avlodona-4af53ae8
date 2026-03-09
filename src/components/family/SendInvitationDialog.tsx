import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Users, MessageSquare, UserPlus } from 'lucide-react';
import { StarUsername } from '@/components/user/StarUsername';

interface UserProfile {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface SendInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (userId: string) => void;
}

export const SendInvitationDialog = ({
  open,
  onOpenChange,
  onSelectUser,
}: SendInvitationDialogProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && user?.id) {
      fetchFollowData();
    }
  }, [open, user?.id]);

  const fetchFollowData = async () => {
    if (!user?.id) return;

    try {
      // Fetch followers
      const { data: followersData } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id);

      if (followersData) {
        const followerIds = followersData.map(f => f.follower_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', followerIds);
        setFollowers(profiles || []);
      }

      // Fetch following
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followingData) {
        const followingIds = followingData.map(f => f.following_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', followingIds);
        setFollowing(profiles || []);
      }
    } catch (error) {
      console.error('Error fetching follow data:', error);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .or(`name.ilike.%${query}%,username.ilike.%${query}%`)
        .neq('id', user?.id)
        .limit(20);

      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderUserList = (users: UserProfile[]) => (
    <ScrollArea className="h-[300px]">
      {users.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Foydalanuvchilar topilmadi</p>
      ) : (
        <div className="space-y-2">
          {users.map((profile) => (
            <button
              key={profile.id}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              onClick={() => {
                onSelectUser(profile.id);
                onOpenChange(false);
              }}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {profile.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="text-left flex-1 min-w-0">
                <p className="font-medium truncate">{profile.name || 'Foydalanuvchi'}</p>
                {profile.username && (
                  <div className="truncate">
                    <StarUsername username={profile.username} textClassName="text-sm" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </ScrollArea>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Taklifnoma yuborish</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ism yoki username bo'yicha qidirish..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {searchQuery.length >= 2 ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Qidiruv natijalari</p>
              {isLoading ? (
                <p className="text-center py-8 text-muted-foreground">Qidirilmoqda...</p>
              ) : (
                renderUserList(searchResults)
              )}
            </div>
          ) : (
            <Tabs defaultValue="followers">
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
                {renderUserList(followers)}
              </TabsContent>

              <TabsContent value="following" className="mt-4">
                {renderUserList(following)}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
