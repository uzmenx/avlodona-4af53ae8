import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/useConversations';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


type BottomNavItem =
  | {
      kind: 'icon';
      label: string;
      path: string;
      icon: string;
      hover: string;
      badgeType?: 'messages' | 'notifications';
    }
  | {
      kind: 'profile';
      label: string;
      path: string;
      hover: string;
    };

export const BottomNav = () => {
  const { totalUnread } = useConversations();
  const { unreadCount: notifUnread } = useNotifications();
  const { profile } = useAuth();

  const location = useLocation();
  const lastTapTsRef = useRef(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Detect keyboard visibility on Android/iOS
  useEffect(() => {
    const initialHeight = window.innerHeight;
    const handleResize = () => {
      const currentHeight = window.visualViewport 
        ? window.visualViewport.height 
        : window.innerHeight;
      
      // If viewport height drops below 85% of initial height, keyboard is visible
      const isVisible = currentHeight < initialHeight * 0.85;
      setIsKeyboardVisible(isVisible);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const initials = (profile?.name || profile?.username || 'P')[0]?.toUpperCase();

  const navItems: BottomNavItem[] = [
    {
      kind: 'icon',
      label: 'Home',
      path: '/',
      icon: 'streamline-plump:home-1-solid',
      hover: 'hover:scale-110 hover:-translate-y-1',
    },
    { kind: 'icon', label: 'Family', path: '/relatives', icon: 'mdi:family', hover: 'hover:scale-110' },
    {
      kind: 'icon',
      label: 'Create',
      path: '/create',
      icon: 'bi:cloud-plus-fill',
      hover: 'hover:-translate-y-1 hover:scale-105',
    },
    {
      kind: 'icon',
      label: 'Messages',
      path: '/messages',
      icon: 'streamline-flex:mail-send-email-message-circle-solid',
      hover: 'hover:rotate-12 hover:scale-110',
      badgeType: 'messages' as const,
    },
    { kind: 'profile', label: 'Profile', path: '/profile', hover: 'hover:ring-2 hover:ring-white' },
  ];

  const getBadgeCount = (badgeType?: 'messages' | 'notifications') => {
    if (badgeType === 'messages') return totalUnread;
    if (badgeType === 'notifications') return notifUnread;
    return 0;
  };

  const normalizePath = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

  const isSameTab = (currentPath: string, tabPath: string) => {
    const cur = normalizePath(currentPath);
    const tab = normalizePath(tabPath);
    if (tab === '/') return cur === '/';
    return cur === tab || cur.startsWith(`${tab}/`);
  };

  const dispatchNavAction = (path: string, action: 'scrollTop' | 'refresh') => {
    const eventName =
      path === '/'
        ? 'avlodona:nav:home'
        : path === '/relatives'
          ? 'avlodona:nav:family'
          : path === '/messages'
            ? 'avlodona:nav:messages'
            : path === '/profile'
              ? 'avlodona:nav:profile'
              : null;
    if (!eventName) return;
    window.dispatchEvent(new CustomEvent(eventName, { detail: { action } }));
  };

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-[70] transition-transform duration-300",
      isKeyboardVisible ? "translate-y-20 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
    )}>
      <div className="px-3 pb-[env(safe-area-inset-bottom,8px)] pt-1">
        <div className="h-14 max-w-lg mx-auto rounded-full border border-white/20 bg-background/20 text-foreground shadow-[0_15px_45px_rgba(0,0,0,0.15)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/10 flex items-center justify-around px-2">
          {navItems.map((item) => {
            const badgeCount = item.kind === 'profile' ? 0 : getBadgeCount(item.badgeType);

            const isCreate = item.kind === 'icon' && item.label === 'Create';
            const isFamily = item.kind === 'icon' && item.label === 'Family';

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={(e) => {
                  // Create should always navigate.
                  if (isCreate) return;

                  const active = isSameTab(location.pathname, item.path);
                  if (!active) return;

                  // Active tab tapped: prevent navigation and perform actions.
                  e.preventDefault();

                  const now = Date.now();
                  const DOUBLE_TAP_DELAY = 300;
                  if (now - lastTapTsRef.current < DOUBLE_TAP_DELAY) {
                    lastTapTsRef.current = 0;
                    dispatchNavAction(item.path, 'refresh');
                  } else {
                    lastTapTsRef.current = now;
                    dispatchNavAction(item.path, 'scrollTop');
                  }
                }}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center justify-center h-11 w-12 rounded-full transition-all duration-300 ease-out',
                    'hover:bg-foreground/10',
                    isCreate && 'w-14',
                    isActive && !isCreate && 'bg-foreground/10 text-primary'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.kind === 'profile' ? (
                      <div
                        className={cn(
                          'rounded-full p-[1px] transition-all duration-300 ease-in-out',
                          item.hover,
                          isActive ? 'ring-2 ring-primary' : 'ring-0'
                        )}
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                          <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                        </Avatar>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'relative flex items-center justify-center transition-all duration-300 ease-out',
                          isCreate &&
                            'h-11 w-11 rounded-full border border-white/15 bg-foreground/10 shadow-[0_12px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl supports-[backdrop-filter]:bg-foreground/5'
                        )}
                      >
                        <Icon
                          icon={item.icon}
                          className={cn(
                            'transition-all duration-300 ease-out',
                            isCreate ? 'h-6 w-6' : isFamily ? 'h-7 w-7' : 'h-6 w-6',
                            item.hover,
                            isActive && isCreate && 'text-primary'
                          )}
                        />
                      </div>
                    )}

                    {badgeCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 z-20 h-4 min-w-4 px-1.5 py-0 flex items-center justify-center text-[10px] rounded-full"
                      >
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </Badge>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
