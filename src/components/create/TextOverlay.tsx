import { useState } from 'react';
import { X, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useOverlayGestures } from './useOverlayGestures';

export type TextBg = 'none' | 'semi' | 'solid';
export type TextFont = 'bold' | 'serif' | 'mono' | 'script' | 'rounded';

export interface TextItem {
  id: string;
  content: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  fontSize: number;
  isEmoji: boolean;
  color?: string;
  bg?: TextBg;
  font?: TextFont;
  align?: 'left' | 'center' | 'right';
}

interface TextOverlayProps {
  item: TextItem;
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (item: TextItem) => void;
  onDelete: (id: string) => void;
  isOverTrash?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const FONT_MAP: Record<TextFont, string> = {
  bold: '900 {sz}px system-ui, -apple-system, Arial, sans-serif',
  serif: '700 {sz}px Georgia, "Times New Roman", serif',
  mono: '700 {sz}px "Courier New", Courier, monospace',
  script: '700 {sz}px cursive',
  rounded: '700 {sz}px "Nunito", "Quicksand", "Varela Round", system-ui, Arial, sans-serif',
};

function parseText(text: string) {
  const parts: { text: string; type: 'text' | 'mention' | 'hashtag' | 'link' }[] = [];
  const regex = /(@\w+|#\w+|https?:\/\/\S+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), type: 'text' });
    }
    const val = match[0];
    if (val.startsWith('@')) parts.push({ text: val, type: 'mention' });
    else if (val.startsWith('#')) parts.push({ text: val, type: 'hashtag' });
    else parts.push({ text: val, type: 'link' });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), type: 'text' });
  }
  return parts;
}

