import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { AiProviderBindingsService } from "./ai-provider-bindings.service";

@Controller("ai/providers")
export class AiProviderBindingsController {
  constructor(private readonly bindings: AiProviderBindingsService) {}

  @Get()
  listProviders(@Query("scopeKey") scopeKey?: string) {
    return this.bindings.listBindings(scopeKey || "GLOBAL");
  }

  @Post("bind")
  bindProvider(
    @Body()
    body: {
      scopeKey?: string;
      provider: "OPENAI" | "GEMINI";
      apiKey: string;
      label?: string;
      apiBaseUrl?: string;
      defaultModel?: string;
    }
  ) {
    return this.bindings.saveBinding(body);
  }

  @Post(":provider/test")
  testProvider(@Param("provider") provider: string, @Query("scopeKey") scopeKey?: string) {
    return this.bindings.testBinding(scopeKey || "GLOBAL", provider);
  }

  @Patch(":provider/active")
  setProviderActive(
    @Param("provider") provider: string,
    @Query("scopeKey") scopeKey: string | undefined,
    @Body() body: { isActive?: boolean }
  ) {
    return this.bindings.setBindingActive(scopeKey || "GLOBAL", provider, Boolean(body.isActive));
  }

  @Delete(":provider")
  disconnect(@Param("provider") provider: string, @Query("scopeKey") scopeKey?: string) {
    return this.bindings.disconnect(scopeKey || "GLOBAL", provider);
  }
}
