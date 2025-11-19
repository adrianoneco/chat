import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ConversationWithUsers } from "@shared/schema";

interface ForwardMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: ConversationWithUsers[];
  onForward: (conversationIds: string[]) => void;
}

export function ForwardMessageModal({
  open,
  onOpenChange,
  conversations,
  onForward,
}: ForwardMessageModalProps) {
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());

  const handleToggleConversation = (conversationId: string) => {
    const newSelected = new Set(selectedConversations);
    if (newSelected.has(conversationId)) {
      newSelected.delete(conversationId);
    } else {
      newSelected.add(conversationId);
    }
    setSelectedConversations(newSelected);
  };

  const handleForward = () => {
    if (selectedConversations.size > 0) {
      onForward(Array.from(selectedConversations));
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedConversations(new Set());
    onOpenChange(false);
  };

  const handleCancel = () => {
    handleClose();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleClose();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="forward-message-modal">
        <DialogHeader>
          <DialogTitle>Encaminhar mensagem</DialogTitle>
          <DialogDescription>
            Selecione as conversas para encaminhar esta mensagem
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma conversa disponível para encaminhar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => {
              const contact = conversation.client;
              const initials = `${contact.firstName?.charAt(0) || ""}${contact.lastName?.charAt(0) || ""}`.toUpperCase() || "C";
              const isSelected = selectedConversations.has(conversation.id);

              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent",
                    isSelected && "bg-accent border-primary"
                  )}
                  onClick={() => handleToggleConversation(conversation.id)}
                  data-testid={`forward-conversation-${conversation.id}`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleConversation(conversation.id)}
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`forward-checkbox-${conversation.id}`}
                  />
                  
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={contact.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conversation.protocolNumber}
                    </p>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} data-testid="forward-cancel-button">
            Cancelar
          </Button>
          <Button
            onClick={handleForward}
            disabled={selectedConversations.size === 0}
            data-testid="forward-confirm-button"
          >
            Encaminhar para {selectedConversations.size} conversa{selectedConversations.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
