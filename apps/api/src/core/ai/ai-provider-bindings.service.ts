import { BadRequestException, Injectable } from "@nestjs/common";
import { AiProviderType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TokenEncryptionService } from "../../shared/token-encryption.service";
import { AiProviderBindingSummary, SaveAiProviderBindingInput } from "./ai-provider-bindings.types";

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";

@Injectable()
export class AiProviderBindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenEncryption: TokenEncryptionService
  ) {}

  async listBindings(scopeKey = "GLOBAL"): Promise<AiProviderBindingSummary[]> {
    const rows = await this.prisma.aiProviderBinding.findMany({
      where: { scopeKey },
      orderBy: [{ provider: "asc" }]
    });

    const existing = new Map(rows.map((row) => [row.provider, row]));
    const providers: AiProviderType[] = [AiProviderType.OPENAI, AiProviderType.GEMINI];

    return providers.map((provider) => {
      const binding = existing.get(provider) ?? null;
      const envConfigured = this.hasFallbackEnv(provider);
      const source = binding ? "DATABASE" : envConfigured ? "ENV" : "NONE";
      const status = binding ? (binding.isActive ? "READY" : "DISABLED") : envConfigured ? "READY" : "NEEDS_CONFIG";

      return {
        id: binding?.id ?? `${scopeKey}:${provider}`,
        scopeKey,
        provider,
        label: binding?.label ?? this.defaultLabel(provider),
        apiBaseUrl: binding?.apiBaseUrl ?? this.defaultApiBaseUrl(provider),
        defaultModel: binding?.defaultModel ?? this.defaultModel(provider),
        isActive: binding ? binding.isActive : envConfigured,
        apiKeyLast4: binding?.apiKeyLast4 ?? this.envApiKeyLast4(provider),
        lastVerifiedAt: binding?.lastVerifiedAt?.toISOString() ?? null,
        lastError: binding?.lastError ?? null,
        source,
        status,
        metadata: this.extractMetadata(binding?.metadata)
      };
    });
  }

  async saveBinding(input: SaveAiProviderBindingInput) {
    const provider = this.normalizeProvider(input.provider);
    const scopeKey = input.scopeKey?.trim() || "GLOBAL";
    const apiKey = input.apiKey.trim();
    if (!apiKey) {
      throw new BadRequestException("API key is required");
    }

    const row = await this.prisma.aiProviderBinding.upsert({
      where: {
        scopeKey_provider: {
          scopeKey,
          provider
        }
      },
      create: {
        scopeKey,
        provider,
        label: input.label?.trim() || this.defaultLabel(provider),
        apiKeyEncrypted: this.tokenEncryption.encrypt(apiKey),
        apiKeyLast4: apiKey.slice(-4),
        apiBaseUrl: input.apiBaseUrl?.trim() || this.defaultApiBaseUrl(provider),
        defaultModel: input.defaultModel?.trim() || this.defaultModel(provider),
        isActive: true,
        metadata: this.buildMetadata(provider, input)
      },
      update: {
        label: input.label?.trim() || this.defaultLabel(provider),
        apiKeyEncrypted: this.tokenEncryption.encrypt(apiKey),
        apiKeyLast4: apiKey.slice(-4),
        apiBaseUrl: input.apiBaseUrl?.trim() || this.defaultApiBaseUrl(provider),
        defaultModel: input.defaultModel?.trim() || this.defaultModel(provider),
        isActive: true,
        lastError: null,
        metadata: this.buildMetadata(provider, input)
      }
    });

    return this.toSummary(row, scopeKey);
  }

  async testBinding(scopeKey: string, providerName: string) {
    const provider = this.normalizeProvider(providerName);
    const binding = await this.prisma.aiProviderBinding.findUnique({
      where: {
        scopeKey_provider: {
          scopeKey: scopeKey.trim() || "GLOBAL",
          provider
        }
      }
    });

    if (!binding) {
      throw new BadRequestException("AI provider binding not found");
    }

    const apiKey = this.tokenEncryption.decrypt(binding.apiKeyEncrypted);
    const verification = provider === AiProviderType.OPENAI ? await this.verifyOpenAi(apiKey) : await this.verifyGemini(apiKey);

    const updated = await this.prisma.aiProviderBinding.update({
      where: { id: binding.id },
      data: {
        lastVerifiedAt: new Date(),
        lastError: null,
        metadata: {
          ...(this.extractMetadata(binding.metadata) ?? {}),
          verification
        }
      }
    });

    return this.toSummary(updated, scopeKey);
  }

  async disconnect(scopeKey: string, providerName: string) {
    const provider = this.normalizeProvider(providerName);
    const binding = await this.prisma.aiProviderBinding.findUnique({
      where: {
        scopeKey_provider: {
          scopeKey: scopeKey.trim() || "GLOBAL",
          provider
        }
      }
    });

    if (!binding) {
      return { deleted: true, provider, scopeKey };
    }

    await this.prisma.aiProviderBinding.delete({
      where: { id: binding.id }
    });

    return {
      deleted: true,
      provider,
      scopeKey
    };
  }

  async setBindingActive(scopeKey: string, providerName: string, isActive: boolean) {
    const provider = this.normalizeProvider(providerName);
    const normalizedScopeKey = scopeKey.trim() || "GLOBAL";
    const existing = await this.prisma.aiProviderBinding.findUnique({
      where: {
        scopeKey_provider: {
          scopeKey: normalizedScopeKey,
          provider
        }
      }
    });

    if (existing) {
      const updated = await this.prisma.aiProviderBinding.update({
        where: { id: existing.id },
        data: {
          isActive,
          lastError: null
        }
      });

      return this.toSummary(updated, normalizedScopeKey);
    }

    const fallback = this.loadFallbackConfig(provider);
    if (!fallback) {
      throw new BadRequestException("AI provider binding not found");
    }

    const created = await this.prisma.aiProviderBinding.create({
      data: {
        scopeKey: normalizedScopeKey,
        provider,
        label: fallback.label,
        apiKeyEncrypted: this.tokenEncryption.encrypt(fallback.apiKey),
        apiKeyLast4: fallback.apiKey.slice(-4),
        apiBaseUrl: fallback.apiBaseUrl,
        defaultModel: fallback.defaultModel,
        isActive,
        lastError: null,
        metadata: {
          provider,
          scopeKey: normalizedScopeKey,
          updatedFrom: "video-studio-toggle",
          configuredAt: new Date().toISOString(),
          source: fallback.source
        } as Prisma.InputJsonValue
      }
    });

    return this.toSummary(created, normalizedScopeKey);
  }

  async resolveApiKey(scopeKey = "GLOBAL", providerName?: string) {
    const preferred = providerName ? this.normalizeProvider(providerName) : null;
    const candidates: AiProviderType[] = preferred ? [preferred] : [AiProviderType.OPENAI, AiProviderType.GEMINI];

    for (const provider of candidates) {
      const binding = await this.prisma.aiProviderBinding.findUnique({
        where: {
          scopeKey_provider: {
            scopeKey,
            provider
          }
        }
      });

      if (binding) {
        if (!binding.isActive) {
          continue;
        }

        return {
          provider,
          model: binding.defaultModel ?? this.defaultModel(provider),
          apiBaseUrl: binding.apiBaseUrl ?? this.defaultApiBaseUrl(provider),
          apiKey: this.tokenEncryption.decrypt(binding.apiKeyEncrypted),
          source: "DATABASE" as const
        };
      }
    }

    if (!preferred || preferred === AiProviderType.OPENAI) {
      const openAiKey = process.env.OPENAI_API_KEY?.trim();
      if (openAiKey) {
        return {
          provider: AiProviderType.OPENAI,
          model: process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
          apiBaseUrl: this.defaultApiBaseUrl(AiProviderType.OPENAI),
          apiKey: openAiKey,
          source: "ENV" as const
        };
      }
    }

    if (!preferred || preferred === AiProviderType.GEMINI) {
      const geminiKey = process.env.GEMINI_API_KEY?.trim();
      if (geminiKey) {
        return {
          provider: AiProviderType.GEMINI,
          model: process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
          apiBaseUrl: this.defaultApiBaseUrl(AiProviderType.GEMINI),
          apiKey: geminiKey,
          source: "ENV" as const
        };
      }
    }

    return null;
  }

  private async verifyOpenAi(apiKey: string) {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new BadRequestException(`OpenAI verification failed: ${response.status}`);
    }

    return {
      provider: "OPENAI",
      verifiedAt: new Date().toISOString()
    };
  }

  private async verifyGemini(apiKey: string) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (!response.ok) {
      throw new BadRequestException(`Gemini verification failed: ${response.status}`);
    }

    return {
      provider: "GEMINI",
      verifiedAt: new Date().toISOString()
    };
  }

  private toSummary(row: {
    id: string;
    scopeKey: string;
    provider: AiProviderType;
    label: string | null;
    apiBaseUrl: string | null;
    defaultModel: string | null;
    isActive: boolean;
    apiKeyLast4: string;
    lastVerifiedAt: Date | null;
    lastError: string | null;
    metadata: Prisma.JsonValue | null;
  }, scopeKey = row.scopeKey): AiProviderBindingSummary {
    return {
      id: row.id,
      scopeKey,
      provider: row.provider,
      label: row.label ?? this.defaultLabel(row.provider),
      apiBaseUrl: row.apiBaseUrl,
      defaultModel: row.defaultModel,
      isActive: row.isActive,
      apiKeyLast4: row.apiKeyLast4,
      lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
      lastError: row.lastError,
      source: "DATABASE",
      status: row.isActive ? "READY" : "DISABLED",
      metadata: this.extractMetadata(row.metadata)
    };
  }

  private normalizeProvider(value: string) {
    const upper = value.toUpperCase();
    if (upper !== "OPENAI" && upper !== "GEMINI") {
      throw new BadRequestException(`Unsupported AI provider: ${value}`);
    }

    return upper as AiProviderType;
  }

  private defaultLabel(provider: AiProviderType) {
    return provider === AiProviderType.OPENAI ? "OpenAI" : "Gemini";
  }

  private defaultModel(provider: AiProviderType) {
    return provider === AiProviderType.OPENAI ? DEFAULT_OPENAI_MODEL : DEFAULT_GEMINI_MODEL;
  }

  private defaultApiBaseUrl(provider: AiProviderType) {
    return provider === AiProviderType.OPENAI ? "https://api.openai.com" : "https://generativelanguage.googleapis.com";
  }

  private hasFallbackEnv(provider: AiProviderType) {
    return provider === AiProviderType.OPENAI ? Boolean(process.env.OPENAI_API_KEY?.trim()) : Boolean(process.env.GEMINI_API_KEY?.trim());
  }

  private loadFallbackConfig(provider: AiProviderType) {
    const apiKey = provider === AiProviderType.OPENAI ? process.env.OPENAI_API_KEY?.trim() : process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return null;
    }

    return {
      apiKey,
      label: this.defaultLabel(provider),
      apiBaseUrl: this.defaultApiBaseUrl(provider),
      defaultModel: this.defaultModel(provider),
      source: "ENV" as const
    };
  }

  private envApiKeyLast4(provider: AiProviderType) {
    const key = provider === AiProviderType.OPENAI ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
    return key?.trim() ? key.trim().slice(-4) : null;
  }

  private buildMetadata(provider: AiProviderType, input: SaveAiProviderBindingInput) {
    return {
      provider,
      scopeKey: input.scopeKey?.trim() || "GLOBAL",
      updatedFrom: "video-studio",
      configuredAt: new Date().toISOString()
    } as Prisma.InputJsonValue;
  }

  private extractMetadata(metadata: Prisma.JsonValue | null | undefined) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return null;
    }

    return metadata as Record<string, unknown>;
  }
}
