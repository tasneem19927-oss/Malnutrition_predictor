import { type User, type InsertUser, type Prediction, type InsertPrediction, type UserRole } from "@shared/schema";
import { randomUUID } from "crypto";

// ============================================
// IStorage Interface
// ============================================
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  authenticateUser(username: string, password: string): Promise<User | null>;
  getStats(): Promise<{ total: number; critical: number; high: number; moderate: number; low: number; stuntingCount: number; wastingCount: number; underweightCount: number }>;
  getRecentPredictions(limit: number): Promise<Prediction[]>;
  getPredictions(page: number, limit: number, search?: string, status?: string, region?: string): Promise<{ predictions: Prediction[]; total: number; page: number; pages: number }>;
  listUsers(): Promise<User[]>;
  updateUserRole(id: number, role: UserRole): Promise<User>;
  addPrediction(data: { childName: string; ageMonths: number; sex: string; weightKg: number; heightCm: number; muacCm: number; region: string }): Promise<Prediction>;
}

// ============================================
// MemStorage (In-Memory - for fallback/testing)
// ============================================
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

  async getStats() {
    const preds = Array.from(this.predictions.values());
    return {
      total: preds.length,
      critical: preds.filter(p => p.overallRisk === 'critical').length,
      high: preds.filter(p => p.overallRisk === 'high').length,
      moderate: preds.filter(p => p.overallRisk === 'moderate').length,
      low: preds.filter(p => p.overallRisk === 'low').length,
      stuntingCount: preds.filter(p => p.stuntingRisk === 'high' || p.stuntingRisk === 'critical').length,
      wastingCount: preds.filter(p => p.wastingRisk === 'high' || p.wastingRisk === 'critical').length,
      underweightCount: preds.filter(p => p.underweightRisk === 'high' || p.underweightRisk === 'critical').length,
    };
  }

  async getRecentPredictions(limit: number): Promise<Prediction[]> {
    return Array.from(this.predictions.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async getPredictions(page: number, limit: number, search?: string, status?: string, region?: string) {
    let preds = Array.from(this.predictions.values());
    if (search) preds = preds.filter(p => p.childName.toLowerCase().includes(search.toLowerCase()));
    if (status) preds = preds.filter(p => p.overallRisk.toLowerCase().includes(status.toLowerCase()));
    if (region) preds = preds.filter(p => p.region.toLowerCase().includes(region.toLowerCase()));
    const total = preds.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginated = preds
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(start, start + limit);
    return { predictions: paginated, total, page, pages };
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values()).map(u => ({ ...u, password: undefined } as any));
  }

  async updateUserRole(id: number, role: UserRole): Promise<User> {
    const user = Array.from(this.users.values()).find(u => u.id === String(id));
    if (!user) throw new Error('User not found');
    user.role = role;
    return user;
  }

  async addPrediction(data: { childName: string; ageMonths: number; sex: string; weightKg: number; heightCm: number; muacCm: number; region: string }): Promise<Prediction> {
    const id = randomUUID();
    const bmi = (data.weightKg / ((data.heightCm / 100) ** 2));
    const overallRisk = bmi < 15.5 ? 'critical' : bmi < 16.5 ? 'high' : bmi < 17.5 ? 'moderate' : 'low';
    const prediction: Prediction = {
      id,
      childName: data.childName,
      ageMonths: data.ageMonths,
      sex: data.sex,
      weightKg: data.weightKg,
      heightCm: data.heightCm,
      muacCm: data.muacCm,
      region: data.region,
      stuntingRisk: 'low',
      wastingRisk: 'low',
      underweightRisk: 'low',
      stuntingProb: 0,
      wastingProb: 0,
      underweightProb: 0,
      overallRisk,
      notes: null,
      createdAt: new Date(),
    } as Prediction;
    this.predictions.set(id, prediction);
    return prediction;
  }
}

// ============================================
// DatabaseStorage (PostgreSQL via Drizzle ORM)
// ============================================
export class DatabaseStorage implements IStorage {
  private db: any;
  private schema: any;

  constructor() {
    // Lazy import to avoid issues if DATABASE_URL not set during testing
    const { db } = require('./db');
    const schema = require('@shared/schema');
    this.db = db;
    this.schema = schema;
  }

