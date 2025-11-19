import { useState, useEffect } from "react";
import { Redirect } from "wouter";
import { Header } from "@/components/Header";
import { LeftSidebar } from "@/components/LeftSidebar";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Initialize from user preference only when user is loaded
  useEffect(() => {
    if (user?.sidebarCollapsed) {
      setSidebarCollapsed(user.sidebarCollapsed === 'true');
    }
  }, [user]);

  // Mutation to save sidebar preference - only when authenticated
  const saveSidebarMutation = useMutation({
    mutationFn: async (collapsed: boolean) => {
      return apiRequest("PATCH", "/api/preferences/sidebar", {
        collapsed: collapsed.toString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const handleToggleSidebar = () => {
    const newCollapsed = !sidebarCollapsed;
    setSidebarCollapsed(newCollapsed);
    if (isAuthenticated) {
      saveSidebarMutation.mutate(newCollapsed);
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <LeftSidebar collapsed={sidebarCollapsed} onToggleCollapse={handleToggleSidebar} />
      <main
        className="pt-16 transition-all duration-300 ease-in-out"
        style={{
          marginLeft: sidebarCollapsed ? "64px" : "256px",
        }}
      >
        {children}
      </main>
    </div>
  );
}
