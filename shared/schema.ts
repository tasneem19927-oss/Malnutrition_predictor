import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
export type PredictionInput = z.infer<typeof predictionInputSchema>;
