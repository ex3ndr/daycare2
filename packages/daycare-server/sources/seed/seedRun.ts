import { createId } from "@paralleldrive/cuid2";
import { configRead } from "../modules/config/configRead.js";
import { databaseConnect } from "../modules/database/databaseConnect.js";
import { databaseCreate } from "../modules/database/databaseCreate.js";
import { getLogger } from "../utils/getLogger.js";

const logger = getLogger("seed.dev");

export async function seedRun(): Promise<void> {
  const config = configRead();
  const db = databaseCreate(config.databaseUrl);
  await databaseConnect(db);

  const accountEmail = "dev@daycare.local";
  const orgSlug = "acme";
  const orgName = "Acme";

  let account = await db.account.findUnique({
    where: {
      email: accountEmail
    }
  });

  if (!account) {
    account = await db.account.create({
      data: {
        id: createId(),
        email: accountEmail
      }
    });
  }

  let organization = await db.organization.findUnique({
    where: {
      slug: orgSlug
    }
  });

  if (!organization) {
    organization = await db.organization.create({
      data: {
        id: createId(),
        slug: orgSlug,
        name: orgName
      }
    });
  }

  let user = await db.user.findFirst({
    where: {
      accountId: account.id,
      organizationId: organization.id
    }
  });

  if (!user) {
    user = await db.user.create({
      data: {
        id: createId(),
        organizationId: organization.id,
        accountId: account.id,
        kind: "HUMAN",
        firstName: "Dev",
        username: "dev"
      }
    });
  }

  let aiUser = await db.user.findFirst({
    where: {
      organizationId: organization.id,
      kind: "AI",
      username: "assistant"
    }
  });

  if (!aiUser) {
    aiUser = await db.user.create({
      data: {
        id: createId(),
        organizationId: organization.id,
        kind: "AI",
        firstName: "Assistant",
        username: "assistant",
        systemPrompt: "You are a helpful assistant inside daycare."
      }
    });
  }

  let channel = await db.chat.findFirst({
    where: {
      organizationId: organization.id,
      kind: "CHANNEL",
      name: "general",
      archivedAt: null
    }
  });

  if (!channel) {
    channel = await db.chat.create({
      data: {
        id: createId(),
        organizationId: organization.id,
        createdByUserId: user.id,
        kind: "CHANNEL",
        name: "general",
        visibility: "PUBLIC",
        members: {
          create: {
            id: createId(),
            userId: user.id,
            role: "OWNER",
            notificationLevel: "ALL"
          }
        }
      }
    });
  }

  const membership = await db.chatMember.findFirst({
    where: {
      chatId: channel.id,
      userId: user.id,
      leftAt: null
    }
  });

  if (!membership) {
    await db.chatMember.create({
      data: {
        id: createId(),
        chatId: channel.id,
        userId: user.id,
        role: "OWNER",
        notificationLevel: "ALL"
      }
    });
  }

  const existingMessage = await db.message.findFirst({
    where: {
      chatId: channel.id,
      senderUserId: user.id
    }
  });

  if (!existingMessage) {
    await db.message.create({
      data: {
        id: createId(),
        chatId: channel.id,
        senderUserId: user.id,
        text: "Welcome to daycare! This workspace was seeded for local development."
      }
    });
  }

  logger.info("seed complete", {
    organizationId: organization.id,
    userId: user.id,
    aiUserId: aiUser.id,
    channelId: channel.id,
    accountEmail
  });

  await db.$disconnect();
}

seedRun().catch((error) => {
  logger.error("seed failed", error);
  process.exit(1);
});
