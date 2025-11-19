import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles
export const userRoles = ["attendant", "client", "admin"] as const;
export type UserRole = typeof userRoles[number];

// Users table (extended from Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").$type<UserRole>().notNull().default("client"),
  sidebarCollapsed: varchar("sidebar_collapsed").notNull().default("false"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

// Conversation statuses
export const conversationStatuses = ["pending", "attending", "closed"] as const;
export type ConversationStatus = typeof conversationStatuses[number];

// Conversations table
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  protocolNumber: varchar("protocol_number").notNull().unique(),
  status: varchar("status").$type<ConversationStatus>().notNull().default("pending"),
  clientId: varchar("client_id").notNull().references(() => users.id),
  attendantId: varchar("attendant_id").references(() => users.id),
  clientLocation: text("client_location"),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastMessage: true,
  lastMessageAt: true,
  closedAt: true,
}).partial({
  protocolNumber: true,
  attendantId: true,
  clientLocation: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Message types
export const messageTypes = ["text", "image", "audio", "video", "file"] as const;
export type MessageType = typeof messageTypes[number];

// Messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  type: varchar("type").$type<MessageType>().notNull().default("text"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Extended types with relations
export type ConversationWithUsers = Conversation & {
  client: User;
  attendant: User | null;
};

export type ConversationWithDetails = ConversationWithUsers & {
  messageCount: number;
};

export type MessageWithSender = Message & {
  sender: User;
};
