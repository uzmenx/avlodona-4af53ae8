import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Clock } from 'lucide-react';

import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { addSwipeGestures } from '@/utils/scrollBehavior';
import { FollowButton } from '@/components/user/FollowButton';
import { MessageButton } from '@/components/chat/MessageButton';
import { useFollowLists } from '@/hooks/useFollowLists';
import { useUnfollowHistory } from '@/hooks/useUnfollowHistory';

export type FollowHubTab = 'followers' | 'following' | 'unfollow';

interface FollowHubDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  initialTab: FollowHubTab;
  showUnfollowTab?: boolean;
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

const formatTs = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

export function FollowHubDrawer({ open, onOpenChange, userId, initialTab, showUnfollowTab = true }: FollowHubDrawerProps) {
  const safeInitialTab: FollowHubTab = useMemo(() => {
    if (!showUnfollowTab && initialTab === 'unfollow') return 'followers';
    return initialTab;
  }, [initialTab, showUnfollowTab]);

  const [tab, setTab] = useState<FollowHubTab>(safeInitialTab);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const swipeRef = useRef<HTMLDivElement | null>(null);

  const tabOrder: FollowHubTab[] = useMemo(
    () => (showUnfollowTab ? ['followers', 'following', 'unfollow'] : ['followers', 'following']),
    [showUnfollowTab]
  );
  const tabIndex = useMemo(() => tabOrder.indexOf(tab), [tab, tabOrder]);

  const scrollToTab = useCallback((nextTab: FollowHubTab) => {
    const idx = tabOrder.indexOf(nextTab);
    if (idx < 0) return;
    setTab(nextTab);
    carouselApi?.scrollTo(idx);
  }, [carouselApi, tabOrder]);

  useEffect(() => {
    if (!open) return;
    setTab(safeInitialTab);
    const idx = tabOrder.indexOf(safeInitialTab);
    if (idx >= 0) carouselApi?.scrollTo(idx);
  }, [carouselApi, open, safeInitialTab, tabOrder]);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      const idx = carouselApi.selectedScrollSnap();
      const nextTab = tabOrder[idx];
      if (nextTab && nextTab !== tab) setTab(nextTab);
    };
    carouselApi.on('select', onSelect);
    carouselApi.on('reInit', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi, tab, tabOrder]);

  useEffect(() => {
    if (!open) return;
    const el = swipeRef.current;
    if (!el) return;

    const idx = tabOrder.indexOf(tab);
    if (idx < 0) return;

    const cleanup = addSwipeGestures(
      el,
      () => {
        const next = tabOrder[idx + 1];
        if (next) scrollToTab(next);
      },
      () => {
        const prev = tabOrder[idx - 1];
        if (prev) scrollToTab(prev);
      }
    );

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [open, scrollToTab, tab, tabOrder]);

  const followers = useFollowLists(userId, 'followers', open && tab === 'followers');
  const following = useFollowLists(userId, 'following', open && tab === 'following');
  const unfollow = useUnfollowHistory({ mode: 'incoming', enabled: showUnfollowTab && open && tab === 'unfollow' });

  const title = useMemo(() => {
    if (tab === 'followers') return 'Kuzatuvchilar';
    if (tab === 'following') return 'Kuzatilmoqda';
    return 'Unfollow history';
  }, [tab]);

  const list = tab === 'followers' ? followers : tab === 'following' ? following : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          'p-0 rounded-t-2xl border-t border-white/10 bg-background/95 backdrop-blur-xl',
          'h-[82vh]'
        )}
      >
        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-extrabold tracking-tight truncate">{title}</div>
            </div>

            <div className="flex items-center gap-1 bg-muted/40 rounded-full p-1">
              <button
                type="button"
                onClick={() => scrollToTab('followers')}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-bold transition-colors',
                  tab === 'followers' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
              >
                Followers
              </button>
              <button
                type="button"
                onClick={() => scrollToTab('following')}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-bold transition-colors',
                  tab === 'following' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
              >
                Following
              </button>
              {showUnfollowTab && (
                <button
                  type="button"
                  onClick={() => scrollToTab('unfollow')}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-bold transition-colors flex items-center gap-1',
                    tab === 'unfollow' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Unfollow
                </button>
              )}
            </div>
          </div>
        </div>

        <div ref={swipeRef} className="px-5 pb-5 flex-1 min-h-0">
          <Carousel
            setApi={(api) => setCarouselApi(api)}
            opts={{ align: 'start', skipSnaps: false, startIndex: Math.max(0, tabIndex) }}
            className="h-full"
          >
            <CarouselContent className="h-full">
              <CarouselItem className="h-full">
                {followers.error ? (
                  <div className="text-sm text-destructive">{followers.error}</div>
                ) : followers.isLoading ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Yuklanmoqda...</div>
                ) : followers.users.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Hozircha bo'sh</div>
                ) : (
                  <ScrollArea className="h-full pr-2">
                    <div className="space-y-2">
                      {followers.users.map((u) => (
                        <div
                          key={u.id}
                          className={cn(
                            'flex items-center gap-3 rounded-2xl px-3 py-2',
                            'border border-white/10 bg-white/5 backdrop-blur-md'
                          )}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback className="bg-white/10 text-sm font-bold">
                              {getInitials(u.name || u.username)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-foreground">{u.name || u.username || 'User'}</div>
                            <div className="truncate text-xs text-muted-foreground">{u.username ? `@${u.username}` : ''}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <MessageButton userId={u.id} className="h-8 text-xs px-3" />
                            <FollowButton targetUserId={u.id} size="sm" className="h-8 text-xs px-3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CarouselItem>

              <CarouselItem className="h-full">
                {following.error ? (
                  <div className="text-sm text-destructive">{following.error}</div>
                ) : following.isLoading ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Yuklanmoqda...</div>
                ) : following.users.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Hozircha bo'sh</div>
                ) : (
                  <ScrollArea className="h-full pr-2">
                    <div className="space-y-2">
                      {following.users.map((u) => (
                        <div
                          key={u.id}
                          className={cn(
                            'flex items-center gap-3 rounded-2xl px-3 py-2',
                            'border border-white/10 bg-white/5 backdrop-blur-md'
                          )}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback className="bg-white/10 text-sm font-bold">
                              {getInitials(u.name || u.username)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-foreground">{u.name || u.username || 'User'}</div>
                            <div className="truncate text-xs text-muted-foreground">{u.username ? `@${u.username}` : ''}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <MessageButton userId={u.id} className="h-8 text-xs px-3" />
                            <FollowButton targetUserId={u.id} size="sm" className="h-8 text-xs px-3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CarouselItem>

              {showUnfollowTab && (
                <CarouselItem className="h-full">
                  {unfollow.history.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Hozircha bo'sh</div>
                  ) : (
                    <ScrollArea className="h-full pr-2">
                      <div className="space-y-2">
                        {unfollow.history.map((r) => {
                          const displayName = r.profile?.name || r.profile?.username || 'User';
                          const username = r.profile?.username ? `@${r.profile.username}` : '';
                          return (
                            <div
                              key={r.id}
                              className={cn(
                                'flex items-center gap-3 rounded-2xl px-3 py-2',
                                'border border-white/10 bg-white/5 backdrop-blur-md'
                              )}
                            >
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={r.profile?.avatar_url || undefined} />
                                <AvatarFallback className="bg-white/10 text-sm font-bold">
                                  {getInitials(displayName)}
                                </AvatarFallback>
                              </Avatar>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold text-foreground">{displayName}</div>
                                <div className="truncate text-xs text-muted-foreground">{username}</div>
                              </div>

                              <div className="text-right">
                                <div className="text-[11px] text-muted-foreground">{formatTs(r.created_at)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CarouselItem>
              )}
            </CarouselContent>
          </Carousel>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
