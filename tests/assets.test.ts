import { describe, expect, it } from 'vitest';
import { buildFeaturedImageBrief } from '../src/assets/buildFeaturedImageBrief';
import type { SelectedWrittenOpportunity } from '../src/types';

const baseArticle: SelectedWrittenOpportunity = {
  slug: 'agent-operating-framework',
  title: '协作流程机会：m9751/agent-operating-framework',
  sourceLabel: 'GitHub 项目',
  projectType: 'workflow-collaboration',
  oneLiner: '这是一个偏工作流协作型的项目。',
  projectIntro: '它更像流程框架，不是单功能工具。',
  operationModel: ['先给目标。', '再分工执行。'],
  whyItMatters: ['社区里已经出现真实需求。'],
  chinaAdaptation: ['优先接企微和飞书。'],
  monetizationExecution: ['先卖流程代搭建。'],
  contentAngles: [{ channel: 'wechat-article', angle: '从协作模式切入。' }],
};

describe('buildFeaturedImageBrief', () => {
  it('builds a premium magazine-style prompt for selected hero images', () => {
    const brief = buildFeaturedImageBrief(baseArticle);

    expect(brief).toContain('premium commercial magazine cover');
    expect(brief).toContain('workflow collaboration scene');
    expect(brief).toContain('warm, trustworthy, realistic business atmosphere');
    expect(brief).not.toContain('black-gold');
  });

  it('changes the scene cue for business-frontend projects', () => {
    const brief = buildFeaturedImageBrief({
      ...baseArticle,
      projectType: 'business-frontend',
      title: '前台生意机会：custom-furniture quote desk',
    });

    expect(brief).toContain('customer-facing business scene');
    expect(brief).not.toContain('workflow collaboration scene');
  });
});
