import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, Link, GitMerge, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MergeDialogData } from '@/hooks/useFamilyInvitations';
import { ChildProfile, ChildMergeSuggestion, CoupleGroup } from '@/hooks/useTreeMerging';

interface ChildMergeItem {
  sourceChild: ChildProfile;
  targetChild: ChildProfile | null;
  shouldMerge: boolean;
  /** Birlashish balli (tavsiya qatorlari uchun) */
  similarity?: number;
}

interface UnifiedMergeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: MergeDialogData;
  onConfirm: (childMerges: { sourceId: string; targetId: string }[]) => void;
  isProcessing: boolean;
}

const AUTO_MERGE_THRESHOLD = 90;

/**
 * Build child merge items for a couple group
 */
const buildChildItems = (group: CoupleGroup): ChildMergeItem[] => {
  const items: ChildMergeItem[] = [];
  const usedTargetIds = new Set<string>();
  
  for (const suggestion of group.childSuggestions) {
    items.push({
      sourceChild: suggestion.sourceChild,
      targetChild: suggestion.targetChild,
      shouldMerge: suggestion.similarity >= AUTO_MERGE_THRESHOLD,
      similarity: suggestion.similarity,
    });
    usedTargetIds.add(suggestion.targetChild.id);
  }

  for (const source of group.sourceChildren) {
    if (items.find(i => i.sourceChild.id === source.id)) continue;

    const availableTarget = group.targetChildren.find(
      t => t.gender === source.gender && !usedTargetIds.has(t.id)
    );

    if (availableTarget) {
      items.push({
        sourceChild: source,
        targetChild: availableTarget,
        shouldMerge: false,
      });
      usedTargetIds.add(availableTarget.id);
    } else {
      items.push({
        sourceChild: source,
        targetChild: null,
        shouldMerge: false,
      });
    }
  }

  return items;
};

/**
 * Build child items from flat data (backward compat when no coupleGroups)
 */
const buildFlatChildItems = (data: MergeDialogData): ChildMergeItem[] => {
  const items: ChildMergeItem[] = [];
  const usedTargetIds = new Set<string>();
  
  for (const suggestion of data.childSuggestions) {
    items.push({
      sourceChild: suggestion.sourceChild,
      targetChild: suggestion.targetChild,
      shouldMerge: suggestion.similarity >= AUTO_MERGE_THRESHOLD,
      similarity: suggestion.similarity,
    });
    usedTargetIds.add(suggestion.targetChild.id);
  }
  
  for (const source of data.allSourceChildren) {
    if (items.find(i => i.sourceChild.id === source.id)) continue;
    const availableTarget = data.allTargetChildren.find(
      t => t.gender === source.gender && !usedTargetIds.has(t.id)
    );
    if (availableTarget) {
      items.push({ sourceChild: source, targetChild: availableTarget, shouldMerge: false });
      usedTargetIds.add(availableTarget.id);
    } else {
      items.push({ sourceChild: source, targetChild: null, shouldMerge: false });
    }
  }
  
  return items;
};

