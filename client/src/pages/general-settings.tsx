import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Database, Zap, Shield, Settings } from "lucide-react";

export default function GeneralSettings() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [envVars, setEnvVars] = useState({
    SMTP_HOST: "",
    SMTP_PORT: "",
    SMTP_USER: "",
    SMTP_PASS: "",
    GROQ_API_KEY: "",
    SESSION_SECRET: "",
  });

  const handleSave = () => {
    toast({
      title: "Atenção",
      description: "Configure estas variáveis na seção 'Secrets' do painel do Replit para que sejam aplicadas ao servidor.",
      variant: "destructive",
    });
    setIsEditing(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Configurações Gerais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral das configurações do sistema
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setIsEditing(!isEditing)}
        >
          <Settings className="w-4 h-4 mr-2" />
          {isEditing ? "Cancelar" : "Editar Variáveis"}
        </Button>
      </div>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variáveis de Ambiente</CardTitle>
            <CardDescription>
              Configure as variáveis de ambiente do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP_HOST</Label>
                <Input
                  id="smtp_host"
                  placeholder="smtp.exemplo.com"
                  value={envVars.SMTP_HOST}
                  onChange={(e) => setEnvVars({ ...envVars, SMTP_HOST: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_port">SMTP_PORT</Label>
                <Input
                  id="smtp_port"
                  placeholder="587"
                  value={envVars.SMTP_PORT}
                  onChange={(e) => setEnvVars({ ...envVars, SMTP_PORT: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_user">SMTP_USER</Label>
                <Input
                  id="smtp_user"
                  placeholder="seu@email.com"
                  value={envVars.SMTP_USER}
                  onChange={(e) => setEnvVars({ ...envVars, SMTP_USER: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_pass">SMTP_PASS</Label>
                <Input
                  id="smtp_pass"
                  type="password"
                  placeholder="••••••••"
                  value={envVars.SMTP_PASS}
                  onChange={(e) => setEnvVars({ ...envVars, SMTP_PASS: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="groq_api_key">GROQ_API_KEY</Label>
                <Input
                  id="groq_api_key"
                  type="password"
                  placeholder="gsk_..."
                  value={envVars.GROQ_API_KEY}
                  onChange={(e) => setEnvVars({ ...envVars, GROQ_API_KEY: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="session_secret">SESSION_SECRET</Label>
                <Input
                  id="session_secret"
                  type="password"
                  placeholder="••••••••"
                  value={envVars.SESSION_SECRET}
                  onChange={(e) => setEnvVars({ ...envVars, SESSION_SECRET: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                Salvar Configurações
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Nota: Para configurar variáveis de ambiente em produção, use a seção "Secrets" no painel do Replit. As variáveis configuradas aqui são apenas para referência e devem ser adicionadas manualmente nas configurações do Replit.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-base">Email (SMTP)</CardTitle>
            </div>
            <CardDescription>
              Configurações de envio de email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="secondary">
                Configurável
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure as variáveis SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS nas variáveis de ambiente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-green-500" />
              <CardTitle className="text-base">Banco de Dados</CardTitle>
            </div>
            <CardDescription>
              Conexão com PostgreSQL
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="default" className="bg-green-500">
                Conectado
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Usando PostgreSQL com Drizzle ORM
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-500" />
              <CardTitle className="text-base">IA (Groq)</CardTitle>
            </div>
            <CardDescription>
              Serviços de inteligência artificial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="default" className="bg-purple-500">
                Ativo
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Agentes IA e geração de mensagens disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              <CardTitle className="text-base">Segurança</CardTitle>
            </div>
            <CardDescription>
              Autenticação e proteção
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Sessões</span>
              <Badge variant="secondary">
                Ativas
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Sistema de autenticação com sessões seguras
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Sistema</CardTitle>
          <CardDescription>
            Detalhes técnicos da aplicação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Versão:</span>
              <span className="ml-2 font-mono">1.0.0</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ambiente:</span>
              <span className="ml-2 font-mono">
                {import.meta.env.MODE || 'development'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Frontend:</span>
              <span className="ml-2 font-mono">React + Vite</span>
            </div>
            <div>
              <span className="text-muted-foreground">Backend:</span>
              <span className="ml-2 font-mono">Express + WebSocket</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
