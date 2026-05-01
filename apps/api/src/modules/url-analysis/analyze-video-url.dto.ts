import { Transform } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";

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

function parseDuration(value: unknown) {
  const numberValue = Number(value);
  return numberValue === 15 || numberValue === 30 ? numberValue : 30;
}

export class AnalyzeVideoUrlDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsString()
  @MinLength(8)
  url!: string;

  @IsString()
  @MinLength(2)
  analysisGoal!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  analysisMode?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  targetAudience?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  desiredTone?: string;

  @Transform(({ value }) => parseDuration(value))
  @IsInt()
  @Min(15)
  @Max(30)
  desiredLengthSeconds: 15 | 30 = 30;

  @Transform(({ value }) => normalizeKeywords(value))
  @IsArray()
  @ArrayMinSize(0)
  focusKeywords: string[] = [];

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  brandId?: string;
}
