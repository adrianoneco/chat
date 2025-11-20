import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { X, Plus } from "lucide-react";
import type { Tag } from "@shared/schema";

interface ManageTagsModalProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ManageTagsModal({ conversationId, isOpen, onClose }: ManageTagsModalProps) {
  const { toast } = useToast();

  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    enabled: isOpen,
  });

  const { data: conversationTags = [], refetch: refetchConversationTags } = useQuery<Tag[]>({
    queryKey: [`/api/conversations/${conversationId}/tags`],
    enabled: isOpen && !!conversationId,
  });

  const addTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      apiRequest("POST", `/api/conversations/${conversationId}/tags/${tagId}`),
    onSuccess: () => {
      refetchConversationTags();
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Tag adicionada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar tag", variant: "destructive" });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) =>
      apiRequest("DELETE", `/api/conversations/${conversationId}/tags/${tagId}`),
    onSuccess: () => {
      refetchConversationTags();
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({ title: "Tag removida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover tag", variant: "destructive" });
    },
  });

  const conversationTagIds = conversationTags.map((tag) => tag.id);
  const availableTags = allTags.filter((tag) => !conversationTagIds.includes(tag.id));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {conversationTags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Tags ativas</h3>
              <div className="flex flex-wrap gap-2">
                {conversationTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    style={{ backgroundColor: tag.color }}
                    className="text-white gap-1 pr-1"
                  >
                    {tag.name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 hover:bg-white/20"
                      onClick={() => removeTagMutation.mutate(tag.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {availableTags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Adicionar tags</h3>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="cursor-pointer hover:opacity-80 gap-1"
                    style={{ borderColor: tag.color, color: tag.color }}
                    onClick={() => addTagMutation.mutate(tag.id)}
                  >
                    <Plus className="h-3 w-3" />
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {allTags.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">Nenhuma tag cadastrada</p>
              <p className="text-sm">Crie tags nas configurações primeiro</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
