import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ridesTable = pgTable("rides", {
  id: text("id").primaryKey(),
  passengerId: integer("passenger_id").references(() => usersTable.id, { onDelete: "set null" }),
  driverId: integer("driver_id").references(() => usersTable.id, { onDelete: "set null" }),
  originAddress: text("origin_address").notNull(),
  originLat: numeric("origin_lat", { precision: 10, scale: 7 }).notNull(),
  originLng: numeric("origin_lng", { precision: 10, scale: 7 }).notNull(),
  destinationAddress: text("destination_address").notNull(),
  destinationLat: numeric("destination_lat", { precision: 10, scale: 7 }).notNull(),
  destinationLng: numeric("destination_lng", { precision: 10, scale: 7 }).notNull(),
  rideType: text("ride_type").$type<"moto" | "basico" | "intermediario" | "vip">().notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  distance: text("distance"),
  duration: text("duration"),
  status: text("status").$type<"finding" | "accepted" | "in_progress" | "completed" | "cancelled">().default("finding").notNull(),
  pin: text("pin"),
  passengerRating: integer("passenger_rating"),
  driverRating: integer("driver_rating"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type InsertRide = typeof ridesTable.$inferInsert;
export type Ride = typeof ridesTable.$inferSelect;
