import { Users, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Logo";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <div
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0f0520 0%, #1a0b2e 25%, #2d1b4e 50%, #4c1d95 75%, #7c3aed 100%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="mb-8">
            <Logo size="large" />
          </div>

          <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-2xl mx-auto">
            Sistema completo de atendimento via chat com gestão de conversas e múltiplos usuários
          </p>

          <Button
            size="lg"
            onClick={() => (window.location.href = "/login")}
            className="bg-white text-primary hover:bg-white/90 text-lg px-8 py-6 h-auto shadow-xl"
            data-testid="button-login"
          >
            Entrar no Sistema
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
            {[
              {
                icon: Users,
                title: "Multi-usuário",
                description: "Suporte para clientes, atendentes e administradores",
              },
              {
                icon: Zap,
                title: "Rápido e Eficiente",
                description: "Interface moderna e responsiva para melhor experiência",
              },
              {
                icon: Shield,
                title: "Seguro",
                description: "Autenticação robusta e proteção de dados",
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="bg-white/10 backdrop-blur-lg border-white/20 text-white"
                >
                  <CardContent className="p-6 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-white/20 mb-4">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-white/80 text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
