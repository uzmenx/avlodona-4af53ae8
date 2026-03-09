import { useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { 
  Copy, 
  Reply, 
  Forward, 
  Trash2, 
  TrashIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface MessageContextMenuProps {
  children: React.ReactNode;
  messageContent: string;
  messageId: string;
  isMine: boolean;
  isPrivateChat?: boolean;
  onReply?: (messageId: string, content: string) => void;
  onForward?: (messageId: string, content: string) => void;
  onDeleteForMe?: (messageId: string) => void;
  onDeleteForAll?: (messageId: string) => void;
}

export const MessageContextMenu = ({
  children,
  messageContent,
  messageId,
  isMine,
  isPrivateChat = false,
  onReply,
  onForward,
  onDeleteForMe,
  onDeleteForAll,
}: MessageContextMenuProps) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      toast.success('Xabar nusxalandi');
    } catch (error) {
      toast.error('Nusxalashda xatolik');
    }
  };

  const handleReply = () => {
    onReply?.(messageId, messageContent);
  };

  const handleForward = () => {
    onForward?.(messageId, messageContent);
  };

  const handleDeleteForMe = () => {
    onDeleteForMe?.(messageId);
  };

  const handleDeleteForAll = () => {
    if (confirm('Xabarni barcha uchun o\'chirishni xohlaysizmi?')) {
      onDeleteForAll?.(messageId);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleCopy} className="gap-2">
          <Copy className="h-4 w-4" />
          <span>Nusxalash</span>
        </ContextMenuItem>
        
        {onReply && (
          <ContextMenuItem onClick={handleReply} className="gap-2">
            <Reply className="h-4 w-4" />
            <span>Javob yozish</span>
          </ContextMenuItem>
        )}

        {onForward && (
          <ContextMenuItem onClick={handleForward} className="gap-2">
            <Forward className="h-4 w-4" />
            <span>Yo'naltirish</span>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {onDeleteForMe && (
          <ContextMenuItem 
            onClick={handleDeleteForMe} 
            className="gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            <span>Men uchun o'chirish</span>
          </ContextMenuItem>
        )}

        {isPrivateChat && isMine && onDeleteForAll && (
          <ContextMenuItem 
            onClick={handleDeleteForAll} 
            className="gap-2 text-destructive focus:text-destructive"
          >
            <TrashIcon className="h-4 w-4" />
            <span>Barcha uchun o'chirish</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
