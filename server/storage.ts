import {
  users,
  conversations,
  messages,
  reactions,
  webhooks,
  campaigns,
  type User,
  type UpsertUser,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Reaction,
  type InsertReaction,
  type Webhook,
  type InsertWebhook,
  type Campaign,
  type InsertCampaign,
  type CampaignWithCreator,
  type ConversationWithUsers,
  type MessageWithSender,
  type ReactionWithUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, or, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserSidebarPreference(userId: string, collapsed: boolean): Promise<void>;

  // Conversation operations
  getConversations(userId?: string): Promise<ConversationWithUsers[]>;
  getConversation(id: string): Promise<ConversationWithUsers | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationStatus(id: string, status: string): Promise<void>;
  updateConversationLastMessage(id: string, message: string): Promise<void>;
  updateConversationDeleted(id: string, deleted: boolean): Promise<void>;
  updateConversationAttendant(id: string, attendantId: string): Promise<void>;

  // Message operations
  getMessage(id: string): Promise<Message | undefined>;
  getMessages(conversationId: string): Promise<MessageWithSender[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageDeleted(id: string, deleted: boolean): Promise<void>;

  // Reaction operations
  getReactionsByMessage(messageId: string): Promise<ReactionWithUser[]>;
  getReactionByUserAndMessage(userId: string, messageId: string): Promise<Reaction | undefined>;
  createReaction(reaction: InsertReaction): Promise<Reaction>;
  deleteReaction(id: string): Promise<void>;

  // Webhook operations
  getWebhooks(): Promise<Webhook[]>;
  getWebhookById(id: string): Promise<Webhook | undefined>;
  createWebhook(webhook: InsertWebhook): Promise<Webhook>;
  updateWebhook(id: string, data: Partial<Webhook>): Promise<Webhook | undefined>;
  deleteWebhook(id: string): Promise<boolean>;

  // Campaign operations
  getCampaigns(): Promise<CampaignWithCreator[]>;
  getCampaignById(id: string): Promise<CampaignWithCreator | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private reactions: Map<string, Reaction>;
  private webhooks: Map<string, Webhook>;
  private campaigns: Map<string, Campaign>;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.reactions = new Map();
    this.webhooks = new Map();
    this.campaigns = new Map();
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...userData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => u.role === role);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const id = userData.id || randomUUID();
    const existing = this.users.get(id);
    const user: User = {
      ...existing,
      ...userData,
      id,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    } as User;
    this.users.set(id, user);
    return user;
  }

  async updateUserSidebarPreference(userId: string, collapsed: boolean): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.sidebarCollapsed = String(collapsed);
      user.updatedAt = new Date();
      this.users.set(userId, user);
    }
  }

  // Conversation operations
  async getConversations(userId?: string): Promise<ConversationWithUsers[]> {
    const convs = Array.from(this.conversations.values());
    const filtered = userId 
      ? convs.filter(c => c.clientId === userId || c.attendantId === userId)
      : convs;

    return Promise.all(
      filtered.map(async (conv) => {
        const client = await this.getUser(conv.clientId);
        const attendant = conv.attendantId ? (await this.getUser(conv.attendantId)) || null : null;
        return {
          ...conv,
          client: client!,
          attendant,
        };
      })
    );
  }

  async getConversation(id: string): Promise<ConversationWithUsers | undefined> {
    const conv = this.conversations.get(id);
    if (!conv) return undefined;

    const client = await this.getUser(conv.clientId);
    const attendant = conv.attendantId ? (await this.getUser(conv.attendantId)) || null : null;
    return {
      ...conv,
      client: client!,
      attendant,
    };
  }

  async createConversation(insertConv: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const protocolNumber = insertConv.protocolNumber || `CHAT-${new Date().getFullYear()}-${String(this.conversations.size + 1).padStart(4, '0')}`;
    const conversation: Conversation = {
      ...insertConv,
      id,
      protocolNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
      lastMessage: null,
      lastMessageAt: null,
    } as Conversation;
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversationStatus(id: string, status: string): Promise<void> {
    const conv = this.conversations.get(id);
    if (conv) {
      conv.status = status as any;
      conv.updatedAt = new Date();
      if (status === "closed") {
        conv.closedAt = new Date();
      }
      this.conversations.set(id, conv);
    }
  }

  async updateConversationLastMessage(id: string, message: string): Promise<void> {
    const conv = this.conversations.get(id);
    if (conv) {
      conv.lastMessage = message;
      conv.lastMessageAt = new Date();
      conv.updatedAt = new Date();
      this.conversations.set(id, conv);
    }
  }

  async updateConversationDeleted(id: string, deleted: boolean): Promise<void> {
    const conv = this.conversations.get(id);
    if (conv) {
      conv.deleted = deleted;
      conv.updatedAt = new Date();
      this.conversations.set(id, conv);
    }
  }

  async updateConversationAttendant(id: string, attendantId: string): Promise<void> {
    const conv = this.conversations.get(id);
    if (conv) {
      conv.attendantId = attendantId;
      conv.updatedAt = new Date();
      this.conversations.set(id, conv);
    }
  }

  // Message operations
  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessages(conversationId: string): Promise<MessageWithSender[]> {
    const msgs = Array.from(this.messages.values()).filter(
      (m) => m.conversationId === conversationId && !m.deleted
    );

    return Promise.all(
      msgs.map(async (msg) => {
        const sender = await this.getUser(msg.senderId);
        
        // Get replyTo message if exists
        let replyTo = undefined;
        if (msg.replyToId) {
          replyTo = this.messages.get(msg.replyToId);
        }
        
        // Get forwardedFrom message if exists
        let forwardedFrom = undefined;
        if (msg.forwardedFromId) {
          forwardedFrom = this.messages.get(msg.forwardedFromId);
        }
        
        // Get reactions for this message
        const reactions = await this.getReactionsByMessage(msg.id);
        
        return {
          ...msg,
          sender: sender!,
          replyTo: replyTo || null,
          forwardedFrom: forwardedFrom || null,
          reactions,
        };
      })
    );
  }

  async createMessage(insertMsg: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMsg,
      id,
      createdAt: new Date(),
    } as Message;
    this.messages.set(id, message);
    
    // Update conversation last message
    await this.updateConversationLastMessage(insertMsg.conversationId, insertMsg.content);
    
    return message;
  }

  async updateMessageDeleted(id: string, deleted: boolean): Promise<void> {
    const msg = this.messages.get(id);
    if (msg) {
      msg.deleted = deleted;
      this.messages.set(id, msg);
    }
  }

  // Reaction operations
  async getReactionsByMessage(messageId: string): Promise<ReactionWithUser[]> {
    const reacts = Array.from(this.reactions.values()).filter(
      (r) => r.messageId === messageId
    );

    return Promise.all(
      reacts.map(async (react) => {
        const user = await this.getUser(react.userId);
        return {
          ...react,
          user: user!,
        };
      })
    );
  }

  async getReactionByUserAndMessage(userId: string, messageId: string): Promise<Reaction | undefined> {
    return Array.from(this.reactions.values()).find(
      (r) => r.userId === userId && r.messageId === messageId
    );
  }

  async createReaction(insertReact: InsertReaction): Promise<Reaction> {
    const id = randomUUID();
    const reaction: Reaction = {
      ...insertReact,
      id,
      createdAt: new Date(),
    } as Reaction;
    this.reactions.set(id, reaction);
    return reaction;
  }

  async deleteReaction(id: string): Promise<void> {
    this.reactions.delete(id);
  }

  // Webhook operations
  async getWebhooks(): Promise<Webhook[]> {
    return Array.from(this.webhooks.values());
  }

  async getWebhookById(id: string): Promise<Webhook | undefined> {
    return this.webhooks.get(id);
  }

  async createWebhook(webhookData: InsertWebhook): Promise<Webhook> {
    const id = randomUUID();
    const webhook: Webhook = {
      ...webhookData,
      id,
      headers: webhookData.headers || {},
      events: webhookData.events || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Webhook;
    this.webhooks.set(id, webhook);
    return webhook;
  }

  async updateWebhook(id: string, data: Partial<Webhook>): Promise<Webhook | undefined> {
    const webhook = this.webhooks.get(id);
    if (!webhook) return undefined;
    const updated = { ...webhook, ...data, updatedAt: new Date() };
    this.webhooks.set(id, updated);
    return updated;
  }

  async deleteWebhook(id: string): Promise<boolean> {
    return this.webhooks.delete(id);
  }

  // Campaign operations
  async getCampaigns(): Promise<CampaignWithCreator[]> {
    const campaignList = Array.from(this.campaigns.values());
    return await Promise.all(
      campaignList.map(async (campaign) => {
        const creator = await this.getUser(campaign.createdBy);
        return {
          ...campaign,
          creator: creator!,
        };
      })
    );
  }

  async getCampaignById(id: string): Promise<CampaignWithCreator | undefined> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return undefined;
    const creator = await this.getUser(campaign.createdBy);
    return {
      ...campaign,
      creator: creator!,
    };
  }

  async createCampaign(campaignData: InsertCampaign): Promise<Campaign> {
    const id = randomUUID();
    const campaign: Campaign = {
      ...campaignData,
      id,
      sentCount: "0",
      deliveredCount: "0",
      failedCount: "0",
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Campaign;
    this.campaigns.set(id, campaign);
    return campaign;
  }

  async updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign | undefined> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return undefined;
    const updated = { ...campaign, ...data, updatedAt: new Date() };
    this.campaigns.set(id, updated);
    return updated;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    return this.campaigns.delete(id);
  }
}

