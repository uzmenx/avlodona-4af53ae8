import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StarUsername } from '@/components/user/StarUsername';

interface FollowUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface AddMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (memberIds: string[]) => void;
  onBack: () => void;
  type: 'group' | 'channel';
}

export const AddMembersDialog = ({ 
  open, 
  onOpenChange, 
  onComplete,
  onBack,
  type
}: AddMembersDialogProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !open) return;

    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        // Fetch followers
        const { data: followersData } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id);

        if (followersData) {
          const followerIds = followersData.map(f => f.follower_id);
          if (followerIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, name, username, avatar_url')
              .in('id', followerIds);
            setFollowers(profiles || []);
          }
        }

        // Fetch following
        const { data: followingData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (followingData) {
          const followingIds = followingData.map(f => f.following_id);
          if (followingIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, name, username, avatar_url')
              .in('id', followingIds);
            setFollowing(profiles || []);
          }
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [user?.id, open]);

  // Combine followers and following, removing duplicates
  const allUsers = [...followers, ...following].filter((user, index, self) =>
    index === self.findIndex(u => u.id === user.id)
  );

  const filteredUsers = allUsers.filter(u => {
    if (!searchQuery) return true;
    const name = u.name?.toLowerCase() || '';
    const username = u.username?.toLowerCase() || '';
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedIds(newSelected);
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleComplete = () => {
    onComplete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSearchQuery('');
  };

  const handleCancel = () => {
    setSelectedIds(new Set());
    setSearchQuery('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>A'zolar qo'shish</span>
            <span className="text-sm font-normal text-muted-foreground">
              {selectedIds.size} / {allUsers.length}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users list */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-1">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Yuklanmoqda...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchQuery ? 'Hech kim topilmadi' : 'Kuzatuvchi yoki kuzatilayotganlar yo\'q'}
                </p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {user.name || 'Foydalanuvchi'}
                    </p>
                    <div className="truncate">
                      <StarUsername username={user.username || 'username'} textClassName="text-sm" />
                    </div>
                  </div>
                  <Checkbox
                    checked={selectedIds.has(user.id)}
                    onCheckedChange={() => toggleUser(user.id)}
                    className="h-5 w-5"
                  />
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={onBack}>
            Orqaga
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleCancel}>
              Bekor qilish
            </Button>
            <Button onClick={handleComplete}>
              Yaratish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
