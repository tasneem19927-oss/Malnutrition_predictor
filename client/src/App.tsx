import { Switch, Route, useLocation } from "wouter";
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
import AdminDashboard from "@/pages/admin-dashboard";
import HealthDashboard from "@/pages/health-dashboard";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, Loader2 } from "lucide-react";
import React from "react";

function Router() {
  const { isAdmin, isHealthWorker, isDoctor } = useAuth();
  
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Admin Protected Routes */}
      {isAdmin && (
        <Route path="/admin" component={AdminDashboard} />
      )}
      
      {/* Health Worker / Doctor Routes */}
      {(isHealthWorker || isDoctor || isAdmin) && (
        <>
          <Route path="/health" component={HealthDashboard} />
          <Route path="/predict" component={Predict} />
          <Route path="/history" component={History} />
        </>
      )}

      {/* Shared Protected Routes */}
      <Route path="/data" component={DataExplorer} />
      <Route path="/docs" component={Documentation} />
      
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/:rest*" component={Login} />
      </Switch>
    );
  }

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
                  <span className="text-sm font-medium text-foreground">system</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">Child Malnutrition Prediction System</span>
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
