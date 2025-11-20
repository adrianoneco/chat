import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useWebSocket } from "@/hooks/useWebSocket";
import { Plus, Pencil, Trash2, Users, Grid3x3, List, Upload, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { User } from "@shared/schema";

export default function Attendants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocket();
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAttendant, setEditingAttendant] = useState<User | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const { data: attendants = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/attendants"],
  });

  // WebSocket listener for real-time updates
  const handleUserUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/attendants"] });
  }, [queryClient]);

  useEffect(() => {
    const unsubscribe = subscribe('user:update', handleUserUpdate);
    return unsubscribe;
  }, [subscribe, handleUserUpdate]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { profileImageUrl?: string }) => {
      const res = await fetch("/api/attendants", {
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
    onSuccess: async (newAttendant) => {
      if (selectedFile) {
        await uploadPhoto(newAttendant.id, selectedFile);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/attendants"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Atendente criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar atendente", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch(`/api/attendants/${id}`, {
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
    onSuccess: async (updatedAttendant) => {
      if (selectedFile) {
        await uploadPhoto(updatedAttendant.id, selectedFile);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/attendants"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Atendente atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar atendente", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/attendants/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar atendente");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendants"] });
      toast({ title: "Atendente deletado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao deletar atendente", description: error.message, variant: "destructive" });
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

  const resetForm = () => {
    setFormData({ email: "", password: "", firstName: "", lastName: "" });
    setEditingAttendant(null);
    setSelectedFile(null);
    setPreviewUrl("");
  };

  const handleOpenDialog = (attendant?: User) => {
    if (attendant) {
      setEditingAttendant(attendant);
      setFormData({
        email: attendant.email || "",
        password: "",
        firstName: attendant.firstName || "",
        lastName: attendant.lastName || "",
      });
      setPreviewUrl(attendant.profileImageUrl || "");
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
    if (editingAttendant) {
      updateMutation.mutate({ id: editingAttendant.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getUserInitials = (user: User) => {
    return `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase() || "A";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Atendentes</h1>
              <p className="text-muted-foreground">Gerenciar equipe de atendentes</p>
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
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Atendente
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Carregando...</div>
        ) : attendants.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Nenhum atendente cadastrado</p>
              <p className="text-muted-foreground mb-4">Comece adicionando o primeiro atendente</p>
              <Button onClick={() => handleOpenDialog()}>Adicionar Atendente</Button>
            </CardContent>
          </Card>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {attendants.map((attendant) => (
              <Card key={attendant.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center gap-4 pb-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={attendant.profileImageUrl || undefined} alt={attendant.firstName || ""} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg font-semibold">
                      {getUserInitials(attendant)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {attendant.firstName} {attendant.lastName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{attendant.email}</p>
                  </div>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleOpenDialog(attendant)}
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja deletar este atendente?")) {
                        deleteMutation.mutate(attendant.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Deletar
                  </Button>
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
                {attendants.map((attendant) => (
                  <TableRow key={attendant.id}>
                    <TableCell>
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={attendant.profileImageUrl || undefined} alt={attendant.firstName || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                          {getUserInitials(attendant)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">
                      {attendant.firstName} {attendant.lastName}
                    </TableCell>
                    <TableCell>{attendant.email}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDialog(attendant)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja deletar este atendente?")) {
                              deleteMutation.mutate(attendant.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
              <DialogTitle>{editingAttendant ? "Editar Atendente" : "Novo Atendente"}</DialogTitle>
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
                <Label htmlFor="password">Senha {editingAttendant && "(deixe vazio para manter)"}</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingAttendant}
                  minLength={6}
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingAttendant ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
  );
}
