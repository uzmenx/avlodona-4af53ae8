import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { StarUsername } from '@/components/user/StarUsername';

interface UserInfoProps {
  userId: string;
  name?: string;
  username?: string;
  variant?: 'default' | 'fullscreen';
  clickable?: boolean;
  className?: string;
}

export const UserInfo = ({
  userId,
  name,
  username,
  variant = 'default',
  clickable = true,
  className
}: UserInfoProps) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    if (!clickable) return;
    e.stopPropagation();
    navigate(`/user/${userId}`);
  };

  if (variant === 'fullscreen') {
    return (
      <div
        className={cn(
          "flex-1",
          clickable && "cursor-pointer",
          className
        )}
        onClick={handleClick}>

        <p
          className="font-semibold text-sm text-white hover:underline my-0"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}
        >
          {name || 'Foydalanuvchi'}
        </p>
        <StarUsername
          username={username || 'user'}
          className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
          textClassName="text-white/80"
        />
      </div>);

  }

  return (
    <div
      className={cn(
        clickable && "cursor-pointer",
        className
      )}
      onClick={handleClick}>

      <p className="font-semibold text-sm hover:underline">
        {name || 'Foydalanuvchi'}
      </p>
      <StarUsername username={username || 'user'} />
    </div>);

};