import { Injectable, Logger } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AiProviderBindingsService } from "../../core/ai/ai-provider-bindings.service";

export interface GeminiImageResult {
  title: string;
  prompt: string;
  localPath: string;
  model: string;
}

@Injectable()
export class GeminiImageGenerationService {
  private readonly logger = new Logger(GeminiImageGenerationService.name);

  constructor(private readonly providerBindings: AiProviderBindingsService) {}

  async isConfigured(scopeKey = "GLOBAL") {
    const provider = await this.providerBindings.resolveApiKey(scopeKey, "GEMINI");
    return Boolean(provider);
  }

  async generatePortraitImage(prompt: string, outputDir: string, scopeKey = "GLOBAL"): Promise<GeminiImageResult | null> {
    const binding = await this.providerBindings.resolveApiKey(scopeKey, "GEMINI");
    if (!binding) {
      this.logger.warn("Gemini API key is not configured. Skipping Gemini image generation.");
      return null;
    }

    await mkdir(outputDir, { recursive: true });
    const localPath = path.join(outputDir, `${randomUUID()}.png`);
    const model = binding.model || "gemini-2.5-flash-image";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(binding.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${prompt}。請只輸出一張符合 9:16 直式短影音封面的高品質影像，避免過多文字。`
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini image generation failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inlineData?: {
              mimeType?: string;
              data?: string;
            };
          }>;
        };
      }>;
    };

    const inlineImage = payload.candidates?.[0]?.content?.parts?.find((part) => Boolean(part.inlineData?.data))?.inlineData?.data;

    if (!inlineImage) {
      throw new Error("Gemini image generation response did not contain image data.");
    }

    await writeFile(localPath, Buffer.from(inlineImage, "base64"));
    return {
      title: "Gemini 生成圖",
      prompt,
      localPath,
      model
    };
  }
}
