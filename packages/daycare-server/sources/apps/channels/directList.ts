import type { Chat, User } from "@prisma/client";
import type { ApiContext } from "@/apps/api/lib/apiContext.js";

export type DirectListItem = {
  chat: Chat;
  otherUser: User;
};

type DirectListInput = {
  organizationId: string;
  userId: string;
};

export async function directList(
  context: ApiContext,
  input: DirectListInput
): Promise<DirectListItem[]> {
  const memberships = await context.db.chatMember.findMany({
    where: {
      userId: input.userId,
      leftAt: null,
      chat: {
        organizationId: input.organizationId,
        kind: "DIRECT"
      }
    },
    include: {
      chat: {
        include: {
          members: {
            where: {
              leftAt: null,
              userId: {
                not: input.userId
              }
            },
            include: {
              user: {
                select: {
                  id: true,
                  organizationId: true,
                  accountId: true,
                  kind: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                  bio: true,
                  timezone: true,
                  avatarUrl: true,
                  systemPrompt: true,
                  createdAt: true,
                  updatedAt: true,
                  lastSeenAt: true
                }
              }
            },
            take: 1
          }
        }
      }
    },
    orderBy: {
      joinedAt: "desc"
    }
  });

  const directs: DirectListItem[] = [];
  for (const membership of memberships) {
    const otherMember = membership.chat.members[0];
    if (!otherMember) {
      continue;
    }

    directs.push({
      chat: membership.chat,
      otherUser: otherMember.user
    });
  }

  return directs;
}
