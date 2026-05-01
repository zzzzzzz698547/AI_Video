import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ok } from "../http/api-response";
import { IntegrationsService } from "./integrations.service";
import type { ManualBindIntegrationInput } from "./integrations.types";

@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get("providers")
  providers() {
    return ok({
      providers: this.integrationsService.listProviders()
    });
  }

  @Get("accounts")
  async accounts(
    @Query("workspaceId") workspaceId?: string,
    @Query("brandId") brandId?: string,
    @Query("platform") platform?: string
  ) {
    return ok({
      accounts: await this.integrationsService.listAccounts(workspaceId, brandId, platform)
    });
  }

  @Get("connect/:platform")
  async connect(
    @Param("platform") platform: string,
    @Query("workspaceId") workspaceId?: string,
    @Query("brandId") brandId?: string,
    @Query("accountName") accountName?: string,
    @Query("stage") stage?: string
  ) {
    const targetWorkspaceId = workspaceId ?? "demo-workspace";
    return ok(
      await this.integrationsService.buildConnectLink({
        workspaceId: targetWorkspaceId,
        brandId,
        platform,
        accountName,
        permissionStage: stage
      })
    );
  }

  @Get("connect/:platform/open")
  async openConnect(
    @Param("platform") platform: string,
    @Query("workspaceId") workspaceId?: string,
    @Query("brandId") brandId?: string,
    @Query("accountName") accountName?: string,
    @Query("stage") stage?: string
  ) {
    const targetWorkspaceId = workspaceId ?? "demo-workspace";
    return ok(
      await this.integrationsService.openConnectLink({
        workspaceId: targetWorkspaceId,
        brandId,
        platform,
        accountName,
        permissionStage: stage
      })
    );
  }

  @Get("callback/:platform")
  async callback(
    @Param("platform") platform: string,
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("externalAccountId") externalAccountId?: string,
    @Query("displayName") displayName?: string
  ) {
    if (!code) {
      throw new Error("Missing OAuth code");
    }

    return ok(
      await this.integrationsService.handleCallback({
        platform,
        code,
        state,
        externalAccountId,
        displayName
      })
    );
  }

  @Post("manual-bind")
  async manualBind(@Body() body: ManualBindIntegrationInput) {
    return ok(
      await this.integrationsService.manualBind({
        ...body,
        workspaceId: body.workspaceId ?? "demo-workspace"
      })
    );
  }

  @Post("accounts/:id/refresh-token")
  async refresh(@Param("id") id: string) {
    return ok(await this.integrationsService.refreshToken(id));
  }

  @Post("accounts/:id/disconnect")
  async disconnect(@Param("id") id: string) {
    return ok(await this.integrationsService.disconnect(id));
  }

  @Post("accounts/:id/delete")
  async remove(@Param("id") id: string) {
    return ok(await this.integrationsService.deleteAccount(id));
  }

  @Post("accounts/disconnect-all")
  async disconnectAll(
    @Query("workspaceId") workspaceId?: string,
    @Query("brandId") brandId?: string,
    @Query("platform") platform?: string
  ) {
    return ok(
      await this.integrationsService.disconnectAll({
        workspaceId,
        brandId,
        platform
      })
    );
  }
}
