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
  addPrediction(data: { childName: string; ageMonths: number; sex: string; weightKg: number; heightCm: number; muacCm: number; region: string }): Promise<Prediction>;
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
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const newUser: User = { ...user as any, id };
    this.users.set(id, newUser);
    return newUser;
  }

  async authenticateUser(username: string, password: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(u => u.username === username);
    if (!user) return null;
    if (user.password !== password) return null;
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
    if (search) preds = preds.filter(p => p.childName.toLowerCase().includes(search.toLowerCase()));
    if (status) preds = preds.filter(p => p.overallRisk.toLowerCase().includes(status.toLowerCase()));
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
    return Array.from(this.users.values()).map(u => ({ ...u, password: undefined } as any));
  }

  updateUserRole(id: number, role: string): User {
    const user = Array.from(this.users.values()).find(u => u.id === String(id));
    if (!user) throw new Error('User not found');
    user.role = role as any;
    return user;
  }

  addPrediction(data: { childName: string; ageMonths: number; sex: string; weightKg: number; heightCm: number; muacCm: number; region: string }): Prediction {
    const id = randomUUID();
    const bmi = (data.weightKg / ((data.heightCm / 100) ** 2));
    const overallRisk = bmi < 15.5 ? 'critical' : bmi < 16.5 ? 'high' : bmi < 17.5 ? 'moderate' : 'low';
    const stuntingRisk = 'low';
    const wastingRisk = 'low';
    const underweightRisk = 'low';
    const prediction: Prediction = {
      id,
      childName: data.childName,
      ageMonths: data.ageMonths,
      sex: data.sex,
      weightKg: data.weightKg,
      heightCm: data.heightCm,
      muacCm: data.muacCm,
      region: data.region,
      stuntingRisk,
      wastingRisk,
      underweightRisk,
      overallRisk,
      notes: null,
      createdAt: new Date()
    } as Prediction;
    this.predictions.set(id, prediction);
    return prediction;
  }
}
