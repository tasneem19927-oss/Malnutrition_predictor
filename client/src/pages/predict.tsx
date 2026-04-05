import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  predictionInputSchema, type PredictionInput, type Prediction,
  type ClinicalRAGSummary, type EvidenceBundleItem
} from "@shared/schema";
import {
  Activity, Brain, AlertTriangle, CheckCircle2, Ruler,
  Scale, Maximize2, RotateCcw, ChevronRight, TrendingDown, Info,
  BookOpen, FileText, ShieldAlert, Stethoscope, ExternalLink, Clock
} from "lucide-react";

const REGIONS = [
  "Central", "Northern", "Eastern", "Western", "Ashanti",
  "Volta", "Upper East", "Upper West", "Brong-Ahafo", "Greater Accra", "Other"
];

const RISK_CONFIG: Record<string, {
  label: string;
  bg: string;
  border: string;
  text: string;
  icon: React.ElementType;
  description: string;
}> = {
  low: {
    label: "Low Risk",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle2,
    description: "Routine monitoring recommended",
  },
  moderate: {
    label: "Moderate Risk",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-700",
    text: "text-yellow-700 dark:text-yellow-500",
    icon: Info,
    description: "Enhanced monitoring and nutrition counseling",
  },
  high: {
    label: "High Risk",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-700 dark:text-orange-400",
    icon: AlertTriangle,
    description: "Immediate intervention and therapeutic feeding",
  },
  critical: {
    label: "Critical Risk",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-400",
    icon: AlertTriangle,
    description: "Emergency referral and inpatient care required",
  },
};

function ProbabilityBar({ probability, risk }: { probability: number; risk: string }) {
  const width = Math.round(probability * 100);
  const colors: Record<string, string> = {
    low: "bg-emerald-500",
    moderate: "bg-yellow-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  };
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colors[risk] || colors.low}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-foreground w-10 text-right">{width}%</span>
    </div>
  );
}

