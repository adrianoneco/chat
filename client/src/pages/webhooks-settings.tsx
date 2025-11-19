import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Send, Copy, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Webhook, webhookEventCategories } from "@shared/schema";

interface WebhookHeader {
  key: string;
  value: string;
}

export default function WebhooksSettings() {
  const { toast } = useToast();
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    url: import.meta.env.VITE_DEFAULT_WEBHOOK_URL || "",
    authType: "none" as "none" | "bearer" | "jwt",
    apiToken: "",
    jwtToken: "",
    headers: [] as WebhookHeader[],
    events: [] as string[],
    isActive: "true",
  });
  const [testResponse, setTestResponse] = useState<any>(null);

  const { data: webhooks = [], isLoading } = useQuery<Webhook[]>({
    queryKey: ["/api/webhooks"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/webhooks", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({ title: "Webhook criado com sucesso!" });
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao criar webhook", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/webhooks/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({ title: "Webhook atualizado com sucesso!" });
      setSelectedWebhook(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar webhook", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/webhooks/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({ title: "Webhook deletado com sucesso!" });
      setSelectedWebhook(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao deletar webhook", variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/webhooks/${id}/test`, "POST"),
    onSuccess: (data: any) => {
      setTestResponse(data);
      toast({
        title: data.success ? "Teste realizado com sucesso!" : "Teste falhou",
        description: `Status: ${data.status}`,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: () => {
      toast({ title: "Erro ao testar webhook", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      url: import.meta.env.VITE_DEFAULT_WEBHOOK_URL || "",
      authType: "none",
      apiToken: "",
      jwtToken: "",
      headers: [],
      events: [],
      isActive: "true",
    });
    setIsCreating(false);
    setTestResponse(null);
  };

  const editWebhook = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      authType: webhook.authType,
      apiToken: webhook.apiToken || "",
      jwtToken: webhook.jwtToken || "",
      headers: Object.entries(webhook.headers || {}).map(([key, value]) => ({ key, value })),
      events: webhook.events || [],
      isActive: webhook.isActive,
    });
    setIsCreating(false);
    setTestResponse(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const headers = formData.headers.reduce((acc, h) => {
      if (h.key && h.value) acc[h.key] = h.value;
      return acc;
    }, {} as Record<string, string>);

    const data = {
      name: formData.name,
      url: formData.url,
      authType: formData.authType,
      apiToken: formData.authType === "bearer" ? formData.apiToken : null,
      jwtToken: formData.authType === "jwt" ? formData.jwtToken : null,
      headers,
      events: formData.events,
      isActive: formData.isActive,
    };

    if (selectedWebhook) {
      updateMutation.mutate({ id: selectedWebhook.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const generateToken = (type: "api" | "jwt") => {
    if (type === "api") {
      const uuid = crypto.randomUUID().toUpperCase();
      setFormData({ ...formData, apiToken: uuid });
      toast({ title: "Token API gerado!" });
    } else {
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const payload = btoa(JSON.stringify({ sub: formData.name || "webhook", iat: Date.now() }));
      const signature = btoa(crypto.randomUUID());
      const jwt = `${header}.${payload}.${signature}`;
      setFormData({ ...formData, jwtToken: jwt });
      toast({ title: "JWT Token gerado!" });
    }
  };

  const toggleEvent = (event: string) => {
    const events = formData.events.includes(event)
      ? formData.events.filter((e) => e !== event)
      : [...formData.events, event];
    setFormData({ ...formData, events });
  };

  const toggleCategory = (category: readonly string[]) => {
    const allSelected = category.every((e) => formData.events.includes(e));
    const eventsSet = new Set([...formData.events, ...category]);
    const events = allSelected
      ? formData.events.filter((e) => !category.includes(e))
      : Array.from(eventsSet);
    setFormData({ ...formData, events });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhooks</h1>
        <p className="text-muted-foreground">
          Configure webhooks para receber notificações de eventos do sistema
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Webhook List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Webhooks</span>
              <Button
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsCreating(true);
                  setSelectedWebhook(null);
                }}
                data-testid="button-new-webhook"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className={`p-3 rounded-md border cursor-pointer hover-elevate ${
                  selectedWebhook?.id === webhook.id ? "bg-accent" : ""
                }`}
                onClick={() => editWebhook(webhook)}
                data-testid={`webhook-item-${webhook.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{webhook.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{webhook.url}</p>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {webhook.events?.length || 0} eventos
                      </Badge>
                      {webhook.isActive === "true" && (
                        <Badge variant="default" className="text-xs">
                          Ativo
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!isLoading && webhooks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum webhook configurado
              </p>
            )}
          </CardContent>
        </Card>

        {/* Webhook Form */}
        {(isCreating || selectedWebhook) && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{selectedWebhook ? "Editar Webhook" : "Novo Webhook"}</CardTitle>
              <CardDescription>
                Configure a URL, autenticação, headers e eventos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Nome e URL */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Meu Webhook"
                      required
                      data-testid="input-webhook-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://exemplo.com/webhook"
                      required
                      data-testid="input-webhook-url"
                    />
                  </div>
                </div>

                <Separator />

                {/* Auth */}
                <div className="space-y-4">
                  <Label>Autenticação</Label>
                  <Select
                    value={formData.authType}
                    onValueChange={(value: any) => setFormData({ ...formData, authType: value })}
                  >
                    <SelectTrigger data-testid="select-auth-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="bearer">Bearer Token (API)</SelectItem>
                      <SelectItem value="jwt">JWT Token</SelectItem>
                    </SelectContent>
                  </Select>

                  {formData.authType === "bearer" && (
                    <div className="space-y-2">
                      <Label htmlFor="apiToken">API Token</Label>
                      <div className="flex gap-2">
                        <Input
                          id="apiToken"
                          value={formData.apiToken}
                          onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                          placeholder="UUID Uppercase"
                          data-testid="input-api-token"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => generateToken("api")}
                          data-testid="button-generate-api-token"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {formData.authType === "jwt" && (
                    <div className="space-y-2">
                      <Label htmlFor="jwtToken">JWT Token</Label>
                      <div className="flex gap-2">
                        <Input
                          id="jwtToken"
                          value={formData.jwtToken}
                          onChange={(e) => setFormData({ ...formData, jwtToken: e.target.value })}
                          placeholder="eyJhbGc..."
                          data-testid="input-jwt-token"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => generateToken("jwt")}
                          data-testid="button-generate-jwt-token"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Headers */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Headers Customizados</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          headers: [...formData.headers, { key: "", value: "" }],
                        })
                      }
                      data-testid="button-add-header"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  {formData.headers.map((header, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Chave"
                        value={header.key}
                        onChange={(e) => {
                          const newHeaders = [...formData.headers];
                          newHeaders[index].key = e.target.value;
                          setFormData({ ...formData, headers: newHeaders });
                        }}
                        data-testid={`input-header-key-${index}`}
                      />
                      <Input
                        placeholder="Valor"
                        value={header.value}
                        onChange={(e) => {
                          const newHeaders = [...formData.headers];
                          newHeaders[index].value = e.target.value;
                          setFormData({ ...formData, headers: newHeaders });
                        }}
                        data-testid={`input-header-value-${index}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            headers: formData.headers.filter((_, i) => i !== index),
                          })
                        }
                        data-testid={`button-remove-header-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Events */}
                <div className="space-y-4">
                  <Label>Eventos</Label>
                  {Object.entries(webhookEventCategories).map(([category, events]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`category-${category}`}
                          checked={events.every((e) => formData.events.includes(e))}
                          onCheckedChange={() => toggleCategory(events)}
                          data-testid={`checkbox-category-${category}`}
                        />
                        <Label
                          htmlFor={`category-${category}`}
                          className="font-semibold capitalize cursor-pointer"
                        >
                          {category}
                        </Label>
                      </div>
                      <div className="ml-6 space-y-2">
                        {events.map((event) => (
                          <div key={event} className="flex items-center gap-2">
                            <Checkbox
                              id={event}
                              checked={formData.events.includes(event)}
                              onCheckedChange={() => toggleEvent(event)}
                              data-testid={`checkbox-event-${event}`}
                            />
                            <Label htmlFor={event} className="text-sm cursor-pointer">
                              {event}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex gap-2 justify-between">
                  <div className="flex gap-2">
                    <Button type="submit" data-testid="button-save-webhook">
                      {selectedWebhook ? "Atualizar" : "Criar"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={resetForm} data-testid="button-cancel">
                      Cancelar
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    {selectedWebhook && (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => testMutation.mutate(selectedWebhook.id)}
                          disabled={testMutation.isPending}
                          data-testid="button-test-webhook"
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Testar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja deletar este webhook?")) {
                              deleteMutation.mutate(selectedWebhook.id);
                            }
                          }}
                          data-testid="button-delete-webhook"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Test Response */}
                {testResponse && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Resposta do Teste</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm">
                          <strong>Status:</strong> {testResponse.status} {testResponse.statusText}
                        </p>
                        <div className="space-y-1">
                          <strong className="text-sm">Payload Enviado:</strong>
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                            {JSON.stringify(
                              {
                                event: "test.webhook",
                                data: {
                                  applicationName: "ChatApp",
                                  version: "1.0.0",
                                  test: true,
                                },
                              },
                              null,
                              2
                            )}
                          </pre>
                        </div>
                        <div className="space-y-1">
                          <strong className="text-sm">Resposta:</strong>
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                            {JSON.stringify(testResponse.data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
