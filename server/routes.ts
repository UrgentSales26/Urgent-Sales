import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.ts";
import { setupAuth } from "./auth.ts";
import { 
  insertPropertySchema, 
  insertAgentSchema, 
  insertCompanySchema, 
  insertInquirySchema,
  insertAgentReviewSchema,
  userRoles,
  approvalStatus
} from "@shared/schema.ts";
import { z } from "zod";
import * as express from 'express';
import { db } from './db.ts';
import { count, sql } from 'drizzle-orm';
import * as schema from '@shared/schema.ts';
import { 
  getNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  createNotification,
  sendRoleNotifications
} from './notification-service.ts';
import { getNeighborhoodInsightsHandler } from './neighborhood-service.ts';
import { 
  handleContactForm,
  handleFeedbackForm,
  handleReportProblem,
  handlePropertyInterest 
} from './email-service.ts';
import { upload, getFileUrl, deleteFile } from './file-upload.ts';


// Helper to catch errors in async routes
const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>) => 
  (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch(error => {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: error.errors 
        });
      }
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    });
  };

// Helper to check authentication
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "You must be logged in to access this resource" });
  }
  next();
};

// Helper to check user role
const hasRole = (roles: string[]) => (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "You must be logged in to access this resource" });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ 
      message: `Access denied. Required role: ${roles.join(' or ')}`
    });
  }

  next();
};

const createCheckoutSession = async (req: Request, res: Response) => {
  // This is a placeholder.  Replace with actual Stripe checkout session creation.
  try {
    //  Your Stripe checkout session creation logic here.  This will require
    //  Stripe API calls and handling of price IDs, subscription plans etc.
    const session = {id: 'temp-session-id'}; // Replace with actual session
    res.json({sessionId: session.id});
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({error: "Failed to create checkout session"});
  }
};

// Database admin endpoint
const getDatabaseTablesInfo = async (req: Request, res: Response) => {
  try {
    // Check if it's an admin user
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Get simple stats from each database table
    const userCount = (await db.select({ count: count() }).from(schema.users))[0].count;
    const propertyCount = (await db.select({ count: count() }).from(schema.properties))[0].count;
    const agentCount = (await db.select({ count: count() }).from(schema.agents))[0].count;
    const companyCount = (await db.select({ count: count() }).from(schema.companies))[0].count;
    const bookingCount = (await db.select({ count: count() }).from(schema.bookings))[0].count;
    const inquiryCount = (await db.select({ count: count() }).from(schema.inquiries))[0].count;
    const notificationCount = (await db.select({ count: count() }).from(schema.notifications))[0].count;
    const otpCount = (await db.select({ count: count() }).from(schema.otps))[0].count;
    const reviewCount = (await db.select({ count: count() }).from(schema.agentReviews))[0].count;

    // Return the stats
    return res.json([
      { tableName: 'users', rowCount: userCount },
      { tableName: 'properties', rowCount: propertyCount },
      { tableName: 'agents', rowCount: agentCount },
      { tableName: 'companies', rowCount: companyCount },
      { tableName: 'bookings', rowCount: bookingCount },
      { tableName: 'inquiries', rowCount: inquiryCount },
      { tableName: 'notifications', rowCount: notificationCount },
      { tableName: 'otps', rowCount: otpCount },
      { tableName: 'agent_reviews', rowCount: reviewCount }
    ]);
  } catch (error) {
    console.error('Error fetching database info:', error);
    res.status(500).json({ error: 'Failed to fetch database information' });
  }
};

