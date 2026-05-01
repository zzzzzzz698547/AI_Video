import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  LicenseKeyStatus,
  LicensePlan,
  Prisma,
  TenantStatus,
  TenantUserRole
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ActivateLicenseKeyDto } from "./dto/activate-license-key.dto";
import { GenerateLicenseKeyDto } from "./dto/generate-license-key.dto";
import { CurrentTenantPayload } from "./current-tenant.decorator";
import { TenantLicenseException } from "./tenant-license.exception";
import { LicenseKeySummary, TenantMembershipSummary } from "./tenancy.types";

@Injectable()
export class TenancyService {
  constructor(private readonly prisma: PrismaService) {}

  async generateLicenseKeys(dto: GenerateLicenseKeyDto) {
    const expiresAt = new Date(dto.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException("expiresAt 必須是有效日期");
    }

    const created: LicenseKeySummary[] = [];
    for (let index = 0; index < dto.quantity; index += 1) {
      const code = await this.createUniqueLicenseCode(dto.prefix ?? "JX");
      const licenseKey = await this.prisma.licenseKey.create({
        data: {
          code,
          plan: dto.plan,
          maxUsers: dto.maxUsers,
          maxVideos: dto.maxVideos,
          maxSocialAccounts: dto.maxSocialAccounts,
          expiresAt,
          status: LicenseKeyStatus.UNUSED
        }
      });
      created.push(this.toLicenseKeySummary(licenseKey));
    }

    return created;
  }

