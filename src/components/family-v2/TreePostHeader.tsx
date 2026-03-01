import { Menu, Plus, Save, Send, Maximize2, Smile, Type, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TreeRatings } from '@/components/family-v2/TreeRatings';
import { FamilyCalendarSheet } from '@/components/family-v2/FamilyCalendarSheet';

interface TreePostHeaderProps {
  onOpenHistory: () => void;
  onCreateNew: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  onPublish: () => void;
  onFullscreen: () => void;
  onAddSticker: (emoji: string) => void;
  onAddText: () => void;
  onAddImage: (url: string) => void;
  isSaving?: boolean;
  hasCurrentPost?: boolean;
}

export const TreePostHeader = ({
  onOpenHistory,
  onCreateNew,
  onSave,
  onPublish,
  onFullscreen,
  onAddSticker,
  onAddText,
  onAddImage,
  isSaving,
  hasCurrentPost,
}: TreePostHeaderProps) => {
  const STICKERS = ['🌳', '❤️', '👨‍👩‍👧‍👦', '🏠', '⭐', '🎂', '👶', '💍', '🌹', '📷', '🎉', '💝'];
  const fileInputId = 'tree-overlay-image-input';

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-background/80 backdrop-blur-sm border-b border-border z-10">
      {/* Left side */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onOpenHistory} className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Yangi
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Smile className="h-4 w-4 mr-2" />
                Bezaklar
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64">
                <div className="grid grid-cols-6 gap-1 p-1">
                  {STICKERS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onAddSticker(emoji)}
                      className="h-9 w-9 rounded-md hover:bg-muted flex items-center justify-center text-xl"
                      type="button"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onAddText}>
                  <Type className="h-4 w-4 mr-2" />
                  Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => document.getElementById(fileInputId)?.click()}>
                  <Image className="h-4 w-4 mr-2" />
                  Rasm
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onFullscreen}>
              <Maximize2 className="h-4 w-4 mr-2" />
              To'liq ekran
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          id={fileInputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const url = URL.createObjectURL(file);
              onAddImage(url);
            }
            e.target.value = '';
          }}
        />

        <TreeRatings />
        <FamilyCalendarSheet />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {hasCurrentPost && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSave}
            disabled={isSaving}
            className="h-9 w-9"
          >
            <Save className="h-5 w-5" />
          </Button>
        )}
        <Button
          size="sm"
          onClick={onPublish}
          className="gap-1.5 rounded-full px-4"
        >
          <Send className="h-4 w-4" />
          Nashr
        </Button>
      </div>
    </div>
  );
};
