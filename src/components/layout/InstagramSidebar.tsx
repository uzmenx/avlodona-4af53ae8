import { NavLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type NavItem = {
  to: string;
  icon?: string;
  type?: 'icon' | 'profile';
  hoverClassName?: string;
};

const navItems: NavItem[] = [
  { to: '/', icon: 'streamline-plump:home-1-solid', hoverClassName: 'hover:scale-110 hover:-translate-y-1' },
  { to: '/relatives', icon: 'mdi:family', hoverClassName: 'hover:scale-110' },
  { to: '/create', icon: 'ph:plus-fill', hoverClassName: 'hover:rotate-90 hover:scale-110' },
  { to: '/messages', icon: 'streamline-flex:mail-send-email-message-circle-solid', hoverClassName: 'hover:rotate-12 hover:scale-110' },
  { to: '/profile', type: 'profile', hoverClassName: 'hover:ring-2 hover:ring-white' },
];

export const InstagramSidebar = () => {
  const { profile } = useAuth();

  const initials = (profile?.name || profile?.username || 'P')[0]?.toUpperCase();

  return (
    <aside className="hidden md:block fixed left-0 top-0 bottom-0 z-[60] w-20 border-r border-border bg-background text-foreground">
      <div className="h-full flex flex-col px-2 py-4">
        <nav className="mt-2 flex-1 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'group flex items-center justify-center h-12 rounded-xl transition-all duration-300 ease-in-out',
                  'hover:bg-gray-100 dark:hover:bg-gray-900',
                  isActive && 'font-bold text-primary'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.type === 'profile' ? (
                    <div
                      className={cn(
                        'rounded-full p-[1px] transition-all duration-300 ease-in-out',
                        item.hoverClassName,
                        isActive ? 'ring-2 ring-primary' : 'ring-0'
                      )}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                        <AvatarFallback className="text-[11px]">{initials}</AvatarFallback>
                      </Avatar>
                    </div>
                  ) : (
                    <Icon
                      icon={item.icon!}
                      className={cn(
                        'h-7 w-7 shrink-0 transition-all duration-300 ease-in-out',
                        item.hoverClassName,
                        isActive ? 'text-primary' : 'text-current'
                      )}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
};
