import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { predictionInputSchema, type UserRole } from "@shared/schema";
import { z } from "zod";
import https from "https";
import http from "http";
import bcrypt from "bcrypt";
import session from "express-session";
import { randomUUID } from "crypto";

// Session configuration
const SESSION_SECRET = process.env.SESSION_SECRET || "system-predictor-dev-secret-change-in-prod";
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";
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
  48: { male: 16.3, female: 16.1 },
  60: { male: 18.4, female: 18.2 },
};

// Health check API
async function checkPythonAPI(): Promise<{ healthy: boolean; responseTimeMs: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = http.get(`${PYTHON_API_URL}/health`, { timeout: PYTHON_API_TIMEOUT }, (res) => {
      resolve({ healthy: res.statusCode === 200, responseTimeMs: Date.now() - start });
    });
    req.on("error", () => resolve({ healthy: false, responseTimeMs: Date.now() - start }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ healthy: false, responseTimeMs: Date.now() - start });
    });
  });
}

function interpolate(ageMonths: number, sex: string, medianTable: Record<number, Record<string, number>>): number {
  const ages = Object.keys(medianTable).map(Number).sort((a, b) => a - b);
  if (ageMonths <= ages[0]) return medianTable[ages[0]][sex];
  if (ageMonths >= ages[ages.length - 1]) return medianTable[ages[ages.length - 1]][sex];
  for (let i = 0; i < ages.length - 1; i++) {
    if (ageMonths >= ages[i] && ageMonths <= ages[i + 1]) {
      const low = medianTable[ages[i]][sex];
      const high = medianTable[ages[i + 1]][sex];
      return low + (high - low) * ((ageMonths - ages[i]) / (ages[i + 1] - ages[i]));
    }
  }
  return medianTable[ages[0]][sex];
}

export function createRoutes(app: Express, server: Server): void {
  // Session middleware
  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
  }));

  // Parse JSON body
  app.use(express.json());

  // RBAC: Role requirement middleware
  function requireAuth(requiredRole?: UserRole) {
    return (req: Request, res: Response, next: NextFunction) => {
      const sess = req.session as any;
      if (!sess || !sess.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (requiredRole && sess.role !== requiredRole) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    };
  }

  // Public health check
  app.get("/health", async (_req: Request, res: Response) => {
    const pythonHealth = await checkPythonAPI();
    res.json({ status: "ok", python_api_healthy: pythonHealth.healthy, response_time_ms: pythonHealth.responseTimeMs });
  });
  // Auth routes (public)
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ username, password: hashedPassword, role: (role as UserRole) || "health_worker" });
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const user = await storage.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const sess = req.session as any;
    sess.userId = user.id;
    sess.username = user.username;
    sess.role = user.role;
    res.json({ id: user.id, username: user.username, role: user.role });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    const sess = req.session as any;
    if (!sess || !sess.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json({ id: sess.userId, username: sess.username, role: sess.role });
  });
  // Health Worker Protected Routes
  app.get("/api/health/dashboard", requireAuth("health_worker"), async (req: Request, res: Response) => {
    try {
      const stats = await storage.getStats();
      const pythonHealth = await checkPythonAPI();
      const recentPredictions = await storage.getRecentPredictions(50);
      res.json({
        ...stats,
        python_api_healthy: pythonHealth.healthy,
        recent_predictions: recentPredictions
      });
    } catch (e) {
      res.status(500).json({ error: "Dashboard data unavailable" });
    }
  });

  app.get("/api/health/predictions", requireAuth("health_worker"), async (req: Request, res: Response) => {
    try {
      const { page, limit, search, status, region } = req.query;
      const predictions = await storage.getPredictions(Number(page), Number(limit), search as string, status as string, region as string);
      res.json(predictions);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch predictions" });
    }
  });

  app.get("/api/health/export", requireAuth("health_worker"), async (req: Request, res: Response) => {
    try {
      const { format, status, region } = req.query;
      const data = await storage.getPredictions(1, 10000, undefined, status as string, region as string);
      if ((format as string) === "json") {
        return res.json(data);
      }
      const csv = "ID,Name,Date,Age,Sex,Weight,Height,MUAC,BMI,OverallRisk,StuntingRisk,WastingRisk\n" +
        data.predictions.map((p: any) =>
          `${p.id},${p.childName},${p.createdAt},${p.ageMonths},${p.sex},${p.weightKg},${p.heightCm},${p.muacCm},${p.bmi},${p.overallRisk},${p.stuntingRisk},${p.wastingRisk}`
        ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=\"predictions.csv\"");
      res.send(csv);
    } catch (e) {
      res.status(500).json({ error: "Export failed" });
    }
  });
  app.post("/api/health/predictions", requireAuth("health_worker"), async (req: Request, res: Response) => {
    const { childName, ageMonths, sex, weightKg, heightCm, muacCm, region } = req.body;
    if (!childName || ageMonths === undefined || !sex || weightKg === undefined || heightCm === undefined) {
      return res.status(400).json({ error: "Missing required child data" });
    }
    try {
      const result = await storage.addPrediction({
        childName,
        ageMonths: Number(ageMonths),
        sex,
        weightKg: Number(weightKg),
        heightCm: Number(heightCm),
        muacCm: Number(muacCm),
        region: region || "Unknown"
      });
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: "Failed to add prediction" });
    }
  });
}