  async getUser(id: string): Promise<User | undefined> {
    const { eq } = await import('drizzle-orm');
    const result = await this.db
      .select()
      .from(this.schema.users)
      .where(eq(this.schema.users.id, id))
      .limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { eq } = await import('drizzle-orm');
    const result = await this.db
      .select()
      .from(this.schema.users)
      .where(eq(this.schema.users.username, username))
      .limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await this.db
      .insert(this.schema.users)
      .values(user)
      .returning();
    return result[0];
  }

  async authenticateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    if (user.password !== password) return null;
    return user;
  }

  async getStats() {
    const { sql } = await import('drizzle-orm');
    const preds = await this.db.select().from(this.schema.predictions);
    return {
      total: preds.length,
      critical: preds.filter((p: any) => p.overallRisk === 'critical').length,
      high: preds.filter((p: any) => p.overallRisk === 'high').length,
      moderate: preds.filter((p: any) => p.overallRisk === 'moderate').length,
      low: preds.filter((p: any) => p.overallRisk === 'low').length,
      stuntingCount: preds.filter((p: any) => p.stuntingRisk === 'high' || p.stuntingRisk === 'critical').length,
      wastingCount: preds.filter((p: any) => p.wastingRisk === 'high' || p.wastingRisk === 'critical').length,
      underweightCount: preds.filter((p: any) => p.underweightRisk === 'high' || p.underweightRisk === 'critical').length,
    };
  }

  async getRecentPredictions(limit: number): Promise<Prediction[]> {
    const { desc } = await import('drizzle-orm');
    return await this.db
      .select()
      .from(this.schema.predictions)
      .orderBy(desc(this.schema.predictions.createdAt))
      .limit(limit);
  }

  async getPredictions(page: number, limit: number, search?: string, status?: string, region?: string) {
    const { desc, ilike, eq, and } = await import('drizzle-orm');
    const conditions: any[] = [];
    if (search) conditions.push(ilike(this.schema.predictions.childName, `%${search}%`));
    if (status) conditions.push(eq(this.schema.predictions.overallRisk, status));
    if (region) conditions.push(ilike(this.schema.predictions.region, `%${region}%`));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allPreds = await this.db
      .select()
      .from(this.schema.predictions)
      .where(whereClause)
      .orderBy(desc(this.schema.predictions.createdAt));

    const total = allPreds.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginated = allPreds.slice(start, start + limit);

    return { predictions: paginated, total, page, pages };
  }

  async listUsers(): Promise<User[]> {
    const users = await this.db.select().from(this.schema.users);
    return users.map((u: any) => ({ ...u, password: undefined }));
  }

  async updateUserRole(id: number, role: UserRole): Promise<User> {
    const { eq } = await import('drizzle-orm');
    const result = await this.db
      .update(this.schema.users)
      .set({ role })
      .where(eq(this.schema.users.id, String(id)))
      .returning();
    if (!result[0]) throw new Error('User not found');
    return result[0];
  }

  async addPrediction(data: { childName: string; ageMonths: number; sex: string; weightKg: number; heightCm: number; muacCm: number; region: string }): Promise<Prediction> {
    const id = randomUUID();
    const bmi = data.weightKg / ((data.heightCm / 100) ** 2);
    const overallRisk = bmi < 15.5 ? 'critical' : bmi < 16.5 ? 'high' : bmi < 17.5 ? 'moderate' : 'low';
    const result = await this.db
      .insert(this.schema.predictions)
      .values({
        id,
        childName: data.childName,
        ageMonths: data.ageMonths,
        sex: data.sex,
        weightKg: data.weightKg,
        heightCm: data.heightCm,
        muacCm: data.muacCm,
        region: data.region,
        stuntingRisk: 'low',
        wastingRisk: 'low',
        underweightRisk: 'low',
        stuntingProb: 0,
        wastingProb: 0,
        underweightProb: 0,
        overallRisk,
        notes: null,
      })
      .returning();
    return result[0];
  }
}

// ============================================
// Export active storage instance
// Use DatabaseStorage if DATABASE_URL is set, else MemStorage
// ============================================
export const storage: IStorage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemStorage();
