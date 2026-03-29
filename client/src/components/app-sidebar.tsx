import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Activity,
  ClipboardList,
  Database,
  BookOpen,
  Brain,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    description: "Overview & stats",
  },
  {
    title: "Predict",
    url: "/predict",
    icon: Activity,
    badge: "AI",
    description: "Run a prediction",
  },
  {
    title: "History",
    url: "/history",
    icon: ClipboardList,
    description: "Prediction records",
  },
  {
    title: "Data Explorer",
    url: "/data",
    icon: Database,
    description: "Training dataset",
  },
  {
    title: "Documentation",
    url: "/docs",
    icon: BookOpen,
    description: "Guides & API",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold text-sidebar-foreground text-lg leading-tight tracking-tight">system</div>
            <div className="text-xs text-muted-foreground leading-tight">Malnutrition AI Platform</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={`h-10 px-3 rounded-md transition-colors ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground"
                      }`}
                    >
                      <Link href={item.url}>
                        <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`} />
                        <span className="flex-1 text-sm">{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="text-xs h-5 px-1.5">
                            {item.badge}
                          </Badge>
                        )}
                        {isActive && (
                          <ChevronRight className="w-3.5 h-3.5 text-sidebar-accent-foreground opacity-60" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
          <div>
            <div className="text-xs font-medium text-sidebar-foreground">XGBoost v2.0.3</div>
            <div className="text-xs text-muted-foreground">3 models active</div>
          </div>
          <Badge variant="outline" className="ml-auto text-xs">v1.0</Badge>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
