 import { useState, useRef, useCallback } from 'react';
 import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
 import 'react-image-crop/dist/ReactCrop.css';
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Loader2, RotateCcw, Check, X } from 'lucide-react';
 
 interface ImageCropperProps {
   isOpen: boolean;
   onClose: () => void;
   imageUrl: string;
   aspectRatio: number;
   shape?: 'circle' | 'rect';
   onCropComplete: (croppedImageUrl: string) => Promise<void>;
   title?: string;
 }
 
 function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
   return centerCrop(
     makeAspectCrop(
       {
         unit: '%',
         width: 90,
       },
       aspect,
       mediaWidth,
       mediaHeight
     ),
     mediaWidth,
     mediaHeight
   );
 }
 
 export const ImageCropper = ({
   isOpen,
   onClose,
   imageUrl,
   aspectRatio,
   shape = 'rect',
   onCropComplete,
   title = 'Rasmni kesish'
 }: ImageCropperProps) => {
   const [crop, setCrop] = useState<Crop>();
   const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
   const [isLoading, setIsLoading] = useState(false);
   const imgRef = useRef<HTMLImageElement>(null);
 
   const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
     const { width, height } = e.currentTarget;
     setCrop(centerAspectCrop(width, height, aspectRatio));
   }, [aspectRatio]);
 
   const getCroppedImage = useCallback(async (): Promise<string> => {
     const image = imgRef.current;
     if (!image || !completedCrop) {
       throw new Error('Crop not ready');
     }
 
     const canvas = document.createElement('canvas');
     const scaleX = image.naturalWidth / image.width;
     const scaleY = image.naturalHeight / image.height;
     
     canvas.width = completedCrop.width * scaleX;
     canvas.height = completedCrop.height * scaleY;
     
     const ctx = canvas.getContext('2d');
     if (!ctx) throw new Error('No 2d context');
 
     ctx.drawImage(
       image,
       completedCrop.x * scaleX,
       completedCrop.y * scaleY,
       completedCrop.width * scaleX,
       completedCrop.height * scaleY,
       0,
       0,
       canvas.width,
       canvas.height
     );
 
     return new Promise((resolve) => {
       canvas.toBlob((blob) => {
         if (blob) {
           resolve(URL.createObjectURL(blob));
         }
       }, 'image/jpeg', 0.95);
     });
   }, [completedCrop]);
 
   const handleConfirm = async () => {
     try {
       setIsLoading(true);
       const croppedUrl = await getCroppedImage();
       await onCropComplete(croppedUrl);
       onClose();
     } catch (error) {
       console.error('Crop error:', error);
     } finally {
       setIsLoading(false);
     }
   };
 
   const handleReset = () => {
     if (imgRef.current) {
       const { width, height } = imgRef.current;
       setCrop(centerAspectCrop(width, height, aspectRatio));
     }
   };
 
   return (
     <Dialog open={isOpen} onOpenChange={onClose}>
       <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
         <DialogHeader>
           <DialogTitle>{title}</DialogTitle>
         </DialogHeader>
         
         <div className="flex-1 overflow-auto flex items-center justify-center min-h-[300px] bg-muted/50 rounded-lg">
           <ReactCrop
             crop={crop}
             onChange={(_, percentCrop) => setCrop(percentCrop)}
             onComplete={(c) => setCompletedCrop(c)}
             aspect={aspectRatio}
             circularCrop={shape === 'circle'}
             className="max-h-[60vh]"
           >
             <img
               ref={imgRef}
               src={imageUrl}
               alt="Crop preview"
               onLoad={onImageLoad}
               className="max-h-[60vh] object-contain"
               crossOrigin="anonymous"
             />
           </ReactCrop>
         </div>
 
         <div className="flex items-center justify-between pt-4 border-t">
           <Button variant="ghost" size="sm" onClick={handleReset}>
             <RotateCcw className="h-4 w-4 mr-2" />
             Qayta
           </Button>
           
           <div className="flex gap-2">
             <Button variant="outline" onClick={onClose} disabled={isLoading}>
               <X className="h-4 w-4 mr-2" />
               Bekor
             </Button>
             <Button onClick={handleConfirm} disabled={isLoading || !completedCrop}>
               {isLoading ? (
                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
               ) : (
                 <Check className="h-4 w-4 mr-2" />
               )}
               Saqlash
             </Button>
           </div>
         </div>
       </DialogContent>
     </Dialog>
   );
 };