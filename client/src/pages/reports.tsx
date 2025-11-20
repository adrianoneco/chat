import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  FileBarChart, 
  Download, 
  Mail, 
  Users,
  MessageSquare,
  Megaphone,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserCog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { ConversationWithUsers, CampaignWithCreator, User, EmailReport } from "@shared/schema";
import { emailReportSchema } from "@shared/schema";

type ReportType = "conversations" | "campaigns" | "attendants" | "general";

export default function Reports() {
  const { toast } = useToast();
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportType>("general");

  const form = useForm<EmailReport>({
    resolver: zodResolver(emailReportSchema),
    defaultValues: {
      recipientName: "",
      recipientEmail: "",
      subject: "",
      message: "",
    },
  });

  // Fetch data for reports with proper typing
  const { data: conversations = [] } = useQuery<ConversationWithUsers[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: campaigns = [] } = useQuery<CampaignWithCreator[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Calculate statistics
  const stats = {
    conversations: {
      total: conversations.length,
      pending: conversations.filter(c => c.status === "pending").length,
      attending: conversations.filter(c => c.status === "attending").length,
      closed: conversations.filter(c => c.status === "closed").length,
    },
    campaigns: {
      total: campaigns.length,
      active: campaigns.filter(c => c.status === "active").length,
      completed: campaigns.filter(c => c.status === "completed").length,
      draft: campaigns.filter(c => c.status === "draft").length,
      totalSent: campaigns.reduce((acc, c) => acc + parseInt(c.sentCount || "0"), 0),
      totalDelivered: campaigns.reduce((acc, c) => acc + parseInt(c.deliveredCount || "0"), 0),
    },
    attendants: users.filter(u => u.role === "attendant").map(attendant => ({
      ...attendant,
      activeConversations: conversations.filter(c => c.attendantId === attendant.id && c.status === "attending").length,
      closedConversations: conversations.filter(c => c.attendantId === attendant.id && c.status === "closed").length,
      totalConversations: conversations.filter(c => c.attendantId === attendant.id).length,
    })),
  };

  const handleGenerateReport = (type: ReportType) => {
    const subjects = {
      conversations: "Relatório de Conversas",
      campaigns: "Relatório de Campanhas",
      attendants: "Relatório de Atendentes",
      general: "Relatório Geral do Sistema",
    };

    setSelectedReportType(type);
    form.reset({
      recipientName: "",
      recipientEmail: "",
      subject: subjects[type],
      message: `Prezado(a),\n\nSegue em anexo o ${subjects[type].toLowerCase()} referente ao período atual.\n\nAtenciosamente,\nEquipe de Suporte`,
    });
    setIsEmailDialogOpen(true);
  };

  const generateReportData = (type: ReportType): string => {
    let reportData = "";
    const date = format(new Date(), "dd/MM/yyyy HH:mm");
    
    switch (type) {
      case "conversations":
        reportData = `Relatório de Conversas - ${date}\n\n`;
        reportData += `Total: ${stats.conversations.total}\n`;
        reportData += `Pendentes: ${stats.conversations.pending}\n`;
        reportData += `Em Atendimento: ${stats.conversations.attending}\n`;
        reportData += `Fechadas: ${stats.conversations.closed}\n`;
        break;
      case "campaigns":
        reportData = `Relatório de Campanhas - ${date}\n\n`;
        reportData += `Total: ${stats.campaigns.total}\n`;
        reportData += `Ativas: ${stats.campaigns.active}\n`;
        reportData += `Concluídas: ${stats.campaigns.completed}\n`;
        reportData += `Total Enviadas: ${stats.campaigns.totalSent}\n`;
        reportData += `Total Entregues: ${stats.campaigns.totalDelivered}\n`;
        break;
      case "attendants":
        reportData = `Relatório de Atendentes - ${date}\n\n`;
        stats.attendants.forEach(att => {
          reportData += `${att.firstName} ${att.lastName}:\n`;
          reportData += `  Conversas Ativas: ${att.activeConversations}\n`;
          reportData += `  Conversas Fechadas: ${att.closedConversations}\n`;
          reportData += `  Total: ${att.totalConversations}\n\n`;
        });
        break;
      default:
        reportData = `Relatório Geral - ${date}\n\n`;
        reportData += `CONVERSAS:\n`;
        reportData += `  Total: ${stats.conversations.total}\n`;
        reportData += `  Pendentes: ${stats.conversations.pending}\n`;
        reportData += `  Em Atendimento: ${stats.conversations.attending}\n`;
        reportData += `  Fechadas: ${stats.conversations.closed}\n\n`;
        reportData += `CAMPANHAS:\n`;
        reportData += `  Total: ${stats.campaigns.total}\n`;
        reportData += `  Ativas: ${stats.campaigns.active}\n`;
        reportData += `  Concluídas: ${stats.campaigns.completed}\n\n`;
        reportData += `ATENDENTES:\n`;
        reportData += `  Total: ${stats.attendants.length}\n`;
    }
    
    return reportData;
  };

  const onSubmit = async (data: EmailReport) => {
    try {
      const reportData = generateReportData(selectedReportType);
      
      const response = await fetch('/api/reports/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientEmail: data.recipientEmail,
          recipientName: data.recipientName,
          subject: data.subject,
          message: data.message,
          reportData,
        }),
      });

      if (!response.ok) throw new Error('Erro ao enviar email');

      toast({
        title: "Relatório enviado!",
        description: `Relatório enviado para ${data.recipientEmail}`,
      });
      setIsEmailDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar o relatório por email.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadReport = (type: ReportType) => {
    // Generate CSV or PDF report
    let reportData = "";
    const date = format(new Date(), "yyyy-MM-dd_HHmm");
    
    switch (type) {
      case "conversations":
        reportData = `Relatório de Conversas - ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;
        reportData += `Total: ${stats.conversations.total}\n`;
        reportData += `Pendentes: ${stats.conversations.pending}\n`;
        reportData += `Em Atendimento: ${stats.conversations.attending}\n`;
        reportData += `Fechadas: ${stats.conversations.closed}\n`;
        break;
      case "campaigns":
        reportData = `Relatório de Campanhas - ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;
        reportData += `Total: ${stats.campaigns.total}\n`;
        reportData += `Ativas: ${stats.campaigns.active}\n`;
        reportData += `Concluídas: ${stats.campaigns.completed}\n`;
        reportData += `Total Enviadas: ${stats.campaigns.totalSent}\n`;
        reportData += `Total Entregues: ${stats.campaigns.totalDelivered}\n`;
        break;
      case "attendants":
        reportData = `Relatório de Atendentes - ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;
        stats.attendants.forEach(att => {
          reportData += `${att.firstName} ${att.lastName}:\n`;
          reportData += `  Conversas Ativas: ${att.activeConversations}\n`;
          reportData += `  Conversas Fechadas: ${att.closedConversations}\n`;
          reportData += `  Total: ${att.totalConversations}\n\n`;
        });
        break;
      default:
        reportData = `Relatório Geral - ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;
        reportData += `CONVERSAS:\n`;
        reportData += `  Total: ${stats.conversations.total}\n`;
        reportData += `  Pendentes: ${stats.conversations.pending}\n`;
        reportData += `  Em Atendimento: ${stats.conversations.attending}\n`;
        reportData += `  Fechadas: ${stats.conversations.closed}\n\n`;
        reportData += `CAMPANHAS:\n`;
        reportData += `  Total: ${stats.campaigns.total}\n`;
        reportData += `  Ativas: ${stats.campaigns.active}\n`;
        reportData += `  Concluídas: ${stats.campaigns.completed}\n\n`;
        reportData += `ATENDENTES:\n`;
        reportData += `  Total: ${stats.attendants.length}\n`;
    }

    const blob = new Blob([reportData], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${type}_${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Relatório baixado!",
      description: "O arquivo foi salvo em seus downloads.",
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-card p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
              <FileBarChart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="heading-reports">Relatórios</h1>
              <p className="text-sm text-muted-foreground">
                Visualize e exporte relatórios profissionais
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview" data-testid="tab-overview">
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="conversations" data-testid="tab-conversations">
              Conversas
            </TabsTrigger>
            <TabsTrigger value="campaigns" data-testid="tab-campaigns">
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="attendants" data-testid="tab-attendants">
              Atendentes
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total de Conversas
                  </CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-conversations">{stats.conversations.total}</div>
                  <p className="text-xs text-muted-foreground" data-testid="stat-pending-conversations">
                    {stats.conversations.pending} pendentes
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total de Campanhas
                  </CardTitle>
                  <Megaphone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-campaigns">{stats.campaigns.total}</div>
                  <p className="text-xs text-muted-foreground" data-testid="stat-active-campaigns">
                    {stats.campaigns.active} ativas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total de Atendentes
                  </CardTitle>
                  <UserCog className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-attendants">{stats.attendants.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Profissionais ativos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Taxa de Entrega
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-delivery-rate">
                    {stats.campaigns.totalSent > 0
                      ? Math.round((stats.campaigns.totalDelivered / stats.campaigns.totalSent) * 100)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mensagens entregues
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Relatório Geral</CardTitle>
                  <CardDescription>
                    Baixe ou envie o relatório completo do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => handleDownloadReport("general")}
                    className="gap-2"
                    data-testid="button-download-general"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Relatório
                  </Button>
                  <Button
                    onClick={() => handleGenerateReport("general")}
                    variant="outline"
                    className="gap-2"
                    data-testid="button-email-general"
                  >
                    <Mail className="w-4 h-4" />
                    Enviar por Email
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estatísticas Rápidas</CardTitle>
                  <CardDescription>
                    Resumo de atividades do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Em Atendimento</span>
                    <Badge variant="default" data-testid="badge-attending">{stats.conversations.attending}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Campanhas Ativas</span>
                    <Badge variant="default" data-testid="badge-campaigns-active">{stats.campaigns.active}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Conversas Fechadas</span>
                    <Badge variant="secondary" data-testid="badge-closed">{stats.conversations.closed}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="hover-elevate transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600" data-testid="card-conversations-pending">
                    {stats.conversations.pending}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600" data-testid="card-conversations-attending">
                    {stats.conversations.attending}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fechadas</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600" data-testid="card-conversations-closed">
                    {stats.conversations.closed}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Exportar Relatório de Conversas</CardTitle>
                <CardDescription>
                  Gere relatórios detalhados sobre as conversas
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => handleDownloadReport("conversations")}
                  className="gap-2"
                  data-testid="button-download-conversations"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </Button>
                <Button
                  onClick={() => handleGenerateReport("conversations")}
                  variant="outline"
                  className="gap-2"
                  data-testid="button-email-conversations"
                >
                  <Mail className="w-4 h-4" />
                  Enviar por Email
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="card-campaigns-total">{stats.campaigns.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ativas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="card-campaigns-active">{stats.campaigns.active}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="card-campaigns-sent">{stats.campaigns.totalSent}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Entregues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600" data-testid="card-campaigns-delivered">
                    {stats.campaigns.totalDelivered}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Exportar Relatório de Campanhas</CardTitle>
                <CardDescription>
                  Gere relatórios sobre o desempenho das campanhas
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => handleDownloadReport("campaigns")}
                  className="gap-2"
                  data-testid="button-download-campaigns"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </Button>
                <Button
                  onClick={() => handleGenerateReport("campaigns")}
                  variant="outline"
                  className="gap-2"
                  data-testid="button-email-campaigns"
                >
                  <Mail className="w-4 h-4" />
                  Enviar por Email
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendants Tab */}
          <TabsContent value="attendants" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {stats.attendants.map((attendant) => (
                <Card key={attendant.id} className="hover-elevate transition-shadow" data-testid={`card-attendant-${attendant.id}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {attendant.firstName[0]}{attendant.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate" data-testid={`text-attendant-name-${attendant.id}`}>
                          {attendant.firstName} {attendant.lastName}
                        </CardTitle>
                        <CardDescription className="truncate" data-testid={`text-attendant-email-${attendant.id}`}>{attendant.email}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Ativas</span>
                      <Badge variant="default" data-testid={`badge-attendant-active-${attendant.id}`}>{attendant.activeConversations}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Fechadas</span>
                      <Badge variant="secondary" data-testid={`badge-attendant-closed-${attendant.id}`}>{attendant.closedConversations}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <Badge variant="outline" data-testid={`badge-attendant-total-${attendant.id}`}>{attendant.totalConversations}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {stats.attendants.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Users className="w-16 h-16 text-muted-foreground" />
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-1">Nenhum atendente encontrado</h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione atendentes para visualizar relatórios
                  </p>
                </div>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Exportar Relatório de Atendentes</CardTitle>
                <CardDescription>
                  Gere relatórios sobre a produtividade dos atendentes
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => handleDownloadReport("attendants")}
                  className="gap-2"
                  data-testid="button-download-attendants"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </Button>
                <Button
                  onClick={() => handleGenerateReport("attendants")}
                  variant="outline"
                  className="gap-2"
                  data-testid="button-email-attendants"
                >
                  <Mail className="w-4 h-4" />
                  Enviar por Email
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Email Dialog with Form */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Enviar Relatório por Email</DialogTitle>
            <DialogDescription>
              Preencha os dados do destinatário para enviar o relatório profissional
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="recipientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Destinatário *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: João Silva"
                        {...field}
                        data-testid="input-recipient-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recipientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email do Destinatário *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Ex: joao@empresa.com"
                        {...field}
                        data-testid="input-recipient-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assunto *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-subject"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem *</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={6}
                        {...field}
                        data-testid="textarea-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEmailDialogOpen(false)}
                  data-testid="button-cancel-email"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  data-testid="button-send-email"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar Relatório
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
