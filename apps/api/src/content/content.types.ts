import { ContentStyle, ContentVariantType } from "@prisma/client";

export interface GenerateContentInput {
  productName: string;
  productDescription: string;
  targetAudience: string;
  priceRange?: string | null;
  usageScenario?: string | null;
  keywords: string[];
  requestedStyle: ContentStyle;
}

export interface ContentVariantPayload {
  title?: string;
  copy?: string;
  hook?: string;
  middle?: string;
  cta?: string;
  rationale?: string;
  angle?: string;
  structure?: string[];
}

export interface GeneratedVariantResult {
  variantType: ContentVariantType;
  variantIndex: number;
  title?: string;
  previewText: string;
  payload: ContentVariantPayload;
  hashtags: string[];
  platforms: string[];
}

export interface GeneratedContentResult {
  resolvedStyle: ContentStyle;
  summary: string;
  titles: GeneratedVariantResult[];
  posts: GeneratedVariantResult[];
  scripts: GeneratedVariantResult[];
  variants: GeneratedVariantResult[];
}

export interface HistoryVariant {
  id: string;
  variantType: ContentVariantType;
  variantIndex: number;
  title: string | null;
  previewText: string;
  payload: ContentVariantPayload;
  hashtags: string[];
  platforms: string[];
  createdAt: Date;
}

export interface HistoryItem {
  id: string;
  resolvedStyle: ContentStyle;
  summary: string;
  titleCount: number;
  postCount: number;
  scriptCount: number;
  createdAt: Date;
  request: {
    id: string;
    productName: string;
    productDescription: string;
    targetAudience: string;
    priceRange: string | null;
    usageScenario: string | null;
    keywords: string[];
    requestedStyle: ContentStyle;
    createdAt: Date;
  };
  titles: HistoryVariant[];
  posts: HistoryVariant[];
  scripts: HistoryVariant[];
}
