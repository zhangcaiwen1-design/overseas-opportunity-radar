import OpenAI from 'openai';
import { loadConfig } from '../config';
import type { OpportunitySignal } from '../types';

export async function localizeSignalsForDashboard(
  signals: OpportunitySignal[],
  options?: {
    canTranslate?: boolean;
    env?: Record<string, string | undefined>;
    translateBatch?: (items: Array<{ title: string; summary: string }>) => Promise<Array<{ title: string; summary: string }>>;
  },
): Promise<OpportunitySignal[]> {
  const cleanedSignals = signals.map((signal) => ({
    ...signal,
    title: cleanText(signal.title),
    summary: cleanText(signal.summary),
  }));

  const env = options?.env ?? process.env;
  const canTranslate = options?.canTranslate ?? Boolean(loadConfig(env).openaiApiKey);
  if (!canTranslate || cleanedSignals.length === 0) {
    return cleanedSignals;
  }

  const translateBatch = options?.translateBatch ?? createTranslateBatch(env);

  try {
    const translated = await translateBatch(
      cleanedSignals.map((signal) => ({
        title: signal.title,
        summary: signal.summary,
      })),
    );

    return cleanedSignals.map((signal, index) => ({
      ...signal,
      title: cleanText(translated[index]?.title || signal.title),
      summary: cleanText(translated[index]?.summary || signal.summary),
    }));
  } catch {
    return cleanedSignals;
  }
}

function createTranslateBatch(env: Record<string, string | undefined>) {
  const config = loadConfig(env);
  const client = new OpenAI({
    apiKey: config.openaiApiKey,
    ...(config.openaiBaseUrl ? { baseURL: config.openaiBaseUrl } : {}),
  });

  return async (items: Array<{ title: string; summary: string }>) => {
    const response = await client.chat.completions.create({
      model: config.candidateTranslationModel,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            '把下面每条候选项目的 title 和 summary 翻译成自然、简洁的中文。',
            '保留专有名词，不要加解释，不要输出英文。',
            '返回 JSON：{"items":[{"title":"中文标题","summary":"中文摘要"}]}。',
            JSON.stringify({ items }),
          ].join('\n'),
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned empty localization content');
    }

    const parsed = JSON.parse(content) as { items?: Array<{ title?: string; summary?: string }> };
    return (parsed.items ?? []).map((item) => ({
      title: cleanText(item.title ?? ''),
      summary: cleanText(item.summary ?? ''),
    }));
  };
}

function cleanText(value: string) {
  return value
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
