import { useState, useCallback, useMemo } from 'react';
import { Users, Map as MapIcon, List, X, MessageSquare, User as UserIcon, ImagePlus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useOtherUserTree } from '@/hooks/useOtherUserTree';
import { FamilyTreeCanvas } from '@/components/family-v2/FamilyTreeCanvas';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FamilyMember } from '@/types/family';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface FamilyMembersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string | undefined;
}

const getInitials = (name: string | null | undefined) => {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export function FamilyMembersSheet({ open, onOpenChange, ownerId }: FamilyMembersSheetProps) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  
  const { members, positions, isLoading } = useOtherUserTree(open ? ownerId : undefined);
  const memberList = Object.values(members);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handlePositionChange = useCallback(() => {}, []);
  const handleOpenProfile = useCallback((member: FamilyMember) => {
    setSelectedMember(member);
  }, []);

  const handleCloseProfile = useCallback(() => {
    setSelectedMember(null);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (selectedMember?.linkedUserId) {
      onOpenChange(false);
      navigate(`/chat/${selectedMember.linkedUserId}`);
    }
  }, [selectedMember, navigate, onOpenChange]);

  const handleViewProfile = useCallback(() => {
    if (selectedMember?.linkedUserId) {
      onOpenChange(false);
      navigate(`/user/${selectedMember.linkedUserId}`);
    }
  }, [selectedMember, navigate, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'p-0 rounded-t-3xl border-t border-white/10 bg-background/95 backdrop-blur-xl',
          'h-[85vh] flex flex-col'
        )}
      >
        <SheetHeader className="px-5 pt-5 pb-3 flex-shrink-0 text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-500" />
              Oila a'zolari
            </SheetTitle>
            
            <Tabs 
              value={viewMode} 
              onValueChange={(v) => setViewMode(v as 'list' | 'map')}
              className="w-auto"
            >
              <TabsList className="grid w-full grid-cols-2 h-9 bg-white/5 border border-white/10 rounded-full p-1">
                <TabsTrigger 
                  value="map" 
                  className="rounded-full text-xs data-[state=active]:bg-sky-500 data-[state=active]:text-white"
                >
                  <MapIcon className="w-3.5 h-3.5 mr-1.5" />
                  Xarita
                </TabsTrigger>
                <TabsTrigger 
                  value="list" 
                  className="rounded-full text-xs data-[state=active]:bg-sky-500 data-[state=active]:text-white"
                >
                  <List className="w-3.5 h-3.5 mr-1.5" />
                  Ro'yxat
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : memberList.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
              <Users className="w-12 h-12 opacity-20" />
              <p>Hozircha bo'sh</p>
            </div>
          ) : viewMode === 'map' ? (
            <div className="absolute inset-0">
               <FamilyTreeCanvas
                  members={members}
                  positions={positions}
                  onOpenProfile={handleOpenProfile}
                  onPositionChange={handlePositionChange}
                  readOnly={true}
                />
            </div>
          ) : (
            <ScrollArea className="h-full px-5">
              <div className="space-y-2 pb-8 pt-2">
                {memberList.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex items-center gap-4 rounded-2xl px-4 py-3',
                      'border border-white/10 bg-white/5 backdrop-blur-md transition-colors hover:bg-white/10'
                    )}
                  >
                    <Avatar className="h-12 w-12 border-2 border-white/10 shadow-sm">
                      <AvatarImage src={m.photoUrl || undefined} className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-bold">
                        {getInitials(m.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div 
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => handleOpenProfile(m)}
                    >
                      <div className="truncate text-base font-bold text-foreground hover:text-sky-400 transition-colors">{m.name}</div>
                      <div className="truncate text-sm text-sky-400 capitalize">
                         {m.gender === 'male' ? 'Erkak' : 'Ayol'} 
                         {m.birthYear ? ` • ${m.birthYear}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Overlay Card - Global to the content area */}
          {selectedMember && (
            <div 
              className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" 
              onClick={handleCloseProfile}
            >
              <div 
                className="w-full max-w-sm bg-card/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
              >
                {/* Cover Photo */}
                <div className="h-32 bg-gradient-to-br from-sky-500/20 to-purple-500/20 relative">
                  {selectedMember.coverUrl && (
                    <img src={selectedMember.coverUrl} alt="Cover" className="w-full h-full object-cover opacity-80" />
                  )}
                  <button 
                    onClick={handleCloseProfile}
                    className="absolute top-3 right-3 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="px-5 pb-6">
                  {/* Avatar */}
                  <div className="relative -mt-12 mb-3 flex justify-center">
                    <Avatar className="w-24 h-24 border-4 border-card shadow-xl bg-muted">
                      <AvatarImage src={selectedMember.photoUrl || undefined} className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-br from-sky-500 to-indigo-600 text-white text-2xl font-bold">
                        {getInitials(selectedMember.name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  {/* Info */}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-foreground">{selectedMember.name}</h3>
                    <p className="text-sm text-sky-500 mt-1 capitalize font-medium">
                      {selectedMember.gender === 'male' ? 'Erkak' : 'Ayol'}
                      {selectedMember.birthYear ? ` • ${selectedMember.birthYear}` : ''}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    {selectedMember.linkedUserId ? (
                      <>
                        <button 
                          onClick={handleSendMessage}
                          className="flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white py-2.5 rounded-xl font-semibold transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Xabar
                        </button>
                        <button 
                          onClick={handleViewProfile}
                          className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-foreground py-2.5 rounded-xl font-semibold transition-colors border border-white/5"
                        >
                          <UserIcon className="w-4 h-4" />
                          Profil
                        </button>
                      </>
                    ) : (
                      <div className="col-span-2 text-center py-2 px-4 bg-white/5 rounded-xl border border-white/5 text-sm text-muted-foreground">
                        Platformada ro'yxatdan o'tmagan profil
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
