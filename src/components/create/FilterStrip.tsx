import { useState, useRef, useCallback, useEffect } from 'react';
import { MEDIA_FILTERS } from './filters';

interface FilterStripProps {
  selectedFilter: string;
  onSelectFilter: (filter: string) => void;
}

export default function FilterStrip({ selectedFilter, onSelectFilter }: FilterStripProps) {
  const [showName, setShowName] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const timerRef = useRef<number>();

  const currentIdx = MEDIA_FILTERS.findIndex(f => f.name === selectedFilter);

  const selectFilter = useCallback((f: typeof MEDIA_FILTERS[0]) => {
    onSelectFilter(f.name);
    setDisplayName(f.label);
    setShowName(true);
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setShowName(false), 600);
  }, [onSelectFilter]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="relative w-full">
      {showName && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="px-4 py-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-white/20">
            <span className="text-white font-bold text-sm">{displayName}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 py-2">
        {MEDIA_FILTERS.map((f, i) => (
          <button
            key={f.name}
            onClick={() => selectFilter(f)}
            className={`rounded-full transition-all ${
              i === currentIdx
                ? 'w-2.5 h-2.5 bg-primary'
                : 'w-1.5 h-1.5 bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
