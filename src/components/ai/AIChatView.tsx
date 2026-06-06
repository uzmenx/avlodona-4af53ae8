import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, Cpu, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Icon } from '@iconify/react';

interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  attachments?: {type: string;data: string;name: string;}[];
}

const GEMINI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

interface AIChatViewProps {
  messages: AIChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AIChatMessage[]>>;
}

const AIChatView = ({ messages, setMessages }: AIChatViewProps) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<{type: string;mimeType: string;data: string;name: string;}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      try {
        const base64 = await convertFileToBase64(file);
        setAttachments((prev) => [...prev, {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          mimeType: file.type,
          data: base64,
          name: file.name
        }]);
      } catch (err) {
        console.error("File read error:", err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() && attachments.length === 0 || isLoading) return;

    const hasAttachments = attachments.length > 0;
    const userMsg: AIChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim() || (hasAttachments ? '📎 Fayl yuborildi' : ''),
      timestamp: new Date(),
      attachments: hasAttachments ? attachments.map((a) => ({ type: a.type, data: a.data, name: a.name })) : undefined
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    const currentAttachments = [...attachments];
    setAttachments([]);
    setIsLoading(true);

    let assistantContent = '';
    const usedModel = 'avlodona gemini 1.5 flash';

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
        }
        return [...prev, { id: crypto.randomUUID(), role: 'assistant', content: assistantContent, timestamp: new Date(), model: usedModel }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const allMessages = [...messages, userMsg].map((m) => {
        if (m.attachments && m.attachments.length > 0) {
          const contentParts: any[] = [
            { type: 'text', text: m.content || "Faylni tahlil qiling." }
          ];
          m.attachments.forEach(att => {
            if (att.type === 'image') {
              contentParts.push({
                type: 'image_url',
                image_url: { url: `data:${(att as any).mimeType || 'image/png'};base64,${att.data}` }
              });
            }
          });
          return { role: m.role, content: contentParts };
        }
        return { role: m.role, content: m.content };
      });

      const resp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ messages: allMessages })
      });

      if (resp.status === 429) {
        toast.error("Limit qoldi! Pro rejaga o'ting");
        window.dispatchEvent(new Event('show-plan-overlay'));
        setIsLoading(false);
        return;
      }
      if (resp.status === 402) {toast.error("Kredit yetarli emas");setIsLoading(false);return;}
      if (!resp.ok || !resp.body) {
        throw new Error('Stream boshlanmadi yoki xatolik yuz berdi');
      }

      await processStream(resp.body, (chunk) => upsertAssistant(chunk));
    } catch (e) {
      console.error('AI chat error:', e);
      toast.error('AI javob berishda xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, attachments, setMessages]);

  const quickActions = [
  { label: '👋 Salom', message: 'Salom! Qanday yordam bera olasan?' },
  { label: '📝 Yozish', message: "Menga chiroyli post uchun matn yozib ber" },
  { label: '💡 G\'oya', message: "Ijodiy kontentlar uchun g'oyalar ber" },
  { label: '🎯 Maslahat', message: 'Bugun qanday kun o\'tkazishim kerak?' }];


  return (
    <div className="flex-1 flex flex-col min-h-0 w-full relative h-full max-h-[100dvh]">
      <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf,text/plain" />

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-2" style={{ overscrollBehavior: 'contain' }}>
        {messages.length === 0 ?
        <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 p-[2px] mb-5 shadow-2xl shadow-purple-500/40">
              <img
              src="/ai-avatar.png"
              alt="AI"
              className="h-full w-full rounded-full object-cover bg-background"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/favicon.ico';
              }} />
            
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">AI Do'stim 🤖</h2>
            <p className="text-muted-foreground mb-5 max-w-xs text-sm">
              Salom! Men sizning sun'iy intellekt do'stingizman. Har qanday savolingizga javob beraman!
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {quickActions.map((action, i) =>
            <button key={i} onClick={() => sendMessage(action.message)}
            className="px-3 py-2.5 rounded-2xl text-sm font-medium bg-card/50 backdrop-blur-sm border border-border/50 text-foreground hover:bg-muted/80 transition-all active:scale-95">
                  {action.label}
                </button>
            )}
            </div>
          </div> :

        <div className="space-y-3 pt-2 pb-20">
            {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
                  <div className={cn(
                  'max-w-[85%] rounded-[22px] px-4 py-3 shadow-lg transition-all',
                  isUser ?
                  'bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-tr-sm' :
                  'bg-card/60 backdrop-blur-xl border border-border/50 rounded-tl-sm text-foreground'
                )}>
                    {!isUser && msg.model &&
                  <div className="flex items-center gap-1.5 mb-1.5 opacity-50">
                        {msg.model.includes('Groq') ? <Cpu className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
                        <span className="text-[10px] uppercase font-bold tracking-wider">{msg.model}</span>
                      </div>
                  }
                    {msg.attachments && msg.attachments.length > 0 &&
                  <div className="flex flex-wrap gap-2 mb-2">
                        {msg.attachments.map((att, idx) =>
                    att.type === 'image' ?
                    <img key={idx} src={`data:image/png;base64,${att.data}`} alt="attachment" className="max-h-40 rounded-lg object-cover border border-white/20" /> :

                    <div key={idx} className="flex items-center gap-2 p-2 bg-black/20 rounded-lg text-xs">
                              📄 {att.name}
                            </div>

                    )}
                      </div>
                  }
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    <p className={cn('text-[10px] mt-1', isUser ? 'text-white/50' : 'text-muted-foreground')}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>);

          })}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' &&
          <div className="flex items-start">
                <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
          }
          </div>
        }
      </div>

    {/* Premium Floating Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-transparent border-none p-2 pb-[calc(10px+env(safe-area-inset-bottom,0px))] pointer-events-none">
        {attachments.length > 0 && (
          <div className="flex gap-2 px-4 py-2 bg-background/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-border/40 rounded-2xl mx-1 shadow-lg pointer-events-auto mb-2 overflow-x-auto">
            {attachments.map((att, idx) => (
              <div key={idx} className="relative shrink-0">
                {att.type === 'image' ? (
                  <img src={`data:${att.mimeType};base64,${att.data}`} className="h-12 w-12 rounded-xl object-cover border border-border/50" alt="preview" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center border border-border/50 text-xs">📄</div>
                )}
                <button onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive rounded-full text-white text-[8px] flex items-center justify-center">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 bg-background/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-border/40 rounded-[28px] px-2 py-1.5 shadow-lg shadow-black/5 pointer-events-auto mx-1">
          <input 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault();sendMessage(input);}}}
            placeholder={attachments.length > 0 ? "Fayl haqida so'rang..." : "Xabar yozing..."}
            className="flex-1 bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground px-3.5 h-9 text-sm"
            disabled={isLoading} 
          />
          
          <button 
            onClick={() => sendMessage(input)}
            disabled={!input.trim() && attachments.length === 0 || isLoading}
            className={cn(
              'w-[2.25rem] h-[2.25rem] rounded-full flex items-center justify-center transition-all shadow-md shrink-0 active:scale-90',
              input.trim() || attachments.length > 0 ?
              'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:opacity-90 hover:scale-105' :
              'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
            )}
          >
            <Icon icon="heroicons:paper-airplane-16-solid" className="h-[1.35rem] w-[1.35rem]" />
          </button>
        </div>
      </div>
    </div>);

};

async function processStream(body: ReadableStream, onDelta: (chunk: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') {streamDone = true;break;}
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + '\n' + textBuffer;
        break;
      }
    }
  }
}

export default AIChatView;