import type { AppConfig } from '../config';

export class PexelsClient {
  constructor(private readonly config: AppConfig) {}

  async searchVideo(query: string): Promise<string[]> {
    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5`,
      {
        headers: {
          Authorization: this.config.pexelsApiKey,
        },
      },
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      videos?: Array<{ url?: string; video_files?: Array<{ link?: string }> }>;
    };

    return (data.videos ?? [])
      .map((video) => video.url ?? video.video_files?.[0]?.link)
      .filter((value): value is string => Boolean(value));
  }
}
