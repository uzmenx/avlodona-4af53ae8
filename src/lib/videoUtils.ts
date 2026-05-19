export const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  // Check if URL starts with blob or data uri representing a video
  if (url.startsWith('data:video/')) return true;
  if (url.startsWith('blob:') && url.includes('video')) return true;
  
  // Check if URL ends with video extension or contains video format indicator
  const videoExtensions = ['.mp4', '.mov', '.webm', '.m4v', '.3gp', '.avi'];
  const lowercaseUrl = url.toLowerCase();
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    return videoExtensions.some(ext => pathname.endsWith(ext)) || pathname.includes('video');
  } catch {
    return videoExtensions.some(ext => lowercaseUrl.includes(ext)) || lowercaseUrl.includes('video');
  }
};

export const transcodeVideo = async (file: File | Blob, maxDurationSeconds = 10, maxDimension = 1080): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = true; // Auto-play policies require muted for offscreen videos
    video.playsInline = true;

    video.onloadedmetadata = () => {
      // Calculate scaled dimensions while preserving aspect ratio
      let width = video.videoWidth;
      let height = video.videoHeight;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D context not supported'));

      // Create stream (30 FPS)
      const fps = 30;
      const canvasStream = canvas.captureStream(fps);

      // Determine best supported mime type
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
      ];
      let selectedMimeType = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }

      const recorder = new MediaRecorder(canvasStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps target bitrate for high quality 1080p
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        URL.revokeObjectURL(videoUrl);
        const finalBlob = new Blob(chunks, { type: selectedMimeType || 'video/mp4' });
        resolve(finalBlob);
      };

      let animationFrameId: number;
      const drawFrame = () => {
        if (video.paused || video.ended) return;
        
        // High quality smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(video, 0, 0, width, height);

        // Check duration constraint
        if (video.currentTime >= maxDurationSeconds) {
          video.pause();
          if (recorder.state === 'recording') recorder.stop();
          cancelAnimationFrame(animationFrameId);
          return;
        }
        animationFrameId = requestAnimationFrame(drawFrame);
      };

      video.onplay = () => {
        recorder.start(100); // collect chunks every 100ms
        drawFrame();
      };

      video.onended = () => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
        cancelAnimationFrame(animationFrameId);
      };

      video.play().catch((err) => {
        URL.revokeObjectURL(videoUrl);
        reject(err);
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Failed to load video for transcoding'));
    };
  });
};
