import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';

export type BrushStyle = 'pen' | 'neon' | 'highlighter' | 'eraser';

export interface DrawStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  style: BrushStyle;
  opacity: number;
}

export interface DrawingCanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  exportStrokes: () => DrawStroke[];
  drawStrokesToCanvas: (ctx: CanvasRenderingContext2D, w: number, h: number, strokes: DrawStroke[]) => void;
  hasStrokes: boolean;
}

const NEON_COLORS = [
  '#FFFFFF',
  '#FF2D55',
  '#FF9F0A',
  '#FFD60A',
  '#32D74B',
  '#00C7FF',
  '#BF5AF2',
  '#FF375F',
  '#30D158',
  '#0A84FF',
];

interface DrawingCanvasProps {
  width: number;
  height: number;
  onStrokeEnd?: () => void;
  isActive?: boolean;
  initialStrokes?: DrawStroke[];
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  ({ width, height, onStrokeEnd, isActive = true, initialStrokes }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const strokesRef = useRef<DrawStroke[]>([]);
    const redoStackRef = useRef<DrawStroke[]>([]);
    const currentStrokeRef = useRef<DrawStroke | null>(null);
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [, forceRender] = useState(0);

    const [selectedColor, setSelectedColor] = useState('#FFFFFF');
    const [brushSize, setBrushSize] = useState(6);
    const [brushStyle, setBrushStyle] = useState<BrushStyle>('pen');

    const getCtx = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      return ctx;
    }, []);

    const redrawAll = useCallback(() => {
      const ctx = getCtx();
      if (!ctx || !canvasRef.current) return;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      for (const stroke of strokesRef.current) {
        drawStroke(ctx, stroke);
      }
    }, [getCtx]);

    useEffect(() => {
      if (initialStrokes && initialStrokes.length > 0) {
        strokesRef.current = [...initialStrokes];
        // Request animation frame ensures canvas context is fully ready
        requestAnimationFrame(() => {
          redrawAll();
          forceRender(n => n + 1);
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const drawStroke = (ctx: CanvasRenderingContext2D, stroke: DrawStroke) => {
      if (stroke.points.length < 2) return;

      ctx.save();
      ctx.globalAlpha = stroke.opacity;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.style === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else if (stroke.style === 'neon') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowColor = stroke.color;
        ctx.shadowBlur = stroke.width * 2.5;
        ctx.strokeStyle = stroke.color;
      } else if (stroke.style === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const p1 = stroke.points[i]!;
        const p2 = stroke.points[i + 1]!;
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
      }
      const last = stroke.points[stroke.points.length - 1]!;
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.restore();
    };

    const getPos = (e: PointerEvent | React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      isDrawingRef.current = true;
      const pos = getPos(e);
      if (!pos) return;
      lastPointRef.current = pos;
      const stroke: DrawStroke = {
        id: crypto.randomUUID(),
        points: [pos],
        color: brushStyle === 'eraser' ? '#000000' : selectedColor,
        width: brushStyle === 'highlighter' ? brushSize * 3 : brushStyle === 'eraser' ? brushSize * 2.5 : brushSize,
        style: brushStyle,
        opacity: brushStyle === 'highlighter' ? 0.45 : 1,
      };
      currentStrokeRef.current = stroke;
      redoStackRef.current = [];
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [selectedColor, brushSize, brushStyle]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || !currentStrokeRef.current) return;
      e.preventDefault();
      const pos = getPos(e);
      if (!pos) return;

      const last = lastPointRef.current;
      if (last) {
        const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
        if (dist < 2) return;
      }
      lastPointRef.current = pos;
      currentStrokeRef.current.points.push(pos);

      const ctx = getCtx();
      if (!ctx) return;
      // Draw live incrementally
      const pts = currentStrokeRef.current.points;
      if (pts.length < 2) return;
      ctx.save();
      ctx.globalAlpha = currentStrokeRef.current.opacity;
      ctx.lineWidth = currentStrokeRef.current.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (currentStrokeRef.current.style === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else if (currentStrokeRef.current.style === 'neon') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowColor = currentStrokeRef.current.color;
        ctx.shadowBlur = currentStrokeRef.current.width * 2.5;
        ctx.strokeStyle = currentStrokeRef.current.color;
      } else if (currentStrokeRef.current.style === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentStrokeRef.current.color;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentStrokeRef.current.color;
      }
      ctx.beginPath();
      const n = pts.length;
      if (n >= 3) {
        const p1 = pts[n - 2]!;
        const p2 = pts[n - 1]!;
        const p0 = pts[n - 3]!;
        const mx0 = (p0.x + p1.x) / 2;
        const my0 = (p0.y + p1.y) / 2;
        const mx1 = (p1.x + p2.x) / 2;
        const my1 = (p1.y + p2.y) / 2;
        ctx.moveTo(mx0, my0);
        ctx.quadraticCurveTo(p1.x, p1.y, mx1, my1);
      } else {
        ctx.moveTo(pts[0]!.x, pts[0]!.y);
        ctx.lineTo(pts[1]!.x, pts[1]!.y);
      }
      ctx.stroke();
      ctx.restore();
    }, [getCtx]);

    const onPointerUp = useCallback(() => {
      if (!isDrawingRef.current || !currentStrokeRef.current) return;
      isDrawingRef.current = false;
      if (currentStrokeRef.current.points.length >= 2) {
        strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
        forceRender(n => n + 1);
        onStrokeEnd?.();
      }
      currentStrokeRef.current = null;
      lastPointRef.current = null;
    }, [onStrokeEnd]);

    useImperativeHandle(ref, () => ({
      undo: () => {
        if (strokesRef.current.length === 0) return;
        const last = strokesRef.current[strokesRef.current.length - 1]!;
        redoStackRef.current = [last, ...redoStackRef.current];
        strokesRef.current = strokesRef.current.slice(0, -1);
        redrawAll();
        forceRender(n => n + 1);
      },
      redo: () => {
        if (redoStackRef.current.length === 0) return;
        const next = redoStackRef.current[0]!;
        strokesRef.current = [...strokesRef.current, next];
        redoStackRef.current = redoStackRef.current.slice(1);
        redrawAll();
        forceRender(n => n + 1);
      },
      clear: () => {
        redoStackRef.current = [...strokesRef.current, ...redoStackRef.current];
        strokesRef.current = [];
        redrawAll();
        forceRender(n => n + 1);
      },
      exportStrokes: () => strokesRef.current,
      drawStrokesToCanvas: (ctx: CanvasRenderingContext2D, w: number, h: number, strokes: DrawStroke[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const scaleX = w / canvas.width;
        const scaleY = h / canvas.height;
        ctx.save();
        ctx.scale(scaleX, scaleY);
        for (const stroke of strokes) {
          drawStroke(ctx, stroke);
        }
        ctx.restore();
      },
      get hasStrokes() {
        return strokesRef.current.length > 0;
      },
    }), [redrawAll]);

    return (
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col">
        {/* Drawing canvas overlay */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={`absolute inset-0 w-full h-full ${isActive ? 'pointer-events-auto touch-none' : 'pointer-events-none'}`}
          style={{ cursor: brushStyle === 'eraser' ? 'cell' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={(e) => isActive && e.stopPropagation()}
          onTouchMove={(e) => isActive && e.stopPropagation()}
          onTouchEnd={(e) => isActive && e.stopPropagation()}
        />

        {/* Drawing Toolbar (bottom) */}
        {isActive && (
          <div className="absolute bottom-0 left-0 right-0 pointer-events-auto">
          {/* Brush style row */}
          <div className="flex items-center justify-center gap-3 px-4 pb-2">
            {(['pen', 'highlighter', 'neon', 'eraser'] as BrushStyle[]).map(style => (
              <button
                key={style}
                onClick={() => setBrushStyle(style)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  brushStyle === style
                    ? 'bg-white text-black border-white'
                    : 'bg-white/10 text-white/70 border-white/20'
                }`}
              >
                {style === 'pen' ? '✏️' : style === 'highlighter' ? '🖊️' : style === 'neon' ? '✨' : '⬜'}
                <span className="ml-1">
                  {style === 'pen' ? 'Qalem' : style === 'highlighter' ? 'Marker' : style === 'neon' ? 'Neon' : "O'chirish"}
                </span>
              </button>
            ))}
          </div>

          {/* Color palette + size */}
          <div className="flex items-center gap-3 px-4 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
              {NEON_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => { setSelectedColor(color); if (brushStyle === 'eraser') setBrushStyle('pen'); }}
                  className={`w-7 h-7 rounded-full flex-shrink-0 transition-transform ${
                    selectedColor === color && brushStyle !== 'eraser' ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-transparent' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            {/* Brush size */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {[3, 6, 12, 20].map(size => (
                <button
                  key={size}
                  onClick={() => setBrushSize(size)}
                  className={`rounded-full bg-white transition-all ${brushSize === size ? 'ring-2 ring-primary' : 'opacity-50'}`}
                  style={{ width: Math.max(10, size * 1.1) + 'px', height: Math.max(10, size * 1.1) + 'px' }}
                />
              ))}
            </div>
          </div>
        </div>
        )}
      </div>
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';
export default DrawingCanvas;
