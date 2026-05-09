import type { SelectedWrittenOpportunity } from '../types';

function projectSceneCue(projectType: SelectedWrittenOpportunity['projectType']) {
  switch (projectType) {
    case 'tool-enhancement':
      return 'single-operator workspace, focused screen, efficient task flow';
    case 'workflow-collaboration':
      return 'workflow collaboration scene, multiple roles, task handoff, desk materials';
    case 'business-frontend':
      return 'customer-facing business scene, store counter, service handoff, local commerce';
    case 'capability-foundation':
      return 'operations control desk, system orchestration, business infrastructure scene';
  }
}

export function buildFeaturedImageBrief(article: SelectedWrittenOpportunity): string {
  return [
    'premium commercial magazine cover',
    'warm, trustworthy, realistic business atmosphere',
    projectSceneCue(article.projectType),
    `story theme: ${article.oneLiner}`,
    `business opportunity: ${article.title}`,
    'avoid dark luxury metallic palettes, cyberpunk, glossy sci-fi, cheap ai aesthetic',
  ].join(', ');
}