// Get table records with pagination
const getTableRecords = async (req: Request, res: Response) => {
  try {
    // Check if it's an admin user
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const { table } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    let records = [];
    let totalCount = 0;

    // Get records based on table name
    switch (table) {
      case 'users':
        records = await db.select().from(schema.users).limit(limit).offset(offset);
        totalCount = (await db.select({ count: count() }).from(schema.users))[0].count;
        break;
      case 'properties':
        records = await db.select().from(schema.properties).limit(limit).offset(offset);
        totalCount = (await db.select({ count: count() }).from(schema.properties))[0].count;
        break;
      case 'agents':
        records = await db.select().from(schema.agents).limit(limit).offset(offset);
        totalCount = (await db.select({ count: count() }).from(schema.agents))[0].count;
        break;
      case 'companies':
        records = await db.select().from(schema.companies).limit(limit).offset(offset);
        totalCount = (await db.select({ count: count() }).from(schema.companies))[0].count;
        break;
      case 'bookings':
        records = await db.select().from(schema.bookings).limit(limit).offset(offset);
        totalCount = (await db.select({ count: count() }).from(schema.bookings))[0].count;
        break;
      case 'inquiries':
        records = await db.select().from(schema.inquiries).limit(limit).offset(offset);
        totalCount = (await db.select({ count: count() }).from(schema.inquiries))[0].count;
        break;
      case 'notifications':
        records = await db.select().from(schema.notifications).limit(limit).offset(offset);
        totalCount = (await db.select({ count: count() }).from(schema.notifications))[0].count;
        break;
      case 'otps':
        records = await db.select().from(schema.otps).limit(limit).offset(offset);
        totalCount = (await db.select({ count: count() }).from(schema.otps))[0].count;
        break;
      case 'agent_reviews':
        records = await db.select().from(schema.agentReviews).limit(limit).offset(offset);
        totalCount = (await db.select({ count: count() }).from(schema.agentReviews))[0].count;
        break;
      default:
        return res.status(404).json({ error: 'Table not found' });
    }

    return res.json({
      records,
      total: totalCount
    });
  } catch (error) {
    console.error(`Error fetching records from table:`, error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  app.use(express.json());

  // Database admin routes
  app.get('/api/admin/database/tables', isAuthenticated, hasRole(['admin']), asyncHandler(getDatabaseTablesInfo));
  app.get('/api/admin/database/tables/:table', isAuthenticated, hasRole(['admin']), asyncHandler(getTableRecords));

  app.post('/api/create-checkout-session', isAuthenticated, asyncHandler(async (req, res) => {
    await createCheckoutSession(req, res);
  }));

  // =========== Notification Routes ===========

  // Get user notifications
  app.get('/api/notifications', isAuthenticated, asyncHandler(getNotifications));

  // Mark a notification as read
  app.post('/api/notifications/:notificationId/read', isAuthenticated, asyncHandler(markNotificationAsRead));

  // Mark all notifications as read
  app.post('/api/notifications/read-all', isAuthenticated, asyncHandler(markAllNotificationsAsRead));

  // Create a notification (admin only)
  app.post('/api/notifications', isAuthenticated, hasRole(['admin']), asyncHandler(createNotification));

  // Send role-specific notifications (admin only)
  app.post('/api/notifications/role', isAuthenticated, hasRole(['admin']), asyncHandler(sendRoleNotifications));

  // =========== Property Routes ===========

  // Get all properties
  app.get("/api/properties", asyncHandler(async (req, res) => {
    const properties = await storage.getAllProperties();
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // If not admin, only return approved properties
    const filteredProperties = isAdmin 
      ? properties 
      : properties.filter(property => property.approvalStatus === 'approved');
    
    res.json(filteredProperties);
  }));

  // Get top properties by category
  app.get("/api/properties/top/:category", asyncHandler(async (req, res) => {
    const { category } = req.params;
    const { city } = req.query;

    // Dummy data for top properties
    const dummyProperties = [
      {
        id: 1,
        title: "Luxury Villa with Pool",
        description: "Magnificent 4BHK villa with private pool",
        price: 25000000,
        location: "Whitefield",
        city: "Bangalore",
        propertyType: "villa",
        bedrooms: 4,
        bathrooms: 4,
        area: 3500,
        imageUrls: ["https://images.unsplash.com/photo-1613977257363-707ba9348227"],
        premium: true,
        verified: true,
        saleType: "Sale"
      },
      {
        id: 2,
        title: "Sea View Apartment",
        description: "Premium 3BHK apartment with sea view",
        price: 18000000,
        location: "Marine Drive",
        city: "Mumbai",
        propertyType: "apartment",
        bedrooms: 3,
        bathrooms: 3,
        area: 2200,
        imageUrls: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267"],
        premium: true,
        verified: true,
        saleType: "Sale"
      },
      {
        id: 3,
        title: "Modern Office Space",
        description: "Ready-to-move office space in prime location",
        price: 15000000,
        location: "Cyber City",
        city: "Gurgaon",
        propertyType: "commercial",
        area: 2800,
        imageUrls: ["https://images.unsplash.com/photo-1497366216548-37526070297c"],
        premium: true,
        verified: true,
        saleType: "Rent"
      },
      {
        id: 4,
        title: "Garden View Penthouse",
        description: "Exclusive 4BHK penthouse with roof garden",
        price: 35000000,
        location: "Koramangala",
        city: "Bangalore",
        propertyType: "apartment",
        bedrooms: 4,
        bathrooms: 4,
        area: 4000,
        imageUrls: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c"],
        premium: true,
        verified: true,
        saleType: "Sale"
      },
      {
        id: 5,
        title: "Smart Home Villa",
        description: "Ultra-modern 5BHK villa with smart features",
        price: 42000000,
        location: "Electronic City",
        city: "Bangalore",
        propertyType: "villa",
        bedrooms: 5,
        bathrooms: 5,
        area: 4500,
        imageUrls: ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9"],
        premium: true,
        verified: true,
        saleType: "Sale"
      }
    ];

    let limit = 10;
    switch (category) {
      case 'top10': limit = 10; break;
      case 'top20': limit = 20; break;
      case 'top30': limit = 30; break;
      case 'top50': limit = 50; break;
      case 'top100': limit = 100; break;
      default: limit = 10;
    }

    // Filter by city if provided
    let filteredProperties = city 
      ? dummyProperties.filter(p => p.city.toLowerCase() === city.toString().toLowerCase())
      : dummyProperties;

    // Send the properties
    res.json(filteredProperties.slice(0, limit));
  }));

  // Get featured properties
  app.get("/api/properties/featured", asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 6;
    const properties = await storage.getFeaturedProperties(limit);
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // If not admin, only return approved properties
    const filteredProperties = isAdmin 
      ? properties 
      : properties.filter(property => property.approvalStatus === 'approved');
      
    res.json(filteredProperties);
  }));

  // Get premium properties
  app.get("/api/properties/premium", asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 6;
    const properties = await storage.getPremiumProperties(limit);
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // If not admin, only return approved properties
    const filteredProperties = isAdmin 
      ? properties 
      : properties.filter(property => property.approvalStatus === 'approved');
    
    res.json(filteredProperties);
  }));

  // Get top properties (by category and location)
  app.get("/api/properties/top", asyncHandler(async (req, res) => {
    const category = req.query.category as string || 'premium';
    const location = req.query.location as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const properties = await storage.getTopProperties(category, location, limit);
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // If not admin, only return approved properties
    const filteredProperties = isAdmin 
      ? properties 
      : properties.filter(property => property.approvalStatus === 'approved');
    
    res.json(filteredProperties);
  }));

  // Get all available property cities
  app.get("/api/properties/cities", asyncHandler(async (req, res) => {
    const cities = await storage.getPropertyCities();
    res.json(cities);
  }));

  // Get urgent properties (properties with discounted prices)
  app.get("/api/properties/urgent", asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    // Use the dedicated method to get urgent properties
    const urgentProperties = await storage.getUrgentSaleProperties(limit);

    // Map to the expected format for the frontend
    const formattedProperties = urgentProperties.map(property => ({
      id: property.id,
      title: property.title,
      location: property.location,
      price: property.price,
      discountedPrice: property.discountedPrice || Math.round(property.price * 0.75), // 25% discount
      propertyType: property.propertyType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      area: property.area,
      imageUrl: property.imageUrls && property.imageUrls.length > 0 ? property.imageUrls[0] : '',
      expiresAt: property.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Use property expiration date or default to 7 days
    }));

    res.json(formattedProperties);
  }));

  // Get recent properties
  app.get("/api/properties/recent", asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const properties = await storage.getRecentProperties(limit);
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // If not admin, only return approved properties
    const filteredProperties = isAdmin 
      ? properties 
      : properties.filter(property => property.approvalStatus === 'approved');
      
    res.json(filteredProperties);
  }));

  // Search properties
  app.get("/api/properties/search", asyncHandler(async (req, res) => {
    const { 
      city, location, propertyType, minPrice, maxPrice, 
      minBedrooms, maxBedrooms, minBathrooms, maxBathrooms,
      minArea, maxArea, rentOrSale, forSaleOrRent, status, 
      amenities, sortBy, page = '1', limit = '12'
    } = req.query;

    // Build search query
    const query: any = {};

    // Handle location search (can be either city or location parameter)
    if (city) query.city = city as string;
    if (location) query.city = location as string; // Alternative param name

    // Handle property type
    if (propertyType) query.propertyType = propertyType as string;

    // Handle price range
    if (minPrice) query.minPrice = parseInt(minPrice as string);
    if (maxPrice) query.maxPrice = parseInt(maxPrice as string);

    // Handle room counts
    if (minBedrooms) query.minBedrooms = parseInt(minBedrooms as string);
    if (maxBedrooms) query.maxBedrooms = parseInt(maxBedrooms as string);
    if (minBathrooms) query.minBathrooms = parseInt(minBathrooms as string);
    if (maxBathrooms) query.maxBathrooms = parseInt(maxBathrooms as string);

    // Handle area
    if (minArea) query.minArea = parseInt(minArea as string);
    if (maxArea) query.maxArea = parseInt(maxArea as string);

    // Handle property category (rent vs sale)
    // Support both parameter names for backwards compatibility
    if (rentOrSale) query.rentOrSale = rentOrSale as string;
    if (forSaleOrRent) query.rentOrSale = forSaleOrRent as string;

    // Handle property status
    if (status) query.status = status as string;

    // Handle amenities
    if (amenities) query.amenities = (amenities as string).split(',');

    // Get properties based on search criteria
    const properties = await storage.searchProperties(query);
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // If not admin, only return approved properties
    const filteredProperties = isAdmin 
      ? properties 
      : properties.filter(property => property.approvalStatus === 'approved');

    // Apply sorting if needed
    if (sortBy) {
      let sortedProperties = [...filteredProperties];

      switch (sortBy) {
        case 'price_low':
          sortedProperties.sort((a, b) => parseInt(a.price) - parseInt(b.price));
          break;
        case 'price_high':
          sortedProperties.sort((a, b) => parseInt(b.price) - parseInt(a.price));
          break;
        case 'area_low':
          sortedProperties.sort((a, b) => parseInt(a.area) - parseInt(b.area));
          break;
        case 'area_high':
          sortedProperties.sort((a, b) => parseInt(b.area) - parseInt(b.area));
          break;
        case 'newest':
        default:
          // Newest first (by createdAt date)
          sortedProperties.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
          });
          break;
      }

      // Apply pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;

      const paginatedProperties = sortedProperties.slice(startIndex, endIndex);

      // Return paginated results with total count
      return res.json({
        properties: paginatedProperties,
        total: sortedProperties.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(sortedProperties.length / limitNum)
      });
    }

    // If no sorting is specified, just apply pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedProperties = filteredProperties.slice(startIndex, endIndex);

    // Return paginated results
    res.json({
      properties: paginatedProperties,
      total: filteredProperties.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(filteredProperties.length / limitNum)
    });
  }));

  // Get properties by type
  app.get("/api/properties/type/:type", asyncHandler(async (req, res) => {
    const properties = await storage.getPropertiesByType(req.params.type);
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // If not admin, only return approved properties
    const filteredProperties = isAdmin 
      ? properties 
      : properties.filter(property => property.approvalStatus === 'approved');
    
    res.json(filteredProperties);
  }));

  // Get properties by status
  app.get("/api/properties/status/:status", asyncHandler(async (req, res) => {
    const properties = await storage.getPropertiesByStatus(req.params.status);
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // If not admin, only return approved properties
    const filteredProperties = isAdmin 
      ? properties 
      : properties.filter(property => property.approvalStatus === 'approved');
    
    res.json(filteredProperties);
  }));

  // Get properties by rent or sale
  // Get properties by category (rent/sale)
  app.get("/api/properties/category/:rentOrSale", asyncHandler(async (req, res) => {
    const properties = await storage.getPropertiesByRentOrSale(req.params.rentOrSale);
    
    // Check if user is admin
    const isAdmin = req.user && req.user.role === 'admin';
    
    // If not admin, only return approved properties
    const filteredProperties = isAdmin 
      ? properties 
      : properties.filter(property => property.approvalStatus === 'approved');
    
    res.json(filteredProperties);
  }));
  
  // Get properties pending approval (admin only)
  app.get("/api/properties/pending", isAuthenticated, hasRole(['admin']), asyncHandler(async (req, res) => {
    const properties = await storage.getAllProperties();
    // Filter for pending approval properties only
    const pendingProperties = properties.filter(property => property.approvalStatus === 'pending');
    res.json(pendingProperties);
  }));

  // Get all properties with approval status (admin only)
  app.get("/api/properties/all", isAuthenticated, hasRole(['admin']), asyncHandler(async (req, res) => {
    const properties = await storage.getAllProperties();
    res.json(properties);
  }));

  // Get property by ID - must be after the more specific routes
  app.get("/api/properties/:id", asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid property ID" });
    }

    const property = await storage.getProperty(id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // If user is logged in, track the view for recommendations
    if (req.isAuthenticated()) {
      await storage.addPropertyView(req.user.id, id);
    }

    res.json(property);
  }));

  // Upload property images
  app.post('/api/upload/property-images', isAuthenticated, upload.array('files', 25), asyncHandler(async (req, res) => {
    try {
      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      // Generate URLs for the uploaded files
      const fileUrls = Array.isArray(req.files) 
        ? req.files.map(file => getFileUrl(file.filename, req.user.id))
        : [getFileUrl(req.files.filename, req.user.id)];

      res.status(201).json({
        message: 'Files uploaded successfully',
        files: fileUrls
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      res.status(500).json({ message: 'File upload failed', error: error.message });
    }
  }));

  // Create a property
  app.post("/api/properties", isAuthenticated, asyncHandler(async (req, res) => {
    try {
      console.log("Property submission body:", JSON.stringify(req.body, null, 2));
      
      // Check if property has discounted price (urgency sale) but user is not premium
      if (req.body.discountedPrice && req.user.subscriptionLevel !== 'premium') {
        return res.status(403).json({ 
          message: "Only premium users can create urgency sale listings with discounted prices",
          code: "PREMIUM_REQUIRED"
        });
      }
      
      // Check if expiresAt is set (urgency sale) but user is not premium
      if (req.body.expiresAt && req.user.subscriptionLevel !== 'premium') {
        return res.status(403).json({ 
          message: "Only premium users can create urgency sale listings with expiration dates",
          code: "PREMIUM_REQUIRED"
        });
      }
      
      // Prepare property data with proper formatting for database
      const propertyDataToInsert = {
        ...req.body,
        userId: req.user.id,
      };
      
      // Ensure arrays are properly formatted
      if (!Array.isArray(propertyDataToInsert.amenities)) {
        propertyDataToInsert.amenities = [];
      }
      
      if (!Array.isArray(propertyDataToInsert.imageUrls)) {
        propertyDataToInsert.imageUrls = [];
      }
      
      if (!Array.isArray(propertyDataToInsert.videoUrls)) {
        propertyDataToInsert.videoUrls = [];
      }
      
      // If expiresAt is present as a string or Date object, convert it properly
      if (propertyDataToInsert.expiresAt) {
        if (typeof propertyDataToInsert.expiresAt === 'string') {
          propertyDataToInsert.expiresAt = new Date(propertyDataToInsert.expiresAt);
        } else if (typeof propertyDataToInsert.expiresAt === 'object') {
          // Already a Date object, keep it
        } else {
          // Invalid format, set to null
          propertyDataToInsert.expiresAt = null;
        }
      } else {
        propertyDataToInsert.expiresAt = null;
      }
      
      // Ensure numeric fields are properly converted
      if (typeof propertyDataToInsert.price === 'string') {
        propertyDataToInsert.price = parseInt(propertyDataToInsert.price) || 0;
      }
      
      if (typeof propertyDataToInsert.area === 'string') {
        propertyDataToInsert.area = parseInt(propertyDataToInsert.area) || 0;
      }
      
      if (propertyDataToInsert.discountedPrice !== null && typeof propertyDataToInsert.discountedPrice === 'string') {
        propertyDataToInsert.discountedPrice = parseInt(propertyDataToInsert.discountedPrice) || null;
      }
      
      // Ensure required fields are present
      if (!propertyDataToInsert.rentOrSale) {
        // Check if forSaleOrRent exists and use it instead
        if (propertyDataToInsert.forSaleOrRent) {
          propertyDataToInsert.rentOrSale = propertyDataToInsert.forSaleOrRent.toLowerCase();
        } else {
          // Default to "sale" if no value is provided
          propertyDataToInsert.rentOrSale = "sale";
        }
      }
      
      console.log("Property data to parse:", JSON.stringify(propertyDataToInsert, null, 2));
      
      const propertyData = insertPropertySchema.parse(propertyDataToInsert);
      console.log("Property data after parse:", JSON.stringify(propertyData, null, 2));
      
      const property = await storage.createProperty(propertyData);
      res.status(201).json(property);
    } catch (error) {
      console.error("Error creating property:", error);
      // Provide more detailed error message to the client
      if (error instanceof Error) {
        res.status(500).json({ 
          message: "Failed to create property", 
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } else {
        res.status(500).json({ message: "Unknown error occurred" });
      }
    }
  }));

  // Update a property
  app.patch("/api/properties/:id", isAuthenticated, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid property ID" });
    }

    const property = await storage.getProperty(id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Check if user owns this property or is an agent/admin
    if (property.userId !== req.user.id && 
        req.user.role !== 'agent' && 
        req.user.role !== 'company_admin') {
      return res.status(403).json({ message: "You don't have permission to update this property" });
    }
    
    // Check if trying to add discounted price (urgency sale) but user is not premium
    if (
      req.body.discountedPrice && 
      !property.discountedPrice && 
      req.user.subscriptionLevel !== 'premium'
    ) {
      return res.status(403).json({ 
        message: "Only premium users can add urgency sale discounts",
        code: "PREMIUM_REQUIRED"
      });
    }
    
    // Check if trying to add expiration date (urgency sale) but user is not premium
    if (
      req.body.expiresAt && 
      !property.expiresAt && 
      req.user.subscriptionLevel !== 'premium'
    ) {
      return res.status(403).json({ 
        message: "Only premium users can add urgency sale expiration dates",
        code: "PREMIUM_REQUIRED"
      });
    }

    const updatedProperty = await storage.updateProperty(id, req.body);
    res.json(updatedProperty);
  }));
  
  // Delete a property
  app.delete("/api/properties/:id", isAuthenticated, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid property ID" });
    }

    // Get existing property
    const property = await storage.getProperty(id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Check if user owns this property or is an admin
    if (property.userId !== req.user.id && 
        req.user.role !== 'admin' && 
        req.user.role !== 'company_admin') {
      return res.status(403).json({ message: "You don't have permission to delete this property" });
    }

    // Delete the property
    const success = await storage.deleteProperty(id);
    if (!success) {
      return res.status(500).json({ message: "Error deleting property" });
    }
    
    // Also delete property images from uploads if they exist
    if (property.imageUrls && property.imageUrls.length > 0) {
      for (const imageUrl of property.imageUrls) {
        try {
          await deleteFile(imageUrl);
        } catch (error) {
          console.error(`Error deleting file ${imageUrl}:`, error);
          // Continue with deletion even if image deletion fails
        }
      }
    }
    
    return res.json({ success: true, message: "Property deleted successfully" });
  }));

  // Get current user's properties
  app.get("/api/user/properties", isAuthenticated, asyncHandler(async (req, res) => {
    const properties = await storage.getPropertiesByUser(req.user.id);
    res.json(properties);
  }));

  // =========== Property Approval Routes ===========

  // Approve a property (admin only)
  app.post("/api/properties/:id/approve", isAuthenticated, hasRole(['admin']), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid property ID" });
    }

    const property = await storage.getProperty(id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (property.approvalStatus === 'approved') {
      return res.status(400).json({ message: "Property is already approved" });
    }

    // Update property with approval information
    const updatedProperty = await storage.updateProperty(id, {
      approvalStatus: 'approved',
      approvedBy: req.user.id,
      approvalDate: new Date()
    });

    res.json({
      message: "Property has been approved successfully",
      property: updatedProperty
    });
  }));

  // Reject a property (admin only)
  app.post("/api/properties/:id/reject", isAuthenticated, hasRole(['admin']), asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid property ID" });
    }

    const { rejectionReason } = req.body;
    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const property = await storage.getProperty(id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (property.approvalStatus === 'rejected') {
      return res.status(400).json({ message: "Property is already rejected" });
    }

    // Update property with rejection information
    const updatedProperty = await storage.updateProperty(id, {
      approvalStatus: 'rejected',
      approvedBy: req.user.id,
      rejectionReason: rejectionReason,
      approvalDate: new Date()
    });

    res.json({
      message: "Property has been rejected",
      property: updatedProperty
    });
  }));

  // =========== Agent Routes ===========

  // Get all agents
  app.get("/api/agents", asyncHandler(async (req, res) => {
    const agents = await storage.getAllAgents();
    res.json(agents);
  }));

  // Get featured agents
  app.get("/api/agents/featured", asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 6;
    const agents = await storage.getFeaturedAgents(limit);
    res.json(agents);
  }));

  // Search agents
  app.get("/api/agents/search", asyncHandler(async (req, res) => {
    const { specialization, area, minExperience, minRating } = req.query;

    const query: any = {};
    if (specialization) query.specialization = specialization as string;
    if (area) query.area = area as string;
    if (minExperience) query.minExperience = parseInt(minExperience as string);
    if (minRating) query.minRating = parseFloat(minRating as string);

    const agents = await storage.searchAgents(query);
    res.json(agents);
  }));

  // Get agent by ID
  app.get("/api/agents/:id", asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const agent = await storage.getAgent(id);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    res.json(agent);
  }));

  // Get agent's properties
  app.get("/api/agents/:id/properties", asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const agent = await storage.getAgent(id);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const properties = await storage.getPropertiesByAgent(id);
    res.json(properties);
  }));

  // Get agent reviews
  app.get("/api/agents/:id/reviews", asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const agent = await storage.getAgent(id);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const reviews = await storage.getAgentReviews(id);
    res.json(reviews);
  }));

  // Create agent profile (for existing user)
  app.post("/api/agents", isAuthenticated, hasRole(['agent']), asyncHandler(async (req, res) => {
    // Check if user already has an agent profile
    const existingAgent = await storage.getAgentByUserId(req.user.id);
    if (existingAgent) {
      return res.status(400).json({ message: "You already have an agent profile" });
    }

    const agentData = insertAgentSchema.parse({
      ...req.body,
      userId: req.user.id
    });

    const agent = await storage.createAgent(agentData);
    res.status(201).json(agent);
  }));

  // Update agent profile
  app.patch("/api/agents/:id", isAuthenticated, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const agent = await storage.getAgent(id);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    // Check if user owns this agent profile or is an admin
    if (agent.userId !== req.user.id && req.user.role !== 'company_admin') {
      return res.status(403).json({ message: "You don't have permission to update this agent profile" });
    }

    const updatedAgent = await storage.updateAgent(id, req.body);
    res.json(updatedAgent);
  }));

  // Add a review for an agent
  app.post("/api/agents/:id/reviews", isAuthenticated, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid agent ID" });
    }

    const agent = await storage.getAgent(id);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    const reviewData = insertAgentReviewSchema.parse({
      ...req.body,
      agentId: id,
      userId: req.user.id
    });

    const review = await storage.createAgentReview(reviewData);
    res.status(201).json(review);
  }));

  // =========== Company Routes ===========

  // Get all companies
  app.get("/api/companies", asyncHandler(async (req, res) => {
    const companies = await storage.getAllCompanies();
    res.json(companies);
  }));

  // Get featured companies
  app.get("/api/companies/featured", asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 6;
    const companies = await storage.getFeaturedCompanies(limit);
    res.json(companies);
  }));

  // Search companies
  app.get("/api/companies/search", asyncHandler(async (req, res) => {
    const { city } = req.query;

    const query: any = {};
    if (city) query.city = city as string;

    const companies = await storage.searchCompanies(query);
    res.json(companies);
  }));

  // Get company by ID
  app.get("/api/companies/:id", asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const company = await storage.getCompany(id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json(company);
  }));

  // Get company's properties
  app.get("/api/companies/:id/properties", asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const company = await storage.getCompany(id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const properties = await storage.getPropertiesByCompany(id);
    res.json(properties);
  }));

  // Create company (for existing user)
  app.post("/api/companies", isAuthenticated, hasRole(['company_admin']), asyncHandler(async (req, res) => {
    const companyData = insertCompanySchema.parse({
      ...req.body,
      adminId: req.user.id
    });

    const company = await storage.createCompany(companyData);
    res.status(201).json(company);
  }));

  // Update company
  app.patch("/api/companies/:id", isAuthenticated, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const company = await storage.getCompany(id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Check if user is the company admin
    if (company.adminId !== req.user.id) {
      return res.status(403).json({ message: "You don't have permission to update this company" });
    }

    const updatedCompany = await storage.updateCompany(id, req.body);
    res.json(updatedCompany);
  }));

  // =========== User & Recommendation Routes ===========

  // Get recommended properties for current user
  app.get("/api/recommendations", isAuthenticated, asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const recommendations = await storage.getRecommendedProperties(req.user.id, limit);
    res.json(recommendations);
  }));

  // Get AI-powered personalized recommendations
  app.get("/api/recommendations/ai", isAuthenticated, asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    // Import and initialize the AI recommendation service
    const { getRecommendationService } = await import('./recommendation-service');
    const recommendationService = getRecommendationService(storage);

    const aiRecommendations = await recommendationService.getPersonalizedRecommendations(req.user.id, limit);
    res.json(aiRecommendations);
  }));

  // Track user property interaction for improving recommendations
  app.post("/api/recommendations/track", isAuthenticated, asyncHandler(async (req, res) => {
    const { propertyId, interactionType } = req.body;

    if (!propertyId || !interactionType) {
      return res.status(400).json({ message: "Property ID and interaction type are required" });
    }

    // Validate interaction type
    if (!['view', 'save', 'inquiry'].includes(interactionType)) {
      return res.status(400).json({ message: "Invalid interaction type" });
    }

    // Check if property exists
    const property = await storage.getProperty(propertyId);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Import and initialize the AI recommendation service
    const { getRecommendationService } = await import('./recommendation-service');
    const recommendationService = getRecommendationService(storage);

    // Track the interaction
    await recommendationService.updateModelWithInteraction(
      req.user.id,
      propertyId,
      interactionType
    );

    // Also record view in database if it's a view interaction
    if (interactionType === 'view') {
      await storage.addPropertyView(req.user.id, propertyId);
    }
  }));

  // Trigger training of the AI recommendation model
  app.post("/api/recommendations/train", isAuthenticated, asyncHandler(async (req, res) => {
    // Only admins and agents can trigger model training
    if (!['admin', 'agent'].includes(req.user.role)) {
      return res.status(403).json({ message: "Permission denied. Only admins and agents can trigger model training." });
    }

    // Import and initialize the AI recommendation service
    const { getRecommendationService } = await import('./recommendation-service');
    const recommendationService = getRecommendationService(storage);

    try {
      // Train the model asynchronously
      recommendationService.trainModel().catch(err => {
        console.error('Error training model:', err);
      });

      res.json({ message: "Model training initiated successfully" });
    } catch (error) {
      console.error('Error initiating model training:', error);
      res.status(500).json({ message: "Error initiating model training" });
    }
  }));

  // Get current user's saved properties
  app.get("/api/user/saved", isAuthenticated, asyncHandler(async (req, res) => {
    const savedProperties = await storage.getSavedProperties(req.user.id);
    res.json(savedProperties);
  }));

  // Save a property
  app.post("/api/properties/:id/save", isAuthenticated, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid property ID" });
    }

    const property = await storage.getProperty(id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    await storage.saveProperty(req.user.id, id);
    res.status(201).json({ message: "Property saved successfully" });
  }));

  // Unsave a property
  app.delete("/api/properties/:id/save", isAuthenticated, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid property ID" });
    }

    await storage.unsaveProperty(req.user.id, id);
    res.json({ message: "Property removed from saved list" });
  }));

  // =========== Inquiry & Messaging Routes ===========

  // Create an inquiry for a property
  app.post("/api/inquiries", isAuthenticated, asyncHandler(async (req, res) => {
    const inquiryData = insertInquirySchema.parse({
      ...req.body,
      fromUserId: req.user.id
    });

    // Check if property exists
    const property = await storage.getProperty(inquiryData.propertyId);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    const inquiry = await storage.createInquiry(inquiryData);
    res.status(201).json(inquiry);
  }));

  // Get inquiries for a property
  app.get("/api/properties/:id/inquiries", isAuthenticated, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid property ID" });
    }

    const property = await storage.getProperty(id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Check if user owns this property or is the agent/company managing it
    if (property.userId !== req.user.id && 
        (property.agentId === null || property.agentId !== req.user.id)) {
      return res.status(403).json({ message: "You don't have permission to view these inquiries" });
    }

    const inquiries = await storage.getInquiriesByProperty(id);
    res.json(inquiries);
  }));

  // Get inquiries sent by current user
  app.get("/api/user/inquiries/sent", isAuthenticated, asyncHandler(async (req, res) => {
    const inquiries = await storage.getInquiriesByUser(req.user.id, false);
    res.json(inquiries);
  }));

  // Get inquiries received by current user
  app.get("/api/user/inquiries/received", isAuthenticated, asyncHandler(async (req, res) => {
    const inquiries = await storage.getInquiriesByUser(req.user.id, true);
    res.json(inquiries);
  }));
  
  // Get neighborhood insights
  // =========== Email Service Routes ===========
  
  // Contact form endpoint
  app.post("/api/contact", asyncHandler(handleContactForm));
  
  // Feedback form endpoint
  app.post("/api/feedback", asyncHandler(handleFeedbackForm));
  
  // Report problem endpoint
  app.post("/api/report-problem", asyncHandler(handleReportProblem));
  
  // Property interest endpoint
  app.post("/api/property-interest", asyncHandler(handlePropertyInterest));

  // =========== Neighborhood Insights Route ===========
  app.get("/api/neighborhood/insights", asyncHandler(getNeighborhoodInsightsHandler));

  // Mark an inquiry as read
  app.patch("/api/inquiries/:id/read", isAuthenticated, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid inquiry ID" });
    }

    const inquiry = await storage.getInquiry(id);
    if (!inquiry) {
      return res.status(404).json({ message: "Inquiry not found" });
    }

    // Check if user is the recipient
    if (inquiry.toUserId !== req.user.id) {
      return res.status(403).json({ message: "You don't have permission to update this inquiry" });
    }

    const updatedInquiry = await storage.markInquiryAsRead(id);
    res.json(updatedInquiry);
  }));

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
