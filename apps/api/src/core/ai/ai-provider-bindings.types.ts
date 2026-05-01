export type AiProviderName = "OPENAI" | "GEMINI";

export type AiProviderBindingSummary = {
  id: string;
  scopeKey: string;
  provider: AiProviderName;
  label: string;
  apiBaseUrl: string | null;
  defaultModel: string | null;
  isActive: boolean;
  apiKeyLast4: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  source: "DATABASE" | "ENV" | "NONE";
  status: "READY" | "NEEDS_CONFIG" | "ERROR" | "DISABLED";
  metadata: Record<string, unknown> | null;
};

export type SaveAiProviderBindingInput = {
  scopeKey?: string;
  provider: AiProviderName;
  apiKey: string;
  label?: string;
  apiBaseUrl?: string;
  defaultModel?: string;
};
