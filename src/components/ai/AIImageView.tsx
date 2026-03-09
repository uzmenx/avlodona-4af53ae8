import { useEffect, useState } from 'react';
import { Wand2, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const IMAGE_GEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-image-gen`;

const STORAGE_KEY = 'ai_image_history_v1';

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
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

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
      const resp = await fetch(IMAGE_GEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (resp.status === 429) { toast.error("So'rovlar limiti oshdi"); return; }
      if (resp.status === 402) { toast.error("Kredit yetarli emas"); return; }

      const data = await resp.json();

      if (!resp.ok) {
        console.error('Image gen error:', data);
        const detail = data.snapshot || data.details || data.error || 'Unknown error';
        setErrorDetail(typeof detail === 'string' ? detail.slice(0, 200) : JSON.stringify(detail).slice(0, 200));
        toast.error(data.error || 'Rasm yaratishda xatolik');
        return;
      }

      const src = normalizeImageSrc(data.content);
      if (src) {
        setResultImage(src);
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
    <div className="h-full flex flex-col items-center justify-center px-4 pb-6 max-w-lg mx-auto w-full">
      {/* Preview Area */}
      <div className="w-full aspect-square mb-6 relative group">
        {resultImage ? (
          <>
            <img src={resultImage} alt="Generated Art" className="w-full h-full object-cover rounded-[28px] shadow-2xl border border-border/30" />
            <button onClick={handleDownload}
              className="absolute bottom-3 right-3 w-10 h-10 bg-background/60 backdrop-blur-md rounded-full flex items-center justify-center text-foreground hover:bg-background/80 transition-all opacity-0 group-hover:opacity-100">
              <Download className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="w-full h-full rounded-[28px] border-2 border-dashed border-border/30 bg-card/20 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div className={`w-16 h-16 rounded-full bg-card/50 backdrop-blur-sm border border-border/30 flex items-center justify-center ${isGenerating ? 'animate-pulse' : ''}`}>
              {isGenerating ? <Loader2 className="h-7 w-7 animate-spin" /> : <Wand2 className="h-7 w-7" />}
            </div>
            <p className="text-xs font-medium opacity-60">
              {isGenerating ? 'Rasm yaratilmoqda...' : 'Art maydoni'}
            </p>
            {errorDetail && (
              <p className="text-[10px] text-destructive/70 px-4 text-center max-w-[250px] break-all">{errorDetail}</p>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="w-full bg-card/50 backdrop-blur-2xl border border-border/50 rounded-[28px] p-2 shadow-lg flex flex-col gap-2">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="Rasmni tasvirlab bering..."
          rows={2}
          className="w-full bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground px-4 py-2 resize-none text-sm"
        />
        <div className="flex justify-between items-center px-2 pb-1">
          <span className="text-[10px] bg-muted/50 px-2 py-1 rounded-full text-muted-foreground border border-border/30">1:1</span>
          <button onClick={handleGenerate} disabled={!prompt.trim() || isGenerating}
            className={`px-5 py-2 rounded-full font-semibold text-sm transition-all ${
              prompt.trim() && !isGenerating
                ? 'bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(263,70%,50%)] text-white hover:scale-105 shadow-lg shadow-primary/30'
                : 'bg-muted text-muted-foreground'
            }`}>
            Yaratish
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIImageView;
