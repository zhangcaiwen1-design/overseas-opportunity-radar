import { describe, expect, it } from 'vitest';
import { buildOpportunityPrompt } from '../src/writer/prompts';
import { OpportunityWriter } from '../src/writer/opportunityWriter';
import { renderArticleMarkdown } from '../src/writer/renderMarkdown';
import type { AppConfig } from '../src/config';
import type { SelectedWrittenOpportunity, WrittenOpportunity } from '../src/types';

const article: SelectedWrittenOpportunity = {
  slug: 'telegram-crm-chengdu-bakery',
  title: '工具机会：Telegram CRM for a local bakery chain in Chengdu',
  sourceLabel: 'GitHub 项目',
  projectType: 'tool-enhancement',
  oneLiner: '一个给面包店老板使用的轻量客户跟进工具机会。',
  projectIntro: '这个项目更像一个把客户跟进动作压缩得更顺手的小工具，而不是完整 ERP。',
  operationModel: ['先收集客户线索。', '再自动提醒跟进。'],
  whyItMatters: ['社区里已经有真实需求。'],
  chinaAdaptation: ['优先接到微信和本地支付链路。'],
  monetizationExecution: ['先卖轻量工具包和代搭建。'],
  contentAngles: [{ channel: 'douyin', angle: '从老板复购痛点切入。' }],
};

const writerArticle: WrittenOpportunity = {
  slug: 'telegram-crm-chengdu-bakery',
  title: 'Telegram CRM for a local bakery chain in Chengdu',
  overseasSignal: 'Neighborhood bakeries need simpler repeat-order capture and customer follow-up.',
  whyNow: 'China-localized shop owners are already using chat flows, so the workflow can be adopted quickly.',
  localizationPath: 'Map the overseas chat CRM flow to WeChat, local payment, and simple store operations.',
  monetizationPaths: ['SaaS subscription', 'setup service'],
  validationPath: 'Test with one bakery owner in a WeChat group and run a manual pilot.',
  targetProfiles: ['small bakery owner', 'family-run shop operator'],
  douyinSummary: 'A practical local-owner CRM story for short video.',
};

const config: AppConfig = {
  openaiApiKey: 'test-openai-key',
  openaiBaseUrl: '',
  pexelsApiKey: 'test-pexels-key',
  feishuWebhookUrl: 'https://example.com/feishu',
  wecomWebhookUrl: 'https://example.com/wecom',
  wxpusherAppToken: 'test-wxpusher-token',
  wxpusherUid: 'test-wxpusher-uid',
  outputRoot: 'output',
  timezone: 'Asia/Shanghai',
};

describe('buildOpportunityPrompt', () => {
  it('includes the required JSON fields, localization constraints, and caller input', () => {
    const prompt = buildOpportunityPrompt('Overseas CRM', 'Bakery workflow');

    expect(prompt).toContain('slug, title, overseasSignal, whyNow, localizationPath, monetizationPaths, validationPath, targetProfiles, douyinSummary');
    expect(prompt).toContain('中国本土');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('Overseas CRM');
    expect(prompt).toContain('Bakery workflow');
  });
});

describe('renderArticleMarkdown', () => {
  it('includes the redesigned selected article sections and body content', () => {
    const markdown = renderArticleMarkdown(article);

    expect(markdown).toContain('## 一句话介绍');
    expect(markdown).toContain(article.oneLiner);
    expect(markdown).toContain('## 项目介绍');
    expect(markdown).toContain(article.projectIntro);
    expect(markdown).toContain('## 运作模式');
    expect(markdown).toContain('## 国产化路径');
    expect(markdown).toContain('## 变现实操');
    expect(markdown).toContain('- 先卖轻量工具包和代搭建。');
    expect(markdown).toContain('## 内容传播角度');
    expect(markdown).toContain('抖音：从老板复购痛点切入。');
  });
});

describe('OpportunityWriter.write', () => {
  it('parses a valid JSON response into a WrittenOpportunity', async () => {
    const client = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: JSON.stringify(writerArticle) } }],
          }),
        },
      },
    };

    const writer = new OpportunityWriter(config, client as never);

    await expect(writer.write('Overseas CRM', 'Bakery workflow')).resolves.toEqual(writerArticle);
  });

  it('throws when the model returns empty content', async () => {
    const client = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: '' } }],
          }),
        },
      },
    };

    const writer = new OpportunityWriter(config, client as never);

    await expect(writer.write('Overseas CRM', 'Bakery workflow')).rejects.toThrow('OpenAI returned empty content');
  });

  it('throws when the model returns invalid structure', async () => {
    const client = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: JSON.stringify({ title: 'missing fields' }) } }],
          }),
        },
      },
    };

    const writer = new OpportunityWriter(config, client as never);

    await expect(writer.write('Overseas CRM', 'Bakery workflow')).rejects.toThrow();
  });
});


