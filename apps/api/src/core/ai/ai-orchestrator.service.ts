import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { AiProviderType } from "@prisma/client";
import type { DomainModuleName, OptimizationContext } from "@ai-vidio/types";
import { AiProviderBindingsService } from "./ai-provider-bindings.service";

export type AiOrchestrationRequest<TInput = unknown> = {
  module: DomainModuleName;
  workspaceId?: string;
  brandId?: string;
  input: TInput;
  prompt?: string;
  systemPrompt?: string;
  style?: string;
  tone?: string;
  responseFormat?: "text" | "json";
  provider?: AiProviderType;
  optimizationContext?: OptimizationContext;
  budget?: {
    maxTokens?: number;
    maxCostUsd?: number;
  };
};

export type AiOrchestrationResult<TOutput = unknown> = {
  module: DomainModuleName;
  output: TOutput;
  provider: string;
  model: string;
  costUsd: number;
  promptVersion: string;
  createdAt: string;
};

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(private readonly providerBindings: AiProviderBindingsService) {}

  async generate<TInput, TOutput>(request: AiOrchestrationRequest<TInput>): Promise<AiOrchestrationResult<TOutput>> {
    const scopeKey = request.workspaceId ?? "GLOBAL";
    const binding = await this.providerBindings.resolveApiKey(scopeKey, request.provider);
    if (!binding) {
      throw new BadRequestException("AI provider is not configured");
    }

    const responseFormat = request.responseFormat ?? (request.module === "chat" ? "text" : "json");
    const prompt = request.prompt?.trim() || this.buildFallbackPrompt(request);
    const systemPrompt = request.systemPrompt?.trim() || this.buildSystemPrompt(request);
    const model = this.resolveTextModel(binding.provider, binding.model);
    const createdAt = new Date();

    try {
      const output =
        binding.provider === AiProviderType.OPENAI
          ? await this.generateWithOpenAi<TOutput>(binding.apiBaseUrl, binding.apiKey, model, systemPrompt, prompt, responseFormat)
          : await this.generateWithGemini<TOutput>(binding.apiBaseUrl, binding.apiKey, model, systemPrompt, prompt, responseFormat);

      return {
        module: request.module,
        output,
        provider: binding.provider,
        model,
        costUsd: 0,
        promptVersion: this.buildPromptVersion(request),
        createdAt: createdAt.toISOString()
      };
    } catch (error) {
      this.logger.error(`AI generation failed for ${request.module}: ${(error as Error).message}`);
      throw error;
    }
  }

  private async generateWithOpenAi<TOutput>(
    apiBaseUrl: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    prompt: string,
    responseFormat: "text" | "json"
  ): Promise<TOutput> {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        ...(responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
        ...(responseFormat === "json" ? { max_tokens: 1800 } : { max_tokens: 1200 })
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI generation failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenAI response did not contain content");
    }

    return this.parseOutput<TOutput>(content, responseFormat);
  }

  private async generateWithGemini<TOutput>(
    apiBaseUrl: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    prompt: string,
    responseFormat: "text" | "json"
  ): Promise<TOutput> {
    const response = await fetch(
      `${apiBaseUrl.replace(/\/$/, "")}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `${systemPrompt}\n\n${prompt}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.5,
            ...(responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
            ...(responseFormat === "json" ? { maxOutputTokens: 1800 } : { maxOutputTokens: 1200 })
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini generation failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const content =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!content) {
      throw new Error("Gemini response did not contain content");
    }

    return this.parseOutput<TOutput>(content, responseFormat);
  }

  private parseOutput<TOutput>(content: string, responseFormat: "text" | "json"): TOutput {
    if (responseFormat === "text") {
      return content as TOutput;
    }

    const cleaned = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error(`AI response is not valid JSON: ${cleaned.slice(0, 250)}`);
    }

    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as TOutput;
  }

  private buildSystemPrompt(request: AiOrchestrationRequest<unknown>) {
    const tone = request.tone?.trim();
    const style = request.style?.trim();

    if (request.module === "chat") {
      return [
        "你是 AI-VIDIO 的客服成交助手。",
        "請用繁體中文、自然短句、像真人一樣回覆。",
        "優先根據知識庫與對話上下文回答，避免亂編。",
        "回答要有同理心，必要時引導到下一步行動。",
        tone ? `語氣：${tone}` : null,
        style ? `風格：${style}` : null
      ]
        .filter(Boolean)
        .join("\n");
    }

    return [
      "你是 AI-VIDIO 的內容分析與轉換策略引擎。",
      "請用繁體中文回答。",
      "如果要求 JSON，請嚴格輸出可被 JSON.parse 解析的純 JSON，不要加 markdown 或額外說明。",
      tone ? `語氣：${tone}` : null,
      style ? `風格：${style}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  private buildFallbackPrompt(request: AiOrchestrationRequest<unknown>) {
    if (request.module === "chat") {
      return `請根據下列資料，產生一則可直接回覆使用者的訊息。\n\n${JSON.stringify(request.input, null, 2)}`;
    }

    return `請根據下列資料完成任務，並輸出 JSON。\n\n${JSON.stringify(request.input, null, 2)}`;
  }

  private resolveTextModel(provider: AiProviderType, configuredModel: string) {
    const model = configuredModel?.trim();
    if (provider === AiProviderType.OPENAI) {
      if (model && !/image/i.test(model)) {
        return model;
      }

      return "gpt-4.1-mini";
    }

    if (model && !/image/i.test(model)) {
      return model;
    }

    return "gemini-2.5-flash";
  }

  private buildPromptVersion(request: AiOrchestrationRequest<unknown>) {
    const tone = request.tone?.trim() || "default";
    const style = request.style?.trim() || "default";
    const format = request.responseFormat ?? (request.module === "chat" ? "text" : "json");
    return `${request.module}:${tone}:${style}:${format}:v1`;
  }
}
