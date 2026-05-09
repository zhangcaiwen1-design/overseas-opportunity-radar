import type { VideoScene } from '../types';

export function buildDailyVideoScenes(opportunities: Array<{ title: string }>): VideoScene[] {
  return [
    { type: 'intro', title: '今日最值得看的海外机会' },
    ...opportunities.map((item) => ({ type: 'opportunity' as const, title: item.title })),
    { type: 'outro', title: '今天最值得先做哪一条' },
  ];
}
