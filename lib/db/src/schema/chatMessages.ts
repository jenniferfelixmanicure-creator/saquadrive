import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  receiverId: text("receiver_id"), // Pode ser null para mensagens de suporte geral
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  rideId: text("ride_id"), // Opcional, para mensagens relacionadas a corridas específicas
});

export type InsertChatMessage = typeof chatMessagesTable.$inferInsert;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
