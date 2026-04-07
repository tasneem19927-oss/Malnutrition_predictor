import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createServer, type Server } from "http";
import http from "http";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { type UserRole } from "@shared/schema";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "system-predictor-dev-secret-change-in-prod";
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";
const PYTHON_API_TIMEOUT = parseInt(
  process.env.PYTHON_API_TIMEOUT || "30000",
  10,
);

const ADMIN_EMAIL = "tasneem1992.7@gmail.com";
const ADMIN_PASSWORD = "Aa123456Zz";

type SessionUser = {
  id: string;
  email: string;
  username: string;
  role: UserRole | string;
  fullName?: string;
};

type PythonPredictionMetric = {
  probability?: number;
  percentage?: number;
  status?: string;
  severity?: string;
  risk?: "low" | "moderate" | "high" | "critical";
  label?: string;
  category?: string;
  classification?: string;
};

type PythonPredictionResponse = {
  childName?: string;
  ageMonths?: number;
  sex?: string;
  weightKg?: number;
  heightCm?: number;
  muacCm?: number;
  predictedAt?: string;

  stunting?: PythonPredictionMetric;
  wasting?: PythonPredictionMetric;
  underweight?: PythonPredictionMetric;

  stuntingProbability?: number;
  wastingProbability?: number;
  underweightProbability?: number;

  stuntingRisk?: string;
  wastingRisk?: string;
  underweightRisk?: string;

  stuntingStatus?: string;
  wastingStatus?: string;
  underweightStatus?: string;

  stuntingSeverity?: string;
  wastingSeverity?: string;
  underweightSeverity?: string;

  overallRisk?: "low" | "moderate" | "high" | "critical";
  clinicalRagSummary?: unknown;
  evidenceBundle?: unknown[];
  safetyNotice?: string;
  [key: string]: unknown;
};

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

async function checkPythonAPI(): Promise<{
  healthy: boolean;
  responseTimeMs: number;
}> {
  const start = Date.now();

  return new Promise((resolve) => {
    const req = http.get(
      `${PYTHON_API_URL}/health`,
      { timeout: PYTHON_API_TIMEOUT },
      (res) => {
        resolve({
          healthy: res.statusCode === 200,
          responseTimeMs: Date.now() - start,
        });
      },
    );

    req.on("error", () =>
      resolve({
        healthy: false,
        responseTimeMs: Date.now() - start,
      }),
    );

    req.on("timeout", () => {
      req.destroy();
      resolve({
        healthy: false,
        responseTimeMs: Date.now() - start,
      });
    });
  });
}

function toPercentage(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value <= 1) return Math.round(value * 100);
  return Math.round(value);
}

function normalizeRisk(
  value?: string,
): "low" | "moderate" | "high" | "critical" {
  const v = (value || "").toLowerCase().trim();

  if (["critical", "acute", "emergency", "very_high"].includes(v)) {
    return "critical";
  }

  if (["high", "severe", "serious"].includes(v)) {
    return "high";
  }

  if (["moderate", "medium"].includes(v)) {
    return "moderate";
  }

  return "low";
}

function normalizeStatus(value?: string, fallbackRisk?: string) {
  const v = (value || "").toLowerCase().trim();

  if (v) {
    if (["sam", "acute", "acute_malnutrition"].includes(v)) return "acute";
    if (["severe", "severely_malnourished"].includes(v)) return "severe";
    if (["moderate", "mam"].includes(v)) return "moderate";
    if (["normal", "healthy", "none", "low"].includes(v)) return "normal";
    return v;
  }

  const risk = normalizeRisk(fallbackRisk);
  if (risk === "critical") return "acute";
  if (risk === "high") return "severe";
  if (risk === "moderate") return "moderate";
  return "normal";
}

function normalizeSeverity(status?: string, risk?: string) {
  const s = normalizeStatus(status, risk);

  if (s === "acute") return "acute";
  if (s === "severe") return "severe";
  if (s === "moderate") return "moderate";
  return "normal";
}

