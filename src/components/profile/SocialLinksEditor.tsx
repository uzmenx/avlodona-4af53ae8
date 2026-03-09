 import { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { Plus, Trash2, Link as LinkIcon, Globe, Send, Instagram, Youtube, Facebook, Twitter, Github } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 export interface SocialLink {
   type: string;
   url: string;
   label?: string;
 }
 
 interface SocialLinksEditorProps {
   links: SocialLink[];
   onChange: (links: SocialLink[]) => void;
   maxLinks?: number;
 }
 
 const SOCIAL_TYPES = [
   { value: 'telegram', label: 'Telegram', icon: Send, color: 'bg-[#0088cc]' },
   { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]' },
   { value: 'youtube', label: 'YouTube', icon: Youtube, color: 'bg-[#FF0000]' },
   { value: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-[#1877F2]' },
   { value: 'twitter', label: 'Twitter/X', icon: Twitter, color: 'bg-foreground' },
   { value: 'github', label: 'GitHub', icon: Github, color: 'bg-foreground' },
   { value: 'website', label: 'Vebsayt', icon: Globe, color: 'bg-primary' },
   { value: 'other', label: 'Boshqa', icon: LinkIcon, color: 'bg-muted-foreground' },
 ];
 
 export const getSocialIcon = (type: string) => {
   const socialType = SOCIAL_TYPES.find(s => s.value === type);
   return socialType?.icon || LinkIcon;
 };
 
 export const getSocialColor = (type: string) => {
   const socialType = SOCIAL_TYPES.find(s => s.value === type);
   return socialType?.color || 'bg-muted-foreground';
 };
 
 export const SocialLinksEditor = ({ links, onChange, maxLinks = 3 }: SocialLinksEditorProps) => {
   const addLink = () => {
     if (links.length >= maxLinks) return;
     onChange([...links, { type: 'website', url: '', label: '' }]);
   };
 
   const updateLink = (index: number, field: keyof SocialLink, value: string) => {
     const newLinks = [...links];
     newLinks[index] = { ...newLinks[index], [field]: value };
     onChange(newLinks);
   };
 
   const removeLink = (index: number) => {
     onChange(links.filter((_, i) => i !== index));
   };
 
   return (
     <div className="space-y-4">
       <div className="flex items-center justify-between">
         <Label>Ijtimoiy havolalar</Label>
         <span className="text-xs text-muted-foreground">{links.length}/{maxLinks}</span>
       </div>
 
       {links.map((link, index) => (
         <div key={index} className="space-y-2 p-3 bg-muted/50 rounded-lg">
           <div className="flex gap-2">
             <Select
               value={link.type}
               onValueChange={(value) => updateLink(index, 'type', value)}
             >
               <SelectTrigger className="w-[140px]">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {SOCIAL_TYPES.map((type) => {
                   const Icon = type.icon;
                   return (
                     <SelectItem key={type.value} value={type.value}>
                       <div className="flex items-center gap-2">
                         <Icon className="h-4 w-4" />
                         {type.label}
                       </div>
                     </SelectItem>
                   );
                 })}
               </SelectContent>
             </Select>
             
             <Button
               type="button"
               variant="ghost"
               size="icon"
               onClick={() => removeLink(index)}
               className="text-destructive hover:bg-destructive/10"
             >
               <Trash2 className="h-4 w-4" />
             </Button>
           </div>
           
           <Input
             placeholder="https://..."
             value={link.url}
             onChange={(e) => updateLink(index, 'url', e.target.value)}
           />
           
           <Input
             placeholder="Ko'rsatiladigan matn (ixtiyoriy)"
             value={link.label || ''}
             onChange={(e) => updateLink(index, 'label', e.target.value)}
             className="text-sm"
           />
         </div>
       ))}
 
       {links.length < maxLinks && (
         <Button
           type="button"
           variant="outline"
           onClick={addLink}
           className="w-full"
         >
           <Plus className="h-4 w-4 mr-2" />
           Havola qo'shish
         </Button>
       )}
     </div>
   );
 };