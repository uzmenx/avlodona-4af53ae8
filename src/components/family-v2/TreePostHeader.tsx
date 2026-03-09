import { Menu, Plus, Save, Search } from 'lucide-react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TreeRatings } from '@/components/family-v2/TreeRatings';
import { FamilyCalendarSheet } from '@/components/family-v2/FamilyCalendarSheet';

interface TreePostHeaderProps {
  onOpenHistory: () => void;
  onCreateNew: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  onPublish: () => void;
  memberCount?: number;
  isSaving?: boolean;
  hasCurrentPost?: boolean;
}

export const TreePostHeader = ({
  onOpenHistory,
  onCreateNew,
  onSave,
  onPublish,
  memberCount,
  isSaving,
  hasCurrentPost,
}: TreePostHeaderProps) => {
  return (
    <div className="sticky top-2 z-50 px-3">
      <div
        className={
          'mx-auto w-[390px] max-w-full h-14 px-4 py-2.5 ' +
          'flex items-center gap-2.5 rounded-2xl ' +
          'backdrop-blur-md bg-white/70 dark:bg-slate-900/80 ' +
          'border border-white/60 dark:border-white/10 ' +
          'shadow-lg shadow-black/10 dark:shadow-black/30'
        }
      >
        {/* 1) Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-9 w-9 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all duration-150 active:scale-95 bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-white/10 hover:bg-slate-100/90 dark:hover:bg-slate-800/80"
              aria-label="Menu"
            >
              <Menu className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={onOpenHistory}>
              <Search className="h-4 w-4 mr-2" />
              Qidirish
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Yangi
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 2) Trophy */}
        <div className="transition-all duration-150 active:scale-95">
          <TreeRatings />
        </div>

        {/* 3) Calendar */}
        <div className="transition-all duration-150 active:scale-95">
          <FamilyCalendarSheet />
        </div>

        {/* 4) Search */}
        <div className="flex-1 max-w-[140px] h-9 rounded-full bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 px-3 flex items-center gap-2 focus-within:ring-2 focus-within:ring-indigo-300 dark:focus-within:ring-indigo-500/60 transition-all duration-150">
          <Search className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
          <div className="flex-1 text-left text-sm text-slate-700 dark:text-slate-100">
            <span className="text-slate-400">Qidirish...</span>
          </div>
        </div>

        {/* 5) Badge */}
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

        {/* 6) Share */}
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
