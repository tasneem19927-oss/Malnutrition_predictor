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
import { type UserRole, registerSchema } from "@shared/schema";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "system-predictor-dev-secret-change-in-prod";
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8001";
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

async function checkPythonAPI() {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = http.get(`${PYTHON_API_URL}/health`, { timeout: 2000 }, (res) => {
      resolve({ healthy: res.statusCode === 200, responseTimeMs: Date.now() - start });
    });
    req.on("error", () => resolve({ healthy: false, responseTimeMs: Date.now() - start }));
    req.on("timeout", () => { req.destroy(); resolve({ healthy: false, responseTimeMs: Date.now() - start }); });
  });
}

function sanitizeUser(user: any): SessionUser {
  return {
    id: String(user.id),
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.user) return next();
  res.status(401).json({ error: "Unauthorized" });
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.user?.role === "admin") return next();
  res.status(403).json({ error: "Forbidden" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 1000 * 60 * 60 * 24 },
    }),
  );
  app.use(express.json());

  app.post("/api/auth/register", asyncHandler(async (req, res) => {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0].message });
    }
    const { username, email, password, fullName, role } = result.data;

    const existingUser = await storage.getUserByEmail(email) || await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "المستخدم موجود بالفعل" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await storage.createUser({
      username,
      email,
      password: hashedPassword,
      fullName,
      role,
    });

    const sessionUser = sanitizeUser(user);
    req.session.user = sessionUser;
    res.json(sessionUser);
  }));

  app.post("/api/auth/login", asyncHandler(async (req, res) => {
    const { identifier, password } = req.body;
    const loginValue = String(identifier || "").trim();
    const passwordValue = String(password || "");

    if (loginValue.toLowerCase() === ADMIN_EMAIL.toLowerCase() && passwordValue === ADMIN_PASSWORD) {
      const adminUser: SessionUser = {
        id: "admin-system",
        username: "tasneem",
        email: ADMIN_EMAIL,
        fullName: "Tasneem Omar",
        role: "admin",
      };
      req.session.user = adminUser;
      return res.json(adminUser);
    }

    const user = loginValue.includes("@") 
      ? await storage.getUserByEmail(loginValue)
      : await storage.getUserByUsername(loginValue);

    if (!user || !(await bcrypt.compare(passwordValue, user.password))) {
      return res.status(401).json({ error: "بيانات الاعتماد غير صالحة" });
    }

    const sessionUser = sanitizeUser(user);
    req.session.user = sessionUser;
    res.json(sessionUser);
  }));

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    res.json(req.session.user);
  });

  // Protected API routes
  app.get("/api/predictions", requireAuth, asyncHandler(async (req, res) => {
    const data = await storage.getPredictions(1, 50);
    res.json(data.predictions);
  }));

  app.get("/api/predictions/stats", requireAuth, asyncHandler(async (req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  }));

  app.post("/api/predictions/enhanced", requireAuth, asyncHandler(async (req, res) => {
    const python = await checkPythonAPI() as any;
    if (!python.healthy) return res.status(503).json({ error: "خدمة التنبؤ غير متوفرة" });
    
    const response = await fetch(`${PYTHON_API_URL}/predict/enhanced`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  }));

  app.get("/api/admin/users", requireAdmin, asyncHandler(async (req, res) => {
    const users = await storage.listUsers();
    res.json(users);
  }));

  return createServer(app);
}
