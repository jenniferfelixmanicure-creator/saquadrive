import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull().default(""),
  role: text("role").$type<"passenger" | "driver" | "admin">().default("passenger").notNull(),
  rgStatus: text("rg_status").$type<"pending" | "approved" | "rejected">().default("pending"),
  rgUrl: text("rg_url"),
  profilePhotoUrl: text("profile_photo_url"),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
