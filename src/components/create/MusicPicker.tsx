import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bookmark, BookmarkCheck, Loader2, Pause, Play, Search, Trash2, X } from 'lucide-react';
import { useSavedMusic } from '@/hooks/useSavedMusic';

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
  file?: File;
};

type Tab = 'search' | 'saved';

interface MusicPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (music: SelectedMusic) => void;
  selectedMusic: SelectedMusic | null;
  onRemove: () => void;
}

const CLIENT_ID = '86ff102d';

export const MusicPicker = ({ open, onOpenChange, onSelect, selectedMusic, onRemove }: MusicPickerProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<JamendoTrack[]>([]);

  const { items: savedItems, isLoading: savedLoading, fetchSaved, isSaved, save, unsave } = useSavedMusic();
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

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
    if (activeTab !== 'search') return;

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
  }, [activeTab, open, query, searchUrl]);

  useEffect(() => {
    if (!open) return;
    if (activeTab === 'search') return;
    setLoading(false);
    setError(null);
    setTracks([]);
  }, [activeTab, open]);

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
    setPlayingKey(null);
  };

  const handleSelect = (payload: SelectedMusic) => {
    stopPreview();
    onSelect(payload);
    onOpenChange(false);
  };

  const toggleSave = async (t: JamendoTrack) => {
    if (!t.audio) return;
    setSavingUrl(t.audio);
    try {
      if (isSaved(t.audio)) {
        await unsave(t.audio);
      } else {
        await save({ audio_url: t.audio, audio_title: t.name, audio_artist: t.artist_name });
      }
    } finally {
      setSavingUrl(null);
    }
  };

  const togglePreview = async (track: JamendoTrack) => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.preload = 'none';
        audioRef.current.addEventListener('ended', () => setPlayingKey(null));
      }

      const key = `search:${track.id}`;
      if (playingKey === key) {
        stopPreview();
        return;
      }

      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = track.audio;
      await audioRef.current.play();
      setPlayingKey(key);
    } catch {
      setPlayingKey(null);
    }
  };

  const togglePreviewSaved = async (audioUrl: string) => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.preload = 'none';
        audioRef.current.addEventListener('ended', () => setPlayingKey(null));
      }

      const key = `saved:${audioUrl}`;
      if (playingKey === key) {
        stopPreview();
        return;
      }

      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = audioUrl;
      await audioRef.current.play();
      setPlayingKey(key);
    } catch {
      setPlayingKey(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (activeTab !== 'saved') return;
    void fetchSaved();
  }, [activeTab, fetchSaved, open]);

  useEffect(() => {
    if (!open) return;
    setActiveTab('search');
  }, [open]);

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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`h-11 rounded-xl text-sm font-medium border transition-colors ${
                  activeTab === 'search'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border/60 hover:text-foreground'
                }`}
              >
                Qidirish
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('saved')}
                className={`h-11 rounded-xl text-sm font-medium border transition-colors ${
                  activeTab === 'saved'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border/60 hover:text-foreground'
                }`}
              >
                Saqlangan
                {savedItems.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] bg-white/15">
                    {savedItems.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'search' && (
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Musiqa qidiring…"
                  className="pl-9 h-11 rounded-xl"
                />
              </div>
            )}

            {activeTab === 'search' && loading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}

            {activeTab === 'search' && !loading && error && <p className="text-xs text-destructive">{error}</p>}

            {activeTab === 'search' && !loading && !error && query.trim().length >= 2 && tracks.length === 0 && (
              <p className="text-xs text-muted-foreground">Hech narsa topilmadi</p>
            )}

            {activeTab === 'search' && !loading && tracks.length > 0 && (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {tracks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/50 bg-background"
                  >
                    <button
                      onClick={() => void togglePreview(t)}
                      className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"
                      aria-label={playingKey === `search:${t.id}` ? 'Pause' : 'Play'}
                    >
                      {playingKey === `search:${t.id}` ? (
                        <Pause className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Play className="h-3.5 w-3.5 text-primary" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        handleSelect({ audio_url: t.audio, audio_title: t.name, audio_artist: t.artist_name });
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-xs font-medium truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{t.artist_name}</p>
                    </button>

                    <button
                      type="button"
                      disabled={savingUrl === t.audio}
                      className="h-8 w-8 rounded-lg border border-border/60 bg-background hover:bg-muted transition-colors flex items-center justify-center"
                      onClick={() => {
                        void toggleSave(t);
                      }}
                      aria-label={isSaved(t.audio) ? 'Unsave' : 'Save'}
                    >
                      {savingUrl === t.audio ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : isSaved(t.audio) ? (
                        <BookmarkCheck className="h-4 w-4 text-primary" />
                      ) : (
                        <Bookmark className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => {
                        handleSelect({ audio_url: t.audio, audio_title: t.name, audio_artist: t.artist_name });
                      }}
                    >
                      Tanlash
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'saved' && (savedLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : savedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bookmark className="h-10 w-10 opacity-40" />
                <p className="mt-3 text-sm">Hali musiqa saqlanmagan</p>
                <p className="mt-1 text-xs opacity-70">Qidirish tabida saqlab qo‘ying</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {savedItems.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/50 bg-background"
                  >
                    <button
                      onClick={() => void togglePreviewSaved(s.audio_url)}
                      className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"
                      aria-label={playingKey === `saved:${s.audio_url}` ? 'Pause' : 'Play'}
                    >
                      {playingKey === `saved:${s.audio_url}` ? (
                        <Pause className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Play className="h-3.5 w-3.5 text-primary" />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        handleSelect({
                          audio_url: s.audio_url,
                          audio_title: s.audio_title || 'Musiqa',
                          audio_artist: s.audio_artist || '',
                        });
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-xs font-medium truncate">{s.audio_title || 'Musiqa'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{s.audio_artist || ''}</p>
                    </button>

                    <button
                      type="button"
                      disabled={deletingUrl === s.audio_url}
                      className="h-8 w-8 rounded-lg border border-border/60 bg-background hover:bg-destructive/5 transition-colors flex items-center justify-center"
                      onClick={() => {
                        setDeletingUrl(s.audio_url);
                        void unsave(s.audio_url).finally(() => setDeletingUrl(null));
                      }}
                      aria-label="Remove saved"
                    >
                      {deletingUrl === s.audio_url ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => {
                        handleSelect({
                          audio_url: s.audio_url,
                          audio_title: s.audio_title || 'Musiqa',
                          audio_artist: s.audio_artist || '',
                        });
                      }}
                    >
                      Tanlash
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
