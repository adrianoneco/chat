import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { hashPassword, verifyPassword, generateResetToken, isAuthenticated, requireRole } from "./auth";
import { sendPasswordResetEmail } from "./email";
import {
  loginSchema,
  signupSchema,
  resetPasswordRequestSchema,
  resetPasswordSchema,
  insertConversationSchema,
  insertMessageSchema,
  users,
} from "@shared/schema";
import { z } from "zod";

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

  app.use(
    session({
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
    })
  );

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
      res.json(attendantWithoutPassword);
    } catch (error) {
      console.error('Error updating attendant:', error);
      res.status(500).json({ message: 'Erro ao atualizar atendente' });
    }
  });

  app.delete('/api/attendants/:id', requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
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
      res.json(clientWithoutPassword);
    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({ message: 'Erro ao atualizar contato' });
    }
  });

  app.delete('/api/clients/:id', requireRole('admin', 'attendant'), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
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
      const conversations = await storage.getConversations(userId);
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
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Dados inválidos', errors: error.errors });
      }
      console.error('Error creating message:', error);
      res.status(500).json({ message: 'Erro ao criar mensagem' });
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

  const httpServer = createServer(app);
  return httpServer;
}
