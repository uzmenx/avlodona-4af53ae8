import { useState, useEffect } from 'react';
import { Save, Search, X, Users, MessageCircle, ArrowLeft } from 'lucide-react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TreeRatings } from '@/components/family-v2/TreeRatings';
import { FamilyCalendarSheet } from '@/components/family-v2/FamilyCalendarSheet';
import { TreeStatsDrawer } from '@/components/family-v2/TreeStatsDrawer';
import { FamilyMember } from '@/types/family';

interface TreePostHeaderProps {
  onSave: () => void | Promise<void>;
  onPublish: () => void;
  members?: Record<string, FamilyMember>;
  /** Total profiles in the tree */
  totalCount?: number;
  /** Linked / active (live user) profiles */
  activeCount?: number;
  isSaving?: boolean;
  hasCurrentPost?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
}

export const TreePostHeader = ({
  onSave,
  onPublish,
  members,
  totalCount,
  activeCount,
  isSaving,
  hasCurrentPost,
  searchQuery,
  onSearchChange,
  onClearSearch,
}: TreePostHeaderProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'all' | 'active'>('all');
  const [isSearchActive, setIsSearchActive] = useState(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app:forceHideNav', { detail: { hide: isSearchActive } }));
    return () => {
      window.dispatchEvent(new CustomEvent('app:forceHideNav', { detail: { hide: false } }));
    };
  }, [isSearchActive]);

  const memberList = Object.values(members ?? {});
  const total = totalCount ?? memberList.length;
  const active = activeCount ?? memberList.filter(m => !!m.linkedUserId).length;

  const openDrawer = (mode: 'all' | 'active') => {
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  return (
    <>
      <div className="absolute top-2 left-0 right-0 z-50 px-3 pointer-events-none mt-[env(safe-area-inset-top,0px)]">
        <div
          className={cn(
            'mx-auto w-[390px] max-w-full h-14 px-3 py-2 ',
            'flex items-center gap-2 rounded-2xl ',
            'backdrop-blur-2xl bg-white/30 dark:bg-slate-900/30 ',
            'border border-white/20 dark:border-white/10 ',
            'shadow-2xl shadow-black/5 dark:shadow-black/20 pointer-events-auto transition-all duration-300'
          )}
        >
          {isSearchActive ? (
            <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-right-2 duration-200">
              {/* Back / Collapse Button */}
              <button
                type="button"
                onClick={() => {
                  setIsSearchActive(false);
                  onClearSearch();
                }}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-all active:scale-95 flex-shrink-0"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>

              {/* Search input field taking all remaining space */}
              <div className="flex-1 relative group min-w-0">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 z-10"
                  strokeWidth={2}
                />
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Ism yoki foydalanuvchi nomi..."
                  className={cn(
                    "pl-8 pr-8 h-8 rounded-full bg-white/40 dark:bg-slate-800/60 border border-white/30 dark:border-white/10 text-[13px] backdrop-blur-md",
                    "text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400",
                    "focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-500/50 transition-all shadow-inner"
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={onClearSearch}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 w-full animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="flex items-center gap-2">
                {/* 1) Trophy */}
                <div className="transition-all duration-150 active:scale-95 flex-shrink-0">
                  <TreeRatings />
                </div>

                {/* 2) Calendar */}
                <div className="transition-all duration-150 active:scale-95 flex-shrink-0">
                  <FamilyCalendarSheet />
                </div>

                {/* 3) Sleek Search Button */}
                <button
                  type="button"
                  onClick={() => setIsSearchActive(true)}
                  className="h-9 w-9 rounded-xl bg-white/20 dark:bg-slate-800/40 border border-white/30 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-white/30 dark:hover:bg-slate-800/60 transition-all active:scale-95 flex-shrink-0"
                  title="Qidirish"
                >
                  <Search className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* 4) Premium stats: Total + Active — clickable badges */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Total members badge */}
                  <button
                    type="button"
                    onClick={() => openDrawer('all')}
                    className={cn(
                      "flex items-center gap-1 h-8 px-2 rounded-xl border backdrop-blur-sm shadow-inner transition-all active:scale-95",
                      "bg-slate-800/60 dark:bg-white/8 border-white/10 hover:bg-slate-800/80"
                    )}
                    title="Barcha profillar"
                  >
                    <Users className="h-3 w-3 text-slate-300 dark:text-slate-400 flex-shrink-0" strokeWidth={2.5} />
                    <span className="text-[12px] font-bold text-white/90 dark:text-slate-100 leading-none tabular-nums">
                      {total}
                    </span>
                  </button>

                  {/* Active (linked) members badge */}
                  {active > 0 && (
                    <button
                      type="button"
                      onClick={() => openDrawer('active')}
                      className={cn(
                        "flex items-center gap-1 h-8 px-2 rounded-xl border backdrop-blur-sm shadow-inner transition-all active:scale-95",
                        "bg-emerald-600/70 dark:bg-emerald-500/20 border-emerald-400/30 hover:bg-emerald-600/90"
                      )}
                      title="Faol foydalanuvchilar"
                    >
                      <MessageCircle className="h-3 w-3 text-emerald-200 flex-shrink-0" strokeWidth={2.5} />
                      <span className="text-[12px] font-bold text-emerald-100 leading-none tabular-nums">
                        {active}
                      </span>
                    </button>
                  )}
                </div>

                {/* Save (optional) */}
                {hasCurrentPost && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onSave}
                    disabled={isSaving}
                    className="h-8 w-8 rounded-full transition-all duration-150 active:scale-95 flex-shrink-0"
                    aria-label="Saqlash"
                  >
                    <Save className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </Button>
                )}

                {/* 5) Share */}
                <button
                  type="button"
                  onClick={onPublish}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-300/60 dark:shadow-blue-500/25 flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 flex-shrink-0"
                  aria-label="Ulashish"
                >
                  <Icon icon="ci:share-ios-export" className="h-[16px] w-[16px] text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Drawer */}
      <TreeStatsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        members={memberList}
      />
    </>
  );
};
