import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { ridesTable } from "./rides";

export const ratingsTable = pgTable("ratings", {
  id: serial("id").primaryKey(),
  rideId: text("ride_id").references(() => ridesTable.id, { onDelete: "cascade" }),
  raterId: integer("rater_id").references(() => usersTable.id, { onDelete: "set null" }),
  ratedId: integer("rated_id").references(() => usersTable.id, { onDelete: "set null" }),
  stars: integer("stars").notNull(),
  comment: text("comment"),
  role: text("role").$type<"passenger" | "driver">().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type InsertRating = typeof ratingsTable.$inferInsert;
export type Rating = typeof ratingsTable.$inferSelect;
