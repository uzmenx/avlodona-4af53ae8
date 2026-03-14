import { Save, Search } from 'lucide-react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { TreeRatings } from '@/components/family-v2/TreeRatings';
import { FamilyCalendarSheet } from '@/components/family-v2/FamilyCalendarSheet';

interface TreePostHeaderProps {
  onOpenRelativeSearch: () => void;
  onSave: () => void | Promise<void>;
  onPublish: () => void;
  memberCount?: number;
  isSaving?: boolean;
  hasCurrentPost?: boolean;
}

export const TreePostHeader = ({
  onOpenRelativeSearch,
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
        {/* 1) Trophy */}
        <div className="transition-all duration-150 active:scale-95">
          <TreeRatings />
        </div>

        {/* 2) Calendar */}
        <div className="transition-all duration-150 active:scale-95">
          <FamilyCalendarSheet />
        </div>

        {/* 3) Search */}
        <button
          type="button"
          onClick={onOpenRelativeSearch}
          className="flex-1 max-w-[160px] h-9 rounded-full bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/70 px-3 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-indigo-300 dark:focus-visible:ring-indigo-500/60 transition-all duration-150 text-left"
          aria-label="Qarindosh qidirish"
        >
          <Search className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
          <div className="flex-1 text-left text-sm text-slate-700 dark:text-slate-100">
            <span className="text-slate-400">Qidirish...</span>
          </div>
        </button>

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
