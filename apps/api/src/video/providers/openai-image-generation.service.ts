import { Injectable, Logger } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AiProviderBindingsService } from "../../core/ai/ai-provider-bindings.service";

export interface OpenAiImageResult {
  title: string;
  prompt: string;
  localPath: string;
  model: string;
}

@Injectable()
export class OpenAiImageGenerationService {
  private readonly logger = new Logger(OpenAiImageGenerationService.name);

  constructor(private readonly providerBindings: AiProviderBindingsService) {}

  async isConfigured(scopeKey = "GLOBAL") {
    const provider = await this.providerBindings.resolveApiKey(scopeKey, "OPENAI");
    return Boolean(provider);
  }

  async generatePortraitImage(prompt: string, outputDir: string, scopeKey = "GLOBAL"): Promise<OpenAiImageResult | null> {
    const binding = await this.providerBindings.resolveApiKey(scopeKey, "OPENAI");
    if (!binding) {
      this.logger.warn("OpenAI API key is not configured. Skipping OpenAI image generation.");
      return null;
    }

    await mkdir(outputDir, { recursive: true });
    const localPath = path.join(outputDir, `${randomUUID()}.png`);

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${binding.apiKey}`
      },
      body: JSON.stringify({
        model: binding.model || "gpt-image-2",
        prompt,
        size: "1024x1536",
        quality: "high",
        n: 1,
        response_format: "b64_json"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI image generation failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
      output?: Array<{
        type?: string;
        image?: { b64_json?: string; data?: string };
        content?: Array<{ type?: string; image_url?: string; b64_json?: string }>;
      }>;
    };

    const base64Image =
      payload.data?.[0]?.b64_json ??
      payload.output?.[0]?.image?.b64_json ??
      payload.output?.[0]?.image?.data ??
      payload.output?.[0]?.content?.find((part) => part.b64_json)?.b64_json ??
      payload.output?.[0]?.content?.find((part) => part.image_url?.startsWith("data:image"))?.image_url?.split(",")[1];

    const imageUrl =
      payload.data?.[0]?.url ??
      payload.output?.[0]?.content?.find((part) => part.image_url?.startsWith("http"))?.image_url;

    if (base64Image) {
      await writeFile(localPath, Buffer.from(base64Image, "base64"));
      return {
        title: "OpenAI 生成圖",
        prompt,
        localPath,
        model: binding.model || "gpt-image-2"
      };
    }

    if (imageUrl) {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`OpenAI image download failed: ${imageResponse.status}`);
      }

      await writeFile(localPath, Buffer.from(await imageResponse.arrayBuffer()));
      return {
        title: "OpenAI 生成圖",
        prompt,
        localPath,
        model: binding.model || "gpt-image-2"
      };
    }

    throw new Error("OpenAI image generation response did not contain image data.");
  }
}
