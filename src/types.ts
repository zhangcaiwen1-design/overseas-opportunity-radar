export type SourceName = 'github' | 'hackernews' | 'reddit' | 'rss' | 'sample';

export interface OpportunitySignal {
  id: string;
  source: SourceName;
  title: string;
  summary: string;
  url: string;
  canonicalUrl: string;
  publishedAt: string;
  tags: string[];
  rawScore: number;
}

export interface OpportunityScore {
  demand: number;
  localization: number;
  monetization: number;
  buildability: number;
  contentability: number;
  competition: number;
  total: number;
}

export type VideoScene =
  | { type: 'intro'; title: string }
  | { type: 'opportunity'; title: string }
  | { type: 'outro'; title: string };

export type OpportunityProjectType =
  | 'tool-enhancement'
  | 'workflow-collaboration'
  | 'business-frontend'
  | 'capability-foundation';

export interface WrittenOpportunityImage {
  path: string;
  alt: string;
}

export interface OpportunityContentAngle {
  channel: 'wechat-article' | 'douyin';
  angle: string;
}

export interface OpportunityValidationStep {
  title: string;
  detail: string;
}

export interface WrittenOpportunity {
  slug: string;
  title: string;
  overseasSignal: string;
  whyNow: string;
  localizationPath: string;
  monetizationPaths: string[];
  validationPath: string;
  targetProfiles: string[];
  douyinSummary: string;
  materialImage?: WrittenOpportunityImage;
  collageImages?: WrittenOpportunityImage[];
}

export interface SelectedHeroImageAsset {
  prompt: string;
  imagePath?: string;
  status: 'generated' | 'skipped' | 'failed';
}

export interface SelectedWrittenOpportunity {
  slug: string;
  title: string;
  sourceLabel: string;
  projectType: OpportunityProjectType;
  oneLiner: string;
  projectIntro: string;
  operationModel: string[];
  whyItMatters: string[];
  chinaAdaptation: string[];
  monetizationExecution: string[];
  contentAngles: OpportunityContentAngle[];
  validationSteps?: OpportunityValidationStep[];
  heroImage?: SelectedHeroImageAsset;
  materialImage?: WrittenOpportunityImage;
  collageImages?: WrittenOpportunityImage[];
}

export interface SourceAdapter {
  fetchSignals(): Promise<OpportunitySignal[]>;
}
