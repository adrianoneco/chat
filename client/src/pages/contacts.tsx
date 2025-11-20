import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Plus, Pencil, Trash2, ContactRound, MessageSquare, Grid3x3, List, Upload, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User } from "@shared/schema";

export default function Contacts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { subscribe } = useWebSocket();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<User | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const canManageContacts = user?.role === 'admin' || user?.role === 'attendant';
  const canEditContact = (contact: User) => {
    if (user?.role === 'admin' || user?.role === 'attendant') return true;
    return user?.id === contact.id;
  };

  const { data: contacts = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/clients"],
  });

  const handleUserUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
  }, [queryClient]);

  useEffect(() => {
    const unsubscribe = subscribe('user:update', handleUserUpdate);
    return unsubscribe;
  }, [subscribe, handleUserUpdate]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { profileImageUrl?: string }) => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: async (newContact) => {
      if (selectedFile) {
        await uploadPhoto(newContact.id, selectedFile);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Contato criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar contato", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: async (updatedContact) => {
      if (selectedFile) {
        await uploadPhoto(updatedContact.id, selectedFile);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Contato atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar contato", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar contato");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Contato deletado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao deletar contato", description: error.message, variant: "destructive" });
    },
  });

  const uploadPhoto = async (userId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`/api/upload/profile-image/${userId}`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Erro ao fazer upload");
    return res.json();
  };

  const startConversationMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, status: "pending" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: (conversation) => {
      toast({ title: "Conversa iniciada!" });
      setLocation(`/conversations/${conversation.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao iniciar conversa", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ email: "", password: "", firstName: "", lastName: "" });
    setEditingContact(null);
    setSelectedFile(null);
    setPreviewUrl("");
  };

  const handleOpenDialog = (contact?: User) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        email: contact.email || "",
        password: "",
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
      });
      setPreviewUrl(contact.profileImageUrl || "");
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Selecione uma imagem válida", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Imagem muito grande (máx. 5MB)", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getUserInitials = (user: User) => {
    return `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase() || "C";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
            <ContactRound className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Contatos</h1>
            <p className="text-muted-foreground">Gerenciar clientes e iniciar conversas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "cards" | "table")}>
            <TabsList>
              <TabsTrigger value="cards" className="gap-2">
                <Grid3x3 className="w-4 h-4" />
                Cards
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-2">
                <List className="w-4 h-4" />
                Tabela
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {canManageContacts && (
            <Button onClick={() => handleOpenDialog()} className="gap-2" data-testid="button-add-contact">
              <Plus className="w-4 h-4" />
              Adicionar Contato
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ContactRound className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Nenhum contato cadastrado</p>
            <p className="text-muted-foreground mb-4">
              {canManageContacts ? "Comece adicionando o primeiro contato" : "Nenhum contato disponível"}
            </p>
            {canManageContacts && (
              <Button onClick={() => handleOpenDialog()} data-testid="button-add-first-contact">
                Adicionar Contato
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center gap-4 pb-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={contact.profileImageUrl || undefined} alt={contact.firstName || ""} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg font-semibold">
                    {getUserInitials(contact)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {contact.firstName} {contact.lastName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{contact.email}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full gap-2"
                  onClick={() => startConversationMutation.mutate(contact.id)}
                  disabled={startConversationMutation.isPending}
                  data-testid={`button-start-conversation-${contact.id}`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Iniciar Conversa
                </Button>
                {canEditContact(contact) && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => handleOpenDialog(contact)}
                      data-testid={`button-edit-contact-${contact.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </Button>
                    {canManageContacts && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja deletar este contato?")) {
                            deleteMutation.mutate(contact.id);
                          }
                        }}
                        data-testid={`button-delete-contact-${contact.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                        Deletar
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Foto</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={contact.profileImageUrl || undefined} alt={contact.firstName || ""} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {getUserInitials(contact)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    {contact.firstName} {contact.lastName}
                  </TableCell>
                  <TableCell>{contact.email}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => startConversationMutation.mutate(contact.id)}
                        disabled={startConversationMutation.isPending}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      {canEditContact(contact) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDialog(contact)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {canManageContacts && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja deletar este contato?")) {
                              deleteMutation.mutate(contact.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Editar Contato" : "Novo Contato"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={previewUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
                    {formData.firstName && formData.lastName
                      ? `${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`.toUpperCase()
                      : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload">
                    <Button
                      type="button"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => document.getElementById('photo-upload')?.click()}
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                  </label>
                </div>
                {previewUrl && (
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl("");
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha {editingContact && "(deixe vazio para manter)"}</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingContact}
                minLength={6}
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingContact ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
