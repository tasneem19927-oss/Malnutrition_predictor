import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Users, AlertTriangle, TrendingUp, Activity,
  ChevronRight, ArrowRight, Brain, Ruler, Scale, Maximize2
} from "lucide-react";
import type { Prediction } from "@shared/schema";
import { RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

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

const RISK_COLORS = {
  critical: "#dc2626",
  high: "#ea580c",
  moderate: "#ca8a04",
  low: "#16a34a",
};

function RiskBadge({ risk }: { risk: string }) {
  const variants: Record<string, string> = {
    critical: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
    high: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    moderate: "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-500 border-yellow-200 dark:border-yellow-700",
    low: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants[risk] || variants.low}`}>
      {risk.charAt(0).toUpperCase() + risk.slice(1)}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  loading?: boolean;
  colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium mb-1">{label}</p>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
            )}
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MalnutritionTypeBar({
  label,
  count,
  total,
  color,
  icon: Icon,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  icon: React.ElementType;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-sm text-muted-foreground">{count} <span className="text-xs">({pct}%)</span></span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color.replace("bg-", "bg-").replace("/10", "/80").replace("text-", "")}`}
            style={{ width: `${pct}%`, backgroundColor: color.includes("primary") ? "hsl(var(--primary))" : color.includes("accent") ? "hsl(var(--accent))" : color.includes("orange") ? "#ea580c" : "#ca8a04" }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/predictions/stats"],
  });

  const { data: predictions, isLoading: predsLoading } = useQuery<Prediction[]>({
    queryKey: ["/api/predictions"],
  });

  const recent = predictions?.slice(0, 5) ?? [];

  const riskData = stats ? [
    { name: "Critical", value: stats.critical, fill: RISK_COLORS.critical },
    { name: "High", value: stats.high, fill: RISK_COLORS.high },
    { name: "Moderate", value: stats.moderate, fill: RISK_COLORS.moderate },
    { name: "Low", value: stats.low, fill: RISK_COLORS.low },
  ].filter(d => d.value > 0) : [];

  const urgentCases = predictions?.filter(p => p.overallRisk === "critical" || p.overallRisk === "high").slice(0, 3) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Malnutrition prediction overview and key metrics
          </p>
        </div>
        <Button asChild data-testid="button-new-prediction">
          <Link href="/predict">
            <Activity className="w-4 h-4 mr-2" />
            New Prediction
          </Link>
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Assessed"
          value={stats?.total ?? 0}
          sub="children assessed"
          loading={statsLoading}
          colorClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={AlertTriangle}
          label="Critical Risk"
          value={stats?.critical ?? 0}
          sub="urgent intervention"
          loading={statsLoading}
          colorClass="bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
        />
        <StatCard
          icon={TrendingUp}
          label="High Risk"
          value={stats?.high ?? 0}
          sub="requires attention"
          loading={statsLoading}
          colorClass="bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400"
        />
        <StatCard
          icon={Activity}
          label="Low Risk"
          value={stats?.low ?? 0}
          sub="routine monitoring"
          loading={statsLoading}
          colorClass="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* Charts + Recent Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk Distribution Chart */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-48 flex items-center justify-center">
                <Skeleton className="w-36 h-36 rounded-full" />
              </div>
            ) : riskData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                        color: "hsl(var(--foreground))",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      iconSize={8}
                      iconType="circle"
                      formatter={(value) => (
                        <span style={{ fontSize: "12px", color: "hsl(var(--foreground))" }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-center">
                <Brain className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No data yet</p>
                <p className="text-xs text-muted-foreground/60">Run predictions to see distribution</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Malnutrition Type Breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Type Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">High/critical cases by type</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            {statsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                </div>
              ))
            ) : (
              <>
                <MalnutritionTypeBar
                  label="Stunting"
                  count={stats?.stuntingCount ?? 0}
                  total={stats?.total ?? 1}
                  color="bg-primary/10 text-primary"
                  icon={Ruler}
                />
                <MalnutritionTypeBar
                  label="Wasting"
                  count={stats?.wastingCount ?? 0}
                  total={stats?.total ?? 1}
                  color="bg-orange-100 dark:bg-orange-950/30 text-orange-600"
                  icon={Scale}
                />
                <MalnutritionTypeBar
                  label="Underweight"
                  count={stats?.underweightCount ?? 0}
                  total={stats?.total ?? 1}
                  color="bg-accent/10 text-accent"
                  icon={Maximize2}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Urgent Cases */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Urgent Cases</CardTitle>
            <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
              <Link href="/history">View all <ChevronRight className="w-3 h-3 ml-0.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {predsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))
            ) : urgentCases.length === 0 ? (
              <div className="py-6 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-2">
                  <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-sm text-muted-foreground">No urgent cases</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">All children at low/moderate risk</p>
              </div>
            ) : (
              urgentCases.map(pred => (
                <div
                  key={pred.id}
                  data-testid={`card-urgent-${pred.id}`}
                  className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    pred.overallRisk === "critical" ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300" : "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300"
                  }`}>
                    {pred.childName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{pred.childName}</p>
                    <p className="text-xs text-muted-foreground">{pred.ageMonths}mo · {pred.sex} · {pred.region}</p>
                  </div>
                  <RiskBadge risk={pred.overallRisk} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Predictions Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Recent Predictions</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Latest assessments across all regions</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/history">
              View all <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Child</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">Age</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">Region</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">Stunting</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">Wasting</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">Underweight</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-3 py-3">Overall</th>
                </tr>
              </thead>
              <tbody>
                {predsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : recent.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                      No predictions yet. <Link href="/predict" className="text-primary hover:underline">Run your first prediction.</Link>
                    </td>
                  </tr>
                ) : (
                  recent.map(pred => (
                    <tr key={pred.id} data-testid={`row-prediction-${pred.id}`} className="border-b border-border/50 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
                            {pred.childName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">{pred.childName}</p>
                            <p className="text-xs text-muted-foreground">{pred.sex}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{pred.ageMonths}mo</td>
                      <td className="px-3 py-3 text-muted-foreground">{pred.region}</td>
                      <td className="px-3 py-3"><RiskBadge risk={pred.stuntingRisk} /></td>
                      <td className="px-3 py-3"><RiskBadge risk={pred.wastingRisk} /></td>
                      <td className="px-3 py-3"><RiskBadge risk={pred.underweightRisk} /></td>
                      <td className="px-3 py-3"><RiskBadge risk={pred.overallRisk} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Model Info Banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">XGBoost Prediction Engine</p>
              <p className="text-xs text-muted-foreground">3 models · 16 features · WHO z-score calibrated</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 ml-0 sm:ml-auto">
            {[
              { label: "Stunting AUC", value: "0.89" },
              { label: "Wasting AUC", value: "0.91" },
              { label: "Underweight AUC", value: "0.88" },
            ].map(m => (
              <div key={m.label} className="text-center">
                <p className="text-base font-bold text-primary">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
