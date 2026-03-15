import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard";
import Predict from "@/pages/predict";
import History from "@/pages/history";
import DataExplorer from "@/pages/data-explorer";
import Documentation from "@/pages/documentation";
import NotFound from "@/pages/not-found";
import { Brain } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/predict" component={Predict} />
      <Route path="/history" component={History} />
      <Route path="/data" component={DataExplorer} />
      <Route path="/docs" component={Documentation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full bg-background">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <header className="flex items-center gap-3 px-4 h-14 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40 flex-shrink-0">
                <SidebarTrigger
                  data-testid="button-sidebar-toggle"
                  className="text-muted-foreground"
                />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Nizam</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">Child Malnutrition Prediction System</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-accent/10 border border-accent/20 rounded-md px-2.5 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span className="text-accent font-medium">Models Online</span>
                  </div>
                </div>
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
