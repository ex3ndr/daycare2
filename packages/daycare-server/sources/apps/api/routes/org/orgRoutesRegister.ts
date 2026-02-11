import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";
import { organizationAvailableResolve } from "@/apps/organizations/organizationAvailableResolve.js";
import { organizationCreate } from "@/apps/organizations/organizationCreate.js";
import { organizationJoin } from "@/apps/organizations/organizationJoin.js";
import { userProfileUpdate } from "@/apps/users/userProfileUpdate.js";
import { accountSessionResolve } from "@/apps/api/lib/accountSessionResolve.js";
import { authContextResolve } from "@/apps/api/lib/authContextResolve.js";
import { ApiError } from "@/apps/api/lib/apiError.js";
import { apiResponseOk } from "@/apps/api/lib/apiResponseOk.js";
import { idempotencyGuard } from "@/apps/api/lib/idempotencyGuard.js";

const organizationCreateSchema = z.object({
  slug: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(120),
  public: z.boolean().optional(),
  firstName: z.string().trim().min(1).max(64),
  username: z.string().trim().min(2).max(64)
});

const organizationJoinSchema = z.object({
  firstName: z.string().trim().min(1).max(64),
  username: z.string().trim().min(2).max(64)
});

const profilePatchSchema = z.object({
  firstName: z.string().trim().min(1).max(64).optional(),
  lastName: z.string().trim().max(64).nullable().optional(),
  username: z.string().trim().min(2).max(64).optional(),
  bio: z.string().trim().max(1024).nullable().optional(),
  timezone: z.string().trim().max(80).nullable().optional(),
  avatarUrl: z.string().trim().url().nullable().optional()
});

export async function orgRoutesRegister(app: FastifyInstance, context: ApiContext): Promise<void> {
  app.get("/api/org/available", async (request) => {
    const account = await accountSessionResolve(request, context);

    const organizations = await organizationAvailableResolve(context, {
      accountId: account.accountId
    });

    return apiResponseOk({
      organizations: organizations.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        public: item.public,
        avatarUrl: item.avatarUrl,
        createdAt: item.createdAt.getTime(),
        updatedAt: item.updatedAt.getTime()
      }))
    });
  });

  app.post("/api/org/create", async (request) => {
    const account = await accountSessionResolve(request, context);
    const body = organizationCreateSchema.parse(request.body);

    return await idempotencyGuard(request, context, { type: "account", id: account.accountId }, async () => {
      const org = await organizationCreate(context, {
        accountId: account.accountId,
        slug: body.slug,
        name: body.name,
        public: body.public,
        firstName: body.firstName,
        username: body.username
      });

      return apiResponseOk({
        organization: {
          id: org.id,
          slug: org.slug,
          name: org.name,
          public: org.public,
          avatarUrl: org.avatarUrl,
          createdAt: org.createdAt.getTime(),
          updatedAt: org.updatedAt.getTime()
        }
      });
    });
  });

  app.post("/api/org/:orgid/join", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const body = organizationJoinSchema.parse(request.body);
    const account = await accountSessionResolve(request, context);

    return await idempotencyGuard(request, context, { type: "account", id: account.accountId }, async () => {
      if (!context.allowOpenOrgJoin) {
        const available = await organizationAvailableResolve(context, {
          accountId: account.accountId,
          organizationId: params.orgid
        });

        if (available.length === 0) {
          const organization = await context.db.organization.findUnique({
            where: {
              id: params.orgid
            },
            select: {
              id: true
            }
          });

          if (!organization) {
            throw new ApiError(404, "NOT_FOUND", "Organization not found");
          }

          throw new ApiError(403, "FORBIDDEN", "Organization is not available to join");
        }
      }
      const { organization, user } = await organizationJoin(context, {
        accountId: account.accountId,
        organizationId: params.orgid,
        firstName: body.firstName,
        username: body.username
      });

      return apiResponseOk({
        joined: true,
        user: {
          id: user.id,
          organizationId: user.organizationId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt.getTime(),
          updatedAt: user.updatedAt.getTime()
        }
      });
    });
  });

  app.get("/api/org/:orgid", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    await authContextResolve(request, context, params.orgid);

    const organization = await context.db.organization.findUnique({
      where: {
        id: params.orgid
      }
    });

    if (!organization) {
      throw new ApiError(404, "NOT_FOUND", "Organization not found");
    }

    return apiResponseOk({
      organization: {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        public: organization.public,
        avatarUrl: organization.avatarUrl,
        createdAt: organization.createdAt.getTime(),
        updatedAt: organization.updatedAt.getTime()
      }
    });
  });

  app.get("/api/org/:orgid/members", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const query = z.object({ active: z.enum(["true", "false"]).optional() }).parse(request.query);
    await authContextResolve(request, context, params.orgid);

    const where: { organizationId: string; deactivatedAt?: null | { not: null } } = {
      organizationId: params.orgid
    };
    if (query.active === "true") {
      where.deactivatedAt = null;
    } else if (query.active === "false") {
      where.deactivatedAt = { not: null };
    }

    const users = await context.db.user.findMany({
      where,
      orderBy: {
        createdAt: "asc"
      }
    });

    return apiResponseOk({
      members: users.map((user) => ({
        id: user.id,
        kind: user.kind.toLowerCase(),
        orgRole: user.orgRole,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        deactivatedAt: user.deactivatedAt ? user.deactivatedAt.getTime() : null,
        createdAt: user.createdAt.getTime(),
        updatedAt: user.updatedAt.getTime()
      }))
    });
  });

  app.get("/api/org/:orgid/profile", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);

    return apiResponseOk({
      profile: {
        id: auth.user.id,
        organizationId: auth.user.organizationId,
        kind: auth.user.kind.toLowerCase(),
        username: auth.user.username,
        firstName: auth.user.firstName,
        lastName: auth.user.lastName,
        bio: auth.user.bio,
        timezone: auth.user.timezone,
        avatarUrl: auth.user.avatarUrl,
        systemPrompt: auth.user.systemPrompt,
        createdAt: auth.user.createdAt.getTime(),
        updatedAt: auth.user.updatedAt.getTime()
      }
    });
  });

  app.patch("/api/org/:orgid/profile", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const auth = await authContextResolve(request, context, params.orgid);
    const body = profilePatchSchema.parse(request.body);

    return await idempotencyGuard(request, context, { type: "user", id: auth.user.id }, async () => {
      const updated = await userProfileUpdate(context, {
        userId: auth.user.id,
        firstName: body.firstName,
        lastName: body.lastName,
        username: body.username,
        bio: body.bio,
        timezone: body.timezone,
        avatarUrl: body.avatarUrl
      });

      return apiResponseOk({
        profile: {
          id: updated.id,
          organizationId: updated.organizationId,
          kind: updated.kind.toLowerCase(),
          username: updated.username,
          firstName: updated.firstName,
          lastName: updated.lastName,
          bio: updated.bio,
          timezone: updated.timezone,
          avatarUrl: updated.avatarUrl,
          systemPrompt: updated.systemPrompt,
          createdAt: updated.createdAt.getTime(),
          updatedAt: updated.updatedAt.getTime()
        }
      });
    });
  });
}
