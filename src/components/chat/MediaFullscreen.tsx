import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SamsungUltraVideoPlayer } from '@/components/video/SamsungUltraVideoPlayer';

interface MediaFullscreenProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  onClose: () => void;
}

export const MediaFullscreen = ({ mediaUrl, mediaType, onClose }: MediaFullscreenProps) => {
  useEffect(() => {
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {mediaType === 'image' ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={mediaUrl}
            alt="Fullscreen"
            className="max-w-full max-h-full object-contain"
            onClick={onClose}
          />
        </>
      ) : (
        <SamsungUltraVideoPlayer
          src={mediaUrl}
          title="Video Message"
          onClose={onClose}
          startInFullscreen={true}
        />
      )}
    </div>
  );
};

