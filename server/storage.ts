import {
  users,
  conversations,
  messages,
  reactions,
  type User,
  type UpsertUser,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Reaction,
  type InsertReaction,
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

  // Message operations
  getMessage(id: string): Promise<Message | undefined>;
  getMessages(conversationId: string): Promise<MessageWithSender[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Reaction operations
  getReactionsByMessage(messageId: string): Promise<ReactionWithUser[]>;
  getReactionByUserAndMessage(userId: string, messageId: string): Promise<Reaction | undefined>;
  createReaction(reaction: InsertReaction): Promise<Reaction>;
  deleteReaction(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private reactions: Map<string, Reaction>;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.reactions = new Map();
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
  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessages(conversationId: string): Promise<MessageWithSender[]> {
    const msgs = Array.from(this.messages.values()).filter(
      (m) => m.conversationId === conversationId
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

  // Message operations
  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async getMessages(conversationId: string): Promise<MessageWithSender[]> {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
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
}

// Use DatabaseStorage for production, MemStorage for testing
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