function metricFromAny(
  directMetric: PythonPredictionMetric | undefined,
  probability?: number,
  risk?: string,
  status?: string,
  severity?: string,
) {
  const rawProbability =
    typeof directMetric?.probability === "number"
      ? directMetric.probability
      : typeof directMetric?.percentage === "number"
        ? directMetric.percentage > 1
          ? directMetric.percentage / 100
          : directMetric.percentage
        : typeof probability === "number"
          ? probability
          : 0;

  const percentage =
    typeof directMetric?.percentage === "number"
      ? toPercentage(directMetric.percentage)
      : toPercentage(rawProbability);

  const finalRisk = normalizeRisk(directMetric?.risk || risk);
  const finalStatus = normalizeStatus(
    directMetric?.status ||
      directMetric?.label ||
      directMetric?.category ||
      directMetric?.classification ||
      status,
    finalRisk,
  );
  const finalSeverity = normalizeSeverity(
    directMetric?.severity || severity || finalStatus,
    finalRisk,
  );

  return {
    probability: rawProbability <= 1 ? rawProbability : rawProbability / 100,
    percentage,
    status: finalStatus,
    severity: finalSeverity,
    risk: finalRisk,
  };
}

function getOverallRisk(metrics: Array<{ risk: string }>) {
  if (metrics.some((m) => m.risk === "critical")) return "critical";
  if (metrics.some((m) => m.risk === "high")) return "high";
  if (metrics.some((m) => m.risk === "moderate")) return "moderate";
  return "low";
}

