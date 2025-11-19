import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Header } from "@/components/Header";
import { LeftSidebar } from "@/components/LeftSidebar";
import { ConversationList } from "@/components/ConversationList";
import { ChatArea } from "@/components/ChatArea";
import { MessageInput } from "@/components/MessageInput";
import { ConversationDetailsSidebar } from "@/components/ConversationDetailsSidebar";
import { cn } from "@/lib/utils";
import type { ConversationWithUsers, MessageWithSender, User } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const params = useParams();
  const conversationIdFromRoute = params.id;

  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(conversationIdFromRoute);

  useEffect(() => {
    if (conversationIdFromRoute) {
      setSelectedConversationId(conversationIdFromRoute);
    }
  }, [conversationIdFromRoute]);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      toast({
        title: "Não autenticado",
        description: "Você será redirecionado para fazer login...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isAuthLoading, toast]);

  useEffect(() => {
    if (user?.sidebarCollapsed) {
      setLeftSidebarCollapsed(user.sidebarCollapsed === "true");
    }
  }, [user]);

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<ConversationWithUsers[]>({
    queryKey: ["/api/conversations"],
    enabled: isAuthenticated,
  });

  const { data: messages = [] } = useQuery<MessageWithSender[]>({
    queryKey: ["/api/messages", selectedConversationId],
    enabled: !!selectedConversationId && isAuthenticated,
  });

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  const updateSidebarPreference = useMutation({
    mutationFn: async (collapsed: boolean) => {
      await apiRequest("PATCH", "/api/preferences/sidebar", { collapsed: String(collapsed) });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Não autorizado",
          description: "Fazendo login novamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
      }
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConversationId) return;
      await apiRequest("POST", "/api/messages", {
        conversationId: selectedConversationId,
        content,
        type: "text",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Não autorizado",
          description: "Fazendo login novamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro ao enviar mensagem",
        description: "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const handleToggleLeftSidebar = () => {
    const newState = !leftSidebarCollapsed;
    setLeftSidebarCollapsed(newState);
    updateSidebarPreference.mutate(newState);
  };

  const handleNewConversation = () => {
    toast({
      title: "Em breve",
      description: "Funcionalidade de nova conversa será implementada",
    });
  };

  const handleSendMessage = (content: string) => {
    sendMessageMutation.mutate(content);
  };

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <Header />
      <LeftSidebar collapsed={leftSidebarCollapsed} onToggleCollapse={handleToggleLeftSidebar} />

      <main
        className={cn(
          "fixed top-16 bottom-0 transition-all duration-300 ease-in-out",
          leftSidebarCollapsed ? "left-16" : "left-64",
          rightSidebarCollapsed ? "right-0" : "right-80"
        )}
      >
        <div className="flex h-full">
          <div className="w-96 border-r border-border flex-shrink-0">
            {conversationsLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversationId}
                onSelectConversation={setSelectedConversationId}
                onNewConversation={handleNewConversation}
              />
            )}
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {selectedConversation ? (
              <>
                <ChatArea messages={messages} currentUser={user} />
                <MessageInput
                  onSendMessage={handleSendMessage}
                  disabled={sendMessageMutation.isPending}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-center p-8">
                <div>
                  <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Selecione uma conversa</h3>
                  <p className="text-sm text-muted-foreground">
                    Escolha uma conversa da lista para começar
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <ConversationDetailsSidebar
        conversation={selectedConversation || null}
        collapsed={rightSidebarCollapsed}
        onToggleCollapse={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
        previousConversations={2}
      />
    </div>
  );
}

function MessageSquare(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
