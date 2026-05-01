export type LeadSourcePlatform = "IG" | "FB" | "THREADS" | "YOUTUBE" | "DIRECT" | "UNKNOWN";
export type LandingPageStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type FollowUpChannel = "LINE" | "EMAIL" | "WEBHOOK";
export type LeadStatus = "NEW" | "CONTACTED" | "NEGOTIATING" | "WON" | "LOST";
export type DealStatus = "NEW" | "CONTACTED" | "NEGOTIATING" | "WON" | "LOST";

export type TrackingLinkInput = {
  workspaceId: string;
  brandId?: string;
  productId?: string;
  contentId?: string;
  videoId?: string;
  landingPageId?: string;
  destinationUrl: string;
  sourcePlatform: LeadSourcePlatform;
  campaignName?: string;
  code?: string;
  shortPath?: string;
  metadata?: Record<string, unknown>;
};

export type ClickTrackingInput = {
  code: string;
  sourcePlatform: LeadSourcePlatform;
  device?: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  country?: string;
  metadata?: Record<string, unknown>;
};

export type LeadFormInput = {
  workspaceId: string;
  brandId?: string;
  productId?: string;
  landingPageId?: string;
  trackingLinkId?: string;
  name: string;
  email?: string;
  phone?: string;
  lineId?: string;
  sourcePlatform: LeadSourcePlatform;
  notes?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export type LeadFollowUpTemplateInput = {
  workspaceId: string;
  brandId?: string;
  templateKey: string;
  channel: FollowUpChannel;
  name: string;
  subject?: string;
  body: string;
  triggerEvent: string;
  delayMinutes?: number;
  metadata?: Record<string, unknown>;
};

export type LandingPagePayload = {
  id: string;
  slug: string;
  variantKey: string;
  status: LandingPageStatus;
  title: string;
  heroTitle: string;
  heroSubtitle: string;
  painPoints: string[];
  benefits: string[];
  ctaLabel: string;
  formFields: string[];
  sections: unknown;
  metadata: unknown;
};

export type FunnelDashboardSnapshot = {
  clicks: number;
  leads: number;
  wonDeals: number;
  leadConversionRate: number;
  dealConversionRate: number;
  topSources: Array<{ sourcePlatform: LeadSourcePlatform; clicks: number; leads: number; wonDeals: number }>;
  funnelStages: Array<{ stage: string; count: number }>;
  ctaSuggestions: Array<{ label: string; reason: string; confidence: number }>;
};

export type DealStatusUpdateInput = {
  status: DealStatus;
  notes?: string;
  stageOrder?: number;
  amount?: number;
  currency?: string;
};

export type LeadStatusUpdateInput = {
  status: LeadStatus;
  notes?: string;
  tags?: string[];
};
