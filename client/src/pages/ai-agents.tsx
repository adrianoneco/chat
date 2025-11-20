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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Bot, Sparkles } from "lucide-react";
import type { AiAgentWithCreator } from "@shared/schema";

export default function AiAgents() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AiAgentWithCreator | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemInstructions: "",
    isActive: false,
    provider: "openai",
    model: "gpt-4",
    temperature: "0.7",
    maxTokens: "500",
    autoReplyEnabled: false,
    autoReplyDelay: "0",
  });

  const { data: agents = [], isLoading } = useQuery<AiAgentWithCreator[]>({
    queryKey: ["/api/ai-agents"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/ai-agents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Agente IA criado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar agente IA", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      apiRequest("PATCH", `/api/ai-agents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Agente IA atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar agente IA", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ai-agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      toast({ title: "Agente IA deletado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao deletar agente IA", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      systemInstructions: "",
      isActive: false,
      provider: "openai",
      model: "gpt-4",
      temperature: "0.7",
      maxTokens: "500",
      autoReplyEnabled: false,
      autoReplyDelay: "0",
    });
    setEditingAgent(null);
  };

  const handleOpenDialog = (agent?: AiAgentWithCreator) => {
    if (agent) {
      setEditingAgent(agent);
      setFormData({
        name: agent.name,
        description: agent.description || "",
        systemInstructions: agent.systemInstructions,
        isActive: agent.isActive,
        provider: agent.provider,
        model: agent.model,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        autoReplyEnabled: agent.autoReplyEnabled,
        autoReplyDelay: agent.autoReplyDelay,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAgent) {
      updateMutation.mutate({ id: editingAgent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Agentes I.A</h1>
            <p className="text-muted-foreground">Automatize respostas nas conversas</p>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2" data-testid="button-add-agent">
          <Plus className="w-4 h-4" />
          Novo Agente
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Nenhum agente IA cadastrado</p>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro agente para automatizar respostas
            </p>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-first-agent">
              Criar Agente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Card key={agent.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    {agent.name}
                  </CardTitle>
                  {agent.isActive && (
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100">
                      Ativo
                    </span>
                  )}
                </div>
                {agent.description && (
                  <CardDescription>{agent.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider:</span>
                    <span className="font-medium">{agent.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modelo:</span>
                    <span className="font-medium">{agent.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resposta automática:</span>
                    <span className="font-medium">{agent.autoReplyEnabled ? 'Sim' : 'Não'}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleOpenDialog(agent)}
                    data-testid={`button-edit-agent-${agent.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja deletar este agente?")) {
                        deleteMutation.mutate(agent.id);
                      }
                    }}
                    data-testid={`button-delete-agent-${agent.id}`}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAgent ? "Editar Agente IA" : "Novo Agente IA"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Ex: Assistente de Atendimento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descrição do agente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemInstructions">Instruções do Sistema</Label>
              <Textarea
                id="systemInstructions"
                value={formData.systemInstructions}
                onChange={(e) => setFormData({ ...formData, systemInstructions: e.target.value })}
                required
                rows={6}
                placeholder="Defina como o agente deve se comportar, seu tom, conhecimento, etc..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select
                  value={formData.provider}
                  onValueChange={(value) => setFormData({ ...formData, provider: value })}
                >
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Select
                  value={formData.model}
                  onValueChange={(value) => setFormData({ ...formData, model: value })}
                >
                  <SelectTrigger data-testid="select-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-3">Claude 3</SelectItem>
                    <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperatura (0-1)</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTokens">Máximo de Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={formData.maxTokens}
                  onChange={(e) => setFormData({ ...formData, maxTokens: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label htmlFor="isActive" className="cursor-pointer">Agente Ativo</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-is-active"
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <Label htmlFor="autoReplyEnabled" className="cursor-pointer">Resposta Automática</Label>
              <Switch
                id="autoReplyEnabled"
                checked={formData.autoReplyEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, autoReplyEnabled: checked })}
                data-testid="switch-auto-reply"
              />
            </div>

            {formData.autoReplyEnabled && (
              <div className="space-y-2">
                <Label htmlFor="autoReplyDelay">Atraso de Resposta (segundos)</Label>
                <Input
                  id="autoReplyDelay"
                  type="number"
                  min="0"
                  value={formData.autoReplyDelay}
                  onChange={(e) => setFormData({ ...formData, autoReplyDelay: e.target.value })}
                />
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingAgent ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
