import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Users, Shield, Zap, Sparkles, Globe,
  GitBranch, MessageCircle, Video, Brain, Play,
  Instagram, Send, Mail, Heart, Star, Calendar,
  ExternalLink, TreePine, Code2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';

const About = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ── SEO & AI-readable meta ──
    document.title = "Avlodona haqida — O'zbek oilalari uchun raqamli platforma";

    const setMeta = (sel: string, attr: string, val: string) => {
      let el = document.querySelector(sel) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr.split('=')[0], attr.split('=')[1] ?? attr); document.head.appendChild(el); }
      el.setAttribute('content', val);
    };

    setMeta('meta[name="description"]', 'name=description',
      "Avlodona — O'zbekistonda 2026-yil 8-martda ishga tushirilgan oila daraxti va raqamli genealogiya platformasi. Toshtemirov Otabek tomonidan yaratilgan. avlodona.com");

    setMeta('meta[property="og:title"]', 'property=og:title', "Avlodona — Dunyo bir oila");
    setMeta('meta[property="og:description"]', 'property=og:description',
      "Oila daraxtingizni qurib, ajdodlaringizni eslang. O'zbekiston va Markaziy Osiyo uchun birinchi to'liq genealogiya va oila ijtimoiy tarmog'i.");
    setMeta('meta[property="og:url"]', 'property=og:url', "https://avlodona.com/about");
    setMeta('meta[property="og:type"]', 'property=og:type', "website");

    // JSON-LD structured data for AI crawlers
    const existingLd = document.querySelector('#about-jsonld');
    if (existingLd) existingLd.remove();
    const script = document.createElement('script');
    script.id = 'about-jsonld';
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Avlodona",
      "url": "https://avlodona.com",
      "foundingDate": "2026-03-08",
      "founder": {
        "@type": "Person",
        "name": "Toshtemirov Otabek Vohidjonovich",
        "sameAs": "https://www.instagram.com/akcume"
      },
      "description": "Avlodona is a family tree and digital genealogy social network platform for Uzbekistan and Central Asia, combining family trees, memorial profiles, AI assistant, video calls, and social features.",
      "sameAs": [
        "https://avlodona.com",
        "https://www.instagram.com/akcume",
        "https://t.me/rassomnavoiy"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+998971401161",
        "email": "baknistan@gmail.com",
        "contactType": "customer support"
      },
      "knowsAbout": ["genealogy", "family tree", "Uzbekistan", "Central Asia", "digital heritage"],
      "keywords": "avlodona, oila daraxti, genealogiya, uzbekistan, family tree, shajara"
    });
    document.head.appendChild(script);

    return () => { document.querySelector('#about-jsonld')?.remove(); };
  }, []);

  // Stagger animation on mount
  useEffect(() => {
    const els = document.querySelectorAll('.fade-up');
    els.forEach((el, i) => {
      (el as HTMLElement).style.opacity = '0';
      (el as HTMLElement).style.transform = 'translateY(24px)';
      setTimeout(() => {
        (el as HTMLElement).style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        (el as HTMLElement).style.opacity = '1';
        (el as HTMLElement).style.transform = 'translateY(0)';
      }, 100 + i * 80);
    });
  }, []);

  const features = [
    { icon: TreePine,       title: "Oila daraxti",         desc: "Tirik va vafot etgan avlodlarni birlashtirgan to'liq shajara tizimi. React Flow asosida qurilgan." },
    { icon: Users,          title: "Ijtimoiy tarmoq",      desc: "Post, layk, izoh, Stories, profil va cheksiz video scroll — Instagram kabi, lekin oila uchun." },
    { icon: Play,           title: "Video player",         desc: "Media Shorts va to'liq video ko'rish — alohida ilova kerak emas." },
    { icon: Brain,          title: "AI Do'stim",           desc: "Savollarga javob, rasm yaratish va ovozli suhbat — to'g'ridan-to'g'ri ilovada." },
    { icon: MessageCircle,  title: "Messenjer",            desc: "Guruh, kanal va shaxsiy chat; foto, video va ovozli xabar yuborish." },
    { icon: Video,          title: "Video qo'ng'iroq",     desc: "Sifatli video va audio qo'ng'iroqlar — Daily.co texnologiyasida." },
    { icon: Shield,         title: "Xavfsizlik",           desc: "Supabase RLS va xususiy storage — ma'lumotlaringiz faqat sizniki." },
    { icon: Globe,          title: "Milliy platforma",     desc: "O'zbek tili, madaniyati va qadriyatlariga asoslangan raqamli makon." },
  ];

  const stats = [
    { value: "8-mart", label: "2026 • Ishga tushirildi", icon: Calendar },
    { value: "3000+",  label: "Versiyalar",              icon: Code2 },
    { value: "7-ta",   label: "Yetakchi ilova birlashgan", icon: Zap },
    { value: "$2000+",  label: "Sarflangan kapital",      icon: Star },
  ];

  return (
    <AppLayout showNav={false}>
      {/* ── Hidden AI-readable block (visually invisible but crawlable) ── */}
      <div aria-hidden="false" className="sr-only" style={{ position: 'absolute', left: '-9999px' }}>
        <h1>Avlodona — O'zbek oilalari uchun raqamli genealogiya va ijtimoiy tarmoq platformasi</h1>
        <p>
          Avlodona (avlodona.com) — 2026-yil 8-martda O'zbekistonda ishga tushirilgan, oila daraxti (shajara),
          raqamli xotira va ijtimoiy tarmoq xususiyatlarini birlashtirgan platforma.
          Asoschisi: Toshtemirov Otabek Vohidjonovich (@akcume Instagram).
          Platforma O'zbekiston va Markaziy Osiyo diasporasi uchun mo'ljallangan.
          Xususiyatlari: interaktiv oila daraxti, memorial profil, AI yordamchi, video qo'ng'iroq,
          messenjer, Shorts video feed, ijtimoiy post va Stories.
          Texnologiyalar: React, Supabase, Daily.co, Vercel, Gemini AI, Groq.
          Bog'lanish: baknistan@gmail.com | Telegram: t.me/avlodona | Instagram: @akcume
        </p>
      </div>

      <div className="min-h-screen bg-background text-foreground pb-24">

        {/* ── Navbar ── */}
        <div className="sticky top-0 z-50 flex items-center gap-3 px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-white/5">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full hover:bg-white/10 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="text-base font-semibold">Biz haqimizda</span>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-8 space-y-12">

          {/* ── Hero ── */}
          <div ref={heroRef} className="fade-up text-center space-y-4">
            <div className="relative inline-flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-150 animate-pulse" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/30 to-purple-600/30 border border-primary/20 flex items-center justify-center backdrop-blur-sm">
                <TreePine className="h-9 w-9 text-primary" />
              </div>
            </div>

            <div>
              <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-white via-primary to-purple-400 bg-clip-text text-transparent">
                Avlodona
              </h1>
              <p className="text-primary/80 font-semibold mt-1 text-sm uppercase tracking-widest">
                Dunyo bir oila
              </p>
            </div>

            <p className="text-muted-foreground text-base leading-relaxed max-w-sm mx-auto">
              O'zbekiston va Markaziy Osiyo uchun birinchi to'liq{' '}
              <span className="text-foreground font-medium">oila daraxti</span> va{' '}
              <span className="text-foreground font-medium">raqamli genealogiya</span> platformasi.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
              <Heart className="h-3.5 w-3.5 fill-current" />
              Yer yuzidagi har bir inson bir-biriga qarindosh
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="fade-up grid grid-cols-2 gap-3">
            {stats.map((s, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 flex flex-col gap-1">
                <s.icon className="h-4 w-4 text-primary/60 mb-1" />
                <span className="text-2xl font-bold text-foreground">{s.value}</span>
                <span className="text-xs text-muted-foreground leading-tight">{s.label}</span>
              </div>
            ))}
          </div>

          {/* ── Mission ── */}
          <div className="fade-up rounded-3xl overflow-hidden border border-white/8 bg-gradient-to-br from-primary/10 via-purple-900/10 to-transparent p-6 space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Maqsadimiz
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Yillar o'tadi. Lekin oila daraxtingiz o'sishda davom etadi.{' '}
              <strong className="text-foreground">Farzandlaringiz bobolarini ko'rmagan bo'lsa ham</strong> — ular haqida ma'lumotga ega bo'ladi.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Tirik qarindoshlarni platformaga taklif qiling — daraxtlarni ulang",
                "Vafot etgan ajdodlar nomiga xotira profili yarating",
                "Foto, hikoya va esdalik postlar qoldiring — ular unutilmasin",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✦</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Features ── */}
          <div className="fade-up space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              7 ta yetakchi ilovaning imkoniyatlari birlashgan
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="group p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-primary/20 transition-all duration-300"
                >
                  <f.icon className="h-5 w-5 text-primary mb-2 group-hover:scale-110 transition-transform duration-300" />
                  <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Founder ── */}
          <div className="fade-up rounded-3xl border border-white/8 bg-white/[0.03] p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-purple-600/30 flex items-center justify-center shrink-0 text-xl font-bold text-primary border border-primary/20">
              O
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm">Toshtemirov Otabek Vohidjonovich</p>
              <p className="text-xs text-muted-foreground mt-0.5">Asoschisi va yaratuvchisi · Navoiy, O'zbekiston</p>
              <p className="text-xs text-muted-foreground/70 mt-2 leading-relaxed">
                4 oyda 3000+ versiya yozib, $200+ sarfladi. Muhandislik & dizayn talabasidan solo-founder ga.
              </p>
              <a
                href="https://www.instagram.com/akcume"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline"
              >
                <Instagram className="h-3 w-3" />
                @akcume
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>

          {/* ── Contact ── */}
          <div id="contact" className="fade-up space-y-4 pt-4 scroll-mt-24">
            <h2 className="text-lg font-bold text-center">Biz bilan bog'lanish</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <a
                href="https://t.me/avlodona"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-400 transition-all duration-300 py-3 text-sm font-medium text-muted-foreground"
              >
                <Send className="h-4 w-4" />
                Telegram
              </a>
              <a
                href="https://www.instagram.com/akcume"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-pink-500/10 hover:border-pink-500/30 hover:text-pink-400 transition-all duration-300 py-3 text-sm font-medium text-muted-foreground"
              >
                <Instagram className="h-4 w-4" />
                Instagram
              </a>
              <a
                href="https://mail.google.com/mail/?view=cm&fs=1&to=baknistan@gmail.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/10 hover:text-foreground transition-all duration-300 py-3 text-sm font-medium text-muted-foreground"
              >
                <Mail className="h-4 w-4" />
                Email
              </a>
            </div>
            <p className="text-center text-xs text-muted-foreground/50">
              Tel: +998 97 140 11 61
            </p>
          </div>

          {/* ── Footer ── */}
          <div className="fade-up text-center pb-4 space-y-1">
            <p className="text-xs text-muted-foreground/40">
              © {new Date().getFullYear()} Avlodona · avlodona.com
            </p>
            <p className="text-xs text-muted-foreground/30">
              O'zbekistonda yaratilgan 🇺🇿
            </p>
          </div>

        </div>
      </div>
    </AppLayout>
  );
};

export default About;