import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Database, Zap, Shield } from "lucide-react";

export default function GeneralSettings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações Gerais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral das configurações do sistema
        </p>
      </div>

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
