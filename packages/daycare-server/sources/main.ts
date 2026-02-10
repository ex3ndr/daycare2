import { apiCreate } from "./apps/api/apiCreate.js";
import { apiStart } from "./apps/api/apiStart.js";
import { configRead } from "./modules/config/configRead.js";
import { databaseConnect } from "./modules/database/databaseConnect.js";
import { databaseCreate } from "./modules/database/databaseCreate.js";
import { redisConnect } from "./modules/redis/redisConnect.js";
import { redisCreate } from "./modules/redis/redisCreate.js";
import { getLogger } from "./utils/getLogger.js";
import { awaitShutdown, onShutdown } from "./utils/shutdown.js";

const logger = getLogger("server.main");

async function main(): Promise<void> {
  const config = configRead();

  const database = databaseCreate(config.databaseUrl);
  await databaseConnect(database);
  onShutdown("database", async () => {
    await database.$disconnect();
  });

  const redis = redisCreate(config.redisUrl);
  await redisConnect(redis);
  onShutdown("redis", async () => {
    await redis.quit();
  });

  const app = await apiCreate();
  await apiStart(app, config.host, config.port);
  onShutdown("api", async () => {
    await app.close();
  });

  logger.info(`ready on http://${config.host}:${config.port}`);
  const shutdownSignal = await awaitShutdown();
  logger.info(`shutdown completed (${shutdownSignal})`);
  process.exit(0);
}

main().catch((error) => {
  logger.error("fatal startup error", error);
  process.exit(1);
});
