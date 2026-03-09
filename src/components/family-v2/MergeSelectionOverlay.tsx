 import { X, Check, GitMerge, Lightbulb } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { cn } from '@/lib/utils';
 import { MergeSuggestion } from '@/hooks/useMergeMode';
 
 interface MergeSelectionOverlayProps {
   isActive: boolean;
   selectedCount: number;
   suggestions: MergeSuggestion[];
   isProcessing: boolean;
   onCancel: () => void;
   onConfirm: () => void;
   onApplySuggestion: (suggestion: MergeSuggestion) => void;
 }
 
 export const MergeSelectionOverlay = ({
   isActive,
   selectedCount,
   suggestions,
   isProcessing,
   onCancel,
   onConfirm,
   onApplySuggestion,
 }: MergeSelectionOverlayProps) => {
   if (!isActive) return null;
 
   return (
     <div className="fixed inset-x-0 top-0 z-50 pointer-events-none">
       {/* Top bar */}
       <div className="pointer-events-auto bg-gradient-to-b from-background/95 to-background/80 backdrop-blur-lg border-b border-border shadow-lg">
         <div className="container mx-auto px-4 py-3">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={onCancel}
                 className="shrink-0"
               >
                 <X className="h-5 w-5" />
               </Button>
               <div>
                 <h3 className="font-semibold text-foreground">
                   Birlashtirish rejimi
                 </h3>
                 <p className="text-sm text-muted-foreground">
                   {selectedCount} ta profil tanlandi
                 </p>
               </div>
             </div>
             
             <Button
               onClick={onConfirm}
               disabled={selectedCount < 2 || isProcessing}
               className="gap-2"
             >
               <GitMerge className="h-4 w-4" />
               {isProcessing ? 'Birlashtirilmoqda...' : 'Birlashtirish'}
             </Button>
           </div>
           
           {/* Selection instructions */}
           <p className="text-xs text-muted-foreground mt-2 text-center">
             Birinchi tanlangan profil asosiy bo'ladi. Boshqa profillarni tanlang.
           </p>
         </div>
       </div>
       
       {/* Suggestions panel - only show when there are suggestions */}
       {suggestions.length > 0 && (
         <div className="pointer-events-auto mt-2 mx-4">
           <div className="bg-card/95 backdrop-blur-lg rounded-xl border border-border shadow-lg p-3">
             <div className="flex items-center gap-2 mb-2">
               <Lightbulb className="h-4 w-4 text-yellow-500" />
               <span className="text-sm font-medium">Tavsiyalar</span>
             </div>
             <ScrollArea className="max-h-32">
               <div className="space-y-2">
                 {suggestions.map((suggestion, idx) => (
                   <button
                     key={idx}
                     onClick={() => onApplySuggestion(suggestion)}
                     className="w-full flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                   >
                     <Badge 
                       variant="outline" 
                       className={cn(
                         "shrink-0",
                         suggestion.gender === 'male' 
                           ? "border-sky-500 text-sky-500" 
                           : "border-pink-500 text-pink-500"
                       )}
                     >
                       {suggestion.gender === 'male' ? '♂' : '♀'}
                     </Badge>
                     <div className="flex-1 min-w-0">
                       <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                       <p className="text-sm truncate">
                         {suggestion.sourceName} + {suggestion.targetName}
                       </p>
                     </div>
                     <Check className="h-4 w-4 text-primary shrink-0" />
                   </button>
                 ))}
               </div>
             </ScrollArea>
           </div>
         </div>
       )}
     </div>
   );
 };