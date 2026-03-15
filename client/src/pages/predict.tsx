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
import { predictionInputSchema, type PredictionInput, type Prediction } from "@shared/schema";
import {
  Activity, Brain, AlertTriangle, CheckCircle2, Ruler,
  Scale, Maximize2, RotateCcw, ChevronRight, TrendingDown, Info
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
          <Icon className={`w-4 h-4 ${cfg.text}`} />
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

function ResultPanel({ prediction }: { prediction: Prediction }) {
  const overall = RISK_CONFIG[prediction.overallRisk] || RISK_CONFIG.low;
  const OverallIcon = overall.icon;

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
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

      {/* Child Info */}
      <Card>
        <CardContent className="pt-4 pb-4 px-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { label: "Age", value: `${prediction.ageMonths} months` },
              { label: "Sex", value: prediction.sex.charAt(0).toUpperCase() + prediction.sex.slice(1) },
              { label: "Region", value: prediction.region },
              { label: "Weight", value: `${prediction.weightKg} kg` },
              { label: "Height", value: `${prediction.heightCm} cm` },
              { label: "MUAC", value: `${prediction.muacCm} cm` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Three Risk Cards */}
      <div className="space-y-2.5">
        <p className="text-sm font-semibold text-foreground">Malnutrition Assessment</p>
        <RiskCard
          label="Stunting (HAZ)"
          risk={prediction.stuntingRisk}
          probability={prediction.stuntingProb}
          icon={Ruler}
        />
        <RiskCard
          label="Wasting (WHZ)"
          risk={prediction.wastingRisk}
          probability={prediction.wastingProb}
          icon={Scale}
        />
        <RiskCard
          label="Underweight (WAZ)"
          risk={prediction.underweightRisk}
          probability={prediction.underweightProb}
          icon={Maximize2}
        />
      </div>

      {/* Clinical Note */}
      <div className="rounded-md border border-border bg-muted/30 p-3 flex gap-2.5">
        <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          This AI prediction is a decision-support tool. All results should be validated by
          qualified health professionals before clinical decisions are made.
        </p>
      </div>
    </div>
  );
}

export default function Predict() {
  const [result, setResult] = useState<Prediction | null>(null);
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
      const res = await apiRequest("POST", "/api/predictions", data);
      return res.json() as Promise<Prediction>;
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
          Enter child measurements to run an AI malnutrition risk assessment
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

                  {/* Measurements */}
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
            <ResultPanel prediction={result} />
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
                    ? "XGBoost models are analyzing the child's measurements..."
                    : "Fill in the child's information on the left and click 'Run Prediction' to get an AI-powered malnutrition risk assessment."
                  }
                </p>
                {!mutation.isPending && (
                  <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                    {[
                      { icon: Brain, label: "XGBoost AI" },
                      { icon: TrendingDown, label: "WHO Calibrated" },
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
