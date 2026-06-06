import { useEffect, useState } from 'react';
import { Wand2, Download, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const IMAGE_GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-image-gen`;

const STORAGE_KEY = 'ai_image_history_v1';
const LIMIT_STORAGE_KEY = 'ai_image_gen_limit_v1';
const LIMIT_HOURS = 15;
const LIMIT_MS = LIMIT_HOURS * 60 * 60 * 1000;

const normalizeImageSrc = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith('data:image/')) return v;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  const b64Only = /^[A-Za-z0-9+/=]{200,}$/.test(v);
  if (b64Only) return `data:image/png;base64,${v}`;
  return null;
};

const AIImageView = () => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [lastGenTime, setLastGenTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [canGenerate, setCanGenerate] = useState(true);

  // Fetch last generation time from profiles + local backup
  useEffect(() => {
    const fetchLimit = async () => {
      // 1. Try local storage first for immediate feedback
      const local = localStorage.getItem(LIMIT_STORAGE_KEY);
      if (local) {
        setLastGenTime(parseInt(local, 10));
      }

      // 2. Try DB for account-wide sync
      if (!user?.id) return;
      try {
        const { data, error } = await (supabase as any)
          .from('profiles')
          .select('last_image_gen_at')
          .eq('id', user.id) // Corrected from user_id to id
          .maybeSingle();

        if (error) {
          console.error('Limit fetch error:', error);
        }

        if ((data as any)?.last_image_gen_at) {
          const dbTime = new Date((data as any).last_image_gen_at).getTime();
          // Use the most recent of the two
          setLastGenTime(prev => (!prev || dbTime > prev) ? dbTime : prev);
        }
      } catch (err) {
        console.error('Failed to sync image limit:', err);
      }
    };
    fetchLimit();
  }, [user?.id]);

  // Handle countdown timer
  useEffect(() => {
    if (!lastGenTime) {
      setCanGenerate(true);
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - lastGenTime;

      if (diff < LIMIT_MS) {
        setCanGenerate(false);
        const remaining = LIMIT_MS - diff;
        const h = Math.floor(remaining / (1000 * 60 * 60));
        const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((remaining % (1000 * 60)) / 1000);
        setTimeLeft(`${h}s ${m}m ${s}s`);
      } else {
        setCanGenerate(true);
        setTimeLeft(null);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastGenTime]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.prompt === 'string') setPrompt(parsed.prompt);
      if (typeof parsed?.resultImage === 'string' || parsed?.resultImage === null) setResultImage(parsed.resultImage ?? null);
      if (typeof parsed?.errorDetail === 'string' || parsed?.errorDetail === null) setErrorDetail(parsed.errorDetail ?? null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
         STORAGE_KEY,
        JSON.stringify({ prompt, resultImage, errorDetail })
      );
    } catch {
      // ignore
    }
  }, [prompt, resultImage, errorDetail]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setResultImage(null);
    setErrorDetail(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(IMAGE_GEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (resp.status === 429) { 
        toast.error("Limit tugadi! Pro rejaga o'ting"); 
        window.dispatchEvent(new Event('show-plan-overlay'));
        return; 
      }
      if (resp.status === 402) { toast.error("Kredit yetarli emas"); return; }

      const data = await resp.json();

      if (!resp.ok) {
        console.error('Image gen error:', data);
        const detail = data.snapshot || data.details || data.error || 'Unknown error';
        const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
        
        if (detailStr.toLowerCase().includes('safety system') || detailStr.toLowerCase().includes('help.openai.com')) {
          setErrorDetail("Kiritilgan matn xavfsizlik qoidalariga to'g'ri kelmadi. Bunday turdagi rasm yaratib bo'lmaydi, iltimos boshqa so'zlardan foydalanib ko'ring.");
          toast.error("Xavfsizlik cheklovi: boshqa so'zlardan foydalaning");
        } else {
          setErrorDetail(detailStr.slice(0, 200));
          toast.error(data.error || 'Rasm yaratishda xatolik');
        }
        return;
      }

      const src = normalizeImageSrc(data.content);
      if (src) {
        setResultImage(src);
        // Update last_image_gen_at in profiles upon success
        if (user?.id) {
          const now = Date.now();
          const nowIso = new Date(now).toISOString();
          
          // Local backup
          localStorage.setItem(LIMIT_STORAGE_KEY, now.toString());
          setLastGenTime(now);
          setCanGenerate(false);

          // DB update
          const { error } = await (supabase as any)
            .from('profiles')
            .update({ last_image_gen_at: nowIso })
            .eq('id', user.id); // Corrected from user_id to id
          
          if (error) {
            console.error('Failed to update image limit in DB:', error);
            // We don't toast error here because local limit is already set
          }
        }
      } else {
        console.error('Could not parse image from response:', data);
        toast.error("Rasm yaratilmadi, qayta urinib ko'ring");
      }
    } catch (error) {
      console.error(error);
      toast.error("Rasm yaratishda xatolik yuz berdi");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = 'ai-generated.png';
    link.click();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-w-lg mx-auto w-full min-h-0 h-full">
      {/* Preview Area */}
      <div className="w-full aspect-square mb-6 relative group">
        <AnimatePresence mode="wait">
          {resultImage ? (
            <motion.div
              key="image"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full h-full relative"
            >
              <img src={resultImage} alt="Generated Art" className="w-full h-full object-cover rounded-[32px] shadow-2xl border border-white/10" />
              <button onClick={handleDownload}
                className="absolute bottom-4 right-4 w-12 h-12 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100 shadow-xl border border-white/10">
                <Download className="h-5 w-5" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full h-full rounded-[32px] border border-dashed border-white/10 bg-white/[0.02] backdrop-blur-sm flex flex-col items-center justify-center text-muted-foreground gap-4 overflow-hidden relative"
            >
              <div className={`w-20 h-20 rounded-full bg-white/[0.05] backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl relative z-10 ${isGenerating ? 'animate-pulse' : ''}`}>
                {isGenerating ? <Loader2 className="h-8 w-8 animate-spin text-purple-400" /> : <Wand2 className="h-8 w-8 text-purple-400/50" />}
              </div>
              <div className="text-center px-6 relative z-10">
                <p className="text-sm font-bold text-foreground/80 mb-1">
                  {isGenerating ? 'Mo\'jiza yuz bermoqda...' : 'Art maydoni tayyor'}
                </p>
                <p className="text-[11px] opacity-40 max-w-[200px] leading-relaxed">
                  Tasavvuringizni matn ko'rinishida yozing va men uni rasmga aylantiraman
                </p>
              </div>
              
              {isGenerating && (
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 10, ease: "linear" }}
                  className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50"
                />
              )}

              {errorDetail && (
                <p className="text-[10px] text-destructive/70 px-4 text-center mt-4 max-w-[250px] break-all bg-destructive/5 py-2 rounded-xl">{errorDetail}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="w-full bg-white/[0.03] backdrop-blur-3xl border border-white/5 rounded-[32px] p-3 shadow-2xl flex flex-col gap-3 relative overflow-hidden">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="Rasmni tasvirlab bering..."
          rows={2}
          disabled={!canGenerate || isGenerating}
          className="w-full bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground/40 px-3 py-1 resize-none text-sm font-medium leading-relaxed disabled:opacity-50"
        />
        
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-white/[0.05] px-2.5 py-1 rounded-lg text-muted-foreground border border-white/5 font-bold tracking-widest">1:1</span>
            {!canGenerate && timeLeft && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
                <Clock className="h-3 w-3" />
                <span className="text-[10px] font-bold">{timeLeft}</span>
              </div>
            )}
          </div>

          <button onClick={handleGenerate} disabled={!prompt.trim() || isGenerating || !canGenerate}
            className={cn(
              "px-6 py-2.5 rounded-2xl font-bold text-sm transition-all duration-300 relative overflow-hidden",
              prompt.trim() && !isGenerating && canGenerate
                ? 'bg-foreground text-background hover:scale-105 active:scale-95 shadow-xl'
                : 'bg-white/[0.05] text-muted-foreground/40 cursor-not-allowed'
            )}>
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Kuting...</span>
              </div>
            ) : !canGenerate ? (
              'Limit'
            ) : (
              'Yaratish'
            )}
          </button>
        </div>

        {!canGenerate && (
          <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px] pointer-events-none flex items-center justify-center">
            <div className="bg-background/80 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2 shadow-2xl">
              <p className="text-[10px] font-bold text-foreground opacity-80 uppercase tracking-widest">Limit: 15 soatda 1 ta rasm</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIImageView;
