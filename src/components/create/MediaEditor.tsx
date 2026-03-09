import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Type, Smile, RotateCcw, Play, Pause,
  Volume2, VolumeX, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MEDIA_FILTERS, EMOJIS } from './filters';
import FilterStrip from './FilterStrip';
import TextOverlay, { TextItem } from './TextOverlay';
import type { CapturedMedia } from './MediaCapture';

interface EditableItem {
  media: CapturedMedia;
  filter: string;
  texts: TextItem[];
}

interface MediaEditorProps {
  mediaItems: CapturedMedia[];
  onDone: (items: { file: File; filter: string }[]) => void;
  onBack: () => void;
}

export default function MediaEditor({ mediaItems, onDone, onBack }: MediaEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [items, setItems] = useState<EditableItem[]>(() =>
    mediaItems.map(m => ({ media: m, filter: 'original', texts: [] }))
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [isExporting, setIsExporting] = useState(false);
  const [filterNameVisible, setFilterNameVisible] = useState(false);
  const [filterNameText, setFilterNameText] = useState('');
  const filterTimer = useRef<number>();
  const swipeStart = useRef(0);

  const active = items[activeIndex];
  const isVideo = active.media.type === 'video';
  const currentFilter = MEDIA_FILTERS.find(f => f.name === active.filter) || MEDIA_FILTERS[0];

  const updateActive = useCallback((partial: Partial<EditableItem>) => {
    setItems(prev => prev.map((item, i) => i === activeIndex ? { ...item, ...partial } : item));
  }, [activeIndex]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  // Video controls
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime('0:00');
    setDuration('0:00');
  }, [activeIndex]);

  // Text
  const addText = useCallback(() => {
    if (!textValue.trim()) return;
    updateActive({
      texts: [...active.texts, {
        id: crypto.randomUUID(),
        content: textValue,
        x: 50, y: 50, scale: 1, rotation: 0, fontSize: 22, isEmoji: false,
      }],
    });
    setTextValue('');
    setShowTextInput(false);
  }, [textValue, active.texts, updateActive]);

  const addEmoji = useCallback((emoji: string) => {
    updateActive({
      texts: [...active.texts, {
        id: crypto.randomUUID(),
        content: emoji,
        x: 50, y: 35, scale: 1, rotation: 0, fontSize: 40, isEmoji: true,
      }],
    });
    setShowEmojiPicker(false);
  }, [active.texts, updateActive]);

  // Swipe filter
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStart.current = e.touches[0].clientX;
  }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - swipeStart.current;
    if (Math.abs(diff) > 50) {
      const idx = MEDIA_FILTERS.findIndex(f => f.name === active.filter);
      const next = diff < 0
        ? Math.min(MEDIA_FILTERS.length - 1, idx + 1)
        : Math.max(0, idx - 1);
      if (next !== idx) {
        const f = MEDIA_FILTERS[next];
        updateActive({ filter: f.name });
        setFilterNameText(f.label);
        setFilterNameVisible(true);
        clearTimeout(filterTimer.current);
        filterTimer.current = window.setTimeout(() => setFilterNameVisible(false), 600);
      }
    }
  }, [active.filter, updateActive]);

  // Export
  const handleDone = useCallback(async () => {
    setIsExporting(true);
    try {
      const results: { file: File; filter: string }[] = [];
      for (const item of items) {
        // For now, pass original file + filter info. Actual filter baking happens at upload time if needed.
        results.push({ file: item.media.file, filter: item.filter });
      }
      onDone(results);
    } finally {
      setIsExporting(false);
    }
  }, [items, onDone]);

  const GlassBtn = ({ onClick, children, className = '', label }: {
    onClick: () => void; children: React.ReactNode; className?: string; label?: string;
  }) => (
    <button
      onClick={onClick}
      className={cn('flex flex-col items-center gap-0.5', className)}
    >
      <div className="w-11 h-11 rounded-xl bg-black/40 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white shadow-lg">
        {children}
      </div>
      {label && <span className="text-[9px] text-white/70 font-medium">{label}</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-br from-slate-900 via-purple-900/80 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-3 h-12 flex-shrink-0 pt-2">
        <GlassBtn onClick={onBack} label="Orqaga">
          <X className="w-5 h-5" />
        </GlassBtn>

        {isVideo && (
          <GlassBtn onClick={() => {
            setIsMuted(!isMuted);
            if (videoRef.current) videoRef.current.muted = !isMuted;
          }} label="Ovoz">
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </GlassBtn>
        )}

        <GlassBtn
          onClick={handleDone}
          label="Tayyor"
          className={isExporting ? 'opacity-50 pointer-events-none' : ''}
        >
          <ChevronRight className="w-5 h-5" />
        </GlassBtn>
      </header>

      {/* Main canvas */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center px-1">
        <div
          ref={containerRef}
          className="relative w-full max-w-md aspect-[9/16] max-h-[calc(100vh-220px)] rounded-2xl overflow-hidden border border-white/20 shadow-2xl"
          onTouchStart={handleSwipeStart}
          onTouchEnd={handleSwipeEnd}
        >
          {isVideo ? (
            <video
              ref={videoRef}
              src={active.media.url}
              className="w-full h-full object-cover"
              style={{ filter: currentFilter.css }}
              playsInline
              loop
              muted={isMuted}
              onTimeUpdate={() => {
                const v = videoRef.current;
                if (v) {
                  setProgress((v.currentTime / v.duration) * 100);
                  setCurrentTime(fmt(v.currentTime));
                }
              }}
              onLoadedMetadata={() => {
                const v = videoRef.current;
                if (v) setDuration(fmt(v.duration));
              }}
              onClick={togglePlay}
            />
          ) : (
            <img
              src={active.media.url}
              alt="Edit"
              className="w-full h-full object-cover"
              style={{ filter: currentFilter.css }}
            />
          )}

          {/* Text overlays */}
          {active.texts.map(t => (
            <TextOverlay
              key={t.id}
              item={t}
              containerRef={containerRef as React.RefObject<HTMLDivElement>}
              onUpdate={(updated) => updateActive({ texts: active.texts.map(x => x.id === updated.id ? updated : x) })}
              onDelete={(id) => updateActive({ texts: active.texts.filter(x => x.id !== id) })}
            />
          ))}

          {/* Filter name flash */}
          {filterNameVisible && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
              <div className="px-5 py-2.5 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/20">
                <span className="text-white font-bold text-xl">{filterNameText}</span>
              </div>
            </div>
          )}

          {/* Play/pause for video */}
          {isVideo && (
            <button onClick={togglePlay} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
              <div className="w-14 h-14 rounded-full bg-black/30 backdrop-blur-xl border border-white/25 flex items-center justify-center">
                {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white fill-white ml-0.5" />}
              </div>
            </button>
          )}
        </div>

        {/* Right side tools */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-3">
          <GlassBtn onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowTextInput(false); }} label="Stiker">
            <Smile className="w-5 h-5" />
          </GlassBtn>
          <GlassBtn onClick={() => { setShowTextInput(true); setShowEmojiPicker(false); }} label="Matn">
            <Type className="w-5 h-5" />
          </GlassBtn>
        </div>

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-4 right-2 bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl p-3 grid grid-cols-6 gap-2 max-w-[260px] z-50">
            {EMOJIS.map(emoji => (
              <button key={emoji} onClick={() => addEmoji(emoji)} className="text-2xl p-1 rounded-lg hover:bg-white/10 transition-colors">
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Video progress */}
      {isVideo && (
        <div className="px-4 pb-1">
          <div className="flex justify-between text-[10px] text-purple-300 font-mono mb-1">
            <span>{currentTime}</span>
            <span>{duration}</span>
          </div>
          <div className="relative h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              const v = videoRef.current;
              if (!v) return;
              const rect = e.currentTarget.getBoundingClientRect();
              v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
            }}
          >
            <div className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-primary to-purple-400 transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Filter dots + thumbnails */}
      <div className="flex-shrink-0 pb-4">
        <FilterStrip selectedFilter={active.filter} onSelectFilter={(f) => updateActive({ filter: f })} />

        {items.length > 1 && (
          <div className="flex items-center justify-center gap-2 py-2 px-4">
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  'w-12 h-12 rounded-xl overflow-hidden border-2 transition-all',
                  i === activeIndex
                    ? 'border-primary scale-110 shadow-lg'
                    : 'border-white/20 opacity-60'
                )}
              >
                <img src={item.media.thumbnail || item.media.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text input modal */}
      {showTextInput && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-black/70 backdrop-blur-xl border border-white/20 rounded-2xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-lg text-white">Matn qo'shish</h3>
            <p className="text-[11px] text-white/50">@username #hashtag yoki link avtomatik aniqlanadi</p>
            <textarea
              autoFocus
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Matn, @mention, #hashtag..."
              className="w-full h-24 p-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowTextInput(false); setTextValue(''); }}
                className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white font-medium"
              >
                Bekor
              </button>
              <button
                onClick={addText}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              >
                Qo'shish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
