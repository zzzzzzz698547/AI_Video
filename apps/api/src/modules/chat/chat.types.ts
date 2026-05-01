export type ChatTone = "professional" | "premium" | "friendly" | "sales";
export type ChatStyle = "professional" | "premium" | "friendly" | "high_conversion";

export type CustomerTemperature = "COLD" | "WARM" | "HOT";
export type SalesStage =
  | "NEW_INQUIRY"
  | "INFO_REQUESTED"
  | "CONSIDERING"
  | "PRICE_DISCUSSED"
  | "HIGH_INTENT"
  | "PAYMENT_PENDING"
  | "WON"
  | "LOST"
  | "AFTER_SALES";

export type RecommendedNextAction =
  | "ASK_CLARIFYING_QUESTION"
  | "SEND_PRICE_LIST"
  | "SEND_RECOMMENDATION_LIST"
  | "INVITE_TO_FORM"
  | "INVITE_TO_LINE"
  | "TRANSFER_TO_HUMAN"
  | "SEND_OFFER"
  | "AFTER_SALES_FOLLOW_UP";

export type IntentLabel =
  | "ASK_PRICE"
  | "ASK_SPEC"
  | "ASK_STOCK"
  | "ASK_INSTALLATION"
  | "ASK_PAYMENT"
  | "COMPARE_PRODUCTS"
  | "HIGH_BUY_INTENT"
  | "JUST_BROWSING"
  | "AFTER_SALES"
  | "COMPLAINT"
  | "UNKNOWN";

export type HandoffStatus = "NONE" | "REQUESTED" | "PENDING" | "ASSIGNED" | "RESOLVED";
export type HandoffReason = "HIGH_VALUE" | "COMPLAINT" | "UNCERTAIN_ANSWER" | "REQUESTED_BY_CUSTOMER" | "COMPLIANCE" | "MANUAL";
export type FollowUpRuleTrigger = "NO_REPLY" | "HOT_LEAD" | "FORM_SUBMITTED" | "PURCHASE_COMPLETED" | "AFTER_PURCHASE";
export type ChannelAdapterType =
  | "WEBSITE_CHAT"
  | "FACEBOOK_MESSENGER"
  | "INSTAGRAM_DM"
  | "LINE_OFFICIAL_ACCOUNT"
  | "COMMENT_TO_LEAD";
export type ChannelAdapterStatus = "ACTIVE" | "PAUSED" | "ERROR";
export type CommentLeadStatus = "NEW" | "REPLIED" | "DM_SENT" | "FORM_SENT" | "CONVERTED" | "IGNORED";
export type EscalationSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type MessageSender = "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";
export type KnowledgeArticleType = "FAQ" | "PRODUCT" | "POLICY" | "BRAND_TONE" | "PROHIBITED";

export type ChatMessageInput = {
  workspaceId: string;
  brandId?: string;
  leadId?: string;
  customerProfileId?: string;
  conversationId?: string;
  sessionId?: string;
  channel: string;
  message: string;
  tone?: ChatTone;
  style?: ChatStyle;
  sourcePlatform?: string;
  sourcePostId?: string;
  sourceCommentId?: string;
  externalMessageId?: string;
  customerName?: string;
  metadata?: Record<string, unknown>;
};

export type ChatReplyPayload = {
  conversationId: string;
  customerMessageId: string;
  assistantMessageId?: string;
  replyText: string;
  intent: {
    label: IntentLabel;
    confidence: number;
    reasoning: string;
  };
  leadScore: {
    score: number;
    temperature: CustomerTemperature;
    stage: SalesStage;
    recommendedNextAction: RecommendedNextAction;
    reason: string;
  };
  handoffRequired: boolean;
  handoffReason?: HandoffReason;
  nextAction: RecommendedNextAction;
  knowledge: {
    answer: string;
    articleIds: string[];
    faqIds: string[];
    guardrails: string[];
  };
};

export type ConversationListItem = {
  id: string;
  customerName?: string | null;
  channel: string;
  status: string;
  salesStage: SalesStage;
  leadScore: number | null;
  temperature: CustomerTemperature | null;
  handoffStatus: HandoffStatus;
  lastMessageAt: string | null;
  lastMessage?: string | null;
  sourcePlatform?: string | null;
  aiHandled: boolean;
  humanHandled: boolean;
};

export type ConversationDetailPayload = {
  conversation: unknown;
  messages: unknown[];
  customerProfile: unknown;
  lead: unknown;
  intentPredictions: unknown[];
  leadScores: unknown[];
  handoffLogs: unknown[];
  aiReplyLogs: unknown[];
  followUpJobs: unknown[];
};

export type KnowledgeBaseArticleInput = {
  workspaceId: string;
  brandId?: string;
  articleType?: KnowledgeArticleType;
  title: string;
  slug: string;
  summary?: string;
  content: string;
  keywords?: string[];
  isPublished?: boolean;
  metadata?: Record<string, unknown>;
  faqItems?: Array<{
    question: string;
    answer: string;
    keywords?: string[];
    sortOrder?: number;
  }>;
};

export type CommentLeadInput = {
  workspaceId: string;
  brandId?: string;
  contentId?: string;
  videoId?: string;
  postId: string;
  commentId: string;
  sourcePlatform: string;
  commenterName?: string;
  commentText: string;
  metadata?: Record<string, unknown>;
};

export type HandoffInput = {
  assignedToUserId?: string;
  reason?: HandoffReason;
  note?: string;
  severity?: EscalationSeverity;
};

export type FollowUpRunInput = {
  workspaceId: string;
  brandId?: string;
  conversationId?: string;
  leadId?: string;
  customerProfileId?: string;
};

export type FollowUpRuleInput = {
  workspaceId: string;
  brandId?: string;
  name: string;
  trigger: FollowUpRuleTrigger;
  delayMinutes?: number;
  channel: "LINE" | "EMAIL" | "WEBHOOK";
  templateTitle?: string;
  templateBody: string;
  conditions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type IntentClassification = {
  label: IntentLabel;
  confidence: number;
  reasoning: string;
  matchedKeywords: string[];
  signals: Record<string, unknown>;
};

export type LeadScoreSnapshot = {
  score: number;
  temperature: CustomerTemperature;
  stage: SalesStage;
  recommendedNextAction: RecommendedNextAction;
  reason: string;
  signals: Record<string, unknown>;
};

export type KnowledgeRetrievalResult = {
  answer: string;
  articleIds: string[];
  faqIds: string[];
  guardrails: string[];
  hints: string[];
};

