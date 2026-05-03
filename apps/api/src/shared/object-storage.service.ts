import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";

type UploadVideoInput = {
  tenantId?: string | null;
  projectId: string;
  localPath: string;
  outputFormat?: string;
};

type UploadedVideoAsset = {
  objectKey: string;
  publicUrl: string;
  fileSizeBytes: bigint;
};

@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name);

  getStatus() {
    const config = this.resolveConfig();
    return {
      enabled: config.enabled,
      bucket: config.bucket || null,
      region: config.region || null,
      endpoint: config.endpoint || null,
      publicBaseUrl: config.publicBaseUrl || null,
      prefix: config.prefix || null,
      requireInProduction: this.requireInProduction()
    };
  }

  async uploadPublicVideo(input: UploadVideoInput): Promise<UploadedVideoAsset | null> {
    const config = this.resolveConfig();
    if (!config.enabled) {
      return null;
    }

    const client = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });

    const fileStats = await stat(input.localPath);
    const extension = this.resolveExtension(input.localPath, input.outputFormat);
    const objectKey = this.buildObjectKey(config.prefix, input.tenantId ?? null, input.projectId, extension);

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: objectKey,
          Body: createReadStream(input.localPath),
          ContentType: this.resolveContentType(extension),
          ContentLength: fileStats.size
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown object storage error";
      throw new InternalServerErrorException(`影片上傳到 object storage 失敗：${message}`);
    }

    const publicUrl = this.buildPublicUrl(config.publicBaseUrl, objectKey);
    this.logger.log(`Uploaded video output for project ${input.projectId} to object storage: ${objectKey}`);

    return {
      objectKey,
      publicUrl,
      fileSizeBytes: BigInt(fileStats.size)
    };
  }

  private buildObjectKey(prefix: string, tenantId: string | null, projectId: string, extension: string) {
    const tenantSegment = tenantId?.trim() ? tenantId.trim() : "unscoped";
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, "");
    return `${normalizedPrefix}/${tenantSegment}/${projectId}-${Date.now()}.${extension}`;
  }

  private buildPublicUrl(publicBaseUrl: string, objectKey: string) {
    const base = publicBaseUrl.replace(/\/+$/g, "");
    return `${base}/${objectKey}`;
  }

  private resolveExtension(localPath: string, outputFormat?: string) {
    const byPath = extname(localPath).replace(/^\./, "").trim();
    if (byPath) {
      return byPath.toLowerCase();
    }

    return (outputFormat ?? "mp4").trim().toLowerCase() || "mp4";
  }

  private resolveContentType(extension: string) {
    switch (extension) {
      case "mov":
        return "video/quicktime";
      case "webm":
        return "video/webm";
      case "mp4":
      default:
        return "video/mp4";
    }
  }

  private resolveConfig() {
    const bucket = this.env("OBJECT_STORAGE_BUCKET");
    const region = this.env("OBJECT_STORAGE_REGION") || "auto";
    const endpoint = this.env("OBJECT_STORAGE_ENDPOINT");
    const accessKeyId = this.env("OBJECT_STORAGE_ACCESS_KEY_ID");
    const secretAccessKey = this.env("OBJECT_STORAGE_SECRET_ACCESS_KEY");
    const publicBaseUrl = this.env("OBJECT_STORAGE_PUBLIC_BASE_URL");
    const prefix = this.env("OBJECT_STORAGE_PREFIX") || "videos";
    const forcePathStyle = this.env("OBJECT_STORAGE_FORCE_PATH_STYLE").toLowerCase() === "true";

    const values = [bucket, accessKeyId, secretAccessKey, publicBaseUrl];
    const filledCount = values.filter(Boolean).length;
    if (filledCount === 0) {
      return {
        enabled: false,
        bucket: "",
        region,
        endpoint,
        accessKeyId: "",
        secretAccessKey: "",
        publicBaseUrl: "",
        prefix,
        forcePathStyle
      };
    }

    if (filledCount !== values.length) {
      throw new InternalServerErrorException(
        "Object storage 設定不完整。請至少提供 OBJECT_STORAGE_BUCKET、OBJECT_STORAGE_ACCESS_KEY_ID、OBJECT_STORAGE_SECRET_ACCESS_KEY 與 OBJECT_STORAGE_PUBLIC_BASE_URL"
      );
    }

    return {
      enabled: true,
      bucket,
      region,
      endpoint,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl,
      prefix,
      forcePathStyle
    };
  }

  requireInProduction() {
    return (process.env.REQUIRE_OBJECT_STORAGE_IN_PRODUCTION ?? "").trim().toLowerCase() === "true";
  }

  private env(name: string) {
    return (process.env[name] ?? "").trim();
  }
}
