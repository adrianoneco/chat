import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertConversationSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Conversation routes
  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Clients, attendants and admins can create conversations
      if (!user || !["client", "attendant", "admin"].includes(user.role)) {
        return res.status(403).json({ message: "Forbidden: Invalid role" });
      }
      
      const validatedData = insertConversationSchema.parse({
        ...req.body,
        clientId: userId,
        status: "pending",
      });
      const conversation = await storage.createConversation(validatedData);
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.patch("/api/conversations/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Only attendants and admins can change conversation status
      if (user?.role !== "attendant" && user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Only attendants can change conversation status" });
      }
      
      if (!["pending", "attending", "closed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      await storage.updateConversationStatus(id, status);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating conversation status:", error);
      res.status(500).json({ message: "Failed to update conversation status" });
    }
  });

  // Message routes
  app.get("/api/messages/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      const messages = await storage.getMessages(conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        senderId: userId,
      });
      const message = await storage.createMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Preferences routes
  app.patch("/api/preferences/sidebar", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { collapsed } = req.body;
      
      if (typeof collapsed !== "string") {
        return res.status(400).json({ message: "Invalid data" });
      }

      await storage.updateUserSidebarPreference(userId, collapsed === "true");
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating sidebar preference:", error);
      res.status(500).json({ message: "Failed to update preference" });
    }
  });

  // User management routes (admin only)
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      // This would list all users - not implemented in MemStorage yet
      res.json([]);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
