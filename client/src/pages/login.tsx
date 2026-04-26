import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, Mail, Lock, AlertCircle, User, Briefcase, Stethoscope } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<string>("health_worker");
  const [error, setError] = useState("");
  
  const { isAuthenticated, isLoading, login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      if (isRegister) {
        if (!email || !password || !fullName || !username) {
          setError("الرجاء إكمال جميع الحقول");
          return;
        }
        await register({ email, password, fullName, username, role: role as any });
      } else {
        if (!email || !password) {
          setError("الرجاء إدخال البريد الإلكتروني وكلمة المرور");
          return;
        }
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ ما");
    }
  };

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Brain className="w-9 h-9 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            {isRegister ? "إنشاء حساب جديد" : "لوحة تحكم النظام"}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            نظام التنبؤ بسوء التغذية المدعوم بالذكاء الاصطناعي
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6">
          {!isRegister && (
            <div className="bg-muted/50 rounded-lg p-4 mb-6 text-sm leading-relaxed border border-border/50">
              <h4 className="font-semibold text-primary mb-2 flex items-center gap-2 text-base">
                <Brain className="w-4 h-4" /> مرحباً بك في نظام Predictor
              </h4>
              <p className="text-muted-foreground">
                هذا النظام مخصص للكوادر الطبية والعاملين الصحيين لتشخيص حالات سوء التغذية بدقة. 
                يرجى تسجيل الدخول للوصول إلى أدوات التنبؤ وقواعد البيانات السريرية.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/30">
                  <Stethoscope className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium">للأطباء: تشخيص معمق</span>
                </div>
                <div className="flex items-center gap-2 bg-background p-2 rounded border border-border/30">
                  <Briefcase className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium">للعاملين: مسح ميداني</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mb-6 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" /> الاسم الكامل
                    </label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="د. أحمد محمد" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" /> اسم المستخدم
                    </label>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ahmed_md" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">نوع الحساب (الدور)</label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="اختر نوع الحساب" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="health_worker">عامل صحي (Health Worker)</SelectItem>
                      <SelectItem value="doctor">طبيب (Doctor)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" /> البريد الإلكتروني
              </label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@health.com" className="h-11" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" /> كلمة المرور
              </label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11" />
            </div>

            <Button type="submit" className="w-full h-12 font-bold text-lg mt-4 shadow-md transition-all hover:scale-[1.01]" disabled={isLoading}>
              {isLoading ? "جاري المعالجة..." : (isRegister ? "إنشاء حساب" : "تسجيل الدخول")}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <button 
              type="button" 
              onClick={() => setIsRegister(!isRegister)} 
              className="text-primary hover:underline font-medium transition-colors"
            >
              {isRegister ? "لديك حساب بالفعل؟ سجل دخولك" : "ليس لديك حساب؟ أنشئ حساباً جديداً"}
            </button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-border flex flex-col items-center gap-3">
            <p className="text-xs text-muted-foreground">بوابة الوصول الموحدة لنظام Predictor</p>
            <div className="flex gap-4 opacity-50 grayscale hover:grayscale-0 transition-all">
               <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-accent/10 border border-accent/20 rounded-md px-2.5 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-accent font-medium">النماذج متصلة</span>
               </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
