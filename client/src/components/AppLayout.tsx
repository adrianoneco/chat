import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { LeftSidebar } from "@/components/LeftSidebar";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, isAuthenticated } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Initialize from user preference
  useEffect(() => {
    if (user?.sidebarCollapsed) {
      setSidebarCollapsed(user.sidebarCollapsed === 'true');
    }
  }, [user]);

  // Mutation to save sidebar preference
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
    // Only persist if authenticated
    if (isAuthenticated && user) {
      saveSidebarMutation.mutate(newCollapsed);
    }
  };

  // Don't show sidebar for clients
  const showSidebar = user?.role !== 'client';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {showSidebar && (
        <LeftSidebar collapsed={sidebarCollapsed} onToggleCollapse={handleToggleSidebar} />
      )}
      <main
        className="pt-16 transition-all duration-300 ease-in-out"
        style={{
          marginLeft: showSidebar ? (sidebarCollapsed ? "64px" : "256px") : "0",
        }}
      >
        {children}
      </main>
    </div>
  );
}
