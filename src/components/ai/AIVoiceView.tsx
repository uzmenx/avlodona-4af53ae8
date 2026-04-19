import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Loader2, Square, Keyboard, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const GEMINI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  attachments?: { type: string; data: string; name: string }[];
}

const VOICE_SYSTEM_PROMPT = `Siz foydalanuvchi bilan ovozli suhbat qilayotgan AI yordamchisiz.
Javoblaringiz:
- juda qisqa va ravon bo'lsin (1-4 gap)
- keraksiz emoji ishlatmang
- agar foydalanuvchi biror narsa tushunarsiz aytsa, aniqlashtiruvchi bitta savol bering
- foydalanuvchi o'zbekcha gapirsa o'zbekcha, ruscha bo'lsa ruscha javob bering.`;

type AIState = 'idle' | 'listening' | 'processing' | 'speaking';

interface AIVoiceViewProps {
  messages: AIChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AIChatMessage[]>>;
}

const AIVoiceView = ({ messages, setMessages }: AIVoiceViewProps) => {
  const [appState, setAppState] = useState<AIState>('idle');
  const [volume, setVolume] = useState(0);
  const [textInput, setTextInput] = useState('');

  const messagesRef = useRef<AIChatMessage[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const appStateRef = useRef<AIState>('idle');

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { appStateRef.current = appState; }, [appState]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  const stopEverything = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    window.speechSynthesis?.cancel();
    setAppState('idle');
    setVolume(0);
  }, []);

  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      setAppState('idle');
      return;
    }
    setAppState('speaking');
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'uz-UZ';

    utterance.onend = () => setAppState('idle');
    utterance.onerror = () => setAppState('idle');

    window.speechSynthesis.speak(utterance);

    const fakeVolumeAnim = () => {
      if (window.speechSynthesis.speaking) {
        setVolume(Math.random() * 40 + 20);
        animFrameRef.current = requestAnimationFrame(fakeVolumeAnim);
      } else {
        setVolume(0);
      }
    };
    fakeVolumeAnim();
  }, []);

  const sendQuery = useCallback(async (text: string, audioData?: { base64: string, mimeType: string }) => {
    if (!text.trim() && !audioData) return;
    if (appStateRef.current === 'processing') return;

    stopEverything();
    setAppState('processing');

    const userMsg: AIChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim() || (audioData ? '🎤 Ovozli xabar...' : ''),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMsg]);

    try {
      const allMsgs = [...messagesRef.current, userMsg];
      const apiMessages = [
        { role: 'system', content: VOICE_SYSTEM_PROMPT },
        ...allMsgs.map(h => ({ role: h.role, content: h.content }))
      ];

       
      const body: any = { messages: apiMessages };
      if (audioData) {
        body.audio = audioData.base64;
        body.mimeType = audioData.mimeType;
      }

      const resp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (resp.status === 429) {
        toast.error("Limit tugadi! Pro rejaga o'ting");
        window.dispatchEvent(new Event('show-plan-overlay'));
        setAppState('idle');
        return;
      }
      
      if (!resp.ok) throw new Error('API xatosi');

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let result = '';
      let buffer = '';

      const assistantMsgId = crypto.randomUUID();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              result += c;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantMsgId) {
                  return prev.map(m => m.id === assistantMsgId ? { ...m, content: result } : m);
                }
                return [...prev, { 
                  id: assistantMsgId, 
                  role: 'assistant', 
                  content: result, 
                  timestamp: new Date(),
                  model: 'Gemini 1.5 Flash'
                }];
              });
            }
          } catch (err) { console.error('Parse error', err); }
        }
      }

      if (result) {
        speakText(result);
      } else {
        setAppState('idle');
      }
    } catch (e) {
      toast.error('Javob olishda xatolik yuz berdi');
      setAppState('idle');
    }
  }, [stopEverything, speakText, setMessages]);

  const convertWebmToMp3 = async (webmBlob: Blob): Promise<{ base64: string, mimeType: string }> => {
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm',
      });

      const inputName = 'input.webm';
      const outputName = 'output.mp3';
      
      await ffmpeg.writeFile(inputName, await fetchFile(webmBlob));
      
      await ffmpeg.exec(['-i', inputName, '-vn', '-ab', '128k', '-ar', '44100', '-y', outputName]);

      const data = await ffmpeg.readFile(outputName);
      const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
      
      let binary = '';
      const len = uint8.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);

      ffmpeg.terminate();
      return { base64, mimeType: 'audio/mp3' };
    } catch (err) {
      console.error('FFmpeg error:', err);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(webmBlob);
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ base64, mimeType: 'audio/webm' });
        };
      });
    }
  };

  const startListening = async () => {
    stopEverything();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setAppState('listening');

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (webmBlob.size < 1000) {
          setAppState('idle');
          return;
        }
        
        setAppState('processing');
        const audioData = await convertWebmToMp3(webmBlob);
        sendQuery('', audioData);
      };

      mediaRecorder.start();

      const updateVolume = () => {
        if (!analyserRef.current || appStateRef.current !== 'listening') return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVolume(avg);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (err) {
      toast.error("Mikrofonga ruxsat berilmadi");
      setAppState('idle');
    }
  };

  useEffect(() => { return () => stopEverything(); }, [stopEverything]);

  const isListening = appState === 'listening';
  const isSpeaking = appState === 'speaking';
  const isProcessing = appState === 'processing';

  const dynamicScale = 1 + (volume / 255) * 0.4;

  return (
    <div className="h-full flex flex-col items-center justify-between pb-6 px-4">

      {/* 3D Modern AI Orb Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center w-full relative gap-8">

        <div
          onClick={appState === 'idle' ? startListening : stopEverything}
          className="relative w-48 h-48 flex items-center justify-center cursor-pointer group"
        >
          {/* Outer glow */}
          <div
            className={cn(
              "absolute inset-0 rounded-full blur-[40px] transition-all duration-300",
              isListening ? "bg-gradient-to-r from-blue-500 via-purple-500 to-red-500 opacity-60" :
              isSpeaking ? "bg-gradient-to-r from-emerald-400 to-cyan-500 opacity-60 animate-pulse" :
              isProcessing ? "bg-blue-500/30 opacity-40 animate-spin" :
              "opacity-20 group-hover:opacity-30"
            )}
            style={{
              transform: `scale(${dynamicScale})`,
              ...( !isListening && !isSpeaking && !isProcessing ? { background: 'hsl(var(--muted))' } : {})
            }}
          />

          {/* Main conic ring */}
          <div
            className={cn(
              "absolute inset-0 rounded-full transition-transform duration-100 ease-out",
              (isListening || isSpeaking || isProcessing) && "animate-[spin_4s_linear_infinite]"
            )}
            style={{
              transform: `scale(${dynamicScale})`,
              background: (isListening || isSpeaking || isProcessing)
                ? 'conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #4cd964, #5ac8fa, #007aff, #5856d6, #ff2d55, #ff3b30)'
                : 'hsl(var(--muted))',
              padding: '6px'
            }}
          >
            {/* Dark center */}
            <div className="w-full h-full bg-background rounded-full flex items-center justify-center relative shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)]">

              {/* AI "Eyes" */}
              <div className="flex gap-3 z-10">
                {isListening ? (
                  <Mic className="w-8 h-8 text-foreground animate-pulse" />
                ) : (
                  <>
                    <div className={cn(
                      "w-2.5 bg-foreground rounded-full transition-all duration-300",
                      isSpeaking ? "h-8 animate-pulse shadow-[0_0_15px_hsl(var(--foreground))]" :
                      isProcessing ? "h-3 animate-bounce" :
                      "h-3 opacity-50"
                    )} />
                    <div className={cn(
                      "w-2.5 bg-foreground rounded-full transition-all duration-300 delay-75",
                      isSpeaking ? "h-8 animate-pulse shadow-[0_0_15px_hsl(var(--foreground))]" :
                      isProcessing ? "h-3 animate-bounce" :
                      "h-3 opacity-50"
                    )} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="h-6 text-center">
          {isListening && <p className="text-sm font-medium tracking-widest text-foreground/70 animate-pulse uppercase">Tinglamoqda... (To'xtatish uchun bosing)</p>}
          {isProcessing && <p className="text-sm font-medium tracking-widest text-primary animate-pulse flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> O'YLANMOQDA</p>}
          {isSpeaking && <p className="text-sm font-medium tracking-widest text-emerald-400 animate-pulse">GAPIRYAPMAN...</p>}
          {appState === 'idle' && <p className="text-xs text-muted-foreground tracking-wider underline underline-offset-4">GAPIRISH UCHUN BOSING</p>}
        </div>

        {appState !== 'idle' && (
          <button
            onClick={stopEverything}
            className="px-6 py-2 rounded-full border border-border bg-muted/50 hover:bg-muted transition-colors text-xs font-semibold flex items-center gap-2 text-foreground"
          >
            <Square className="h-3 w-3 fill-current" /> To'xtatish
          </button>
        )}
      </div>

      {/* Chat History */}
      <div className="w-full max-w-md bg-card/50 border border-border/50 rounded-3xl p-4 h-[160px] flex flex-col relative overflow-hidden mb-4 shadow-xl">
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent z-10" />
        <div className="flex-1 overflow-y-auto space-y-3 py-2 scrollbar-hide">
          {messages.length > 0 ? (
            messages.map((item, i) => (
              <div key={i} className={cn('text-sm w-full flex', item.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  "px-4 py-2 rounded-2xl max-w-[85%] leading-relaxed",
                  item.role === 'user' ? "bg-primary/20 text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {item.content}
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-xs text-center px-4">
              Ovozli vizualizatorni bosing yoki xabar yozing.
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent z-10" />
      </div>

      {/* Text input */}
      <div className="w-full max-w-md relative flex items-center">
        <div className="absolute left-3 text-muted-foreground"><Keyboard className="w-5 h-5" /></div>
        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { sendQuery(textInput); setTextInput(''); } }}
          placeholder="Xabar yozish..."
          className="w-full bg-muted/50 border border-border focus:border-ring focus:bg-muted rounded-full h-12 pl-11 pr-12 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
          disabled={appState === 'processing'}
        />
        <button
          onClick={() => { sendQuery(textInput); setTextInput(''); }}
          disabled={!textInput.trim() || appState === 'processing'}
          className={cn(
            'absolute right-1.5 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300',
            textInput.trim() ? 'bg-primary text-primary-foreground shadow-lg scale-100' : 'bg-transparent text-muted-foreground scale-90'
          )}>
          <Send className="h-4 w-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
};

export default AIVoiceView;
