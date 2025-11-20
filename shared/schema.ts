import { sql } from 'drizzle-orm';
import {
  boolean,
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

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").$type<UserRole>().notNull().default("client"),
  sidebarCollapsed: varchar("sidebar_collapsed").notNull().default("false"),
  resetToken: varchar("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
  resetToken: true,
  resetTokenExpiry: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6),
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
  deleted: boolean("deleted").notNull().default(false),
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
  replyToId: varchar("reply_to_id").references((): any => messages.id),
  forwardedFromId: varchar("forwarded_from_id").references((): any => messages.id),
  fileMetadata: jsonb("file_metadata").$type<{
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    url?: string;
    thumbnailUrl?: string;
    duration?: number;
    width?: number;
    height?: number;
    id3?: {
      title?: string;
      artist?: string;
      album?: string;
      coverArt?: string;
    };
  }>(),
  deleted: boolean("deleted").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Reactions table
export const reactions = pgTable("reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  emoji: varchar("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReactionSchema = createInsertSchema(reactions).omit({
  id: true,
  createdAt: true,
});

export type InsertReaction = z.infer<typeof insertReactionSchema>;
export type Reaction = typeof reactions.$inferSelect;

// Extended types with relations
export type ConversationWithUsers = Conversation & {
  client: User;
  attendant: User | null;
  tags?: Tag[];
};

export type ConversationWithDetails = ConversationWithUsers & {
  messageCount: number;
};

export type MessageWithSender = Message & {
  sender: User;
  replyTo?: Message | null;
  forwardedFrom?: Message | null;
  reactions?: ReactionWithUser[];
};

export type ReactionWithUser = Reaction & {
  user: User;
};

// Webhook event categories
export const webhookEventCategories = {
  conversations: [
    "conversation.created",
    "conversation.updated",
    "conversation.assigned",
    "conversation.transferred",
    "conversation.closed",
    "conversation.reopened",
    "conversation.deleted",
  ],
  messages: [
    "message.sent",
    "message.created",
    "message.deleted",
    "message.forwarded",
  ],
  reactions: [
    "reaction.added",
    "reaction.removed",
  ],
  users: [
    "user.created",
    "user.updated",
    "user.deleted",
  ],
  contacts: [
    "contact.created",
    "contact.updated",
    "contact.deleted",
  ],
  campaigns: [
    "campaign.created",
    "campaign.updated",
    "campaign.deleted",
    "campaign.started",
    "campaign.completed",
    "campaign.paused",
  ],
  attendants: [
    "attendant.created",
    "attendant.updated",
    "attendant.promoted",
    "attendant.deleted",
  ],
} as const;

// Webhooks table
export const webhooks = pgTable("webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  url: varchar("url").notNull(),
  apiToken: varchar("api_token"),
  jwtToken: text("jwt_token"),
  authType: varchar("auth_type").$type<"none" | "bearer" | "jwt" | "apiKey">().notNull().default("none"),
  headers: jsonb("headers").$type<Record<string, string>>().default({}),
  events: text("events").array().notNull().default([]),
  isActive: varchar("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type Webhook = typeof webhooks.$inferSelect;

// Campaign statuses
export const campaignStatuses = ["draft", "scheduled", "active", "paused", "completed"] as const;
export type CampaignStatus = typeof campaignStatuses[number];

// Campaign types
export const campaignTypes = ["broadcast", "automated", "targeted"] as const;
export type CampaignType = typeof campaignTypes[number];

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  type: varchar("type").$type<CampaignType>().notNull().default("broadcast"),
  status: varchar("status").$type<CampaignStatus>().notNull().default("draft"),
  message: text("message").notNull(),
  mediaUrl: varchar("media_url"),
  mediaType: varchar("media_type").$type<MessageType>(),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  targetAudience: jsonb("target_audience").$type<{
    roles?: UserRole[];
    userIds?: string[];
    conversationStatuses?: ConversationStatus[];
  }>(),
  sentCount: varchar("sent_count").notNull().default("0"),
  deliveredCount: varchar("delivered_count").notNull().default("0"),
  failedCount: varchar("failed_count").notNull().default("0"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentCount: true,
  deliveredCount: true,
  failedCount: true,
  startedAt: true,
  completedAt: true,
}).partial({
  description: true,
  mediaUrl: true,
  mediaType: true,
  scheduledAt: true,
  targetAudience: true,
});

export const updateCampaignSchema = insertCampaignSchema.omit({
  createdBy: true,
}).partial();

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type UpdateCampaign = z.infer<typeof updateCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

export type CampaignWithCreator = Campaign & {
  creator: User;
};

// AI Agents table
export const aiAgents = pgTable("ai_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  systemInstructions: text("system_instructions").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  provider: varchar("provider").notNull().default("groq"),
  model: varchar("model").notNull().default("llama-3.3-70b-versatile"),
  temperature: varchar("temperature").notNull().default("0.7"),
  maxTokens: varchar("max_tokens").notNull().default("500"),
  autoReplyEnabled: boolean("auto_reply_enabled").notNull().default(false),
  autoReplyDelay: varchar("auto_reply_delay").notNull().default("0"),
  triggers: text("triggers").array().default([]),
  triggerConditions: jsonb("trigger_conditions").$type<{
    keywords?: string[];
    conversationStatus?: ConversationStatus[];
    clientIds?: string[];
  }>(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiAgentSchema = createInsertSchema(aiAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  description: true,
  triggerConditions: true,
});

export const updateAiAgentSchema = insertAiAgentSchema.omit({
  createdBy: true,
}).partial();

export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;
export type UpdateAiAgent = z.infer<typeof updateAiAgentSchema>;
export type AiAgent = typeof aiAgents.$inferSelect;

export type AiAgentWithCreator = AiAgent & {
  creator: User;
};

// Channels table for WhatsApp integration
export const channels = pgTable("channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  type: varchar("type").notNull().default("whatsapp"),
  isActive: boolean("is_active").notNull().default(false),
  apiUrl: varchar("api_url").notNull(),
  apiKey: varchar("api_key").notNull(),
  instanceId: varchar("instance_id").notNull(),
  webhookUrl: varchar("webhook_url"),
  config: jsonb("config").$type<{
    qrCode?: string;
    connectionStatus?: string;
    phoneNumber?: string;
  }>(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertChannelSchema = createInsertSchema(channels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  webhookUrl: true,
  config: true,
});

export const updateChannelSchema = insertChannelSchema.omit({
  createdBy: true,
}).partial();

export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type UpdateChannel = z.infer<typeof updateChannelSchema>;
export type Channel = typeof channels.$inferSelect;

export type ChannelWithCreator = Channel & {
  creator: User;
};

// Tags table for conversation tagging
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  color: varchar("color").notNull().default("#3b82f6"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;

// Conversation tags join table
export const conversationTags = pgTable("conversation_tags", {
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ConversationTag = typeof conversationTags.$inferSelect;

// Ready messages (message templates)
export const readyMessages = pgTable("ready_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  shortcuts: text("shortcuts").array().default([]),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReadyMessageSchema = createInsertSchema(readyMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReadyMessage = z.infer<typeof insertReadyMessageSchema>;
export type ReadyMessage = typeof readyMessages.$inferSelect;

// Email report schema
export const emailReportSchema = z.object({
  recipientName: z.string().min(1, "Nome é obrigatório"),
  recipientEmail: z.string().email("Email inválido"),
  subject: z.string().min(1, "Assunto é obrigatório"),
  message: z.string().min(1, "Mensagem é obrigatória"),
});

export type EmailReport = z.infer<typeof emailReportSchema>;
