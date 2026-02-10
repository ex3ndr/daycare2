import { createId } from "@paralleldrive/cuid2";
import type { FastifyInstance } from "fastify";
import { Prisma, type Organization } from "@prisma/client";
import { z } from "zod";
import type { ApiContext } from "../../lib/apiContext.js";
import { accountSessionResolve } from "../../lib/accountSessionResolve.js";
import { authContextResolve } from "../../lib/authContextResolve.js";
import { ApiError } from "../../lib/apiError.js";
import { apiResponseOk } from "../../lib/apiResponseOk.js";
import { organizationRecipientIdsResolve } from "../../lib/organizationRecipientIdsResolve.js";

const organizationCreateSchema = z.object({
  slug: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(120),
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

    const organizations = await context.db.organization.findMany({
      where: {
        users: {
          some: {
            accountId: account.accountId
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return apiResponseOk({
      organizations: organizations.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        avatarUrl: item.avatarUrl,
        createdAt: item.createdAt.getTime(),
        updatedAt: item.updatedAt.getTime()
      }))
    });
  });

  app.post("/api/org/create", async (request) => {
    const account = await accountSessionResolve(request, context);
    const body = organizationCreateSchema.parse(request.body);

    let org: Organization;
    try {
      org = await context.db.organization.create({
        data: {
          id: createId(),
          slug: body.slug,
          name: body.name,
          users: {
            create: {
              id: createId(),
              accountId: account.accountId,
              kind: "HUMAN",
              firstName: body.firstName,
              username: body.username
            }
          }
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ApiError(409, "CONFLICT", "Organization slug is already taken");
      }
      throw error;
    }

    const recipients = await organizationRecipientIdsResolve(context, org.id);
    await context.updates.publishToUsers(recipients, "organization.created", {
      orgId: org.id
    });

    return apiResponseOk({
      organization: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        avatarUrl: org.avatarUrl,
        createdAt: org.createdAt.getTime(),
        updatedAt: org.updatedAt.getTime()
      }
    });
  });

  app.post("/api/org/:orgid/join", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    const body = organizationJoinSchema.parse(request.body);
    const account = await accountSessionResolve(request, context);

    if (!context.allowOpenOrgJoin) {
      throw new ApiError(403, "FORBIDDEN", "Open organization join is disabled");
    }

    const organization = await context.db.organization.findUnique({
      where: {
        id: params.orgid
      }
    });

    if (!organization) {
      throw new ApiError(404, "NOT_FOUND", "Organization not found");
    }

    let user = await context.db.user.findFirst({
      where: {
        accountId: account.accountId,
        organizationId: organization.id
      }
    });

    if (!user) {
      try {
        user = await context.db.user.create({
          data: {
            id: createId(),
            organizationId: organization.id,
            accountId: account.accountId,
            kind: "HUMAN",
            firstName: body.firstName,
            username: body.username
          }
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          user = await context.db.user.findFirst({
            where: {
              accountId: account.accountId,
              organizationId: organization.id
            }
          });
        } else {
          throw error;
        }
      }
    }

    if (!user) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to join organization");
    }

    const recipients = await organizationRecipientIdsResolve(context, organization.id);
    await context.updates.publishToUsers(recipients, "organization.member.joined", {
      orgId: organization.id,
      userId: user.id
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
        avatarUrl: organization.avatarUrl,
        createdAt: organization.createdAt.getTime(),
        updatedAt: organization.updatedAt.getTime()
      }
    });
  });

  app.get("/api/org/:orgid/members", async (request) => {
    const params = z.object({ orgid: z.string().min(1) }).parse(request.params);
    await authContextResolve(request, context, params.orgid);

    const users = await context.db.user.findMany({
      where: {
        organizationId: params.orgid
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return apiResponseOk({
      members: users.map((user) => ({
        id: user.id,
        kind: user.kind.toLowerCase(),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
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

    const updated = await context.db.user.update({
      where: {
        id: auth.user.id
      },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        username: body.username,
        bio: body.bio,
        timezone: body.timezone,
        avatarUrl: body.avatarUrl
      }
    });

    const recipients = await organizationRecipientIdsResolve(context, updated.organizationId);
    await context.updates.publishToUsers(recipients, "user.updated", {
      orgId: updated.organizationId,
      userId: updated.id
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
}
