import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, User, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { isAuthenticated, isLoading, login, isAdmin, isHealthWorker, isDoctor } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (isAdmin) navigate("/admin");
      else if (isHealthWorker || isDoctor) navigate("/health");
      else navigate("/");
    }
  }, [isAuthenticated, isLoading, isAdmin, isHealthWorker, isDoctor, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("الرجاء إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    try {
      await login(username, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تسجيل الدخول";
      setError(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Brain className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Brain className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">نظام النظام</CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            نظام تنبؤ سوء التغذية عند الأطفال
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                اسم المستخدم
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="h-11"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                كلمة المرور
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full h-11 font-semibold mt-2">
              تسجيل الدخول
            </Button>
          </form>
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center space-y-1">
              <span>حسابات تجريبية:</span>
              <br />
              <span className="font-mono bg-muted/50 px-2 py-0.5 rounded text-accent-foreground">
                admin / admin123
              </span>
              <span className="inline-block w-2" />
              <span className="font-mono bg-muted/50 px-2 py-0.5 rounded text-accent-foreground">
                health / health123
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
