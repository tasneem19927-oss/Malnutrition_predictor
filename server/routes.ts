import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { predictionInputSchema } from "@shared/schema";
import { z } from "zod";
import https from "https";
import http from "http";
import bcrypt from "bcrypt";
import session from "express-session";
import { randomUUID } from "crypto";

// Configuration for Python FastAPI backend
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";
const PYTHON_API_TIMEOUT = parseInt(process.env.PYTHON_API_TIMEOUT || "30000");
const FALLBACK_SIMULATION = process.env.FALLBACK_SIMULATION !== "false";
const SESSION_SECRET = process.env.SESSION_SECRET || "nizam-predictor-dev-secret-change-in-prod";

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
  const ages = Object.keys(table).map(Number).sort((a, b) => a - b);
  const lower = Math.max(...ages.filter((a) => a <= ageMonths));
  const upper = Math.min(...ages.filter((a) => a >= ageMonths));
  if (lower === upper) return table[lower][sex];
  const t = (ageMonths - lower) / (upper - lower);
  return table[lower][sex] + t * (table[upper][sex] - table[lower][sex]);
}

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
  z_scores: { haz: number; waz: number; whz: number | null };
  simulation: boolean;
} {
  const haz_median = interpolate(WHO_HAZ_MEDIAN, input.age_months, input.sex);
  const waz_median = interpolate(WHO_WAZ_MEDIAN, input.age_months, input.sex);
  const haz = input.height_cm ? (input.height_cm - haz_median) / 2.5 : -2.0;
  const waz = input.weight_kg ? (input.weight_kg - waz_median) / 1.2 : -2.0;
  const whz = input.height_cm && input.weight_kg ? (input.weight_kg - waz_median) / 1.2 : null;
  const stunting_score = Math.min(1, Math.max(0, -haz / 2));
  const wasting_score = Math.min(1, Math.max(0, -waz / 2));
  const underweight_score = Math.min(1, Math.max(0, (waz + haz) / 4));
  const overall_score = stunting_score * 0.4 + wasting_score * 0.4 + underweight_score * 0.2;
  const risk = (score: number): string =>
    score >= 0.75 ? "critical" : score >= 0.5 ? "high" : score >= 0.25 ? "moderate" : "low";
  return {
    stunting_risk: risk(stunting_score),
    wasting_risk: risk(wasting_score),
    underweight_risk: risk(underweight_score),
    overall_risk: risk(overall_score),
    stunting_score: Math.round(stunting_score * 100) / 100,
    wasting_score: Math.round(wasting_score * 100) / 100,
    underweight_score: Math.round(underweight_score * 100) / 100,
    overall_score: Math.round(overall_score * 100) / 100,
    z_scores: {
      haz: Math.round(haz * 100) / 100,
      waz: Math.round(waz * 100) / 100,
      whz: whz ? Math.round(whz * 100) / 100 : null,
    },
    simulation: true,
  };
}

