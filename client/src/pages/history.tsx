import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Prediction } from "@shared/schema";
import { Link } from "wouter";
import {
  Search, Trash2, ChevronDown, ChevronUp,
  Activity, AlertTriangle, ClipboardList, Filter, X
} from "lucide-react";

function RiskBadge({ risk }: { risk: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
    high: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    moderate: "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-500 border-yellow-200 dark:border-yellow-700",
    low: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[risk] || styles.low}`}>
      {risk.charAt(0).toUpperCase() + risk.slice(1)}
    </span>
  );
}

function ProbBar({ prob, risk }: { prob: number; risk: string }) {
  const colors: Record<string, string> = {
    low: "bg-emerald-500",
    moderate: "bg-yellow-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  };
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${colors[risk] || colors.low}`} style={{ width: `${Math.round(prob * 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8">{Math.round(prob * 100)}%</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

function PredictionCard({ prediction, onDelete }: { prediction: Prediction; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(prediction.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
  const time = new Date(prediction.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit"
  });

  const riskOrder: Record<string, number> = { low: 0, moderate: 1, high: 2, critical: 3 };
  const isUrgent = riskOrder[prediction.overallRisk] >= 2;

  return (
    <Card data-testid={`card-prediction-${prediction.id}`} className={`transition-all duration-200 ${isUrgent ? "border-l-4 border-l-orange-400 dark:border-l-orange-600" : ""}`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start gap-3">
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
            prediction.overallRisk === "critical" ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300" :
            prediction.overallRisk === "high" ? "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300" :
            "bg-primary/10 text-primary"
          }`}>
            {prediction.childName.charAt(0).toUpperCase()}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-foreground text-sm">{prediction.childName}</span>
              <RiskBadge risk={prediction.overallRisk} />
              {isUrgent && (
                <span className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="w-3 h-3" />
                  Urgent
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {prediction.ageMonths}mo · {prediction.sex} · {prediction.region} · {date} at {time}
            </p>
            <div className="flex flex-wrap gap-3 mt-2">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Stunting</p>
                <ProbBar prob={prediction.stuntingProb} risk={prediction.stuntingRisk} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Wasting</p>
                <ProbBar prob={prediction.wastingProb} risk={prediction.wastingRisk} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Underweight</p>
                <ProbBar prob={prediction.underweightProb} risk={prediction.underweightRisk} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-expand-${prediction.id}`}
              className="h-8 w-8 text-muted-foreground"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              data-testid={`button-delete-${prediction.id}`}
              className="h-8 w-8 text-muted-foreground"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-border animate-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-x-8">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Measurements</p>
                <DetailRow label="Weight" value={`${prediction.weightKg} kg`} />
                <DetailRow label="Height" value={`${prediction.heightCm} cm`} />
                <DetailRow label="MUAC" value={`${prediction.muacCm} cm`} />
                <DetailRow label="Age" value={`${prediction.ageMonths} months`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Risk Levels</p>
                <DetailRow label="Stunting" value={`${prediction.stuntingRisk} (${Math.round(prediction.stuntingProb * 100)}%)`} />
                <DetailRow label="Wasting" value={`${prediction.wastingRisk} (${Math.round(prediction.wastingProb * 100)}%)`} />
                <DetailRow label="Underweight" value={`${prediction.underweightRisk} (${Math.round(prediction.underweightProb * 100)}%)`} />
                <DetailRow label="Overall" value={prediction.overallRisk} />
              </div>
            </div>
            {prediction.notes && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-foreground">{prediction.notes}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function History() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: predictions, isLoading } = useQuery<Prediction[]>({
    queryKey: ["/api/predictions"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/predictions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictions/stats"] });
      setDeleteId(null);
      toast({ title: "Prediction deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const filtered = (predictions ?? []).filter(p => {
    const matchSearch = !search ||
      p.childName.toLowerCase().includes(search.toLowerCase()) ||
      p.region.toLowerCase().includes(search.toLowerCase());
    const matchRisk = riskFilter === "all" || p.overallRisk === riskFilter;
    return matchSearch && matchRisk;
  });

  const hasFilters = search || riskFilter !== "all";

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All malnutrition prediction records
          </p>
        </div>
        <Button asChild data-testid="button-new-prediction-history">
          <Link href="/predict">
            <Activity className="w-4 h-4 mr-2" />
            New Prediction
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search by name or region..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-44" data-testid="select-risk-filter">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Levels</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setRiskFilter("all"); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
          <span className="font-medium text-foreground">{predictions?.length ?? 0}</span> predictions
        </p>
      )}

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                    <div className="flex gap-4 mt-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {hasFilters ? "No matches found" : "No predictions yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {hasFilters
                ? "Try adjusting your search or filters"
                : "Run your first malnutrition prediction to see results here"
              }
            </p>
            {!hasFilters && (
              <Button asChild>
                <Link href="/predict">
                  <Activity className="w-4 h-4 mr-2" />
                  Run Prediction
                </Link>
              </Button>
            )}
          </div>
        ) : (
          filtered.map(pred => (
            <PredictionCard
              key={pred.id}
              prediction={pred}
              onDelete={() => setDeleteId(pred.id)}
            />
          ))
        )}
      </div>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Prediction</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The prediction record will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
