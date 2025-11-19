import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Erro ao fazer login");
      }

      toast({
        title: "Login realizado com sucesso!",
        description: "Redirecionando...",
      });

      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #4c1d95 0%, #581c87 100%)",
      }}
    >
      <Card className="w-full max-w-md bg-white/10 backdrop-blur-lg border-white/20 text-white">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-lg">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold">ChatApp</CardTitle>
          <CardDescription className="text-white/80">
            Entre com suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-white text-blue-900 hover:bg-white/90"
              disabled={isLoading}
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => setLocation("/forgot-password")}
                className="text-sm text-white/80 hover:text-white underline"
              >
                Esqueceu a senha?
              </button>
              <div className="text-sm text-white/80">
                Não tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => setLocation("/signup")}
                  className="text-white hover:underline font-semibold"
                >
                  Criar conta
                </button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
