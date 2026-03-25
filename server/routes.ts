import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { predictionInputSchema } from "@shared/schema";
import { z } from "zod";
import https from "https";
import http from "http";

// Configuration for Python FastAPI backend
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8001";
const PYTHON_API_TIMEOUT = parseInt(process.env.PYTHON_API_TIMEOUT || "30000");
const FALLBACK_SIMULATION = process.env.FALLBACK_SIMULATION !== "false";

// WHO reference data for z-score approximation (fallback)
const WHO_HAZ_MEDIAN: Record<number, Record<string, number>> = {
  0: { male: 49.9, female: 49.1 },
  6: { male: 67.6, female: 65.7 },
  12: { male: 75.7, female: 74.0 },
  18: { male: 82.3, female: 80.7 },
  24: { male: 87.8, female: 86.4 },
  36: { male: 96.1, female: 95.1 },
  48: { male: 103.3, female: 102.7 },
  60: { male: 110.0, female: 109.4 },
};

const WHO_WAZ_MEDIAN: Record<number, Record<string, number>> = {
  0: { male: 3.35, female: 3.23 },
  6: { male: 7.93, female: 7.30 },
  12: { male: 9.65, female: 8.95 },
  18: { male: 10.9, female: 10.2 },
  24: { male: 12.2, female: 11.5 },
  36: { male: 14.3, female: 13.9 },
  48: { male: 16.3, female: 15.9 },
  60: { male: 18.3, female: 17.7 },
};

function interpolate(
  table: Record<number, Record<string, number>>,
  ageMonths: number,
  sex: string
): number {
  const ages = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  const lower = Math.max(...ages.filter((a) => a <= ageMonths));
  const upper = Math.min(...ages.filter((a) => a >= ageMonths));
  if (lower === upper) return table[lower][sex];
  const t = (ageMonths - lower) / (upper - lower);
  return table[lower][sex] + t * (table[upper][sex] - table[lower][sex]);
}

// Fallback z-score simulation (when Python API is unavailable)
function simulatePrediction(input: {
  weight_kg?: number;
  height_cm?: number;
  muac_cm?: number;
  age_months: number;
  sex: string;
  region?: string;
}): {
  stunting_risk: string;
  wasting_risk: string;
  underweight_risk: string;
  overall_risk: string;
  stunting_score: number;
  wasting_score: number;
  underweight_score: number;
  overall_score: number;
  z_scores: {
    haz: number;
    waz: number;
    whz?: number;
  };
  simulation: boolean;
} {
  const haz_median = interpolate(WHO_HAZ_MEDIAN, input.age_months, input.sex);
  const waz_median = interpolate(WHO_WAZ_MEDIAN, input.age_months, input.sex);

  const haz = input.height_cm
    ? (input.height_cm - haz_median) / 2.5
    : -2.0;
  const waz = input.weight_kg
    ? (input.weight_kg - waz_median) / 1.2
    : -2.0;
  const whz =
    input.height_cm && input.weight_kg
      ? (input.weight_kg - waz_median) / 1.2
      : undefined;

  const stunting_score = Math.min(1, Math.max(0, -haz / 2));
  const wasting_score = Math.min(1, Math.max(0, -waz / 2));
  const underweight_score = Math.min(1, Math.max(0, (waz + haz) / 4));

  const overall_score =
    (stunting_score * 0.4 + wasting_score * 0.4 + underweight_score * 0.2);

  const risk = (score: number): string =>
    score >= 0.75 ? "critical" : score >= 0.5 ? "high" : score >= 0.25 ? "medium" : "low";

  return {
    stunting_risk: risk(stunting_score),
    wasting_risk: risk(wasting_score),
    underweight_risk: risk(underweight_score),
    overall_risk: risk(overall_score),
    stunting_score: Math.round(stunting_score * 100) / 100,
    wasting_score: Math.round(wasting_score * 100) / 100,
    underweight_score: Math.round(underweight_score * 100) / 100,
    overall_score: Math.round(overall_score * 100) / 100,
    z_scores: { haz: Math.round(haz * 100) / 100, waz: Math.round(waz * 100) / 100, whz: whz ? Math.round(whz * 100) / 100 : undefined },
    simulation: true,
  };
}

