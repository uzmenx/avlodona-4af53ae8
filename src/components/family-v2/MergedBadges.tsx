 import { cn } from '@/lib/utils';
 import { FamilyMember } from '@/types/family';
 
 interface MergedBadgesProps {
   mergedNames: string[];
   gender: 'male' | 'female';
 }
 
 export const MergedBadges = ({ mergedNames, gender }: MergedBadgesProps) => {
   if (mergedNames.length === 0) return null;
 
   const isMale = gender === 'male';
   
   return (
     <div className="absolute -bottom-2 -right-2 flex -space-x-2">
       {mergedNames.slice(0, 3).map((name, idx) => (
         <div
           key={idx}
           className={cn(
             "w-6 h-6 rounded-full flex items-center justify-center",
             "border-2 border-background shadow-md",
             "text-[10px] font-bold text-white",
             isMale ? "bg-sky-600" : "bg-pink-600"
           )}
           title={name}
         >
           {name[0]?.toUpperCase() || '?'}
         </div>
       ))}
       {mergedNames.length > 3 && (
         <div
           className={cn(
             "w-6 h-6 rounded-full flex items-center justify-center",
             "border-2 border-background shadow-md",
             "text-[10px] font-bold text-white",
             isMale ? "bg-sky-700" : "bg-pink-700"
           )}
         >
           +{mergedNames.length - 3}
         </div>
       )}
     </div>
   );
 };