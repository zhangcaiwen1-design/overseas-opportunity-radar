import OpenAI from 'openai';
import { z } from 'zod';
import type { AppConfig } from '../config';
import type { WrittenOpportunity } from '../types';
import { buildOpportunityPrompt } from './prompts';

const WrittenOpportunitySchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  overseasSignal: z.string().min(1),
  whyNow: z.string().min(1),
  localizationPath: z.string().min(1),
  monetizationPaths: z.array(z.string().min(1)),
  validationPath: z.string().min(1),
  targetProfiles: z.array(z.string().min(1)),
  douyinSummary: z.string().min(1),
});

export class OpportunityWriter {
  private client: OpenAI;

  constructor(private readonly config: AppConfig, client?: OpenAI) {
    this.client = client ?? new OpenAI({ apiKey: config.openaiApiKey });
  }

  async write(title: string, summary: string): Promise<WrittenOpportunity> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildOpportunityPrompt(title, summary) }],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned empty content');
    }

    return WrittenOpportunitySchema.parse(JSON.parse(content));
  }
}
