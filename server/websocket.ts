import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import session from 'express-session';

interface WSClient extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

interface WSMessage {
  type: string;
  payload: any;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, Set<WSClient>> = new Map();

  constructor(server: Server, sessionMiddleware: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws: WSClient, req: IncomingMessage) => {
      ws.isAlive = true;

      // Parse session from cookies
      sessionMiddleware(req, {} as any, () => {
        const session = (req as any).session;
        if (session && session.userId) {
          ws.userId = session.userId;
          this.addClient(session.userId, ws);

          ws.send(JSON.stringify({
            type: 'connected',
            payload: { userId: session.userId }
          }));
        } else {
          ws.close(1008, 'Unauthorized');
          return;
        }
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data: string) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      });

      ws.on('close', () => {
        if (ws.userId) {
          this.removeClient(ws.userId, ws);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    // Heartbeat to keep connections alive
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: WSClient) => {
        if (ws.isAlive === false) {
          if (ws.userId) {
            this.removeClient(ws.userId, ws);
          }
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  private addClient(userId: string, ws: WSClient) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);
  }

  private removeClient(userId: string, ws: WSClient) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(ws);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  private handleMessage(ws: WSClient, message: WSMessage) {
    // Handle ping-pong for connection keep-alive
    if (message.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }

  // Send message to specific user
  sendToUser(userId: string, message: WSMessage) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const messageStr = JSON.stringify(message);
      userClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    }
  }

  // Send message to multiple users
  sendToUsers(userIds: string[], message: WSMessage) {
    userIds.forEach(userId => this.sendToUser(userId, message));
  }

  // Broadcast to all connected clients
  broadcast(message: WSMessage) {
    const messageStr = JSON.stringify(message);
    this.wss.clients.forEach((client: WSClient) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // Notify about new message
  notifyNewMessage(conversationId: string, message: any, participantIds: string[]) {
    this.sendToUsers(participantIds, {
      type: 'message:new',
      payload: { conversationId, message }
    });
  }

  // Notify about conversation update
  notifyConversationUpdate(conversation: any, participantIds: string[]) {
    this.sendToUsers(participantIds, {
      type: 'conversation:update',
      payload: conversation
    });
  }

  // Notify about new conversation
  notifyNewConversation(conversation: any, participantIds: string[]) {
    this.sendToUsers(participantIds, {
      type: 'conversation:new',
      payload: conversation
    });
  }

  // Notify about reaction
  notifyReaction(messageId: string, reaction: any, participantIds: string[]) {
    this.sendToUsers(participantIds, {
      type: 'reaction:new',
      payload: { messageId, reaction }
    });
  }

  // Notify about user update
  notifyUserUpdate(user: any, targetUserIds: string[]) {
    this.sendToUsers(targetUserIds, {
      type: 'user:update',
      payload: { userId: user.id, user }
    });
  }

  // Notify about status change
  notifyStatusChange(conversationId: string, status: string, participantIds: string[]) {
    this.sendToUsers(participantIds, {
      type: 'conversation:status',
      payload: { conversationId, status }
    });
  }
}

export let wsManager: WebSocketManager | null = null;

export function initializeWebSocket(server: Server, sessionMiddleware: any) {
  console.log('[WebSocket] Initializing WebSocket server on path /ws');
  wsManager = new WebSocketManager(server, sessionMiddleware);
  console.log('[WebSocket] WebSocket server initialized successfully');
  return wsManager;
}
