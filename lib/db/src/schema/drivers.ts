import { pgTable, text, serial, boolean, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const driversTable = pgTable("drivers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).unique().notNull(),
  cnhStatus: text("cnh_status").$type<"pending" | "approved" | "rejected">().default("pending"),
  cnhUrl: text("cnh_url"),
  crlvStatus: text("crlv_status").$type<"pending" | "approved" | "rejected">().default("pending"),
  crlvUrl: text("crlv_url"),
  vehiclePlate: text("vehicle_plate").notNull().default(""),
  vehicleModel: text("vehicle_model").notNull().default(""),
  vehicleYear: integer("vehicle_year"),
  vehicleType: text("vehicle_type").$type<"car" | "moto">().notNull().default("car"),
  vehicleColor: text("vehicle_color").default("Prata"),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("5.0"),
  totalRides: integer("total_rides").default(0),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertDriver = typeof driversTable.$inferInsert;
export type Driver = typeof driversTable.$inferSelect;
