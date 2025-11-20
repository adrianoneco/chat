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
import { Plus, Pencil, Trash2, MessageSquareText, Sparkles, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReadyMessage } from "@shared/schema";

const AVAILABLE_PARAMETERS = [
  { key: "{{clientFirstName}}", label: "Nome do cliente" },
  { key: "{{clientLastName}}", label: "Sobrenome do cliente" },
  { key: "{{clientFullName}}", label: "Nome completo do cliente" },
  { key: "{{attendantFirstName}}", label: "Nome do atendente" },
  { key: "{{attendantLastName}}", label: "Sobrenome do atendente" },
  { key: "{{attendantFullName}}", label: "Nome completo do atendente" },
  { key: "{{protocolNumber}}", label: "Número do protocolo" },
  { key: "{{currentDate}}", label: "Data atual" },
  { key: "{{currentTime}}", label: "Hora atual" },
];

export default function ReadyMessagesSettings() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ReadyMessage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    shortcuts: [] as string[],
  });

  const { data: messages = [], isLoading } = useQuery<ReadyMessage[]>({
    queryKey: ["/api/ready-messages"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/ready-messages", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ready-messages"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Mensagem pronta criada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar mensagem pronta", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      apiRequest("PATCH", `/api/ready-messages/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ready-messages"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Mensagem pronta atualizada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar mensagem pronta", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/ready-messages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ready-messages"] });
      toast({ title: "Mensagem pronta deletada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao deletar mensagem pronta", variant: "destructive" });
    },
  });

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: "Digite uma descrição para gerar a mensagem", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/groq/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      if (!response.ok) throw new Error("Erro ao gerar mensagem");

      const data = await response.json();
      setFormData({ ...formData, content: data.message });
      setAiPrompt("");
      toast({ title: "Mensagem gerada com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao gerar mensagem com IA", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      shortcuts: [],
    });
    setEditingMessage(null);
    setAiPrompt("");
  };

  const handleOpenDialog = (message?: ReadyMessage) => {
    if (message) {
      setEditingMessage(message);
      setFormData({
        title: message.title,
        content: message.content,
        shortcuts: message.shortcuts || [],
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMessage) {
      updateMutation.mutate({ id: editingMessage.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const insertParameter = (param: string) => {
    const textarea = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.content;
      const newContent = text.substring(0, start) + param + text.substring(end);
      setFormData({ ...formData, content: newContent });
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + param.length, start + param.length);
      }, 0);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
            <MessageSquareText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Mensagens Prontas</h1>
            <p className="text-muted-foreground">Crie templates de mensagens com parâmetros dinâmicos</p>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Mensagem
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquareText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">Nenhuma mensagem pronta cadastrada</p>
            <p className="text-muted-foreground mb-4">
              Crie mensagens prontas para agilizar seu atendimento
            </p>
            <Button onClick={() => handleOpenDialog()}>
              Criar Mensagem
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {messages.map((message) => (
            <Card key={message.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{message.title}</CardTitle>
                {message.shortcuts && message.shortcuts.length > 0 && (
                  <CardDescription className="flex gap-1 flex-wrap">
                    {message.shortcuts.map((shortcut, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        /{shortcut}
                      </Badge>
                    ))}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-3">{message.content}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(message)}
                    className="flex-1"
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja deletar esta mensagem?")) {
                        deleteMutation.mutate(message.id);
                      }
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMessage ? "Editar Mensagem Pronta" : "Nova Mensagem Pronta"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="Ex: Boas-vindas"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gerar com IA</Label>
                  <div className="flex gap-2">
                    <Input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Ex: Crie uma mensagem de boas-vindas profissional"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          generateWithAI();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={generateWithAI}
                      disabled={isGenerating}
                      className="gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isGenerating ? "Gerando..." : "Gerar"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Conteúdo da Mensagem</Label>
                  <Textarea
                    id="content"
                    name="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    required
                    placeholder="Digite a mensagem ou use os parâmetros ao lado..."
                    className="min-h-[200px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shortcuts">Atalhos (opcional)</Label>
                  <Input
                    id="shortcuts"
                    value={formData.shortcuts.join(", ")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shortcuts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Ex: ola, bemvindo (separados por vírgula)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Atalhos permitem usar /ola para inserir esta mensagem rapidamente
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Parâmetros Disponíveis</Label>
                <div className="border rounded-lg p-3 space-y-1 max-h-[400px] overflow-y-auto">
                  {AVAILABLE_PARAMETERS.map((param) => (
                    <Button
                      key={param.key}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs h-auto py-2"
                      onClick={() => insertParameter(param.key)}
                    >
                      <Copy className="w-3 h-3 mr-2 flex-shrink-0" />
                      <div className="flex flex-col items-start flex-1 min-w-0">
                        <code className="text-xs font-mono truncate w-full">{param.key}</code>
                        <span className="text-xs text-muted-foreground truncate w-full">
                          {param.label}
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Clique para inserir no cursor
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingMessage ? "Salvar Alterações" : "Criar Mensagem"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