function RiskCard({
  label,
  risk,
  probability,
  icon: Icon,
}: {
  label: string;
  risk: string;
  probability: number;
  icon: React.ElementType;
}) {
  const cfg = RISK_CONFIG[risk] || RISK_CONFIG.low;
  const RIcon = cfg.icon;
  return (
    <div className={`rounded-lg border p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1">
          <RIcon className={`w-4 h-4 ${cfg.text}`} />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>
      <ProbabilityBar probability={probability} risk={risk} />
    </div>
  );
}

interface EnhancedPrediction {
  childName: string;
  ageMonths: number;
  sex: string;
  weightKg: number;
  heightCm: number;
  muacCm: number;
  stuntingProbability: number;
  wastingProbability: number;
  underweightProbability: number;
  stuntingRisk: string;
  wastingRisk: string;
  underweightRisk: string;
  overallRisk: string;
  clinicalRagSummary?: ClinicalRAGSummary;
  evidenceBundle?: EvidenceBundleItem[];
  safetyNotice?: string;
  predictedAt?: string;
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
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <SourceIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{evidence.title}</span>
        </div>
        <Badge
          variant="outline"
          className={severityColors[evidence.severity.toLowerCase()] || severityColors.any}
        >
          {evidence.severity}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          {evidence.source_type}
        </Badge>
        <span>{evidence.source} • {evidence.year}</span>
        <Badge variant="outline">{evidence.topic}</Badge>
        <Badge variant="outline">{evidence.population}</Badge>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
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
  summary: ClinicalRAGSummary;
  evidenceBundle?: EvidenceBundleItem[];
  safetyNotice?: string;
}) {
  const overall = RISK_CONFIG[prediction.overallRisk] || RISK_CONFIG.low;
  const OverallIcon = overall.icon;
  const priorityCondition = summary.priority_condition;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      {/* Overall Risk Banner */}
      <div className={`rounded-xl border-2 p-5 ${overall.bg} ${overall.border}`}>
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${overall.bg} border ${overall.border}`}>
            <OverallIcon className={`w-6 h-6 ${overall.text}`} />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-base font-bold text-foreground">Overall Assessment</span>
              <Badge className={`${overall.text} ${overall.bg} border ${overall.border} text-xs`}>
                {overall.label}
              </Badge>
            </div>
            <p className={`text-sm ${overall.text} font-medium`}>{prediction.childName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{overall.description}</p>
          </div>
        </div>
      </div>

      {/* Child Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Child Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { label: "Age", value: `${prediction.ageMonths} months` },
              { label: "Sex", value: prediction.sex.charAt(0).toUpperCase() + prediction.sex.slice(1) },
              { label: "Weight", value: `${prediction.weightKg} kg` },
              { label: "Height", value: `${prediction.heightCm} cm` },
              { label: "MUAC", value: `${prediction.muacCm} cm` },
              { label: "Priority", value: priorityCondition ? priorityCondition.charAt(0).toUpperCase() + priorityCondition.slice(1) : "N/A" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ML Risk Cards */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            XGBoost Malnutrition Assessment
          </CardTitle>
          <CardDescription className="text-xs">
            AI-generated probabilities for stunting, wasting, and underweight
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-2.5">
          <RiskCard
            label="Stunting (HAZ)"
            risk={prediction.stuntingRisk}
            probability={prediction.stuntingProbability}
            icon={Ruler}
          />
          <RiskCard
            label="Wasting (WHZ)"
            risk={prediction.wastingRisk}
            probability={prediction.wastingProbability}
            icon={Scale}
          />
          <RiskCard
            label="Underweight (WAZ)"
            risk={prediction.underweightRisk}
            probability={prediction.underweightProbability}
            icon={Maximize2}
          />
        </CardContent>
      </Card>

            {/* Clinical RAG Summary - Core Clinical Section */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" />
            Clinical RAG Summary
          </CardTitle>
          <CardDescription className="text-xs">
            Evidence-based interpretation powered by WHO 2023 guidelines and peer-reviewed sources
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {/* Summary */}
          <div className="rounded-md bg-primary/5 p-3 border border-primary/20">
            <p className="text-sm font-medium text-foreground mb-1">Summary</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{summary.summary}</p>
          </div>

          {/* Rationale */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground mb-1">Rationale</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{summary.rationale}</p>
          </div>

          {/* Red Flags */}
          <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-3 border border-red-200 dark:border-red-900">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Red Flags</p>
            </div>
            <ul className="space-y-1">
              {summary.red_flags.map((flag, idx) => (
                <li key={idx} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                  <span className="text-xs mt-0.5">•</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Suggested Action */}
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 p-3 border border-emerald-200 dark:border-emerald-900">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Suggested Action</p>
            </div>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 leading-relaxed">{summary.suggested_action}</p>
          </div>

          {/* Citations */}
          {summary.citations.length > 0 && (
            <div className="rounded-md bg-slate-50 dark:bg-slate-900/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Evidence Citations</p>
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

            {/* Evidence Bundle - Source References */}
      {evidenceBundle && evidenceBundle.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Evidence Bundle
            </CardTitle>
            <CardDescription className="text-xs">
              {evidenceBundle.length} retrieved source(s) from WHO 2023 guidelines and peer-reviewed literature
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {evidenceBundle.map((evidence, idx) => (
              <EvidenceCard key={idx} evidence={evidence} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Safety Notice */}
      {safetyNotice && (
        <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">Safety Notice</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{safetyNotice}</p>
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>Generated: {new Date().toLocaleString()}</span>
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Predict</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Enter child measurements to run an AI malnutrition risk assessment with WHO-aligned clinical guidance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Child Information</CardTitle>
                  <CardDescription className="text-xs">Fill in all required measurements</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Child Name */}
                  <FormField
                    control={form.control}
                    name="childName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Child's Name</FormLabel>
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

                  {/* Age + Sex */}
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
                              onChange={e => field.onChange(Number(e.target.value))}
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

                                    {/* Measurements Label */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Measurements</p>
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
                              onChange={e => field.onChange(Number(e.target.value))}
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
                              onChange={e => field.onChange(Number(e.target.value))}
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
                              onChange={e => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">Mid-Upper Arm Circumference</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Region */}
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
                            {REGIONS.map(r => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clinical Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
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
                          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Brain className="w-4 h-4 mr-2" />
                          Run Prediction
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={reset}
                      data-testid="button-reset"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

                    {/* WHO Reference */}
          <Card>
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">WHO Classification Reference</p>
              <div className="space-y-2">
                {[
                  { type: "Stunting", definition: "HAZ < −2 SD (chronic)", icon: Ruler },
                  { type: "Wasting", definition: "WHZ < −2 SD (acute)", icon: Scale },
                  { type: "Underweight", definition: "WAZ < −2 SD (combined)", icon: Maximize2 },
                ].map(({ type, definition, icon: Icon }) => (
                  <div key={type} className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{type}</span>
                      <span className="text-xs text-muted-foreground">{definition}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Result Panel */}
        <div>
          {result ? (
            <ClinicalBriefPanel
              prediction={result}
              summary={result.clinicalRagSummary!}
              evidenceBundle={result.evidenceBundle}
              safetyNotice={result.safetyNotice}
            />
          ) : (
            <Card className="h-full min-h-[400px] flex flex-col items-center justify-center text-center border-dashed">
              <CardContent className="pt-8 pb-8">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">
                  {mutation.isPending ? "Running Analysis..." : "Ready to Predict"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  {mutation.isPending
                    ? "XGBoost models are analyzing the child's measurements and RAG is retrieving WHO 2023 evidence..."
                    : "Fill in the child's information on the left and click 'Run Prediction' to get an AI-powered malnutrition risk assessment with WHO-aligned clinical guidance."
                  }
                </p>
                {!mutation.isPending && (
                  <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                    {[
                      { icon: Brain, label: "XGBoost AI" },
                      { icon: BookOpen, label: "WHO 2023 RAG" },
                      { icon: Activity, label: "Instant Results" },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex flex-col items-center gap-1.5">
                        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                          <Icon className="w-4 h-4 text-muted-foreground" />
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
