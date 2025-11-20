import { Phone, Video, MonitorUp, MoreVertical, Play, XCircle, RotateCcw, Users, Trash2, Tag } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ConversationWithUsers } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConversationHeaderProps {
  conversation: ConversationWithUsers;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onScreenShare?: () => void;
  onStartConversation?: () => void;
  onCloseConversation?: () => void;
  onReopenConversation?: () => void;
  onTransferConversation?: () => void;
  onDeleteConversation?: () => void;
  onManageTags?: () => void;
}

export function ConversationHeader({
  conversation,
  onVoiceCall,
  onVideoCall,
  onScreenShare,
  onStartConversation,
  onCloseConversation,
  onReopenConversation,
  onTransferConversation,
  onDeleteConversation,
  onManageTags,
}: ConversationHeaderProps) {
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

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Aguardando atendimento";
      case "attending":
        return "Online";
      case "closed":
        return "Conversa encerrada";
      default:
        return "Offline";
    }
  };

  const getLastSeenText = () => {
    if (conversation.status === "attending") {
      return "online agora";
    }
    if (conversation.lastMessageAt) {
      return `visto por último ${formatDistanceToNow(new Date(conversation.lastMessageAt), {
        addSuffix: true,
        locale: ptBR,
      })}`;
    }
    return "nunca visto";
  };

  return (
    <div className="border-b border-border bg-background px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left side: Profile info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <Avatar className="w-10 h-10">
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
            <h2 className="text-sm font-semibold truncate">
              {conversation.client.firstName} {conversation.client.lastName}
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              {getLastSeenText()}
            </p>
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-1">
          {onVoiceCall && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onVoiceCall}
              className="h-9 w-9"
              title="Chamada de voz"
            >
              <Phone className="h-5 w-5" />
            </Button>
          )}
          {onVideoCall && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onVideoCall}
              className="h-9 w-9"
              title="Chamada de vídeo"
            >
              <Video className="h-5 w-5" />
            </Button>
          )}
          {onScreenShare && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onScreenShare}
              className="h-9 w-9"
              title="Compartilhar tela"
            >
              <MonitorUp className="h-5 w-5" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {conversation.status === "pending" && onStartConversation && (
                <DropdownMenuItem onClick={onStartConversation}>
                  <Play className="mr-2 h-4 w-4" />
                  Iniciar Conversa
                </DropdownMenuItem>
              )}
              {conversation.status === "attending" && onCloseConversation && (
                <DropdownMenuItem onClick={onCloseConversation}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Fechar Conversa
                </DropdownMenuItem>
              )}
              {conversation.status === "closed" && onReopenConversation && (
                <DropdownMenuItem onClick={onReopenConversation}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reabrir Conversa
                </DropdownMenuItem>
              )}
              {onTransferConversation && (
                <DropdownMenuItem onClick={onTransferConversation}>
                  <Users className="mr-2 h-4 w-4" />
                  Transferir
                </DropdownMenuItem>
              )}
              {onManageTags && (
                <DropdownMenuItem onClick={onManageTags}>
                  <Tag className="mr-2 h-4 w-4" />
                  Tags
                </DropdownMenuItem>
              )}
              {onDeleteConversation && (
                <DropdownMenuItem 
                  onClick={onDeleteConversation}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Apagar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
