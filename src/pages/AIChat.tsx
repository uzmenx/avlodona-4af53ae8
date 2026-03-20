import { useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Wand2, Mic, Sparkles, Menu, SquarePen, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addSwipeGestures } from '@/utils/scrollBehavior';
import AIChatView from '@/components/ai/AIChatView';
import AIImageView from '@/components/ai/AIImageView';
import AIVoiceView from '@/components/ai/AIVoiceView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type AITab = 'chat' | 'image' | 'voice';

interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  attachments?: {type: string; data: string; name: string;}[];
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: AIChatMessage[];
}

const DEFAULT_SESSION_STORAGE_KEY = 'avlodona:ai_default_session_id';

const newId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const AIChat = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AITab>('chat');
  const swipeTabRef = useRef<HTMLDivElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [dbLoaded, setDbLoaded] = useState(false);
  const saveTimerRef = useRef<number>(0);
  const savedMsgIdsRef = useRef<Set<string>>(new Set());

  // Load from DB on mount
  useEffect(() => {
    const loadFromDB = async () => {
      if (!user?.id) return;
      try {
        const { data: conversations } = await (supabase as any)
          .from('ai_conversations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!conversations || conversations.length === 0) {
          setDbLoaded(true);
          return;
        }

        const convIds = (conversations as any[]).map((c: any) => c.id);
        const { data: allMessages } = await (supabase as any)
          .from('ai_messages')
          .select('*')
          .in('conversation_id', convIds)
          .order('created_at');

        const msgsByConv = new Map<string, any[]>();
        ((allMessages || []) as any[]).forEach((m: any) => {
          if (!m.conversation_id) return;
          const list = msgsByConv.get(m.conversation_id) || [];
          list.push(m);
          msgsByConv.set(m.conversation_id, list);
        });

        const loadedSessions: ChatSession[] = (conversations as any[]).map((conv: any) => {
          const msgs = msgsByConv.get(conv.id) || [];
          msgs.forEach((m: any) => savedMsgIdsRef.current.add(m.id));
          return {
            id: conv.id,
            title: conv.title || 'New Chat',
            updatedAt: new Date(conv.created_at || Date.now()).getTime(),
            messages: msgs.map((m: any) => ({
              id: m.id,
              role: (m.role as 'user' | 'assistant') || 'user',
              content: m.content || '',
              timestamp: new Date(m.created_at || Date.now()),
              attachments: m.media_url ? (() => { try { return JSON.parse(m.media_url); } catch { return undefined; } })() : undefined,
            })),
          };
        });

        if (loadedSessions.length > 0) {
          setSessions(loadedSessions);
          setActiveSessionId(loadedSessions[0].id);
        }
      } catch (e) {
        console.error('Failed to load AI chat from DB:', e);
      } finally {
        setDbLoaded(true);
      }
    };

    loadFromDB();
  }, [user?.id]);

  // Ensure we have exactly one stable default session when DB is empty
  useEffect(() => {
    if (!dbLoaded || !user?.id) return;
    if (sessions.length > 0) return;

    let id = '';
    try {
      id = localStorage.getItem(DEFAULT_SESSION_STORAGE_KEY) || '';
    } catch (idErr) {
      console.error('LocalStorage access error:', idErr);
    }

    if (!id) {
      id = newId();
      try {
        localStorage.setItem(DEFAULT_SESSION_STORAGE_KEY, id);
      } catch (e) {
        console.error('Failed to save to local storage', e);
      }
    }

    const s: ChatSession = { id, title: 'New Chat', updatedAt: Date.now(), messages: [] };
    setSessions([s]);
    setActiveSessionId(id);
  }, [dbLoaded, user?.id, sessions.length]);

  // Debounced save to DB
  const saveToDb = useCallback(async (sessionsToSave: ChatSession[]) => {
    if (!user?.id) return;
    try {
      for (const session of sessionsToSave) {
        // Skip empty sessions - don't save to DB
        if (session.messages.length === 0) continue;

        // Determine title
        const title = (session.title && session.title !== 'New Chat')
          ? session.title
          : (session.messages.find(m => m.role === 'user' && m.content?.trim())?.content?.trim().slice(0, 32) || 'New Chat');

        // Upsert conversation
        await (supabase as any).from('ai_conversations').upsert({
          id: session.id,
          user_id: user.id,
          title,
        }, { onConflict: 'id' });

        // Find new messages
        const newMsgs = session.messages.filter(m => !savedMsgIdsRef.current.has(m.id));
        if (newMsgs.length > 0) {
          const { error } = await (supabase as any).from('ai_messages').upsert(
            newMsgs.map(m => ({
              id: m.id,
              conversation_id: session.id,
              role: m.role,
              content: m.content,
              media_url: m.attachments ? JSON.stringify(m.attachments) : null,
            })),
            { onConflict: 'id' }
          );
          if (error) {
            console.error('Supabase upsert error:', error);
            toast.error('Xabarlarni saqlashda xatolik');
          } else {
            newMsgs.forEach(m => savedMsgIdsRef.current.add(m.id));
          }
        }
      }
    } catch (e) {
      console.error('Failed to save AI chat to DB:', e);
    }
  }, [user?.id]);

  // Delete empty conversations from DB on cleanup
  useEffect(() => {
    if (!dbLoaded || !user?.id) return;
    // Remove DB conversations that have no messages
    const cleanupEmpty = async () => {
      try {
        const emptyConvIds = sessions.filter(s => s.messages.length === 0).map(s => s.id);
        if (emptyConvIds.length > 0) {
          await (supabase as any).from('ai_conversations').delete().in('id', emptyConvIds);
        }
      } catch (cleanupErr) {
        console.error('Cleanup empty conversations error:', cleanupErr);
      }
    };
    cleanupEmpty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbLoaded, user?.id]); // Only run once after load

  useEffect(() => {
    if (!dbLoaded || !user?.id) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveToDb(sessions);
    }, 2000);
    return () => clearTimeout(saveTimerRef.current);
  }, [sessions, dbLoaded, user?.id, saveToDb]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const ensureSession = () => {
    if (activeSession) return activeSession;
    // Fallback: if something cleared activeSessionId, reuse the first session if present
    const first = sessions[0];
    if (first) {
      setActiveSessionId(first.id);
      return first;
    }
    const s: ChatSession = { id: newId(), title: 'New Chat', updatedAt: Date.now(), messages: [] };
    setSessions([s]);
    setActiveSessionId(s.id);
    return s;
  };

  const createNewChat = () => {
    const s: ChatSession = { id: newId(), title: 'New Chat', updatedAt: Date.now(), messages: [] };
    setSessions((prev) => [s, ...prev]);
    setActiveSessionId(s.id);
    setActiveTab('chat');
    setSidebarOpen(false);
  };

  const setMessagesForActive = (updater: React.SetStateAction<AIChatMessage[]>) => {
    const s = ensureSession();
    setSessions((prev) =>
      prev.map((sess) => {
        if (sess.id !== s.id) return sess;
        const nextMessages = typeof updater === 'function' ? (updater as (prev: AIChatMessage[]) => AIChatMessage[])(sess.messages) : updater;

        let title = sess.title;
        if (!title || title === 'New Chat') {
          const firstUser = nextMessages.find((m: AIChatMessage) => m.role === 'user' && m.content?.trim());
          if (firstUser?.content) title = firstUser.content.trim().slice(0, 32);
        }

        return {
          ...sess,
          title,
          messages: nextMessages,
          updatedAt: Date.now()
        };
      })
    );
  };

  const tabs: {id: AITab; label: string; icon: ReactNode;}[] = [
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: 'image', label: 'Studio', icon: <Wand2 className="h-3.5 w-3.5" /> },
    { id: 'voice', label: 'Voice', icon: <Mic className="h-3.5 w-3.5" /> },
  ];

  useEffect(() => {
    const el = swipeTabRef.current;
    if (!el) return;
    const order: AITab[] = ['chat', 'image', 'voice'];
    const idx = order.indexOf(activeTab);
    if (idx < 0) return;

    const cleanup = addSwipeGestures(
      el,
      () => {
        const next = order[idx + 1];
        if (next) setActiveTab(next);
      },
      () => {
        const prev = order[idx - 1];
        if (prev) setActiveTab(prev);
      }
    );

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-background/30 backdrop-blur-2xl">
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button
            type="button"
            onClick={() => navigate('/messages')}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.03 }}
            className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center shadow-[0_10px_30px_-20px_rgba(0,0,0,0.7)]">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 p-[1.5px] shadow-lg shadow-purple-500/30">
              <img
                src="/ai-avatar.png"
                alt="AI"
                className="h-full w-full rounded-full object-cover bg-background"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/favicon.ico';
                }} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-foreground text-sm">AI Do'stim</h1>
            <div className="flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-purple-400" />
              <span className="text-[10px] text-purple-400">Doim online</span>
            </div>
          </div>
          <motion.button
            type="button"
            onClick={createNewChat}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.03 }}
            className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500/30 via-purple-500/25 to-pink-500/30 hover:from-indigo-500/40 hover:to-pink-500/40 border border-white/10 flex items-center justify-center shadow-[0_16px_40px_-24px_rgba(168,85,247,0.9)]">
            <SquarePen className="h-5 w-5" />
          </motion.button>
        </div>

        {/* Tab Bar */}
        <div className="flex justify-center px-4 pb-2">
          <div className="max-w-[360px] w-full flex items-center gap-2">
            <motion.button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.03 }}
              className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center shadow-[0_10px_30px_-20px_rgba(0,0,0,0.7)]"
              aria-label="History"
              title="History">
              <Menu className="h-5 w-5" />
            </motion.button>

            <div className="flex-1 bg-white/5 backdrop-blur-2xl p-1 rounded-full flex items-center border border-white/10 justify-between shadow-[0_18px_40px_-28px_rgba(0,0,0,0.7)]">
              {tabs.map((tab) =>
                <motion.button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileTap={{ scale: 0.97 }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all duration-300',
                    activeTab === tab.id ?
                    'bg-foreground text-background shadow-md' :
                    'text-muted-foreground hover:text-foreground opacity-80 hover:opacity-100'
                  )}>
                  <motion.span
                    animate={activeTab === tab.id ? { rotate: [0, -8, 0], scale: [1, 1.05, 1] } : { rotate: 0, scale: 1 }}
                    transition={{ duration: 0.35 }}
                    className="inline-flex">
                    {tab.icon}
                  </motion.span>
                  {tab.label}
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex relative z-0 overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 z-50 w-[290px] max-w-[84vw] bg-background/70 backdrop-blur-2xl border-r border-white/10 transition-transform duration-300 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_30px_90px_-60px_rgba(0,0,0,0.9)]',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}>
          <div className="p-4 flex items-center justify-between">
            <div className="font-bold text-foreground">Avlodona</div>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="px-4">
            <button
              onClick={createNewChat}
              className="w-full flex items-center gap-2 px-3 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors font-semibold">
              <span className="inline-flex w-6 h-6 rounded-full bg-background/40 items-center justify-center">+</span>
              New Chat
            </button>
          </div>
          <div className="px-4 pt-5 text-[11px] font-bold tracking-wider text-muted-foreground">RECENT</div>
          <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 210px)' }}>
            {sessions.
              slice().
              sort((a, b) => b.updatedAt - a.updatedAt).
              map((s) => {
                const isActive = s.id === activeSessionId;
                const lastAssistant = [...s.messages].reverse().find((m) => m.role === 'assistant');
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSessionId(s.id);
                      setActiveTab('chat');
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      'w-full text-left p-3 rounded-2xl border transition-colors',
                      isActive ? 'bg-card/60 border-border/60' : 'bg-card/20 border-border/30 hover:bg-card/40'
                    )}>
                    <div className="font-semibold text-foreground truncate">{s.title || 'New Chat'}</div>
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      {lastAssistant?.content || '...'}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {sidebarOpen &&
          <button
            className="absolute inset-0 z-40 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar" />
        }

        {/* Main */}
        <main ref={swipeTabRef} className="flex-1 flex flex-col relative z-0 overflow-hidden">
          {activeTab === 'chat' &&
            <AIChatView
              messages={activeSession?.messages || []}
              setMessages={setMessagesForActive} />
          }
          {activeTab === 'image' && <AIImageView />}
          {activeTab === 'voice' && 
            <AIVoiceView 
              messages={activeSession?.messages || []} 
              setMessages={setMessagesForActive} 
            />
          }
        </main>
      </div>

      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-20%] w-[70vw] h-[70vw] blur-[100px] rounded-full bg-primary/5 animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-[-10%] right-[-20%] w-[70vw] h-[70vw] blur-[100px] rounded-full bg-purple-500/5 animate-pulse" style={{ animationDuration: '7s' }} />
      </div>
    </div>
  );
};

export default AIChat;
