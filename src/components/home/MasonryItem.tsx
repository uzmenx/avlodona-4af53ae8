import { useRef } from "react";
import { motion } from "framer-motion";
import { Post } from "@/types";
import { useAutoPreviewVideo } from "@/hooks/useAutoPreviewVideo";

interface MasonryItemProps {
  post: Post;
  index?: number;
  onClick?: () => void;
}

export const MasonryItem = ({ post, index = 0, onClick }: MasonryItemProps) => {
  const mediaUrl = post.media_urls?.[0] || post.image_url;
  const isVideo = mediaUrl && (mediaUrl.includes(".mp4") || mediaUrl.includes(".mov") || mediaUrl.includes(".webm"));
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useAutoPreviewVideo(videoRef, { enabled: !!isVideo, delayMs: 3000, threshold: 0.6 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index % 2 * 0.05 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      <div className="relative overflow-hidden rounded-[20px] bg-muted/80 shadow-xl shadow-black/20 border border-white/10">
        {mediaUrl ? (
          <>
            {isVideo ? (
              <video
                ref={videoRef}
                src={mediaUrl}
                className="w-full h-auto block"
                style={{ maxHeight: "80vh" }}
                muted
                playsInline
                loop
                preload="metadata"
              />
            ) : (
              <img src={mediaUrl} alt="Post" className="w-full h-auto block" style={{ maxHeight: "80vh" }} />
            )}
            {post.media_urls && post.media_urls.length > 1 && (
              <div className="absolute top-2 right-2 bg-background/80 rounded px-1.5 py-0.5 text-xs font-medium">
                +{post.media_urls.length - 1}
              </div>
            )}
          </>
        ) : (
          <div className="w-full aspect-square flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
            {post.content?.substring(0, 50)}
          </div>
        )}
      </div>
    </motion.div>
  );
};