async function callPythonAPI<T>(endpoint: string, method: string = "GET", body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, PYTHON_API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 8000,
      path: url.pathname + url.search,
      method: method,
      timeout: PYTHON_API_TIMEOUT,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
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
    req.on("timeout", () => { req.destroy(); reject(new Error("Python API timeout")); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

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
  // Session middleware
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  // Auth middleware - attach user to request if logged in
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if ((req.session as any).userId) {
      try {
        const user = await storage.getUser((req.session as any).userId);
        if (user) (req as any).user = user;
      } catch {}
    }
    next();
  });

  app.use("/api/predict", (req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Powered-By", "Nizam-Predictor");
    next();
  });

  // Enhanced prediction endpoint
  app.post("/api/predict/enhanced", async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const parsed = predictionInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      }
      const input = req.body;
      if (FALLBACK_SIMULATION) {
        try {
          const pythonPayload = {
            child_name: input.childName,
            age_months: input.ageMonths,
            sex: input.sex,
            weight_kg: input.weightKg,
            height_cm: input.heightCm,
            muac_cm: input.muacCm,
            region: input.region || "general",
            notes: input.notes || "",
          };
          const prediction = await callPythonAPI<any>("/predict/enhanced", "POST", pythonPayload);
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
            treatment_plan: prediction.treatment_plan || { immediate_actions: [], nutritional_interventions: [], medical_interventions: [] },
            risk_summary: prediction.risk_summary || "",
            confidence: prediction.confidence || 0,
            language: input.notes || "ar",
            processing_time_ms: prediction.processing_time_ms || Date.now() - start,
            simulation: false,
          };
          return res.json(enhancedResponse);
        } catch (e: any) {
          console.warn("Python API unavailable:", e.message);
        }
      }
      const simulated = simulatePrediction({
        weight_kg: input.weightKg,
        height_cm: input.heightCm,
        muac_cm: input.muacCm,
        age_months: input.ageMonths,
        sex: input.sex,
        region: input.region,
      });
      return res.json({
        prediction_id: `sim_${Date.now()}`,
        ml_prediction: simulated,
        medical_entities: [],
        entity_summary: "",
        scientific_evidence: [],
        evidence_summary: "",
        treatment_plan: { immediate_actions: [], nutritional_interventions: [], medical_interventions: [] },
        risk_summary: "نظام غير متاح - تنبؤ بالمحاكاة",
        confidence: simulated.overall_score,
        language: input.notes || "ar",
        processing_time_ms: Date.now() - start,
        simulation: true,
      });
    } catch (e: any) {
      return res.status(500).json({ error: "Internal server error", details: e.message });
    }
  });

  // System health check
  app.get("/api/health", async (_req: Request, res: Response) => {
    const [pythonHealth, dbStatus] = await Promise.all([
      checkPythonAPI(),
      storage.getStats().then(() => ({ healthy: true })).catch(() => ({ healthy: false })),
    ]);
    res.json({
      status: pythonHealth.healthy ? "healthy" : "degraded",
      components: { node_server: true, python_api: pythonHealth.healthy, database: dbStatus.healthy },
      python_api_response_time_ms: pythonHealth.response_time_ms,
      python_api_url: PYTHON_API_URL,
      fallback_simulation_enabled: FALLBACK_SIMULATION,
      timestamp: new Date().toISOString(),
    });
  });

  // Proxy to Python FastAPI guidelines
  app.get("/api/guidelines", async (_req: Request, res: Response) => {
    try {
      const guidelines = await callPythonAPI<any>("/guidelines");
      return res.json(guidelines);
    } catch { return res.json({ guidelines: [], protocols: [], micronutrients: [] }); }
  });

  // Proxy to Python entity types
  app.get("/api/entities/types", async (_req: Request, res: Response) => {
    try {
      const entityTypes = await callPythonAPI<any>("/entities/types");
      return res.json(entityTypes);
    } catch { return res.json({ english: [], arabic: [] }); }
  });

  // Text analysis endpoint
  app.post("/api/analyze/text", async (req: Request, res: Response) => {
    const { text, language } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    try {
      const url = new URL("/analyze/text", PYTHON_API_URL);
      url.searchParams.append("text", text);
      if (language) url.searchParams.append("language", language);
      const result = await callPythonAPI<any>(url.pathname + url.search);
      return res.json(result);
    } catch { return res.json({ entities: [], summary: "BioBERT غير متاح" }); }
  });

  // Text classification endpoint
  app.post("/api/classify/text", async (req: Request, res: Response) => {
    const { text, language } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });
    try {
      const url = new URL("/classify/text", PYTHON_API_URL);
      url.searchParams.append("text", text);
      if (language) url.searchParams.append("language", language);
      const result = await callPythonAPI<any>(url.pathname + url.search);
      return res.json(result);
    } catch { return res.json({ classification: "unknown", confidence: 0 }); }
  });

  // Batch prediction
  app.post("/api/predict/batch", async (req: Request, res: Response) => {
    const { children } = req.body;
    if (!Array.isArray(children) || children.length === 0) {
      return res.status(400).json({ error: "Children array is required" });
    }
    try {
      const results = await callPythonAPI<any[]>("/predict/batch", "POST", children);
      return res.json({ results, count: results.length });
    } catch (e: any) {
      console.warn("Batch Python API failed:", e.message);
      const simulated = children.map((c: any) => simulatePrediction({
        weight_kg: c.weight_kg, height_cm: c.height_cm, muac_cm: c.muac_cm,
        age_months: c.age_months, sex: c.sex, region: c.region,
      }));
      return res.json({ results: simulated, count: simulated.length, simulation: true });
    }
  });

  // Statistics endpoint
  app.get("/api/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getStats();
      const pythonHealth = await checkPythonAPI();
      return res.json({ ...stats, python_api_healthy: pythonHealth.healthy, server_started: new Date().toISOString() });
    } catch (e: any) {
      return res.json({ total_predictions: 0, python_api_healthy: false, error: e.message });
    }
  });

// ========= Authentication Routes =========

// Session store (in-memory)
interface Session {
  id: string;
  userId: number;
  username: string;
  role: 'admin' | 'health' | 'doctor';
  createdAt: number;
}

const sessions = new Map<string, Session>();

// Session middleware
function getSession(req: Request): Session | null {
  const sessionId = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

// Auth required middleware factory
function requireAuth(requiredRole?: 'admin' | 'health' | 'doctor') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized - Login required' });
    }
    (req as any).user = session;
    if (requiredRole && session.role !== requiredRole && session.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }
    next();
  };
}

// Register
app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { username, email, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['admin', 'health', 'doctor'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    const user = await storage.createUser({ username, password, role });
    return res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Registration failed', details: (e as Error).message });
  }
});

