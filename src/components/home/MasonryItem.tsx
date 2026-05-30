import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
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
  const [videoLoaded, setVideoLoaded] = useState(false);
  const isAboveFold = index < 6;

  useAutoPreviewVideo(videoRef, { enabled: !!isVideo, delayMs: 3000, threshold: 0.6 });

  // Extract thumbnail url if available
  const thumbnailUrl = (post as any).thumbnail_url || (post as any).thumbnail;

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
              <div className="relative">
                {/* Thumbnail while video hasn't loaded */}
                {thumbnailUrl && !videoLoaded && (
                  <img
                    src={thumbnailUrl}
                    alt="Video"
                    className="w-full h-auto block"
                    style={{ maxHeight: "80vh" }}
                    decoding="async"
                    loading={isAboveFold ? "eager" : "lazy"}
                    fetchPriority={isAboveFold ? "high" : "auto"}
                  />
                )}
                {/* Video element — hidden until loaded when thumbnail exists */}
                <video
                  ref={videoRef}
                  src={mediaUrl}
                  className={`w-full h-auto block${thumbnailUrl && !videoLoaded ? ' absolute inset-0 opacity-0' : ''}`}
                  style={{ maxHeight: "80vh" }}
                  muted
                  playsInline
                  loop
                  // Yuqoridagi (ko‘rinadigan) elementlar uchun metadata "warm-up" — thumb sekin bo‘lsa ham video tezroq tayyor bo‘ladi
                  preload={isAboveFold ? "metadata" : "none"}
                  onLoadedData={() => setVideoLoaded(true)}
                />
                {/* Play overlay — custom, replaces ugly browser default */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-xl">
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </div>
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
