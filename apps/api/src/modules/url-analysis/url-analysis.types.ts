import type {
  UrlAnalysisSourceType,
  UrlAnalysisStatus,
  UrlAnalysisVariantType
} from "@prisma/client";

export type AnalyzeVideoUrlInput = {
  tenantId?: string;
  workspaceId?: string;
  brandId?: string;
  url: string;
  analysisGoal: string;
  analysisMode?: string;
  targetAudience?: string;
  desiredTone?: string;
  desiredLengthSeconds: 15 | 30;
  focusKeywords: string[];
};

export type SourceMetadata = {
  sourceUrl: string;
  sourceHost: string;
  sourceType: UrlAnalysisSourceType;
  sourceTitle: string | null;
  sourceDescription: string | null;
  sourceImage: string | null;
  confidence: number;
};

export type HighlightMoment = {
  title: string;
  reason: string;
  visualSuggestion: string;
  startHint: string;
  endHint: string;
  quote?: string | null;
};

export type CutSuggestion = {
  title: string;
  description: string;
  startHint: string;
  endHint: string;
  angle: string;
};

export type UrlAnalysisVariantPayload = {
  title?: string;
  copy?: string;
  hook?: string;
  middle?: string;
  cta?: string;
  rationale?: string;
  angle?: string;
  structure?: string[];
  titleHint?: string;
  reason?: string;
  visualSuggestion?: string;
  startHint?: string;
  endHint?: string;
};

export type UrlAnalysisVariant = {
  id: string;
  variantType: UrlAnalysisVariantType;
  variantIndex: number;
  title: string | null;
  previewText: string;
  payload: UrlAnalysisVariantPayload;
  hashtags: string[];
  platforms: string[];
};

export type UrlAnalysisResult = {
  id: string;
  requestId: string;
  status: UrlAnalysisStatus;
  sourceUrl: string;
  sourceHost: string;
  sourceType: UrlAnalysisSourceType;
  sourceTitle: string | null;
  sourceDescription: string | null;
  analysisGoal: string;
  analysisMode: string | null;
  targetAudience: string | null;
  desiredTone: string | null;
  desiredLengthSeconds: number;
  focusKeywords: string[];
  topic: string;
  summary: string;
  keyTakeaways: string[];
  highlightMoments: HighlightMoment[];
  suggestedCuts: CutSuggestion[];
  recommendedPlatforms: string[];
  recommendedLengthSeconds: number;
  recommendedHook: string;
  recommendedCTA: string;
  confidenceScore: number;
  variants: UrlAnalysisVariant[];
  createdAt: string;
  updatedAt: string;
};

export type UrlAnalysisListItem = {
  id: string;
  sourceUrl: string;
  sourceHost: string;
  sourceType: UrlAnalysisSourceType;
  sourceTitle: string | null;
  analysisGoal: string;
  analysisMode: string | null;
  status: UrlAnalysisStatus;
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
};

export type UrlVerificationResult = {
  verified: boolean;
  normalizedUrl: string;
  sourceUrl: string;
  sourceHost: string;
  sourceType: UrlAnalysisSourceType;
  sourceTitle: string | null;
  sourceDescription: string | null;
  sourceImage: string | null;
  confidence: number;
  message: string;
};
