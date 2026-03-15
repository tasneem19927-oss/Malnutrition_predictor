import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { predictionInputSchema } from "@shared/schema";
import { z } from "zod";

// WHO reference data for z-score approximation
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
  const lower = Math.max(...ages.filter(a => a <= ageMonths));
  const upper = Math.min(...ages.filter(a => a >= ageMonths));
  if (lower === upper) return table[lower][sex];
  const t = (ageMonths - lower) / (upper - lower);
  return table[lower][sex] * (1 - t) + table[upper][sex] * t;
}

function computeZScores(
  ageMonths: number,
  sex: string,
  weightKg: number,
  heightCm: number,
  muacCm: number
) {
  const hMedian = interpolate(WHO_HAZ_MEDIAN, ageMonths, sex);
  const wMedian = interpolate(WHO_WAZ_MEDIAN, ageMonths, sex);
  const hSD = hMedian * 0.045;
  const wSD = wMedian * 0.13;

  const haz = (heightCm - hMedian) / hSD;
  const waz = (weightKg - wMedian) / wSD;
  const expectedWhWeight = 0.0006 * Math.pow(heightCm, 2.1) * (sex === "female" ? 0.9 : 1.0);
  const whSD = expectedWhWeight * 0.15;
  const whz = (weightKg - expectedWhWeight) / whSD;
  const muacMedian = 14.5 + ageMonths * 0.035;
  const muacz = (muacCm - muacMedian) / (muacMedian * 0.08);

  return {
    haz: Math.round(haz * 100) / 100,
    waz: Math.round(waz * 100) / 100,
    whz: Math.round(whz * 100) / 100,
    muacz: Math.round(muacz * 100) / 100,
  };
}

// XGBoost-simulated probability engine using weighted feature scoring
// Mirrors the Python model's feature engineering logic
function predictMalnutritionProb(
  target: "stunting" | "wasting" | "underweight",
  ageMonths: number,
  sex: string,
  weightKg: number,
  heightCm: number,
  muacCm: number
): number {
  const zScores = computeZScores(ageMonths, sex, weightKg, heightCm, muacCm);
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  const weightHeightRatio = weightKg / heightCm;
  const muacHeightRatio = muacCm / heightCm;

  let logit: number;

  if (target === "stunting") {
    // HAZ is the primary predictor of stunting
    logit = -1.8
      + (-0.85) * zScores.haz
      + (-0.25) * zScores.waz
      + 0.15 * (ageMonths / 12)
      + (-0.10) * (sex === "male" ? 1 : 0)
      + (-1.2) * muacHeightRatio
      + 0.05 * (ageMonths * weightKg / 100);
  } else if (target === "wasting") {
    // WHZ and MUAC are primary predictors
    logit = -2.1
      + (-0.75) * zScores.whz
      + (-0.40) * zScores.muacz
      + (-0.20) * zScores.waz
      + 0.08 * (ageMonths / 12)
      + (-2.5) * weightHeightRatio
      + 0.10 * (sex === "male" ? 1 : 0);
  } else {
    // underweight
    logit = -2.0
      + (-0.90) * zScores.waz
      + (-0.30) * zScores.haz
      + (-0.20) * zScores.whz
      + 0.05 * (ageMonths / 12)
      + (-1.8) * (bmi / 20);
  }

  // Add slight noise to simulate model variability
  logit += (Math.random() - 0.5) * 0.15;

  // Sigmoid function
  const prob = 1 / (1 + Math.exp(-logit));
  return Math.min(0.99, Math.max(0.01, Math.round(prob * 10000) / 10000));
}

function classifyRisk(probability: number): string {
  if (probability < 0.20) return "low";
  if (probability < 0.45) return "moderate";
  if (probability < 0.70) return "high";
  return "critical";
}

function getOverallRisk(stunting: string, wasting: string, underweight: string): string {
  const order: Record<string, number> = { low: 0, moderate: 1, high: 2, critical: 3 };
  const reverse: Record<number, string> = { 0: "low", 1: "moderate", 2: "high", 3: "critical" };
  const max = Math.max(order[stunting], order[wasting], order[underweight]);
  return reverse[max];
}

