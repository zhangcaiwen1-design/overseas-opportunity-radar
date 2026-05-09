export function buildOpportunityPrompt(title: string, summary: string): string {
  return [
    '你是一名面向中国市场的机会分析助手。',
    '请基于以下海外机会，输出适合中国本土落地的分析与执行建议。',
    `标题：${title}`,
    `摘要：${summary}`,
    '请只输出 JSON，不要输出多余解释。',
    'JSON 字段必须包含：slug, title, overseasSignal, whyNow, localizationPath, monetizationPaths, validationPath, targetProfiles, douyinSummary。',
    '要求：',
    '- slug 使用英文小写短横线。',
    '- monetizationPaths 和 targetProfiles 必须是字符串数组。',
    '- 内容要突出中国本地化、变现路径和最小验证动作。',
  ].join('\n');
}
