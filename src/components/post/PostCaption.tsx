import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { StarUsername } from '@/components/user/StarUsername';

interface PostCaptionProps {
  username?: string;
  content: string;
  className?: string;
  variant?: 'default' | 'fullscreen';
  postId?: string;
}

export const PostCaption = ({ username, content, className, variant = 'default', postId }: PostCaptionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const [mentions, setMentions] = useState<{ id: string; name: string | null; username: string | null }[]>([]);

  useEffect(() => {
    if (!postId) return;
    (async () => {
      const { data: mentionData } = await supabase
        .from('post_mentions')
        .select('mentioned_user_id')
        .eq('post_id', postId);
      if (!mentionData || mentionData.length === 0) return;
      const ids = mentionData.map(m => m.mentioned_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username')
        .in('id', ids);
      setMentions(profiles || []);
    })();
  }, [postId]);

  // Check if content is long enough to need truncation
  const shouldTruncate = content.length > 100;
  
  // Extract and highlight hashtags and @mentions
  const renderContent = (text: string) => {
    const parts = text.split(/(#\w+|@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span key={index} className="text-primary font-medium">
            {part}
          </span>
        );
      }
      if (part.startsWith('@')) {
        const mentionUser = mentions.find(m =>
          m.username?.toLowerCase() === part.slice(1).toLowerCase() ||
          m.name?.toLowerCase() === part.slice(1).toLowerCase()
        );
        return (
          <span
            key={index}
            className="text-primary font-medium cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (mentionUser) navigate(`/user/${mentionUser.id}`);
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const isFullscreen = variant === 'fullscreen';

  return (
    <div className={cn("text-sm select-text", className)}>
      <span
        className={cn(
          isFullscreen ? 'text-white/90' : 'text-foreground',
          !isExpanded && shouldTruncate && 'line-clamp-2',
          !isFullscreen && shouldTruncate && 'cursor-pointer'
        )}
        onClick={(e) => {
          if (isFullscreen || !shouldTruncate) return;
          e.stopPropagation();
          setIsExpanded((v) => !v);
        }}
      >
        {username && !isFullscreen && (
          <span className="font-semibold mr-1">{username}</span>
        )}
        {renderContent(content)}
        {shouldTruncate && !isExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            className={cn(
              'ml-1 font-medium whitespace-nowrap',
              isFullscreen ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            ko'proq
          </button>
        )}
      </span>
      
      {shouldTruncate && isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          className={cn(
            "ml-1 font-medium",
            isFullscreen ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          yig'ish
        </button>
      )}

      {/* Mention badges */}
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {mentions.map(m => (
            <button
              key={m.id}
              onClick={(e) => { e.stopPropagation(); navigate(`/user/${m.id}`); }}
              className="text-xs text-primary font-medium hover:underline"
            >
              <StarUsername username={m.username || m.name || 'user'} textClassName="text-xs text-primary font-medium" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