// PostgreSQL Database Storage Implementation
export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const [user] = await db.insert(users).values(userData as any).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role as any));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData as any)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        } as any,
      })
      .returning();
    return user;
  }

  async updateUserSidebarPreference(userId: string, collapsed: boolean): Promise<void> {
    await db
      .update(users)
      .set({ 
        sidebarCollapsed: String(collapsed),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Conversation operations
  async getConversations(userId?: string): Promise<ConversationWithUsers[]> {
    const query = userId
      ? db.select().from(conversations)
          .where(and(
            or(eq(conversations.clientId, userId), eq(conversations.attendantId, userId)),
            eq(conversations.deleted, false)
          ))
          .orderBy(desc(conversations.updatedAt))
      : db.select().from(conversations)
          .where(eq(conversations.deleted, false))
          .orderBy(desc(conversations.updatedAt));

    const convs = await query;

    return Promise.all(
      convs.map(async (conv) => {
        const client = await this.getUser(conv.clientId);
        const attendant = conv.attendantId ? (await this.getUser(conv.attendantId)) || null : null;
        return {
          ...conv,
          client: client!,
          attendant,
        };
      })
    );
  }

  async getConversation(id: string): Promise<ConversationWithUsers | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) return undefined;

    const client = await this.getUser(conv.clientId);
    const attendant = conv.attendantId ? (await this.getUser(conv.attendantId)) || null : null;
    return {
      ...conv,
      client: client!,
      attendant,
    };
  }

  async createConversation(insertConv: InsertConversation): Promise<Conversation> {
    // Always generate protocol number if not provided (ensures NOT NULL constraint)
    const protocolNumber = insertConv.protocolNumber || `CHAT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    
    const [conversation] = await db
      .insert(conversations)
      .values({
        ...insertConv,
        protocolNumber,
      } as any)
      .returning();
    return conversation;
  }

  async updateConversationStatus(id: string, status: string): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    
    if (status === "closed") {
      updateData.closedAt = new Date();
    }

    await db
      .update(conversations)
      .set(updateData)
      .where(eq(conversations.id, id));
  }

  async updateConversationLastMessage(id: string, message: string): Promise<void> {
    await db
      .update(conversations)
      .set({
        lastMessage: message,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id));
  }

  async updateConversationDeleted(id: string, deleted: boolean): Promise<void> {
    await db
      .update(conversations)
      .set({
        deleted,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id));
  }

  async updateConversationAttendant(id: string, attendantId: string): Promise<void> {
    await db
      .update(conversations)
      .set({
        attendantId,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id));
  }

  // Message operations
  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async getMessages(conversationId: string): Promise<MessageWithSender[]> {
    const msgs = await db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.deleted, false)))
      .orderBy(messages.createdAt);

    return Promise.all(
      msgs.map(async (msg) => {
        const sender = await this.getUser(msg.senderId);
        
        // Get replyTo message if exists
        let replyTo = null;
        if (msg.replyToId) {
          replyTo = await this.getMessage(msg.replyToId);
        }
        
        // Get forwardedFrom message if exists
        let forwardedFrom = null;
        if (msg.forwardedFromId) {
          forwardedFrom = await this.getMessage(msg.forwardedFromId);
        }
        
        // Get reactions for this message
        const reacts = await this.getReactionsByMessage(msg.id);
        
        return {
          ...msg,
          sender: sender!,
          replyTo,
          forwardedFrom,
          reactions: reacts,
        };
      })
    );
  }

  async createMessage(insertMsg: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMsg as any)
      .returning();
    
    // Update conversation last message
    await this.updateConversationLastMessage(insertMsg.conversationId, insertMsg.content);
    
    return message;
  }

  async updateMessageDeleted(id: string, deleted: boolean): Promise<void> {
    await db
      .update(messages)
      .set({ deleted })
      .where(eq(messages.id, id));
  }

  // Reaction operations
  async getReactionsByMessage(messageId: string): Promise<ReactionWithUser[]> {
    const reacts = await db
      .select()
      .from(reactions)
      .where(eq(reactions.messageId, messageId));

    return Promise.all(
      reacts.map(async (react) => {
        const user = await this.getUser(react.userId);
        return {
          ...react,
          user: user!,
        };
      })
    );
  }

  async getReactionByUserAndMessage(userId: string, messageId: string): Promise<Reaction | undefined> {
    const [reaction] = await db
      .select()
      .from(reactions)
      .where(and(eq(reactions.userId, userId), eq(reactions.messageId, messageId)));
    return reaction;
  }

  async createReaction(insertReact: InsertReaction): Promise<Reaction> {
    const [reaction] = await db
      .insert(reactions)
      .values(insertReact)
      .returning();
    return reaction;
  }

  async deleteReaction(id: string): Promise<void> {
    await db.delete(reactions).where(eq(reactions.id, id));
  }

  // Webhook operations
  async getWebhooks(): Promise<Webhook[]> {
    return await db.select().from(webhooks);
  }

  async getWebhookById(id: string): Promise<Webhook | undefined> {
    const results = await db.select().from(webhooks).where(eq(webhooks.id, id));
    return results[0];
  }

  async createWebhook(webhookData: InsertWebhook): Promise<Webhook> {
    const results = await db.insert(webhooks).values(webhookData).returning();
    return results[0];
  }

  async updateWebhook(id: string, data: Partial<Webhook>): Promise<Webhook | undefined> {
    const results = await db
      .update(webhooks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(webhooks.id, id))
      .returning();
    return results[0];
  }

  async deleteWebhook(id: string): Promise<boolean> {
    const results = await db.delete(webhooks).where(eq(webhooks.id, id)).returning();
    return results.length > 0;
  }

  // Campaign operations
  async getCampaigns(): Promise<CampaignWithCreator[]> {
    const campaignList = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
    return await Promise.all(
      campaignList.map(async (campaign) => {
        const creator = await this.getUser(campaign.createdBy);
        return {
          ...campaign,
          creator: creator!,
        };
      })
    );
  }

  async getCampaignById(id: string): Promise<CampaignWithCreator | undefined> {
    const results = await db.select().from(campaigns).where(eq(campaigns.id, id));
    if (results.length === 0) return undefined;
    const campaign = results[0];
    const creator = await this.getUser(campaign.createdBy);
    return {
      ...campaign,
      creator: creator!,
    };
  }

  async createCampaign(campaignData: InsertCampaign): Promise<Campaign> {
    const results = await db.insert(campaigns).values(campaignData as any).returning();
    return results[0];
  }

  async updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign | undefined> {
    const results = await db
      .update(campaigns)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(campaigns.id, id))
      .returning();
    return results[0];
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const results = await db.delete(campaigns).where(eq(campaigns.id, id)).returning();
    return results.length > 0;
  }
}

// Use DatabaseStorage for production, MemStorage for testing
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
