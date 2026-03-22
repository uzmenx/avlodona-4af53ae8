import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Check, ArrowLeft, Users, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StarUsername } from '@/components/user/StarUsername';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
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
      <DialogContent className="sm:max-w-md max-h-[85vh] border-white/10 bg-background/60 backdrop-blur-2xl p-0 overflow-hidden rounded-[32px] shadow-2xl flex flex-col">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent blur-sm" />
        
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-center justify-between mb-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onBack}
                className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-xl font-extrabold tracking-tight">
                {t('members') || "A'zolar qo'shish"}
              </DialogTitle>
              <div className="h-8 w-8" /> {/* Spacer */}
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                {selectedIds.size} tanlandi
              </div>
            </div>
          </DialogHeader>

          <div className="relative group/search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within/search:text-primary transition-colors" />
            <Input
              placeholder={t('searchChats') || "Qidirish..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white/5 border-white/10 rounded-2xl focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-1 pb-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                <p className="text-sm text-muted-foreground">{t('loading') || 'Yuklanmoqda...'}</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 px-6">
                <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 border border-white/5">
                  <Users className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Hech kim topilmadi' : 'Hozircha kuzatuvchilar yo\'q'}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredUsers.map((u, idx) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.03 } }}
                    onClick={() => toggleUser(u.id)}
                    className={cn(
                      "group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border border-transparent",
                      selectedIds.has(u.id) 
                        ? "bg-primary/10 border-primary/20" 
                        : "hover:bg-white/5 hover:border-white/5"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-11 w-11 border border-white/10">
                        <AvatarImage src={u.avatar_url || undefined} className="object-cover" />
                        <AvatarFallback className="bg-gradient-to-br from-primary/10 to-violet-500/10 text-xs">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      {selectedIds.has(u.id) && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-background"
                        >
                          <Check className="h-3 w-3" />
                        </motion.div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                        {u.name || 'Foydalanuvchi'}
                      </p>
                      <div className="truncate opacity-70">
                        <StarUsername username={u.username || 'username'} textClassName="text-[11px]" />
                      </div>
                    </div>

                    <Checkbox
                      checked={selectedIds.has(u.id)}
                      onCheckedChange={() => toggleUser(u.id)}
                      className="h-5 w-5 rounded-lg border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        <div className="p-6 bg-black/10 backdrop-blur-md border-t border-white/5">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={handleCancel}
              className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
            >
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button 
              onClick={handleComplete} 
              disabled={selectedIds.size === 0}
              className="flex-[1.5] h-12 rounded-2xl bg-gradient-to-r from-primary to-violet-600 text-white shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
            >
              <span>{t('addNav') || 'Yaratish'}</span>
              <Check className="h-4 w-4 group-hover:scale-110 transition-transform" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
