import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
'@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MessagesSquare, Users, Megaphone } from 'lucide-react';

interface NewChatMenuProps {
  onNewGroup: () => void;
  onNewChannel: () => void;
}

export const NewChatMenu = ({ onNewGroup, onNewChannel }: NewChatMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MessagesSquare className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onNewGroup} className="gap-3 cursor-pointer">
          <Users className="h-5 w-5" />
          <span>Yangi guruh</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNewChannel} className="gap-3 cursor-pointer">
          <Megaphone className="h-5 w-5" />
          <span>Yangi kanal</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);

};