import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import { Shield, Users, UserPlus, Trash2, UserCheck, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@shared/schema";

interface Stats {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
  stuntingCount: number;
  wastingCount: number;
  underweightCount: number;
}

function RoleBadge({ role }: { role: string }) {
  const variants: Record<string, string> = {
    admin: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    health: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    doctor: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    user: "bg-gray-50 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800",
  };
  const labels: Record<string, string> = {
    admin: "مدير النظام",
    health: "عامل صحي",
    doctor: "طبيب",
    user: "مستخدم",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants[role] || variants.user}`}>
      {labels[role] || role}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, colorClass }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user, logout, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/predictions/stats"],
  });

  const { data: users, isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ["auth", "users"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/auth/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "users"] });
    },
  });

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <Lock className="w-4 h-4" />
          <AlertDescription>
            عذراً، لا تملك صلاحية الوصول إلى هذه الصفحة. هذه الصفحة مخصصة للمدير فقط.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">لوحة تحكم المدير</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            إدارة المستخدمين والصلاحيات وبيانات النظام
          </p>
        </div>
        <Button variant="outline" onClick={logout} className="gap-2">
          <Lock className="w-4 h-4" /> تسجيل خروج
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="إجمالي المستخدمين" value={users?.length ?? 0} colorClass="bg-primary/10 text-primary" />
        <StatCard icon={Shield} label="الحالات الحرجة" value={stats?.critical ?? 0} colorClass="bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400" />
        <StatCard icon={UserCheck} label="إجمالي التقييمات" value={stats?.total ?? 0} colorClass="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" />
        <StatCard icon={UserPlus} label="عامل صحي" value={users?.filter(u => u.role === "health").length ?? 0} colorClass="bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" />
      </div>

      {usersError && (
        <Alert variant="destructive">
          <AlertDescription>فشل تحميل قائمة المستخدمين. تأكد من وجود API /api/auth/users في الباك اند.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            إدارة المستخدمين
          </CardTitle>
          <CardDescription>قائمة جميع المستخدمين والصلاحيات الممنوحة</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">المستخدم</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">اسم المستخدم</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">الصلاحية</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-5 py-3"><Skeleton className="h-8 w-8 rounded-full" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-5 w-20" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-8 w-20" /></td>
                    </tr>
                  ))
                ) : users && users.length > 0 ? (
                  users.map(u => (
                    <tr key={u.id} className="border-b border-border/50 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground text-sm">{u.username}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground font-mono text-xs">{u.username}</td>
                      <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-3 py-3">
                        {u.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف المستخدم ${u.username}؟`)) {
                                deleteMutation.mutate(u.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      لا توجد مستخدمين. يجب إضافة المستخدمين عبر الباك اند.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            معلومات الصلاحيات
          </CardTitle>
          <CardDescription>شرح الأدوار المتاحة في النظام</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Badge className="bg-purple-500">مدير</Badge>
            <span className="text-sm text-muted-foreground">صلاحيات كاملة: إدارة المستخدمين، تعديل الصلاحيات، الوصول لجميع البيانات</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Badge className="bg-blue-500">عامل صحي</Badge>
            <span className="text-sm text-muted-foreground">إدخال بيانات الأطفال، تشغيل التنبؤات، عرض النتائج والتاريخ</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Badge className="bg-cyan-500">طبيب</Badge>
            <span className="text-sm text-muted-foreground">عرض جميع التنبؤات، تحليل البيانات، تقارير متقدمة</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">إضافة مستخدم جديد</CardTitle>
          <CardDescription>أضف مستخدمين جدد عبر واجهة الباك اند أو الـ API</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            لإضافة مستخدم جديد، استخدم الـ API endpoint: <code className="font-mono bg-background px-2 py-0.5 rounded border">POST /api/auth/users</code>
            مع بيانات: <code className="font-mono text-xs">{"{ username, password, role }"}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
