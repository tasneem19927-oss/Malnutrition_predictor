import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen, Terminal, Database, Brain,
  FileCode, Server, Cpu, Package, ChevronRight
} from "lucide-react";

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="relative rounded-md overflow-hidden border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">{language}</span>
      </div>
      <pre className="p-4 text-xs leading-relaxed font-mono text-foreground bg-muted/20 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-foreground border-b border-border pb-2">{title}</h3>
      {children}
    </div>
  );
}

function ApiEndpoint({
  method,
  path,
  description,
  request,
  response,
}: {
  method: string;
  path: string;
  description: string;
  request?: string;
  response?: string;
}) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    POST: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    DELETE: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  };
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold border ${colors[method] || colors.GET}`}>
          {method}
        </span>
        <code className="text-sm font-mono text-foreground flex-1">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {request && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Request Body</p>
          <CodeBlock code={request} language="json" />
        </div>
      )}
      {response && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Response</p>
          <CodeBlock code={response} language="json" />
        </div>
      )}
    </div>
  );
}

function NavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {active && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
      <span>{label}</span>
    </button>
  );
}

const SECTIONS = ["Overview", "Quick Start", "Python API", "REST API", "Database", "Commands"];

export default function Documentation() {
  const [activeSection, setActiveSection] = useState("Overview");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Documentation</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Complete guide for the Nizam malnutrition prediction platform
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar nav */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contents</p>
            </CardHeader>
            <CardContent className="px-2 pb-4 space-y-0.5">
              {SECTIONS.map(s => (
                <NavItem
                  key={s}
                  label={s}
                  active={activeSection === s}
                  onClick={() => setActiveSection(s)}
                />
              ))}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardContent className="pt-4 pb-4 px-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Key Files</p>
              {[
                { icon: FileCode, name: "train_models.py", desc: "Training script" },
                { icon: Server, name: "prediction_api.py", desc: "FastAPI server" },
                { icon: Cpu, name: "xgboost_model.py", desc: "ML utilities" },
                { icon: Terminal, name: "predict_demo_script.py", desc: "Demo CLI" },
                { icon: Database, name: "schema.sql", desc: "DB schema" },
                { icon: Package, name: "requirements_full.txt", desc: "Dependencies" },
              ].map(({ icon: Icon, name, desc }) => (
                <div key={name} className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs font-mono font-medium text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {activeSection === "Overview" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Nizam Platform Overview</CardTitle>
                      <p className="text-sm text-muted-foreground">AI-powered child malnutrition prediction</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-foreground leading-relaxed">
                    Nizam is an offline-first AI platform for predicting malnutrition — stunting, wasting, and underweight — in children aged 0–60 months. Built on XGBoost, it uses 16 engineered features derived from anthropometric measurements and WHO growth standards.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: "Stunting", color: "bg-primary/10 border-primary/20 text-primary", def: "HAZ < −2 SD", detail: "Chronic malnutrition indicating long-term nutritional inadequacy" },
                      { label: "Wasting", color: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400", def: "WHZ < −2 SD", detail: "Acute malnutrition indicating recent nutrient loss" },
                      { label: "Underweight", color: "bg-accent/10 border-accent/20 text-accent", def: "WAZ < −2 SD", detail: "Combined indicator of chronic and acute malnutrition" },
                    ].map(({ label, color, def, detail }) => (
                      <div key={label} className={`rounded-lg border p-4 ${color}`}>
                        <p className="text-sm font-semibold mb-1">{label}</p>
                        <p className="text-xs font-mono mb-2 opacity-80">{def}</p>
                        <p className="text-xs opacity-70 leading-relaxed">{detail}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Risk Classification System</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { level: "Low", range: "< 20%", action: "Routine monitoring and standard care", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
                      { level: "Moderate", range: "20–45%", action: "Enhanced monitoring and nutrition counseling", bg: "bg-yellow-50 dark:bg-yellow-950/30", text: "text-yellow-700 dark:text-yellow-500", border: "border-yellow-200 dark:border-yellow-700" },
                      { level: "High", range: "45–70%", action: "Immediate therapeutic feeding intervention", bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800" },
                      { level: "Critical", range: "> 70%", action: "Emergency referral and inpatient care", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
                    ].map(({ level, range, action, bg, text, border }) => (
                      <div key={level} className={`rounded-md border p-3 flex items-start gap-3 ${bg} ${border}`}>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${bg} ${text} border ${border} flex-shrink-0`}>{level}</span>
                        <div>
                          <p className={`text-sm font-medium ${text}`}>{range} probability</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "Quick Start" && (
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Start Guide</CardTitle>
                  <p className="text-sm text-muted-foreground">Get running in under 10 minutes</p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Section title="1. Install Dependencies">
                    <CodeBlock code={`# Create virtual environment
python -m venv venv

# Activate (Linux/macOS)
source venv/bin/activate

# Activate (Windows)
venv\\Scripts\\activate.bat

# Install requirements
pip install -r python/requirements_full.txt`} />
                  </Section>
                  <Section title="2. Train Models">
                    <CodeBlock code={`cd python
python train_models.py \\
  --data nizam_sample_training_data.csv \\
  --output models/ \\
  --n-estimators 300 \\
  --save-report`} />
                    <p className="text-xs text-muted-foreground">Training takes ~30 seconds on a modern CPU.</p>
                  </Section>
                  <Section title="3. Run Demo Predictions">
                    <CodeBlock code={`python predict_demo_script.py`} />
                  </Section>
                  <Section title="4. Start the API Server">
                    <CodeBlock code={`uvicorn prediction_api:app --reload --port 8000
# API docs: http://localhost:8000/docs`} />
                  </Section>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "Python API" && (
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Python API Reference</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Section title="NizamPredictor (Unified Predictor)">
                    <CodeBlock code={`from xgboost_model import NizamPredictor

# Initialize and load all models
predictor = NizamPredictor(model_dir="models")
predictor.load_all()

# Single child prediction
result = predictor.predict({
    "child_name": "Amara Osei",
    "age_months": 18,
    "sex": "female",       # "male" or "female"
    "weight_kg": 8.2,
    "height_cm": 76.5,
    "muac_cm": 12.8,
})

# Access results
print(result.overall_risk)           # "high"
print(result.stunting_risk)          # "high"
print(result.stunting_probability)   # 0.72
print(result.haz)                    # -2.41

# Print formatted summary
result.print_summary()

# Batch prediction
children = [
    {"child_name": "Child 1", "age_months": 18, "sex": "female",
     "weight_kg": 8.2, "height_cm": 76.5, "muac_cm": 12.8},
]
results = predictor.batch_predict(children)`} language="python" />
                  </Section>
                  <Section title="NizamModel (Individual Model)">
                    <CodeBlock code={`from xgboost_model import NizamModel, ModelConfig

# Configure model
config = ModelConfig(
    n_estimators=300,
    max_depth=5,
    learning_rate=0.05,
)

# Train a single model
model = NizamModel(target="stunting", config=config)
metrics = model.train(df, target_column="is_stunted")

print(f"AUC-ROC: {metrics.auc_roc:.4f}")
print(f"F1:      {metrics.f1:.4f}")

# Save and load
model.save("models/")
model = NizamModel.load("stunting", "models/")`} language="python" />
                  </Section>
                  <Section title="WHO Z-Score Computation">
                    <CodeBlock code={`from xgboost_model import compute_anthropometric_indices

z_scores = compute_anthropometric_indices(
    age_months=18,
    sex="female",
    weight_kg=8.2,
    height_cm=76.5,
    muac_cm=12.8,
)
# Returns:
# {"haz": -2.41, "waz": -1.87, "whz": -0.94, "muacz": -1.15}`} language="python" />
                  </Section>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "REST API" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">REST API Reference</CardTitle>
                  <p className="text-sm text-muted-foreground">Base URL: http://localhost:8000</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ApiEndpoint
                    method="GET"
                    path="/health"
                    description="Check API health and model status"
                    response={`{
  "status": "healthy",
  "version": "1.0.0",
  "models_loaded": true,
  "uptime_seconds": 3600,
  "total_predictions": 142
}`}
                  />
                  <ApiEndpoint
                    method="POST"
                    path="/predict"
                    description="Predict malnutrition risk for a single child"
                    request={`{
  "child_name": "Amara Osei",
  "age_months": 18,
  "sex": "female",
  "weight_kg": 8.2,
  "height_cm": 76.5,
  "muac_cm": 12.8,
  "region": "Central"
}`}
                    response={`{
  "child_name": "Amara Osei",
  "stunting_risk": "high",
  "stunting_probability": 0.72,
  "wasting_risk": "moderate",
  "wasting_probability": 0.38,
  "underweight_risk": "high",
  "underweight_probability": 0.65,
  "overall_risk": "high",
  "haz": -2.41,
  "waz": -1.87
}`}
                  />
                  <ApiEndpoint
                    method="POST"
                    path="/predict/batch"
                    description="Predict for multiple children (up to 500)"
                    request={`{
  "children": [
    {"child_name": "Child 1", "age_months": 18, "sex": "female",
     "weight_kg": 8.2, "height_cm": 76.5, "muac_cm": 12.8},
    {"child_name": "Child 2", "age_months": 24, "sex": "male",
     "weight_kg": 11.5, "height_cm": 86.0, "muac_cm": 14.5}
  ]
}`}
                    response={`{
  "total": 2,
  "predictions": [...],
  "summary": {"low": 1, "moderate": 0, "high": 1, "critical": 0},
  "high_risk_children": ["Child 1"]
}`}
                  />
                  <ApiEndpoint
                    method="GET"
                    path="/models/info"
                    description="Get loaded model information and performance metrics"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "Database" && (
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Database Schema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Section title="Setup">
                    <CodeBlock code={`# Create database
psql -U postgres -c "CREATE DATABASE nizam;"

# Run schema
psql -U postgres -d nizam -f schema.sql`} />
                  </Section>
                  <Section title="Tables">
                    <div className="space-y-2">
                      {[
                        { table: "children", desc: "Child demographic and identity information" },
                        { table: "measurements", desc: "Physical measurements at each assessment" },
                        { table: "predictions", desc: "ML model predictions and risk classifications" },
                        { table: "models", desc: "Trained model versions and metrics" },
                        { table: "interventions", desc: "Recommended interventions and follow-ups" },
                        { table: "facilities", desc: "Health facilities using the system" },
                      ].map(({ table, desc }) => (
                        <div key={table} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30 border border-border">
                          <Database className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div>
                            <p className="text-sm font-mono font-medium text-foreground">{table}</p>
                            <p className="text-xs text-muted-foreground">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                  <Section title="Useful Queries">
                    <CodeBlock code={`-- All critical cases
SELECT child_name, overall_risk FROM predictions
WHERE overall_risk = 'critical';

-- Regional statistics
SELECT region, COUNT(*), AVG(stunting_probability)
FROM predictions
GROUP BY region
ORDER BY AVG(stunting_probability) DESC;

-- Risk distribution
SELECT overall_risk, COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS pct
FROM predictions GROUP BY overall_risk;`} language="sql" />
                  </Section>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "Commands" && (
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Commands Reference</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Section title="Training">
                    <CodeBlock code={`# Train all models (default)
python train_models.py --data nizam_sample_training_data.csv

# Train specific model
python train_models.py --target stunting
python train_models.py --target wasting
python train_models.py --target underweight

# Full options
python train_models.py \\
  --data nizam_sample_training_data.csv \\
  --output models/ \\
  --n-estimators 300 \\
  --max-depth 5 \\
  --learning-rate 0.05 \\
  --cv-folds 5 \\
  --save-report --verbose`} />
                  </Section>
                  <Section title="Prediction">
                    <CodeBlock code={`# Demo batch (7 children)
python predict_demo_script.py

# Single child
python predict_demo_script.py \\
  --child-name "Amara" \\
  --age 18 --sex female \\
  --weight 8.2 --height 76.5 --muac 12.8

# Save to JSON
python predict_demo_script.py --output-json results.json`} />
                  </Section>
                  <Section title="API Server">
                    <CodeBlock code={`# Development
uvicorn prediction_api:app --reload --port 8000

# Production
uvicorn prediction_api:app \\
  --host 0.0.0.0 --port 8000 --workers 4

# With environment variables
NIZAM_MODEL_DIR=models NIZAM_PORT=8080 \\
  uvicorn prediction_api:app`} />
                  </Section>
                  <Section title="Quick Pipeline">
                    <CodeBlock code={`# Full pipeline in one command
cd python && \\
  python train_models.py --data nizam_sample_training_data.csv && \\
  python predict_demo_script.py && \\
  uvicorn prediction_api:app --port 8000`} />
                  </Section>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
