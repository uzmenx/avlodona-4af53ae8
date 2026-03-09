import { useLanguage, Language } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const langs: { code: Language; label: string }[] = [
  { code: 'uz', label: "O'z" },
  { code: 'ru', label: 'Ру' },
  { code: 'en', label: 'En' },
];

interface LangSwitcherProps {
  /** Qorongʻu fon (login/registratsiya) da yaxshi koʻrinishi uchun ozroq nur */
  glow?: boolean;
}

export const LangSwitcher = ({ glow }: LangSwitcherProps) => {
  const { lang, setLang } = useLanguage();
  const current = langs.find(l => l.code === lang);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={
            glow
              ? 'h-8 px-3 text-sm gap-1.5 text-white/95 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_24px_rgba(255,255,255,0.25)] transition-all duration-300'
              : 'h-7 px-2 text-xs gap-1 text-muted-foreground'
          }
        >
          <Globe className={glow ? 'h-4 w-4' : 'h-3 w-3'} />
          {current?.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[80px]">
        {langs.map(l => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className={lang === l.code ? 'font-semibold' : ''}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
