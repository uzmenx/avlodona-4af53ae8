import { Save, Search, X } from 'lucide-react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TreeRatings } from '@/components/family-v2/TreeRatings';
import { FamilyCalendarSheet } from '@/components/family-v2/FamilyCalendarSheet';

interface TreePostHeaderProps {
  onOpenRelativeSearch: () => void;
  onSave: () => void | Promise<void>;
  onPublish: () => void;
  memberCount?: number;
  isSaving?: boolean;
  hasCurrentPost?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
}

export const TreePostHeader = ({
  onOpenRelativeSearch,
  onSave,
  onPublish,
  memberCount,
  isSaving,
  hasCurrentPost,
  searchQuery,
  onSearchChange,
  onClearSearch,
}: TreePostHeaderProps) => {
  return (
    <div className="sticky top-2 z-50 px-3">
      <div
        className={
          'mx-auto w-[390px] max-w-full h-14 px-4 py-2.5 ' +
          'flex items-center gap-2.5 rounded-2xl ' +
          'backdrop-blur-2xl bg-white/30 dark:bg-slate-900/30 ' +
          'border border-white/20 dark:border-white/10 ' +
          'shadow-2xl shadow-black/5 dark:shadow-black/20'
        }
      >
        {/* 1) Trophy */}
        <div className="transition-all duration-150 active:scale-95">
          <TreeRatings />
        </div>

        {/* 2) Calendar */}
        <div className="transition-all duration-150 active:scale-95">
          <FamilyCalendarSheet />
        </div>

        {/* 3) Search Input */}
        <div className="flex-1 max-w-[180px] relative group">
          <Search 
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" 
            strokeWidth={2} 
          />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Qidirish..."
            className={cn(
              "pl-9 pr-9 h-9 rounded-full bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70",
              "text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400",
              "focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-500/50 transition-all"
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 4) Badge */}
        {typeof memberCount === 'number' && (
          <div className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center">
            {memberCount > 99 ? '99+' : memberCount}
          </div>
        )}

        {/* Save (optional) */}
        {hasCurrentPost && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 w-9 rounded-full transition-all duration-150 active:scale-95"
            aria-label="Saqlash"
          >
            <Save className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </Button>
        )}

        {/* 5) Share */}
        <button
          type="button"
          onClick={onPublish}
          className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-300/60 dark:shadow-blue-500/25 flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95"
          aria-label="Ulashish"
        >
          <Icon icon="ci:share-ios-export" className="h-[18px] w-[18px] text-white" />
        </button>
      </div>
    </div>
  );
};
