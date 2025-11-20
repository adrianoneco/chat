import { useState } from "react";
import { Search, Plus, Play, XCircle, RotateCcw, Users, Trash2, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { ConversationWithUsers } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConversationListProps {
  conversations: ConversationWithUsers[];
  selectedId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onStartConversation?: (id: string) => void;
  onCloseConversation?: (id: string) => void;
  onReopenConversation?: (id: string) => void;
  onTransferConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelectConversation,
  onNewConversation,
  onStartConversation,
  onCloseConversation,
  onReopenConversation,
  onTransferConversation,
  onDeleteConversation,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "attending" | "closed">("pending");

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-status-pending";
      case "attending":
        return "bg-status-attending";
      case "closed":
        return "bg-status-offline";
      default:
        return "bg-status-offline";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: "Pendente",
      attending: "Atendendo",
      closed: "Fechada",
    };
    return labels[status as keyof typeof labels] || status;
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.protocolNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.client.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.client.lastName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab = conv.status === activeTab;

    return matchesSearch && matchesTab;
  });

  const getTabCounts = () => {
    return {
      pending: conversations.filter((c) => c.status === "pending").length,
      attending: conversations.filter((c) => c.status === "attending").length,
      closed: conversations.filter((c) => c.status === "closed").length,
    };
  };

  const tabCounts = getTabCounts();

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 space-y-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-conversations"
            />
          </div>
          <Button onClick={onNewConversation} className="gap-2 flex-shrink-0" data-testid="button-new-conversation">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova</span>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="gap-2" data-testid="tab-pending">
              <span>Pendente</span>
              {tabCounts.pending > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {tabCounts.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="attending" className="gap-2" data-testid="tab-attending">
              <span>Atendendo</span>
              {tabCounts.attending > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {tabCounts.attending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="closed" className="gap-2" data-testid="tab-closed">
              <span>Fechada</span>
              {tabCounts.closed > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {tabCounts.closed}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Nenhuma conversa encontrada" : `Nenhuma conversa ${getStatusLabel(activeTab).toLowerCase()}`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredConversations.map((conversation) => (
              <ContextMenu key={conversation.id}>
                <ContextMenuTrigger asChild>
                  <button
                    onClick={() => onSelectConversation(conversation.id)}
                    className={cn(
                      "w-full p-4 flex items-center gap-3 hover-elevate active-elevate-2 transition-colors text-left",
                      selectedId === conversation.id && "bg-accent"
                    )}
                    data-testid={`conversation-item-${conversation.id}`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={conversation.client.profileImageUrl || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {conversation.client.firstName?.charAt(0) || "C"}
                          {conversation.client.lastName?.charAt(0) || ""}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background",
                          getStatusDotColor(conversation.status)
                        )}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-medium text-sm truncate" data-testid={`text-conversation-name-${conversation.id}`}>
                          {conversation.client.firstName} {conversation.client.lastName}
                        </h3>
                        {conversation.lastMessageAt && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conversation.lastMessage || "Sem mensagens ainda"}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">#{conversation.protocolNumber}</span>
                        {conversation.tags && conversation.tags.length > 0 && (
                          <>
                            {conversation.tags.slice(0, 2).map((tag) => (
                              <Badge
                                key={tag.id}
                                style={{ backgroundColor: tag.color }}
                                className="text-white text-xs px-1.5 py-0 h-auto"
                              >
                                {tag.name}
                              </Badge>
                            ))}
                            {conversation.tags.length > 2 && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0 h-auto">
                                +{conversation.tags.length - 2}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  {conversation.status === "pending" && onStartConversation && (
                    <ContextMenuItem onClick={() => onStartConversation(conversation.id)}>
                      <Play className="mr-2 h-4 w-4" />
                      Iniciar Conversa
                    </ContextMenuItem>
                  )}
                  {conversation.status === "attending" && onCloseConversation && (
                    <ContextMenuItem onClick={() => onCloseConversation(conversation.id)}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Fechar Conversa
                    </ContextMenuItem>
                  )}
                  {conversation.status === "closed" && onReopenConversation && (
                    <ContextMenuItem onClick={() => onReopenConversation(conversation.id)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reabrir Conversa
                    </ContextMenuItem>
                  )}
                  {onTransferConversation && (
                    <ContextMenuItem onClick={() => onTransferConversation(conversation.id)}>
                      <Users className="mr-2 h-4 w-4" />
                      Transferir
                    </ContextMenuItem>
                  )}
                  {onDeleteConversation && (
                    <ContextMenuItem 
                      onClick={() => onDeleteConversation(conversation.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Apagar
                    </ContextMenuItem>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        )}
      </div>
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
