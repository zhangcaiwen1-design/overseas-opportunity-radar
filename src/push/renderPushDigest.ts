import type { SelectedWrittenOpportunity } from '../types';

interface PushDigestArtifact {
  slug: string;
  title: string;
  markdownPath: string;
  htmlPath: string;
  screenshotPath: string;
  materialPath?: string;
}

export interface PushDigestArticle {
  article: SelectedWrittenOpportunity;
  artifact: PushDigestArtifact;
}

function normalizeFilePath(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

function renderOpportunityCard(input: PushDigestArticle, index: number) {
  const { article, artifact } = input;

  return [
    '━━━━━━━━━━',
    `【机会 ${index + 1}】${article.title}`,
    '',
    `一句话机会：${article.oneLiner}`,
    `国产化落地：${article.chinaAdaptation[0] ?? '待补充'}`,
    `变现实操：${article.monetizationExecution[0] ?? '待补充'}`,
    '',
    '查看成稿：',
    `- HTML：${normalizeFilePath(artifact.htmlPath)}`,
    `- Markdown：${normalizeFilePath(artifact.markdownPath)}`,
    `- 预览图：${normalizeFilePath(artifact.screenshotPath)}`,
    ...(artifact.materialPath ? [`- 来源素材：${normalizeFilePath(artifact.materialPath)}`] : []),
    '',
  ];
}

export function renderPushDigest(input: {
  dateKey: string;
  poolCount: number;
  leadTitle: string;
  outputDir: string;
  selected: PushDigestArticle[];
}): string {
  return [
    `今日海外商业机会雷达｜${input.dateKey}`,
    `精选 ${input.selected.length} 条｜机会池 ${input.poolCount} 条`,
    `今日头条：${input.leadTitle}`,
    '',
    '先看标题，再按需点开成稿。',
    '',
    ...input.selected.flatMap(renderOpportunityCard),
    '━━━━━━━━━━',
    '本次输出目录：',
    normalizeFilePath(input.outputDir),
  ].join('\n');
}

export function buildPushSummary(input: { selectedCount: number; poolCount: number; leadTitle: string }) {
  return `今日海外机会精选 ${input.selectedCount} 条，机会池 ${input.poolCount} 条。头条：${input.leadTitle}`;
}
