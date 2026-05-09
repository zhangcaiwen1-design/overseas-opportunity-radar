import type { SelectedWrittenOpportunity, WrittenOpportunityImage } from '../types';

function renderMarkdownImage(image: WrittenOpportunityImage): string {
  return `![${image.alt}](${image.path})`;
}

function renderBulletSection(title: string, items: string[]): string[] {
  return items.length > 0 ? [title, '', ...items.map((item) => `- ${item}`), ''] : [];
}

export function renderArticleMarkdown(article: SelectedWrittenOpportunity): string {
  return [
    `# ${article.title}`,
    '',
    `来源平台：${article.sourceLabel}`,
    '',
    ...(article.heroImage?.imagePath && article.heroImage.status === 'generated'
      ? ['## 主视觉', '', `![${article.title} 主视觉](${article.heroImage.imagePath})`, '']
      : []),
    ...(article.collageImages && article.collageImages.length > 0
      ? ['## 素材总览', '', ...article.collageImages.map(renderMarkdownImage), '']
      : []),
    '## 一句话介绍',
    article.oneLiner,
    '',
    '## 项目介绍',
    article.projectIntro,
    '',
    ...renderBulletSection('## 运作模式', article.operationModel),
    ...(article.materialImage ? ['## 来源素材', '', renderMarkdownImage(article.materialImage), ''] : []),
    ...renderBulletSection('## 为什么值得看', article.whyItMatters),
    ...renderBulletSection('## 国产化路径', article.chinaAdaptation),
    ...renderBulletSection('## 变现实操', article.monetizationExecution),
    ...renderBulletSection(
      '## 内容传播角度',
      article.contentAngles.map((item) => `${item.channel === 'wechat-article' ? '公众号' : '抖音'}：${item.angle}`),
    ),
    ...(article.validationSteps && article.validationSteps.length > 0
      ? ['## 验证步骤', '', ...article.validationSteps.map((step) => `- ${step.title}：${step.detail}`), '']
      : []),
  ].join('\n');
}