function sanitizeUser(user: any) {
  if (!user) return null;

  return {
    id: String(user.id ?? ""),
    username: user.username ?? "",
    email: user.email ?? "",
    fullName: user.fullName ?? user.name ?? "",
    role: user.role ?? "viewer",
  };
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.user) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized" });
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  return next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 1000 * 60 * 60 * 24,
      },
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get(
    "/api/health",
    asyncHandler(async (_req, res) => {
      const python = await checkPythonAPI();

      res.json({
        ok: true,
        server: "healthy",
        pythonApi: python,
        timestamp: new Date().toISOString(),
      });
    }),
  );

  app.post(
    "/api/auth/login",
    asyncHandler(async (req, res) => {
      const { username, email, identifier, password } = req.body ?? {};

      const loginValue = String(identifier || email || username || "").trim();
      const loginLower = loginValue.toLowerCase();
      const passwordValue = String(password || "");

      if (!loginValue || !passwordValue) {
        return res.status(400).json({
          error: "Email/username and password are required",
        });
      }

      const isAdminEmail = loginLower === ADMIN_EMAIL.toLowerCase();
      const isAdminUsername =
        loginLower === "admin" || loginLower === "tasneem";
      const isAdminPassword = passwordValue === ADMIN_PASSWORD;

      if ((isAdminEmail || isAdminUsername) && isAdminPassword) {
        const adminUser = {
          id: "admin-local",
          username: "admin",
          email: ADMIN_EMAIL,
          fullName: "Tasneem Omar",
          role: "admin" as UserRole,
        };

        req.session.user = adminUser;
        return res.json(adminUser);
      }

      let user: any = null;

      if (typeof storage.getUserByEmail === "function" && loginValue.includes("@")) {
        user = await storage.getUserByEmail(loginValue);
      }

      if (!user && typeof storage.getUserByUsername === "function") {
        user = await storage.getUserByUsername(loginValue);
      }

      if (!user && typeof storage.getUserByIdentifier === "function") {
        user = await storage.getUserByIdentifier(loginValue);
      }

      if (!user && typeof storage.getUser === "function" && !Number.isNaN(Number(loginValue))) {
        user = await storage.getUser(Number(loginValue));
      }

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const passwordHash = user.password || user.passwordHash;

      if (!passwordHash) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(passwordValue, passwordHash);

      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const sessionUser = sanitizeUser(user);
      req.session.user = sessionUser;

      return res.json(sessionUser);
    }),
  );

  app.post(
    "/api/auth/logout",
    asyncHandler(async (req, res) => {
      req.session.destroy(() => {
        res.json({ success: true });
      });
    }),
  );

  app.get(
    "/api/auth/me",
    asyncHandler(async (req, res) => {
      if (!req.session.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      return res.json(req.session.user);
    }),
  );

  app.get(
    "/api/admin/session",
    requireAdmin,
    asyncHandler(async (req, res) => {
      return res.json({
        authenticated: true,
        user: req.session.user,
      });
    }),
  );

  app.post(
    "/api/predictions/enhanced",
    requireAuth,
    asyncHandler(async (req, res) => {
      const pythonHealth = await checkPythonAPI();

      if (!pythonHealth.healthy) {
        return res.status(503).json({
          error: "Python prediction service is unavailable",
          pythonApi: pythonHealth,
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PYTHON_API_TIMEOUT);

      try {
        const response = await fetch(`${PYTHON_API_URL}/predict/enhanced`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(req.body),
          signal: controller.signal,
        });

        const raw = (await response.json()) as PythonPredictionResponse;

        if (!response.ok) {
          return res.status(response.status).json(raw);
        }

        const stunting = metricFromAny(
          raw.stunting,
          raw.stuntingProbability,
          raw.stuntingRisk,
          raw.stuntingStatus,
          raw.stuntingSeverity,
        );

        const wasting = metricFromAny(
          raw.wasting,
          raw.wastingProbability,
          raw.wastingRisk,
          raw.wastingStatus,
          raw.wastingSeverity,
        );

        const underweight = metricFromAny(
          raw.underweight,
          raw.underweightProbability,
          raw.underweightRisk,
          raw.underweightStatus,
          raw.underweightSeverity,
        );

        const result = {
          childName: String(raw.childName ?? req.body?.childName ?? ""),
          ageMonths: Number(raw.ageMonths ?? req.body?.ageMonths ?? 0),
          sex: String(raw.sex ?? req.body?.sex ?? ""),
          weightKg: Number(raw.weightKg ?? req.body?.weightKg ?? 0),
          heightCm: Number(raw.heightCm ?? req.body?.heightCm ?? 0),
          muacCm: Number(raw.muacCm ?? req.body?.muacCm ?? 0),
          stunting,
          wasting,
          underweight,
          overallRisk:
            raw.overallRisk || getOverallRisk([stunting, wasting, underweight]),
          clinicalRagSummary: raw.clinicalRagSummary,
          evidenceBundle: raw.evidenceBundle || [],
          safetyNotice:
            raw.safetyNotice ||
            "This result supports screening and should not replace clinical judgment.",
          predictedAt: String(raw.predictedAt || new Date().toISOString()),
        };

        return res.json(result);
      } catch (error: any) {
        if (error?.name === "AbortError") {
          return res.status(504).json({
            error: "Prediction request timed out",
          });
        }

        return res.status(500).json({
          error: "Failed to process enhanced prediction",
          details: error?.message || "Unknown server error",
        });
      } finally {
        clearTimeout(timeout);
      }
    }),
  );

  app.get(
    "/api/predictions",
    requireAuth,
    asyncHandler(async (_req, res) => {
      if (typeof storage.getPredictions === "function") {
        const data = await storage.getPredictions();
        return res.json(data);
      }

      return res.json([]);
    }),
  );

  app.get(
    "/api/predictions/stats",
    requireAuth,
    asyncHandler(async (_req, res) => {
      if (typeof storage.getPredictionStats === "function") {
        const stats = await storage.getPredictionStats();
        return res.json(stats);
      }

      return res.json({
        total: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
      });
    }),
  );

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Server error:", err);

    if (res.headersSent) return;

    res.status(err?.status || 500).json({
      error: err?.message || "Internal server error",
    });
  });

  return createServer(app);
}
