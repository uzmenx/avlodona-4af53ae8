 import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { getSocialIcon, SocialLink } from './SocialLinksEditor';

interface SocialLinksListProps {
  links: SocialLink[];
  className?: string;
}

export const SocialLinksList = ({ links, className }: SocialLinksListProps) => {
  if (!links || links.length === 0) return null;

  const validLinks = links.filter(link => link.url && link.url.trim());

  if (validLinks.length === 0) return null;

  const getPalette = (type: string) => {
    switch (type) {
      case 'telegram':
        return { from: '#00B3FF', to: '#0077FF' };
      case 'instagram':
        return { from: '#A855F7', to: '#F97316' };
      case 'youtube':
        return { from: '#FF2D55', to: '#FF0033' };
      case 'facebook':
        return { from: '#3B82F6', to: '#1D4ED8' };
      case 'twitter':
        return { from: '#111827', to: '#6B7280' };
      case 'github':
        return { from: '#111827', to: '#374151' };
      case 'website':
        return { from: '#22C55E', to: '#14B8A6' };
      default:
        return { from: '#64748B', to: '#94A3B8' };
    }
  };

  return (
    <div className={cn('w-full overflow-x-auto sl-scroll', className)}>
      <div className="flex gap-2 pr-2">
        {validLinks.map((link, index) => {
          const Icon = getSocialIcon(link.type);
          const palette = getPalette(link.type);
          const displayText = link.label || link.url.replace(/^https?:\/\//, '').slice(0, 22);

          return (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group relative isolate shrink-0',
                'w-auto',
                'h-9 rounded-2xl px-2.5',
                'flex items-center gap-2',
                'border border-white/10 bg-white/10 dark:bg-white/5',
                'backdrop-blur-md',
                'shadow-sm hover:shadow-md',
                'transition-[transform,box-shadow] duration-200 active:scale-[0.98]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
              )}
              style={
                {
                  ['--sl-from' as any]: palette.from,
                  ['--sl-to' as any]: palette.to,
                  // Mobile-first sizing: try to keep ~3 pills visible per screen while still adapting to label length
                  minWidth: 'clamp(110px, 30vw, 170px)',
                  maxWidth: 'clamp(140px, 34vw, 220px)',
                } as CSSProperties
              }
            >
              <span
                className={cn(
                  'absolute inset-0 -z-10 rounded-2xl opacity-100'
                )}
                style={{
                  background:
                    'radial-gradient(70% 70% at 50% 0%, color-mix(in srgb, var(--sl-from) 35%, transparent), transparent 70%),' +
                    'radial-gradient(80% 80% at 0% 100%, color-mix(in srgb, var(--sl-to) 30%, transparent), transparent 72%)',
                }}
              />

              <span
                className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl opacity-70"
                style={{
                  background: 'linear-gradient(135deg, var(--sl-from), var(--sl-to))',
                  mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                  maskComposite: 'exclude',
                  WebkitMaskComposite: 'xor',
                  padding: '1px',
                }}
              />

              <div
                className={cn(
                  'h-6 w-6 rounded-xl flex items-center justify-center shrink-0',
                  'bg-black/10 dark:bg-white/5 border border-white/10',
                  'transition-transform duration-200'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    'text-foreground/80 dark:text-white/80'
                  )}
                />
              </div>

              <span className="min-w-0 flex-1 text-[12px] font-semibold tracking-tight text-foreground/85 dark:text-white/85">
                <span className="block truncate">{displayText}</span>
              </span>

              <span
                className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  'opacity-80 transition-opacity',
                  'sl-orb'
                )}
                style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
              />
            </a>
          );
        })}
      </div>
      <style>{`
        /* Hide scrollbar (no space taken) */
        .sl-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .sl-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }

        @keyframes slFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1.5px); }
        }
        .sl-orb { animation: slFloat 2.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};