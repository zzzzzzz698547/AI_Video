import { ContentStyle } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

function normalizeKeywords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,，]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export class CreateContentRequestDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  productName!: string;

  @IsString()
  @MinLength(5, {
    message: "productDescription 至少需要 5 個字，請補充用途、賣點或特色"
  })
  @MaxLength(1000)
  productDescription!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  targetAudience!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  priceRange?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  usageScenario?: string;

  @Transform(({ value }) => normalizeKeywords(value))
  @IsArray()
  @ArrayMinSize(1)
  keywords!: string[];

  @IsOptional()
  @IsEnum(ContentStyle)
  requestedStyle: ContentStyle = ContentStyle.AUTO;
}
