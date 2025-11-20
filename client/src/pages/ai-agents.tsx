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
import { Plus, Pencil, Trash2, Bot, Sparkles, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AiAgentWithCreator } from "@shared/schema";

const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
  { id: "llama-3.3-70b-specdec", name: "Llama 3.3 70B SpecDec" },
  { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B Versatile" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
  { id: "gemma2-9b-it", name: "Gemma 2 9B" },
];

export default function AiAgents() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AiAgentWithCreator | null>(null);
  const [newTrigger, setNewTrigger] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemInstructions: "",
    isActive: false,
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    temperature: "0.7",
    maxTokens: "2048",
    autoReplyEnabled: false,
    autoReplyDelay: "0",
    triggers: [] as string[],
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
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      temperature: "0.7",
      maxTokens: "2048",
      autoReplyEnabled: false,
      autoReplyDelay: "0",
      triggers: [],
    });
    setEditingAgent(null);
    setNewTrigger("");
  };

  const handleOpenDialog = (agent?: AiAgentWithCreator) => {
    if (agent) {
      setEditingAgent(agent);
      setFormData({
        name: agent.name,
        description: agent.description || "",
        systemInstructions: agent.systemInstructions,
        isActive: agent.isActive,
        provider: "groq",
        model: agent.model,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        autoReplyEnabled: agent.autoReplyEnabled,
        autoReplyDelay: agent.autoReplyDelay,
        triggers: agent.triggers || [],
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleAddTrigger = () => {
    if (newTrigger.trim()) {
      setFormData({
        ...formData,
        triggers: [...formData.triggers, newTrigger.trim()],
      });
      setNewTrigger("");
    }
  };

  const handleRemoveTrigger = (index: number) => {
    setFormData({
      ...formData,
      triggers: formData.triggers.filter((_, i) => i !== index),
    });
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
            <p className="text-muted-foreground">Automatize respostas com Groq AI</p>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
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
            <Button onClick={() => handleOpenDialog()}>
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
                    <Badge className="bg-green-500">Ativo</Badge>
                  )}
                </div>
                {agent.description && (
                  <CardDescription>{agent.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modelo:</span>
                    <span className="font-medium text-xs">
                      {GROQ_MODELS.find(m => m.id === agent.model)?.name || agent.model}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resposta automática:</span>
                    <span className="font-medium">{agent.autoReplyEnabled ? 'Sim' : 'Não'}</span>
                  </div>
                  {agent.triggers && agent.triggers.length > 0 && (
                    <div className="pt-2">
                      <span className="text-muted-foreground text-xs">Gatilhos:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.triggers.slice(0, 3).map((trigger, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {trigger}
                          </Badge>
                        ))}
                        {agent.triggers.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{agent.triggers.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleOpenDialog(agent)}
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-500" />
              {editingAgent ? "Editar Agente IA" : "Novo Agente IA"}
            </DialogTitle>
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

            <div className="space-y-2">
              <Label htmlFor="model">Modelo Groq</Label>
              <Select
                value={formData.model}
                onValueChange={(value) => setFormData({ ...formData, model: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROQ_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Gatilhos (Keywords)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Quando o usuário enviar estas frases, o agente será ativado.
                Ex: "falar com humano", "falar com atendente"
              </p>
              <div className="flex gap-2">
                <Input
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTrigger();
                    }
                  }}
                  placeholder="Ex: falar com humano"
                />
                <Button type="button" onClick={handleAddTrigger} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.triggers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.triggers.map((trigger, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {trigger}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemoveTrigger(index)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperatura (0-2)</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
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
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <Label htmlFor="autoReplyEnabled" className="cursor-pointer">Resposta Automática</Label>
              <Switch
                id="autoReplyEnabled"
                checked={formData.autoReplyEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, autoReplyEnabled: checked })}
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
