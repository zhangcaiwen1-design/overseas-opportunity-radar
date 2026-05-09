export type RunTriggerType = 'cron' | 'manual';
export type RunStatus = 'running' | 'completed' | 'failed';
export type SelectionState = 'pending' | 'selected' | 'discarded';
export type PushChannel = 'feishu' | 'wecom' | 'wxpusher';
export type CloudPublicationChannel = 'site' | 'wechat' | 'douyin';
export type CloudContentVariantStatus = 'draft' | 'reviewed' | 'published' | 'failed';
export type CloudPublicationAction = 'publish' | 'retry' | 'withdraw';
export type CloudLeadEventType = 'subscribe' | 'consult';

export interface CloudRun {
  id: string;
  dateKey: string;
  triggerType: RunTriggerType;
  status: RunStatus;
  summaryText?: string;
  errorMessage?: string;
  startedAt?: string;
}

export interface CloudPushLog {
  runId: string;
  channel: PushChannel;
  status: 'success' | 'failed';
  responseSummary: string;
  pushedAt?: string;
}

export interface CreateRunInput {
  dateKey: string;
  triggerType: RunTriggerType;
}

export interface CloudCandidate {
  id: string;
  title: string;
  source: string;
  summary: string;
  rank: number;
  draftSortOrder?: number;
  selectionState: SelectionState;
  tags: string[];
  canonicalUrl: string;
}

export interface CloudSelectedItem {
  id: string;
  candidateId?: string;
  slug?: string;
  title: string;
  status: string;
}

export interface CloudArtifactLink {
  artifactType: string;
  publicUrl: string;
  storagePath?: string;
  selectedItemId?: string;
}

export interface CloudPushConfig {
  channel: PushChannel;
  enabled: boolean;
  secretPayload: string;
}

export interface CloudContentVariant {
  id: string;
  runId: string;
  candidateId?: string;
  selectedItemId?: string;
  channel: CloudPublicationChannel;
  title: string;
  body: string;
  status: CloudContentVariantStatus;
  publishedAt?: string;
  reviewNotes: string;
}

export interface CloudPublicationLog {
  id: string;
  contentVariantId: string;
  channel: CloudPublicationChannel;
  action: CloudPublicationAction;
  status: string;
  responseSummary: string;
  operator: string;
  createdAt?: string;
}

export interface CloudLeadEvent {
  id: string;
  sourceChannel: CloudPublicationChannel;
  pageType: string;
  eventType: CloudLeadEventType;
  contact: string;
  notes: string;
  createdAt?: string;
}