// Client function to call Python FastAPI
async function callPythonAPI<T>(
  endpoint: string,
  method: string = "GET",
  body?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, PYTHON_API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 8001,
      path: url.pathname + url.search,
      method: method,
      timeout: PYTHON_API_TIMEOUT,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };

    const protocol = url.protocol === "https:" ? https : http;
    const req = protocol.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          resolve(data as T);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Python API timeout"));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Health check with Python API status
async function checkPythonAPI(): Promise<{ healthy: boolean; response_time_ms: number }> {
  const start = Date.now();
  try {
    const result = await callPythonAPI<{ status: string }>("/health");
    return { healthy: result.status === "healthy", response_time_ms: Date.now() - start };
  } catch {
    return { healthy: false, response_time_ms: Date.now() - start };
  }
}

// Main app setup
export function registerRoutes(app: Express, server: Server) {
  app.use("/api/predict", async (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Powered-By", "Nizam-Predictor");
    next();
  });

  // Enhanced prediction endpoint - proxies to Python FastAPI
  app.post("/api/predict/enhanced", async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const parsed = predictionInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parsed.error.issues,
        });
      }

      const input = parsed.data;

      // Try Python FastAPI first
      if (FALLBACK_SIMULATION) {
        try {
          const pythonPayload = {
            weight_kg: input.weight_kg,
            height_cm: input.height_cm,
            muac_cm: input.muac_cm,
            age_months: input.age_months,
            sex: input.sex,
            region: input.region || "general",
            clinical_notes: input.clinical_notes || "",
            language: input.language || "ar",
          };

          const prediction = await callPythonAPI<any>(
            "/predict/enhanced",
            "POST",
            pythonPayload
          );

          const mlPrediction = prediction.ml_prediction || {};
          const enhancedResponse = {
            prediction_id: prediction.prediction_id || `pred_${Date.now()}`,
            ml_prediction: {
              stunting_risk: mlPrediction.stunting_risk || "low",
              wasting_risk: mlPrediction.wasting_risk || "low",
              underweight_risk: mlPrediction.underweight_risk || "low",
              overall_risk: mlPrediction.overall_risk || "low",
              stunting_score: mlPrediction.stunting_score || 0,
              wasting_score: mlPrediction.wasting_score || 0,
              underweight_score: mlPrediction.underweight_score || 0,
              overall_score: mlPrediction.overall_score || 0,
              prediction_method: mlPrediction.prediction_method || "xgboost",
            },
            medical_entities: prediction.medical_entities || [],
            entity_summary: prediction.entity_summary || "",
            scientific_evidence: prediction.scientific_evidence || [],
            evidence_summary: prediction.evidence_summary || "",
            treatment_plan: prediction.treatment_plan || {},
            risk_summary: prediction.risk_summary || "",
            confidence: prediction.confidence || 0,
            language: input.language || "ar",
            processing_time_ms: prediction.processing_time_ms || Date.now() - start,
            simulation: false,
          };

          return res.json(enhancedResponse);
        } catch (pythonError: any) {
          console.warn("Python API unavailable, falling back to simulation:", pythonError.message);
        }
      }

      // Fallback to z-score simulation
      const simulated = simulatePrediction({
        weight_kg: input.weight_kg,
        height_cm: input.height_cm,
        muac_cm: input.muac_cm,
        age_months: input.age_months,
        sex: input.sex,
        region: input.region,
      });

      const fallbackResponse = {
        prediction_id: `sim_${Date.now()}`,
        ml_prediction: simulated,
        medical_entities: [],
        entity_summary: "",
        scientific_evidence: [],
        evidence_summary: "",
        treatment_plan: { immediate_actions: [], nutritional_interventions: [], medical_interventions: [], follow_up: [], prevention: [] },
        risk_summary: "تنبؤ بالمحاكاة - النظام الذكي غير متاح",
        confidence: simulated.overall_score,
        language: input.language || "ar",
        processing_time_ms: Date.now() - start,
        simulation: true,
      };

      return res.json(fallbackResponse);
    } catch (error: any) {
      console.error("Prediction error:", error);
      return res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  // System health check - includes Python API status
  app.get("/api/health", async (_req: Request, res: Response) => {
    const [pythonHealth, dbStatus] = await Promise.all([
      checkPythonAPI(),
      storage.getStats().then(() => ({ healthy: true })).catch(() => ({ healthy: false })),
    ]);

    res.json({
      status: pythonHealth.healthy ? "healthy" : "degraded",
      components: {
        node_server: true,
        python_api: pythonHealth.healthy,
        database: dbStatus.healthy,
      },
      python_api_response_time_ms: pythonHealth.response_time_ms,
      python_api_url: PYTHON_API_URL,
      fallback_simulation_enabled: FALLBACK_SIMULATION,
      timestamp: new Date().toISOString(),
    });
  });

  // Proxy to Python FastAPI guidelines endpoint
  app.get("/api/guidelines", async (_req: Request, res: Response) => {
    try {
      const guidelines = await callPythonAPI<any>("/guidelines");
      return res.json(guidelines);
    } catch {
      return res.json({ guidelines: [], protocols: [], micronutrients: [] });
    }
  });

  // Proxy to Python FastAPI entity types endpoint
  app.get("/api/entities/types", async (_req: Request, res: Response) => {
    try {
      const entityTypes = await callPythonAPI<any>("/entities/types");
      return res.json(entityTypes);
    } catch {
      return res.json({ english: [], arabic: [] });
    }
  });

  // Text analysis endpoint - proxies to BioBERT
  app.post("/api/analyze/text", async (req: Request, res: Response) => {
    const { text, language } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }
    try {
      const url = new URL("/analyze/text", PYTHON_API_URL);
      url.searchParams.append("text", text);
      if (language) url.searchParams.append("language", language);

      const result = await callPythonAPI<any>(url.pathname + url.search);
      return res.json(result);
    } catch {
      return res.json({ entities: [], summary: "BioBERT غير متاح" });
    }
  });

  // Text classification endpoint - proxies to BioBERT
  app.post("/api/classify/text", async (req: Request, res: Response) => {
    const { text, language } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }
    try {
      const url = new URL("/classify/text", PYTHON_API_URL);
      url.searchParams.append("text", text);
      if (language) url.searchParams.append("language", language);

      const result = await callPythonAPI<any>(url.pathname + url.search);
      return res.json(result);
    } catch {
      return res.json({ classification: "unknown", confidence: 0 });
    }
  });

  // Batch prediction endpoint - proxies to Python
  app.post("/api/predict/batch", async (req: Request, res: Response) => {
    const { children } = req.body;
    if (!Array.isArray(children) || children.length === 0) {
      return res.status(400).json({ error: "Children array is required" });
    }

    try {
      const results = await callPythonAPI<any[]>("/predict/enhanced/batch", "POST", children);
      return res.json({ results, count: results.length });
    } catch (error: any) {
      console.warn("Batch Python API failed, falling back:", error.message);
      // Fallback: process individually with simulation
      const simulated = children.map((c: any) => simulatePrediction({
        weight_kg: c.weight_kg,
        height_cm: c.height_cm,
        muac_cm: c.muac_cm,
        age_months: c.age_months,
        sex: c.sex,
        region: c.region,
      }));
      return res.json({ results: simulated, count: simulated.length, simulation: true });
    }
  });

  // Statistics endpoint - returns DB stats
  app.get("/api/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getStats();
      const pythonHealth = await checkPythonAPI();
      return res.json({
        ...stats,
        python_api_healthy: pythonHealth.healthy,
        server_started: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.json({ total_predictions: 0, python_api_healthy: false, error: error.message });
    }
  });

  // Legacy /predict endpoint for backward compatibility
  app.post("/api/predict", async (req: Request, res: Response) => {
    // Validate and redirect to enhanced endpoint
    const parsed = predictionInputSchema.safeParse(req.body);
    if (!parsed.success) {
          // For backward compatibility, call the same handler as /predict/enhanced
    // This is a simpler wrapper without the full enhanced features
    const fallback = simulatePrediction(parsed.data);
    return res.json({
      prediction_id: `legacy_${Date.now()}`,
      ml_prediction: fallback,
      simulation: true,
      language: parsed.data.language || "ar",
    });

// Helper for internal use - simulates prediction without HTTP
export const simulatePredictionHelper = simulatePrediction;
    }

    // Call enhanced internally
    const enhancedReq = { body: parsed.data } as Request;
      // Note: Legacy endpoint - use /api/predict/enhanced for new implementations
  });
}
