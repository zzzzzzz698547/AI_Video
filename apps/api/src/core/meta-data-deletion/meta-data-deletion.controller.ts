import { Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import { ok } from "../http/api-response";
import { MetaDataDeletionService } from "./meta-data-deletion.service";

@Controller("meta")
export class MetaDataDeletionController {
  constructor(private readonly metaDataDeletionService: MetaDataDeletionService) {}

  @Post("data-deletion")
  @Get("data-deletion")
  async callback(@Req() request: any, @Res() response: any) {
    const signedRequest = this.extractSignedRequest(request);
    const userAgent = this.extractStringHeader(request.headers["user-agent"]);
    const ipAddress = this.extractStringHeader(request.ip) ?? this.extractStringHeader(request.headers["x-forwarded-for"]);
    const result = await this.metaDataDeletionService.handleCallback({
      signedRequest,
      userAgent,
      ipAddress
    });

    return response.status(200).json({
      url: result.statusUrl,
      confirmation_code: result.confirmationCode
    });
  }

  @Get("data-deletion/status/:code")
  async status(@Param("code") code: string) {
    return ok({
      request: await this.metaDataDeletionService.getStatus(code)
    });
  }

  private extractSignedRequest(request: { body?: unknown; query?: unknown }) {
    const body = (request.body as Record<string, unknown> | undefined) ?? undefined;
    const query = (request.query as Record<string, unknown> | undefined) ?? undefined;
    const candidates = [
      body?.signed_request,
      body?.signedRequest,
      query?.signed_request,
      query?.signedRequest
    ];
    const signedRequest = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (!signedRequest) {
      throw new Error("Missing signed_request");
    }

    return signedRequest;
  }

  private extractStringHeader(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  }
}
