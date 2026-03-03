import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Pause, Play, Search, X } from 'lucide-react';

type JamendoTrack = {
  id: string;
  name: string;
  artist_name: string;
  audio: string;
};

export type SelectedMusic = {
  audio_url: string;
  audio_title: string;
  audio_artist: string;
};

interface MusicPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (music: SelectedMusic) => void;
  selectedMusic: SelectedMusic | null;
  onRemove: () => void;
}

const CLIENT_ID = '86ff102d';

export const MusicPicker = ({ open, onOpenChange, onSelect, selectedMusic, onRemove }: MusicPickerProps) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<JamendoTrack[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const searchUrl = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return '';

    const url = new URL('https://api.jamendo.com/v3.0/tracks/');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '10');
    url.searchParams.set('search', q);
    url.searchParams.set('include', 'musicinfo');
    url.searchParams.set('audioformat', 'mp32');
    return url.toString();
  }, [query]);

  useEffect(() => {
    if (!open) return;

    const q = query.trim();
    if (q.length < 2) {
      setTracks([]);
      setError(null);
      setLoading(false);
      return;
    }

    const t = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(searchUrl, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('Musiqa qidirishda xatolik');
        const json = (await res.json()) as any;
        const results: JamendoTrack[] = Array.isArray(json?.results)
          ? json.results.map((r: any) => ({
              id: String(r.id),
              name: String(r.name || ''),
              artist_name: String(r.artist_name || ''),
              audio: String(r.audio || ''),
            }))
          : [];
        setTracks(results.filter((t) => t.audio));
      } catch (e: any) {
        setTracks([]);
        setError(e?.message || 'Musiqa qidirishda xatolik');
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => window.clearTimeout(t);
  }, [open, query, searchUrl]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const stopPreview = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlayingId(null);
  };

  const togglePreview = async (track: JamendoTrack) => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.preload = 'none';
        audioRef.current.addEventListener('ended', () => setPlayingId(null));
      }

      if (playingId === track.id) {
        stopPreview();
        return;
      }

      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = track.audio;
      await audioRef.current.play();
      setPlayingId(track.id);
    } catch {
      setPlayingId(null);
    }
  };

  return (
    <>
      {selectedMusic && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{selectedMusic.audio_title}</p>
            <p className="text-[10px] text-muted-foreground truncate">{selectedMusic.audio_artist}</p>
          </div>
          <button onClick={onRemove} className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-base">Musiqa tanlash</SheetTitle>
          </SheetHeader>

          <div className="py-4 space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Musiqa qidiring…"
                className="pl-9 h-11 rounded-xl"
              />
            </div>

            {loading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}

            {!loading && error && <p className="text-xs text-destructive">{error}</p>}

            {!loading && !error && query.trim().length >= 2 && tracks.length === 0 && (
              <p className="text-xs text-muted-foreground">Hech narsa topilmadi</p>
            )}

            {!loading && tracks.length > 0 && (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {tracks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/50 bg-background"
                  >
                    <button
                      onClick={() => void togglePreview(t)}
                      className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"
                      aria-label={playingId === t.id ? 'Pause' : 'Play'}
                    >
                      {playingId === t.id ? (
                        <Pause className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Play className="h-3.5 w-3.5 text-primary" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        stopPreview();
                        onSelect({ audio_url: t.audio, audio_title: t.name, audio_artist: t.artist_name });
                        onOpenChange(false);
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-xs font-medium truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{t.artist_name}</p>
                    </button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => {
                        stopPreview();
                        onSelect({ audio_url: t.audio, audio_title: t.name, audio_artist: t.artist_name });
                        onOpenChange(false);
                      }}
                    >
                      Tanlash
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
