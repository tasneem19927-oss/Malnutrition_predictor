import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  predictionInputSchema,
  type PredictionInput,
  type ClinicalRAGSummary,
  type EvidenceBundleItem,
} from "@shared/schema";
import {
  Activity,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Ruler,
  Scale,
  Maximize2,
  RotateCcw,
  ChevronRight,
  BookOpen,
  FileText,
  ShieldAlert,
  Stethoscope,
  ExternalLink,
  Clock,
  Info,
} from "lucide-react";

const REGIONS = [
  "Central",
  "Northern",
  "Eastern",
  "Western",
  "Ashanti",
  "Volta",
  "Upper East",
  "Upper West",
  "Brong-Ahafo",
  "Greater Accra",
  "Other",
];

type RiskLevel = "low" | "moderate" | "high" | "critical";

type NutritionMetric = {
  probability: number;
  percentage: number;
  status: string;
  severity: string;
  risk: RiskLevel;
};

type EnhancedPrediction = {
  childName: string;
  ageMonths: number;
  sex: string;
  weightKg: number;
  heightCm: number;
  muacCm: number;

  stunting: NutritionMetric;
  wasting: NutritionMetric;
  underweight: NutritionMetric;

  overallRisk: RiskLevel;
  clinicalRagSummary?: ClinicalRAGSummary;
  evidenceBundle?: EvidenceBundleItem[];
  safetyNotice?: string;
  predictedAt?: string;
};

const RISK_CONFIG: Record<
  RiskLevel,
  {
    label: string;
    bg: string;
    border: string;
    text: string;
    icon: React.ElementType;
    description: string;
    bar: string;
  }
> = {
  low: {
    label: "Low Risk",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle2,
    description: "Routine monitoring recommended",
    bar: "bg-emerald-500",
  },
  moderate: {
    label: "Moderate Risk",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-700",
    text: "text-yellow-700 dark:text-yellow-400",
    icon: Info,
    description: "Enhanced monitoring and nutrition counseling",
    bar: "bg-yellow-500",
  },
  high: {
    label: "High Risk",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-700 dark:text-orange-400",
    icon: AlertTriangle,
    description: "Immediate intervention and therapeutic support",
    bar: "bg-orange-500",
  },
  critical: {
    label: "Critical Risk",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-400",
    icon: AlertTriangle,
    description: "Urgent referral or emergency clinical care required",
    bar: "bg-red-500",
  },
};

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ProbabilityBar({
  percentage,
  risk,
}: {
  percentage: number;
  risk: RiskLevel;
}) {
  const safePercentage = Math.max(0, Math.min(100, Math.round(percentage)));
  const cfg = RISK_CONFIG[risk] || RISK_CONFIG.low;

  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
          style={{ width: `${safePercentage}%` }}
        />
      </div>
      <span className="w-12 text-right text-sm font-semibold text-foreground">
        {safePercentage}%
      </span>
    </div>
  );
}

