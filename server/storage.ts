import {
  users,
  conversations,
  messages,
  reactions,
  webhooks,
  campaigns,
  aiAgents,
  channels,
  tags,
  conversationTags,
  readyMessages,
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
  type AiAgent,
  type InsertAiAgent,
  type AiAgentWithCreator,
  type Channel,
  type InsertChannel,
  type ChannelWithCreator,
  type Tag,
  type InsertTag,
  type ReadyMessage,
  type InsertReadyMessage,
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
  updateConversationMode(id: string, mode: string): Promise<void>;

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

  // AI Agent operations
  getAiAgents(): Promise<AiAgentWithCreator[]>;
  getAiAgentById(id: string): Promise<AiAgentWithCreator | undefined>;
  createAiAgent(agent: InsertAiAgent): Promise<AiAgent>;
  updateAiAgent(id: string, data: Partial<AiAgent>): Promise<AiAgent | undefined>;
  deleteAiAgent(id: string): Promise<boolean>;

  // Channel operations
  getChannels(): Promise<ChannelWithCreator[]>;
  getChannelById(id: string): Promise<ChannelWithCreator | undefined>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  updateChannel(id: string, data: Partial<Channel>): Promise<Channel | undefined>;
  deleteChannel(id: string): Promise<boolean>;

  // Tag operations
  getTags(): Promise<Tag[]>;
  getTagById(id: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, data: Partial<Tag>): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<boolean>;

  // Conversation tag operations
  addTagToConversation(conversationId: string, tagId: string): Promise<void>;
  removeTagFromConversation(conversationId: string, tagId: string): Promise<void>;
  getConversationTags(conversationId: string): Promise<Tag[]>;

  // Ready message operations
  getReadyMessages(): Promise<ReadyMessage[]>;
  getReadyMessageById(id: string): Promise<ReadyMessage | undefined>;
  createReadyMessage(message: InsertReadyMessage): Promise<ReadyMessage>;
  updateReadyMessage(id: string, data: Partial<ReadyMessage>): Promise<ReadyMessage | undefined>;
  deleteReadyMessage(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private reactions: Map<string, Reaction>;
  private webhooks: Map<string, Webhook>;
  private campaigns: Map<string, Campaign>;
  private aiAgents: Map<string, AiAgent>;
  private channels: Map<string, Channel>;
  private tags: Map<string, Tag>;
  private conversationTagsMap: Map<string, Set<string>>;
  private readyMessagesMap: Map<string, ReadyMessage>;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.reactions = new Map();
    this.webhooks = new Map();
    this.campaigns = new Map();
    this.aiAgents = new Map();
    this.channels = new Map();
    this.tags = new Map();
    this.conversationTagsMap = new Map();
    this.readyMessagesMap = new Map();
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

  async updateConversationMode(id: string, mode: string): Promise<void> {
    const conv = this.conversations.get(id);
    if (conv) {
      conv.mode = mode as any;
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

  // AI Agent operations
  async getAiAgents(): Promise<AiAgentWithCreator[]> {
    return Promise.all(
      Array.from(this.aiAgents.values()).map(async (agent) => {
        const creator = await this.getUser(agent.createdBy);
        return {
          ...agent,
          creator: creator!,
        };
      })
    );
  }

  async getAiAgentById(id: string): Promise<AiAgentWithCreator | undefined> {
    const agent = this.aiAgents.get(id);
    if (!agent) return undefined;
    const creator = await this.getUser(agent.createdBy);
    return {
      ...agent,
      creator: creator!,
    };
  }

  async createAiAgent(agentData: InsertAiAgent): Promise<AiAgent> {
    const id = randomUUID();
    const agent: AiAgent = {
      ...agentData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AiAgent;
    this.aiAgents.set(id, agent);
    return agent;
  }

  async updateAiAgent(id: string, data: Partial<AiAgent>): Promise<AiAgent | undefined> {
    const agent = this.aiAgents.get(id);
    if (!agent) return undefined;
    const updated = { ...agent, ...data, updatedAt: new Date() };
    this.aiAgents.set(id, updated);
    return updated;
  }

  async deleteAiAgent(id: string): Promise<boolean> {
    return this.aiAgents.delete(id);
  }

  // Channel operations
  async getChannels(): Promise<ChannelWithCreator[]> {
    return Promise.all(
      Array.from(this.channels.values()).map(async (channel) => {
        const creator = await this.getUser(channel.createdBy);
        return {
          ...channel,
          creator: creator!,
        };
      })
    );
  }

  async getChannelById(id: string): Promise<ChannelWithCreator | undefined> {
    const channel = this.channels.get(id);
    if (!channel) return undefined;
    const creator = await this.getUser(channel.createdBy);
    return {
      ...channel,
      creator: creator!,
    };
  }

  async createChannel(channelData: InsertChannel): Promise<Channel> {
    const id = randomUUID();
    const channel: Channel = {
      ...channelData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Channel;
    this.channels.set(id, channel);
    return channel;
  }

  async updateChannel(id: string, data: Partial<Channel>): Promise<Channel | undefined> {
    const channel = this.channels.get(id);
    if (!channel) return undefined;
    const updated = { ...channel, ...data, updatedAt: new Date() };
    this.channels.set(id, updated);
    return updated;
  }

  async deleteChannel(id: string): Promise<boolean> {
    return this.channels.delete(id);
  }

  // Tag operations
  async getTags(): Promise<Tag[]> {
    return Array.from(this.tags.values());
  }

  async getTagById(id: string): Promise<Tag | undefined> {
    return this.tags.get(id);
  }

  async createTag(tagData: InsertTag): Promise<Tag> {
    const id = randomUUID();
    const tag: Tag = {
      ...tagData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Tag;
    this.tags.set(id, tag);
    return tag;
  }

  async updateTag(id: string, data: Partial<Tag>): Promise<Tag | undefined> {
    const tag = this.tags.get(id);
    if (!tag) return undefined;
    const updated = { ...tag, ...data, updatedAt: new Date() };
    this.tags.set(id, updated);
    return updated;
  }

  async deleteTag(id: string): Promise<boolean> {
    return this.tags.delete(id);
  }

  // Conversation tag operations
  async addTagToConversation(conversationId: string, tagId: string): Promise<void> {
    if (!this.conversationTagsMap.has(conversationId)) {
      this.conversationTagsMap.set(conversationId, new Set());
    }
    this.conversationTagsMap.get(conversationId)!.add(tagId);
  }

  async removeTagFromConversation(conversationId: string, tagId: string): Promise<void> {
    const tags = this.conversationTagsMap.get(conversationId);
    if (tags) {
      tags.delete(tagId);
    }
  }

  async getConversationTags(conversationId: string): Promise<Tag[]> {
    const tagIds = this.conversationTagsMap.get(conversationId);
    if (!tagIds) return [];
    return Array.from(tagIds)
      .map(id => this.tags.get(id))
      .filter((tag): tag is Tag => tag !== undefined);
  }

  // Ready message operations
  async getReadyMessages(): Promise<ReadyMessage[]> {
    return Array.from(this.readyMessagesMap.values());
  }

  async getReadyMessageById(id: string): Promise<ReadyMessage | undefined> {
    return this.readyMessagesMap.get(id);
  }

  async createReadyMessage(messageData: InsertReadyMessage): Promise<ReadyMessage> {
    const id = randomUUID();
    const message: ReadyMessage = {
      ...messageData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ReadyMessage;
    this.readyMessagesMap.set(id, message);
    return message;
  }

  async updateReadyMessage(id: string, data: Partial<ReadyMessage>): Promise<ReadyMessage | undefined> {
    const message = this.readyMessagesMap.get(id);
    if (!message) return undefined;
    const updated = { ...message, ...data, updatedAt: new Date() };
    this.readyMessagesMap.set(id, updated);
    return updated;
  }

  async deleteReadyMessage(id: string): Promise<boolean> {
    return this.readyMessagesMap.delete(id);
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

  async updateConversationMode(id: string, mode: string): Promise<void> {
    await db
      .update(conversations)
      .set({
        mode: mode as any,
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
    const results = await db.insert(webhooks).values(webhookData as any).returning();
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

  // AI Agent operations
  async getAiAgents(): Promise<AiAgentWithCreator[]> {
    const agents = await db.select().from(aiAgents).orderBy(desc(aiAgents.createdAt));
    return Promise.all(
      agents.map(async (agent) => {
        const creator = await this.getUser(agent.createdBy);
        return {
          ...agent,
          creator: creator!,
        };
      })
    );
  }

  async getAiAgentById(id: string): Promise<AiAgentWithCreator | undefined> {
    const results = await db.select().from(aiAgents).where(eq(aiAgents.id, id));
    if (results.length === 0) return undefined;
    const agent = results[0];
    const creator = await this.getUser(agent.createdBy);
    return {
      ...agent,
      creator: creator!,
    };
  }

  async createAiAgent(agentData: InsertAiAgent): Promise<AiAgent> {
    const results = await db.insert(aiAgents).values(agentData as any).returning();
    return results[0];
  }

  async updateAiAgent(id: string, data: Partial<AiAgent>): Promise<AiAgent | undefined> {
    const results = await db
      .update(aiAgents)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(aiAgents.id, id))
      .returning();
    return results[0];
  }

  async deleteAiAgent(id: string): Promise<boolean> {
    const results = await db.delete(aiAgents).where(eq(aiAgents.id, id)).returning();
    return results.length > 0;
  }

  // Channel operations
  async getChannels(): Promise<ChannelWithCreator[]> {
    const channelsList = await db.select().from(channels).orderBy(desc(channels.createdAt));
    return Promise.all(
      channelsList.map(async (channel) => {
        const creator = await this.getUser(channel.createdBy);
        return {
          ...channel,
          creator: creator!,
        };
      })
    );
  }

  async getChannelById(id: string): Promise<ChannelWithCreator | undefined> {
    const results = await db.select().from(channels).where(eq(channels.id, id));
    if (results.length === 0) return undefined;
    const channel = results[0];
    const creator = await this.getUser(channel.createdBy);
    return {
      ...channel,
      creator: creator!,
    };
  }

  async createChannel(channelData: InsertChannel): Promise<Channel> {
    const results = await db.insert(channels).values(channelData as any).returning();
    return results[0];
  }

  async updateChannel(id: string, data: Partial<Channel>): Promise<Channel | undefined> {
    const results = await db
      .update(channels)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(channels.id, id))
      .returning();
    return results[0];
  }

  async deleteChannel(id: string): Promise<boolean> {
    const results = await db.delete(channels).where(eq(channels.id, id)).returning();
    return results.length > 0;
  }

  // Tag operations
  async getTags(): Promise<Tag[]> {
    return await db.select().from(tags).orderBy(desc(tags.createdAt));
  }

  async getTagById(id: string): Promise<Tag | undefined> {
    const results = await db.select().from(tags).where(eq(tags.id, id));
    return results[0];
  }

  async createTag(tagData: InsertTag): Promise<Tag> {
    const results = await db.insert(tags).values(tagData as any).returning();
    return results[0];
  }

  async updateTag(id: string, data: Partial<Tag>): Promise<Tag | undefined> {
    const results = await db
      .update(tags)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(tags.id, id))
      .returning();
    return results[0];
  }

  async deleteTag(id: string): Promise<boolean> {
    const results = await db.delete(tags).where(eq(tags.id, id)).returning();
    return results.length > 0;
  }

  // Conversation tag operations
  async addTagToConversation(conversationId: string, tagId: string): Promise<void> {
    await db.insert(conversationTags).values({ conversationId, tagId });
  }

  async removeTagFromConversation(conversationId: string, tagId: string): Promise<void> {
    await db
      .delete(conversationTags)
      .where(
        and(
          eq(conversationTags.conversationId, conversationId),
          eq(conversationTags.tagId, tagId)
        )
      );
  }

  async getConversationTags(conversationId: string): Promise<Tag[]> {
    const results = await db
      .select({ tag: tags })
      .from(conversationTags)
      .innerJoin(tags, eq(conversationTags.tagId, tags.id))
      .where(eq(conversationTags.conversationId, conversationId));
    return results.map((r) => r.tag);
  }

  // Ready message operations
  async getReadyMessages(): Promise<ReadyMessage[]> {
    return await db.select().from(readyMessages).orderBy(desc(readyMessages.createdAt));
  }

  async getReadyMessageById(id: string): Promise<ReadyMessage | undefined> {
    const results = await db.select().from(readyMessages).where(eq(readyMessages.id, id));
    return results[0];
  }

  async createReadyMessage(messageData: InsertReadyMessage): Promise<ReadyMessage> {
    const results = await db.insert(readyMessages).values(messageData as any).returning();
    return results[0];
  }

  async updateReadyMessage(id: string, data: Partial<ReadyMessage>): Promise<ReadyMessage | undefined> {
    const results = await db
      .update(readyMessages)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(readyMessages.id, id))
      .returning();
    return results[0];
  }

  async deleteReadyMessage(id: string): Promise<boolean> {
    const results = await db.delete(readyMessages).where(eq(readyMessages.id, id)).returning();
    return results.length > 0;
  }
}

// Use DatabaseStorage for production, MemStorage for testing
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
