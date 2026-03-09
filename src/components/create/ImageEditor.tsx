import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Check, RotateCcw, Sun, Contrast, Droplets, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageEditorProps {
  src: string;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}

interface Filters {
  brightness: number;
  contrast: number;
  saturation: number;
}

const PRESETS: { name: string; filters: Filters }[] = [
  { name: 'Original', filters: { brightness: 100, contrast: 100, saturation: 100 } },
  { name: 'Vivid', filters: { brightness: 105, contrast: 115, saturation: 140 } },
  { name: 'Warm', filters: { brightness: 108, contrast: 105, saturation: 120 } },
  { name: 'Cool', filters: { brightness: 100, contrast: 110, saturation: 80 } },
  { name: 'B&W', filters: { brightness: 105, contrast: 120, saturation: 0 } },
  { name: 'Fade', filters: { brightness: 110, contrast: 85, saturation: 90 } },
];

const ImageEditor = ({ src, onSave, onCancel }: ImageEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [filters, setFilters] = useState<Filters>({ brightness: 100, contrast: 100, saturation: 100 });
  const [activePreset, setActivePreset] = useState(0);
  const [showSliders, setShowSliders] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      drawImage();
    };
    img.src = src;
  }, [src]);

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const maxW = 1080;
    const maxH = 1080;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > maxW || h > maxH) {
      const ratio = Math.min(maxW / w, maxH / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d')!;
    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`;
    ctx.drawImage(img, 0, 0, w, h);
  }, [filters]);

  useEffect(() => {
    drawImage();
  }, [drawImage]);

  const applyPreset = (idx: number) => {
    setActivePreset(idx);
    setFilters(PRESETS[idx].filters);
  };

  const resetFilters = () => {
    setFilters({ brightness: 100, contrast: 100, saturation: 100 });
    setActivePreset(0);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (blob) onSave(blob);
      },
      'image/webp',
      0.9
    );
  };

  const sliders = [
    { key: 'brightness' as const, icon: Sun, label: 'Yorqinlik' },
    { key: 'contrast' as const, icon: Contrast, label: 'Kontrast' },
    { key: 'saturation' as const, icon: Droplets, label: 'To\'yinganlik' },
  ];

  return (
    <div className="space-y-4">
      {/* Canvas preview */}
      <div className="relative rounded-xl overflow-hidden bg-muted flex items-center justify-center max-h-[50vh]">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-[50vh] object-contain"
        />
      </div>

      {/* Filter presets */}
      <div className="flex gap-2 overflow-x-auto pb-1 px-1">
        {PRESETS.map((preset, i) => (
          <button
            key={preset.name}
            onClick={() => applyPreset(i)}
            className={cn(
              'flex-shrink-0 text-center space-y-1',
              activePreset === i && 'ring-2 ring-primary rounded-xl'
            )}
          >
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
              <img
                src={src}
                alt={preset.name}
                className="w-full h-full object-cover"
                style={{
                  filter: `brightness(${preset.filters.brightness}%) contrast(${preset.filters.contrast}%) saturate(${preset.filters.saturation}%)`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">{preset.name}</p>
          </button>
        ))}
      </div>

      {/* Toggle sliders */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full gap-2"
        onClick={() => setShowSliders(!showSliders)}
      >
        <Palette className="h-4 w-4" />
        {showSliders ? 'Yashirish' : 'Qo\'lda sozlash'}
      </Button>

      {/* Manual sliders */}
      {showSliders && (
        <div className="space-y-3 p-3 rounded-xl border border-border bg-muted/30">
          {sliders.map(({ key, icon: Icon, label }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
                <span className="font-mono text-muted-foreground">{filters[key]}%</span>
              </div>
              <Slider
                min={0}
                max={200}
                step={1}
                value={[filters[key]]}
                onValueChange={([v]) => {
                  setFilters((f) => ({ ...f, [key]: v }));
                  setActivePreset(-1);
                }}
              />
            </div>
          ))}
          <Button variant="ghost" size="sm" className="w-full gap-1" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5" />
            Asliga qaytarish
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
          Bekor qilish
        </Button>
        <Button className="flex-1 rounded-xl" onClick={handleSave}>
          <Check className="h-4 w-4 mr-1" />
          Saqlash
        </Button>
      </div>
    </div>
  );
};

export default ImageEditor;
