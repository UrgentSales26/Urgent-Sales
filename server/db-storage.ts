import { 
  type User, type InsertUser, 
  type Property, type InsertProperty, 
  type Agent, type InsertAgent, 
  type Company, type InsertCompany, 
  type Inquiry, type InsertInquiry, 
  type AgentReview, type InsertAgentReview, 
  type Otp, type InsertOtp,
  type Booking, type InsertBooking,
  users, properties, agents, companies, inquiries, 
  agentReviews, propertyRecommendations, propertyViews, 
  savedProperties, otps, bookings
} from "@shared/schema.ts";
import { IStorage } from "./storage.ts";
import { db } from "./db.ts";
import { eq, and, desc, gte, lte, inArray, sql, or, like, exists, not, gt, isNotNull } from "drizzle-orm";
import session from "express-session";
import createPgSession from "connect-pg-simple";
import pkg from 'pg';
const { Pool } = pkg;
import { randomInt } from "crypto";
import dotenv from 'dotenv';

// Create PostgreSQL session store
const PgSessionStore = createPgSession(session);

export class DbStorage implements IStorage {
  sessionStore: any;

  constructor() {
    // Initialize session store with PostgreSQL
    this.sessionStore = new PgSessionStore({
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
      tableName: 'session', // Default table name
      createTableIfMissing: true,
    });
  }
  deleteProperty(id: number): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getTopProperties(category: string, location?: string, limit?: number): Promise<Property[]> {
    throw new Error("Method not implemented.");
  }
  getPropertyCities(): Promise<string[]> {
    throw new Error("Method not implemented.");
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async verifyUserEmail(id: number): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ emailVerified: true, verified: true })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async verifyUserPhone(id: number): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ phoneVerified: true, verified: true })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }
  
  async updateUserPassword(id: number, newPassword: string): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ password: newPassword })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  // OTP operations
  async createOtp(otp: InsertOtp): Promise<Otp> {
    const result = await db.insert(otps).values(otp).returning();
    return result[0];
  }

  async getOtp(id: number): Promise<Otp | undefined> {
    const result = await db.select().from(otps).where(eq(otps.id, id)).limit(1);
    return result[0];
  }

  async getOtpByUserAndType(userId: number, type: string): Promise<Otp | undefined> {
    const result = await db.select().from(otps)
      .where(
        and(
          eq(otps.userId, userId),
          eq(otps.type, type),
          eq(otps.verified, false),
          gte(otps.expiresAt, new Date())
        )
      )
      .orderBy(desc(otps.createdAt))
      .limit(1);
    return result[0];
  }

  async verifyOtp(userId: number, otpCode: string, type: string): Promise<boolean> {
    const otp = await db.select().from(otps)
      .where(
        and(
          eq(otps.userId, userId),
          eq(otps.type, type),
          eq(otps.otp, otpCode),
          eq(otps.verified, false),
          gte(otps.expiresAt, new Date())
        )
      )
      .limit(1);
    
    if (!otp[0]) return false;
    
    // Mark OTP as verified
    await db.update(otps)
      .set({ verified: true })
      .where(eq(otps.id, otp[0].id));
    
    // If this is an email or phone OTP, update user verification status
    if (type === "email") {
      await this.verifyUserEmail(userId);
    } else if (type === "sms" || type === "whatsapp") {
      await this.verifyUserPhone(userId);
    }
    
    return true;
  }

  async invalidateOtp(id: number): Promise<void> {
    await db.update(otps)
      .set({ verified: true })
      .where(eq(otps.id, id));
  }
  
  async getAllOtps(): Promise<Otp[]> {
    return await db.select().from(otps);
  }

  // Booking operations
  async createBooking(booking: InsertBooking): Promise<Booking> {
    // Generate a random 6-digit verification code
    const verificationCode = randomInt(100000, 999999).toString();
    
    const result = await db.insert(bookings)
      .values({ ...booking, verificationCode, isVerified: false })
      .returning();
    return result[0];
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const result = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    return result[0];
  }

  async getUserBookings(userId: number): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.userId, userId));
  }

  async getPropertyBookings(propertyId: number): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.propertyId, propertyId));
  }

  async getAgentBookings(agentId: number): Promise<Booking[]> {
    return await db.select().from(bookings).where(eq(bookings.agentId, agentId));
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking | undefined> {
    const result = await db.update(bookings)
      .set({ status })
      .where(eq(bookings.id, id))
      .returning();
    return result[0];
  }

  async verifyBooking(id: number, verificationCode: string): Promise<boolean> {
    const booking = await db.select().from(bookings)
      .where(
        and(
          eq(bookings.id, id),
          eq(bookings.verificationCode, verificationCode),
          eq(bookings.isVerified, false)
        )
      )
      .limit(1);
    
    if (!booking[0]) return false;
    
    await db.update(bookings)
      .set({ isVerified: true })
      .where(eq(bookings.id, id));
    
    return true;
  }

  // Agent operations
  async getAgent(id: number): Promise<Agent | undefined> {
    const result = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    return result[0];
  }

  async getAgentByUserId(userId: number): Promise<Agent | undefined> {
    const result = await db.select().from(agents).where(eq(agents.userId, userId)).limit(1);
    return result[0];
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const result = await db.insert(agents).values(agent).returning();
    return result[0];
  }

  async updateAgent(id: number, agentData: Partial<Agent>): Promise<Agent | undefined> {
    const result = await db.update(agents)
      .set(agentData)
      .where(eq(agents.id, id))
      .returning();
    return result[0];
  }

  async getAllAgents(): Promise<Agent[]> {
    return await db.select().from(agents);
  }

  async getFeaturedAgents(limit: number = 6): Promise<Agent[]> {
    return await db.select().from(agents)
      .where(eq(agents.featured, true))
      .limit(limit);
  }

  async getAgentsBySpecialization(specialization: string): Promise<Agent[]> {
    return await db.select().from(agents)
      .where(sql`${agents.specializations} @> ARRAY[${specialization}]::text[]`);
  }

  async getAgentsByArea(area: string): Promise<Agent[]> {
    return await db.select().from(agents)
      .where(sql`${agents.areas} @> ARRAY[${area}]::text[]`);
  }

  async searchAgents(query: { 
    specialization?: string;
    area?: string;
    minExperience?: number;
    minRating?: number;
  }): Promise<Agent[]> {
    let conditions = [];
    
    if (query.specialization) {
      conditions.push(sql`${agents.specializations} @> ARRAY[${query.specialization}]::text[]`);
    }
    
    if (query.area) {
      conditions.push(sql`${agents.areas} @> ARRAY[${query.area}]::text[]`);
    }
    
    if (query.minExperience) {
      conditions.push(gte(agents.yearsOfExperience, query.minExperience));
    }
    
    if (query.minRating) {
      conditions.push(gte(agents.rating, query.minRating));
    }
    
    return await db.select().from(agents)
      .where(and(...conditions));
  }

  // Company operations
  async getCompany(id: number): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return result[0];
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const result = await db.insert(companies).values(company).returning();
    return result[0];
  }

  async updateCompany(id: number, companyData: Partial<Company>): Promise<Company | undefined> {
    const result = await db.update(companies)
      .set(companyData)
      .where(eq(companies.id, id))
      .returning();
    return result[0];
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  async getFeaturedCompanies(limit: number = 6): Promise<Company[]> {
    return await db.select().from(companies)
      .where(eq(companies.featured, true))
      .limit(limit);
  }

  async searchCompanies(query: { city?: string; }): Promise<Company[]> {
    let conditions = [];
    
    if (query.city) {
      conditions.push(eq(companies.city, query.city));
    }
    
    return await db.select().from(companies)
      .where(and(...conditions));
  }

  // Property operations
  async createProperty(property: InsertProperty): Promise<Property> {
    const result = await db.insert(properties).values(property).returning();
    return result[0];
  }

  async getProperty(id: number): Promise<Property | undefined> {
    const result = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
    return result[0];
  }

  async updateProperty(id: number, propertyData: Partial<Property>): Promise<Property | undefined> {
    const result = await db.update(properties)
      .set(propertyData)
      .where(eq(properties.id, id))
      .returning();
    return result[0];
  }

  async getAllProperties(): Promise<Property[]> {
    return await db.select().from(properties);
  }

  async getPropertiesByUser(userId: number): Promise<Property[]> {
    return await db.select().from(properties).where(eq(properties.userId, userId));
  }

  async getPropertiesByAgent(agentId: number): Promise<Property[]> {
    return await db.select().from(properties).where(eq(properties.agentId, agentId));
  }

  async getPropertiesByCompany(companyId: number): Promise<Property[]> {
    return await db.select().from(properties).where(eq(properties.companyId, companyId));
  }

  async getFeaturedProperties(limit: number = 6): Promise<Property[]> {
    return await db.select().from(properties)
      .where(eq(properties.featured, true))
      .limit(limit);
  }

  async getPremiumProperties(limit: number = 6): Promise<Property[]> {
    return await db.select().from(properties)
      .where(eq(properties.premium, true))
      .limit(limit);
  }

  async getRecentProperties(limit: number = 10): Promise<Property[]> {
    return await db.select().from(properties)
      .orderBy(desc(properties.createdAt))
      .limit(limit);
  }

  async getPropertiesByType(type: string): Promise<Property[]> {
    return await db.select().from(properties)
      .where(eq(properties.propertyType, type));
  }

  // Remove these duplicate methods:
  // async getFeaturedProperties(limit: number = 6): Promise<Property[]> {
  //   // implementation
  // }
  
  // async getPremiumProperties(limit: number = 6): Promise<Property[]> {
  //   // implementation
  // }
  
  // async getRecentProperties(limit: number = 10): Promise<Property[]> {
  //   // implementation
  // }
  
  // async getPropertiesByType(propertyType: string): Promise<Property[]> {
  //   // implementation
  // }
  
  // Keep only one version of each method with the preferred implementation
  // async getFeaturedProperties(limit: number = 6): Promise<Property[]> {
  //   return await db.select().from(properties)
  //     .where(eq(properties.featured, true))
  //     .limit(limit);
  // }

  // async getPremiumProperties(limit: number = 6): Promise<Property[]> {
  //   return await db.select().from(properties)
  //     .where(eq(properties.premium, true))
  //     .limit(limit);
  // }

  // async getRecentProperties(limit: number = 10): Promise<Property[]> {
  //   return await db.select().from(properties)
  //     .orderBy(desc(properties.createdAt))
  //     .limit(limit);
  // }

  // async getPropertiesByType(propertyType: string): Promise<Property[]> {
  //   return await db.select().from(properties)
  //     .where(eq(properties.propertyType, propertyType));
  // }

  async getPropertiesByStatus(status: string): Promise<Property[]> {
    return await db.select().from(properties)
      .where(eq(properties.status, status));
  }

  async getPropertiesByRentOrSale(rentOrSale: string): Promise<Property[]> {
    return await db.select().from(properties)
      .where(eq(properties.rentOrSale, rentOrSale));
  }
  
  async getUrgentSaleProperties(limit: number = 10): Promise<Property[]> {
    const now = new Date();
    return await db.select().from(properties)
      .where(
        and(
          isNotNull(properties.discountedPrice),
          isNotNull(properties.expiresAt),
          gt(properties.expiresAt, now),
          eq(properties.status, 'available'),
          eq(properties.approvalStatus, 'approved')
        )
      )
      .orderBy(desc(properties.createdAt))
      .limit(limit);
  }

  async searchProperties(query: {
    city?: string;
    propertyType?: string;
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    maxBedrooms?: number;
    minArea?: number;
    maxArea?: number;
    rentOrSale?: string;
    status?: string;
    amenities?: string[];
  }): Promise<Property[]> {
    let conditions = [];
    
    if (query.city) {
      conditions.push(eq(properties.city, query.city));
    }
    
    if (query.propertyType) {
      conditions.push(eq(properties.propertyType, query.propertyType));
    }
    
    if (query.minPrice) {
      conditions.push(gte(properties.price, query.minPrice));
    }
    
    if (query.maxPrice) {
      conditions.push(lte(properties.price, query.maxPrice));
    }
    
    if (query.minBedrooms) {
      conditions.push(gte(properties.bedrooms, query.minBedrooms));
    }
    
    if (query.maxBedrooms) {
      conditions.push(lte(properties.bedrooms, query.maxBedrooms));
    }
    
    if (query.minArea) {
      conditions.push(gte(properties.area, query.minArea));
    }
    
    if (query.maxArea) {
      conditions.push(lte(properties.area, query.maxArea));
    }
    
    if (query.rentOrSale) {
      conditions.push(eq(properties.rentOrSale, query.rentOrSale));
    }
    
    if (query.status) {
      conditions.push(eq(properties.status, query.status));
    }
    
    if (query.amenities && query.amenities.length > 0) {
      conditions.push(sql`${properties.amenities} @> ${query.amenities}::text[]`);
    }
    
    return await db.select().from(properties)
      .where(and(...conditions));
  }

  // Recommendation operations
  async addPropertyView(userId: number, propertyId: number): Promise<void> {
    await db.insert(propertyViews)
      .values({ userId, propertyId, viewedAt: new Date() });
    
    // Update recommendation score
    await this._updateRecommendationScore(userId, propertyId, 1);
  }
  
  async getUserPropertyViews(userId: number): Promise<{ userId: number, propertyId: number, viewedAt: Date }[]> {
    const result = await db.select({
      userId: propertyViews.userId,
      propertyId: propertyViews.propertyId,
      viewedAt: propertyViews.viewedAt
    })
    .from(propertyViews)
    .where(eq(propertyViews.userId, userId));
    
    return result.map(item => ({
      ...item,
      viewedAt: item.viewedAt || new Date() // Ensure no null dates
    }));
  }
  
  async getAllPropertyViews(): Promise<{ userId: number, propertyId: number, viewedAt: Date }[]> {
    const result = await db.select({
      userId: propertyViews.userId,
      propertyId: propertyViews.propertyId,
      viewedAt: propertyViews.viewedAt
    })
    .from(propertyViews);
    
    return result.map(item => ({
      ...item,
      viewedAt: item.viewedAt || new Date() // Ensure no null dates
    }));
  }

  async saveProperty(userId: number, propertyId: number): Promise<void> {
    // First check if already saved
    const existing = await db.select().from(savedProperties)
      .where(
        and(
          eq(savedProperties.userId, userId),
          eq(savedProperties.propertyId, propertyId)
        )
      )
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(savedProperties)
        .values({ userId, propertyId, savedAt: new Date() });
      
      // Update recommendation score
      await this._updateRecommendationScore(userId, propertyId, 5);
    }
  }

  async getAllSavedProperties(): Promise<{ userId: number, propertyId: number, savedAt: Date }[]> {
    const result = await db.select({
      userId: savedProperties.userId,
      propertyId: savedProperties.propertyId,
      savedAt: savedProperties.savedAt
    })
    .from(savedProperties);
    
    return result.map(item => ({
      ...item,
      savedAt: item.savedAt || new Date() // Ensure no null dates
    }));
  }
  
  async getSavedProperties(userId: number): Promise<Property[]> {
    const savedProps = await db.select({
      propertyId: savedProperties.propertyId
    })
    .from(savedProperties)
    .where(eq(savedProperties.userId, userId));
    
    if (savedProps.length === 0) return [];
    
    const propertyIds = savedProps.map(sp => sp.propertyId);
    
    return await db.select().from(properties)
      .where(inArray(properties.id, propertyIds));
  }

  async unsaveProperty(userId: number, propertyId: number): Promise<void> {
    await db.delete(savedProperties)
      .where(
        and(
          eq(savedProperties.userId, userId),
          eq(savedProperties.propertyId, propertyId)
        )
      );
    
    // Update recommendation score
    await this._updateRecommendationScore(userId, propertyId, -5);
  }

  async getRecommendedProperties(userId: number, limit: number = 10): Promise<Property[]> {
    // Get property recommendations sorted by score
    const recommendations = await db.select({
      propertyId: propertyRecommendations.propertyId
    })
    .from(propertyRecommendations)
    .where(eq(propertyRecommendations.userId, userId))
    .orderBy(desc(propertyRecommendations.score))
    .limit(limit);
    
    if (recommendations.length === 0) {
      // If no recommendations, return featured properties
      return await this.getFeaturedProperties(limit);
    }
    
    const propertyIds = recommendations.map(r => r.propertyId);
    
    return await db.select().from(properties)
      .where(inArray(properties.id, propertyIds));
  }

  async _updateRecommendationScore(userId: number, propertyId: number, scoreChange: number): Promise<void> {
    // Check if recommendation exists
    const existingRec = await db.select().from(propertyRecommendations)
      .where(
        and(
          eq(propertyRecommendations.userId, userId),
          eq(propertyRecommendations.propertyId, propertyId)
        )
      )
      .limit(1);
    
    if (existingRec.length > 0) {
      // Update existing recommendation
      await db.update(propertyRecommendations)
        .set({ 
          score: existingRec[0].score + scoreChange,
        })
        .where(eq(propertyRecommendations.id, existingRec[0].id));
    } else {
      // Create new recommendation
      await db.insert(propertyRecommendations)
        .values({
          userId,
          propertyId,
          score: scoreChange,
        });
    }
    
    // Update similar properties recommendations
    await this._updateSimilarPropertiesRecommendations(userId, propertyId, scoreChange / 2);
  }

  async _updateSimilarPropertiesRecommendations(userId: number, propertyId: number, baseScoreChange: number): Promise<void> {
    // Get property type, city, and price range
    const property = await this.getProperty(propertyId);
    if (!property) return;
    
    // Find similar properties (same type, city, similar price range)
    const similarProperties = await db.select({ id: properties.id })
      .from(properties)
      .where(
        and(
          not(eq(properties.id, propertyId)), // Exclude the original property
          eq(properties.propertyType, property.propertyType),
          eq(properties.city, property.city),
          gte(properties.price, property.price * 0.8), // 20% price range
          lte(properties.price, property.price * 1.2)
        )
      )
      .limit(5);
    
    // Update recommendation scores for similar properties
    for (const simProp of similarProperties) {
      await this._updateRecommendationScore(userId, simProp.id, baseScoreChange);
    }
  }

  // Inquiry operations
  async createInquiry(inquiry: InsertInquiry): Promise<Inquiry> {
    const result = await db.insert(inquiries).values(inquiry).returning();
    return result[0];
  }

  async getInquiry(id: number): Promise<Inquiry | undefined> {
    const result = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
    return result[0];
  }

  async getInquiriesByProperty(propertyId: number): Promise<Inquiry[]> {
    return await db.select().from(inquiries).where(eq(inquiries.propertyId, propertyId));
  }

  async getInquiriesByUser(userId: number, asReceiver: boolean = false): Promise<Inquiry[]> {
    if (asReceiver) {
      return await db.select().from(inquiries).where(eq(inquiries.toUserId, userId));
    } else {
      return await db.select().from(inquiries).where(eq(inquiries.fromUserId, userId));
    }
  }

  async markInquiryAsRead(id: number): Promise<Inquiry | undefined> {
    const result = await db.update(inquiries)
      .set({ status: 'read' })
      .where(eq(inquiries.id, id))
      .returning();
    return result[0];
  }

  // Review operations
  async createAgentReview(review: InsertAgentReview): Promise<AgentReview> {
    const result = await db.insert(agentReviews).values(review).returning();
    
    // Update agent's average rating
    const agent = await this.getAgent(review.agentId);
    if (agent) {
      const reviews = await this.getAgentReviews(review.agentId);
      const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      const newRating = totalRating / reviews.length;
      
      await this.updateAgent(agent.id, {
        rating: newRating,
        reviewCount: reviews.length
      });
    }
    
    return result[0];
  }

  async getAgentReviews(agentId: number): Promise<AgentReview[]> {
    return await db.select().from(agentReviews)
      .where(eq(agentReviews.agentId, agentId))
      .orderBy(desc(agentReviews.createdAt));
  }

  // Notification operations
  async createNotification(notification: {
    userId: number;
    title: string;
    message: string;
    type: string;
    referenceId?: number;
    referenceType?: string;
  }): Promise<any> {
    const result = await db.execute(sql`
      INSERT INTO notifications (
        user_id, title, message, type, reference_id, reference_type, is_read, created_at
      ) VALUES (
        ${notification.userId}, 
        ${notification.title}, 
        ${notification.message}, 
        ${notification.type}, 
        ${notification.referenceId || null}, 
        ${notification.referenceType || null}, 
        false, 
        CURRENT_TIMESTAMP
      ) RETURNING *
    `);
    return result.rows?.[0];
  }

  async getNotifications(userId: number, limit: number = 20): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT * FROM notifications 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC 
      LIMIT ${limit}
    `);
    return result.rows || [];
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM notifications 
      WHERE user_id = ${userId} AND is_read = false
    `);
    const countValue = result.rows && result.rows[0] ? result.rows[0].count : 0;
    return typeof countValue === 'number' ? countValue : parseInt(String(countValue) || '0', 10);
  }

  async markNotificationAsRead(notificationId: number): Promise<any> {
    const result = await db.execute(sql`
      UPDATE notifications 
      SET is_read = true 
      WHERE id = ${notificationId} 
      RETURNING *
    `);
    return result.rows?.[0];
  }

  async markAllNotificationsAsRead(userId: number): Promise<void> {
    await db.execute(sql`
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = ${userId} AND is_read = false
    `);
  }
}
