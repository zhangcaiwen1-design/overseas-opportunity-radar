export type ImageBriefMode = 'featured' | 'pool';

export function buildImageBrief(mode: ImageBriefMode, title: string): string {
  if (mode === 'featured') {
    return `${title}: magazine-style visual with an editorial composition, premium lighting, and a clear hero subject.`;
  }

  return `${title}: business-brief style visual with a clean composition, practical context, and straightforward detail.`;
}
