import { type User, type InsertUser, type Prediction, type InsertPrediction } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  authenticateUser(username: string, password: string): Promise<User | null>;
  getStats(): Promise<{ total: number; critical: number; high: number; moderate: number; low: number; stuntingCount: number; wastingCount: number; underweightCount: number }>;
  getRecentPredictions(limit: number): Promise<Prediction[]>;
  getPredictions(page: number, limit: number, search?: string, status?: string, region?: string): Promise<{ predictions: Prediction[]; total: number; page: number; pages: number }>;
  listUsers(): Promise<User[]>;
  updateUserRole(id: number, role: string): Promise<User>;
  addPrediction(data: { child_name: string; age_months: number; sex: string; weight_kg: number; height_cm: number; muac_cm: number; region: string }): Promise<Prediction>;
}

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

  async authenticateUser(username: string, password: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.username === username);
    if (!user) return null;
    // In development, compare plain text. In production, use bcrypt.compare(password, user.password_hash)
    if (user.password_hash !== password) return null;
    return user;
  }

  getStats() {
    const preds = Array.from(this.predictions.values());
    return {
      total: preds.length,
      critical: preds.filter(p => p.overallRisk === 'critical').length,
      high: preds.filter(p => p.overallRisk === 'high').length,
      moderate: preds.filter(p => p.overallRisk === 'moderate').length,
      low: preds.filter(p => p.overallRisk === 'low').length,
      stuntingCount: preds.filter(p => p.stuntingRisk === 'high' || p.stuntingRisk === 'critical').length,
      wastingCount: preds.filter(p => p.wastingRisk === 'high' || p.wastingRisk === 'critical').length,
      underweightCount: preds.filter(p => p.underweightRisk === 'high' || p.underweightRisk === 'critical').length
    };
  }

  async getRecentPredictions(limit: number): Promise<Prediction[]> {
    return Array.from(this.predictions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, limit);
  }

  getPredictions(page: number, limit: number, search?: string, status?: string, region?: string) {
    let preds = Array.from(this.predictions.values());
    if (search) preds = preds.filter(p => p.child_name.toLowerCase().includes(search.toLowerCase()));
    if (status) preds = preds.filter(p => p.malnutrition_status === status);
    if (region) preds = preds.filter(p => p.region.toLowerCase().includes(region.toLowerCase()));
    const total = preds.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginated = preds.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(start, start + limit);
    return { predictions: paginated, total, page, pages };
  }

  listUsers(): User[] {
    return Array.from(this.users.values()).map(u => ({ ...u, password_hash: undefined } as any));
  }

  updateUserRole(id: number, role: string): User {
    const user = Array.from(this.users.values()).find(u => u.id === id);
    if (!user) throw new Error('User not found');
    user.role = role as any;
    return user;
  }

  addPrediction(data: { child_name: string; age_months: number; sex: string; weight_kg: number; height_cm: number; muac_cm: number; region: string }): Prediction {
    const id = randomUUID();
    const bmi = (data.weight_kg / ((data.height_cm / 100) ** 2));
    const prediction: Prediction = {
      id,
      child_name: data.child_name,
      age_months: data.age_months,
      sex: data.sex,
      weight_kg: data.weight_kg,
      height_cm: data.height_cm,
      muac_cm: data.muac_cm,
      bmi,
      malnutrition_status: bmi < 15.5 ? 'severe_acute' : bmi < 16.5 ? 'moderate_acute' : bmi < 17.5 ? 'mild_acute' : 'normal',
      stuntingRisk: 'low',
      wastingRisk: 'low',
      underweightRisk: 'low',
      overallRisk: bmi < 15.5 ? 'critical' : bmi < 16.5 ? 'high' : bmi < 17.5 ? 'moderate' : 'low',
      notes: null,
      region: data.region,
      createdAt: new Date()
    };
    this.predictions.set(id, prediction);
    return prediction;
  }
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
