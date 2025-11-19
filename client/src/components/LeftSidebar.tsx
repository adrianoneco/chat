import { MessageSquare, Settings, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LeftSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function LeftSidebar({ collapsed, onToggleCollapse }: LeftSidebarProps) {
  const menuItems = [
    { icon: MessageSquare, label: "Conversas", active: true },
    { icon: Users, label: "Usuários", active: false },
    { icon: Settings, label: "Configurações", active: false },
  ];

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 bottom-0 bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out z-40",
        collapsed ? "w-16" : "w-64"
      )}
      data-testid="sidebar-left"
    >
      <div className="flex flex-col h-full">
        <nav className="flex-1 p-2">
          <div className="flex flex-col gap-1">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              const button = (
                <Button
                  key={index}
                  variant={item.active ? "secondary" : "ghost"}
                  className={cn(
                    "justify-start gap-3 h-12",
                    collapsed ? "justify-center px-0" : "px-4",
                    item.active && "bg-sidebar-accent"
                  )}
                  data-testid={`button-menu-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Button>
              );

              if (collapsed) {
                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return button;
            })}
          </div>
        </nav>

        <div className="relative h-16">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border shadow-md hover-elevate active-elevate-2 z-50"
            data-testid="button-toggle-left-sidebar"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
