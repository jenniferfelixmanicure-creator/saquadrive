import { httpServer } from "./app.js";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./lib/migrate.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

try {
  await runMigrations(logger);
} catch (err) {
  logger.error({ err }, "Migration failed — starting server anyway");
}

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});