// Login
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const user = await storage.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const sessionId = randomUUID();
    const session: Session = {
      id: sessionId,
      userId: user.id,
      username: user.username,
      role: user.role,
      createdAt: Date.now()
    };
    sessions.set(sessionId, session);
    return res.status(200).json({
      message: 'Login successful',
      session: { id: sessionId, username: user.username, role: user.role },
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Login failed', details: (e as Error).message });
  }
});

// Logout
app.post("/api/auth/logout", async (req: Request, res: Response) => {
  const sessionId = req.headers.get('authorization')?.replace('Bearer ', '');
  if (sessionId) {
    sessions.delete(sessionId);
  }
  return res.status(200).json({ message: 'Logged out successfully' });
});

// Get current user
app.get("/api/auth/me", async (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.status(200).json({
    user: { id: session.userId, username: session.username, role: session.role }
  });
});

// ========= Admin Protected Routes =========

// Admin: List all users
app.get("/api/admin/users", requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const users = await storage.listUsers();
    return res.json({ users, count: users.length });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list users', details: (e as Error).message });
  }
});

// Admin: Update user role
app.patch("/api/admin/users/:id/role", requireAuth('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!role || !['admin', 'health', 'doctor'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    const updated = await storage.updateUserRole(Number(id), role);
    return res.json({ message: 'Role updated', user: updated });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update role', details: (e as Error).message });
  }
});

// Admin: Dashboard stats
app.get("/api/admin/dashboard", requireAuth('admin'), async (req: Request, res: Response) => {
  try {
    const stats = await storage.getStats();
    const pythonHealth = await checkPythonAPI();
    const users = await storage.listUsers();
    return res.json({
      ...stats,
      python_api_healthy: pythonHealth.healthy,
      total_users: users.length,
      user_stats: {
        admin: users.filter(u => u.role === 'admin').length,
        health: users.filter(u => u.role === 'health').length,
        doctor: users.filter(u => u.role === 'doctor').length
      }
    });
  } catch (e) {
    return res.status(500).json({ error: 'Dashboard data unavailable', details: (e as Error).message });
  }
});

// ========= Health Worker Protected Routes =========

// Health: Get dashboard data
app.get("/api/health/dashboard", requireAuth('health'), async (req: Request, res: Response) => {
  try {
    const stats = await storage.getStats();
    const pythonHealth = await checkPythonAPI();
    const recentPredictions = await storage.getRecentPredictions(50);
    return res.json({
      ...stats,
      python_api_healthy: pythonHealth.healthy,
      recent_predictions: recentPredictions
    });
  } catch (e) {
    return res.status(500).json({ error: 'Dashboard data unavailable', details: (e as Error).message });
  }
});

// Health: Get all predictions
app.get("/api/health/predictions", requireAuth('health'), async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', search, status, region } = req.query as any;
    const predictions = await storage.getPredictions(Number(page), Number(limit), search, status, region);
    return res.json(predictions);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch predictions', details: (e as Error).message });
  }
});

// Health: Export predictions
app.get("/api/health/export", requireAuth('health'), async (req: Request, res: Response) => {
  try {
    const { format = 'csv', status, region } = req.query as any;
    const data = await storage.getPredictions(1, 10000, undefined, status, region);
    if (format === 'json') {
      return res.json(data);
    }
    const csv = 'ID,Name,Date,Age,Sex,Weight,Height,MUAC,BMI,OverallRisk,StuntingRisk,WastingRisk,UnderweightRisk,Region\n' +
      data.predictions.map((p: any) =>
        `${p.id},${p.childName},${p.createdAt},${p.ageMonths},${p.sex},${p.weightKg},${p.heightCm},${p.muacCm},${(p.weightKg / ((p.heightCm / 100) ** 2)).toFixed(2)},${p.overallRisk},${p.stuntingRisk},${p.wastingRisk},${p.underweightRisk},${p.region}`
      ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="predictions.csv"');
    return res.send(csv);
  } catch (e) {
    return res.status(500).json({ error: 'Export failed', details: (e as Error).message });
  }
});

// Health: Add new prediction (data entry)
app.post("/api/health/predictions", requireAuth('health'), async (req: Request, res: Response) => {
  const { childName, ageMonths, sex, weightKg, heightCm, muacCm, region } = req.body;
  if (!childName || ageMonths === undefined || !sex || weightKg === undefined || heightCm === undefined || muacCm === undefined) {
    return res.status(400).json({ error: 'Missing required child data' });
  }
  try {
    const result = await storage.addPrediction({
      childName,
      ageMonths: Number(ageMonths),
      sex,
      weightKg: Number(weightKg),
      heightCm: Number(heightCm),
      muacCm: Number(muacCm),
      region: region || 'Unknown'
    });
    return res.status(201).json(result);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to add prediction', details: (e as Error).message });
  }
});

  // ========= End of Routes =========
}
