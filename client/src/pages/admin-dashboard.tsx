import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import {
  Shield, Users, UserPlus, Trash2, UserCheck, Lock,
  BarChart3, FileText, Activity, AlertTriangle, MapPin, ClipboardList
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import type { User } from "@shared/schema";

interface AdminStats {
  total: number;
  critical: number;
  high: number;
  moderate: number;
  low: number;
  stuntingCount: number;
  wastingCount: number;
  underweightCount: number;
  byGovernorate: Record<string, number>;
  recentPredictions: Array<{
    id: string;
    childName: string;
    age: number;
    governorate: string;
    prediction: string;
    severity: string;
    date: string;
  }>;
}

interface PredictionHistoryItem {
  id: string;
  childName: string;
  age: number;
  gender: string;
  governorate: string;
  prediction: string;
  severity: string;
  date: string;
  source: "admin" | "health" | "user";
}

function RoleBadge({ role }: { role: string }) {
  const variants: Record<string, string> = {
    admin: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    health: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    doctor: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
    user: "bg-gray-50 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800",
  };
  return (
    <Badge variant="secondary" className={`${variants[role] || variants.user} border`}>{role}</Badge>
  );
}

function StatCard({ icon, label, value, colorClass }: {
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
            <icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
export function AdminDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Admin stats from Python API
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    retry: 3,
    staleTime: 5 * 60 * 1000,
  });

  // All predictions from Python API
  const { data: predictions, isLoading: predsLoading, error: predsError } = useQuery<PredictionHistoryItem[]>({
    queryKey: ["/api/admin/predictions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/predictions");
      if (!res.ok) throw new Error("Failed to fetch predictions");
      return res.json();
    },
    retry: 3,
    staleTime: 2 * 60 * 1000,
  });

  // Users from Node.js auth
  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/auth/users"],
    queryFn: async () => {
      const res = await fetch("/api/auth/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    retry: 2,
  });

  // Delete user mutation
  const deleteUser = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({ title: "User deleted", description: "The user has been removed." });
    },
    onError: (e) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const isLoading = statsLoading || predsLoading || usersLoading;
  const hasError = statsError || predsError;

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <Lock className="w-4 h-4" />
              <AlertDescription>
                الوصول غير مصرح به. يجب أن تكون مسؤولاً للوصول إلى هذه الصفحة.
              </AlertDescription>
            </Alert>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/">العودة للرئيسية</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">لوحة تحكم الأدمن</h1>
              <p className="text-sm text-muted-foreground">إدارة المستخدمين والإحصائيات</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              <UserCheck className="w-3 h-3 mr-1" />
              {user?.username}
            </Badge>
            <Button variant="outline" size="sm" onClick={logout}>
              تسجيل خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* API Error Alert */}
        {hasError && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              فشل تحميل بيانات لوحة التحكم. تأكد أن API يعمل على المنفذ 8000.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Grid */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">إحصائيات التنبؤات</h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}><CardContent className="pt-6"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-12" /></CardContent></Card>
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="إجمالي المستخدمين" value={users?.length ?? 0} colorClass="bg-primary/10 text-primary" />
              <StatCard icon={Shield} label="الحالات الحرجة" value={stats.critical ?? 0} colorClass="bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" />
              <StatCard icon={UserCheck} label="إجمالي التنبؤات" value={stats.total ?? 0} colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" />
              <StatCard icon={UserPlus} label="عامل صحي مسجل" value={users?.filter(u => u.role === "health").length ?? 0} colorClass="bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="إجمالي المستخدمين" value="--" colorClass="bg-muted" />
              <StatCard icon={Shield} label="الحالات الحرجة" value="--" colorClass="bg-muted" />
              <StatCard icon={UserCheck} label="إجمالي التنبؤات" value="--" colorClass="bg-muted" />
              <StatCard icon={UserPlus} label="عامل صحي" value="--" colorClass="bg-muted" />
            </div>
          )}
        </section>
        {/* Severity Distribution */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">توزيع الحالات حسب الشدة</h2>
          </div>
          <Card>
            <CardContent className="pt-6">
              {isLoading || !stats ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="flex-1 h-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {([
                    { key: "critical", label: "حرج", color: "bg-red-500" },
                    { key: "high", label: "مرتفع", color: "bg-orange-500" },
                    { key: "moderate", label: "متوسط", color: "bg-yellow-500" },
                    { key: "low", label: "منخفض", color: "bg-green-500" },
                    { key: "stuntingCount", label: "تقزم", color: "bg-purple-500" },
                  ] as Array<{ key: keyof AdminStats; label: string; color: string }>).map((item) => {
                    const value = (stats[item.key] as number) || 0;
                    const total = stats.total || 1;
                    const pct = Math.round((value / total) * 100);
                    return (
                      <div key={item.key} className="flex items-center gap-3">
                        <span className="text-sm font-medium w-20 text-right">{item.label}</span>
                        <Progress value={pct} className="flex-1 h-3" />
                        <span className="text-sm text-muted-foreground w-16 text-left">{value} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
        {/* Recent Predictions Table */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">سجل التنبؤات</h2>
          </div>
          <Card>
            <CardContent className="p-0">
              {predsLoading ? (
                <div className="p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full mt-2" /><Skeleton className="h-10 w-full mt-2" /></div>
              ) : predictions && predictions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الاسم</TableHead>
                        <TableHead>العمر</TableHead>
                        <TableHead>المحافظة</TableHead>
                        <TableHead>التنبؤ</TableHead>
                        <TableHead>الشدة</TableHead>
                        <TableHead>التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {predictions.slice(0, 10).map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.childName}</TableCell>
                          <TableCell>{p.age} سنوات</TableCell>
                          <TableCell>{p.governorate}</TableCell>
                          <TableCell>{p.prediction}</TableCell>
                          <TableCell><Badge variant={p.severity === "critical" ? "destructive" : p.severity === "high" ? "warning" : "secondary"}>{p.severity}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{p.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>لا توجد تنبؤات بعد</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
        {/* User Management */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">إدارة المستخدمين</h2>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="w-4 h-4 mr-1" />
                  إضافة مستخدم
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة مستخدم جديد</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-username">اسم المستخدم</Label>
                    <Input id="new-username" placeholder="username" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-password">كلمة المرور</Label>
                    <Input id="new-password" type="password" placeholder="****" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-role">الدور</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="اختر الدور" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="health">عامل صحي</SelectItem>
                        <SelectItem value="doctor">طبيب</SelectItem>
                        <SelectItem value="user">مستخدم عادي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  حفظ المستخدم
                </Button>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              {usersLoading ? (
                <div className="p-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full mt-2" /><Skeleton className="h-12 w-full mt-2" /></div>
              ) : users && users.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>اسم المستخدم</TableHead>
                        <TableHead>الدور</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead className="text-right">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-mono text-sm text-muted-foreground">#{u.id}</TableCell>
                          <TableCell className="font-medium">{u.username}</TableCell>
                          <TableCell><RoleBadge role={u.role} /></TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.createdAt?.substring(0, 10)}</TableCell>
                          <TableCell className="text-right">
                            {u.role !== "admin" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteUser.mutate(u.id)}
                                disabled={deleteUser.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="text-xs">لا يمكن حذف</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>لا يوجد مستخدمين مسجلين</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
