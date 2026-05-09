import { z } from 'zod';

const optionalString = z.string().optional().transform((value) => value?.trim() ?? '');

function normalizeOpenAiBaseUrl(value: string) {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/v1';
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    return value;
  }

  return value.replace(/\/$/, '');
}
const defaultedString = (fallback: string) =>
  z.string().optional().transform((value) => {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : fallback;
  });

const configSchema = z.object({
  OPENAI_API_KEY: optionalString,
  OPENAI_BASE_URL: optionalString.transform(normalizeOpenAiBaseUrl),
  CANDIDATE_TRANSLATION_MODEL: defaultedString('gpt-4o-mini'),
  PEXELS_API_KEY: optionalString,
  FEISHU_WEBHOOK_URL: optionalString,
  WECOM_WEBHOOK_URL: optionalString,
  WXPUSHER_APP_TOKEN: optionalString,
  WXPUSHER_UID: optionalString,
  OUTPUT_ROOT: defaultedString('output'),
  TIMEZONE: defaultedString('Asia/Shanghai'),
});

type ParsedConfig = z.infer<typeof configSchema>;

function toAppConfig(parsed: ParsedConfig) {
  return {
    openaiApiKey: parsed.OPENAI_API_KEY,
    openaiBaseUrl: parsed.OPENAI_BASE_URL,
    candidateTranslationModel: parsed.CANDIDATE_TRANSLATION_MODEL,
    pexelsApiKey: parsed.PEXELS_API_KEY,
    feishuWebhookUrl: parsed.FEISHU_WEBHOOK_URL,
    wecomWebhookUrl: parsed.WECOM_WEBHOOK_URL,
    wxpusherAppToken: parsed.WXPUSHER_APP_TOKEN,
    wxpusherUid: parsed.WXPUSHER_UID,
    outputRoot: parsed.OUTPUT_ROOT,
    timezone: parsed.TIMEZONE,
  };
}

export type AppConfig = ReturnType<typeof toAppConfig>;

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  return toAppConfig(configSchema.parse(env));
}
