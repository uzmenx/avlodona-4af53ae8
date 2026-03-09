import { useState, useEffect, useRef } from 'react';

interface RGB {
  r: number;
  g: number;
  b: number;
}

export const useColorExtractor = (mediaUrl: string | undefined, isVideo: boolean = false) => {
  const [dominantColor, setDominantColor] = useState<string>('rgba(0, 0, 0, 0.9)');
  const [secondaryColor, setSecondaryColor] = useState<string>('rgba(0, 0, 0, 0.7)');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!mediaUrl) {
      setDominantColor('rgba(0, 0, 0, 0.9)');
      setSecondaryColor('rgba(0, 0, 0, 0.7)');
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const extractColors = (source: HTMLImageElement | HTMLVideoElement) => {
      try {
        // Scale down for performance
        const scale = 0.1;
        const width = (source instanceof HTMLVideoElement ? source.videoWidth : source.width) || 100;
        const height = (source instanceof HTMLVideoElement ? source.videoHeight : source.height) || 100;
        
        canvas.width = Math.max(10, width * scale);
        canvas.height = Math.max(10, height * scale);

        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = imageData;

        // Sample colors from different regions
        const regions: RGB[] = [];
        const regionSize = Math.floor(canvas.width / 3);
        
        for (let ry = 0; ry < 3; ry++) {
          for (let rx = 0; rx < 3; rx++) {
            let r = 0, g = 0, b = 0, count = 0;
            
            const startX = rx * regionSize;
            const startY = ry * regionSize;
            const endX = Math.min(startX + regionSize, canvas.width);
            const endY = Math.min(startY + regionSize, canvas.height);
            
            for (let y = startY; y < endY; y += 2) {
              for (let x = startX; x < endX; x += 2) {
                const idx = (y * canvas.width + x) * 4;
                r += data[idx];
                g += data[idx + 1];
                b += data[idx + 2];
                count++;
              }
            }
            
            if (count > 0) {
              regions.push({
                r: Math.round(r / count),
                g: Math.round(g / count),
                b: Math.round(b / count)
              });
            }
          }
        }

        // Find most vibrant colors
        const sortedByVibrancy = regions.sort((a, b) => {
          const vibrancyA = Math.max(a.r, a.g, a.b) - Math.min(a.r, a.g, a.b);
          const vibrancyB = Math.max(b.r, b.g, b.b) - Math.min(b.r, b.g, b.b);
          return vibrancyB - vibrancyA;
        });

        const primary = sortedByVibrancy[0] || { r: 0, g: 0, b: 0 };
        const secondary = sortedByVibrancy[1] || sortedByVibrancy[0] || { r: 0, g: 0, b: 0 };

        // Darken colors slightly for background
        const darkenFactor = 0.7;
        setDominantColor(`rgba(${Math.round(primary.r * darkenFactor)}, ${Math.round(primary.g * darkenFactor)}, ${Math.round(primary.b * darkenFactor)}, 0.95)`);
        setSecondaryColor(`rgba(${Math.round(secondary.r * darkenFactor)}, ${Math.round(secondary.g * darkenFactor)}, ${Math.round(secondary.b * darkenFactor)}, 0.9)`);
      } catch (error) {
        // Fallback on CORS or other errors
        setDominantColor('rgba(0, 0, 0, 0.9)');
        setSecondaryColor('rgba(0, 0, 0, 0.7)');
      }
    };

    if (isVideo) {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = mediaUrl;
      video.muted = true;
      
      const handleLoadedData = () => {
        video.currentTime = 0.5; // Seek to 0.5s for better frame
      };
      
      const handleSeeked = () => {
        extractColors(video);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('seeked', handleSeeked);
      };
      
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('seeked', handleSeeked);
      video.load();
      
      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('seeked', handleSeeked);
      };
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = mediaUrl;
      
      img.onload = () => {
        extractColors(img);
      };
      
      img.onerror = () => {
        // Try without crossOrigin for same-origin images
        const imgFallback = new Image();
        imgFallback.src = mediaUrl;
        imgFallback.onload = () => {
          extractColors(imgFallback);
        };
        imgFallback.onerror = () => {
          setDominantColor('rgba(0, 0, 0, 0.9)');
          setSecondaryColor('rgba(0, 0, 0, 0.7)');
        };
      };
    }
  }, [mediaUrl, isVideo]);

  return { dominantColor, secondaryColor };
};
