import { 
  users, properties, agents, companies, inquiries, 
  agentReviews, propertyRecommendations, propertyViews, 
  savedProperties, otps, bookings, type User, type InsertUser, 
  type Property, type InsertProperty, type Agent, type InsertAgent, 
  type Company, type InsertCompany, type Inquiry, type InsertInquiry, 
  type AgentReview, type InsertAgentReview, type Otp, type InsertOtp,
  type Booking, type InsertBooking, userRoles
} from "@shared/schema.ts";
import session from "express-session";
import createMemoryStore from "memorystore";
import { randomInt } from "crypto";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  updateUserPassword(id: number, newPassword: string): Promise<User | undefined>;
  verifyUserEmail(id: number): Promise<User | undefined>;
  verifyUserPhone(id: number): Promise<User | undefined>;
  
  // OTP operations
  createOtp(otp: InsertOtp): Promise<Otp>;
  getOtp(id: number): Promise<Otp | undefined>;
  getOtpByUserAndType(userId: number, type: string): Promise<Otp | undefined>;
  verifyOtp(userId: number, otpCode: string, type: string): Promise<boolean>;
  invalidateOtp(id: number): Promise<void>;
  getAllOtps(): Promise<Otp[]>;

  // Booking operations
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBooking(id: number): Promise<Booking | undefined>;
  getUserBookings(userId: number): Promise<Booking[]>;
  getPropertyBookings(propertyId: number): Promise<Booking[]>;
  getAgentBookings(agentId: number): Promise<Booking[]>;
  updateBookingStatus(id: number, status: string): Promise<Booking | undefined>;
  verifyBooking(id: number, verificationCode: string): Promise<boolean>;

  // Agent operations
  getAgent(id: number): Promise<Agent | undefined>;
  getAgentByUserId(userId: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, agentData: Partial<Agent>): Promise<Agent | undefined>;
  getAllAgents(): Promise<Agent[]>;
  getFeaturedAgents(limit?: number): Promise<Agent[]>;
  getAgentsBySpecialization(specialization: string): Promise<Agent[]>;
  getAgentsByArea(area: string): Promise<Agent[]>;
  searchAgents(query: { 
    specialization?: string;
    area?: string;
    minExperience?: number;
    minRating?: number;
  }): Promise<Agent[]>;

  // Company operations
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, companyData: Partial<Company>): Promise<Company | undefined>;
  getAllCompanies(): Promise<Company[]>;
  getFeaturedCompanies(limit?: number): Promise<Company[]>;
  searchCompanies(query: { city?: string; }): Promise<Company[]>;

  // Property operations
  createProperty(property: InsertProperty): Promise<Property>;
  getProperty(id: number): Promise<Property | undefined>;
  updateProperty(id: number, propertyData: Partial<Property>): Promise<Property | undefined>;
  deleteProperty(id: number): Promise<boolean>;
  getAllProperties(): Promise<Property[]>;
  getPropertiesByUser(userId: number): Promise<Property[]>;
  getPropertiesByAgent(agentId: number): Promise<Property[]>;
  getPropertiesByCompany(companyId: number): Promise<Property[]>;
  getFeaturedProperties(limit?: number): Promise<Property[]>;
  getPremiumProperties(limit?: number): Promise<Property[]>;
  getRecentProperties(limit?: number): Promise<Property[]>;
  getPropertiesByType(propertyType: string): Promise<Property[]>;
  getPropertiesByStatus(status: string): Promise<Property[]>;
  getPropertiesByRentOrSale(rentOrSale: string): Promise<Property[]>;
  getUrgentSaleProperties(limit?: number): Promise<Property[]>;
  getTopProperties(category: string, location?: string, limit?: number): Promise<Property[]>;
  getPropertyCities(): Promise<string[]>;
  searchProperties(query: {
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
  }): Promise<Property[]>;
  
  // Recommendation operations
  addPropertyView(userId: number, propertyId: number): Promise<void>;
  getUserPropertyViews(userId: number): Promise<{ userId: number, propertyId: number, viewedAt: Date }[]>;
  getAllPropertyViews(): Promise<{ userId: number, propertyId: number, viewedAt: Date }[]>;
  saveProperty(userId: number, propertyId: number): Promise<void>;
  getSavedProperties(userId: number): Promise<Property[]>;
  getAllSavedProperties(): Promise<{ userId: number, propertyId: number, savedAt: Date }[]>;
  unsaveProperty(userId: number, propertyId: number): Promise<void>;
  getRecommendedProperties(userId: number, limit?: number): Promise<Property[]>;
  _updateRecommendationScore(userId: number, propertyId: number, scoreChange: number): Promise<void>;
  _updateSimilarPropertiesRecommendations(userId: number, propertyId: number, baseScoreChange: number): Promise<void>;
  
  // Inquiry operations
  createInquiry(inquiry: InsertInquiry): Promise<Inquiry>;
  getInquiry(id: number): Promise<Inquiry | undefined>;
  getInquiriesByProperty(propertyId: number): Promise<Inquiry[]>;
  getInquiriesByUser(userId: number, asReceiver?: boolean): Promise<Inquiry[]>;
  markInquiryAsRead(id: number): Promise<Inquiry | undefined>;
  
  // Review operations
  createAgentReview(review: InsertAgentReview): Promise<AgentReview>;
  getAgentReviews(agentId: number): Promise<AgentReview[]>;
  
  // Notification operations
  getNotifications(userId: number, limit?: number): Promise<any[]>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  markNotificationAsRead(notificationId: number): Promise<any>;
  markAllNotificationsAsRead(userId: number): Promise<void>;
  createNotification(notification: {
    userId: number;
    title: string;
    message: string;
    type: string;
    linkTo?: string;
  }): Promise<any>;

  // Session store
  sessionStore: any;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private properties: Map<number, Property>;
  private agents: Map<number, Agent>;
  private companies: Map<number, Company>;
  private inquiries: Map<number, Inquiry>;
  private agentReviews: Map<number, AgentReview>;
  private propertyViews: Map<number, { userId: number, propertyId: number, viewedAt: Date }>;
  private savedProps: Map<number, { userId: number, propertyId: number, savedAt: Date }>;
  private recommendations: Map<number, { userId: number, propertyId: number, score: number, createdAt: Date }>;
  private otps: Map<number, Otp>;
  private bookings: Map<number, Booking>;
  private notifications: Map<number, { 
    id: number, 
    userId: number, 
    title: string,
    message: string,
    type: string,
    isRead: boolean,
    createdAt: Date,
    linkTo?: string
  }>;
  
  sessionStore: any;
  userIdCounter: number;
  propertyIdCounter: number;
  agentIdCounter: number;
  companyIdCounter: number;
  inquiryIdCounter: number;
  reviewIdCounter: number;
  viewIdCounter: number;
  savedIdCounter: number;
  recommendationIdCounter: number;
  otpIdCounter: number;
  bookingIdCounter: number;
  notificationIdCounter: number;

  constructor() {
    this.users = new Map();
    this.properties = new Map();
    this.agents = new Map();
    this.companies = new Map();
    this.inquiries = new Map();
    this.agentReviews = new Map();
    this.propertyViews = new Map();
    this.savedProps = new Map();
    this.recommendations = new Map();
    this.otps = new Map();
    this.bookings = new Map();
    this.notifications = new Map();
    
    this.userIdCounter = 1;
    this.propertyIdCounter = 1;
    this.agentIdCounter = 1;
    this.companyIdCounter = 1;
    this.inquiryIdCounter = 1;
    this.reviewIdCounter = 1;
    this.viewIdCounter = 1;
    this.savedIdCounter = 1;
    this.recommendationIdCounter = 1;
    this.otpIdCounter = 1;
    this.bookingIdCounter = 1;
    this.notificationIdCounter = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }
  
  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.role === role,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: now, 
      verified: false,
      emailVerified: false,
      phoneVerified: false,
      role: insertUser.role || "buyer",
      avatar: insertUser.avatar || null,
      bio: insertUser.bio || null
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async verifyUserEmail(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { 
      ...user, 
      emailVerified: true,
      // If phone is already verified, mark user as fully verified
      verified: user.phoneVerified ? true : user.verified
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async verifyUserPhone(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { 
      ...user, 
      phoneVerified: true,
      // If email is already verified, mark user as fully verified
      verified: user.emailVerified ? true : user.verified
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async updateUserPassword(id: number, newPassword: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, password: newPassword };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  // OTP operations
  async createOtp(otp: InsertOtp): Promise<Otp> {
    const id = this.otpIdCounter++;
    const now = new Date();
    
    const newOtp: Otp = {
      ...otp,
      id,
      createdAt: now,
      verified: false
    };
    this.otps.set(id, newOtp);
    return newOtp;
  }
  
  async getOtp(id: number): Promise<Otp | undefined> {
    return this.otps.get(id);
  }
  
  async getOtpByUserAndType(userId: number, type: string): Promise<Otp | undefined> {
    return Array.from(this.otps.values()).find(
      (otp) => otp.userId === userId && otp.type === type && !otp.verified && new Date(otp.expiresAt) > new Date()
    );
  }
  
  async verifyOtp(userId: number, otpCode: string, type: string): Promise<boolean> {
    const otp = Array.from(this.otps.values()).find(
      (o) => o.userId === userId && o.type === type && o.otp === otpCode && !o.verified && new Date(o.expiresAt) > new Date()
    );
    
    if (!otp) return false;
    
    // Mark OTP as verified
    const otpId = Array.from(this.otps.entries())
      .find(([, o]) => o.userId === userId && o.type === type && o.otp === otpCode && !o.verified)?.[0];
    
    if (otpId) {
      const updatedOtp = { ...otp, verified: true };
      this.otps.set(otpId, updatedOtp);
      
      // If this is an email or phone OTP, update user verification status
      if (type === "email") {
        await this.verifyUserEmail(userId);
      } else if (type === "sms" || type === "whatsapp") {
        await this.verifyUserPhone(userId);
      }
      
      return true;
    }
    
    return false;
  }
  
  async invalidateOtp(id: number): Promise<void> {
    const otp = this.otps.get(id);
    if (!otp) return;
    
    const updatedOtp = { ...otp, verified: true }; // Mark as verified to invalidate
    this.otps.set(id, updatedOtp);
  }
  
  async getAllOtps(): Promise<Otp[]> {
    return Array.from(this.otps.values());
  }
  
  // Booking operations
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const id = this.bookingIdCounter++;
    const now = new Date();
    
    // Generate a random 6-digit verification code
    const verificationCode = randomInt(100000, 999999).toString();
    
    const newBooking: Booking = {
      ...booking,
      id,
      createdAt: now,
      isVerified: false,
      verificationCode
    };
    this.bookings.set(id, newBooking);
    return newBooking;
  }
  
  async getBooking(id: number): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }
  
  async getUserBookings(userId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.userId === userId
    );
  }
  
  async getPropertyBookings(propertyId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.propertyId === propertyId
    );
  }
  
  async getAgentBookings(agentId: number): Promise<Booking[]> {
    return Array.from(this.bookings.values()).filter(
      (booking) => booking.agentId === agentId
    );
  }
  
  async updateBookingStatus(id: number, status: string): Promise<Booking | undefined> {
    const booking = this.bookings.get(id);
    if (!booking) return undefined;
    
    const updatedBooking = { ...booking, status };
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }
  
  async verifyBooking(id: number, verificationCode: string): Promise<boolean> {
    const booking = this.bookings.get(id);
    if (!booking || booking.verificationCode !== verificationCode) {
      return false;
    }
    
    const updatedBooking = { ...booking, isVerified: true };
    this.bookings.set(id, updatedBooking);
    return true;
  }
  
  // Agent operations
  async getAgent(id: number): Promise<Agent | undefined> {
    return this.agents.get(id);
  }
  
  async getAgentByUserId(userId: number): Promise<Agent | undefined> {
    return Array.from(this.agents.values()).find(
      (agent) => agent.userId === userId,
    );
  }
  
  async createAgent(agent: InsertAgent): Promise<Agent> {
    const id = this.agentIdCounter++;
    const now = new Date();
    const newAgent: Agent = {
      ...agent,
      id,
      createdAt: now,
      specializations: agent.specializations || [],
      areas: agent.areas || [],
      rating: agent.rating || 0,
      reviewCount: agent.reviewCount || 0,
      featured: agent.featured || false,
      yearsOfExperience: agent.yearsOfExperience || 0
    };
    this.agents.set(id, newAgent);
    return newAgent;
  }
  
  async updateAgent(id: number, agentData: Partial<Agent>): Promise<Agent | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    
    const updatedAgent = { ...agent, ...agentData };
    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }
  
  async getAllAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }
  
  async getFeaturedAgents(limit: number = 6): Promise<Agent[]> {
    const featured = Array.from(this.agents.values())
      .filter((agent) => agent.featured)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
      
    return featured.slice(0, limit);
  }
  
  async getAgentsBySpecialization(specialization: string): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.specializations && agent.specializations.includes(specialization)
    );
  }
  
  async getAgentsByArea(area: string): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.areas && agent.areas.includes(area)
    );
  }
  
  async searchAgents(query: { 
    specialization?: string;
    area?: string;
    minExperience?: number;
    minRating?: number;
  }): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter((agent) => {
      if (query.specialization && (!agent.specializations || !agent.specializations.includes(query.specialization))) {
        return false;
      }
      
      if (query.area && (!agent.areas || !agent.areas.includes(query.area))) {
        return false;
      }
      
      if (query.minExperience && (!agent.yearsOfExperience || agent.yearsOfExperience < query.minExperience)) {
        return false;
      }
      
      if (query.minRating && (!agent.rating || agent.rating < query.minRating)) {
        return false;
      }
      
      return true;
    });
  }
  
  // Company operations
  async getCompany(id: number): Promise<Company | undefined> {
    return this.companies.get(id);
  }
  
  async createCompany(company: InsertCompany): Promise<Company> {
    const id = this.companyIdCounter++;
    const now = new Date();
    const newCompany: Company = {
      ...company,
      id,
      createdAt: now,
      verified: company.verified || false,
      featured: company.featured || false,
      logo: company.logo || null,
      website: company.website || null,
      establishedYear: company.establishedYear || null
    };
    this.companies.set(id, newCompany);
    return newCompany;
  }
  
  async updateCompany(id: number, companyData: Partial<Company>): Promise<Company | undefined> {
    const company = this.companies.get(id);
    if (!company) return undefined;
    
    const updatedCompany = { ...company, ...companyData };
    this.companies.set(id, updatedCompany);
    return updatedCompany;
  }
  
  async getAllCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values());
  }
  
  async getFeaturedCompanies(limit: number = 6): Promise<Company[]> {
    const featured = Array.from(this.companies.values())
      .filter((company) => company.featured)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    return featured.slice(0, limit);
  }
  
  async searchCompanies(query: { city?: string; }): Promise<Company[]> {
    return Array.from(this.companies.values()).filter((company) => {
      if (query.city && !company.city.toLowerCase().includes(query.city.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }

  // Property operations
  async createProperty(insertProperty: InsertProperty): Promise<Property> {
    const id = this.propertyIdCounter++;
    const now = new Date();
    
    // Set default values for optional fields
    const property: Property = { 
      ...insertProperty, 
      id, 
      createdAt: now,
      featured: insertProperty.featured || false,
      verified: insertProperty.verified || false,
      premium: insertProperty.premium || false,
      imageUrls: insertProperty.imageUrls || [],
      amenities: insertProperty.amenities || [],
      virtualTourUrl: insertProperty.virtualTourUrl || null,
      floorPlanUrl: insertProperty.floorPlanUrl || null,
      expiresAt: null, // Will be set by admin if needed
      bedrooms: insertProperty.bedrooms || null,
      bathrooms: insertProperty.bathrooms || null,
      yearBuilt: insertProperty.yearBuilt || null,
      agentId: insertProperty.agentId || null,
      companyId: insertProperty.companyId || null,
      latitude: insertProperty.latitude || null,
      longitude: insertProperty.longitude || null
    };
    
    this.properties.set(id, property);
    return property;
  }
  
  async updateProperty(id: number, propertyData: Partial<Property>): Promise<Property | undefined> {
    const property = this.properties.get(id);
    if (!property) return undefined;
    
    const updatedProperty = { ...property, ...propertyData };
    this.properties.set(id, updatedProperty);
    return updatedProperty;
  }

  async deleteProperty(id: number): Promise<boolean> {
    // Check if property exists
    const property = this.properties.get(id);
    if (!property) return false;

    // Delete related data
    // 1. Delete property views
    for (const [viewKey, view] of this.propertyViews.entries()) {
      if (view.propertyId === id) {
        this.propertyViews.delete(viewKey);
      }
    }

    // 2. Delete saved properties
    for (const [savedKey, savedProp] of this.savedProps.entries()) {
      if (savedProp.propertyId === id) {
        this.savedProps.delete(savedKey);
      }
    }

    // 3. Delete recommendations
    for (const [recKey, rec] of this.recommendations.entries()) {
      if (rec.propertyId === id) {
        this.recommendations.delete(recKey);
      }
    }

    // 4. Delete inquiries
    for (const [inquiryKey, inquiry] of this.inquiries.entries()) {
      if (inquiry.propertyId === id) {
        this.inquiries.delete(inquiryKey);
      }
    }

    // 5. Delete the property itself
    this.properties.delete(id);
    
    return true;
  }

  async getProperty(id: number): Promise<Property | undefined> {
    return this.properties.get(id);
  }

  async getAllProperties(): Promise<Property[]> {
    return Array.from(this.properties.values());
  }

  async getPropertiesByUser(userId: number): Promise<Property[]> {
    return Array.from(this.properties.values()).filter(
      (property) => property.userId === userId,
    );
  }
  
  async getPropertiesByAgent(agentId: number): Promise<Property[]> {
    return Array.from(this.properties.values()).filter(
      (property) => property.agentId === agentId,
    );
  }
  
  async getPropertiesByCompany(companyId: number): Promise<Property[]> {
    return Array.from(this.properties.values()).filter(
      (property) => property.companyId === companyId,
    );
  }

  async getTopProperties(category: string = 'premium', location?: string, limit: number = 10): Promise<Property[]> {
    let properties: Property[] = [];
    const now = new Date();
    
    // Filter properties by approval status and availability
    const approvedProperties = Array.from(this.properties.values())
      .filter(property => property.approvalStatus === 'approved' && property.status === 'available');
    
    // Filter by location if provided
    const filteredByLocation = location
      ? approvedProperties.filter(property => 
          property.city && property.city.toLowerCase() === location.toLowerCase())
      : approvedProperties;
    
    // Apply category-specific filters
    switch(category) {
      case 'premium':
        properties = filteredByLocation
          .filter(property => property.premium)
          .sort((a, b) => {
            // Sort by premium status first, then by price (high to low)
            return b.price - a.price;
          });
        break;
        
      case 'featured':
        properties = filteredByLocation
          .filter(property => property.featured)
          .sort((a, b) => {
            // Sort by creation date (newest first)
            if (a.createdAt && b.createdAt) {
              return b.createdAt.getTime() - a.createdAt.getTime();
            }
            return 0;
          });
        break;
        
      case 'urgent':
        properties = filteredByLocation
          .filter(property => 
            property.discountedPrice && 
            property.expiresAt && 
            property.expiresAt > now)
          .sort((a, b) => {
            // Sort by discount percentage (highest first)
            const discountA = a.discountedPrice ? (1 - a.discountedPrice / a.price) : 0;
            const discountB = b.discountedPrice ? (1 - b.discountedPrice / b.price) : 0;
            return discountB - discountA;
          });
        break;
        
      case 'newest':
        properties = filteredByLocation
          .sort((a, b) => {
            // Sort by creation date (newest first)
            if (a.createdAt && b.createdAt) {
              return b.createdAt.getTime() - a.createdAt.getTime();
            }
            return 0;
          });
        break;
        
      default:
        // Default sort by price (high to low)
        properties = filteredByLocation.sort((a, b) => b.price - a.price);
    }
    
    return properties.slice(0, limit);
  }
  
  async getPropertyCities(): Promise<string[]> {
    // Get all unique cities from properties
    const cities = new Set<string>();
    
    Array.from(this.properties.values())
      .filter(property => property.approvalStatus === 'approved' && property.city)
      .forEach(property => {
        if (property.city) {
          cities.add(property.city);
        }
      });
    
    return Array.from(cities).sort();
  }

  async getFeaturedProperties(limit: number = 6): Promise<Property[]> {
    const featured = Array.from(this.properties.values())
      .filter((property) => property.featured)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    return featured.slice(0, limit);
  }
  
  async getPremiumProperties(limit: number = 6): Promise<Property[]> {
    const premium = Array.from(this.properties.values())
      .filter((property) => property.premium)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    return premium.slice(0, limit);
  }
  
  async getRecentProperties(limit: number = 10): Promise<Property[]> {
    const all = Array.from(this.properties.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
    return all.slice(0, limit);
  }

  async getPropertiesByType(propertyType: string): Promise<Property[]> {
    return Array.from(this.properties.values()).filter(
      (property) => property.propertyType === propertyType,
    );
  }
  
  async getPropertiesByStatus(status: string): Promise<Property[]> {
    return Array.from(this.properties.values()).filter(
      (property) => property.status === status,
    );
  }
  
  async getPropertiesByRentOrSale(rentOrSale: string): Promise<Property[]> {
    return Array.from(this.properties.values()).filter(
      (property) => property.rentOrSale === rentOrSale,
    );
  }
  
  async getUrgentSaleProperties(limit: number = 10): Promise<Property[]> {
    const now = new Date();
    return Array.from(this.properties.values())
      .filter(property => 
        property.discountedPrice && 
        property.expiresAt && 
        property.expiresAt > now &&
        property.status === 'available' &&
        property.approvalStatus === 'approved'
      )
      .sort((a, b) => {
        // Sort by creation date (newest first)
        if (a.createdAt && b.createdAt) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return 0;
      })
      .slice(0, limit);
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
    return Array.from(this.properties.values()).filter((property) => {
      if (query.city && !property.city.toLowerCase().includes(query.city.toLowerCase())) {
        return false;
      }
      
      if (query.propertyType && property.propertyType !== query.propertyType) {
        return false;
      }
      
      if (query.minPrice && property.price < query.minPrice) {
        return false;
      }
      
      if (query.maxPrice && property.price > query.maxPrice) {
        return false;
      }
      
      if (query.minBedrooms && (!property.bedrooms || property.bedrooms < query.minBedrooms)) {
        return false;
      }
      
      if (query.maxBedrooms && (property.bedrooms && property.bedrooms > query.maxBedrooms)) {
        return false;
      }
      
      if (query.minArea && property.area < query.minArea) {
        return false;
      }
      
      if (query.maxArea && property.area > query.maxArea) {
        return false;
      }
      
      if (query.rentOrSale && property.rentOrSale !== query.rentOrSale) {
        return false;
      }
      
      if (query.status && property.status !== query.status) {
        return false;
      }
      
      if (query.amenities && query.amenities.length > 0) {
        if (!property.amenities) return false;
        
        for (const amenity of query.amenities) {
          if (!property.amenities.includes(amenity)) {
            return false;
          }
        }
      }
      
      return true;
    });
  }
  
  // Recommendation operations
  async addPropertyView(userId: number, propertyId: number): Promise<void> {
    const id = this.viewIdCounter++;
    const now = new Date();
    this.propertyViews.set(id, { userId, propertyId, viewedAt: now });
    
    // Update recommendation score based on view
    await this._updateRecommendationScore(userId, propertyId, 1);
  }
  
  async getUserPropertyViews(userId: number): Promise<{ userId: number, propertyId: number, viewedAt: Date }[]> {
    return Array.from(this.propertyViews.values()).filter(
      (view) => view.userId === userId
    );
  }
  
  async getAllPropertyViews(): Promise<{ userId: number, propertyId: number, viewedAt: Date }[]> {
    return Array.from(this.propertyViews.values());
  }
  
  async saveProperty(userId: number, propertyId: number): Promise<void> {
    const id = this.savedIdCounter++;
    const now = new Date();
    this.savedProps.set(id, { userId, propertyId, savedAt: now });
    
    // Update recommendation score based on save (higher weight than view)
    await this._updateRecommendationScore(userId, propertyId, 5);
  }
  
  async getAllSavedProperties(): Promise<{ userId: number, propertyId: number, savedAt: Date }[]> {
    return Array.from(this.savedProps.values());
  }
  
  async getSavedProperties(userId: number): Promise<Property[]> {
    const savedPropertyIds = Array.from(this.savedProps.values())
      .filter(entry => entry.userId === userId)
      .map(entry => entry.propertyId);
    
    return Array.from(this.properties.values())
      .filter(property => savedPropertyIds.includes(property.id));
  }
  
  async unsaveProperty(userId: number, propertyId: number): Promise<void> {
    const savedEntryId = Array.from(this.savedProps.entries())
      .find(([, entry]) => entry.userId === userId && entry.propertyId === propertyId)?.[0];
    
    if (savedEntryId) {
      this.savedProps.delete(savedEntryId);
      
      // Update recommendation score based on unsave
      await this._updateRecommendationScore(userId, propertyId, -5);
    }
  }
  
  async getRecommendedProperties(userId: number, limit: number = 10): Promise<Property[]> {
    const userViewedProperties = Array.from(this.propertyViews.values())
      .filter(view => view.userId === userId)
      .map(view => view.propertyId);
    
    // If user hasn't viewed any properties yet, return featured properties
    if (userViewedProperties.length === 0) {
      return this.getFeaturedProperties(limit);
    }
    
    // Get user's recommendations sorted by score
    const recommendations = Array.from(this.recommendations.values())
      .filter(rec => rec.userId === userId)
      .sort((a, b) => b.score - a.score);
    
    // Get recommended property IDs
    const recommendedPropertyIds = recommendations.map(rec => rec.propertyId);
    
    // Get the actual property objects
    const recommendedProperties = recommendedPropertyIds
      .map(id => this.properties.get(id))
      .filter(Boolean) as Property[];
    
    // If we don't have enough recommendations, add some featured properties
    if (recommendedProperties.length < limit) {
      const featuredProperties = await this.getFeaturedProperties(limit - recommendedProperties.length);
      const featuredIds = featuredProperties.map(p => p.id);
      
      // Add any featured properties not already in the recommendations
      for (const prop of featuredProperties) {
        if (!recommendedPropertyIds.includes(prop.id)) {
          recommendedProperties.push(prop);
        }
      }
    }
    
    return recommendedProperties.slice(0, limit);
  }
  
  // Helper to update recommendation scores
  async _updateRecommendationScore(userId: number, propertyId: number, scoreChange: number): Promise<void> {
    // Find existing recommendation
    const existingRec = Array.from(this.recommendations.values())
      .find(rec => rec.userId === userId && rec.propertyId === propertyId);
    
    if (existingRec) {
      // Update existing recommendation
      const recId = Array.from(this.recommendations.entries())
        .find(([, rec]) => rec.userId === userId && rec.propertyId === propertyId)?.[0];
      
      if (recId) {
        const updatedRec = {
          ...existingRec,
          score: Math.max(0, existingRec.score + scoreChange) // Ensure score doesn't go below 0
        };
        this.recommendations.set(recId, updatedRec);
      }
    } else {
      // Create new recommendation
      const id = this.recommendationIdCounter++;
      const now = new Date();
      this.recommendations.set(id, {
        userId,
        propertyId,
        score: Math.max(0, scoreChange), // Ensure score doesn't go below 0
        createdAt: now
      });
    }
    
    // Update similar properties (collaborative filtering)
    await this._updateSimilarPropertiesRecommendations(userId, propertyId, scoreChange);
  }
  
  // Basic collaborative filtering implementation
  async _updateSimilarPropertiesRecommendations(userId: number, propertyId: number, baseScoreChange: number): Promise<void> {
    const property = await this.getProperty(propertyId);
    if (!property) return;
    
    // Find similar properties (same type, similar price range, same city)
    const similarProperties = Array.from(this.properties.values())
      .filter(p => 
        p.id !== propertyId &&
        p.propertyType === property.propertyType &&
        p.city === property.city &&
        p.price >= property.price * 0.8 && 
        p.price <= property.price * 1.2
      );
    
    // Add recommendations for similar properties with reduced score
    for (const similarProp of similarProperties) {
      const reducedScore = baseScoreChange * 0.3; // 30% of the original score change
      await this._updateRecommendationScore(userId, similarProp.id, reducedScore);
    }
  }
  
  // Inquiry operations
  async createInquiry(inquiry: InsertInquiry): Promise<Inquiry> {
    const id = this.inquiryIdCounter++;
    const now = new Date();
    const newInquiry: Inquiry = {
      ...inquiry,
      id,
      createdAt: now,
      status: inquiry.status || "unread"
    };
    this.inquiries.set(id, newInquiry);
    return newInquiry;
  }
  
  async getInquiry(id: number): Promise<Inquiry | undefined> {
    return this.inquiries.get(id);
  }
  
  async getInquiriesByProperty(propertyId: number): Promise<Inquiry[]> {
    return Array.from(this.inquiries.values())
      .filter(inquiry => inquiry.propertyId === propertyId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async getInquiriesByUser(userId: number, asReceiver: boolean = false): Promise<Inquiry[]> {
    return Array.from(this.inquiries.values())
      .filter(inquiry => asReceiver ? inquiry.toUserId === userId : inquiry.fromUserId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async markInquiryAsRead(id: number): Promise<Inquiry | undefined> {
    const inquiry = this.inquiries.get(id);
    if (!inquiry) return undefined;
    
    const updatedInquiry = { ...inquiry, status: "read" };
    this.inquiries.set(id, updatedInquiry);
    return updatedInquiry;
  }
  
  // Review operations
  async createAgentReview(review: InsertAgentReview): Promise<AgentReview> {
    const id = this.reviewIdCounter++;
    const now = new Date();
    const newReview: AgentReview = {
      ...review,
      id,
      createdAt: now
    };
    this.agentReviews.set(id, newReview);
    
    // Update agent rating
    const agent = await this.getAgent(review.agentId);
    if (agent) {
      const reviews = await this.getAgentReviews(agent.id);
      const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      const newRating = totalRating / reviews.length;
      
      await this.updateAgent(agent.id, {
        rating: newRating,
        reviewCount: reviews.length
      });
    }
    
    return newReview;
  }
  
  async getAgentReviews(agentId: number): Promise<AgentReview[]> {
    return Array.from(this.agentReviews.values())
      .filter(review => review.agentId === agentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  // Notification operations
  async getNotifications(userId: number, limit: number = 20): Promise<any[]> {
    const userNotifications = Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return userNotifications.slice(0, limit);
  }
  
  async getUnreadNotificationsCount(userId: number): Promise<number> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId && !notification.isRead)
      .length;
  }
  
  async markNotificationAsRead(notificationId: number): Promise<any> {
    const notification = this.notifications.get(notificationId);
    if (!notification) return null;
    
    const updatedNotification = { ...notification, isRead: true };
    this.notifications.set(notificationId, updatedNotification);
    return updatedNotification;
  }
  
  async markAllNotificationsAsRead(userId: number): Promise<void> {
    const userNotifications = Array.from(this.notifications.entries())
      .filter(([, notification]) => notification.userId === userId);
    
    for (const [id, notification] of userNotifications) {
      const updatedNotification = { ...notification, isRead: true };
      this.notifications.set(id, updatedNotification);
    }
  }
  
  async createNotification(notification: {
    userId: number;
    title: string;
    message: string;
    type: string;
    linkTo?: string;
  }): Promise<any> {
    const id = this.notificationIdCounter++;
    const now = new Date();
    
    const newNotification = {
      id,
      createdAt: now,
      isRead: false,
      ...notification
    };
    
    this.notifications.set(id, newNotification);
    return newNotification;
  }
}

import { DbStorage } from './db-storage';

// Use MemStorage for development or if DATABASE_URL is not available
// Otherwise use DbStorage for production with PostgreSQL
export const storage = process.env.DATABASE_URL 
  ? new DbStorage() 
  : new MemStorage();
