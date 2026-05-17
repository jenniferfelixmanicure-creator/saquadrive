import { pgTable, text, serial, integer, real, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: varchar("phone", { length: 20 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("passenger"),
  isApproved: boolean("is_approved").notNull().default(false),
  rgStatus: text("rg_status").notNull().default("pending"),
  cnhStatus: text("cnh_status").notNull().default("pending"),
  crlvStatus: text("crlv_status").notNull().default("pending"),
  rgUrl: text("rg_url"),
  cnhUrl: text("cnh_url"),
  crlvUrl: text("crlv_url"),
  vehiclePlate: text("vehicle_plate"),
  vehicleModel: text("vehicle_model"),
  vehicleYear: integer("vehicle_year"),
  vehicleType: text("vehicle_type"),
  profilePhotoUrl: text("profile_photo_url"),
  driverRating: real("driver_rating").notNull().default(5.0),
  passengerRating: real("passenger_rating").notNull().default(5.0),
  totalRides: integer("total_rides").notNull().default(0),
  subscriptionActive: boolean("subscription_active").notNull().default(false),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ridesTable = pgTable("rides", {
  id: text("id").primaryKey(),
  passengerId: integer("passenger_id").references(() => usersTable.id),
  driverId: integer("driver_id").references(() => usersTable.id),
  originAddress: text("origin_address").notNull(),
  originLat: real("origin_lat").notNull(),
  originLng: real("origin_lng").notNull(),
  destAddress: text("dest_address").notNull(),
  destLat: real("dest_lat").notNull(),
  destLng: real("dest_lng").notNull(),
  status: text("status").notNull().default("completed"),
  rideType: text("ride_type").notNull(),
  price: real("price").notNull(),
  distance: text("distance"),
  duration: text("duration"),
  pin: text("pin"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const ratingsTable = pgTable("ratings", {
  id: serial("id").primaryKey(),
  rideId: text("ride_id").references(() => ridesTable.id),
  ratedId: integer("rated_id").references(() => usersTable.id),
  raterId: integer("rater_id").references(() => usersTable.id),
  stars: integer("stars").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const refreshTokensTable = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertRideSchema = createInsertSchema(ridesTable).omit({ createdAt: true });
export const insertRatingSchema = createInsertSchema(ratingsTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Ride = typeof ridesTable.$inferSelect;
export type Rating = typeof ratingsTable.$inferSelect;
