import {
  users,
  conversations,
  messages,
  type User,
  type UpsertUser,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type ConversationWithUsers,
  type MessageWithSender,
} from "@shared/schema";
import { db } from "./db";
import { eq, or, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserSidebarPreference(userId: string, collapsed: boolean): Promise<void>;

  // Conversation operations
  getConversations(userId?: string): Promise<ConversationWithUsers[]>;
  getConversation(id: string): Promise<ConversationWithUsers | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationStatus(id: string, status: string): Promise<void>;
  updateConversationLastMessage(id: string, message: string): Promise<void>;

  // Message operations
  getMessages(conversationId: string): Promise<MessageWithSender[]>;
  createMessage(message: InsertMessage): Promise<Message>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = this.users.get(userData.id);
    const user: User = {
      ...existing,
      ...userData,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    } as User;
    this.users.set(userData.id, user);
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
        const attendant = conv.attendantId ? await this.getUser(conv.attendantId) : null;
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
    const attendant = conv.attendantId ? await this.getUser(conv.attendantId) : null;
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

  // Message operations
  async getMessages(conversationId: string): Promise<MessageWithSender[]> {
    const msgs = Array.from(this.messages.values()).filter(
      (m) => m.conversationId === conversationId
    );

    return Promise.all(
      msgs.map(async (msg) => {
        const sender = await this.getUser(msg.senderId);
        return {
          ...msg,
          sender: sender!,
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
}

// PostgreSQL Database Storage Implementation
export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
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
          .where(or(eq(conversations.clientId, userId), eq(conversations.attendantId, userId)))
          .orderBy(desc(conversations.updatedAt))
      : db.select().from(conversations).orderBy(desc(conversations.updatedAt));

    const convs = await query;

    return Promise.all(
      convs.map(async (conv) => {
        const client = await this.getUser(conv.clientId);
        const attendant = conv.attendantId ? await this.getUser(conv.attendantId) : null;
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
    const attendant = conv.attendantId ? await this.getUser(conv.attendantId) : null;
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
      })
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

  // Message operations
  async getMessages(conversationId: string): Promise<MessageWithSender[]> {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return Promise.all(
      msgs.map(async (msg) => {
        const sender = await this.getUser(msg.senderId);
        return {
          ...msg,
          sender: sender!,
        };
      })
    );
  }

  async createMessage(insertMsg: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMsg)
      .returning();
    
    // Update conversation last message
    await this.updateConversationLastMessage(insertMsg.conversationId, insertMsg.content);
    
    return message;
  }
}

// Use DatabaseStorage for production, MemStorage for testing
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
