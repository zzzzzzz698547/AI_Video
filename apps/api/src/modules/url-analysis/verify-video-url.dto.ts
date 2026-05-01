import { IsOptional, IsString, MinLength } from "class-validator";

export class VerifyVideoUrlDto {
  @IsString()
  @MinLength(8)
  url!: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;
}
