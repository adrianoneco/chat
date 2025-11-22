import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import sharp from "sharp";
import { parseBuffer } from "music-metadata";
import axios from "axios";
import crypto from "crypto";
import { storage } from "./storage";
import { hashPassword, verifyPassword, generateResetToken, isAuthenticated, requireRole } from "./auth";
import { correctText, generateReadyMessage } from "./groq";
import { sendPasswordResetEmail } from "./email";
import { initializeWebSocket, wsManager } from "./websocket";

// Helper function to generate a random secure password for WhatsApp contacts
// These contacts cannot login anyway, so the password is just for data integrity
function generateSecureRandomPassword(): string {
  return crypto.randomBytes(32).toString('hex');
}
import {
  loginSchema,
  signupSchema,
  resetPasswordRequestSchema,
  resetPasswordSchema,
  insertConversationSchema,
  insertMessageSchema,
  insertReactionSchema,
  insertWebhookSchema,
  insertCampaignSchema,
  updateCampaignSchema,
  insertAiAgentSchema,
  updateAiAgentSchema,
  insertTagSchema,
  updateTagSchema,
  insertReadyMessageSchema,
  updateReadyMessageSchema,
  users,
  messages,
  webhooks,
} from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { eq } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);

declare module 'express-session' {
  interface SessionData {
    userId: string;
    userRole: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  app.set('trust proxy', 1);

  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  });

  app.use(sessionMiddleware);

  // Configure multer for file uploads
  const dataDir = path.join(process.cwd(), 'data');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(path.join(dataDir, 'images'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'audio'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'video'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'files'), { recursive: true });
  await fs.mkdir(path.join(dataDir, 'profiles'), { recursive: true });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 512 * 1024 * 1024, // 512MB limit
    },
  });

  // Serve uploaded files
  app.use('/data', (req, res, next) => {
    express.static(dataDir)(req, res, next);
  });

  // Authentication routes
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const validatedData = signupSchema.parse(req.body);
      const normalizedEmail = validatedData.email.toLowerCase();
      
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: 'Email já está em uso' });
      }

      const hashedPassword = await hashPassword(validatedData.password);
      const user = await storage.createUser({
        email: normalizedEmail,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        role: 'client',
        sidebarCollapsed: 'false',
        isWhatsAppContact: false,
        phoneNumber: null,
        profileImageUrl: null,
        resetToken: null,
        resetTokenExpiry: null,
      });

      req.session.userId = user.id;
      req.session.userRole = user.role;

      const { password, resetToken, resetTokenExpiry, ...userWithoutPassword } = user;
      
      // Trigger webhook
      triggerWebhook('user.created', userWithoutPassword);
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error signing up:', error);
      res.status(500).json({ message: 'Erro ao criar conta' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const normalizedEmail = validatedData.email.toLowerCase();
      
      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      // Security: Prevent WhatsApp contacts from logging in
      if (user.isWhatsAppContact) {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      const isValid = await verifyPassword(user.password, validatedData.password);
      if (!isValid) {
        return res.status(401).json({ message: 'Email ou senha inválidos' });
      }

      req.session.userId = user.id;
      req.session.userRole = user.role;

      const { password, resetToken, resetTokenExpiry, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error logging in:', error);
      res.status(500).json({ message: 'Erro ao fazer login' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Erro ao fazer logout' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });

  app.get('/api/auth/user', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }
      const { password, resetToken, resetTokenExpiry, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Erro ao buscar usuário' });
    }
  });

  app.post('/api/auth/request-reset', async (req, res) => {
    try {
      const validatedData = resetPasswordRequestSchema.parse(req.body);
      const normalizedEmail = validatedData.email.toLowerCase();
      
      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) {
        return res.json({ success: true });
      }

      const resetToken = generateResetToken();
      const hashedToken = await hashPassword(resetToken);
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.updateUser(user.id, { resetToken: hashedToken, resetTokenExpiry });
      await sendPasswordResetEmail(user.email, resetToken);

      res.json({ success: true });
    } catch (error) {
      console.error('Error requesting password reset:', error);
      res.status(500).json({ message: 'Erro ao solicitar recuperação de senha' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const validatedData = resetPasswordSchema.parse(req.body);
      
      const users = await storage.getAllUsers();
      let validUser = null;
      
      for (const user of users) {
        if (user.resetToken && user.resetTokenExpiry && user.resetTokenExpiry >= new Date()) {
          const isValid = await verifyPassword(user.resetToken, validatedData.token);
          if (isValid) {
            validUser = user;
            break;
          }
        }
      }
      
      if (!validUser) {
        return res.status(400).json({ message: 'Token inválido ou expirado' });
      }

      const hashedPassword = await hashPassword(validatedData.newPassword);
      await storage.updateUser(validUser.id, {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      });

      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error resetting password:', error);
      res.status(500).json({ message: 'Erro ao redefinir senha' });
    }
  });

  // Attendant management routes (admin and attendant can view, only admin can edit/delete)
  app.get('/api/attendants', isAuthenticated, async (req, res) => {
    try {
      const attendants = await storage.getUsersByRole('attendant');
      const sanitized = attendants.map(({ password, resetToken, resetTokenExpiry, ...rest }) => rest);
      res.json(sanitized);
    } catch (error) {
      console.error('Error fetching attendants:', error);
      res.status(500).json({ message: 'Erro ao buscar atendentes' });
    }
  });

  app.post('/api/attendants', requireRole('admin'), async (req, res) => {
    try {
      const { email, password, firstName, lastName, profileImageUrl } = req.body;
      const normalizedEmail = email.toLowerCase();
      
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: 'Email já está em uso' });
      }

      const hashedPassword = await hashPassword(password);
      const attendant = await storage.createUser({
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        profileImageUrl: profileImageUrl || null,
        role: 'attendant',
        sidebarCollapsed: 'false',
        isWhatsAppContact: false,
        phoneNumber: null,
        resetToken: null,
        resetTokenExpiry: null,
      });

      const { password: _, resetToken, resetTokenExpiry, ...attendantWithoutPassword } = attendant;
      
      // Trigger webhooks
      triggerWebhook('attendant.created', attendantWithoutPassword);
      triggerWebhook('user.created', attendantWithoutPassword);
      
      res.status(201).json(attendantWithoutPassword);
    } catch (error) {
      console.error('Error creating attendant:', error);
      res.status(500).json({ message: 'Erro ao criar atendente' });
    }
  });

  app.patch('/api/attendants/:id', requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { email, password, firstName, lastName, profileImageUrl } = req.body;
      
      const updateData: any = { firstName, lastName, profileImageUrl };
      if (email) {
        updateData.email = email.toLowerCase();
      }
      if (password && password.trim()) {
        updateData.password = await hashPassword(password);
      }

      const attendant = await storage.updateUser(id, updateData);
      if (!attendant) {
        return res.status(404).json({ message: 'Atendente não encontrado' });
      }

      const { password: _, resetToken, resetTokenExpiry, ...attendantWithoutPassword } = attendant;
      
      // Trigger webhooks
      triggerWebhook('attendant.updated', attendantWithoutPassword);
      triggerWebhook('user.updated', attendantWithoutPassword);
      
      res.json(attendantWithoutPassword);
    } catch (error) {
      console.error('Error updating attendant:', error);
      res.status(500).json({ message: 'Erro ao atualizar atendente' });
    }
  });

  app.delete('/api/attendants/:id', requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const attendant = await storage.getUser(id);
      await storage.deleteUser(id);
      
      // Trigger webhooks
      if (attendant) {
        triggerWebhook('attendant.deleted', { id: attendant.id, email: attendant.email });
        triggerWebhook('user.deleted', { id: attendant.id, email: attendant.email });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting attendant:', error);
      res.status(500).json({ message: 'Erro ao deletar atendente' });
    }
  });

  // Client (contacts) management routes
  app.get('/api/clients', isAuthenticated, async (req, res) => {
    try {
      const clients = await storage.getUsersByRole('client');
      const sanitized = clients.map(({ password, resetToken, resetTokenExpiry, ...rest }) => rest);
      res.json(sanitized);
    } catch (error) {
      console.error('Error fetching clients:', error);
      res.status(500).json({ message: 'Erro ao buscar contatos' });
    }
  });

  app.post('/api/clients', requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const { email, password, firstName, lastName, profileImageUrl } = req.body;
      const normalizedEmail = email.toLowerCase();
      
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: 'Email já está em uso' });
      }

      const hashedPassword = await hashPassword(password || 'defaultpassword123');
      const client = await storage.createUser({
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        profileImageUrl: profileImageUrl || null,
        role: 'client',
        sidebarCollapsed: 'false',
        isWhatsAppContact: false,
        phoneNumber: null,
        resetToken: null,
        resetTokenExpiry: null,
      });

      const { password: _, resetToken, resetTokenExpiry, ...clientWithoutPassword } = client;
      
      // Trigger webhook
      triggerWebhook('contact.created', clientWithoutPassword);
      
      res.status(201).json(clientWithoutPassword);
    } catch (error) {
      console.error('Error creating client:', error);
      res.status(500).json({ message: 'Erro ao criar contato' });
    }
  });

  app.patch('/api/clients/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userRole = req.session.userRole!;
      const userId = req.session.userId!;
      
      // Admins and attendants can edit any client, clients can only edit themselves
      if (userRole === 'client' && userId !== id) {
        return res.status(403).json({ message: 'Você só pode editar seu próprio perfil' });
      }
      
      const { email, password, firstName, lastName, profileImageUrl } = req.body;
      
      const updateData: any = { firstName, lastName, profileImageUrl };
      if (email) {
        updateData.email = email.toLowerCase();
      }
      if (password && password.trim()) {
        updateData.password = await hashPassword(password);
      }

      const client = await storage.updateUser(id, updateData);
      if (!client) {
        return res.status(404).json({ message: 'Contato não encontrado' });
      }

      const { password: _, resetToken, resetTokenExpiry, ...clientWithoutPassword } = client;
      
      // Trigger webhook
      triggerWebhook('contact.updated', clientWithoutPassword);
      
      res.json(clientWithoutPassword);
    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({ message: 'Erro ao atualizar contato' });
    }
  });

  app.delete('/api/clients/:id', requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const { id } = req.params;
      const client = await storage.getUser(id);
      await storage.deleteUser(id);
      
      // Trigger webhook
      if (client) {
        triggerWebhook('contact.deleted', { id: client.id, email: client.email });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting client:', error);
      res.status(500).json({ message: 'Erro ao deletar contato' });
    }
  });

  // Conversation routes
  app.get('/api/conversations', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.userRole!;
      
      // Attendants and admins see all conversations, clients see only their own
      const filterUserId = (userRole === 'attendant' || userRole === 'admin') ? undefined : userId;
      const conversations = await storage.getConversations(filterUserId);
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ message: 'Erro ao buscar conversas' });
    }
  });

  app.get('/api/conversations/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: 'Conversa não encontrada' });
      }
      res.json(conversation);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ message: 'Erro ao buscar conversa' });
    }
  });

  app.post('/api/conversations', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.userRole!;
      const { clientId } = req.body;
      
      // If user is a client, they can only create conversations for themselves
      // and cannot select an attendant (will be assigned later)
      let conversationData: any;
      if (userRole === 'client') {
        conversationData = {
          clientId: userId,
          status: 'pending',
          attendantId: undefined, // No attendant assigned yet
        };
      } else {
        // Attendants and admins can create conversations for clients and assign attendants
        conversationData = {
          ...req.body,
          clientId: clientId || userId,
          status: 'pending',
        };
      }
      
      const validatedData = insertConversationSchema.parse(conversationData);
      const conversation = await storage.createConversation(validatedData);
      const fullConversation = await storage.getConversation(conversation.id);
      
      // Send WebSocket notification to conversation participants
      if (wsManager && fullConversation) {
        const participantIds = [fullConversation.clientId];
        if (fullConversation.attendantId) participantIds.push(fullConversation.attendantId);
        wsManager.notifyNewConversation(fullConversation, participantIds);
      }
      
      // Trigger webhook
      triggerWebhook('conversation.created', fullConversation);
      
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error creating conversation:', error);
      res.status(500).json({ message: 'Erro ao criar conversa' });
    }
  });

  app.patch('/api/conversations/:id/status', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.session.userId!;
      const userRole = req.session.userRole!;
      
      if (userRole !== 'attendant' && userRole !== 'admin') {
        return res.status(403).json({ message: 'Apenas atendentes podem alterar o status da conversa' });
      }
      
      if (!['pending', 'attending', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido' });
      }

      let updateSuccess = true;

      // Se estiver assumindo a conversa (attending), usar o método atômico
      if (status === 'attending') {
        updateSuccess = await storage.updateConversationStatusAndAssignAttendant(id, status, userId);
        
        if (!updateSuccess) {
          const conversation = await storage.getConversation(id);
          if (!conversation) {
            return res.status(404).json({ message: 'Conversa não encontrada' });
          }
          
          return res.status(409).json({ 
            message: 'Esta conversa já está sendo atendida por outro atendente. Use a função de transferência para assumir.',
            currentAttendant: conversation.attendant 
          });
        }
      } else {
        // Para outros status (pending, closed), apenas atualizar o status
        await storage.updateConversationStatus(id, status);
      }
      
      // Send WebSocket notification to conversation participants
      if (wsManager) {
        const fullConversation = await storage.getConversation(id);
        if (fullConversation) {
          const participantIds = [fullConversation.clientId];
          if (fullConversation.attendantId) participantIds.push(fullConversation.attendantId);
          wsManager.notifyConversationUpdate(fullConversation, participantIds);
          
          // Trigger webhooks based on status
          if (status === 'closed') {
            triggerWebhook('conversation.closed', fullConversation);
          } else if (status === 'attending') {
            triggerWebhook('conversation.assigned', fullConversation);
          } else if (status === 'pending') {
            triggerWebhook('conversation.reopened', fullConversation);
          }
          triggerWebhook('conversation.updated', fullConversation);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating conversation status:', error);
      res.status(500).json({ message: 'Erro ao atualizar status da conversa' });
    }
  });

  // Message routes
  app.get('/api/messages/:conversationId', isAuthenticated, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const messages = await storage.getMessages(conversationId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Erro ao buscar mensagens' });
    }
  });

  app.post('/api/messages', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        senderId: userId,
      });
      const message = await storage.createMessage(validatedData);
      
      // Send WebSocket notification to conversation participants
      if (wsManager) {
        const conversation = await storage.getConversation(message.conversationId);
        if (conversation) {
          // If an attendant is replying and mode is ia-agent, change to attendant mode
          const sender = await storage.getUser(userId);
          if (sender && (sender.role === 'attendant' || sender.role === 'admin') && conversation.mode === 'ia-agent') {
            await storage.updateConversationMode(message.conversationId, 'attendant');
            conversation.mode = 'attendant' as any;
          }
          
          const participantIds = [conversation.clientId];
          if (conversation.attendantId) participantIds.push(conversation.attendantId);
          
          const messageWithSender = {
            ...message,
            sender: sender!,
          };
          
          wsManager.notifyNewMessage(message.conversationId, messageWithSender, participantIds);
          wsManager.notifyConversationUpdate(conversation, participantIds);
          
          // Trigger webhook
          const eventType = message.forwardedFromId ? 'message.forwarded' : 'message.created';
          triggerWebhook(eventType, messageWithSender);
          triggerWebhook('message.sent', messageWithSender);
        }
      }
      
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error creating message:', error);
      res.status(500).json({ message: 'Erro ao criar mensagem' });
    }
  });

  app.delete('/api/messages/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const message = await storage.getMessage(id);
      await storage.updateMessageDeleted(id, true);
      
      // Send WebSocket notification to conversation participants
      if (wsManager) {
        if (message) {
          const conversation = await storage.getConversation(message.conversationId);
          if (conversation) {
            const participantIds = [conversation.clientId];
            if (conversation.attendantId) participantIds.push(conversation.attendantId);
            wsManager.notifyConversationUpdate(conversation, participantIds);
          }
        }
      }
      
      // Trigger webhook
      if (message) {
        triggerWebhook('message.deleted', { id: message.id, conversationId: message.conversationId });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ message: 'Erro ao deletar mensagem' });
    }
  });

  app.delete('/api/conversations/:id', requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      await storage.updateConversationDeleted(id, true);
      
      // Send WebSocket notification to conversation participants
      if (wsManager) {
        if (conversation) {
          const participantIds = [conversation.clientId];
          if (conversation.attendantId) participantIds.push(conversation.attendantId);
          wsManager.notifyConversationUpdate(conversation, participantIds);
        }
      }
      
      // Trigger webhook
      if (conversation) {
        triggerWebhook('conversation.deleted', { id: conversation.id });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ message: 'Erro ao deletar conversa' });
    }
  });

  app.patch('/api/conversations/:id/transfer', requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const { id } = req.params;
      const { attendantId } = req.body;
      
      if (!attendantId) {
        return res.status(400).json({ message: 'ID do atendente é obrigatório' });
      }
      
      // Verify attendant exists
      const attendant = await storage.getUser(attendantId);
      if (!attendant || (attendant.role !== 'attendant' && attendant.role !== 'admin')) {
        return res.status(400).json({ message: 'Atendente inválido' });
      }
      
      const oldConversation = await storage.getConversation(id);
      await storage.updateConversationAttendant(id, attendantId);
      
      // Send WebSocket notification to conversation participants
      if (wsManager) {
        const conversation = await storage.getConversation(id);
        if (conversation) {
          const participantIds = [conversation.clientId, attendantId];
          if (conversation.attendantId && conversation.attendantId !== attendantId) {
            participantIds.push(conversation.attendantId);
          }
          wsManager.notifyConversationUpdate(conversation, participantIds);
          
          // Trigger webhook
          triggerWebhook('conversation.transferred', {
            conversation,
            oldAttendantId: oldConversation?.attendantId,
            newAttendantId: attendantId,
          });
          triggerWebhook('conversation.updated', conversation);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error transferring conversation:', error);
      res.status(500).json({ message: 'Erro ao transferir conversa' });
    }
  });

  // Preferences routes
  app.patch('/api/preferences/sidebar', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { collapsed } = req.body;
      
      if (typeof collapsed !== 'string') {
        return res.status(400).json({ message: 'Dados inválidos' });
      }

      await storage.updateUserSidebarPreference(userId, collapsed === 'true');
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating sidebar preference:', error);
      res.status(500).json({ message: 'Erro ao atualizar preferência' });
    }
  });

  // File upload routes
  app.post('/api/upload/profile-image/:userId', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      const { userId } = req.params;
      const userRole = req.session.userRole!;
      const sessionUserId = req.session.userId!;
      
      // Admins and attendants can upload photos for any user, clients can only upload for themselves
      if (userRole === 'client' && sessionUserId !== userId) {
        return res.status(403).json({ message: 'Você só pode alterar sua própria foto de perfil' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
      }

      const fileName = `${userId}.webp`;
      const filePath = path.join(dataDir, 'profiles', fileName);
      
      await sharp(req.file.buffer)
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 85 })
        .toFile(filePath);

      const imageUrl = `/data/profiles/${fileName}`;
      await storage.updateUser(userId, { profileImageUrl: imageUrl });

      if (wsManager) {
        const user = await storage.getUser(userId);
        if (user) {
          const { password: _, resetToken, resetTokenExpiry, ...userWithoutPassword } = user;
          const allUsers = await storage.getAllUsers();
          const userIds = allUsers.map(u => u.id);
          wsManager.notifyUserUpdate(userWithoutPassword, userIds);
        }
      }

      res.json({ url: imageUrl });
    } catch (error) {
      console.error('Error uploading profile image:', error);
      res.status(500).json({ message: 'Erro ao enviar imagem' });
    }
  });

  app.post('/api/messages/:messageId/reprocess-audio', isAuthenticated, async (req, res) => {
    try {
      const { messageId } = req.params;
      const message = await storage.getMessage(messageId);
      
      if (!message || message.type !== 'audio' || !message.fileMetadata?.url) {
        return res.status(400).json({ message: 'Mensagem inválida ou não é áudio' });
      }

      // Read the audio file from disk
      // Remove leading slash to make it relative
      const relativePath = message.fileMetadata.url.startsWith('/') 
        ? message.fileMetadata.url.slice(1) 
        : message.fileMetadata.url;
      const audioPath = path.join(process.cwd(), relativePath);
      
      // Check if file exists
      try {
        await fs.access(audioPath);
      } catch (error) {
        return res.status(404).json({ message: 'Arquivo de áudio não encontrado' });
      }
      
      const audioBuffer = await fs.readFile(audioPath);

      let audioMetadata: any = null;
      
      try {
        const metadata = await parseBuffer(audioBuffer, { mimeType: message.fileMetadata.mimeType || 'audio/mpeg' });
        audioMetadata = {
          title: metadata.common.title,
          artist: metadata.common.artist,
          album: metadata.common.album,
        };

        // Save album art if present
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          const albumArtFileName = `${Date.now()}-albumart.webp`;
          const albumArtPath = path.join(dataDir, 'images', albumArtFileName);
          
          // Convert to webp and save
          await sharp(picture.data)
            .resize(300, 300, { fit: 'cover' })
            .webp({ quality: 85 })
            .toFile(albumArtPath);
          
          audioMetadata.albumArt = `/data/images/${albumArtFileName}`;
        }
      } catch (metadataError) {
        console.error('Error extracting audio metadata:', metadataError);
      }

      // Update message with new metadata
      if (audioMetadata && Object.keys(audioMetadata).length > 0) {
        const updatedFileMetadata = {
          ...message.fileMetadata,
          id3: audioMetadata,
        };

        // Update in storage
        await db
          .update(messages)
          .set({ fileMetadata: updatedFileMetadata })
          .where(eq(messages.id, messageId));

        // Notify via WebSocket
        if (wsManager) {
          const sender = await storage.getUser(message.senderId);
          const updatedMessage = {
            ...message,
            fileMetadata: updatedFileMetadata,
            sender: sender!,
          };
          
          const conversation = await storage.getConversation(message.conversationId);
          if (conversation) {
            const participantIds = [conversation.clientId];
            if (conversation.attendantId) participantIds.push(conversation.attendantId);
            wsManager.notifyNewMessage(message.conversationId, updatedMessage as any, participantIds);
          }
        }
      }

      res.json({ audioMetadata });
    } catch (error) {
      console.error('Error reprocessing audio:', error);
      res.status(500).json({ message: 'Erro ao reprocessar áudio' });
    }
  });

  app.post('/api/upload/message-file', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado' });
      }

      const { conversationId, type } = req.body;
      const userId = req.session.userId!;
      
      let folder = 'files';
      let fileName = `${Date.now()}-${req.file.originalname}`;
      let processedBuffer = req.file.buffer;
      let audioMetadata: any = null;

      if (type === 'image') {
        folder = 'images';
        fileName = `${Date.now()}.webp`;
        processedBuffer = await sharp(req.file.buffer)
          .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
      } else if (type === 'audio') {
        folder = 'audio';
        
        // Extract audio metadata
        try {
          const metadata = await parseBuffer(req.file.buffer, { mimeType: req.file.mimetype });
          audioMetadata = {
            title: metadata.common.title,
            artist: metadata.common.artist,
            album: metadata.common.album,
          };

          // Save album art if present
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0];
            const albumArtFileName = `${Date.now()}-albumart.webp`;
            const albumArtPath = path.join(dataDir, 'images', albumArtFileName);
            
            // Convert to webp and save
            await sharp(picture.data)
              .resize(300, 300, { fit: 'cover' })
              .webp({ quality: 85 })
              .toFile(albumArtPath);
            
            audioMetadata.albumArt = `/data/images/${albumArtFileName}`;
          }
        } catch (metadataError) {
          console.error('Error extracting audio metadata:', metadataError);
          // Continue without metadata if extraction fails
        }
      } else if (type === 'video') {
        folder = 'video';
      }

      const filePath = path.join(dataDir, folder, fileName);
      await fs.writeFile(filePath, processedBuffer);

      const fileUrl = `/data/${folder}/${fileName}`;
      const fileSize = processedBuffer.length;
      const mimeType = req.file.mimetype;

      res.json({
        url: fileUrl,
        fileName: req.file.originalname,
        fileSize,
        mimeType,
        ...(audioMetadata && { audioMetadata }),
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ message: 'Erro ao enviar arquivo' });
    }
  });

  // Reaction routes
  app.get('/api/reactions/:messageId', isAuthenticated, async (req, res) => {
    try {
      const { messageId } = req.params;
      const reactions = await storage.getReactionsByMessage(messageId);
      res.json(reactions);
    } catch (error) {
      console.error('Error fetching reactions:', error);
      res.status(500).json({ message: 'Erro ao buscar reações' });
    }
  });

  app.post('/api/reactions', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const validatedData = insertReactionSchema.parse({
        ...req.body,
        userId,
      });
      
      const existing = await storage.getReactionByUserAndMessage(userId, validatedData.messageId);
      if (existing && existing.emoji === validatedData.emoji) {
        await storage.deleteReaction(existing.id);
        
        if (wsManager) {
          const message = await storage.getMessage(validatedData.messageId);
          if (message) {
            const conversation = await storage.getConversation(message.conversationId);
            if (conversation) {
              const participantIds = [conversation.clientId];
              if (conversation.attendantId) participantIds.push(conversation.attendantId);
              wsManager.notifyReaction(validatedData.messageId, null, participantIds);
            }
          }
        }
        
        // Trigger webhook
        triggerWebhook('reaction.removed', { messageId: validatedData.messageId, emoji: existing.emoji, userId });
        
        return res.json({ success: true, removed: true });
      }
      
      if (existing) {
        await storage.deleteReaction(existing.id);
      }
      
      const reaction = await storage.createReaction(validatedData);
      
      if (wsManager) {
        const message = await storage.getMessage(validatedData.messageId);
        if (message) {
          const conversation = await storage.getConversation(message.conversationId);
          if (conversation) {
            const participantIds = [conversation.clientId];
            if (conversation.attendantId) participantIds.push(conversation.attendantId);
            wsManager.notifyReaction(validatedData.messageId, reaction, participantIds);
          }
        }
      }
      
      // Trigger webhook
      triggerWebhook('reaction.added', reaction);
      
      res.status(201).json(reaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error creating reaction:', error);
      res.status(500).json({ message: 'Erro ao criar reação' });
    }
  });

  // Seed route for test data (development only)
  app.post('/api/seed/test-data', async (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ message: 'Apenas disponível em desenvolvimento' });
    }

    try {
      // Create attendants
      const attendants = [
        {
          email: 'ana.silva@chatapp.com',
          password: await hashPassword('senha123'),
          firstName: 'Ana',
          lastName: 'Silva',
          role: 'attendant' as const,
          sidebarCollapsed: 'false',
          isWhatsAppContact: false,
          phoneNumber: null,
          profileImageUrl: null,
          resetToken: null,
          resetTokenExpiry: null,
        },
        {
          email: 'carlos.santos@chatapp.com',
          password: await hashPassword('senha123'),
          firstName: 'Carlos',
          lastName: 'Santos',
          role: 'attendant' as const,
          sidebarCollapsed: 'false',
          isWhatsAppContact: false,
          phoneNumber: null,
          profileImageUrl: null,
          resetToken: null,
          resetTokenExpiry: null,
        },
        {
          email: 'maria.oliveira@chatapp.com',
          password: await hashPassword('senha123'),
          firstName: 'Maria',
          lastName: 'Oliveira',
          role: 'attendant' as const,
          sidebarCollapsed: 'false',
          isWhatsAppContact: false,
          phoneNumber: null,
          profileImageUrl: null,
          resetToken: null,
          resetTokenExpiry: null,
        },
      ];

      // Create clients (contacts)
      const clients = [
        {
          email: 'joao.cliente@email.com',
          password: await hashPassword('senha123'),
          firstName: 'João',
          lastName: 'Pereira',
          role: 'client' as const,
          sidebarCollapsed: 'false',
          isWhatsAppContact: false,
          phoneNumber: null,
          profileImageUrl: null,
          resetToken: null,
          resetTokenExpiry: null,
        },
        {
          email: 'fernanda.costa@email.com',
          password: await hashPassword('senha123'),
          firstName: 'Fernanda',
          lastName: 'Costa',
          role: 'client' as const,
          sidebarCollapsed: 'false',
          isWhatsAppContact: false,
          phoneNumber: null,
          profileImageUrl: null,
          resetToken: null,
          resetTokenExpiry: null,
        },
        {
          email: 'pedro.alves@email.com',
          password: await hashPassword('senha123'),
          firstName: 'Pedro',
          lastName: 'Alves',
          role: 'client' as const,
          sidebarCollapsed: 'false',
          isWhatsAppContact: false,
          phoneNumber: null,
          profileImageUrl: null,
          resetToken: null,
          resetTokenExpiry: null,
        },
        {
          email: 'juliana.souza@email.com',
          password: await hashPassword('senha123'),
          firstName: 'Juliana',
          lastName: 'Souza',
          role: 'client' as const,
          sidebarCollapsed: 'false',
          isWhatsAppContact: false,
          phoneNumber: null,
          profileImageUrl: null,
          resetToken: null,
          resetTokenExpiry: null,
        },
        {
          email: 'ricardo.lima@email.com',
          password: await hashPassword('senha123'),
          firstName: 'Ricardo',
          lastName: 'Lima',
          role: 'client' as const,
          sidebarCollapsed: 'false',
          isWhatsAppContact: false,
          phoneNumber: null,
          profileImageUrl: null,
          resetToken: null,
          resetTokenExpiry: null,
        },
      ];

      const createdAttendants = [];
      const createdClients = [];

      // Check and create attendants
      for (const attendant of attendants) {
        const existing = await storage.getUserByEmail(attendant.email);
        if (!existing) {
          const created = await storage.createUser(attendant);
          createdAttendants.push(created);
        }
      }

      // Check and create clients
      for (const client of clients) {
        const existing = await storage.getUserByEmail(client.email);
        if (!existing) {
          const created = await storage.createUser(client);
          createdClients.push(created);
        }
      }

      res.json({
        message: 'Dados de teste criados com sucesso',
        created: {
          attendants: createdAttendants.length,
          clients: createdClients.length,
        },
        credentials: {
          attendants: 'ana.silva@chatapp.com / carlos.santos@chatapp.com / maria.oliveira@chatapp.com',
          clients: 'joao.cliente@email.com / fernanda.costa@email.com / pedro.alves@email.com / juliana.souza@email.com / ricardo.lima@email.com',
          password: 'senha123',
        },
      });
    } catch (error) {
      console.error('Error seeding test data:', error);
      res.status(500).json({ message: 'Erro ao criar dados de teste' });
    }
  });

  // Webhook routes
  app.get('/api/webhooks', isAuthenticated, requireRole('admin'), async (req, res) => {
    try {
      const webhooks = await storage.getWebhooks();
      res.json(webhooks);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      res.status(500).json({ message: 'Erro ao buscar webhooks' });
    }
  });

  // Allow both admins and attendants to create webhooks
  app.post('/api/webhooks', isAuthenticated, requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const webhookData = {
        ...req.body,
        url: req.body.url || process.env.DEFAULT_WEBHOOK_URL || '',
      };
      const webhook = await storage.createWebhook(webhookData);
      res.json(webhook);
    } catch (error) {
      console.error('Error creating webhook:', error);
      res.status(500).json({ message: 'Erro ao criar webhook' });
    }
  });

  // Allow both admins and attendants to update webhooks
  app.patch('/api/webhooks/:id', isAuthenticated, requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const webhook = await storage.updateWebhook(req.params.id, req.body);
      if (!webhook) {
        return res.status(404).json({ message: 'Webhook não encontrado' });
      }
      res.json(webhook);
    } catch (error) {
      console.error('Error updating webhook:', error);
      res.status(500).json({ message: 'Erro ao atualizar webhook' });
    }
  });

  app.delete('/api/webhooks/:id', isAuthenticated, requireRole('admin'), async (req, res) => {
    try {
      const success = await storage.deleteWebhook(req.params.id);
      if (!success) {
        return res.status(404).json({ message: 'Webhook não encontrado' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting webhook:', error);
      res.status(500).json({ message: 'Erro ao deletar webhook' });
    }
  });

  app.post('/api/webhooks/:id/test', isAuthenticated, requireRole('admin'), async (req, res) => {
    try {
      const webhook = await storage.getWebhookById(req.params.id);
      if (!webhook) {
        return res.status(404).json({ message: 'Webhook não encontrado' });
      }

      // Sanitize memory usage to prevent BigInt serialization issues
      const memUsage = process.memoryUsage();
      const sanitizedMemory = {
        rss: memUsage.rss.toString(),
        heapTotal: memUsage.heapTotal.toString(),
        heapUsed: memUsage.heapUsed.toString(),
        external: memUsage.external.toString(),
        arrayBuffers: memUsage.arrayBuffers?.toString() || '0',
      };

      const testPayload = {
        event: 'test.webhook',
        timestamp: new Date().toISOString(),
        data: {
          applicationName: 'ChatApp',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          platform: {
            nodeVersion: process.version,
            architecture: process.arch,
            platform: process.platform,
            uptime: Math.floor(process.uptime()),
            memoryUsage: sanitizedMemory,
          },
          webhook: {
            id: webhook.id,
            name: webhook.name,
            url: webhook.url,
            authType: webhook.authType,
            events: webhook.events,
          },
          test: true,
          message: 'This is a test webhook payload with system information',
        },
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(webhook.headers || {}),
      };

      if (webhook.authType === 'bearer' && webhook.apiToken) {
        headers['Authorization'] = `Bearer ${webhook.apiToken}`;
      } else if (webhook.authType === 'apiKey' && webhook.apiToken) {
        headers['X-API-Key'] = webhook.apiToken;
      } else if (webhook.authType === 'jwt' && webhook.jwtToken) {
        headers['Authorization'] = `Bearer ${webhook.jwtToken}`;
      }

      // Log test attempt for debugging
      console.log(`[webhook:test] id=${webhook.id} url=${webhook.url}`);

      // Add a timeout to the fetch so tests don't hang
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      let response;
      try {
        response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(testPayload),
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        console.error('[webhook:test] fetch error:', fetchErr?.message || fetchErr);
        return res.status(500).json({ success: false, message: `Falha ao conectar: ${fetchErr?.message || String(fetchErr)}` });
      }

      clearTimeout(timeout);

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      res.json({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers ? Object.fromEntries(response.headers.entries()) : {},
        data: responseData,
      });
    } catch (error: any) {
      console.error('Error testing webhook:', error);
      res.status(500).json({ 
        success: false,
        message: error.message || 'Erro ao testar webhook',
      });
    }
  });

  // Webhook trigger function
  async function triggerWebhook(eventType: string, data: any) {
    try {
      const webhooks = await storage.getWebhooks();
      const activeWebhooks = webhooks.filter(
        (wh) => wh.isActive === 'true' && wh.events.includes(eventType)
      );

      if (activeWebhooks.length === 0) {
        return;
      }

      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data,
      };

      for (const webhook of activeWebhooks) {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(webhook.headers || {}),
          };

          if (webhook.authType === 'bearer' && webhook.apiToken) {
            headers['Authorization'] = `Bearer ${webhook.apiToken}`;
          } else if (webhook.authType === 'apiKey' && webhook.apiToken) {
            headers['X-API-Key'] = webhook.apiToken;
          } else if (webhook.authType === 'jwt' && webhook.jwtToken) {
            headers['Authorization'] = `Bearer ${webhook.jwtToken}`;
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeout);

          console.log(`[webhook:trigger] event=${eventType} webhook=${webhook.name} status=${response.status}`);
        } catch (error: any) {
          console.error(`[webhook:trigger] event=${eventType} webhook=${webhook.name} error:`, error?.message || error);
        }
      }
    } catch (error) {
      console.error('[webhook:trigger] error fetching webhooks:', error);
    }
  }

  // Promote a user to admin (admin-only)
  app.post('/api/users/:id/promote', isAuthenticated, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      if (user.role === 'admin') {
        return res.json({ success: true, message: 'Usuário já é admin' });
      }

      const updated = await storage.updateUser(id, { role: 'admin' });
      if (!updated) {
        return res.status(500).json({ message: 'Falha ao promover usuário' });
      }

      const { password: _, resetToken, resetTokenExpiry, ...sanitized } = updated as any;
      // Notify via WebSocket that user role changed
      if (wsManager) {
        const allUsers = await storage.getAllUsers();
        const userIds = allUsers.map(u => u.id);
        wsManager.notifyUserUpdate(sanitized, userIds);
      }
      
      // Trigger webhooks
      triggerWebhook('attendant.promoted', sanitized);
      triggerWebhook('user.updated', sanitized);

      res.json({ success: true, user: sanitized });
    } catch (error) {
      console.error('Error promoting user:', error);
      res.status(500).json({ message: 'Erro ao promover usuário' });
    }
  });

  // Campaign routes
  app.get('/api/campaigns', isAuthenticated, async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ message: 'Erro ao buscar campanhas' });
    }
  });

  app.get('/api/campaigns/:id', isAuthenticated, async (req, res) => {
    try {
      const campaign = await storage.getCampaignById(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: 'Campanha não encontrada' });
      }
      res.json(campaign);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      res.status(500).json({ message: 'Erro ao buscar campanha' });
    }
  });

  app.post('/api/campaigns', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign({
        ...validatedData,
        createdBy: req.session.userId!,
      });
      
      // Trigger webhook
      triggerWebhook('campaign.created', campaign);
      
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error creating campaign:', error);
      res.status(500).json({ message: 'Erro ao criar campanha' });
    }
  });

  app.patch('/api/campaigns/:id', isAuthenticated, async (req, res) => {
    try {
      const validatedData = updateCampaignSchema.parse(req.body);
      const campaign = await storage.updateCampaign(req.params.id, validatedData as any);
      if (!campaign) {
        return res.status(404).json({ message: 'Campanha não encontrada' });
      }
      
      // Trigger webhooks based on status changes
      if (validatedData.status === 'active') {
        triggerWebhook('campaign.started', campaign);
      } else if (validatedData.status === 'completed') {
        triggerWebhook('campaign.completed', campaign);
      } else if (validatedData.status === 'paused') {
        triggerWebhook('campaign.paused', campaign);
      }
      triggerWebhook('campaign.updated', campaign);
      
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error updating campaign:', error);
      res.status(500).json({ message: 'Erro ao atualizar campanha' });
    }
  });

  app.delete('/api/campaigns/:id', isAuthenticated, async (req, res) => {
    try {
      const campaign = await storage.getCampaignById(req.params.id);
      const success = await storage.deleteCampaign(req.params.id);
      if (!success) {
        return res.status(404).json({ message: 'Campanha não encontrada' });
      }
      
      // Trigger webhook
      if (campaign) {
        triggerWebhook('campaign.deleted', { id: campaign.id, name: campaign.name });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      res.status(500).json({ message: 'Erro ao deletar campanha' });
    }
  });

  // Reports routes
  app.post('/api/reports/send-email', isAuthenticated, async (req, res) => {
    try {
      const { recipientEmail, recipientName, subject, message, reportData } = req.body;
      
      if (!recipientEmail || !subject || !reportData) {
        return res.status(400).json({ message: 'Dados incompletos' });
      }

      const { sendReportEmail } = await import('./email');
      const success = await sendReportEmail(
        recipientEmail,
        recipientName || 'Cliente',
        subject,
        message || '',
        reportData
      );

      if (success) {
        res.json({ success: true, message: 'Email enviado com sucesso' });
      } else {
        res.status(500).json({ message: 'Erro ao enviar email' });
      }
    } catch (error) {
      console.error('Error sending report email:', error);
      res.status(500).json({ message: 'Erro ao enviar email' });
    }
  });

  // AI Agents routes
  app.get('/api/ai-agents', requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const agents = await storage.getAiAgents();
      res.json(agents);
    } catch (error) {
      console.error('Error fetching AI agents:', error);
      res.status(500).json({ message: 'Erro ao buscar agentes IA' });
    }
  });

  app.get('/api/ai-agents/:id', requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const agent = await storage.getAiAgentById(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: 'Agente IA não encontrado' });
      }
      res.json(agent);
    } catch (error) {
      console.error('Error fetching AI agent:', error);
      res.status(500).json({ message: 'Erro ao buscar agente IA' });
    }
  });

  app.post('/api/ai-agents', requireRole('admin'), async (req, res) => {
    try {
      const validatedData = insertAiAgentSchema.parse(req.body);
      const userId = req.session.userId!;
      const agent = await storage.createAiAgent({
        ...validatedData,
        createdBy: userId,
      } as any);
      res.status(201).json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error creating AI agent:', error);
      res.status(500).json({ message: 'Erro ao criar agente IA' });
    }
  });

  app.patch('/api/ai-agents/:id', requireRole('admin'), async (req, res) => {
    try {
      const validatedData = updateAiAgentSchema.parse(req.body);
      const agent = await storage.updateAiAgent(req.params.id, validatedData as any);
      if (!agent) {
        return res.status(404).json({ message: 'Agente IA não encontrado' });
      }
      res.json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error updating AI agent:', error);
      res.status(500).json({ message: 'Erro ao atualizar agente IA' });
    }
  });

  app.delete('/api/ai-agents/:id', requireRole('admin'), async (req, res) => {
    try {
      const success = await storage.deleteAiAgent(req.params.id);
      if (!success) {
        return res.status(404).json({ message: 'Agente IA não encontrado' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting AI agent:', error);
      res.status(500).json({ message: 'Erro ao deletar agente IA' });
    }
  });

  // Tags routes
  app.get('/api/tags', isAuthenticated, async (req, res) => {
    try {
      const tags = await storage.getTags();
      res.json(tags);
    } catch (error) {
      console.error('Error getting tags:', error);
      res.status(500).json({ message: 'Erro ao buscar tags' });
    }
  });

  app.post('/api/tags', isAuthenticated, requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const validatedData = insertTagSchema.parse({
        ...req.body,
        createdBy: req.session.userId!,
      });
      const tag = await storage.createTag(validatedData);
      res.status(201).json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error creating tag:', error);
      res.status(500).json({ message: 'Erro ao criar tag' });
    }
  });

  app.patch('/api/tags/:id', isAuthenticated, requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const validatedData = updateTagSchema.parse(req.body);
      const tag = await storage.updateTag(req.params.id, validatedData);
      if (!tag) {
        return res.status(404).json({ message: 'Tag não encontrada' });
      }
      res.json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error updating tag:', error);
      res.status(500).json({ message: 'Erro ao atualizar tag' });
    }
  });

  app.delete('/api/tags/:id', isAuthenticated, requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const deleted = await storage.deleteTag(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Tag não encontrada' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting tag:', error);
      res.status(500).json({ message: 'Erro ao deletar tag' });
    }
  });

  // Conversation tags routes
  app.post('/api/conversations/:conversationId/tags/:tagId', isAuthenticated, requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const { conversationId, tagId } = req.params;
      
      // Validate IDs
      if (!conversationId || !tagId) {
        return res.status(400).json({ message: 'IDs inválidos' });
      }

      // Check if conversation exists
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: 'Conversa não encontrada' });
      }

      // Check if tag exists
      const tag = await storage.getTagById(tagId);
      if (!tag) {
        return res.status(404).json({ message: 'Tag não encontrada' });
      }

      await storage.addTagToConversation(conversationId, tagId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error adding tag to conversation:', error);
      res.status(500).json({ message: 'Erro ao adicionar tag' });
    }
  });

  app.delete('/api/conversations/:conversationId/tags/:tagId', isAuthenticated, requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const { conversationId, tagId } = req.params;
      
      // Validate IDs
      if (!conversationId || !tagId) {
        return res.status(400).json({ message: 'IDs inválidos' });
      }

      await storage.removeTagFromConversation(conversationId, tagId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing tag from conversation:', error);
      res.status(500).json({ message: 'Erro ao remover tag' });
    }
  });

  app.get('/api/conversations/:conversationId/tags', isAuthenticated, async (req, res) => {
    try {
      const tags = await storage.getConversationTags(req.params.conversationId);
      res.json(tags);
    } catch (error) {
      console.error('Error getting conversation tags:', error);
      res.status(500).json({ message: 'Erro ao buscar tags da conversa' });
    }
  });

  // Groq AI routes
  app.post('/api/groq/correct-text', isAuthenticated, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ message: 'Texto é obrigatório' });
      }
      const correctedText = await correctText(text);
      res.json({ correctedText });
    } catch (error) {
      console.error('Error correcting text:', error);
      res.status(500).json({ message: 'Erro ao corrigir texto' });
    }
  });

  app.post('/api/groq/generate-message', isAuthenticated, requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ message: 'Prompt é obrigatório' });
      }
      const generatedMessage = await generateReadyMessage(prompt);
      res.json({ message: generatedMessage });
    } catch (error) {
      console.error('Error generating message:', error);
      res.status(500).json({ message: 'Erro ao gerar mensagem' });
    }
  });

  // Ready messages routes
  app.get('/api/ready-messages', isAuthenticated, async (req, res) => {
    try {
      const messages = await storage.getReadyMessages();
      res.json(messages);
    } catch (error) {
      console.error('Error getting ready messages:', error);
      res.status(500).json({ message: 'Erro ao buscar mensagens prontas' });
    }
  });

  app.post('/api/ready-messages', isAuthenticated, requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const validatedData = insertReadyMessageSchema.parse({
        ...req.body,
        createdBy: req.session.userId!,
      });
      const message = await storage.createReadyMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error creating ready message:', error);
      res.status(500).json({ message: 'Erro ao criar mensagem pronta' });
    }
  });

  app.patch('/api/ready-messages/:id', isAuthenticated, requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const validatedData = updateReadyMessageSchema.parse(req.body);
      const message = await storage.updateReadyMessage(req.params.id, validatedData);
      if (!message) {
        return res.status(404).json({ message: 'Mensagem pronta não encontrada' });
      }
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error updating ready message:', error);
      res.status(500).json({ message: 'Erro ao atualizar mensagem pronta' });
    }
  });

  app.delete('/api/ready-messages/:id', isAuthenticated, requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const deleted = await storage.deleteReadyMessage(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Mensagem pronta não encontrada' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting ready message:', error);
      res.status(500).json({ message: 'Erro ao deletar mensagem pronta' });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket
  initializeWebSocket(httpServer, sessionMiddleware);
  
  return httpServer;
}
