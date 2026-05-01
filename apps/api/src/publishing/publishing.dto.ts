import { PublishSourceType, PublishingPlatform } from "@prisma/client";
import { Transform } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

function normalizeList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,，]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export class CreatePublishJobDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  contentVariantId?: string;

  @IsOptional()
  @IsString()
  videoOutputId?: string;

  @IsString()
  @MaxLength(5000)
  caption!: string;

  @Transform(({ value }) => normalizeList(value))
  @IsArray()
  @ArrayMinSize(1)
  hashtags!: string[];

  @Transform(({ value }) => normalizeList(value))
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(PublishingPlatform, { each: true })
  platforms!: PublishingPlatform[];

  @IsOptional()
  @IsString()
  publishAt?: string;

  @IsEnum(PublishSourceType)
  sourceType!: PublishSourceType;
}
