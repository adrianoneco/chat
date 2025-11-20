import { useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { Settings as SettingsIcon, Webhook, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import WebhooksSettings from "./webhooks-settings";
import ChannelsSettings from "./channels-settings";

export default function Settings() {
  const [location] = useLocation();

  const settingsPages = [
    {
      title: "Webhooks",
      path: "/settings/webhooks",
      icon: Webhook,
    },
    {
      title: "Canais",
      path: "/settings/channels",
      icon: MessageCircle,
    },
  ];

  return (
    <div className="flex h-full">
      {/* Settings Sidebar */}
      <div className="w-64 border-r bg-muted/30 p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="w-5 h-5" />
          <h2 className="font-semibold text-lg">Configurações</h2>
        </div>
        <Separator />
        <nav className="flex flex-col gap-1 mt-4">
          {settingsPages.map((page) => {
            const Icon = page.icon;
            const isActive = location === page.path;
            return (
              <Link key={page.path} href={page.path}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                  data-testid={`button-settings-${page.title.toLowerCase()}`}
                >
                  <Icon className="w-4 h-4" />
                  {page.title}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto">
        <Switch>
          <Route path="/settings/webhooks" component={WebhooksSettings} />
          <Route path="/settings/channels" component={ChannelsSettings} />
          <Route>
            <div className="p-8 text-center text-muted-foreground">
              Selecione uma opção de configuração
            </div>
          </Route>
        </Switch>
      </div>
    </div>
  );
}