export const UnifiedMergeDialog = ({
  isOpen,
  onClose,
  data,
  onConfirm,
  isProcessing,
}: UnifiedMergeDialogProps) => {
  const hasCoupleGroups = data.coupleGroups.length > 0;
  
  // State: grouped child items (2D array, one per couple group)
  const [groupedChildItems, setGroupedChildItems] = useState<ChildMergeItem[][]>(() => {
    if (hasCoupleGroups) {
      return data.coupleGroups.map(buildChildItems);
    }
    // Backward compat: single flat group
    const flatItems = buildFlatChildItems(data);
    return flatItems.length > 0 ? [flatItems] : [];
  });
  
  // Toggle merge status for a specific group and index
  const toggleMerge = (groupIdx: number, itemIdx: number) => {
    setGroupedChildItems(prev => prev.map((group, gi) => {
      if (gi !== groupIdx) return group;
      return group.map((item, ii) => {
        if (ii !== itemIdx) return item;
        if (!item.targetChild) return item;
        if (item.sourceChild.gender !== item.targetChild.gender) return item;
        return { ...item, shouldMerge: !item.shouldMerge };
      });
    }));
  };
  
  // Confirm handler
  const handleConfirm = () => {
    const childMerges: { sourceId: string; targetId: string }[] = [];
    groupedChildItems.forEach(groupItems => {
      groupItems.forEach(item => {
        if (item.shouldMerge && item.targetChild) {
          childMerges.push({
            sourceId: item.sourceChild.id,
            targetId: item.targetChild.id,
          });
        }
      });
    });
    onConfirm(childMerges);
  };
  
  // Stats
  const stats = useMemo(() => {
    let childrenMerge = 0;
    let childrenSeparate = 0;
    groupedChildItems.forEach(group => {
      group.forEach(item => {
        if (item.shouldMerge && item.targetChild) childrenMerge++;
        else childrenSeparate++;
      });
    });
    return {
      parents: data.parentMerges.length,
      childrenMerge,
      childrenSeparate,
    };
  }, [data.parentMerges.length, groupedChildItems]);
  
  const hasAnyChildren = groupedChildItems.some(g => g.length > 0);
  
  // Get display couple groups (use coupleGroups if available, otherwise create a default)
  const displayGroups = useMemo(() => {
    if (hasCoupleGroups) return data.coupleGroups;
    // Backward compat: create a single default group
    if (data.allSourceChildren.length > 0 || data.allTargetChildren.length > 0) {
      return [{
        label: 'Farzandlar',
        parentMerges: data.parentMerges,
        sourceChildren: data.allSourceChildren,
        targetChildren: data.allTargetChildren,
        childSuggestions: data.childSuggestions,
      }] as CoupleGroup[];
    }
    return [];
  }, [hasCoupleGroups, data]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-background/70 backdrop-blur-2xl shadow-[0_30px_90px_-55px_rgba(0,0,0,0.85)] p-0">
        <div className="relative">
          <div className="absolute inset-x-0 -top-24 h-40 bg-gradient-to-b from-sky-500/20 via-fuchsia-500/10 to-transparent pointer-events-none" />

          <DialogHeader className="px-5 pt-5 pb-4 border-b border-white/10 sticky top-0 z-10 bg-background/50 backdrop-blur-2xl">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-sky-500/30 via-cyan-500/20 to-fuchsia-500/25 border border-white/10 flex items-center justify-center shadow-sm">
                <GitMerge className="h-5 w-5 text-sky-200" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-extrabold tracking-tight">
                  Daraxtlarni birlashtirish
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {data.senderName} bilan {data.receiverName} daraxtlari birlashtirilmoqda
                </DialogDescription>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-background/40 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Birlashish</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-sm font-semibold">{stats.parents}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-background/40 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Bolalar (✓)</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-sm font-semibold">{stats.childrenMerge}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-background/40 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Alohida (✗)</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold">{stats.childrenSeparate}</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="h-[60vh]">
            <div className="space-y-4 px-5 py-4">
              {/* Avtomatik birlashadigan profillar */}
            {data.parentMerges.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span className="h-7 w-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <Link className="h-4 w-4 text-emerald-400" />
                    </span>
                    Avtomatik birlashadi
                  </h3>
                  <span className="text-xs text-muted-foreground">{data.parentMerges.length} ta</span>
                </div>
                <div className="space-y-2">
                  {data.parentMerges.map((merge, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20"
                    >
                      <ProfileBadge
                        name={merge.sourceName}
                        photoUrl={merge.sourcePhotoUrl}
                        gender="male"
                      />
                      <span className="text-xs text-emerald-400 font-semibold">=</span>
                      <ProfileBadge
                        name={merge.targetName}
                        photoUrl={merge.targetPhotoUrl}
                        gender="male"
                      />
                      <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                        {merge.relationship === 'parent' ? 'Ota-ona' : 'Bobo-buvi'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Couple Groups - har bir juftlik uchun farzandlar */}
            {displayGroups.map((group, groupIdx) => {
              const groupItems = groupedChildItems[groupIdx] || [];
              if (groupItems.length === 0) return null;
              
              return (
                <div key={groupIdx} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                      <Users className="h-4 w-4 text-sky-200" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate">{group.label}</h3>
                      <p className="text-[11px] text-muted-foreground">Farzandlar bo‘yicha tavsiyalar</p>
                    </div>
                  </div>
                  
                  {/* Couple parent badges (compact) */}
                  {group.parentMerges.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {group.parentMerges.map((pm, pmIdx) => (
                        <div
                          key={pmIdx}
                          className="flex items-center gap-1 px-2 py-1 rounded-xl border border-white/10 bg-background/40 text-[10px]"
                        >
                          <span className="font-medium">{pm.sourceName}</span>
                          <span className="text-emerald-400">=</span>
                          <span className="font-medium">{pm.targetName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="rounded-2xl border border-white/10 bg-background/30 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      Tavsiya: ✓ belgilanganlari birlashadi, ✗ belgilanmaganlar alohida qoladi.
                    </p>
                  </div>

                  {/* Juftlik (birlashish tavsiyasi) birinchi, keyin alohida farzandlar */}
                  {(() => {
                    const withIndex = groupItems.map((item, itemIdx) => ({ item, itemIdx }));
                    const coupled = withIndex.filter(({ item }) => item.targetChild != null);
                    const single = withIndex.filter(({ item }) => item.targetChild == null);
                    return (
                      <>
                        {coupled.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                              Birlashish tavsiyasi ({coupled.length})
                            </h4>
                            {coupled.map(({ item, itemIdx }) => (
                              <ChildMergeRow
                                key={itemIdx}
                                item={item}
                                onToggle={() => toggleMerge(groupIdx, itemIdx)}
                              />
                            ))}
                          </div>
                        )}
                        {single.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                              Alohida farzandlar ({single.length})
                            </h4>
                            {single.map(({ item, itemIdx }) => (
                              <ChildMergeRow
                                key={itemIdx}
                                item={item}
                                onToggle={() => toggleMerge(groupIdx, itemIdx)}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              );
            })}
            
            {!hasAnyChildren && data.parentMerges.length > 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Birlashtiriladigan farzandlar yo'q
              </p>
            )}
            </div>
          </ScrollArea>

          <div className="px-5 py-4 border-t border-white/10 bg-background/40 backdrop-blur-2xl">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 rounded-2xl"
                disabled={isProcessing}
              >
                Bekor qilish
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 rounded-2xl"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saqlanmoqda...
                  </>
                ) : (
                  'Tasdiqlash'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Profile badge component
const ProfileBadge = ({ 
  name, 
  photoUrl, 
  gender 
}: {
  name: string; 
  photoUrl?: string; 
  gender: string;
}) => (
  <div className="flex items-center gap-1.5">
    <div className={cn(
      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden ring-2 ring-background/60",
      gender === 'male' ? "bg-sky-500" : "bg-pink-500"
    )}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        name?.[0]?.toUpperCase() || '?'
      )}
    </div>
    <span className="text-xs font-semibold truncate max-w-[110px]">{name}</span>
  </div>
);

// Child merge row component
const ChildMergeRow = ({
  item,
  onToggle,
}: {
  item: ChildMergeItem;
  onToggle: () => void;
}) => {
  const { sourceChild, targetChild, shouldMerge } = item;
  const canMerge = targetChild && targetChild.gender === sourceChild.gender;
  const isMale = sourceChild.gender === 'male';
  
  return (
    <div className={cn(
      "flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all",
      shouldMerge && canMerge ? "bg-emerald-500/5 border-emerald-500/30" : "bg-card border-muted"
    )}>
      {/* Source Avatar */}
      <div className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0",
        isMale ? "bg-sky-500" : "bg-pink-500"
      )}>
        {sourceChild.photoUrl ? (
          <img src={sourceChild.photoUrl} alt={sourceChild.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          sourceChild.name?.[0]?.toUpperCase() || '?'
        )}
      </div>
      
      {/* Source Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{sourceChild.name}</p>
        <p className="text-[10px] text-muted-foreground">
          Yangi
          {item.similarity != null && (
            <span className="ml-1 text-emerald-600 font-medium">({item.similarity}% mos)</span>
          )}
        </p>
      </div>
      
      {/* Connection */}
      {targetChild ? (
        <div className="flex items-center gap-1 px-1">
          <div className={cn(
            "w-4 h-0.5 rounded",
            shouldMerge ? "bg-emerald-500" : "bg-muted-foreground/30"
          )} />
          <span className={cn(
            "text-xs",
            shouldMerge ? "text-emerald-600" : "text-muted-foreground"
          )}>
            {shouldMerge ? '=' : '≠'}
          </span>
          <div className={cn(
            "w-4 h-0.5 rounded",
            shouldMerge ? "bg-emerald-500" : "bg-muted-foreground/30"
          )} />
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground px-2">Alohida</span>
      )}
      
      {/* Target Avatar */}
      {targetChild && (
        <>
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0",
            isMale ? "bg-sky-500" : "bg-pink-500"
          )}>
            {targetChild.photoUrl ? (
              <img src={targetChild.photoUrl} alt={targetChild.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              targetChild.name?.[0]?.toUpperCase() || '?'
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{targetChild.name}</p>
            <p className="text-[10px] text-muted-foreground">Mavjud</p>
          </div>
        </>
      )}
      
      {/* Toggle */}
      {canMerge && (
        <button
          onClick={onToggle}
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 flex-shrink-0",
            shouldMerge
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-600"
              : "bg-muted/50 border-muted-foreground/20 text-muted-foreground"
          )}
        >
          {shouldMerge ? (
            <Check className="w-4 h-4" strokeWidth={3} />
          ) : (
            <X className="w-4 h-4" strokeWidth={2.5} />
          )}
        </button>
      )}
    </div>
  );
};
