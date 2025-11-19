import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocketConversation, useWebSocketMessage } from "@/hooks/useWebSocket";
import { Header } from "@/components/Header";
import { LeftSidebar } from "@/components/LeftSidebar";
import { ConversationList } from "@/components/ConversationList";
import { ConversationHeader } from "@/components/ConversationHeader";
import { ChatArea } from "@/components/ChatArea";
import { MessageInput } from "@/components/MessageInput";
import { ConversationDetailsSidebar } from "@/components/ConversationDetailsSidebar";
import { ForwardMessageModal } from "@/components/ForwardMessageModal";
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
  const [replyingTo, setReplyingTo] = useState<MessageWithSender | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [uploadFileName, setUploadFileName] = useState<string | undefined>(undefined);
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [messageToForward, setMessageToForward] = useState<MessageWithSender | null>(null);
  const [optimisticMessage, setOptimisticMessage] = useState<MessageWithSender | null>(null);

  useEffect(() => {
    if (conversationIdFromRoute) {
      setSelectedConversationId(conversationIdFromRoute);
    }
  }, [conversationIdFromRoute]);

  // Reset replyingTo when conversation changes
  useEffect(() => {
    setReplyingTo(null);
  }, [selectedConversationId]);

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

  const { data: fetchedMessages = [] } = useQuery<MessageWithSender[]>({
    queryKey: ["/api/messages", selectedConversationId],
    enabled: !!selectedConversationId && isAuthenticated,
  });

  // Create stable messages array that includes optimistic message
  const messages = useMemo(() => {
    if (optimisticMessage && optimisticMessage.conversationId === selectedConversationId) {
      return [...fetchedMessages, optimisticMessage];
    }
    return fetchedMessages;
  }, [fetchedMessages, optimisticMessage, selectedConversationId]);

  // Reprocess audio files without ID3 tags when conversation is loaded
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const reprocessAudios = async () => {
      const audioMessages = messages.filter(
        m => m.type === 'audio' && 
        m.fileMetadata?.url && 
        !m.fileMetadata?.id3 &&
        !m.id.startsWith('temp-') // Skip optimistic messages
      );

      for (const message of audioMessages) {
        try {
          const response = await fetch(`/api/messages/${message.id}/reprocess-audio`, {
            method: 'POST',
            credentials: 'include',
          });

          if (response.ok) {
            // Invalidate queries to refresh messages with new metadata
            queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedConversationId] });
          }
        } catch (error) {
          console.error('Error reprocessing audio:', error);
        }
      }
    };

    reprocessAudios();
  }, [messages, selectedConversationId]);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  // WebSocket listeners for real-time updates
  const handleWSNewConversation = useCallback((conversation: ConversationWithUsers) => {
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    toast({
      title: "Nova conversa",
      description: `Conversa com ${conversation.client.firstName} foi criada`,
    });
  }, [toast]);

  const handleWSConversationUpdate = useCallback((conversation: ConversationWithUsers) => {
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
  }, []);

  const handleWSNewMessage = useCallback((message: MessageWithSender) => {
    // Always refresh conversations list to update last message
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    // Also refresh messages if this is the active conversation
    if (selectedConversationId) {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedConversationId] });
    }
  }, [selectedConversationId]);

  useWebSocketConversation(handleWSNewConversation, handleWSConversationUpdate);
  useWebSocketMessage(selectedConversationId, handleWSNewMessage);

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
    mutationFn: async ({ content, replyToId }: { content: string; replyToId?: string }) => {
      if (!selectedConversationId) return;
      await apiRequest("POST", "/api/messages", {
        conversationId: selectedConversationId,
        content,
        type: "text",
        replyToId,
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

  const sendFileMutation = useMutation({
    mutationFn: async ({ file, type, replyToId }: { file: File; type: string; replyToId?: string }) => {
      if (!selectedConversationId || !user) return;
      
      setUploadProgress(0);
      setUploadFileName(file.name);
      
      // Create optimistic message to show immediately
      const optimisticMsg: MessageWithSender = {
        id: `temp-${Date.now()}`,
        conversationId: selectedConversationId,
        senderId: user.id,
        content: file.name,
        type: type as any,
        replyToId: replyToId || null,
        forwardedFromId: null,
        createdAt: new Date(),
        deleted: false,
        fileMetadata: {
          url: URL.createObjectURL(file),
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        },
        sender: user,
        reactions: [],
      };
      setOptimisticMessage(optimisticMsg);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', selectedConversationId);
      formData.append('type', type);

      const abortController = new AbortController();
      setUploadAbortController(abortController);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const uploadData = JSON.parse(xhr.responseText);

              await apiRequest("POST", "/api/messages", {
                conversationId: selectedConversationId,
                content: uploadData.fileName || 'Arquivo',
                type,
                replyToId,
                fileMetadata: {
                  url: uploadData.url,
                  fileName: uploadData.fileName,
                  fileSize: uploadData.fileSize,
                  mimeType: uploadData.mimeType,
                  ...(uploadData.audioMetadata && {
                    id3: {
                      title: uploadData.audioMetadata.title,
                      artist: uploadData.audioMetadata.artist,
                      album: uploadData.audioMetadata.album,
                      coverArt: uploadData.audioMetadata.albumArt,
                    },
                  }),
                },
              });

              setUploadProgress(100);
              setTimeout(() => {
                setUploadProgress(undefined);
                setUploadFileName(undefined);
                setOptimisticMessage(null);
              }, 1000);
              resolve(uploadData);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          setUploadProgress(undefined);
          setUploadFileName(undefined);
          setOptimisticMessage(null);
          reject(new Error('Upload failed'));
        });

        xhr.addEventListener('abort', () => {
          setUploadProgress(undefined);
          setUploadFileName(undefined);
          setOptimisticMessage(null);
          reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', '/api/upload/message-file');
        xhr.send(formData);

        abortController.signal.addEventListener('abort', () => {
          xhr.abort();
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Arquivo enviado!",
      });
      setUploadAbortController(null);
    },
    onError: (error) => {
      setUploadProgress(undefined);
      setUploadFileName(undefined);
      setOptimisticMessage(null);
      setUploadAbortController(null);
      toast({
        title: "Erro ao enviar arquivo",
        description: error instanceof Error ? error.message : "Tente novamente",
        variant: "destructive",
      });
    },
  });

  const handleToggleLeftSidebar = () => {
    const newState = !leftSidebarCollapsed;
    setLeftSidebarCollapsed(newState);
    updateSidebarPreference.mutate(newState);
  };

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedConversationId(conversation.id);
      toast({
        title: "Conversa criada!",
        description: "Nova conversa foi criada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar conversa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNewConversation = () => {
    createConversationMutation.mutate();
  };

  const handleSendMessage = (content: string, replyToId?: string) => {
    // Guard: Only include replyToId if it's from the current conversation
    const validReplyToId = replyingTo?.conversationId === selectedConversationId ? replyToId : undefined;
    sendMessageMutation.mutate({ content, replyToId: validReplyToId });
  };

  const handleSendFile = (file: File, type: string, replyToId?: string) => {
    const validReplyToId = replyingTo?.conversationId === selectedConversationId ? replyToId : undefined;
    sendFileMutation.mutate({ file, type, replyToId: validReplyToId });
  };

  const handleReply = (message: MessageWithSender) => {
    setReplyingTo(message);
  };

  const forwardMessageMutation = useMutation({
    mutationFn: async ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
      const message = messages.find(m => m.id === messageId);
      if (!message) throw new Error('Message not found');

      await apiRequest("POST", "/api/messages", {
        conversationId,
        content: message.content,
        type: message.type,
        forwardedFromId: messageId,
        fileMetadata: message.fileMetadata,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Mensagem encaminhada!",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao encaminhar mensagem",
        variant: "destructive",
      });
    },
  });

  const handleForward = (message: MessageWithSender) => {
    setMessageToForward(message);
    setForwardModalOpen(true);
  };

  const handleForwardToConversations = (conversationIds: string[]) => {
    if (!messageToForward) return;

    const sourceConversationId = messageToForward.conversationId;
    const filteredIds = conversationIds.filter(id => id !== sourceConversationId);

    filteredIds.forEach((conversationId) => {
      forwardMessageMutation.mutate({
        messageId: messageToForward.id,
        conversationId,
      });
    });

    setMessageToForward(null);
  };

  const handleForwardModalClose = (open: boolean) => {
    setForwardModalOpen(open);
    if (!open) {
      setMessageToForward(null);
    }
  };

  const reactToMessageMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      await apiRequest("POST", "/api/reactions", {
        messageId,
        emoji,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedConversationId] });
    },
    onError: () => {
      toast({
        title: "Erro ao adicionar reação",
        variant: "destructive",
      });
    },
  });

  const handleReact = (message: MessageWithSender, emoji: string) => {
    reactToMessageMutation.mutate({ messageId: message.id, emoji });
  };

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest("DELETE", `/api/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Mensagem deletada",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao deletar mensagem",
        variant: "destructive",
      });
    },
  });

  const handleDeleteMessage = (message: MessageWithSender) => {
    deleteMessageMutation.mutate(message.id);
  };

  const updateConversationStatusMutation = useMutation({
    mutationFn: async ({ conversationId, status }: { conversationId: string; status: string }) => {
      await apiRequest("PATCH", `/api/conversations/${conversationId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Status atualizado",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar status",
        variant: "destructive",
      });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      await apiRequest("DELETE", `/api/conversations/${conversationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedConversationId(undefined);
      toast({
        title: "Conversa deletada",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao deletar conversa",
        variant: "destructive",
      });
    },
  });

  const transferConversationMutation = useMutation({
    mutationFn: async ({ conversationId, attendantId }: { conversationId: string; attendantId: string }) => {
      await apiRequest("PATCH", `/api/conversations/${conversationId}/transfer`, { attendantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Conversa transferida",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao transferir conversa",
        variant: "destructive",
      });
    },
  });

  const handleStartConversation = (conversationId: string) => {
    updateConversationStatusMutation.mutate({ conversationId, status: "attending" });
  };

  const handleCloseConversation = (conversationId: string) => {
    updateConversationStatusMutation.mutate({ conversationId, status: "closed" });
  };

  const handleReopenConversation = (conversationId: string) => {
    updateConversationStatusMutation.mutate({ conversationId, status: "attending" });
  };

  const handleDeleteConversation = (conversationId: string) => {
    deleteConversationMutation.mutate(conversationId);
  };

  const handleTransferConversation = (conversationId: string) => {
    // TODO: Show a dialog to select attendant
    toast({
      title: "Transferir conversa",
      description: "Funcionalidade em desenvolvimento",
    });
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
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
                onStartConversation={handleStartConversation}
                onCloseConversation={handleCloseConversation}
                onReopenConversation={handleReopenConversation}
                onTransferConversation={handleTransferConversation}
                onDeleteConversation={handleDeleteConversation}
              />
            )}
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {selectedConversation ? (
              <>
                <ConversationHeader
                  conversation={selectedConversation}
                  onVoiceCall={() => toast({ title: "Chamada de voz", description: "Funcionalidade em desenvolvimento" })}
                  onVideoCall={() => toast({ title: "Chamada de vídeo", description: "Funcionalidade em desenvolvimento" })}
                  onScreenShare={() => toast({ title: "Compartilhar tela", description: "Funcionalidade em desenvolvimento" })}
                  onStartConversation={() => handleStartConversation(selectedConversation.id)}
                  onCloseConversation={() => handleCloseConversation(selectedConversation.id)}
                  onReopenConversation={() => handleReopenConversation(selectedConversation.id)}
                  onTransferConversation={() => handleTransferConversation(selectedConversation.id)}
                  onDeleteConversation={() => handleDeleteConversation(selectedConversation.id)}
                />
                <ChatArea 
                  messages={messages} 
                  currentUser={user}
                  onReply={handleReply}
                  onForward={handleForward}
                  onReact={handleReact}
                  onDelete={handleDeleteMessage}
                />
                <MessageInput
                  onSendMessage={handleSendMessage}
                  onSendFile={handleSendFile}
                  disabled={sendMessageMutation.isPending || sendFileMutation.isPending}
                  replyingTo={replyingTo}
                  onCancelReply={handleCancelReply}
                  uploadProgress={uploadProgress}
                  uploadFileName={uploadFileName}
                  onCancelUpload={() => {
                    if (uploadAbortController) {
                      uploadAbortController.abort();
                      setUploadProgress(undefined);
                      setUploadFileName(undefined);
                      setUploadAbortController(null);
                    }
                  }}
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

      <ForwardMessageModal
        open={forwardModalOpen}
        onOpenChange={handleForwardModalClose}
        conversations={conversations.filter(c => c.id !== messageToForward?.conversationId)}
        onForward={handleForwardToConversations}
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
