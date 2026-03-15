import { type User, type InsertUser, type Prediction, type InsertPrediction } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getPredictions(): Promise<Prediction[]>;
  getPrediction(id: string): Promise<Prediction | undefined>;
  createPrediction(data: InsertPrediction): Promise<Prediction>;
  deletePrediction(id: string): Promise<boolean>;
  getPredictionStats(): Promise<{
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    stuntingCount: number;
    wastingCount: number;
    underweightCount: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private predictions: Map<string, Prediction>;

  constructor() {
    this.users = new Map();
    this.predictions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getPredictions(): Promise<Prediction[]> {
    return Array.from(this.predictions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getPrediction(id: string): Promise<Prediction | undefined> {
    return this.predictions.get(id);
  }

  async createPrediction(data: InsertPrediction): Promise<Prediction> {
    const id = randomUUID();
    const prediction: Prediction = {
      ...data,
      id,
      createdAt: new Date(),
      notes: data.notes ?? null,
      region: data.region ?? "Unknown",
    };
    this.predictions.set(id, prediction);
    return prediction;
  }

  async deletePrediction(id: string): Promise<boolean> {
    return this.predictions.delete(id);
  }

  async getPredictionStats() {
    const preds = Array.from(this.predictions.values());
    return {
      total: preds.length,
      critical: preds.filter(p => p.overallRisk === "critical").length,
      high: preds.filter(p => p.overallRisk === "high").length,
      moderate: preds.filter(p => p.overallRisk === "moderate").length,
      low: preds.filter(p => p.overallRisk === "low").length,
      stuntingCount: preds.filter(p => p.stuntingRisk === "high" || p.stuntingRisk === "critical").length,
      wastingCount: preds.filter(p => p.wastingRisk === "high" || p.wastingRisk === "critical").length,
      underweightCount: preds.filter(p => p.underweightRisk === "high" || p.underweightRisk === "critical").length,
    };
  }
}

export const storage = new MemStorage();
