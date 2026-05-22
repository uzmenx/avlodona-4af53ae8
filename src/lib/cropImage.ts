export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => {
      console.error('Error loading image:', error);
      reject(error);
    });
    // Only set crossOrigin if it's not a data URL to prevent CORS errors on base64 strings
    if (!url.startsWith('data:')) {
      image.setAttribute('crossOrigin', 'anonymous');
    }
    image.src = url;
  });

export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

export function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

// Most mobile browsers (especially Android Chrome / WebView) silently clamp
// canvas dimensions over ~4096px which destroys image quality. We cap the
// output here so the final image stays sharp on every device.
const MAX_OUTPUT_DIMENSION = 4096;

export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<string> {
  const image = await createImage(imageSrc);

  if (!pixelCrop || pixelCrop.width <= 0 || pixelCrop.height <= 0) {
    throw new Error('Invalid crop dimensions. Width and height must be > 0');
  }

  // Determine target output size — never upscale, never exceed safe canvas size.
  const scale = Math.min(
    1,
    MAX_OUTPUT_DIMENSION / Math.max(pixelCrop.width, pixelCrop.height)
  );
  const outW = Math.round(pixelCrop.width * scale);
  const outH = Math.round(pixelCrop.height * scale);

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = outW;
  croppedCanvas.height = outH;
  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) throw new Error('No 2d context');

  croppedCtx.imageSmoothingEnabled = true;
  croppedCtx.imageSmoothingQuality = 'high';

  // Fast path: no rotation, no flip -> draw the source crop directly.
  // Avoids creating a huge intermediate canvas (which Android often clamps).
  if (rotation === 0 && !flip.horizontal && !flip.vertical) {
    croppedCtx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      outW,
      outH
    );
  } else {
    const rotRad = getRadianAngle(rotation);
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
      image.width,
      image.height,
      rotation
    );

    const canvas = document.createElement('canvas');
    // Clamp the intermediate rotated canvas too.
    const bScale = Math.min(1, MAX_OUTPUT_DIMENSION / Math.max(bBoxWidth, bBoxHeight));
    canvas.width = Math.round(bBoxWidth * bScale);
    canvas.height = Math.round(bBoxHeight * bScale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rotRad);
    ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
    ctx.translate((-image.width * bScale) / 2, (-image.height * bScale) / 2);
    ctx.drawImage(image, 0, 0, image.width * bScale, image.height * bScale);

    croppedCtx.drawImage(
      canvas,
      pixelCrop.x * bScale,
      pixelCrop.y * bScale,
      pixelCrop.width * bScale,
      pixelCrop.height * bScale,
      0,
      0,
      outW,
      outH
    );
  }

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (file) => {
        if (file) resolve(URL.createObjectURL(file));
        else reject(new Error('Canvas is empty'));
      },
      'image/jpeg',
      0.95
    );
  });
}
