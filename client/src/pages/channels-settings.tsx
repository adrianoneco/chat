import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, MessageCircle, QrCode, CheckCircle, XCircle } from "lucide-react";
import type { ChannelWithCreator } from "@shared/schema";

export default function ChannelsSettings() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelWithCreator | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "whatsapp",
    isActive: false,
    apiUrl: "",
    apiKey: "",
    instanceId: "",
  });

  const { data: channels = [], isLoading } = useQuery<ChannelWithCreator[]>({
    queryKey: ["/api/channels"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/channels", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Canal criado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar canal", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      apiRequest("PATCH", `/api/channels/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Canal atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar canal", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/channels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      toast({ title: "Canal deletado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao deletar canal", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "whatsapp",
      isActive: false,
      apiUrl: "",
      apiKey: "",
      instanceId: "",
    });
    setEditingChannel(null);
  };

  const handleOpenDialog = (channel?: ChannelWithCreator) => {
    if (channel) {
      setEditingChannel(channel);
      setFormData({
        name: channel.name,
        type: channel.type,
        isActive: channel.isActive,
        apiUrl: channel.apiUrl,
        apiKey: channel.apiKey,
        instanceId: channel.instanceId,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingChannel) {
      updateMutation.mutate({ id: editingChannel.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getWebhookUrl = (instanceId: string) => {
    return `${window.location.origin}/api/channels/evolution/webhook/${instanceId}`;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Canais</h2>
          <p className="text-muted-foreground">Configure integrações com WhatsApp via EvolutionAPI</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2" data-testid="button-add-channel">
          <Plus className="w-4 h-4" />
          Novo Canal
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : channels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Nenhum canal configurado</p>
            <p className="text-muted-foreground mb-4">
              Conecte seu WhatsApp via EvolutionAPI para receber mensagens
            </p>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-first-channel">
              Configurar Canal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {channels.map((channel) => (
            <Card key={channel.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5" />
                    <div>
                      <CardTitle>{channel.name}</CardTitle>
                      <CardDescription>Instância: {channel.instanceId}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {channel.isActive ? (
                      <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100">
                        <CheckCircle className="w-3 h-3" />
                        Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                        <XCircle className="w-3 h-3" />
                        Inativo
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">API URL:</span>
                    <p className="font-mono text-xs mt-1 p-2 bg-muted rounded">{channel.apiUrl}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipo:</span>
                    <p className="mt-1 capitalize">{channel.type}</p>
                  </div>
                </div>

                <div>
                  <Label>Webhook URL (Configure no EvolutionAPI)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={getWebhookUrl(channel.instanceId)}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(getWebhookUrl(channel.instanceId));
                        toast({ title: "URL copiada!" });
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>

                {channel.config?.qrCode && (
                  <div className="flex flex-col items-center gap-2 p-4 border rounded">
                    <QrCode className="w-5 h-5" />
                    <p className="text-sm text-muted-foreground">QR Code disponível</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleOpenDialog(channel)}
                    data-testid={`button-edit-channel-${channel.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja deletar este canal?")) {
                        deleteMutation.mutate(channel.id);
                      }
                    }}
                    data-testid={`button-delete-channel-${channel.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                    Deletar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingChannel ? "Editar Canal" : "Novo Canal"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Canal</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Ex: WhatsApp Principal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiUrl">EvolutionAPI URL</Label>
              <Input
                id="apiUrl"
                value={formData.apiUrl}
                onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                required
                placeholder="https://evolution-api.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                required
                placeholder="Sua chave de API do EvolutionAPI"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instanceId">Instance ID</Label>
              <Input
                id="instanceId"
                value={formData.instanceId}
                onChange={(e) => setFormData({ ...formData, instanceId: e.target.value })}
                required
                placeholder="Ex: my-instance"
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <Label htmlFor="isActive" className="cursor-pointer">Canal Ativo</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-is-active"
              />
            </div>

            <div className="p-4 bg-muted rounded-md space-y-2">
              <h4 className="font-semibold text-sm">Configuração no EvolutionAPI</h4>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>Configure o webhook URL no seu EvolutionAPI</li>
                <li>Ative a instância e escaneie o QR Code</li>
                <li>Ative este canal aqui após conectar</li>
              </ol>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingChannel ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
