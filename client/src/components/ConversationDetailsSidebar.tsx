import { ChevronLeft, ChevronRight, MapPin, Hash, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConversationWithUsers } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConversationDetailsSidebarProps {
  conversation: ConversationWithUsers | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  previousConversations?: number;
}

export function ConversationDetailsSidebar({
  conversation,
  collapsed,
  onToggleCollapse,
  previousConversations = 0,
}: ConversationDetailsSidebarProps) {
  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { label: "Pendente", className: "bg-status-pending/10 text-status-pending border-status-pending/20" },
      attending: { label: "Atendendo", className: "bg-status-attending/10 text-status-attending border-status-attending/20" },
      closed: { label: "Fechada", className: "bg-status-offline/10 text-status-offline border-status-offline/20" },
    };
    const variant = variants[status as keyof typeof variants] || variants.pending;
    return <Badge variant="outline" className={cn("border", variant.className)}>{variant.label}</Badge>;
  };

  return (
    <>
      {!collapsed && (
        <aside
          className="fixed right-0 top-16 bottom-0 w-80 bg-background border-l border-border transition-all duration-300 ease-in-out z-30 overflow-y-auto"
          data-testid="sidebar-right"
        >
          {conversation ? (
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Detalhes da Conversa</h2>
                  {getStatusBadge(conversation.status)}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Protocolo:</span>
                    <span className="font-mono font-semibold" data-testid="text-protocol-number">
                      {conversation.protocolNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Criada em:</span>
                    <span className="font-medium">
                      {format(new Date(conversation.createdAt!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Cliente
                </h3>
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={conversation.client.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {conversation.client.firstName?.charAt(0) || "C"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" data-testid="text-client-name">
                      {conversation.client.firstName} {conversation.client.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {conversation.client.email}
                    </p>
                  </div>
                </div>
              </div>

              {conversation.attendant && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Atendente
                    </h3>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={conversation.attendant.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {conversation.attendant.firstName?.charAt(0) || "A"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" data-testid="text-attendant-name">
                          {conversation.attendant.firstName} {conversation.attendant.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.attendant.email}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {conversation.clientLocation && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Geolocalização
                    </h3>
                    <p className="text-sm text-muted-foreground" data-testid="text-client-location">
                      {conversation.clientLocation}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Conversas Anteriores</h3>
                <div className="flex items-center justify-center p-6 bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary" data-testid="text-previous-conversations">
                      {previousConversations}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {previousConversations === 1 ? "conversa anterior" : "conversas anteriores"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-8 text-center">
              <div>
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Selecione uma conversa para ver os detalhes
                </p>
              </div>
            </div>
          )}
        </aside>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 w-6 h-12 rounded-l-md bg-background border border-border shadow-md hover-elevate active-elevate-2 z-40 transition-all duration-300",
          collapsed ? "right-0" : "right-80"
        )}
        data-testid="button-toggle-right-sidebar"
      >
        {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </Button>
    </>
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
