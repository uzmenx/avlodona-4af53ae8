import { NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/useConversations';
import { useNotifications } from '@/hooks/useNotifications';

type BottomNavItem = {
  kind: 'icon';
  label: string;
  path: string;
  icon: string;
  activeIcon?: string;
  hover: string;
  badgeType?: 'messages' | 'notifications';
};

export const BottomNav = () => {
  const { totalUnread } = useConversations();
  const { unreadCount: notifUnread } = useNotifications();

  const location = useLocation();
  const lastTapTsRef = useRef(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const initialHeight = window.innerHeight;
    const handleResize = () => {
      const currentHeight = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      setIsKeyboardVisible(currentHeight < initialHeight * 0.85);
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const navItems: BottomNavItem[] = [
    {
      kind: 'icon',
      label: 'Home',
      path: '/',
      icon: 'streamline-plump:home-1-solid',
      hover: 'hover:scale-110 hover:-translate-y-1',
    },
    {
      kind: 'icon',
      label: 'Create',
      path: '/create',
      icon: 'bi:cloud-plus-fill',
      hover: 'hover:-translate-y-1 hover:scale-105',
    },
    {
      kind: 'icon',
      label: 'Family',
      path: '/relatives',
      icon: 'mdi:family',
      hover: 'hover:scale-110',
    },
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
        : null;
    if (!eventName) return;
    window.dispatchEvent(new CustomEvent(eventName, { detail: { action } }));
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[70] transition-all duration-300 flex justify-center',
        isKeyboardVisible
          ? 'translate-y-20 opacity-0 pointer-events-none'
          : 'translate-y-0 opacity-100'
      )}
    >
      <div className="pb-[env(safe-area-inset-bottom,8px)] pt-1 px-4 w-full flex justify-center">
        <div className="h-14 w-full max-w-[240px] rounded-full border border-white/20 bg-background/20 text-foreground shadow-[0_15px_45px_rgba(0,0,0,0.18)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/10 flex items-center justify-around px-3">
          {navItems.map((item) => {
            const badgeCount = getBadgeCount(item.badgeType);
            const isCreate = item.label === 'Create';
            const isFamily = item.label === 'Family';

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={(e) => {
                  if (isCreate) return;
                  const active = isSameTab(location.pathname, item.path);
                  if (!active) return;
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
                    'relative flex items-center justify-center h-11 rounded-full transition-all duration-300 ease-out',
                    'hover:bg-foreground/10',
                    isCreate ? 'w-14' : 'w-12',
                    isActive && !isCreate && 'bg-foreground/10 text-primary'
                  )
                }
              >
                {({ isActive }) => (
                  <>
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

                    {badgeCount > 0 && (
                      <div className="absolute -top-1 -right-1 z-20 h-4 min-w-4 px-1.5 py-0 flex items-center justify-center text-[10px] rounded-full bg-destructive text-destructive-foreground">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </div>
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
