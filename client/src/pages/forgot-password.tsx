import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Erro ao solicitar recuperação de senha");
      }

      setSubmitted(true);
      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para recuperar sua senha.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
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
          <CardTitle className="text-3xl font-bold">Recuperar Senha</CardTitle>
          <CardDescription className="text-white/80">
            {submitted
              ? "Enviamos um link de recuperação para seu email"
              : "Digite seu email para receber um link de recuperação"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button
                type="submit"
                className="w-full bg-white text-blue-900 hover:bg-white/90"
                disabled={isLoading}
              >
                {isLoading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="w-full flex items-center justify-center gap-2 text-sm text-white/80 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para login
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center p-6 bg-white/5 rounded-lg">
                <p className="text-white/90">
                  Se o email {email} estiver cadastrado, você receberá um link para redefinir sua senha.
                </p>
              </div>
              <Button
                onClick={() => setLocation("/login")}
                className="w-full bg-white text-blue-900 hover:bg-white/90"
              >
                Voltar para login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
