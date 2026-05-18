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
  suspended: boolean("suspended").notNull().default(false),
  cancellationFeeOwed: real("cancellation_fee_owed").notNull().default(0),
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
  vehicleColor: text("vehicle_color"),
  profilePhotoUrl: text("profile_photo_url"),
  driverRating: real("driver_rating").notNull().default(5.0),
  passengerRating: real("passenger_rating").notNull().default(5.0),
  totalRides: integer("total_rides").notNull().default(0),
  subscriptionActive: boolean("subscription_active").notNull().default(false),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  expoPushToken: text("expo_push_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ridesTable = pgTable("rides", {
  id: text("id").primaryKey(),
  passengerId: integer("passenger_id").references(() => usersTable.id),
  driverId: integer("driver_id").references(() => usersTable.id),
  originAddress: text("origin_address").notNull(),
  originLat: real("origin_lat").notNull(),
  originLng: real("origin_lng").notNull(),
  destinationAddress: text("destination_address").notNull(),
  destinationLat: real("destination_lat").notNull(),
  destinationLng: real("destination_lng").notNull(),
  status: text("status").notNull().default("finding"),
  rideType: text("ride_type").notNull(),
  price: real("price").notNull(),
  distance: text("distance"),
  duration: text("duration"),
  pin: text("pin"),
  arrivedAt: timestamp("arrived_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledLate: boolean("cancelled_late").notNull().default(false),
  waitTimeFee: real("wait_time_fee").notNull().default(0),
  promoCode: text("promo_code"),
  promoDiscount: real("promo_discount").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const ratingsTable = pgTable("ratings", {
  id: serial("id").primaryKey(),
  rideId: text("ride_id").references(() => ridesTable.id),
  ratedId: integer("rated_id").references(() => usersTable.id),
  raterId: integer("rater_id").references(() => usersTable.id),
  stars: integer("stars").notNull(),
  comment: text("comment"),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  receiverId: text("receiver_id"),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  rideId: text("ride_id"),
});

export const refreshTokensTable = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const promoCodesTable = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: text("discount_type").notNull().default("fixed"),
  discountValue: real("discount_value").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertRideSchema = createInsertSchema(ridesTable).omit({ createdAt: true });
export const insertRatingSchema = createInsertSchema(ratingsTable).omit({ id: true, createdAt: true });
export const insertPromoCodeSchema = createInsertSchema(promoCodesTable).omit({ id: true, createdAt: true, usedCount: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Ride = typeof ridesTable.$inferSelect;
export type Rating = typeof ratingsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type PromoCode = typeof promoCodesTable.$inferSelect;
