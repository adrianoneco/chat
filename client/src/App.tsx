import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { WebSocketProvider } from "@/hooks/useWebSocket";
import { AppLayout } from "@/components/AppLayout";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Home from "@/pages/home";
import Attendants from "@/pages/attendants";
import Contacts from "@/pages/contacts";
import Campaigns from "@/pages/campaigns";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function ProtectedRoutes() {
  return (
    <WebSocketProvider>
      <AppLayout>
        <Switch>
          <Route path="/conversations" component={Home} />
          <Route path="/conversations/:id" component={Home} />
          <Route path="/attendants" component={Attendants} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/campaigns" component={Campaigns} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings/:rest*" component={Settings} />
          <Route path="/" component={Home} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </WebSocketProvider>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #581c87 100%)" }}>
        <div className="text-white text-xl">Carregando...</div>
      </div>
    );
  }

  const isFullyAuthenticated = isAuthenticated && !!user;

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      {isFullyAuthenticated ? (
        <Route component={ProtectedRoutes} />
      ) : (
        <>
          <Route path="/" component={Landing} />
          <Route component={Login} />
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
