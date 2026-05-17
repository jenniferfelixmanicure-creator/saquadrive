import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import type { Logger } from "pino";

export async function seedAdmin(logger: Logger): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const secret = process.env.ADMIN_SECRET;

  if (!email || !secret) {
    logger.info("ADMIN_EMAIL or ADMIN_SECRET not set — skipping admin seed");
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    logger.info({ email }, "Admin user already exists — skipping seed");
    return;
  }

  const passwordHash = await bcrypt.hash(secret, 12);

  await db.insert(usersTable).values({
    name: "Administrador",
    email: email.toLowerCase(),
    phone: "00000000000",
    passwordHash,
    role: "admin",
    isApproved: true,
    rgStatus: "approved",
    cnhStatus: "approved",
    crlvStatus: "approved",
  });

  logger.info({ email }, "Admin user created successfully");
}
