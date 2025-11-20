import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, User as UserIcon } from "lucide-react";
import type { User } from "@shared/schema";

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectContact: (contactId: string) => void;
}

export function NewConversationModal({ open, onOpenChange, onSelectContact }: NewConversationModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: contacts = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/clients"],
    enabled: open,
  });

  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    
    const term = searchTerm.toLowerCase();
    return contacts.filter((contact) => {
      const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
      const email = contact.email.toLowerCase();
      return fullName.includes(term) || email.includes(term);
    });
  }, [contacts, searchTerm]);

  const getUserInitials = (user: User) => {
    return `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase() || "C";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-contact"
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8">
                <UserIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {searchTerm ? "Nenhum contato encontrado" : "Nenhum contato cadastrado"}
                </p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <Button
                  key={contact.id}
                  variant="ghost"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={() => {
                    onSelectContact(contact.id);
                    onOpenChange(false);
                    setSearchTerm("");
                  }}
                  data-testid={`button-select-contact-${contact.id}`}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={contact.profileImageUrl || undefined} alt={contact.firstName || ""} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {getUserInitials(contact)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <div className="font-medium">
                      {contact.firstName} {contact.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">{contact.email}</div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
