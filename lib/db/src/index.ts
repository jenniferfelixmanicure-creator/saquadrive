import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL!;
const isExternalRender = connectionString.includes(".render.com");
export const pool = new Pool({
  connectionString,
  ssl: isExternalRender ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
  max: 5,
});
pool.on("error", (_err) => {});
export const db = drizzle(pool, { schema });

export * from "./schema";