export default function TextOverlay({ item, containerRef, onUpdate, onDelete, isOverTrash, onDragStart, onDragEnd }: TextOverlayProps) {
  const { isDragging, bindGestures } = useOverlayGestures({
    item,
    onUpdate,
    containerRef,
    snapAngles: true,
    onDragStart,
    onDragEnd,
  });

  const parts = item.isEmoji ? null : parseText(item.content);
  const bg = item.bg ?? 'none';
  const font = item.font ?? 'bold';
  const color = item.color ?? '#FFFFFF';
  const align = item.align ?? 'center';

  const fontFamily = {
    bold: 'system-ui, -apple-system, Arial, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    mono: '"Courier New", Courier, monospace',
    script: 'cursive',
    rounded: '"Nunito", "Quicksand", system-ui, Arial, sans-serif',
  }[font];

  const fontWeight = font === 'script' ? '700' : '900';

  const bgStyle: React.CSSProperties = bg === 'solid'
    ? { backgroundColor: color === '#FFFFFF' ? '#000000' : '#FFFFFF', color: color === '#FFFFFF' ? 'white' : 'black', padding: '4px 10px', borderRadius: 8 }
    : bg === 'semi'
    ? { backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 8, backdropFilter: 'blur(4px)' }
    : {};

  return (
    <div
      {...bindGestures}
      data-oid={item.id}
      className="absolute select-none touch-none cursor-move group"
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)`,
        fontSize: `${item.fontSize}px`,
        zIndex: isDragging ? 50 : 40,
        textAlign: align,
        transition: isOverTrash ? 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s' : undefined,
        opacity: isOverTrash ? 0.35 : 1,
      }}
    >
      <div 
        className="relative transition-transform duration-150"
        style={{
          ...bgStyle,
          transform: isOverTrash ? 'scale(0.5)' : 'scale(1)',
        }}
      >
        {item.isEmoji ? (
          <span className="leading-none">{item.content}</span>
        ) : (
          <span
            style={{
              fontFamily,
              fontWeight,
              color,
              whiteSpace: 'nowrap',
              textShadow: bg === 'none' ? '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)' : 'none',
              display: 'block',
            }}
          >
            {parts!.map((p, i) => (
              <span
                key={i}
                style={{
                  color:
                    p.type === 'mention' ? 'hsl(210, 100%, 65%)' :
                    p.type === 'hashtag' ? 'hsl(185, 100%, 60%)' :
                    p.type === 'link' ? 'hsl(210, 100%, 65%)' : color,
                }}
              >
                {p.text}
              </span>
            ))}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          className="absolute -top-3 -right-3 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3 text-destructive-foreground" />
        </button>
      </div>
    </div>
  );
}

// ─── TextEditModal (inline styled editor) ───────────────────────────────────

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#FF2D55', '#FF9F0A', '#FFD60A', '#32D74B', '#00C7FF', '#BF5AF2',
];

interface TextEditModalProps {
  initialText?: string;
  initialColor?: string;
  initialBg?: TextBg;
  initialFont?: TextFont;
  initialAlign?: 'left' | 'center' | 'right';
  onConfirm: (opts: { text: string; color: string; bg: TextBg; font: TextFont; align: 'left' | 'center' | 'right' }) => void;
  onCancel: () => void;
}

export function TextEditModal({
  initialText = '',
  initialColor = '#FFFFFF',
  initialBg = 'none',
  initialFont = 'bold',
  initialAlign = 'center',
  onConfirm,
  onCancel,
}: TextEditModalProps) {
  const [text, setText] = useState(initialText);
  const [color, setColor] = useState(initialColor);
  const [bg, setBg] = useState<TextBg>(initialBg);
  const [font, setFont] = useState<TextFont>(initialFont);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>(initialAlign);

  const FONTS: { id: TextFont; label: string; fontFamily: string }[] = [
    { id: 'bold', label: 'Bold', fontFamily: 'system-ui' },
    { id: 'serif', label: 'Serif', fontFamily: 'Georgia, serif' },
    { id: 'mono', label: 'Mono', fontFamily: 'Courier New, monospace' },
    { id: 'script', label: 'Script', fontFamily: 'cursive' },
    { id: 'rounded', label: 'Round', fontFamily: 'system-ui' },
  ];

  const BG_OPTIONS: { id: TextBg; label: string }[] = [
    { id: 'none', label: 'Yoq' },
    { id: 'semi', label: 'Shaffof' },
    { id: 'solid', label: 'Qattiq' },
  ];

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4">
      <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl p-4 w-full max-w-sm space-y-3">
        {/* Preview text */}
        <div
          className="min-h-12 flex items-center justify-center rounded-xl px-3 py-2 mb-1"
          style={{
            backgroundColor: bg === 'solid' ? (color === '#FFFFFF' ? '#111' : '#fff') : bg === 'semi' ? 'rgba(0,0,0,0.5)' : 'transparent',
          }}
        >
          <p
            style={{
              fontFamily: FONTS.find(f => f.id === font)?.fontFamily,
              fontWeight: 900,
              color,
              fontSize: 22,
              textAlign: align,
              textShadow: bg === 'none' ? '0 2px 8px rgba(0,0,0,0.9)' : 'none',
              width: '100%',
              wordBreak: 'break-word',
              minHeight: 28,
            }}
          >
            {text || <span style={{ opacity: 0.3 }}>Matn yozing...</span>}
          </p>
        </div>

        {/* Textarea */}
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Matn, @mention, #hashtag..."
          className="w-full h-20 p-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        />

        {/* Font row */}
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FONTS.map(f => (
            <button
              key={f.id}
              onClick={() => setFont(f.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs border transition-all ${
                font === f.id ? 'border-white bg-white text-black' : 'border-white/20 text-white/70 bg-white/5'
              }`}
              style={{ fontFamily: f.fontFamily }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Color + Align + BG row */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {TEXT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full flex-shrink-0 border-2 transition-transform ${color === c ? 'scale-125 border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Align */}
          <div className="flex gap-1 flex-shrink-0">
            {(['left', 'center', 'right'] as const).map(a => {
              const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
              return (
                <button
                  key={a}
                  onClick={() => setAlign(a)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                    align === a ? 'bg-white/20 border-white/40' : 'border-white/10 bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-white" />
                </button>
              );
            })}
          </div>
        </div>

        {/* BG mode */}
        <div className="flex gap-2">
          {BG_OPTIONS.map(b => (
            <button
              key={b.id}
              onClick={() => setBg(b.id)}
              className={`flex-1 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                bg === b.id ? 'bg-white text-black border-white' : 'bg-white/5 text-white/70 border-white/15'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Confirm/Cancel */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white font-medium"
          >
            Bekor
          </button>
          <button
            onClick={() => text.trim() && onConfirm({ text: text.trim(), color, bg, font, align })}
            disabled={!text.trim()}
            className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
          >
            Qo'shish
          </button>
        </div>
      </div>
    </div>
  );
}
