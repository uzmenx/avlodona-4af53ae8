export type StoryRingId =
  | 'default'
  | 'gold'
  | 'neon'
  | 'rainbow'
  | 'emerald'
  | 'sunset'
  | 'ocean'
  | 'pink_purple';

export const STORY_RINGS: Array<{ id: StoryRingId; label: string; colors: string[] }> = [
  {
    id: 'default',
    label: 'Oddiy',
    colors: ['hsl(37,97%,70%)', 'hsl(329,100%,64%)', 'hsl(280,87%,44%)'],
  },
  {
    id: 'gold',
    label: 'Oltin',
    colors: ['hsl(45,95%,60%)', 'hsl(30,90%,55%)', 'hsl(50,100%,70%)'],
  },
  {
    id: 'neon',
    label: 'Neon',
    colors: ['hsl(190,95%,55%)', 'hsl(300,90%,60%)', 'hsl(260,90%,60%)'],
  },
  {
    id: 'rainbow',
    label: 'Kamalak',
    colors: ['hsl(0,100%,50%)', 'hsl(60,100%,50%)', 'hsl(120,100%,40%)', 'hsl(200,100%,50%)', 'hsl(280,100%,50%)'],
  },
  {
    id: 'emerald',
    label: 'Zumrad',
    colors: ['hsl(140,80%,45%)', 'hsl(160,90%,40%)', 'hsl(180,80%,50%)'],
  },
  {
    id: 'sunset',
    label: 'Quyosh',
    colors: ['hsl(0,90%,55%)', 'hsl(30,100%,60%)', 'hsl(50,100%,65%)'],
  },
  {
    id: 'ocean',
    label: 'Okean',
    colors: ['hsl(200,100%,50%)', 'hsl(220,90%,55%)', 'hsl(180,80%,50%)'],
  },
  {
    id: 'pink_purple',
    label: 'Pushti',
    colors: ['hsl(320,90%,60%)', 'hsl(280,80%,55%)', 'hsl(340,95%,65%)'],
  },
];

export function getStoryRingGradient(ringId: StoryRingId | string): string {
  const ring = STORY_RINGS.find((r) => r.id === ringId) || STORY_RINGS[0];
  return `conic-gradient(from 0deg, ${ring.colors.join(', ')}, ${ring.colors[0]})`;
}