  async activateLicenseKey(dto: ActivateLicenseKeyDto) {
    const code = dto.code.trim().toUpperCase();
    const licenseKey = await this.prisma.licenseKey.findUnique({
      where: { code },
      include: { tenant: true }
    });

    if (!licenseKey) {
      throw new NotFoundException("找不到授權碼");
    }

    this.assertLicenseKeyActivatable(licenseKey);

    const user = await this.resolveUser(dto);
    const activation = await this.prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          name: dto.tenantName.trim(),
          status: TenantStatus.ACTIVE,
          plan: licenseKey.plan,
          licenseExpiresAt: licenseKey.expiresAt
        }
      });

      await tx.tenantUser.create({
        data: {
          tenantId: createdTenant.id,
          userId: user.id,
          role: TenantUserRole.OWNER
        }
      });

      const workspaceName = dto.workspaceName?.trim() || dto.tenantName.trim();
      const workspace = await tx.workspace.create({
        data: {
          ownerId: user.id,
          tenantId: createdTenant.id,
          name: workspaceName,
          slug: await this.createUniqueWorkspaceSlug(workspaceName)
        }
      });

      await tx.licenseKey.update({
        where: { id: licenseKey.id },
        data: {
          status: LicenseKeyStatus.ACTIVE,
          activatedAt: new Date(),
          tenantId: createdTenant.id
        }
      });

      return {
        tenant: createdTenant,
        workspace
      };
    });

    return {
      tenant: {
        id: activation.tenant.id,
        name: activation.tenant.name,
        status: activation.tenant.status,
        plan: activation.tenant.plan,
        licenseExpiresAt: activation.tenant.licenseExpiresAt.toISOString()
      },
      workspace: {
        id: activation.workspace.id,
        name: activation.workspace.name,
        slug: activation.workspace.slug
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      licenseKey: this.toLicenseKeySummary({
        ...licenseKey,
        status: LicenseKeyStatus.ACTIVE,
        activatedAt: new Date(),
        tenantId: activation.tenant.id,
        updatedAt: new Date()
      })
    };
  }

  async getUserTenantStatus(userId: string): Promise<TenantMembershipSummary[]> {
    const memberships = await this.prisma.tenantUser.findMany({
      where: { userId },
      include: { tenant: true },
      orderBy: { createdAt: "asc" }
    });

    return memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      tenant: {
        tenantId: membership.tenant.id,
        tenantName: membership.tenant.name,
        status: membership.tenant.status,
        plan: membership.tenant.plan,
        licenseExpiresAt: membership.tenant.licenseExpiresAt.toISOString(),
        isUsable: membership.tenant.status === TenantStatus.ACTIVE && membership.tenant.licenseExpiresAt > new Date()
      }
    }));
  }

  async getTenantLicenseStatus(tenantId: string): Promise<CurrentTenantPayload & { name: string }> {
    const snapshot = await this.getTenantLicenseSnapshot(tenantId);
    return {
      ...snapshot,
      name: (await this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { name: true }
      })).name
    };
  }

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          include: {
            user: true
          }
        },
        licenseKeys: true,
        workspaces: true
      }
    });

    if (!tenant) {
      throw new NotFoundException("找不到 Tenant");
    }

    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      plan: tenant.plan,
      licenseExpiresAt: tenant.licenseExpiresAt.toISOString(),
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString(),
      users: tenant.users.map((membership) => ({
        id: membership.id,
        role: membership.role,
        user: {
          id: membership.user.id,
          email: membership.user.email,
          name: membership.user.name
        }
      })),
      workspaces: tenant.workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug
      })),
      licenseKeys: tenant.licenseKeys.map((licenseKey) => this.toLicenseKeySummary(licenseKey))
    };
  }

  async assertTenantAccess(tenantId?: string | null) {
    if (!tenantId) {
      return;
    }

    await this.getTenantLicenseSnapshot(tenantId);
  }

  async resolveTenantIdByWorkspace(workspaceId?: string | null) {
    if (!workspaceId) {
      return null;
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { tenantId: true }
    });

    return workspace?.tenantId ?? null;
  }

  async resolveTenantAccessFromRequest(input: {
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
    routePath?: string;
    originalUrl?: string;
  }): Promise<CurrentTenantPayload | null> {
    const tenantId = await this.resolveTenantIdFromRequest(input);
    if (!tenantId) {
      return null;
    }

    return this.getTenantLicenseSnapshot(tenantId);
  }

  private async resolveUser(dto: ActivateLicenseKeyDto) {
    if (dto.userId) {
      const existingUser = await this.prisma.user.findUnique({
        where: { id: dto.userId }
      });
      if (existingUser) {
        return existingUser;
      }
    }

    return this.prisma.user.upsert({
      where: { email: dto.userEmail.trim().toLowerCase() },
      create: {
        id: dto.userId,
        email: dto.userEmail.trim().toLowerCase(),
        name: dto.userName.trim(),
        status: "ACTIVE"
      },
      update: {
        name: dto.userName.trim(),
        status: "ACTIVE"
      }
    });
  }

  private async getTenantLicenseSnapshot(tenantId: string): Promise<CurrentTenantPayload> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new NotFoundException("找不到 Tenant");
    }

    const now = new Date();
    const expiresAt = tenant.licenseExpiresAt;
    const isExpired = expiresAt <= now;
    const nextStatus =
      tenant.status === TenantStatus.SUSPENDED
        ? TenantStatus.SUSPENDED
        : isExpired
          ? TenantStatus.EXPIRED
          : TenantStatus.ACTIVE;

    if (tenant.status !== nextStatus) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: nextStatus }
      });
    }

    const remainingDays = isExpired ? 0 : Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const payload: CurrentTenantPayload = {
      tenantId: tenant.id,
      status: nextStatus,
      plan: tenant.plan,
      licenseExpiresAt: expiresAt.toISOString(),
      remainingDays,
      isUsable: nextStatus === TenantStatus.ACTIVE && !isExpired
    };

    if (nextStatus === TenantStatus.SUSPENDED) {
      throw new TenantLicenseException("TENANT_SUSPENDED", "此 Tenant 已被停用", {
        tenantId: tenant.id,
        tenantStatus: nextStatus,
        licenseExpiresAt: expiresAt.toISOString(),
        remainingDays
      });
    }

    if (nextStatus === TenantStatus.EXPIRED || isExpired) {
      throw new TenantLicenseException("LICENSE_EXPIRED", "授權已到期，無法使用主要功能", {
        tenantId: tenant.id,
        tenantStatus: TenantStatus.EXPIRED,
        licenseExpiresAt: expiresAt.toISOString(),
        remainingDays
      });
    }

    if (nextStatus !== TenantStatus.ACTIVE) {
      throw new TenantLicenseException("TENANT_INACTIVE", "此 Tenant 目前不可用", {
        tenantId: tenant.id,
        tenantStatus: nextStatus,
        licenseExpiresAt: expiresAt.toISOString(),
        remainingDays
      });
    }

    return payload;
  }

  private async resolveTenantIdFromRequest(input: {
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
    routePath?: string;
    originalUrl?: string;
  }) {
    const directTenantId = this.pickString(input.body?.tenantId, input.query?.tenantId, input.params?.tenantId);
    if (directTenantId) {
      return directTenantId;
    }

    const workspaceId = this.pickString(input.body?.workspaceId, input.query?.workspaceId, input.params?.workspaceId);
    if (workspaceId) {
      const tenantId = await this.resolveTenantIdByWorkspace(workspaceId);
      if (tenantId) {
        return tenantId;
      }
    }

    const contentId = this.pickString(input.body?.contentId, input.query?.contentId, input.params?.contentId);
    if (contentId) {
      const content = await this.prisma.generatedContent.findUnique({
        where: { id: contentId },
        select: {
          tenantId: true,
          request: {
            select: {
              tenantId: true
            }
          }
        }
      });
      if (content?.tenantId || content?.request.tenantId) {
        return content.tenantId ?? content.request.tenantId;
      }
    }

    const analysisId = this.pickString(input.body?.analysisId, input.query?.analysisId, input.params?.analysisId, input.params?.id);
    if (analysisId && this.matchesAnyRoute(input, ["/url-analysis/analyses/", "/url-analysis/analyze", "/generate-video"])) {
      const analysis = await this.prisma.videoUrlAnalysisRequest.findUnique({
        where: { id: analysisId },
        select: { tenantId: true, workspaceId: true }
      });
      if (analysis?.tenantId) {
        return analysis.tenantId;
      }
      if (analysis?.workspaceId) {
        return this.resolveTenantIdByWorkspace(analysis.workspaceId);
      }
    }

    const videoOutputId = this.pickString(input.body?.videoOutputId, input.query?.videoOutputId);
    if (videoOutputId) {
      const output = await this.prisma.videoOutput.findUnique({
        where: { id: videoOutputId },
        select: { tenantId: true, videoProject: { select: { tenantId: true } } }
      });
      if (output?.tenantId || output?.videoProject.tenantId) {
        return output.tenantId ?? output.videoProject.tenantId;
      }
    }

    const contentVariantId = this.pickString(input.body?.contentVariantId, input.query?.contentVariantId);
    if (contentVariantId) {
      const variant = await this.prisma.contentVariant.findUnique({
        where: { id: contentVariantId },
        select: {
          generatedContent: {
            select: {
              tenantId: true,
              request: {
                select: {
                  tenantId: true
                }
              }
            }
          }
        }
      });
      if (variant?.generatedContent.tenantId || variant?.generatedContent.request.tenantId) {
        return variant.generatedContent.tenantId ?? variant.generatedContent.request.tenantId;
      }
    }

    const resourceId = this.pickString(input.params?.id);
    if (resourceId) {
      if (this.matchesAnyRoute(input, ["/video/", "/video/:id", "/video/:id/file"])) {
        const project = await this.prisma.videoProject.findUnique({
          where: { id: resourceId },
          select: {
            tenantId: true,
            content: {
              select: {
                tenantId: true,
                request: {
                  select: {
                    tenantId: true
                  }
                }
              }
            }
          }
        });
        if (project?.tenantId || project?.content.tenantId || project?.content.request.tenantId) {
          return project.tenantId ?? project.content.tenantId ?? project.content.request.tenantId;
        }
      }

      if (this.matchesAnyRoute(input, ["/publish/", "/publish/:id", "/retry/", "/retry/:id"])) {
        const job = await this.prisma.publishingJob.findUnique({
          where: { id: resourceId },
          select: { tenantId: true }
        });
        if (job?.tenantId) {
          return job.tenantId;
        }
      }

      if (this.matchesAnyRoute(input, ["/url-analysis/analyses/", "/url-analysis/analyses/:id"])) {
        const analysis = await this.prisma.videoUrlAnalysisRequest.findUnique({
          where: { id: resourceId },
          select: { tenantId: true, workspaceId: true }
        });
        if (analysis?.tenantId) {
          return analysis.tenantId;
        }
        if (analysis?.workspaceId) {
          return this.resolveTenantIdByWorkspace(analysis.workspaceId);
        }
      }

      if (this.matchesAnyRoute(input, ["/api/social/adapters/", "/api/social/adapters/:id"])) {
        const adapter = await this.prisma.socialAdapter.findUnique({
          where: { id: resourceId },
          select: { tenantId: true }
        });
        if (adapter?.tenantId) {
          return adapter.tenantId;
        }
      }

      if (this.matchesAnyRoute(input, ["/api/social/publish-jobs/", "/api/social/publish-jobs/:jobId/retry"])) {
        const job = await this.prisma.socialPublishJob.findUnique({
          where: { id: resourceId },
          select: { tenantId: true }
        });
        if (job?.tenantId) {
          return job.tenantId;
        }
      }
    }

    const videoId = this.pickString(input.params?.videoId);
    if (videoId && this.matchesAnyRoute(input, ["/api/videos/", "/api/videos/:videoId/publish/social", "/api/videos/:videoId/publish/jobs"])) {
      const project = await this.prisma.videoProject.findUnique({
        where: { id: videoId },
        select: {
          tenantId: true,
          content: {
            select: {
              tenantId: true,
              request: {
                select: { tenantId: true }
              }
            }
          }
        }
      });
      if (project?.tenantId || project?.content.tenantId || project?.content.request.tenantId) {
        return project.tenantId ?? project.content.tenantId ?? project.content.request.tenantId;
      }
    }

    return null;
  }

  private matchesAnyRoute(
    input: { routePath?: string; originalUrl?: string },
    hints: string[]
  ) {
    const routePath = input.routePath ?? "";
    const originalUrl = input.originalUrl ?? "";
    return hints.some((hint) => routePath.includes(hint) || originalUrl.includes(hint));
  }

  private pickString(...values: unknown[]) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private assertLicenseKeyActivatable(licenseKey: {
    status: LicenseKeyStatus;
    expiresAt: Date;
    tenantId: string | null;
  }) {
    if (licenseKey.status === LicenseKeyStatus.REVOKED) {
      throw new ForbiddenException("授權碼已撤銷，無法啟用");
    }

    if (licenseKey.status === LicenseKeyStatus.ACTIVE || licenseKey.tenantId) {
      throw new ForbiddenException("授權碼已使用，無法重複啟用");
    }

    if (licenseKey.status === LicenseKeyStatus.EXPIRED || licenseKey.expiresAt <= new Date()) {
      throw new ForbiddenException("授權碼已過期，無法啟用");
    }
  }

  private async createUniqueLicenseCode(prefix: string) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = this.generateLicenseCode(prefix);
      const existing = await this.prisma.licenseKey.findUnique({
        where: { code },
        select: { id: true }
      });
      if (!existing) {
        return code;
      }
    }

    throw new BadRequestException("授權碼產生失敗，請稍後再試");
  }

  private generateLicenseCode(prefix: string) {
    const normalizedPrefix = prefix.trim().toUpperCase().slice(0, 4) || "JX";
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const groups = Array.from({ length: 3 }, () =>
      Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")
    );

    return [normalizedPrefix, ...groups].join("-");
  }

  private async createUniqueWorkspaceSlug(name: string) {
    const base = this.slugify(name);
    for (let index = 0; index < 20; index += 1) {
      const slug = index === 0 ? base : `${base}-${index + 1}`;
      const existing = await this.prisma.workspace.findUnique({
        where: { slug },
        select: { id: true }
      });
      if (!existing) {
        return slug;
      }
    }

    throw new BadRequestException("Workspace slug 產生失敗");
  }

  private slugify(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");

    return slug || `tenant-${Math.random().toString(36).slice(2, 8)}`;
  }

  private toLicenseKeySummary(licenseKey: {
    id: string;
    code: string;
    plan: LicensePlan;
    status: LicenseKeyStatus;
    maxUsers: number;
    maxVideos: number;
    maxSocialAccounts: number;
    expiresAt: Date;
    activatedAt: Date | null;
    tenantId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): LicenseKeySummary {
    return {
      id: licenseKey.id,
      code: licenseKey.code,
      plan: licenseKey.plan,
      status: licenseKey.status,
      maxUsers: licenseKey.maxUsers,
      maxVideos: licenseKey.maxVideos,
      maxSocialAccounts: licenseKey.maxSocialAccounts,
      expiresAt: licenseKey.expiresAt.toISOString(),
      activatedAt: licenseKey.activatedAt?.toISOString() ?? null,
      tenantId: licenseKey.tenantId,
      createdAt: licenseKey.createdAt.toISOString(),
      updatedAt: licenseKey.updatedAt.toISOString()
    };
  }
}
