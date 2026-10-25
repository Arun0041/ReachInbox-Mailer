import { config } from "./config.js";
import { initSchema } from "./db/pool.js";
import { initMailer } from "./services/mailer.js";
import { ensureIndex } from "./services/elastic.js";
import { createApp } from "./app.js";
import { closeWorker } from "./queue/worker.js";
import { reconcileOnBoot } from "./queue/reconcile.js";

async function main(): Promise<void> {
  console.log("[boot] initialising database schema...");
  await initSchema();

  console.log("[boot] preparing Ethereal mailer...");
  await initMailer();

  console.log("[boot] ensuring Elasticsearch index...");
  await ensureIndex().catch((err: Error) =>
    console.warn(`[boot] Elasticsearch unavailable (${err.message}) — continuing with SQL search`),
  );

  // Restart persistence: re-ensure every DB-scheduled email has a queue job.
  await reconcileOnBoot();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[boot] API listening on ${config.appUrl} (port ${config.port})`);
    console.log(`[boot] Bull Board: ${config.appUrl}/admin/queues`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[shutdown] ${signal} received`);
    await closeWorker();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[boot] fatal:", err);
  process.exit(1);
});