function ResultMetricCard({
  title,
  subtitle,
  metric,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  metric: NutritionMetric;
  icon: React.ElementType;
}) {
  const cfg = RISK_CONFIG[metric.risk] || RISK_CONFIG.low;
  const RiskIcon = cfg.icon;

  return (
    <div className={`rounded-xl border p-4 space-y-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-background/70 border flex items-center justify-center">
            <Icon className={`w-5 h-5 ${cfg.text}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <Badge className={`${cfg.bg} ${cfg.text} border ${cfg.border}`}>
          {cfg.label}
        </Badge>
      </div>

      <ProbabilityBar percentage={metric.percentage} risk={metric.risk} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-background/70 border p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {formatLabel(metric.status)}
          </p>
        </div>

        <div className="rounded-lg bg-background/70 border p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Severity
          </p>
          <div className="mt-1 flex items-center gap-2">
            <RiskIcon className={`w-4 h-4 ${cfg.text}`} />
            <p className={`text-sm font-semibold ${cfg.text}`}>
              {formatLabel(metric.severity)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-background/70 border p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Clinical interpretation
        </p>
        <p className="mt-1 text-sm text-foreground">
          {title} is classified as <span className="font-semibold">{formatLabel(metric.status)}</span>{" "}
          with <span className="font-semibold">{metric.percentage}%</span> estimated probability
          and severity <span className="font-semibold">{formatLabel(metric.severity)}</span>.
        </p>
      </div>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: EvidenceBundleItem }) {
  const severityColors: Record<string, string> = {
    low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
    moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    any: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300",
  };

  const sourceTypeIcons: Record<string, React.ElementType> = {
    WHO: ShieldAlert,
    Guideline: BookOpen,
    Review: FileText,
    RCT: Stethoscope,
    Protocol: CheckCircle2,
  };

  const SourceIcon = sourceTypeIcons[evidence.source_type] || FileText;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <SourceIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            {evidence.title}
          </span>
        </div>

        <Badge
          variant="outline"
          className={
            severityColors[evidence.severity.toLowerCase()] || severityColors.any
          }
        >
          {evidence.severity}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          {evidence.source_type}
        </Badge>
        <span>
          {evidence.source} • {evidence.year}
        </span>
        <Badge variant="outline">{evidence.topic}</Badge>
        <Badge variant="outline">{evidence.population}</Badge>
      </div>

      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {evidence.excerpt}
      </p>

      {evidence.url && (
        <a
          href={evidence.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          View source
        </a>
      )}
    </div>
  );
}

function ClinicalBriefPanel({
  prediction,
  summary,
  evidenceBundle,
  safetyNotice,
}: {
  prediction: EnhancedPrediction;
  summary?: ClinicalRAGSummary;
  evidenceBundle?: EvidenceBundleItem[];
  safetyNotice?: string;
}) {
  const overall = RISK_CONFIG[prediction.overallRisk] || RISK_CONFIG.low;
  const OverallIcon = overall.icon;
  const priorityCondition = summary?.priority_condition;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className={`rounded-xl border-2 p-5 ${overall.bg} ${overall.border}`}>
        <div className="flex items-start gap-3">
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border ${overall.bg} ${overall.border}`}
          >
            <OverallIcon className={`h-6 w-6 ${overall.text}`} />
          </div>

          <div className="flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-foreground">
                Overall Assessment
              </span>
              <Badge className={`${overall.text} ${overall.bg} border ${overall.border} text-xs`}>
                {overall.label}
              </Badge>
            </div>

            <p className={`text-sm font-medium ${overall.text}`}>
              {prediction.childName}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {overall.description}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="w-4 h-4 text-primary" />
            Child Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 text-sm">
            {[
              { label: "Age", value: `${prediction.ageMonths} months` },
              {
                label: "Sex",
                value:
                  prediction.sex.charAt(0).toUpperCase() +
                  prediction.sex.slice(1),
              },
              { label: "Weight", value: `${prediction.weightKg} kg` },
              { label: "Height", value: `${prediction.heightCm} cm` },
              { label: "MUAC", value: `${prediction.muacCm} cm` },
              {
                label: "Priority",
                value: priorityCondition
                  ? formatLabel(priorityCondition)
                  : "N/A",
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="mb-0.5 text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="w-4 h-4 text-primary" />
            Malnutrition Classification
          </CardTitle>
          <CardDescription className="text-xs">
            AI-generated probability, status, and severity for stunting, wasting,
            and underweight
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 grid gap-3">
          <ResultMetricCard
            title="Stunting"
            subtitle="Height-for-age assessment"
            metric={prediction.stunting}
            icon={Ruler}
          />
          <ResultMetricCard
            title="Wasting"
            subtitle="Weight-for-height assessment"
            metric={prediction.wasting}
            icon={Scale}
          />
          <ResultMetricCard
            title="Underweight"
            subtitle="Weight-for-age assessment"
            metric={prediction.underweight}
            icon={Maximize2}
          />
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Stethoscope className="w-4 h-4 text-primary" />
              Clinical RAG Summary
            </CardTitle>
            <CardDescription className="text-xs">
              Evidence-based interpretation powered by WHO-aligned guidance
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0 space-y-4">
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <p className="mb-1 text-sm font-medium text-foreground">Summary</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {summary.summary}
              </p>
            </div>

            <div className="rounded-md bg-muted/50 p-3">
              <p className="mb-1 text-sm font-medium text-foreground">
                Rationale
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {summary.rationale}
              </p>
            </div>

            <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
              <div className="mb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  Red Flags
                </p>
              </div>

              <ul className="space-y-1">
                {summary.red_flags.map((flag, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400"
                  >
                    <span className="mt-0.5 text-xs">•</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Suggested Action
                </p>
              </div>
              <p className="text-sm leading-relaxed text-emerald-600 dark:text-emerald-400">
                {summary.suggested_action}
              </p>
            </div>

            {summary.citations.length > 0 && (
              <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-900/50">
                <div className="mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Evidence Citations
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {summary.citations.map((cid, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs font-mono">
                      [{cid}]
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {evidenceBundle && evidenceBundle.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="w-4 h-4 text-primary" />
              Evidence Bundle
            </CardTitle>
            <CardDescription className="text-xs">
              {evidenceBundle.length} retrieved source(s) from guidelines and literature
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0 space-y-3">
            {evidenceBundle.map((evidence, idx) => (
              <EvidenceCard key={idx} evidence={evidence} />
            ))}
          </CardContent>
        </Card>
      )}

      {safetyNotice && (
        <div className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="mb-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
              Safety Notice
            </p>
            <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
              {safetyNotice}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>
          Generated:{" "}
          {prediction.predictedAt
            ? new Date(prediction.predictedAt).toLocaleString()
            : new Date().toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default function Predict() {
  const [result, setResult] = useState<EnhancedPrediction | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PredictionInput>({
    resolver: zodResolver(predictionInputSchema),
    defaultValues: {
      childName: "",
      ageMonths: 0,
      sex: "male",
      weightKg: 0,
      heightCm: 0,
      muacCm: 0,
      region: "",
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PredictionInput) => {
      const res = await apiRequest("POST", "/api/predictions/enhanced", data);
      return res.json() as Promise<EnhancedPrediction>;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictions/stats"] });

      toast({
        title: "Prediction complete",
        description: `Overall risk: ${data.overallRisk.toUpperCase()} for ${data.childName}`,
      });
    },
    onError: () => {
      toast({
        title: "Prediction failed",
        description: "Please check your inputs and try again.",
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: PredictionInput) {
    setResult(null);
    mutation.mutate(data);
  }

  function reset() {
    form.reset();
    setResult(null);
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6">
        <h1 className="tracking-tight text-2xl font-bold text-foreground">
          Predict
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Enter child measurements to run an AI malnutrition risk assessment
          with classification of stunting, wasting, and underweight severity
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Child Information</CardTitle>
                  <CardDescription className="text-xs">
                    Fill in all required measurements
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="childName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Child&apos;s Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g. Amara Osei"
                            data-testid="input-child-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="ageMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age (months)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={0}
                              max={60}
                              placeholder="0–60"
                              data-testid="input-age-months"
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sex"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sex</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-sex">
                                <SelectValue placeholder="Select sex" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Measurements
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="weightKg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weight (kg)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.1"
                              min={0.5}
                              max={30}
                              placeholder="e.g. 8.2"
                              data-testid="input-weight"
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="heightCm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Height (cm)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.5"
                              min={30}
                              max={130}
                              placeholder="e.g. 76.5"
                              data-testid="input-height"
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="muacCm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MUAC (cm)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.1"
                              min={6}
                              max={25}
                              placeholder="e.g. 12.8"
                              data-testid="input-muac"
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Mid-Upper Arm Circumference
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-region">
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {REGIONS.map((region) => (
                              <SelectItem key={region} value={region}>
                                {region}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Clinical Notes{" "}
                          <span className="font-normal text-muted-foreground">
                            (optional)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Any relevant observations..."
                            data-testid="textarea-notes"
                            className="resize-none"
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-1">
                    <Button
                      type="submit"
                      disabled={mutation.isPending}
                      data-testid="button-predict"
                      className="flex-1"
                    >
                      {mutation.isPending ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Brain className="mr-2 h-4 w-4" />
                          Run Prediction
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={reset}
                      data-testid="button-reset"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="px-4 pb-4 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                WHO Classification Reference
              </p>

              <div className="space-y-3">
                {[
                  {
                    type: "Stunting",
                    definition: "Normal, Moderate, Severe",
                    icon: Ruler,
                  },
                  {
                    type: "Wasting",
                    definition: "Normal, Moderate, Severe, Acute",
                    icon: Scale,
                  },
                  {
                    type: "Underweight",
                    definition: "Normal, Moderate, Severe",
                    icon: Maximize2,
                  },
                ].map(({ type, definition, icon: Icon }) => (
                  <div key={type} className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {definition}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          {result ? (
            <ClinicalBriefPanel
              prediction={result}
              summary={result.clinicalRagSummary}
              evidenceBundle={result.evidenceBundle}
              safetyNotice={result.safetyNotice}
            />
          ) : (
            <Card className="flex min-h-[400px] h-full flex-col items-center justify-center border-dashed text-center">
              <CardContent className="pb-8 pt-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Brain className="h-8 w-8 text-primary" />
                </div>

                <h3 className="mb-1.5 text-base font-semibold text-foreground">
                  {mutation.isPending ? "Running Analysis..." : "Ready to Predict"}
                </h3>

                <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {mutation.isPending
                    ? "The model is analyzing the child's measurements and preparing the malnutrition classification."
                    : "Fill in the child's information on the left and click Run Prediction to view probability, status, and severity for stunting, wasting, and underweight."}
                </p>

                {!mutation.isPending && (
                  <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                    {[
                      { icon: Brain, label: "XGBoost AI" },
                      { icon: BookOpen, label: "Clinical Guidance" },
                      { icon: Activity, label: "Instant Results" },
                    ].map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
