import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, sql } from '@shared/schema.ts';
import { schema } from '@shared/schema.ts'; // Add this line if needed
import pkg from 'pg';
const { Pool } = pkg;
import { log } from './vite';
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Helper for password hashing
const scryptAsync = promisify(scrypt);
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Create a PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create a drizzle instance with the schema
export const db = drizzle(pool, { schema });

// Run migrations (this should be done once when the app starts)
export async function runMigrations() {
  try {
    log('Running database migrations...', 'database');
    // Uncomment this when there are actual migrations in the migrations folder
    // await migrate(db, { migrationsFolder: './migrations' });
    log('Database migrations completed successfully', 'database');
  } catch (error) {
    log(`Error running migrations: ${error}`, 'database');
    throw error;
  }
}

// Function to create admin user
async function createAdminUser() {
  try {
    const adminEmail = 'srinathballa20@gmail.com';
    const adminUsername = 'admin';
    
    // Check if admin already exists
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2 LIMIT 1',
      [adminEmail, adminUsername]
    );
    
    if (result.rows.length === 0) {
      log('Creating admin user...', 'database');
      const hashedPassword = await hashPassword('Srinath12#');
      
      await pool.query(
        'INSERT INTO users (username, email, password, name, role, verified, email_verified, phone_verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [adminUsername, adminEmail, hashedPassword, 'System Administrator', 'admin', true, true, true]
      );
      
      log('Admin user created successfully', 'database');
    } else {
      log('Admin user already exists', 'database');
    }
  } catch (error) {
    log(`Error creating admin user: ${error}`, 'database');
  }
}

// Initialize the database (create tables if they don't exist)
export async function initializeDatabase() {
  try {
    log('Initializing database...', 'database');

    // Check if tables exist first - if they do, we won't recreate them
    const tablesExist = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);

    // Only recreate schema if tables don't exist
    if (!tablesExist.rows[0].exists) {
      log('Tables do not exist. Creating schema...', 'database');
      
      // Manually create tables if they don't exist
      // This is a temporary solution until we have proper migrations
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT,
          role TEXT NOT NULL DEFAULT 'buyer',
          avatar TEXT,
          bio TEXT,
          verified BOOLEAN DEFAULT FALSE,
          email_verified BOOLEAN DEFAULT FALSE,
          phone_verified BOOLEAN DEFAULT FALSE,
          subscription_level TEXT DEFAULT 'free',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS otps (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          otp TEXT NOT NULL,
          type TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          verified BOOLEAN DEFAULT FALSE
        );

        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          property_id INTEGER NOT NULL,
          agent_id INTEGER,
          booking_date TIMESTAMP NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          verification_code TEXT,
          message TEXT,
          is_verified BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS companies (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          logo TEXT,
          description TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          zip TEXT,
          phone TEXT,
          email TEXT,
          website TEXT,
          established_year INTEGER,
          employee_count INTEGER,
          featured BOOLEAN DEFAULT FALSE,
          verified BOOLEAN DEFAULT FALSE,
          admin_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS agents (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          company_id INTEGER,
          license_number TEXT,
          specializations TEXT[],
          years_of_experience INTEGER,
          areas TEXT[],
          rating DOUBLE PRECISION DEFAULT 0,
          review_count INTEGER DEFAULT 0,
          featured BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS properties (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          price DOUBLE PRECISION NOT NULL,
          discounted_price DOUBLE PRECISION,
          property_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'available',
          rent_or_sale TEXT NOT NULL,
          bedrooms INTEGER,
          bathrooms INTEGER,
          area DOUBLE PRECISION,
          address TEXT,
          city TEXT,
          state TEXT,
          zip TEXT,
          location TEXT,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          image_urls TEXT[],
          video_urls TEXT[],
          virtual_tour_url TEXT,
          floor_plan_url TEXT,
          amenities TEXT[],
          features TEXT[],
          user_id INTEGER NOT NULL,
          agent_id INTEGER,
          company_id INTEGER,
          featured BOOLEAN DEFAULT FALSE,
          verified BOOLEAN DEFAULT FALSE,
          premium BOOLEAN DEFAULT FALSE,
          approval_status TEXT DEFAULT 'pending',
          approved_by INTEGER,
          rejection_reason TEXT,
          approval_date TIMESTAMP,
          subscription_level TEXT DEFAULT 'free',
          subscription_amount INTEGER DEFAULT 0,
          subscription_expires_at TIMESTAMP,
          year_built INTEGER,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS property_recommendations (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          property_id INTEGER NOT NULL,
          score DOUBLE PRECISION NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS property_views (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          property_id INTEGER NOT NULL,
          viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS saved_properties (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          property_id INTEGER NOT NULL,
          saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inquiries (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          property_id INTEGER NOT NULL,
          recipient_id INTEGER NOT NULL,
          message TEXT NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS agent_reviews (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          rating INTEGER NOT NULL,
          review TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT NOT NULL,
          reference_id INTEGER,
          reference_type TEXT,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      log('Tables created successfully', 'database');
    } else {
      log('Tables already exist', 'database');
    }
    
    // After tables are ensured, create the admin user
    await createAdminUser();
    
    log('Database initialization complete', 'database');
  } catch (error) {
    log(`Error initializing database: ${error}`, 'database');
    throw error;
  }
}
