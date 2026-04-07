import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { type UserRole } from "@shared/schema";
import http from "http";
import bcrypt from "bcrypt";
import session from "express-session";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "system-predictor-dev-secret-change-in-prod";

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";
const PYTHON_API_TIMEOUT = parseInt(process.env.PYTHON_API_TIMEOUT || "30000", 10);

const ADMIN_EMAIL = "tasneem1992.7@gmail.com";
const ADMIN_PASSWORD = "Aa123456Zz";

async function checkPythonAPI(): Promise<{ healthy: boolean; responseTimeMs: number }> {
  const start = Date.now();

  return new Promise((resolve) => {
    const req = http.get(`${PYTHON_API_URL}/health`, { timeout: PYTHON_API_TIMEOUT }, (res) => {
      resolve({
        healthy: res.statusCode === 200,
        responseTimeMs: Date.now() - start,
      });
    });

    req.on("error", () =>
      resolve({
        healthy: false,
        responseTimeMs: Date.now() - start,
      })
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

export function createRoutes(app: Express, _server: Server): void {
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(express.json());

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

  app.get("/health", async (_req: Request, res: Response) => {
    const pythonHealth = await checkPythonAPI();

    res.json({
      status: "ok",
      python_api_healthy: pythonHealth.healthy,
      response_time_ms: pythonHealth.responseTimeMs,
    });
  });

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
    const user = await storage.createUser({
      username,
      password: hashedPassword,
      role: (role as UserRole) || "health_worker",
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, email, password } = req.body;
    const loginId = email || username;

    if (!loginId || !password) {
      return res.status(400).json({ error: "Email/username and password required" });
    }

    if (loginId === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const sess = req.session as any;
      sess.userId = "admin-local";
      sess.username = ADMIN_EMAIL;
      sess.role = "admin";

      return res.json({
        id: "admin-local",
        username: ADMIN_EMAIL,
        role: "admin",
      });
    }

    const user = await storage.authenticateUser(loginId, password);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sess = req.session as any;
    sess.userId = user.id;
    sess.username = user.username;
    sess.role = user.role;

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }

      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    const sess = req.session as any;

    if (!sess || !sess.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    res.json({
      id: sess.userId,
      username: sess.username,
      role: sess.role,
    });
  });

  app.get("/api/health/dashboard", requireAuth(), async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getStats();
      const pythonHealth = await checkPythonAPI();
      const recentPredictions = await storage.getRecentPredictions(50);

      res.json({
        ...stats,
        python_api_healthy: pythonHealth.healthy,
        recent_predictions: recentPredictions,
      });
    } catch (e) {
      res.status(500).json({ error: "Dashboard data unavailable" });
    }
  });

  app.get("/api/health/predictions", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { page, limit, search, status, region } = req.query;

      const predictions = await storage.getPredictions(
        Number(page) || 1,
        Number(limit) || 10,
        search as string,
        status as string,
        region as string
      );

      res.json(predictions);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch predictions" });
    }
  });

  app.get("/api/health/export", requireAuth(), async (req: Request, res: Response) => {
    try {
      const { format, status, region } = req.query;

      const data = await storage.getPredictions(
        1,
        10000,
        undefined,
        status as string,
        region as string
      );

      if ((format as string) === "json") {
        return res.json(data);
      }

      const csv =
        "ID,Name,Date,Age,Sex,Weight,Height,MUAC,BMI,OverallRisk,StuntingRisk,WastingRisk\n" +
        data.predictions
          .map(
            (p: any) =>
              `${p.id},${p.childName},${p.createdAt},${p.ageMonths},${p.sex},${p.weightKg},${p.heightCm},${p.muacCm},${p.bmi},${p.overallRisk},${p.stuntingRisk},${p.wastingRisk}`
          )
          .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="predictions.csv"');
      res.send(csv);
    } catch (e) {
      res.status(500).json({ error: "Export failed" });
    }
  });

  app.post("/api/health/predictions", requireAuth(), async (req: Request, res: Response) => {
    const { childName, ageMonths, sex, weightKg, heightCm, muacCm, region } = req.body;

    if (
      !childName ||
      ageMonths === undefined ||
      !sex ||
      weightKg === undefined ||
      heightCm === undefined
    ) {
      return res.status(400).json({ error: "Missing required child data" });
    }

    try {
      const result = await storage.addPrediction({
        childName,
        ageMonths: Number(ageMonths),
        sex,
        weightKg: Number(weightKg),
        heightCm: Number(heightCm),
        muacCm: muacCm !== undefined ? Number(muacCm) : null,
        region: region || "Unknown",
      });

      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: "Failed to add prediction" });
    }
  });
}
