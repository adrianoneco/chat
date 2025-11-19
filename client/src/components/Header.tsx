import { MessageSquare, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { user } = useAuth();

  const getUserInitials = () => {
    if (!user) return "U";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U";
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      client: "Cliente",
      attendant: "Atendente",
      admin: "Administrador",
    };
    return labels[role as keyof typeof labels] || role;
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 h-16 z-50 bg-gradient-to-b from-gradient-blue to-gradient-purple"
      style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      data-testid="header-main"
    >
      <div className="h-full px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">ChatApp</h1>
            <p className="text-xs text-white/80">Sistema de Atendimento</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <>
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-white" data-testid="text-user-name">
                  {user.firstName} {user.lastName}
                </span>
                <span className="text-xs text-white/80" data-testid="text-user-role">
                  {getRoleLabel(user.role)}
                </span>
              </div>
              <Avatar className="w-10 h-10 border-2 border-white/20">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                <AvatarFallback className="bg-white/20 text-white font-semibold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => (window.location.href = "/api/logout")}
                className="text-white hover:bg-white/20 hover-elevate active-elevate-2"
                data-testid="button-logout"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
