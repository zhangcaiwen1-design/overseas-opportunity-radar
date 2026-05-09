import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

const requiredEnv = {
  OPENAI_API_KEY: 'test-openai-key',
  PEXELS_API_KEY: 'test-pexels-key',
  FEISHU_WEBHOOK_URL: 'https://example.com/feishu',
  WECOM_WEBHOOK_URL: 'https://example.com/wecom',
  WXPUSHER_APP_TOKEN: 'test-wxpusher-token',
  WXPUSHER_UID: 'test-wxpusher-uid',
  OUTPUT_ROOT: 'C:/tmp/radar-output',
} as const;

describe('loadConfig', () => {
  it('maps all config fields', () => {
    const config = loadConfig({
      ...requiredEnv,
      TIMEZONE: 'Asia/Tokyo',
    });

    expect(config.openaiApiKey).toBe('test-openai-key');
    expect(config.openaiBaseUrl).toBe('');
    expect(config.pexelsApiKey).toBe('test-pexels-key');
    expect(config.feishuWebhookUrl).toBe('https://example.com/feishu');
    expect(config.wecomWebhookUrl).toBe('https://example.com/wecom');
    expect(config.wxpusherAppToken).toBe('test-wxpusher-token');
    expect(config.wxpusherUid).toBe('test-wxpusher-uid');
    expect(config.outputRoot).toBe('C:/tmp/radar-output');
    expect(config.timezone).toBe('Asia/Tokyo');
    expect(config.candidateTranslationModel).toBe('gpt-4o-mini');
  });

  it('maps OpenAI base URL when provided', () => {
    const config = loadConfig({
      ...requiredEnv,
      OPENAI_BASE_URL: 'https://ai.558669.xyz/',
    });

    expect(config.openaiBaseUrl).toBe('https://ai.558669.xyz/v1');
    expect(config.candidateTranslationModel).toBe('gpt-4o-mini');
  });

  it('defaults timezone to Asia/Shanghai when omitted', () => {
    const config = loadConfig(requiredEnv);

    expect(config.timezone).toBe('Asia/Shanghai');
  });

  it('allows empty integration keys for local-first MVP runs', () => {
    const config = loadConfig({
      OPENAI_API_KEY: '',
      PEXELS_API_KEY: '',
      FEISHU_WEBHOOK_URL: '',
      WECOM_WEBHOOK_URL: '',
      WXPUSHER_APP_TOKEN: '',
      WXPUSHER_UID: '',
      OUTPUT_ROOT: 'output',
    });

    expect(config.openaiApiKey).toBe('');
    expect(config.pexelsApiKey).toBe('');
    expect(config.outputRoot).toBe('output');
    expect(config.timezone).toBe('Asia/Shanghai');
  });

  it('defaults output root when omitted', () => {
    const config = loadConfig({
      OPENAI_API_KEY: '',
      PEXELS_API_KEY: '',
      FEISHU_WEBHOOK_URL: '',
      WECOM_WEBHOOK_URL: '',
      WXPUSHER_APP_TOKEN: '',
      WXPUSHER_UID: '',
    });

    expect(config.outputRoot).toBe('output');
  });
});
