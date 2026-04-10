import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// Role-Based Access Control
// ============================================
export type UserRole = "admin" | "health_worker" | "doctor";

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    "view_statistics",
    "manage_users",
    "view_records",
    "create_records",
    "review_cases",
    "write_recommendations",
    "export_data",
    "view_dashboard",
  ],
  health_worker: [
    "create_records",
    "view_records",
    "export_data",
    "view_dashboard",
  ],
  doctor: [
    "view_records",
    "review_cases",
    "write_recommendations",
    "view_dashboard",
  ],
};

export const USERS_DEFAULT_ADMIN = {
  username: "admin",
  password: "admin",
  role: "admin" as UserRole,
};

// ============================================
// Users Table
// ============================================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: varchar("role", { length: 30 }).notNull().default("health_worker").$type<UserRole>(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================
// Sessions Table (for persistent login)
// ============================================
export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// ============================================
// Predictions Table
// ============================================
export const predictions = pgTable("predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  childName: text("child_name").notNull(),
  ageMonths: integer("age_months").notNull(),
  sex: text("sex").notNull(),
  weightKg: real("weight_kg").notNull(),
  heightCm: real("height_cm").notNull(),
  muacCm: real("muac_cm").notNull(),
  region: text("region").notNull().default("Unknown"),
  stuntingRisk: text("stunting_risk").notNull(),
  wastingRisk: text("wasting_risk").notNull(),
  underweightRisk: text("underweight_risk").notNull(),
  stuntingProb: real("stunting_prob").notNull(),
  wastingProb: real("wasting_prob").notNull(),
  underweightProb: real("underweight_prob").notNull(),
  overallRisk: text("overall_risk").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPredictionSchema = createInsertSchema(predictions).omit({
  id: true,
  createdAt: true,
});

export const predictionInputSchema = z.object({
  childName: z.string().min(1, "Child name is required"),
  ageMonths: z.number().int().min(0).max(60, "Age must be 0-60 months"),
  sex: z.enum(["male", "female"]),
  weightKg: z.number().min(0.5).max(30, "Weight must be 0.5-30 kg"),
  heightCm: z.number().min(30).max(130, "Height must be 30-130 cm"),
  muacCm: z.number().min(6).max(25, "MUAC must be 6-25 cm"),
  region: z.string().min(1, "Region is required"),
  notes: z.string().optional(),
});

export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictions.$inferSelect;

// ============================================
// Enhanced Prediction (Clinical RAG)
// ============================================
export const clinicalRAGSummarySchema = z.object({
  priority_condition: z.string().nullable().optional(),
  summary: z.string(),
  rationale: z.string(),
  red_flags: z.array(z.string()),
  suggested_action: z.string(),
  citations: z.array(z.string()),
  evidence: z.array(z.object({
    chunk_id: z.string(),
    title: z.string(),
    source: z.string(),
    source_type: z.string(),
    year: z.number(),
    url: z.string(),
    topic: z.string(),
    severity: z.string(),
    population: z.string(),
    excerpt: z.string(),
  })),
  generated_at: z.string(),
});

export const evidenceBundleItemSchema = z.object({
  chunk_id: z.string(),
  title: z.string(),
  source: z.string(),
  source_type: z.string(),
  year: z.number(),
  url: z.string(),
  topic: z.string(),
  severity: z.string(),
  population: z.string(),
  excerpt: z.string(),
});

export type ClinicalRAGSummary = z.infer<typeof clinicalRAGSummarySchema>;
export type EvidenceBundleItem = z.infer<typeof evidenceBundleItemSchema>;
export type PredictionInput = z.infer<typeof predictionInputSchema>;
