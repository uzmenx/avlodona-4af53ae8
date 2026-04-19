import { useCallback, useEffect, useRef, useState } from 'react';
import { MEDIA_FILTERS } from './filters';

interface FilterStripProps {
  selectedFilter: string;
  onSelectFilter: (filter: string) => void;
  previewSrc?: string; // optional image src for filter thumbnails
}

export default function FilterStrip({ selectedFilter, onSelectFilter, previewSrc }: FilterStripProps) {
  const [showName, setShowName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const timerRef = useRef<number>();

  const currentIdx = MEDIA_FILTERS.findIndex(f => f.name === selectedFilter);

  const selectFilter = useCallback((f: typeof MEDIA_FILTERS[0]) => {
    onSelectFilter(f.name);
    setDisplayName(f.label);
    setShowName(true);
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setShowName(false), 700);
  }, [onSelectFilter]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="relative w-full">
      {showName && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-in fade-in duration-150">
          <div className="px-4 py-1.5 rounded-xl bg-black/60 backdrop-blur-xl border border-white/20 shadow-lg">
            <span className="text-white font-bold text-sm tracking-wide">{displayName}</span>
          </div>
        </div>
      )}

      <div className="flex gap-2.5 py-2 px-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {MEDIA_FILTERS.map((f, i) => (
          <button
            key={f.name}
            onClick={() => selectFilter(f)}
            className="flex flex-col items-center gap-1 flex-shrink-0"
          >
            {/* Filter thumbnail */}
            <div
              className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition-all duration-150 ${
                i === currentIdx
                  ? 'border-primary scale-110 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]'
                  : 'border-white/10 scale-100'
              }`}
            >
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt={f.label}
                  className="w-full h-full object-cover"
                  style={{ filter: f.css }}
                  draggable={false}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white/30"
                  style={{
                    background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
                    filter: f.css,
                  }}
                >
                  <span className="text-lg">🌆</span>
                </div>
              )}
              {/* Selected indicator overlay */}
              {i === currentIdx && (
                <div className="absolute inset-0 border-2 border-primary rounded-xl pointer-events-none" />
              )}
            </div>
            <span
              className={`text-[9px] font-semibold transition-colors ${
                i === currentIdx ? 'text-primary' : 'text-white/50'
              }`}
            >
              {f.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
