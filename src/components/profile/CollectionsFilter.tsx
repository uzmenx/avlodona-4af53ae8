import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { type PostCollection } from '@/hooks/usePostCollections';

interface CollectionsFilterProps {
  collections: PostCollection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isOwner: boolean;
  onCreateCollection?: (name: string, theme?: number) => void;
  onLongPressCollection?: (collection: PostCollection) => void;
}

export function CollectionsFilter({ collections, selectedId, onSelect, isOwner, onCreateCollection, onLongPressCollection }: CollectionsFilterProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTheme, setNewTheme] = useState(0);

  const colorThemes = useMemo(
    () => [
      { bg: 'from-rose-500/25 via-fuchsia-500/15 to-indigo-500/25', ring: 'ring-rose-500/25' },
      { bg: 'from-emerald-500/25 via-teal-500/15 to-cyan-500/25', ring: 'ring-emerald-500/25' },
      { bg: 'from-amber-500/25 via-orange-500/15 to-rose-500/25', ring: 'ring-amber-500/25' },
      { bg: 'from-sky-500/25 via-blue-500/15 to-violet-500/25', ring: 'ring-sky-500/25' },
      { bg: 'from-violet-500/25 via-purple-500/15 to-pink-500/25', ring: 'ring-violet-500/25' },
      { bg: 'from-lime-500/20 via-green-500/15 to-emerald-500/25', ring: 'ring-lime-500/25' },
    ],
    []
  );

  const pressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  if (collections.length === 0 && !isOwner) return null;

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateCollection?.(newName.trim(), newTheme);
    setNewName('');
    setShowCreate(false);
  };

  return (
    <>
      <div
        className="flex gap-1.5 overflow-x-auto py-0.5 px-2 mb-1 cf-scroll"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any}
      >
        {collections.map((c, idx) => {
          const themeIndex = Number.isFinite((c as any).theme) ? ((c as any).theme as number) : (idx % colorThemes.length);
          const theme = colorThemes[((themeIndex % colorThemes.length) + colorThemes.length) % colorThemes.length];
          const isActive = selectedId === c.id;
          const postsCount = c.posts_count ?? 0;

          return (
            <button
              key={c.id}
              type="button"
              onPointerDown={() => {
                if (!isOwner || !onLongPressCollection) return;
                longPressFiredRef.current = false;
                if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
                pressTimerRef.current = window.setTimeout(() => {
                  longPressFiredRef.current = true;
                  onLongPressCollection(c);
                }, 520);
              }}
              onPointerUp={() => {
                if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
                pressTimerRef.current = null;
              }}
              onPointerCancel={() => {
                if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
                pressTimerRef.current = null;
              }}
              onContextMenu={(e) => {
                if (!isOwner || !onLongPressCollection) return;
                e.preventDefault();
                onLongPressCollection(c);
              }}
              onClick={() => {
                if (longPressFiredRef.current) {
                  longPressFiredRef.current = false;
                  return;
                }
                onSelect(isActive ? null : c.id);
              }}
              className={cn(
                'flex-shrink-0 relative rounded-full px-3 py-1.5 text-[13px] font-semibold',
                'border border-white/10 backdrop-blur-xl shadow-sm',
                'transition-all duration-200 active:scale-[0.98]',
                isActive
                  ? cn('bg-gradient-to-br text-white ring-2', theme.bg, theme.ring)
                  : cn('bg-gradient-to-br text-foreground/95 hover:text-foreground', theme.bg, 'ring-1 ring-white/10 opacity-85 hover:opacity-100')
              )}
            >
              <span className="flex items-center gap-2">
                <span className="max-w-[8rem] truncate">{c.name}</span>
                {postsCount > 0 && (
                  <span
                    className={cn(
                      'text-[11px] px-2 py-0.5 rounded-full font-bold',
                      isActive ? 'bg-white/15 text-white' : 'bg-white/12 text-foreground/80'
                    )}
                  >
                    {postsCount}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {isOwner && (
          <button
            onClick={() => setShowCreate(true)}
            className={cn(
              'flex-shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold',
              'border border-dashed border-white/20 text-muted-foreground',
              'bg-white/6 hover:bg-white/10 backdrop-blur-xl',
              'flex items-center gap-1.5 transition-colors'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Yangi
          </button>
        )}
      </div>

      <style>{`
        .cf-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }
      `}</style>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Yangi ro'yxat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ro'yxat nomi"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />

            <div className="flex items-center gap-2">
              {colorThemes.map((th, idx) => {
                const active = newTheme === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setNewTheme(idx)}
                    className={cn(
                      'h-7 w-7 rounded-full bg-gradient-to-br ring-2 transition-all',
                      th.bg,
                      active ? cn('scale-105', th.ring) : 'ring-white/10 hover:scale-105'
                    )}
                    aria-label={`Theme ${idx + 1}`}
                  />
                );
              })}
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={!newName.trim()}>
              Yaratish
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
