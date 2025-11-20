import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { MessageWithSender, ConversationWithUsers, Reaction, User } from '@shared/schema';

interface WebSocketContextType {
  connected: boolean;
  subscribe: (event: string, handler: (data: any) => void) => () => void;
  unsubscribe: (event: string, handler: (data: any) => void) => void;
  send: (type: string, payload: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        const handlers = handlersRef.current.get(data.type);
        if (handlers) {
          handlers.forEach(handler => handler(data.payload));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      wsRef.current = null;

      // Try to reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    wsRef.current = ws;
  }, []);

  const subscribe = useCallback((event: string, handler: (data: any) => void) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = handlersRef.current.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(event);
        }
      }
    };
  }, []);

  const unsubscribe = useCallback((event: string, handler: (data: any) => void) => {
    const handlers = handlersRef.current.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        handlersRef.current.delete(event);
      }
    }
  }, []);

  const send = useCallback((type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket is not connected, cannot send message');
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider value={{ connected, subscribe, unsubscribe, send }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}

// Specific hooks for different event types
export function useWebSocketMessage(conversationId: string | undefined, onMessage: (message: MessageWithSender) => void) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    if (!conversationId) return;

    const handler = (data: { conversationId: string; message: MessageWithSender }) => {
      if (data.conversationId === conversationId) {
        onMessage(data.message);
      }
    };

    const unsubscribe = subscribe('message:new', handler);
    return unsubscribe;
  }, [conversationId, onMessage, subscribe]);
}

export function useWebSocketConversation(onNew: (conversation: ConversationWithUsers) => void, onUpdate: (conversation: ConversationWithUsers) => void) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribeNew = subscribe('conversation:new', onNew);
    const unsubscribeUpdate = subscribe('conversation:update', onUpdate);

    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
    };
  }, [onNew, onUpdate, subscribe]);
}

export function useWebSocketReaction(messageId: string | undefined, onReaction: (data: { messageId: string; reaction: Reaction | null }) => void) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    if (!messageId) return;

    const handler = (data: { messageId: string; reaction: Reaction | null }) => {
      if (data.messageId === messageId) {
        onReaction(data);
      }
    };

    const unsubscribe = subscribe('reaction:new', handler);
    return unsubscribe;
  }, [messageId, onReaction, subscribe]);
}

export function useWebSocketUser(userId: string | undefined, onUpdate: (user: User) => void) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    if (!userId) return;

    const handler = (data: { userId: string; user: User }) => {
      if (data.userId === userId) {
        onUpdate(data.user);
      }
    };

    const unsubscribe = subscribe('user:update', handler);
    return unsubscribe;
  }, [userId, onUpdate, subscribe]);
}
