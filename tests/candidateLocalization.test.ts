import { describe, expect, it, vi } from 'vitest';
import type { OpportunitySignal } from '../src/types';
import { localizeSignalsForDashboard } from '../src/cloud/localizeSignalsForDashboard';

const createCompletion = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation((config: unknown) => ({
    config,
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  })),
}));

const sampleSignals: OpportunitySignal[] = [
  {
    id: 'signal-1',
    source: 'github',
    title: 'AI storefront workflow',
    summary: 'Helps neighborhood shops capture leads and turn chats into paid orders.',
    url: 'https://example.com/product',
    canonicalUrl: 'https://example.com/product',
    publishedAt: '2026-05-08T00:00:00.000Z',
    tags: ['github', 'ai'],
    rawScore: 12,
  },
];

describe('localizeSignalsForDashboard', () => {
  it('appends /v1 when OpenAI base URL is configured as site root', async () => {
    createCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [{ title: 'AI 店铺工作流', summary: '帮助社区小店获取线索，并把聊天转成付费订单。' }],
            }),
          },
        },
      ],
    });

    const localized = await localizeSignalsForDashboard(sampleSignals, {
      env: {
        OPENAI_API_KEY: 'sk-demo',
        OPENAI_BASE_URL: 'https://ai.558669.xyz',
        CANDIDATE_TRANSLATION_MODEL: 'gpt-4o-mini',
      },
    });

    expect(localized[0].title).toBe('AI 店铺工作流');
    const OpenAI = (await import('openai')).default as unknown as ReturnType<typeof vi.fn>;
    expect(OpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-demo',
        baseURL: 'https://ai.558669.xyz/v1',
      }),
    );
  });

  it('translates title and summary to Chinese when OpenAI config is available', async () => {
    const translateBatch = vi.fn(async () => [
      {
        title: 'AI 店铺工作流',
        summary: '帮助社区小店获取线索，并把聊天转成付费订单。',
      },
    ]);

    const localized = await localizeSignalsForDashboard(sampleSignals, {
      canTranslate: true,
      translateBatch,
    });

    expect(translateBatch).toHaveBeenCalledWith([
      {
        title: 'AI storefront workflow',
        summary: 'Helps neighborhood shops capture leads and turn chats into paid orders.',
      },
    ]);
    expect(localized[0]).toMatchObject({
      title: 'AI 店铺工作流',
      summary: '帮助社区小店获取线索，并把聊天转成付费订单。',
    });
  });

  it('falls back to cleaned original text when translation is unavailable', async () => {
    const localized = await localizeSignalsForDashboard(sampleSignals, {
      canTranslate: false,
      translateBatch: vi.fn(),
    });

    expect(localized[0]).toMatchObject({
      title: 'AI storefront workflow',
      summary: 'Helps neighborhood shops capture leads and turn chats into paid orders.',
    });
  });
});
