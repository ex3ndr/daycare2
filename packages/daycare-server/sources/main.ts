import { apiCreate } from "./apps/api/apiCreate.js";
import { apiStart } from "./apps/api/apiStart.js";
import { apiStop } from "./apps/api/apiStop.js";
import { configRead } from "./modules/config/configRead.js";
import { databaseConnect } from "./modules/database/databaseConnect.js";
import { databaseCreate } from "./modules/database/databaseCreate.js";
import { databaseDisconnect } from "./modules/database/databaseDisconnect.js";
import { redisConnect } from "./modules/redis/redisConnect.js";
import { redisCreate } from "./modules/redis/redisCreate.js";
import { redisDisconnect } from "./modules/redis/redisDisconnect.js";

async function main(): Promise<void> {
  const config = configRead();

  const database = databaseCreate(config.databaseUrl);
  await databaseConnect(database);

  const redis = redisCreate(config.redisUrl);
  await redisConnect(redis);

  const app = await apiCreate();
  await apiStart(app, config.host, config.port);

  console.log(`[daycare-server] ready on http://${config.host}:${config.port}`);

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    console.log(`[daycare-server] shutdown requested (${signal})`);

    await apiStop(app);
    await redisDisconnect(redis);
    await databaseDisconnect(database);

    console.log("[daycare-server] shutdown completed");
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error) => {
  console.error("[daycare-server] fatal startup error", error);
  process.exit(1);
});
