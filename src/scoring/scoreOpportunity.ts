import type { OpportunityScore, OpportunitySignal } from '../types';

const LOCALIZATION_TERMS = ['local', 'china', 'chinese', 'chengdu', 'shanghai', 'beijing', 'wechat', 'wecom', 'xiaohongshu'];
const MONETIZATION_TERMS = ['payment', 'subscription', 'sell', 'commerce', 'invoice', 'order', 'crm', 'lead'];
const BUILDABILITY_TERMS = ['small business', 'simple', 'workflow', 'assistant', 'tool', 'template', 'automation'];
const CONTENT_TERMS = ['story', 'content', 'video', 'share', 'post', 'download', 'template'];
const COMPETITION_TERMS = ['ai saas', 'startup', 'platform', 'for everyone', 'generic', 'crowded'];

function hasAny(text: string, terms: string[]): boolean {
  const lowerText = text.toLowerCase();
  return terms.some((term) => lowerText.includes(term));
}

function hasTag(tags: string[], expected: string): boolean {
  return tags.some((tag) => tag.toLowerCase() === expected);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(10, value));
}

export function scoreOpportunity(signal: OpportunitySignal): OpportunityScore {
  const text = `${signal.title} ${signal.summary} ${signal.tags.join(' ')}`;

  const localization = clamp(
    (hasAny(text, LOCALIZATION_TERMS) ? 8 : 2) + (hasTag(signal.tags, 'local') ? 2 : 0),
  );
  const monetization = clamp(
    (hasAny(text, MONETIZATION_TERMS) ? 7 : 3) + (signal.source === 'rss' ? 1 : 0),
  );
  const buildability = clamp(
    (hasAny(text, BUILDABILITY_TERMS) ? 7 : 4) + (signal.rawScore < 50 ? 1 : 0),
  );
  const contentability = clamp(hasAny(text, CONTENT_TERMS) ? 7 : 3);
  const demand = clamp(Math.round(signal.rawScore / 12) + 2);
  const competition = clamp(
    (hasAny(text, COMPETITION_TERMS) ? 8 : 3) + (signal.source === 'hackernews' ? 1 : 0),
  );

  const total = demand + localization + monetization + buildability + contentability - competition;

  return {
    demand,
    localization,
    monetization,
    buildability,
    contentability,
    competition,
    total,
  };
}
