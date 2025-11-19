import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { parseBuffer } from "music-metadata";
import { storage } from "./storage";
import { hashPassword, verifyPassword, generateResetToken, isAuthenticated, requireRole } from "./auth";
import { sendPasswordResetEmail } from "./email";
import { initializeWebSocket, wsManager } from "./websocket";
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
      fileSize: 50 * 1024 * 1024, // 50MB limit
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

  app.patch('/api/clients/:id', requireRole('admin', 'attendant'), async (req, res) => {
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
      const { clientId } = req.body;
      
      const validatedData = insertConversationSchema.parse({
        ...req.body,
        clientId: clientId || userId,
        status: 'pending',
      });
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
      const userRole = req.session.userRole!;
      
      if (userRole !== 'attendant' && userRole !== 'admin') {
        return res.status(403).json({ message: 'Apenas atendentes podem alterar o status da conversa' });
      }
      
      if (!['pending', 'attending', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido' });
      }

      await storage.updateConversationStatus(id, status);
      
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
          const participantIds = [conversation.clientId];
          if (conversation.attendantId) participantIds.push(conversation.attendantId);
          
          const sender = await storage.getUser(userId);
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
      const currentUserId = req.session.userId!;
      const userRole = req.session.userRole!;
      
      if (currentUserId !== userId && userRole !== 'admin') {
        return res.status(403).json({ message: 'Não autorizado' });
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

      const testPayload = {
        event: 'test.webhook',
        timestamp: new Date().toISOString(),
        data: {
          applicationName: 'ChatApp',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          test: true,
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

  const httpServer = createServer(app);
  
  // Initialize WebSocket
  initializeWebSocket(httpServer, sessionMiddleware);
  
  return httpServer;
}
