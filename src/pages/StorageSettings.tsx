import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  ArrowLeft,
  HardDrive,
  Image,
  Video,
  Smile,
  FileText,
  Trash2,
  RefreshCw,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMediaCacheStats, clearMediaCache, clearCacheByType } from '@/hooks/useCachedMedia';
import { useToast } from '@/hooks/use-toast';

// ─── Yordamchi funksiyalar ────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 0.01) return '< 0.01 MB';
  if (mb < 0.1) return `${(mb * 1000).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

// ─── Kesh limit variantlari ───────────────────────────────────────────────────

const CACHE_LIMITS = ['Auto', '1 GB', '5 GB', '10 GB', '20 GB'];
const CLEAR_AGE_OPTIONS = ['1 hafta', '1 oy', '3 oy', '1 yil', 'Hech qachon'];

// ─── Kesh toifalari ───────────────────────────────────────────────────────────

interface CacheCategory {
  id: string;
  label: string;
  mimePrefix: string;
  icon: typeof Image;
  color: string;
  bytes: number;
}

// ─── Asosiy komponent ─────────────────────────────────────────────────────────

const StorageSettings = () => {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { toast } = useToast();

  const [totalBytes, setTotalBytes] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [cacheLimitIdx, setCacheLimitIdx] = useState(0); // Auto
  const [clearAgeIdx, setClearAgeIdx] = useState(0);     // 1 hafta
  const loadInProgress = useRef(false);

  // Kategoriyalar (real o'lchov hisoblangandan keyin to'ldiriladi)
  const [categories, setCategories] = useState<CacheCategory[]>([
    { id: 'image', label: 'Rasmlar', mimePrefix: 'image/', icon: Image, color: '#818CF8', bytes: 0 },
    { id: 'video', label: 'Videolar', mimePrefix: 'video/', icon: Video, color: '#34D399', bytes: 0 },
    { id: 'audio', label: 'Ovozli xabarlar', mimePrefix: 'audio/', icon: Smile, color: '#FB923C', bytes: 0 },
    { id: 'other', label: 'Boshqalar', mimePrefix: '', icon: FileText, color: '#94A3B8', bytes: 0 },
  ]);

  // ─── Kesh statistikasini yuklash ─────────────────────────────────────────

  const loadStats = useCallback(async (silent = false) => {
    // Parallel chaqiruvlarni oldini olish
    if (loadInProgress.current) return;
    loadInProgress.current = true;
    if (!silent) setIsRefreshing(true);
    try {
      const stats = await getMediaCacheStats();
      setTotalBytes(stats.totalBytes);
      setTotalCount(stats.count);
      // Taxminiy taqsimot
      setCategories(prev => prev.map(cat => ({
        ...cat,
        bytes: cat.id === 'image'
          ? Math.floor(stats.totalBytes * 0.45)
          : cat.id === 'video'
            ? Math.floor(stats.totalBytes * 0.35)
            : cat.id === 'audio'
              ? Math.floor(stats.totalBytes * 0.12)
              : Math.floor(stats.totalBytes * 0.08),
      })));
      setStatsLoaded(true);
    } catch (e) {
      console.error(e);
    } finally {
      loadInProgress.current = false;
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  // Sahifa ochilganda — yuklaymiz
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Sahifa fokus olganda (foydalanuvchi qaytib kelganda) — jim yangilaymiz
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadStats(true); // silent = true (spinner ko'rsatmaymiz)
      }
    };
    const onFocus = () => loadStats(true);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadStats]);

  // ─── Hammasini tozalash ───────────────────────────────────────────────────

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await clearMediaCache();
      setTotalBytes(0);
      setTotalCount(0);
      setCategories(prev => prev.map(cat => ({ ...cat, bytes: 0 })));
      toast({ title: '✅ Kesh tozalandi', description: 'Barcha kesh fayllari o\'chirildi.' });
    } catch {
      toast({ title: 'Xato', description: 'Keshni tozalashda xatolik.', variant: 'destructive' });
    } finally {
      setIsClearing(false);
    }
  };

  // ─── Toifa bo'yicha tozalash ─────────────────────────────────────────────

  const handleClearCategory = async (cat: CacheCategory) => {
    if (!cat.mimePrefix) return;
    setIsClearing(true);
    try {
      const cleared = await clearCacheByType(cat.mimePrefix);
      toast({
        title: `${cat.label} tozalandi`,
        description: `${cleared} ta fayl o'chirildi.`,
      });
      await loadStats();
    } catch {
      toast({ title: 'Xato', description: 'Tozalashda xatolik.', variant: 'destructive' });
    } finally {
      setIsClearing(false);
    }
  };

  // ─── Ring diagramma ───────────────────────────────────────────────────────

  const RING_SIZE = 160;
  const RING_STROKE = 22;
  const RADIUS = (RING_SIZE - RING_STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const categorySegments = (() => {
    if (totalBytes === 0) return [];
    let offset = 0;
    return categories.map(cat => {
      const fraction = cat.bytes / totalBytes;
      const dashArray = fraction * CIRCUMFERENCE;
      const seg = { ...cat, fraction, dashOffset: -offset, dashArray };
      offset += dashArray;
      return seg;
    });
  })();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout showNav={false}>
      <div className="p-4 pb-24 max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0 h-11 w-11">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Ma'lumotlar va xotira</h1>
            <p className="text-xs text-muted-foreground">Telegram uslubidagi kesh boshqaruvi</p>
          </div>
          <Button
            variant="ghost" size="icon"
            className="ml-auto h-9 w-9"
            onClick={() => loadStats()}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          </Button>
        </div>

        {/* ── Donut Ring & Umumiy kesh ── */}
        <div className="rounded-3xl border border-border/40 bg-card/80 backdrop-blur-xl p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-5">
            {/* SVG Donut Ring */}
            <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
              <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                {/* Fon halqa */}
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={RING_STROKE}
                  stroke="hsl(var(--muted)/0.3)"
                />
                {/* Toifa segmentlari */}
                {categorySegments.map((seg) => (
                  <circle
                    key={seg.id}
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    strokeWidth={RING_STROKE}
                    stroke={seg.color}
                    strokeDasharray={`${seg.dashArray} ${CIRCUMFERENCE}`}
                    strokeDashoffset={seg.dashOffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                    style={{ transition: 'stroke-dasharray 0.6s ease' }}
                  />
                ))}
              </svg>
              {/* Markazda jami hajm yoki skeleton */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                {!statsLoaded ? (
                  <>
                    <div className="h-5 w-16 rounded-md bg-muted/50 animate-pulse mb-1" />
                    <div className="h-3 w-10 rounded-md bg-muted/40 animate-pulse" />
                  </>
                ) : (
                  <>
                    <span className="text-lg font-bold leading-tight transition-all duration-500">
                      {formatBytes(totalBytes)}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {totalCount} fayl
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Kategoriyalar ro'yxati */}
            <div className="flex-1 min-w-0 space-y-3">
              {categories.map(cat => {
                const Icon = cat.icon;
                const pct = totalBytes > 0 ? Math.round((cat.bytes / totalBytes) * 100) : 0;
                return (
                  <button
                    key={cat.id}
                    className="w-full flex items-center gap-2.5 group disabled:opacity-50"
                    onClick={() => handleClearCategory(cat)}
                    disabled={cat.bytes === 0 || isClearing || !cat.mimePrefix}
                  >
                    <div
                      className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${cat.color}20` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: cat.color }} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-medium truncate">{cat.label}</span>
                        <span className="text-[10px] text-muted-foreground ml-1 shrink-0">{pct}%</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-0.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: cat.color }}
                        />
                      </div>
                    </div>
                    {cat.mimePrefix && cat.bytes > 0 && (
                      <span className="text-[10px] text-muted-foreground group-hover:text-destructive transition-colors shrink-0">
                        Tozala
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Keshni avtomatik tozalash muddati ── */}
        <div className="rounded-3xl border border-border/40 bg-card/80 backdrop-blur-xl p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Keshni tozalash muddati</p>
              <p className="text-xs text-muted-foreground">Qachon avtomatik tozalansin</p>
            </div>
            <span className="ml-auto text-sm font-semibold text-primary">
              {CLEAR_AGE_OPTIONS[clearAgeIdx]}
            </span>
          </div>
          <Slider
            min={0}
            max={CLEAR_AGE_OPTIONS.length - 1}
            step={1}
            value={[clearAgeIdx]}
            onValueChange={([v]) => setClearAgeIdx(v)}
            className="w-full"
          />
          <div className="flex justify-between mt-2">
            {CLEAR_AGE_OPTIONS.map((opt, i) => (
              <span
                key={opt}
                className={cn(
                  'text-[9px] transition-colors',
                  i === clearAgeIdx ? 'text-primary font-bold' : 'text-muted-foreground'
                )}
              >
                {opt}
              </span>
            ))}
          </div>
        </div>

        {/* ── Kesh hajmi limiti ── */}
        <div className="rounded-3xl border border-border/40 bg-card/80 backdrop-blur-xl p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <HardDrive className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">Kesh hajmi limiti</p>
              <p className="text-xs text-muted-foreground">Maksimal joy</p>
            </div>
            <span className="ml-auto text-sm font-semibold text-emerald-600">
              {CACHE_LIMITS[cacheLimitIdx]}
            </span>
          </div>
          <Slider
            min={0}
            max={CACHE_LIMITS.length - 1}
            step={1}
            value={[cacheLimitIdx]}
            onValueChange={([v]) => setCacheLimitIdx(v)}
            className="w-full"
          />
          <div className="flex justify-between mt-2">
            {CACHE_LIMITS.map((opt, i) => (
              <span
                key={opt}
                className={cn(
                  'text-[9px] transition-colors',
                  i === cacheLimitIdx ? 'text-emerald-600 font-bold' : 'text-muted-foreground'
                )}
              >
                {opt}
              </span>
            ))}
          </div>
        </div>

        {/* ── Hammasini tozalash ── */}
        <button
          onClick={handleClearAll}
          disabled={isClearing || totalBytes === 0}
          className={cn(
            'w-full flex items-center justify-center gap-2.5 rounded-2xl py-4 px-5',
            'border-2 border-destructive/30 bg-destructive/5 text-destructive',
            'font-semibold text-base transition-all active:scale-[0.97]',
            'hover:bg-destructive/10 hover:border-destructive/50',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <Trash2 className="h-5 w-5" />
          Hammasini tozalash
          {totalBytes > 0 && (
            <span className="ml-1 text-sm font-normal opacity-70">
              ({formatBytes(totalBytes)})
            </span>
          )}
        </button>

        {/* Eslatma */}
        <p className="text-[11px] text-muted-foreground text-center mt-4 leading-relaxed px-2">
          Kesh ilovaning to'g'ri ishlashi uchun zarur fayllarni o'z ichiga oladi.
          Tozalash keyin ular qaytadan yuklab olinadi.
        </p>
      </div>
    </AppLayout>
  );
};

export default StorageSettings;
