import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import type { User } from "@shared/schema";

export default function Attendants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAttendant, setEditingAttendant] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    profileImageUrl: "",
  });

  const { data: attendants = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/attendants"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
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
    onSuccess: () => {
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
    onSuccess: () => {
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

  const resetForm = () => {
    setFormData({ email: "", password: "", firstName: "", lastName: "", profileImageUrl: "" });
    setEditingAttendant(null);
  };

  const handleOpenDialog = (attendant?: User) => {
    if (attendant) {
      setEditingAttendant(attendant);
      setFormData({
        email: attendant.email || "",
        password: "",
        firstName: attendant.firstName || "",
        lastName: attendant.lastName || "",
        profileImageUrl: attendant.profileImageUrl || "",
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
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
    <AppLayout>
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
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="w-4 h-4" />
            Adicionar Atendente
          </Button>
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
        ) : (
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
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAttendant ? "Editar Atendente" : "Novo Atendente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="profileImageUrl">URL da Foto (opcional)</Label>
                <Input
                  id="profileImageUrl"
                  type="url"
                  value={formData.profileImageUrl}
                  onChange={(e) => setFormData({ ...formData, profileImageUrl: e.target.value })}
                  placeholder="https://exemplo.com/foto.jpg"
                />
              </div>
              <div className="flex gap-2 justify-end">
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
    </AppLayout>
  );
}
