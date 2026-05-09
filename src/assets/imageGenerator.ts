import OpenAI from 'openai';
import type { AppConfig } from '../config';

export class ImageGenerator {
  private readonly client: OpenAI;

  constructor(config: AppConfig, client?: OpenAI) {
    this.client =
      client ??
      new OpenAI({
        apiKey: config.openaiApiKey,
        ...(config.openaiBaseUrl ? { baseURL: config.openaiBaseUrl } : {}),
      });
  }

  async generateFeatured(prompt: string) {
    return this.client.images.generate({
      model: 'gpt-image-2',
      prompt,
      size: '1536x1024',
    });
  }
}