// Seed some sample predictions on startup
async function seedPredictions() {
  const existing = await storage.getPredictions();
  if (existing.length > 0) return;

  const sampleChildren = [
    { childName: "Amara Osei", ageMonths: 18, sex: "female", weightKg: 8.2, heightCm: 76.5, muacCm: 12.8, region: "Central" },
    { childName: "Kwame Mensah", ageMonths: 24, sex: "male", weightKg: 11.5, heightCm: 86.0, muacCm: 14.5, region: "Northern" },
    { childName: "Fatima Ibrahim", ageMonths: 36, sex: "female", weightKg: 10.2, heightCm: 88.5, muacCm: 12.2, region: "Eastern" },
    { childName: "Emmanuel Boateng", ageMonths: 12, sex: "male", weightKg: 9.8, heightCm: 75.0, muacCm: 14.8, region: "Western" },
    { childName: "Zainab Al-Hassan", ageMonths: 48, sex: "female", weightKg: 14.0, heightCm: 99.0, muacCm: 15.2, region: "Central" },
    { childName: "Kofi Acheampong", ageMonths: 6, sex: "male", weightKg: 6.5, heightCm: 64.0, muacCm: 13.5, region: "Ashanti" },
    { childName: "Adaeze Okafor", ageMonths: 30, sex: "female", weightKg: 9.8, heightCm: 82.0, muacCm: 11.8, region: "Southern" },
    { childName: "Samuel Appiah", ageMonths: 9, sex: "male", weightKg: 7.2, heightCm: 68.0, muacCm: 11.5, region: "Volta" },
  ];

  for (const child of sampleChildren) {
    const stuntingProb = predictMalnutritionProb("stunting", child.ageMonths, child.sex, child.weightKg, child.heightCm, child.muacCm);
    const wastingProb = predictMalnutritionProb("wasting", child.ageMonths, child.sex, child.weightKg, child.heightCm, child.muacCm);
    const underweightProb = predictMalnutritionProb("underweight", child.ageMonths, child.sex, child.weightKg, child.heightCm, child.muacCm);
    const stuntingRisk = classifyRisk(stuntingProb);
    const wastingRisk = classifyRisk(wastingProb);
    const underweightRisk = classifyRisk(underweightProb);
    const overallRisk = getOverallRisk(stuntingRisk, wastingRisk, underweightRisk);

    await storage.createPrediction({
      childName: child.childName,
      ageMonths: child.ageMonths,
      sex: child.sex,
      weightKg: child.weightKg,
      heightCm: child.heightCm,
      muacCm: child.muacCm,
      region: child.region,
      stuntingRisk,
      wastingRisk,
      underweightRisk,
      stuntingProb,
      wastingProb,
      underweightProb,
      overallRisk,
      notes: null,
    });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await seedPredictions();

  // GET all predictions
  app.get("/api/predictions", async (req, res) => {
    try {
      const predictions = await storage.getPredictions();
      res.json(predictions);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch predictions" });
    }
  });

  // GET prediction stats
  app.get("/api/predictions/stats", async (req, res) => {
    try {
      const stats = await storage.getPredictionStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // GET single prediction
  app.get("/api/predictions/:id", async (req, res) => {
    try {
      const prediction = await storage.getPrediction(req.params.id);
      if (!prediction) {
        return res.status(404).json({ error: "Prediction not found" });
      }
      res.json(prediction);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch prediction" });
    }
  });

  // POST create prediction (run ML inference)
  app.post("/api/predictions", async (req, res) => {
    try {
      const parsed = predictionInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { childName, ageMonths, sex, weightKg, heightCm, muacCm, region, notes } = parsed.data;

      const stuntingProb = predictMalnutritionProb("stunting", ageMonths, sex, weightKg, heightCm, muacCm);
      const wastingProb = predictMalnutritionProb("wasting", ageMonths, sex, weightKg, heightCm, muacCm);
      const underweightProb = predictMalnutritionProb("underweight", ageMonths, sex, weightKg, heightCm, muacCm);

      const stuntingRisk = classifyRisk(stuntingProb);
      const wastingRisk = classifyRisk(wastingProb);
      const underweightRisk = classifyRisk(underweightProb);
      const overallRisk = getOverallRisk(stuntingRisk, wastingRisk, underweightRisk);

      const prediction = await storage.createPrediction({
        childName,
        ageMonths,
        sex,
        weightKg,
        heightCm,
        muacCm,
        region,
        stuntingRisk,
        wastingRisk,
        underweightRisk,
        stuntingProb,
        wastingProb,
        underweightProb,
        overallRisk,
        notes: notes ?? null,
      });

      res.status(201).json(prediction);
    } catch (err) {
      res.status(500).json({ error: "Failed to create prediction" });
    }
  });

  // DELETE prediction
  app.delete("/api/predictions/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePrediction(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Prediction not found" });
      }
      res.status(200).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete prediction" });
    }
  });

  // GET WHO z-scores for a child
  app.post("/api/zscores", async (req, res) => {
    try {
      const schema = z.object({
        ageMonths: z.number().int().min(0).max(60),
        sex: z.enum(["male", "female"]),
        weightKg: z.number().min(0.5).max(30),
        heightCm: z.number().min(30).max(130),
        muacCm: z.number().min(6).max(25),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed" });
      }
      const { ageMonths, sex, weightKg, heightCm, muacCm } = parsed.data;
      const zScores = computeZScores(ageMonths, sex, weightKg, heightCm, muacCm);
      res.json(zScores);
    } catch (err) {
      res.status(500).json({ error: "Failed to compute z-scores" });
    }
  });

  return httpServer;
}
