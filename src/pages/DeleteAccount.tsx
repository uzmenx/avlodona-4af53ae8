import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, User, GitBranch, Users, KeyRound, Send, Mail, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DeleteAccount = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [useMailto, setUseMailto] = useState(false);

  useEffect(() => {
    document.title = "Akkauntni o'chirish — Avlodona";
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const subject = encodeURIComponent("Akkauntni o'chirish so'rovi / Запрос на удаление аккаунта");
    const body = encodeURIComponent(
      `Email: ${email}\n\nSabab / Причина:\n${reason || '(ko\'rsatilmagan / не указана)'}\n\n---\nAvlodona — https://avlodona.com`
    );
    const mailtoLink = `mailto:support@avlodona.com?subject=${subject}&body=${body}`;

    // Try to open mailto; if it fails, show success message anyway
    try {
      window.location.href = mailtoLink;
    } catch {
      // ignore
    }

    setSubmitted(true);
    setUseMailto(true);
  };

  const dataItems = [
    {
      icon: User,
      uz: "Profil ma'lumotlari (ism, rasm)",
      ru: 'Данные профиля (имя, фото)',
    },
    {
      icon: GitBranch,
      uz: "Oila daraxti ma'lumotlari",
      ru: 'Данные семейного дерева',
    },
    {
      icon: Users,
      uz: "Barcha ulangan qarindoshlar",
      ru: 'Все подключённые родственники',
    },
    {
      icon: KeyRound,
      uz: "Kirish ma'lumotlari (login, parol)",
      ru: 'Учётные данные (логин, пароль)',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full hover:bg-white/10 shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="text-base font-semibold truncate">Akkauntni o'chirish</span>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-8 pb-24 space-y-8">

        {/* Logo + Title */}
        <div className="text-center space-y-4">
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-2xl scale-150" />
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400/30 to-yellow-600/30 border border-amber-400/30 flex items-center justify-center backdrop-blur-sm overflow-hidden">
              <img src="/app-logo.png" className="w-12 h-12 object-contain" alt="Avlodona Logo" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
              Avlodona
            </h1>
            <p className="text-amber-400/70 font-semibold text-xs uppercase tracking-widest mt-0.5">
              Dunyo bir oila
            </p>
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Akkauntni o'chirish
            </h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Удаление аккаунта
            </p>
          </div>
        </div>

        {/* Warning banner */}
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-red-400">
              Bu amalni qaytarib bo'lmaydi!
            </p>
            <p className="text-xs text-red-400/80">
              Это действие необратимо. Все ваши данные будут удалены навсегда.
            </p>
          </div>
        </div>

        {/* What will be deleted */}
        <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30 bg-muted/30">
            <p className="text-sm font-semibold text-foreground">
              Quyidagi ma'lumotlar o'chiriladi:
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Следующие данные будут удалены:
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {dataItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-4 w-4 text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.uz}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.ru}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form or Success */}
        {submitted ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <div>
              <p className="text-base font-bold text-emerald-400">
                So'rovingiz qabul qilindi.
              </p>
              <p className="text-sm text-emerald-400/80 mt-1">
                7 kun ichida akkauntingiz o'chiriladi.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Ваш запрос принят. Аккаунт будет удалён в течение 7 дней.
              </p>
            </div>
            {useMailto && (
              <p className="text-xs text-muted-foreground/60">
                Elektron pochta dasturi ochilgan bo'lishi kerak. Agar ochilmagan bo'lsa,{' '}
                <a
                  href="mailto:support@avlodona.com"
                  className="text-amber-400 hover:underline"
                >
                  support@avlodona.com
                </a>{' '}
                ga yuboring.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                O'chirish so'rovini yuborish / Отправить запрос на удаление
              </h3>

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="delete-email"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Email manzil / Электронная почта *
                </label>
                <input
                  id="delete-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full h-11 rounded-xl border border-border/60 bg-background/80 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/60 transition-all"
                />
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label
                  htmlFor="delete-reason"
                  className="text-xs font-medium text-muted-foreground"
                >
                  O'chirish sababi (ixtiyoriy) / Причина удаления (необязательно)
                </label>
                <textarea
                  id="delete-reason"
                  rows={3}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Sababni yozing... / Укажите причину..."
                  className="w-full rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/60 transition-all resize-none"
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl font-bold text-sm bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Akkauntni o'chirish so'rovini yuborish
              </Button>
              <p className="text-[11px] text-center text-muted-foreground/60">
                So'rov support@avlodona.com ga yuboriladi
              </p>
            </div>
          </form>
        )}

        {/* Telegram contact */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Savollaringiz bormi?
          </p>
          <p className="text-xs text-muted-foreground">
            Есть вопросы? Напишите нам в Telegram:
          </p>
          <a
            href="https://t.me/rassomnavoiy"
            target="_blank"
            rel="noopener noreferrer"
            id="telegram-support-link"
            className="flex items-center gap-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 transition-all px-3 py-2.5 text-sm font-medium"
          >
            <Send className="h-4 w-4 shrink-0" />
            t.me/rassomnavoiy
          </a>
          <a
            href="mailto:support@avlodona.com"
            id="email-support-link"
            className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-background/60 hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all px-3 py-2.5 text-sm font-medium"
          >
            <Mail className="h-4 w-4 shrink-0" />
            support@avlodona.com
          </a>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground/40 pb-2">
          © {new Date().getFullYear()} Avlodona · avlodona.com · O'zbekistonda yaratilgan 🇺🇿
        </p>
      </div>
    </div>
  );
};

export default DeleteAccount;
