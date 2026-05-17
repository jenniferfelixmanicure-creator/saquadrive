import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@workspace/db";
import type { Logger } from "pino";

export async function runMigrations(logger: Logger): Promise<void> {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  logger.info({ migrationsFolder }, "Running database migrations...");
  await migrate(db, { migrationsFolder });
  logger.info("Database migrations completed successfully");
}
