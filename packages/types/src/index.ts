export type ApiEnvelope<T> = {
  data: T;
  meta?: ApiMeta;
};

export type ApiMeta = {
  requestId?: string;
  timestamp?: string;
  pagination?: PaginationMeta;
};

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DomainModuleName =
  | "content"
  | "video"
  | "publishing"
  | "analytics"
  | "funnel"
  | "crm"
  | "chat"
  | "ai"
  | "auth"
  | "users"
  | "workspace"
  | "integrations"
  | "queue"
  | "scheduler";

export type WorkspaceRole = "owner" | "admin" | "editor" | "analyst" | "support";

export type DomainEvent<TPayload = Record<string, unknown>> = {
  name: string;
  workspaceId?: string;
  brandId?: string;
  payload: TPayload;
  occurredAt: string;
};

export type AnalyticsInsight = {
  label: string;
  value: string | number;
  confidence?: number;
};

export type OptimizationRuleSnapshot = {
  id: string;
  ruleKey: string;
  targetModule: DomainModuleName;
  ruleType: string;
  description: string;
  score: number;
  active: boolean;
};

export type OptimizationContext = {
  bestHookPatterns: string[];
  bestCtaPatterns: string[];
  bestPublishWindows: string[];
  preferredTone?: string;
  preferredStyle?: string;
  preferredLengthSeconds?: number;
  winningKeywords: string[];
  rules: OptimizationRuleSnapshot[];
};

export type AnalyticsSuggestion = {
  title: string;
  reason: string;
  action: string;
  target: DomainModuleName;
  confidence: number;
};
