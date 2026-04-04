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
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Activity, ClipboardList, Database, BookOpen, Brain, Users, UserCog, Settings, Stethoscope } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AppSidebar() {
  const { user, logout, isAdmin, isHealthWorker, isDoctor } = useAuth();
  const location = useLocation();

  // Determine which nav items to show based on role
  const getNavItems = () => {
    if (isAdmin) {
      return [
        { title: "لوحة التحكم", url: "/admin", icon: UserCog },
        { title: "إدارة المستخدمين", url: "/admin/users", icon: Users },
        { title: "إدارة البيانات", url: "/admin/data", icon: Database },
      ];
    }
    
    if (isHealthWorker || isDoctor) {
      return [
        { title: "لوحة التحكم", url: "/health-dashboard", icon: LayoutDashboard },
        { title: "التنبؤ بالتغذية", url: "/predict", icon: Brain },
        { title: "السجل الصحي", url: "/history", icon: ClipboardList },
      ];
    }

    return [];
  };

  const navItems = getNavItems();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <Brain className="w-4 h-4 text-sidebar-accent-foreground" />
          </div>
          <div>
            <div className="text-sm font-medium text-sidebar-foreground">
              مالنيوتريشن بريديكتور
            </div>
            <div className="text-xs text-muted-foreground">
              نظام تنبؤ سوء التغذية
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {user && navItems.length > 0 && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>القائمة الرئيسية</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {navItems.map((item) => {
                    const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          data-active={isActive}
                          className={`h-10 px-3 rounded-md transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground"}`}
                        >
                          <Link href={item.url}>
                            <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground"}`} />
                            <span className="flex-1 text-sm">{item.title}</span>
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

            {isHealthWorker || isDoctor ? (
              <SidebarGroup>
                <SidebarGroupLabel>الإضافات</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild className="h-10 px-3 rounded-md transition-colors text-sidebar-foreground">
                        <Link href="/docs">
                          <BookOpen className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                          <span className="flex-1 text-sm">التوثيق</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
          </>
        )}
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
