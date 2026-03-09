export interface MediaFilter {
  name: string;
  label: string;
  css: string;
}

export const MEDIA_FILTERS: MediaFilter[] = [
  { name: 'original', label: 'Original', css: 'none' },
  { name: 'vintage', label: 'Vintage', css: 'sepia(0.5) contrast(1.2)' },
  { name: 'vivid', label: 'Vivid', css: 'saturate(2) contrast(1.3)' },
  { name: 'bw', label: 'Qora-Oq', css: 'grayscale(1)' },
  { name: 'warm', label: 'Warm', css: 'sepia(0.3) saturate(1.4)' },
  { name: 'cool', label: 'Cool', css: 'hue-rotate(200deg) saturate(1.3)' },
  { name: 'dramatic', label: 'Dramatic', css: 'contrast(1.5) brightness(0.9)' },
  { name: 'retro', label: 'Retro', css: 'sepia(0.7) hue-rotate(-30deg)' },
  { name: 'neon', label: 'Neon', css: 'saturate(2.5) hue-rotate(90deg)' },
];

export const EMOJIS = [
  '😀', '😂', '🥰', '😎', '🤔', '👍', '❤️', '🔥',
  '⭐', '🎉', '🎵', '💯', '🌟', '✨', '💪', '🙌',
  '👏', '🎊', '🎈', '🌈', '☀️', '🌙', '⚡', '💖',
];
