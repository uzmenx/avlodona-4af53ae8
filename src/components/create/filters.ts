export interface MediaFilter {
  name: string;
  label: string;
  css: string;
}

export const MEDIA_FILTERS: MediaFilter[] = [
  { name: 'original', label: 'Original', css: 'none' },
  { name: 'vintage', label: 'Vintage', css: 'sepia(0.55) contrast(1.2) brightness(0.95)' },
  { name: 'vivid', label: 'Vivid', css: 'saturate(2.2) contrast(1.25)' },
  { name: 'bw', label: 'B&W', css: 'grayscale(1) contrast(1.1)' },
  { name: 'warm', label: 'Warm', css: 'sepia(0.35) saturate(1.4) brightness(1.05)' },
  { name: 'cool', label: 'Cool', css: 'hue-rotate(190deg) saturate(1.4) brightness(1.05)' },
  { name: 'dramatic', label: 'Dramatic', css: 'contrast(1.6) brightness(0.88) saturate(1.2)' },
  { name: 'retro', label: 'Retro', css: 'sepia(0.75) hue-rotate(-20deg) saturate(1.3)' },
  { name: 'neon', label: 'Neon', css: 'saturate(2.8) hue-rotate(85deg) brightness(1.1)' },
  { name: 'fade', label: 'Fade', css: 'opacity(0.88) brightness(1.1) contrast(0.85) saturate(0.8)' },
  { name: 'chrome', label: 'Chrome', css: 'saturate(1.5) contrast(1.35) brightness(1.05) hue-rotate(10deg)' },
  { name: 'lomo', label: 'Lomo', css: 'saturate(1.8) contrast(1.4) brightness(0.95) sepia(0.2)' },
  { name: 'cinema', label: 'Cinema', css: 'saturate(0.9) contrast(1.4) brightness(0.9) hue-rotate(5deg)' },
  { name: 'glow', label: 'Glow', css: 'brightness(1.2) contrast(0.9) saturate(1.3) blur(0px) drop-shadow(0 0 8px rgba(255,200,100,0.4))' },
];

export const EMOJIS = [
  // Faces
  '😀', '😂', '🥰', '😍', '😎', '🥳', '😢', '😡', '😱', '🤔',
  '😏', '🤩', '🥺', '😭', '🤪', '😇', '🤗', '😴', '🤑', '😤',
  // Gestures
  '👍', '👎', '👏', '🙌', '💪', '🤝', '🫶', '🙏', '✌️', '👊',
  // Hearts & Stars
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💯',
  '⭐', '🌟', '✨', '💫', '🔥', '👑', '💎', '🏆',
  // Nature
  '🌸', '🌺', '🌻', '🌹', '🌷', '🍀', '🌈', '☀️', '🌙', '⚡',
  '🌊', '🏔️', '🌴', '🍁', '🦋',
  // Fun
  '🎉', '🎊', '🎵', '🎶', '🎸', '🎤', '🎬', '🍕', '🍔', '🎂',
  '🚀', '💥', '👻', '👽', '🦄', '🐉', '🦁', '🐺', '🦊', '🐼',
];
