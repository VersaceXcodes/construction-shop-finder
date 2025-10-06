import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs/promises';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import { Pool } from 'pg';

// Import Zod schemas
import {
  userSchema, createUserInputSchema, updateUserInputSchema, searchUsersInputSchema,
  shopSchema, createShopInputSchema, updateShopInputSchema, searchShopsInputSchema,
  categorySchema, createCategoryInputSchema, updateCategoryInputSchema, searchCategoriesInputSchema,
  productSchema, createProductInputSchema, updateProductInputSchema, searchProductsInputSchema,
  productVariantSchema, createProductVariantInputSchema, updateProductVariantInputSchema, searchProductVariantsInputSchema,
  priceSchema, createPriceInputSchema, updatePriceInputSchema, searchPricesInputSchema,
  inventorySchema, createInventoryInputSchema, updateInventoryInputSchema, searchInventoryInputSchema,
  bomSchema, createBomInputSchema, updateBomInputSchema, searchBomsInputSchema,
  rfqSchema, createRfqInputSchema, updateRfqInputSchema, searchRfqsInputSchema,
  notificationSchema, createNotificationInputSchema, updateNotificationInputSchema, searchNotificationsInputSchema,
  reviewSchema, createReviewInputSchema, updateReviewInputSchema, searchReviewsInputSchema,
  analyticsEventSchema, createAnalyticsEventInputSchema, searchAnalyticsEventsInputSchema
} from './schema.js';

// Configure environment
dotenv.config();

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const { DATABASE_URL, PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT = 5432, JWT_SECRET = 'your-secret-key' } = process.env;

const pool = new Pool(
  DATABASE_URL
    ? { 
        connectionString: DATABASE_URL, 
        ssl: { rejectUnauthorized: false } as any
      }
    : {
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
        port: Number(PGPORT),
        ssl: { rejectUnauthorized: false } as any,
      }
);

// Express app setup
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Morgan logging middleware
app.use(morgan('combined'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create storage directory if it doesn't exist
try {
  await fs.mkdir(path.join(__dirname, 'storage'), { recursive: true });
  await fs.mkdir(path.join(__dirname, 'storage', 'images'), { recursive: true });
  await fs.mkdir(path.join(__dirname, 'storage', 'documents'), { recursive: true });
  await fs.mkdir(path.join(__dirname, 'storage', 'attachments'), { recursive: true });
} catch (error) {
  console.error('Failed to create storage directories:', error);
}

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = path.join(__dirname, 'storage');
    if (file.fieldname === 'image' || file.mimetype.startsWith('image/')) {
      uploadPath = path.join(uploadPath, 'images');
    } else if (file.fieldname === 'document') {
      uploadPath = path.join(uploadPath, 'documents');
    } else {
      uploadPath = path.join(uploadPath, 'attachments');
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow images and documents
    if (file.mimetype.startsWith('image/') || 
        file.mimetype === 'application/pdf' ||
        file.mimetype.includes('document') ||
        file.mimetype.includes('text')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Error response utility
function createErrorResponse(message: any, error: any = null, errorCode: any = null): any {
  const response: any = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (errorCode) {
    response.error_code = errorCode;
  }

  if (error && process.env.NODE_ENV === 'development') {
    response.details = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return response;
}

// Generate UUID utility
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && (authHeader as string).split(' ')[1];

  if (!token) {
    return res.status(401).json(createErrorResponse('Access token required', null, 'AUTH_TOKEN_REQUIRED'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const result = await pool.query('SELECT id, email, name, user_type, created_at FROM users WHERE id = $1', [decoded.user_id]);
    
    if (result.rows.length === 0) {
      return res.status(401).json(createErrorResponse('Invalid token', null, 'AUTH_TOKEN_INVALID'));
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(403).json(createErrorResponse('Invalid or expired token', error, 'AUTH_TOKEN_INVALID'));
  }
};

// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && (authHeader as string).split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const result = await pool.query('SELECT id, email, name, user_type, created_at FROM users WHERE id = $1', [decoded.user_id]);
      
      if (result.rows.length > 0) {
        req.user = result.rows[0];
      }
    } catch (error) {
      // Ignore token errors for optional auth
    }
  }
  
  next();
};

/*
  Authentication endpoints - handles user registration, login, and profile management.
  Implements JWT-based authentication with direct password storage for development.
*/

// POST /api/auth/register - Register new user account
app.post('/api/auth/register', async (req, res) => {
  try {
    const validatedData = createUserInputSchema.parse(req.body);
    const { email, password_hash: password, name, user_type, phone, location_lat, location_lng, address, preferences } = validatedData;

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json(createErrorResponse('User with this email already exists', null, 'USER_ALREADY_EXISTS'));
    }

    // Create user with direct password storage (no hashing for development)
    const userId = generateUUID();
    const timestamp = Date.now();
    
    const result = await pool.query(
      `INSERT INTO users (id, email, phone, password_hash, name, user_type, location_lat, location_lng, address, preferences, is_verified, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
       RETURNING id, email, name, user_type, location_lat, location_lng, address, preferences, is_verified, created_at`,
      [userId, email.toLowerCase().trim(), phone, password, name.trim(), user_type, location_lat, location_lng, address, JSON.stringify(preferences || {}), false, timestamp, timestamp]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.id, email: user.email, user_type: user.user_type }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_type: user.user_type,
        location_lat: user.location_lat,
        location_lng: user.location_lng,
        address: user.address,
        preferences: user.preferences,
        is_verified: user.is_verified,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/auth/login - User login authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(createErrorResponse('Email and password are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    // Find user with direct password comparison (no hashing for development)
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
    }

    const user = result.rows[0];

    // Direct password comparison for development
    if (password !== user.password_hash) {
      return res.status(401).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = $1 WHERE id = $2', [Date.now(), user.id]);

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.id, email: user.email, user_type: user.user_type }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_type: user.user_type,
        location_lat: user.location_lat,
        location_lng: user.location_lng,
        address: user.address,
        preferences: user.preferences,
        is_verified: user.is_verified,
        last_login: user.last_login,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/auth/logout - User logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logout successful' });
});

// GET /api/auth/me - Get current user profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json(req.user);
});

/*
  Mock external API function for password reset email
  @@need:external-api: Email service integration for sending password reset emails with secure tokens
*/
async function sendPasswordResetEmail(email, resetToken) {
  // Mock implementation - returns success for development
  console.log(`Mock: Sending password reset email to ${email} with token ${resetToken}`);
  return {
    success: true,
    messageId: 'mock_' + Date.now(),
    timestamp: Date.now()
  };
}

// POST /api/auth/forgot-password - Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(createErrorResponse('Email is required', null, 'MISSING_EMAIL'));
    }

    const user = await pool.query('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    
    if (user.rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
    }

    // Generate reset token
    const resetToken = generateUUID();
    const resetTokenExpires = Date.now() + (1000 * 60 * 60); // 1 hour

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpires, user.rows[0].id]
    );

    // Send reset email (mock implementation)
    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/auth/reset-password - Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json(createErrorResponse('Token and password are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    if (password.length < 6) {
      return res.status(400).json(createErrorResponse('Password must be at least 6 characters long', null, 'PASSWORD_TOO_SHORT'));
    }

    const user = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > $2',
      [token, Date.now()]
    );

    if (user.rows.length === 0) {
      return res.status(400).json(createErrorResponse('Invalid or expired reset token', null, 'INVALID_RESET_TOKEN'));
    }

    // Update password (direct storage for development)
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = $2 WHERE id = $3',
      [password, Date.now(), user.rows[0].id]
    );

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  User management endpoints - handles user profile operations, search, and updates.
  Implements role-based access control for user data modification.
*/

// GET /api/users - Search and list users
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const params = searchUsersInputSchema.parse(req.query);
    const { query, user_type, is_verified, limit, offset, sort_by, sort_order } = params;

    let whereConditions = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    if (query) {
      paramCount++;
      whereConditions.push(`(name ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
      queryParams.push(`%${query}%`);
    }

    if (user_type) {
      paramCount++;
      whereConditions.push(`user_type = $${paramCount}`);
      queryParams.push(user_type as any);
    }

    if (is_verified !== undefined) {
      paramCount++;
      whereConditions.push(`is_verified = $${paramCount}`);
      queryParams.push(is_verified as any);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      queryParams
    );

    // Get users
    const result = await pool.query(
      `SELECT id, email, name, user_type, location_lat, location_lng, address, is_verified, last_login, created_at, updated_at 
       FROM users ${whereClause}
       ORDER BY ${sort_by} ${sort_order}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    });
  } catch (error) {
    console.error('Search users error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/users/:user_id - Get user by ID
app.get('/api/users/:user_id', optionalAuth, async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      'SELECT id, email, name, user_type, location_lat, location_lng, address, is_verified, last_login, created_at, updated_at FROM users WHERE id = $1',
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PUT /api/users/:user_id - Update user profile
app.put('/api/users/:user_id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;

    // Check if user can update this profile
    if (req.user.id !== user_id) {
      return res.status(403).json(createErrorResponse('Cannot update other user profiles', null, 'FORBIDDEN'));
    }

    const validatedData = updateUserInputSchema.parse({ id: user_id, ...req.body });
    const { name, phone, location_lat, location_lng, address, preferences, is_verified } = validatedData;

    let updateFields = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      queryParams.push(name as any);
    }

    if (phone !== undefined) {
      paramCount++;
      updateFields.push(`phone = $${paramCount}`);
      queryParams.push(phone as any);
    }

    if (location_lat !== undefined) {
      paramCount++;
      updateFields.push(`location_lat = $${paramCount}`);
      queryParams.push(location_lat as any);
    }

    if (location_lng !== undefined) {
      paramCount++;
      updateFields.push(`location_lng = $${paramCount}`);
      queryParams.push(location_lng as any);
    }

    if (address !== undefined) {
      paramCount++;
      updateFields.push(`address = $${paramCount}`);
      queryParams.push(address as any);
    }

    if (preferences !== undefined) {
      paramCount++;
      updateFields.push(`preferences = $${paramCount}`);
      queryParams.push(JSON.stringify(preferences));
    }

    if (is_verified !== undefined) {
      paramCount++;
      updateFields.push(`is_verified = $${paramCount}`);
      queryParams.push(is_verified as any);
    }

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    queryParams.push(Date.now());

    paramCount++;
    queryParams.push(user_id as any);

    const result = await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount} 
       RETURNING id, email, name, user_type, location_lat, location_lng, address, preferences, is_verified, last_login, created_at, updated_at`,
      queryParams
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Shop management endpoints - handles shop creation, updates, search with geospatial filtering.
  Implements distance-based queries and shop verification workflows.
*/

/*
  Mock external API function for distance calculation
  @@need:external-api: Geospatial service for accurate distance calculations between coordinates, accounting for roads and traffic
*/
function calculateDistance(lat1, lng1, lat2, lng2) {
  // Haversine formula for mock implementation
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// GET /api/shops - Search and list shops with filtering
app.get('/api/shops', optionalAuth, async (req, res) => {
  try {
    const params = searchShopsInputSchema.parse(req.query);
    const { query, shop_type, verified, delivery_available, location_lat, location_lng, radius_km, min_rating, limit, offset, sort_by, sort_order } = params;

    let whereConditions = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    if (query) {
      paramCount++;
      whereConditions.push(`(name ILIKE $${paramCount} OR address ILIKE $${paramCount})`);
      queryParams.push(`%${query}%`);
    }

    if (shop_type) {
      paramCount++;
      whereConditions.push(`shop_type = $${paramCount}`);
      queryParams.push(shop_type as any);
    }

    if (verified !== undefined) {
      paramCount++;
      whereConditions.push(`verified = $${paramCount}`);
      queryParams.push(verified as any);
    }

    if (delivery_available !== undefined) {
      paramCount++;
      whereConditions.push(`delivery_available = $${paramCount}`);
      queryParams.push(delivery_available as any);
    }

    if (min_rating !== undefined) {
      paramCount++;
      whereConditions.push(`rating_average >= $${paramCount}`);
      queryParams.push(min_rating as any);
    }

    // Distance filtering if location provided
    let distanceSelect = '';
    if (location_lat && location_lng) {
      distanceSelect = `, (6371 * acos(cos(radians($${paramCount + 1})) * cos(radians(location_lat)) * cos(radians(location_lng) - radians($${paramCount + 2})) + sin(radians($${paramCount + 1})) * sin(radians(location_lat)))) as distance_km`;
      paramCount += 2;
      queryParams.push(location_lat, location_lng);
      
      if (radius_km) {
        whereConditions.push(`(6371 * acos(cos(radians($${paramCount - 1})) * cos(radians(location_lat)) * cos(radians(location_lng) - radians($${paramCount})) + sin(radians($${paramCount - 1})) * sin(radians(location_lat)))) <= ${radius_km}`);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM shops ${whereClause}`,
      queryParams.slice(0, paramCount - (location_lat && location_lng ? 2 : 0))
    );

    // Get shops
    let orderByClause = `ORDER BY ${sort_by === 'distance' && location_lat && location_lng ? 'distance_km' : sort_by} ${sort_order}`;
    
    const result = await pool.query(
      `SELECT id, user_id, name, phones, location_lat, location_lng, address, hours, verified, business_license, shop_type, delivery_available, delivery_radius, delivery_fee_base, delivery_fee_per_km, minimum_order, cash_discount_percentage, rating_average, rating_count, response_time_hours, stock_accuracy_score, created_at, updated_at${distanceSelect}
       FROM shops ${whereClause}
       ${orderByClause}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    res.json({
      shops: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    });
  } catch (error) {
    console.error('Search shops error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/shops - Create new shop
app.post('/api/shops', authenticateToken, async (req, res) => {
  try {
    const validatedData = createShopInputSchema.parse({ user_id: req.user.id, ...req.body });
    const { user_id, name, phones, location_lat, location_lng, address, hours, business_license, shop_type, delivery_available, delivery_radius, delivery_fee_base, delivery_fee_per_km, minimum_order, cash_discount_percentage } = validatedData;

    // Check if user already has a shop
    const existingShop = await pool.query('SELECT id FROM shops WHERE user_id = $1', [user_id]);
    if (existingShop.rows.length > 0) {
      return res.status(409).json(createErrorResponse('User already has a shop', null, 'SHOP_ALREADY_EXISTS'));
    }

    const shopId = generateUUID();
    const timestamp = Date.now();

    const result = await pool.query(
      `INSERT INTO shops (id, user_id, name, phones, location_lat, location_lng, address, hours, business_license, shop_type, delivery_available, delivery_radius, delivery_fee_base, delivery_fee_per_km, minimum_order, cash_discount_percentage, verified, rating_average, rating_count, stock_accuracy_score, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [shopId, user_id, name, JSON.stringify(phones), location_lat, location_lng, address, JSON.stringify(hours), business_license, shop_type, delivery_available, delivery_radius, delivery_fee_base, delivery_fee_per_km, minimum_order, cash_discount_percentage, false, 0, 0, 100, timestamp, timestamp]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create shop error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/shops/:shop_id - Get shop details by ID
app.get('/api/shops/:shop_id', optionalAuth, async (req, res) => {
  try {
    const { shop_id } = req.params;

    const result = await pool.query('SELECT * FROM shops WHERE id = $1', [shop_id]);

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Shop not found', null, 'SHOP_NOT_FOUND'));
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get shop error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PUT /api/shops/:shop_id - Update shop information
app.put('/api/shops/:shop_id', authenticateToken, async (req, res) => {
  try {
    const { shop_id } = req.params;

    // Check if user owns this shop
    const shopOwner = await pool.query('SELECT user_id FROM shops WHERE id = $1', [shop_id]);
    if (shopOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Shop not found', null, 'SHOP_NOT_FOUND'));
    }

    if (shopOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot update other user shops', null, 'FORBIDDEN'));
    }

    const validatedData = updateShopInputSchema.parse({ id: shop_id, ...req.body });
    const updateData = { ...validatedData };
    delete updateData.id;

    let updateFields = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        paramCount++;
        if (key === 'phones' || key === 'hours') {
          updateFields.push(`${key} = $${paramCount}`);
          queryParams.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = $${paramCount}`);
          queryParams.push(value as any);
        }
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    queryParams.push(Date.now());

    paramCount++;
    queryParams.push(shop_id as any);

    const result = await pool.query(
      `UPDATE shops SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      queryParams
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update shop error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/shops/near-me - Find shops near current location
app.get('/api/shops/near-me', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, radius = 5, shop_type, product_search, limit = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json(createErrorResponse('Latitude and longitude are required', null, 'MISSING_COORDINATES'));
    }

    let whereConditions = ['true'];
    let queryParams: any[] = [parseFloat(lat as string), parseFloat(lng as string), parseFloat(radius as any)];
    let paramCount = 3;

    if (shop_type) {
      paramCount++;
      whereConditions.push(`shop_type = $${paramCount}`);
      queryParams.push(shop_type as any);
    }

    // Distance calculation and filtering
    const result = await pool.query(
      `SELECT s.*, 
       (6371 * acos(cos(radians($1)) * cos(radians(s.location_lat)) * cos(radians(s.location_lng) - radians($2)) + sin(radians($1)) * sin(radians(s.location_lat)))) as distance_km
       FROM shops s
       WHERE ${whereConditions.join(' AND ')}
       AND (6371 * acos(cos(radians($1)) * cos(radians(s.location_lat)) * cos(radians(s.location_lng) - radians($2)) + sin(radians($1)) * sin(radians(s.location_lat)))) <= $3
       ORDER BY distance_km ASC
       LIMIT $${paramCount + 1}`,
      [...queryParams, parseInt(limit as any)]
    );

    // Get top prices for each shop if product_search is provided
    const shopsWithPrices = await Promise.all(result.rows.map(async (shop) => {
      if (product_search) {
        const pricesResult = await pool.query(
          `SELECT pr.*, pv.*, p.canonical_name, i.in_stock
           FROM prices pr
           JOIN product_variants pv ON pr.variant_id = pv.id
           JOIN products p ON pv.product_id = p.id
           LEFT JOIN inventory i ON (pr.variant_id = i.variant_id AND pr.shop_id = i.shop_id)
           WHERE pr.shop_id = $1 AND p.canonical_name ILIKE $2
           ORDER BY pr.price_per_base_unit ASC
           LIMIT 3`,
          [shop.id, `%${product_search}%`]
        );

        shop.top_prices = pricesResult.rows.map(row => ({
          variant_id: row.variant_id,
          product_name: row.canonical_name,
          price: row.price,
          in_stock: row.in_stock || false
        }));
      }

      return shop;
    }));

    res.json({
      shops: shopsWithPrices
    });
  } catch (error) {
    console.error('Near me shops error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Category management endpoints - handles product category hierarchy and navigation.
  Implements tree-structured categories with path-based queries.
*/

// GET /api/categories - Get product categories with hierarchy
app.get('/api/categories', optionalAuth, async (req, res) => {
  try {
    const params = searchCategoriesInputSchema.parse(req.query);
    const { parent_id, query, is_active, limit, offset, sort_by, sort_order } = params;

    let whereConditions = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    if (parent_id !== undefined) {
      paramCount++;
      whereConditions.push(`parent_id ${parent_id === null ? 'IS NULL' : '= $' + paramCount}`);
      if (parent_id !== null) queryParams.push(parent_id as any);
    }

    if (query) {
      paramCount++;
      whereConditions.push(`(name ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
      queryParams.push(`%${query}%`);
    }

    if (is_active !== undefined) {
      paramCount++;
      whereConditions.push(`is_active = $${paramCount}`);
      queryParams.push(is_active as any);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM categories ${whereClause}`,
      queryParams
    );

    // Get categories
    const result = await pool.query(
      `SELECT * FROM categories ${whereClause}
       ORDER BY ${sort_by} ${sort_order}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    res.json({
      categories: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get categories error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/categories - Create new product category
app.post('/api/categories', authenticateToken, async (req, res) => {
  try {
    const validatedData = createCategoryInputSchema.parse(req.body);
    const { name, parent_id, category_path, description, image_url, sort_order, is_active } = validatedData;

    const categoryId = generateUUID();
    const timestamp = Date.now();

    const result = await pool.query(
      `INSERT INTO categories (id, name, parent_id, category_path, description, image_url, sort_order, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [categoryId, name, parent_id, category_path, description, image_url, sort_order, is_active, timestamp, timestamp]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create category error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/categories/:category_id - Get category by ID
app.get('/api/categories/:category_id', optionalAuth, async (req, res) => {
  try {
    const { category_id } = req.params;

    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [category_id]);

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Category not found', null, 'CATEGORY_NOT_FOUND'));
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Product management endpoints - handles product catalog, variants, and complex search operations.
  Implements canonical product mapping, synonym resolution, and price aggregation.
*/

// GET /api/products - Search products with advanced filtering
app.get('/api/products', optionalAuth, async (req, res) => {
  try {
    const params = searchProductsInputSchema.parse(req.query);
    const { query, category_id, subcategory, is_active, limit, offset, sort_by, sort_order } = params;

    let whereConditions = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    if (query) {
      paramCount++;
      whereConditions.push(`(canonical_name ILIKE $${paramCount} OR description ILIKE $${paramCount} OR synonyms::text ILIKE $${paramCount})`);
      queryParams.push(`%${query}%`);
    }

    if (category_id) {
      paramCount++;
      whereConditions.push(`category_id = $${paramCount}`);
      queryParams.push(category_id as any);
    }

    if (subcategory) {
      paramCount++;
      whereConditions.push(`subcategory = $${paramCount}`);
      queryParams.push(subcategory as any);
    }

    if (is_active !== undefined) {
      paramCount++;
      whereConditions.push(`is_active = $${paramCount}`);
      queryParams.push(is_active as any);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM products ${whereClause}`,
      queryParams
    );

    // Get products
    const result = await pool.query(
      `SELECT * FROM products ${whereClause}
       ORDER BY ${sort_by} ${sort_order}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    res.json({
      products: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    });
  } catch (error) {
    console.error('Search products error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/products - Create new product
app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const validatedData = createProductInputSchema.parse(req.body);
    const { canonical_name, category_id, subcategory, base_unit, description, specifications, synonyms, image_url, waste_factor_percentage, is_active } = validatedData;

    const productId = generateUUID();
    const timestamp = Date.now();

    const result = await pool.query(
      `INSERT INTO products (id, canonical_name, category_id, subcategory, base_unit, description, specifications, synonyms, image_url, waste_factor_percentage, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [productId, canonical_name, category_id, subcategory, base_unit, description, JSON.stringify(specifications), JSON.stringify(synonyms), image_url, waste_factor_percentage, is_active, timestamp, timestamp]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/products/:product_id - Get product details with variants and prices
app.get('/api/products/:product_id', optionalAuth, async (req, res) => {
  try {
    const { product_id } = req.params;
    const { quantity = 1, shop_id, location_lat, location_lng, radius = 10 } = req.query;

    // Get product
    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [product_id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Product not found', null, 'PRODUCT_NOT_FOUND'));
    }

    const product = productResult.rows[0];

    // Get variants with prices, shops, and inventory
    let variantQuery = `
      SELECT 
        pv.*,
        pr.id as price_id, pr.price, pr.currency, pr.price_per_base_unit, pr.bulk_pricing_tiers, pr.promotional_price, pr.promotion_start_date, pr.promotion_end_date, pr.source, pr.verified, pr.verifications_count, pr.last_verified_at, pr.created_at as price_created_at, pr.updated_at as price_updated_at,
        s.id as shop_id, s.name as shop_name, s.location_lat as shop_lat, s.location_lng as shop_lng, s.verified as shop_verified, s.rating_average, s.delivery_available, s.delivery_fee_base, s.delivery_fee_per_km,
        i.in_stock, i.stock_quantity, i.lead_time_days, i.minimum_order_quantity
    `;

    let queryParams: any[] = [product_id];
    let paramCount = 1;

    if (location_lat && location_lng) {
      variantQuery += `, (6371 * acos(cos(radians($${paramCount + 1})) * cos(radians(s.location_lat)) * cos(radians(s.location_lng) - radians($${paramCount + 2})) + sin(radians($${paramCount + 1})) * sin(radians(s.location_lat)))) as distance_km`;
      paramCount += 2;
      queryParams.push(parseFloat(location_lat as any), parseFloat(location_lng as any));
    }

    variantQuery += `
      FROM product_variants pv
      LEFT JOIN prices pr ON pv.id = pr.variant_id
      LEFT JOIN shops s ON pr.shop_id = s.id
      LEFT JOIN inventory i ON (pv.id = i.variant_id AND s.id = i.shop_id)
      WHERE pv.product_id = $1 AND pv.is_active = true
    `;

    if (shop_id) {
      paramCount++;
      variantQuery += ` AND s.id = $${paramCount}`;
      queryParams.push(shop_id as any);
    }

    if (location_lat && location_lng && radius) {
      variantQuery += ` AND (s.location_lat IS NULL OR (6371 * acos(cos(radians($${paramCount - 1})) * cos(radians(s.location_lat)) * cos(radians(s.location_lng) - radians($${paramCount})) + sin(radians($${paramCount - 1})) * sin(radians(s.location_lat)))) <= ${radius})`;
    }

    variantQuery += ` ORDER BY pv.brand, pr.price_per_base_unit ASC`;

    const variantsResult = await pool.query(variantQuery, queryParams);

    // Group results by variant
    const variantsMap = new Map();
    
    variantsResult.rows.forEach(row => {
      const variantId = row.id;
      
      if (!variantsMap.has(variantId)) {
        variantsMap.set(variantId, {
          id: row.id,
          product_id: row.product_id,
          brand: row.brand,
          grade: row.grade,
          size: row.size,
          pack_quantity: row.pack_quantity,
          pack_unit: row.pack_unit,
          unit_to_base_factor: row.unit_to_base_factor,
          sku: row.sku,
          barcode: row.barcode,
          image_url: row.image_url,
          specifications: row.specifications,
          is_active: row.is_active,
          created_at: row.created_at,
          updated_at: row.updated_at,
          prices: []
        });
      }

      if (row.price_id) {
        variantsMap.get(variantId).prices.push({
          id: row.price_id,
          price: row.price,
          currency: row.currency,
          price_per_base_unit: row.price_per_base_unit,
          bulk_pricing_tiers: row.bulk_pricing_tiers,
          promotional_price: row.promotional_price,
          promotion_start_date: row.promotion_start_date,
          promotion_end_date: row.promotion_end_date,
          source: row.source,
          verified: row.verified,
          verifications_count: row.verifications_count,
          last_verified_at: row.last_verified_at,
          created_at: row.price_created_at,
          updated_at: row.price_updated_at,
          shop: {
            id: row.shop_id,
            name: row.shop_name,
            location_lat: row.shop_lat,
            location_lng: row.shop_lng,
            verified: row.shop_verified,
            rating_average: row.rating_average,
            delivery_available: row.delivery_available,
            delivery_fee_base: row.delivery_fee_base,
            delivery_fee_per_km: row.delivery_fee_per_km
          },
          inventory: {
            in_stock: row.in_stock,
            stock_quantity: row.stock_quantity,
            lead_time_days: row.lead_time_days,
            minimum_order_quantity: row.minimum_order_quantity
          },
          distance_km: row.distance_km || null
        });
      }
    });

    product.variants = Array.from(variantsMap.values());

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/products/:product_id/variants - Get variants for a specific product
app.get('/api/products/:product_id/variants', optionalAuth, async (req, res) => {
  try {
    const { product_id } = req.params;
    const { brand, grade, is_active = true } = req.query;

    let whereConditions = [`product_id = $1`];
    let queryParams: any[] = [product_id];
    let paramCount = 1;

    if (brand) {
      paramCount++;
      whereConditions.push(`brand = $${paramCount}`);
      queryParams.push(brand as any);
    }

    if (grade) {
      paramCount++;
      whereConditions.push(`grade = $${paramCount}`);
      queryParams.push(grade as any);
    }

    if (is_active !== undefined) {
      paramCount++;
      whereConditions.push(`is_active = $${paramCount}`);
      queryParams.push(is_active as any);
    }

    const result = await pool.query(
      `SELECT * FROM product_variants WHERE ${whereConditions.join(' AND ')} ORDER BY brand, grade`,
      queryParams
    );

    res.json({
      variants: result.rows
    });
  } catch (error) {
    console.error('Get product variants error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Product variant management endpoints - handles product variations with different brands, grades, sizes.
  Supports SKU/barcode tracking and unit conversion factors.
*/

// GET /api/product-variants - Search product variants
app.get('/api/product-variants', optionalAuth, async (req, res) => {
  try {
    const params = searchProductVariantsInputSchema.parse(req.query);
    const { query, product_id, brand, grade, is_active, limit, offset } = params;

    let whereConditions = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    if (query) {
      paramCount++;
      whereConditions.push(`(brand ILIKE $${paramCount} OR grade ILIKE $${paramCount} OR size ILIKE $${paramCount} OR sku ILIKE $${paramCount})`);
      queryParams.push(`%${query}%`);
    }

    if (product_id) {
      paramCount++;
      whereConditions.push(`product_id = $${paramCount}`);
      queryParams.push(product_id as any);
    }

    if (brand) {
      paramCount++;
      whereConditions.push(`brand = $${paramCount}`);
      queryParams.push(brand as any);
    }

    if (grade) {
      paramCount++;
      whereConditions.push(`grade = $${paramCount}`);
      queryParams.push(grade as any);
    }

    if (is_active !== undefined) {
      paramCount++;
      whereConditions.push(`is_active = $${paramCount}`);
      queryParams.push(is_active as any);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM product_variants ${whereClause}`,
      queryParams
    );

    // Get variants
    const result = await pool.query(
      `SELECT * FROM product_variants ${whereClause}
       ORDER BY brand, grade
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    res.json({
      variants: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Search product variants error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/product-variants - Create new product variant
app.post('/api/product-variants', authenticateToken, async (req, res) => {
  try {
    const validatedData = createProductVariantInputSchema.parse(req.body);
    const { product_id, brand, grade, size, pack_quantity, pack_unit, unit_to_base_factor, sku, barcode, image_url, specifications, is_active } = validatedData;

    const variantId = generateUUID();
    const timestamp = Date.now();

    const result = await pool.query(
      `INSERT INTO product_variants (id, product_id, brand, grade, size, pack_quantity, pack_unit, unit_to_base_factor, sku, barcode, image_url, specifications, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [variantId, product_id, brand, grade, size, pack_quantity, pack_unit, unit_to_base_factor, sku, barcode, image_url, JSON.stringify(specifications), is_active, timestamp, timestamp]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product variant error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/product-variants/:variant_id - Get product variant by ID
app.get('/api/product-variants/:variant_id', optionalAuth, async (req, res) => {
  try {
    const { variant_id } = req.params;

    const result = await pool.query('SELECT * FROM product_variants WHERE id = $1', [variant_id]);

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Product variant not found', null, 'VARIANT_NOT_FOUND'));
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get product variant error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Price management endpoints - handles pricing data, bulk tiers, promotions, and cross-shop comparison.
  Implements complex price comparison algorithms with location-based optimization.
*/

// GET /api/prices - Search and compare prices across shops
app.get('/api/prices', optionalAuth, async (req, res) => {
  try {
    const params = searchPricesInputSchema.parse(req.query);
    const { variant_id, shop_id, min_price, max_price, currency, verified, has_promotion, limit, offset, sort_by, sort_order } = params;

    let whereConditions = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    if (variant_id) {
      paramCount++;
      whereConditions.push(`pr.variant_id = $${paramCount}`);
      queryParams.push(variant_id as any);
    }

    if (shop_id) {
      paramCount++;
      whereConditions.push(`pr.shop_id = $${paramCount}`);
      queryParams.push(shop_id as any);
    }

    if (min_price !== undefined) {
      paramCount++;
      whereConditions.push(`pr.price >= $${paramCount}`);
      queryParams.push(min_price as any);
    }

    if (max_price !== undefined) {
      paramCount++;
      whereConditions.push(`pr.price <= $${paramCount}`);
      queryParams.push(max_price as any);
    }

    if (currency) {
      paramCount++;
      whereConditions.push(`pr.currency = $${paramCount}`);
      queryParams.push(currency as any);
    }

    if (verified !== undefined) {
      paramCount++;
      whereConditions.push(`pr.verified = $${paramCount}`);
      queryParams.push(verified as any);
    }

    if (has_promotion !== undefined) {
      if (has_promotion) {
        whereConditions.push(`pr.promotional_price IS NOT NULL AND pr.promotion_start_date <= ${Date.now()} AND pr.promotion_end_date >= ${Date.now()}`);
      } else {
        whereConditions.push(`(pr.promotional_price IS NULL OR pr.promotion_start_date > ${Date.now()} OR pr.promotion_end_date < ${Date.now()})`);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM prices pr ${whereClause}`,
      queryParams
    );

    // Get prices with related data
    const result = await pool.query(
      `SELECT 
        pr.*,
        s.id as shop_id, s.name as shop_name, s.location_lat, s.location_lng, s.verified as shop_verified, s.rating_average, s.delivery_available,
        pv.id as variant_id, pv.brand, pv.grade, pv.size, pv.pack_quantity, pv.pack_unit,
        p.id as product_id, p.canonical_name, p.base_unit,
        i.in_stock, i.stock_quantity, i.lead_time_days
       FROM prices pr
       JOIN shops s ON pr.shop_id = s.id
       JOIN product_variants pv ON pr.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       LEFT JOIN inventory i ON (pr.variant_id = i.variant_id AND pr.shop_id = i.shop_id)
       ${whereClause}
       ORDER BY pr.${sort_by} ${sort_order}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    const prices = result.rows.map(row => ({
      id: row.id,
      shop_id: row.shop_id,
      variant_id: row.variant_id,
      price: row.price,
      currency: row.currency,
      price_per_base_unit: row.price_per_base_unit,
      bulk_pricing_tiers: row.bulk_pricing_tiers,
      promotional_price: row.promotional_price,
      promotion_start_date: row.promotion_start_date,
      promotion_end_date: row.promotion_end_date,
      source: row.source,
      verified: row.verified,
      verifications_count: row.verifications_count,
      last_verified_at: row.last_verified_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      shop: {
        id: row.shop_id,
        name: row.shop_name,
        location_lat: row.location_lat,
        location_lng: row.location_lng,
        verified: row.shop_verified,
        rating_average: row.rating_average,
        delivery_available: row.delivery_available
      },
      variant: {
        id: row.variant_id,
        brand: row.brand,
        grade: row.grade,
        size: row.size,
        pack_quantity: row.pack_quantity,
        pack_unit: row.pack_unit
      },
      product: {
        id: row.product_id,
        canonical_name: row.canonical_name,
        base_unit: row.base_unit
      },
      inventory: {
        in_stock: row.in_stock,
        stock_quantity: row.stock_quantity,
        lead_time_days: row.lead_time_days
      }
    }));

    res.json({
      prices,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Search prices error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/prices - Create or update price listing
app.post('/api/prices', authenticateToken, async (req, res) => {
  try {
    const validatedData = createPriceInputSchema.parse(req.body);
    const { shop_id, variant_id, price, currency, price_per_base_unit, bulk_pricing_tiers, promotional_price, promotion_start_date, promotion_end_date, source } = validatedData;

    // Verify user owns the shop
    const shopOwner = await pool.query('SELECT user_id FROM shops WHERE id = $1', [shop_id]);
    if (shopOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Shop not found', null, 'SHOP_NOT_FOUND'));
    }

    if (shopOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot update prices for other shops', null, 'FORBIDDEN'));
    }

    // Check if price already exists for this shop/variant combination
    const existingPrice = await pool.query('SELECT id FROM prices WHERE shop_id = $1 AND variant_id = $2', [shop_id, variant_id]);

    const timestamp = Date.now();

    if (existingPrice.rows.length > 0) {
      // Update existing price
      const result = await pool.query(
        `UPDATE prices SET price = $1, currency = $2, price_per_base_unit = $3, bulk_pricing_tiers = $4, promotional_price = $5, promotion_start_date = $6, promotion_end_date = $7, source = $8, updated_at = $9
         WHERE shop_id = $10 AND variant_id = $11 RETURNING *`,
        [price, currency, price_per_base_unit, JSON.stringify(bulk_pricing_tiers), promotional_price, promotion_start_date, promotion_end_date, source, timestamp, shop_id, variant_id]
      );

      res.json(result.rows[0]);
    } else {
      // Create new price
      const priceId = generateUUID();
      const result = await pool.query(
        `INSERT INTO prices (id, shop_id, variant_id, price, currency, price_per_base_unit, bulk_pricing_tiers, promotional_price, promotion_start_date, promotion_end_date, source, verified, verifications_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
        [priceId, shop_id, variant_id, price, currency, price_per_base_unit, JSON.stringify(bulk_pricing_tiers), promotional_price, promotion_start_date, promotion_end_date, source, false, 0, timestamp, timestamp]
      );

      res.status(201).json(result.rows[0]);
    }

    // Add to price history
    await pool.query(
      `INSERT INTO price_history (id, variant_id, shop_id, date, price, price_per_base_unit, currency, source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [generateUUID(), variant_id, shop_id, timestamp, price, price_per_base_unit, currency, source, timestamp]
    );

  } catch (error) {
    console.error('Create price error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Mock external API function for optimization algorithms
  @@need:external-api: Advanced optimization engine for multi-shop purchase optimization with delivery route planning and cost minimization algorithms
*/
async function optimizeMultiShopPurchases(items, shops, userLocation, deliveryOptions) {
  // Mock implementation - returns a simple optimization suggestion
  const optimizedResult = {
    cheapest_single_shop: null,
    optimized_multi_shop: [],
    total_savings: 0,
    estimated_delivery_time: null
  };

  // Find cheapest single shop (mock logic)
  let cheapestShop = null;
  let cheapestTotal = Infinity;

  shops.forEach(shop => {
    let shopTotal = 0;
    let canFulfillAll = true;

    items.forEach(item => {
      const shopPrice = item.shop_prices.find(p => p.shop_id === shop.id);
      if (!shopPrice || !shopPrice.in_stock) {
        canFulfillAll = false;
        return;
      }
      shopTotal += shopPrice.total_price;
    });

    if (canFulfillAll && shopTotal < cheapestTotal) {
      cheapestTotal = shopTotal;
      cheapestShop = { shop_id: shop.id, total_cost: shopTotal };
    }
  });

  optimizedResult.cheapest_single_shop = cheapestShop;

  // Mock multi-shop optimization
  optimizedResult.optimized_multi_shop = shops.slice(0, 2).map(shop => ({
    shop_id: shop.id,
    items: items.slice(0, Math.ceil(items.length / 2)).map(item => item.variant_id),
    cost: cheapestTotal * 0.6,
    delivery_fee: 50
  }));

  optimizedResult.total_savings = cheapestTotal * 0.15; // Mock 15% savings

  return optimizedResult;
}

// GET /api/prices/compare - Compare prices across multiple shops and products
app.get('/api/prices/compare', optionalAuth, async (req, res) => {
  try {
    const { product_ids, variant_ids, shop_ids, quantity = 1, include_delivery = false, waste_factor = 0, location_lat, location_lng } = req.query;

    let variantIdList = [];
    
    if (variant_ids) {
      variantIdList = (variant_ids as string).split(',');
    } else if (product_ids) {
      // Get variants for products
      const productIdList = (product_ids as string).split(',');
      const variantsResult = await pool.query(
        'SELECT id FROM product_variants WHERE product_id = ANY($1) AND is_active = true',
        [productIdList]
      );
      variantIdList = variantsResult.rows.map(row => row.id);
    }

    if (variantIdList.length === 0) {
      return res.status(400).json(createErrorResponse('No variants specified for comparison', null, 'NO_VARIANTS_SPECIFIED'));
    }

    let shopFilter = '';
    let queryParams: any[] = [variantIdList, parseFloat(quantity as any), parseFloat(waste_factor as any)];
    let paramCount = 3;

    if (shop_ids) {
      const shopIdList = (shop_ids as string).split(',');
      paramCount++;
      shopFilter = ` AND s.id = ANY($${paramCount})`;
      queryParams.push(shopIdList as any);
    }

    let distanceSelect = '';
    if (location_lat && location_lng) {
      distanceSelect = `, (6371 * acos(cos(radians($${paramCount + 1})) * cos(radians(s.location_lat)) * cos(radians(s.location_lng) - radians($${paramCount + 2})) + sin(radians($${paramCount + 1})) * sin(radians(s.location_lat)))) as distance_km`;
      paramCount += 2;
      queryParams.push(parseFloat(location_lat as any), parseFloat(location_lng as any));
    }

    // Get comprehensive comparison data
    const result = await pool.query(
      `SELECT 
        pv.id as variant_id,
        p.canonical_name, p.base_unit,
        pv.brand, pv.grade, pv.size, pv.pack_quantity, pv.unit_to_base_factor,
        s.id as shop_id, s.name as shop_name, s.location_lat, s.location_lng, s.delivery_available, s.delivery_fee_base, s.delivery_fee_per_km, s.minimum_order, s.verified, s.rating_average,
        pr.price, pr.price_per_base_unit, pr.bulk_pricing_tiers, pr.promotional_price, pr.verified as price_verified,
        i.in_stock, i.stock_quantity, i.lead_time_days${distanceSelect}
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       JOIN prices pr ON pv.id = pr.variant_id
       JOIN shops s ON pr.shop_id = s.id
       LEFT JOIN inventory i ON (pv.id = i.variant_id AND s.id = i.shop_id)
       WHERE pv.id = ANY($1)${shopFilter}
       ORDER BY pv.id, pr.price_per_base_unit ASC`,
      queryParams
    );

    // Group results by variant
    const comparisonMap = new Map();
    
    result.rows.forEach(row => {
      const variantId = row.variant_id;
      
      if (!comparisonMap.has(variantId)) {
        comparisonMap.set(variantId, {
          variant: {
            id: row.variant_id,
            brand: row.brand,
            grade: row.grade,
            size: row.size,
            pack_quantity: row.pack_quantity,
            unit_to_base_factor: row.unit_to_base_factor
          },
          product: {
            canonical_name: row.canonical_name,
            base_unit: row.base_unit
          },
          shop_prices: []
        });
      }

      const adjustedQuantity = parseFloat(quantity as any) * (1 + parseFloat(waste_factor as any));
      const totalPrice = row.price_per_base_unit * adjustedQuantity;
      let deliveryFee = 0;

      if (include_delivery && row.delivery_available && row.distance_km) {
        deliveryFee = (row.delivery_fee_base || 0) + ((row.delivery_fee_per_km || 0) * row.distance_km);
      }

      comparisonMap.get(variantId).shop_prices.push({
        shop: {
          id: row.shop_id,
          name: row.shop_name,
          location_lat: row.location_lat,
          location_lng: row.location_lng,
          delivery_available: row.delivery_available,
          verified: row.verified,
          rating_average: row.rating_average
        },
        price: {
          unit_price: row.price_per_base_unit,
          total_price: totalPrice,
          bulk_tiers: row.bulk_pricing_tiers,
          promotional_price: row.promotional_price,
          verified: row.price_verified
        },
        inventory: {
          in_stock: row.in_stock || false,
          stock_quantity: row.stock_quantity,
          lead_time_days: row.lead_time_days || 0
        },
        delivery_fee: deliveryFee,
        distance_km: row.distance_km || null
      });
    });

    const comparison = Array.from(comparisonMap.values());

    // Generate optimization suggestions
    const allShops = [...new Set(result.rows.map(row => ({ id: row.shop_id, name: row.shop_name })))];
    const optimization = await optimizeMultiShopPurchases(comparison, allShops, { lat: location_lat, lng: location_lng }, { include_delivery });

    res.json({
      comparison,
      optimization
    });
  } catch (error) {
    console.error('Compare prices error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  BOM (Bill of Materials) management endpoints - handles project-based material lists.
  Implements cost calculation, optimization, sharing, and collaborative editing features.
*/

// GET /api/boms - Get user's bill of materials
app.get('/api/boms', authenticateToken, async (req, res) => {
  try {
    const params: any = searchBomsInputSchema.parse({ user_id: req.user.id, ...req.query });
    const { query, project_type, status, is_public, template, limit, offset, sort_by, sort_order } = params;

    let whereConditions = [`user_id = $1`];
    let queryParams: any[] = [req.user.id];
    let paramCount = 1;

    if (query) {
      paramCount++;
      whereConditions.push(`(title ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
      queryParams.push(`%${query}%`);
    }

    if (project_type) {
      paramCount++;
      whereConditions.push(`project_type = $${paramCount}`);
      queryParams.push(project_type as any);
    }

    if (status) {
      paramCount++;
      whereConditions.push(`status = $${paramCount}`);
      queryParams.push(status as any);
    }

    if (is_public !== undefined) {
      paramCount++;
      whereConditions.push(`is_public = $${paramCount}`);
      queryParams.push(is_public as any);
    }

    if (template) {
      paramCount++;
      whereConditions.push(`template = $${paramCount}`);
      queryParams.push(template as any);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM boms WHERE ${whereClause}`,
      queryParams
    );

    // Get BOMs
    const result = await pool.query(
      `SELECT * FROM boms WHERE ${whereClause}
       ORDER BY ${sort_by} ${sort_order}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    res.json({
      boms: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get BOMs error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/boms - Create new BOM
app.post('/api/boms', authenticateToken, async (req, res) => {
  try {
    const validatedData = createBomInputSchema.parse({ user_id: req.user.id, ...req.body });
    const { user_id, title, description, project_type, template, duplicate_source_id, is_public } = validatedData;

    const bomId = generateUUID();
    const timestamp = Date.now();

    let items = [];

    // If duplicating from another BOM, copy its items
    if (duplicate_source_id) {
      const sourceItems = await pool.query(
        'SELECT variant_id, quantity, unit, waste_factor, notes FROM bom_items WHERE bom_id = $1',
        [duplicate_source_id]
      );
      items = sourceItems.rows;
    }

    // Create BOM
    const result = await pool.query(
      `INSERT INTO boms (id, user_id, title, description, project_type, template, total_cost, item_count, status, is_public, duplicate_source_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [bomId, user_id, title, description, project_type, template, 0, items.length, 'draft', is_public, duplicate_source_id, timestamp, timestamp]
    );

    // Add items if duplicating
    if (items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await pool.query(
          `INSERT INTO bom_items (id, bom_id, variant_id, quantity, unit, waste_factor, total_quantity_needed, notes, sort_order, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [generateUUID(), bomId, item.variant_id, item.quantity, item.unit, item.waste_factor, item.quantity * (1 + item.waste_factor), item.notes, i, timestamp, timestamp]
        );
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create BOM error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/boms/:bom_id - Get BOM details with items
app.get('/api/boms/:bom_id', authenticateToken, async (req, res) => {
  try {
    const { bom_id } = req.params;

    // Get BOM
    const bomResult = await pool.query('SELECT * FROM boms WHERE id = $1', [bom_id]);

    if (bomResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM not found', null, 'BOM_NOT_FOUND'));
    }

    const bom = bomResult.rows[0];

    // Check access permissions
    if (bom.user_id !== req.user.id && !bom.is_public) {
      return res.status(403).json(createErrorResponse('Access denied to this BOM', null, 'BOM_ACCESS_DENIED'));
    }

    // Get BOM items with product details
    const itemsResult = await pool.query(
      `SELECT 
        bi.*,
        pv.brand, pv.grade, pv.size, pv.pack_quantity, pv.pack_unit,
        p.canonical_name, p.base_unit, p.image_url
       FROM bom_items bi
       JOIN product_variants pv ON bi.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       WHERE bi.bom_id = $1
       ORDER BY bi.sort_order`,
      [bom_id]
    );

    bom.items = itemsResult.rows;

    res.json(bom);
  } catch (error) {
    console.error('Get BOM error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PUT /api/boms/:bom_id - Update BOM details
app.put('/api/boms/:bom_id', authenticateToken, async (req, res) => {
  try {
    const { bom_id } = req.params;

    // Check if user owns this BOM
    const bomOwner = await pool.query('SELECT user_id FROM boms WHERE id = $1', [bom_id]);
    if (bomOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM not found', null, 'BOM_NOT_FOUND'));
    }

    if (bomOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot update other user BOMs', null, 'FORBIDDEN'));
    }

    const validatedData = updateBomInputSchema.parse({ id: bom_id, ...req.body });
    const updateData = { ...validatedData };
    delete updateData.id;

    let updateFields = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        queryParams.push(value as any);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    queryParams.push(Date.now());

    paramCount++;
    queryParams.push(bom_id as any);

    const result = await pool.query(
      `UPDATE boms SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      queryParams
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update BOM error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// DELETE /api/boms/:bom_id - Delete BOM
app.delete('/api/boms/:bom_id', authenticateToken, async (req, res) => {
  try {
    const { bom_id } = req.params;

    // Check if user owns this BOM
    const bomOwner = await pool.query('SELECT user_id FROM boms WHERE id = $1', [bom_id]);
    if (bomOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM not found', null, 'BOM_NOT_FOUND'));
    }

    if (bomOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot delete other user BOMs', null, 'FORBIDDEN'));
    }

    // Delete BOM items first (foreign key constraint)
    await pool.query('DELETE FROM bom_items WHERE bom_id = $1', [bom_id]);
    
    // Delete BOM
    await pool.query('DELETE FROM boms WHERE id = $1', [bom_id]);

    res.status(204).send();
  } catch (error) {
    console.error('Delete BOM error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/boms/:bom_id/items - Get BOM items
app.get('/api/boms/:bom_id/items', authenticateToken, async (req, res) => {
  try {
    const { bom_id } = req.params;

    // Check BOM access
    const bomResult = await pool.query('SELECT user_id, is_public FROM boms WHERE id = $1', [bom_id]);
    if (bomResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM not found', null, 'BOM_NOT_FOUND'));
    }

    const bom = bomResult.rows[0];
    if (bom.user_id !== req.user.id && !bom.is_public) {
      return res.status(403).json(createErrorResponse('Access denied to this BOM', null, 'BOM_ACCESS_DENIED'));
    }

    // Get items with product details and best prices
    const result = await pool.query(
      `SELECT 
        bi.*,
        pv.brand, pv.grade, pv.size, pv.pack_quantity, pv.pack_unit, pv.unit_to_base_factor,
        p.canonical_name, p.base_unit, p.image_url, p.waste_factor_percentage
       FROM bom_items bi
       JOIN product_variants pv ON bi.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       WHERE bi.bom_id = $1
       ORDER BY bi.sort_order`,
      [bom_id]
    );

    // Get best prices for each item
    const itemsWithPrices = await Promise.all(result.rows.map(async (item) => {
      const pricesResult = await pool.query(
        `SELECT pr.*, s.name as shop_name, s.verified as shop_verified, s.rating_average
         FROM prices pr
         JOIN shops s ON pr.shop_id = s.id
         WHERE pr.variant_id = $1
         ORDER BY pr.price_per_base_unit ASC
         LIMIT 3`,
        [item.variant_id]
      );

      item.best_prices = pricesResult.rows.map(price => ({
        ...price,
        shop: {
          name: price.shop_name,
          verified: price.shop_verified,
          rating_average: price.rating_average
        }
      }));

      return item;
    }));

    res.json({
      items: itemsWithPrices
    });
  } catch (error) {
    console.error('Get BOM items error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/boms/:bom_id/items - Add item to BOM
app.post('/api/boms/:bom_id/items', authenticateToken, async (req, res) => {
  try {
    const { bom_id } = req.params;

    // Check if user owns this BOM
    const bomOwner = await pool.query('SELECT user_id FROM boms WHERE id = $1', [bom_id]);
    if (bomOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM not found', null, 'BOM_NOT_FOUND'));
    }

    if (bomOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot modify other user BOMs', null, 'FORBIDDEN'));
    }

    const { variant_id, quantity, unit, waste_factor = 0, notes } = req.body;

    if (!variant_id || !quantity || !unit) {
      return res.status(400).json(createErrorResponse('variant_id, quantity, and unit are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    // Get next sort order
    const sortOrderResult = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM bom_items WHERE bom_id = $1',
      [bom_id]
    );
    const sortOrder = sortOrderResult.rows[0].next_order;

    const itemId = generateUUID();
    const timestamp = Date.now();
    const totalQuantityNeeded = parseFloat(quantity as any) * (1 + parseFloat(waste_factor as any));

    // Add item
    const result = await pool.query(
      `INSERT INTO bom_items (id, bom_id, variant_id, quantity, unit, waste_factor, total_quantity_needed, notes, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [itemId, bom_id, variant_id, quantity, unit, waste_factor, totalQuantityNeeded, notes, sortOrder, timestamp, timestamp]
    );

    // Update BOM item count
    await pool.query(
      'UPDATE boms SET item_count = (SELECT COUNT(*) FROM bom_items WHERE bom_id = $1), updated_at = $2 WHERE id = $1',
      [bom_id, timestamp]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add BOM item error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PUT /api/boms/:bom_id/items/:item_id - Update BOM item
app.put('/api/boms/:bom_id/items/:item_id', authenticateToken, async (req, res) => {
  try {
    const { bom_id, item_id } = req.params;

    // Check if user owns this BOM
    const bomOwner = await pool.query('SELECT user_id FROM boms WHERE id = $1', [bom_id]);
    if (bomOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM not found', null, 'BOM_NOT_FOUND'));
    }

    if (bomOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot modify other user BOMs', null, 'FORBIDDEN'));
    }

    const { quantity, unit, waste_factor, notes, sort_order } = req.body;

    let updateFields = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    if (quantity !== undefined) {
      paramCount++;
      updateFields.push(`quantity = $${paramCount}`);
      queryParams.push(quantity as any);
      
      // Recalculate total quantity needed
      const currentWasteFactor = waste_factor !== undefined ? waste_factor : 0;
      paramCount++;
      updateFields.push(`total_quantity_needed = $${paramCount}`);
      queryParams.push(parseFloat(quantity as any) * (1 + parseFloat(currentWasteFactor as any)));
    }

    if (unit !== undefined) {
      paramCount++;
      updateFields.push(`unit = $${paramCount}`);
      queryParams.push(unit as any);
    }

    if (waste_factor !== undefined) {
      paramCount++;
      updateFields.push(`waste_factor = $${paramCount}`);
      queryParams.push(waste_factor as any);
    }

    if (notes !== undefined) {
      paramCount++;
      updateFields.push(`notes = $${paramCount}`);
      queryParams.push(notes as any);
    }

    if (sort_order !== undefined) {
      paramCount++;
      updateFields.push(`sort_order = $${paramCount}`);
      queryParams.push(sort_order as any);
    }

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    queryParams.push(Date.now());

    paramCount++;
    queryParams.push(item_id as any);

    const result = await pool.query(
      `UPDATE bom_items SET ${updateFields.join(', ')} WHERE id = $${paramCount} AND bom_id = '${bom_id}' RETURNING *`,
      queryParams
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM item not found', null, 'BOM_ITEM_NOT_FOUND'));
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update BOM item error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// DELETE /api/boms/:bom_id/items/:item_id - Remove item from BOM
app.delete('/api/boms/:bom_id/items/:item_id', authenticateToken, async (req, res) => {
  try {
    const { bom_id, item_id } = req.params;

    // Check if user owns this BOM
    const bomOwner = await pool.query('SELECT user_id FROM boms WHERE id = $1', [bom_id]);
    if (bomOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM not found', null, 'BOM_NOT_FOUND'));
    }

    if (bomOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot modify other user BOMs', null, 'FORBIDDEN'));
    }

    // Delete item
    const result = await pool.query('DELETE FROM bom_items WHERE id = $1 AND bom_id = $2', [item_id, bom_id]);

    if (result.rowCount === 0) {
      return res.status(404).json(createErrorResponse('BOM item not found', null, 'BOM_ITEM_NOT_FOUND'));
    }

    // Update BOM item count
    await pool.query(
      'UPDATE boms SET item_count = (SELECT COUNT(*) FROM bom_items WHERE bom_id = $1), updated_at = $2 WHERE id = $1',
      [bom_id, Date.now()]
    );

    res.status(204).send();
  } catch (error) {
    console.error('Remove BOM item error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/boms/:bom_id/duplicate - Create duplicate of existing BOM
app.post('/api/boms/:bom_id/duplicate', authenticateToken, async (req, res) => {
  try {
    const { bom_id } = req.params;
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json(createErrorResponse('Title is required', null, 'MISSING_TITLE'));
    }

    // Check BOM access
    const bomResult = await pool.query('SELECT user_id, is_public, project_type, template FROM boms WHERE id = $1', [bom_id]);
    if (bomResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM not found', null, 'BOM_NOT_FOUND'));
    }

    const sourceBom = bomResult.rows[0];
    if (sourceBom.user_id !== req.user.id && !sourceBom.is_public) {
      return res.status(403).json(createErrorResponse('Access denied to this BOM', null, 'BOM_ACCESS_DENIED'));
    }

    // Create duplicate BOM
    const duplicateBomId = generateUUID();
    const timestamp = Date.now();

    const result = await pool.query(
      `INSERT INTO boms (id, user_id, title, description, project_type, template, total_cost, item_count, status, is_public, duplicate_source_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [duplicateBomId, req.user.id, title, description, sourceBom.project_type, sourceBom.template, 0, 0, 'draft', false, bom_id, timestamp, timestamp]
    );

    // Copy items
    const itemsResult = await pool.query(
      'SELECT variant_id, quantity, unit, waste_factor, notes, sort_order FROM bom_items WHERE bom_id = $1 ORDER BY sort_order',
      [bom_id]
    );

    for (const item of itemsResult.rows) {
      await pool.query(
        `INSERT INTO bom_items (id, bom_id, variant_id, quantity, unit, waste_factor, total_quantity_needed, notes, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [generateUUID(), duplicateBomId, item.variant_id, item.quantity, item.unit, item.waste_factor, item.quantity * (1 + item.waste_factor), item.notes, item.sort_order, timestamp, timestamp]
      );
    }

    // Update item count
    await pool.query(
      'UPDATE boms SET item_count = $1 WHERE id = $2',
      [itemsResult.rows.length, duplicateBomId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Duplicate BOM error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Mock external API function for BOM cost analysis
  @@need:external-api: Advanced cost analysis service with market intelligence, supplier reliability scoring, and procurement optimization algorithms
*/
async function analyzeBomCosts(bomItems, userLocation, includeDelivery) {
  // Mock implementation returns realistic cost analysis
  const analysis = {
    total_cost: 0,
    item_count: bomItems.length,
    shop_breakdown: [],
    optimization_suggestions: {
      cheapest_single_shop: null,
      multi_shop_optimal: []
    },
    missing_items: []
  };

  // Mock shop breakdown
  const mockShops = [
    { id: 'shop_001', name: 'Dubai Building Materials Co.', total_cost: 15750.80, available_items: 12, missing_items: 0, delivery_fee: 150 },
    { id: 'shop_002', name: 'Al Mansoori Hardware Store', total_cost: 16200.50, available_items: 10, missing_items: 2, delivery_fee: 100 },
    { id: 'shop_003', name: 'Premium Tools Outlet', total_cost: 18500.25, available_items: 8, missing_items: 4, delivery_fee: 200 }
  ];

  analysis.shop_breakdown = mockShops;
  analysis.total_cost = Math.min(...mockShops.map(s => s.total_cost));
  
  analysis.optimization_suggestions.cheapest_single_shop = {
    shop_id: mockShops[0].id,
    total_cost: mockShops[0].total_cost,
    missing_items: []
  };

  analysis.optimization_suggestions.multi_shop_optimal = [
    {
      shop_id: mockShops[0].id,
      items: bomItems.slice(0, Math.ceil(bomItems.length * 0.7)).map(item => item.variant_id),
      cost: mockShops[0].total_cost * 0.7
    },
    {
      shop_id: mockShops[1].id,
      items: bomItems.slice(Math.ceil(bomItems.length * 0.7)).map(item => item.variant_id),
      cost: mockShops[1].total_cost * 0.3
    }
  ];

  return analysis;
}

// GET /api/boms/:bom_id/cost-analysis - Get detailed cost analysis for BOM
app.get('/api/boms/:bom_id/cost-analysis', authenticateToken, async (req, res) => {
  try {
    const { bom_id } = req.params;
    const { location_lat, location_lng, include_delivery = false } = req.query;

    // Check BOM access
    const bomResult = await pool.query('SELECT user_id, is_public FROM boms WHERE id = $1', [bom_id]);
    if (bomResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM not found', null, 'BOM_NOT_FOUND'));
    }

    const bom = bomResult.rows[0];
    if (bom.user_id !== req.user.id && !bom.is_public) {
      return res.status(403).json(createErrorResponse('Access denied to this BOM', null, 'BOM_ACCESS_DENIED'));
    }

    // Get BOM items
    const itemsResult = await pool.query(
      `SELECT bi.*, pv.brand, p.canonical_name 
       FROM bom_items bi
       JOIN product_variants pv ON bi.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       WHERE bi.bom_id = $1`,
      [bom_id]
    );

    if (itemsResult.rows.length === 0) {
      return res.json({
        total_cost: 0,
        item_count: 0,
        shop_breakdown: [],
        optimization_suggestions: {
          cheapest_single_shop: null,
          multi_shop_optimal: []
        },
        missing_items: []
      });
    }

    // Perform cost analysis using mock external service
    const userLocation = location_lat && location_lng ? { lat: location_lat, lng: location_lng } : null;
    const analysis = await analyzeBomCosts(itemsResult.rows, userLocation, include_delivery);

    res.json(analysis);
  } catch (error) {
    console.error('BOM cost analysis error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/boms/:bom_id/share - Generate shareable link for BOM
app.post('/api/boms/:bom_id/share', authenticateToken, async (req, res) => {
  try {
    const { bom_id } = req.params;
    const { is_public = true, expires_at = null } = req.body;

    // Check if user owns this BOM
    const bomOwner = await pool.query('SELECT user_id FROM boms WHERE id = $1', [bom_id]);
    if (bomOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM not found', null, 'BOM_NOT_FOUND'));
    }

    if (bomOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot share other user BOMs', null, 'FORBIDDEN'));
    }

    const sharedToken = generateUUID();
    
    await pool.query(
      'UPDATE boms SET shared_token = $1, is_public = $2, updated_at = $3 WHERE id = $4',
      [sharedToken, is_public, Date.now(), bom_id]
    );

    const shareUrl = `${req.protocol}://${req.get('host')}/api/boms/shared/${sharedToken}`;

    res.json({
      shared_token: sharedToken,
      share_url: shareUrl,
      expires_at: expires_at
    });
  } catch (error) {
    console.error('Share BOM error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/boms/shared/:token - Access shared BOM via token
app.get('/api/boms/shared/:token', optionalAuth, async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query('SELECT * FROM boms WHERE shared_token = $1 AND is_public = true', [token]);

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Shared BOM not found or access denied', null, 'SHARED_BOM_NOT_FOUND'));
    }

    const bom = result.rows[0];

    // Get items
    const itemsResult = await pool.query(
      `SELECT 
        bi.*,
        pv.brand, pv.grade, pv.size, pv.pack_quantity, pv.pack_unit,
        p.canonical_name, p.base_unit, p.image_url
       FROM bom_items bi
       JOIN product_variants pv ON bi.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       WHERE bi.bom_id = $1
       ORDER BY bi.sort_order`,
      [bom.id]
    );

    bom.items = itemsResult.rows;

    res.json(bom);
  } catch (error) {
    console.error('Get shared BOM error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  RFQ (Request for Quote) management endpoints - handles structured quote requests between buyers and sellers.
  Implements multi-party communication, deadline management, and quote comparison features.
*/

// GET /api/rfqs - Get user's RFQs with filtering
app.get('/api/rfqs', authenticateToken, async (req, res) => {
  try {
    const params: any = searchRfqsInputSchema.parse(req.query);
    const { query, status, priority, has_deadline, shop_id, limit, offset, sort_by, sort_order } = params;

    let whereConditions = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    // Different view for buyers vs sellers
    if (req.user.user_type === 'buyer') {
      paramCount++;
      whereConditions.push(`r.user_id = $${paramCount}`);
      queryParams.push(req.user.id);
    } else if (req.user.user_type === 'seller' && shop_id) {
      // For sellers, show RFQs they've been invited to or have responded to
      paramCount++;
      whereConditions.push(`EXISTS (SELECT 1 FROM rfq_shop_invites rsi WHERE rsi.rfq_id = r.id AND rsi.shop_id = $${paramCount})`);
      queryParams.push(shop_id as any);
    } else {
      return res.status(400).json(createErrorResponse('shop_id required for seller accounts', null, 'SHOP_ID_REQUIRED'));
    }

    if (query) {
      paramCount++;
      whereConditions.push(`(r.title ILIKE $${paramCount} OR r.description ILIKE $${paramCount})`);
      queryParams.push(`%${query}%`);
    }

    if (status) {
      paramCount++;
      whereConditions.push(`r.status = $${paramCount}`);
      queryParams.push(status as any);
    }

    if (priority) {
      paramCount++;
      whereConditions.push(`r.priority = $${paramCount}`);
      queryParams.push(priority as any);
    }

    if (has_deadline !== undefined) {
      if (has_deadline) {
        whereConditions.push(`r.deadline IS NOT NULL`);
      } else {
        whereConditions.push(`r.deadline IS NULL`);
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM rfqs r ${whereClause}`,
      queryParams
    );

    // Get RFQs with BOM details
    const result = await pool.query(
      `SELECT 
        r.*,
        b.title as bom_title, b.item_count
       FROM rfqs r
       JOIN boms b ON r.bom_id = b.id
       ${whereClause}
       ORDER BY r.${sort_by} ${sort_order}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    const rfqs = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      bom_id: row.bom_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      deadline: row.deadline,
      delivery_location_lat: row.delivery_location_lat,
      delivery_location_lng: row.delivery_location_lng,
      delivery_address: row.delivery_address,
      special_requirements: row.special_requirements,
      budget_limit: row.budget_limit,
      responses_count: row.responses_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      bom: {
        title: row.bom_title,
        item_count: row.item_count
      }
    }));

    res.json({
      rfqs,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get RFQs error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/rfqs - Create new RFQ
app.post('/api/rfqs', authenticateToken, async (req, res) => {
  try {
    const validatedData = createRfqInputSchema.parse({ user_id: req.user.id, ...req.body });
    const { user_id, bom_id, title, description, priority, deadline, delivery_location_lat, delivery_location_lng, delivery_address, special_requirements, budget_limit } = validatedData;

    // Verify BOM exists and belongs to user
    const bomResult = await pool.query('SELECT id FROM boms WHERE id = $1 AND user_id = $2', [bom_id, user_id]);
    if (bomResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('BOM not found or access denied', null, 'BOM_NOT_FOUND'));
    }

    const rfqId = generateUUID();
    const timestamp = Date.now();

    const result = await pool.query(
      `INSERT INTO rfqs (id, user_id, bom_id, title, description, status, priority, deadline, delivery_location_lat, delivery_location_lng, delivery_address, special_requirements, budget_limit, responses_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [rfqId, user_id, bom_id, title, description, 'pending', priority, deadline, delivery_location_lat, delivery_location_lng, delivery_address, special_requirements, budget_limit, 0, timestamp, timestamp]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create RFQ error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/rfqs/:rfq_id - Get RFQ details with BOM and replies
app.get('/api/rfqs/:rfq_id', authenticateToken, async (req, res) => {
  try {
    const { rfq_id } = req.params;

    // Get RFQ
    const rfqResult = await pool.query('SELECT * FROM rfqs WHERE id = $1', [rfq_id]);
    if (rfqResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('RFQ not found', null, 'RFQ_NOT_FOUND'));
    }

    const rfq = rfqResult.rows[0];

    // Check access permissions
    let hasAccess = false;
    if (req.user.user_type === 'buyer' && rfq.user_id === req.user.id) {
      hasAccess = true;
    } else if (req.user.user_type === 'seller') {
      // Check if seller has been invited or has a shop that responded
      const shopAccess = await pool.query(
        `SELECT 1 FROM rfq_shop_invites rsi 
         JOIN shops s ON rsi.shop_id = s.id 
         WHERE rsi.rfq_id = $1 AND s.user_id = $2`,
        [rfq_id, req.user.id]
      );
      hasAccess = shopAccess.rows.length > 0;
    }

    if (!hasAccess) {
      return res.status(403).json(createErrorResponse('Access denied to this RFQ', null, 'RFQ_ACCESS_DENIED'));
    }

    // Get BOM with items
    const bomResult = await pool.query(
      `SELECT 
        b.*,
        COALESCE(json_agg(
          json_build_object(
            'id', bi.id,
            'variant_id', bi.variant_id,
            'quantity', bi.quantity,
            'unit', bi.unit,
            'waste_factor', bi.waste_factor,
            'total_quantity_needed', bi.total_quantity_needed,
            'notes', bi.notes,
            'sort_order', bi.sort_order,
            'variant', json_build_object(
              'brand', pv.brand,
              'grade', pv.grade,
              'size', pv.size
            ),
            'product', json_build_object(
              'canonical_name', p.canonical_name,
              'base_unit', p.base_unit
            )
          ) ORDER BY bi.sort_order
        ) FILTER (WHERE bi.id IS NOT NULL), '[]') as items
       FROM boms b
       LEFT JOIN bom_items bi ON b.id = bi.bom_id
       LEFT JOIN product_variants pv ON bi.variant_id = pv.id
       LEFT JOIN products p ON pv.product_id = p.id
       WHERE b.id = $1
       GROUP BY b.id`,
      [rfq.bom_id]
    );

    // Get replies with shop details
    const repliesResult = await pool.query(
      `SELECT 
        rr.*,
        s.name as shop_name, s.verified as shop_verified, s.rating_average, s.location_lat, s.location_lng
       FROM rfq_replies rr
       JOIN shops s ON rr.shop_id = s.id
       WHERE rr.rfq_id = $1
       ORDER BY rr.created_at`,
      [rfq_id]
    );

    rfq.bom = bomResult.rows[0];
    rfq.replies = repliesResult.rows.map(reply => ({
      ...reply,
      shop: {
        id: reply.shop_id,
        name: reply.shop_name,
        verified: reply.shop_verified,
        rating_average: reply.rating_average,
        location_lat: reply.location_lat,
        location_lng: reply.location_lng
      }
    }));

    res.json(rfq);
  } catch (error) {
    console.error('Get RFQ error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PUT /api/rfqs/:rfq_id - Update RFQ details
app.put('/api/rfqs/:rfq_id', authenticateToken, async (req, res) => {
  try {
    const { rfq_id } = req.params;

    // Check if user owns this RFQ
    const rfqOwner = await pool.query('SELECT user_id FROM rfqs WHERE id = $1', [rfq_id]);
    if (rfqOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('RFQ not found', null, 'RFQ_NOT_FOUND'));
    }

    if (rfqOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot update other user RFQs', null, 'FORBIDDEN'));
    }

    const validatedData = updateRfqInputSchema.parse({ id: rfq_id, ...req.body });
    const updateData = { ...validatedData };
    delete updateData.id;

    let updateFields = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        queryParams.push(value as any);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    queryParams.push(Date.now());

    paramCount++;
    queryParams.push(rfq_id as any);

    const result = await pool.query(
      `UPDATE rfqs SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      queryParams
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update RFQ error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Mock external API function for shop invitation notifications
  @@need:external-api: Multi-channel notification service for email, SMS, and push notifications to shop owners about new RFQ invitations
*/
async function sendRfqInvitations(shopIds, rfqData, senderInfo) {
  // Mock implementation - logs invitation details
  const invitations = shopIds.map(shopId => ({
    shop_id: shopId,
    rfq_id: rfqData.id,
    invited_at: Date.now(),
    notification_sent: true,
    channels: ['email', 'push']
  }));

  console.log(`Mock: Sent RFQ invitations for RFQ ${rfqData.id} to ${shopIds.length} shops`);
  
  return {
    successful_invitations: invitations.length,
    failed_invitations: 0,
    invitations
  };
}

// POST /api/rfqs/:rfq_id/invite-shops - Invite shops to respond to RFQ
app.post('/api/rfqs/:rfq_id/invite-shops', authenticateToken, async (req, res) => {
  try {
    const { rfq_id } = req.params;
    const { shop_ids, message } = req.body;

    if (!shop_ids || !Array.isArray(shop_ids) || shop_ids.length === 0) {
      return res.status(400).json(createErrorResponse('shop_ids array is required', null, 'MISSING_SHOP_IDS'));
    }

    // Check if user owns this RFQ
    const rfqOwner = await pool.query('SELECT * FROM rfqs WHERE id = $1', [rfq_id]);
    if (rfqOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('RFQ not found', null, 'RFQ_NOT_FOUND'));
    }

    if (rfqOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot invite shops to other user RFQs', null, 'FORBIDDEN'));
    }

    const rfq = rfqOwner.rows[0];

    // Verify shops exist
    const shopsResult = await pool.query('SELECT id FROM shops WHERE id = ANY($1)', [shop_ids]);
    const validShopIds = shopsResult.rows.map(row => row.id);

    if (validShopIds.length === 0) {
      return res.status(400).json(createErrorResponse('No valid shops found', null, 'NO_VALID_SHOPS'));
    }

    // Insert invitations (ignore duplicates)
    const timestamp = Date.now();
    const invitationPromises = validShopIds.map(shopId => 
      pool.query(
        `INSERT INTO rfq_shop_invites (id, rfq_id, shop_id, invited_at) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (rfq_id, shop_id) DO NOTHING`,
        [generateUUID(), rfq_id, shopId, timestamp]
      )
    );

    await Promise.all(invitationPromises);

    // Send notifications (mock external service)
    await sendRfqInvitations(validShopIds, rfq, req.user);

    res.json({
      invited_count: validShopIds.length,
      shop_ids: validShopIds
    });
  } catch (error) {
    console.error('Invite shops to RFQ error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/rfqs/:rfq_id/replies - Get replies for RFQ
app.get('/api/rfqs/:rfq_id/replies', authenticateToken, async (req, res) => {
  try {
    const { rfq_id } = req.params;
    const { status } = req.query;

    // Check RFQ access
    const rfqResult = await pool.query('SELECT user_id FROM rfqs WHERE id = $1', [rfq_id]);
    if (rfqResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('RFQ not found', null, 'RFQ_NOT_FOUND'));
    }

    let hasAccess = false;
    if (req.user.user_type === 'buyer' && rfqResult.rows[0].user_id === req.user.id) {
      hasAccess = true;
    } else if (req.user.user_type === 'seller') {
      const shopAccess = await pool.query(
        `SELECT 1 FROM rfq_shop_invites rsi 
         JOIN shops s ON rsi.shop_id = s.id 
         WHERE rsi.rfq_id = $1 AND s.user_id = $2`,
        [rfq_id, req.user.id]
      );
      hasAccess = shopAccess.rows.length > 0;
    }

    if (!hasAccess) {
      return res.status(403).json(createErrorResponse('Access denied to this RFQ', null, 'RFQ_ACCESS_DENIED'));
    }

    let whereConditions = [`rr.rfq_id = $1`];
    let queryParams: any[] = [rfq_id];
    let paramCount = 1;

    if (status) {
      paramCount++;
      whereConditions.push(`rr.status = $${paramCount}`);
      queryParams.push(status as any);
    }

    const result = await pool.query(
      `SELECT 
        rr.*,
        s.name as shop_name, s.verified as shop_verified, s.rating_average, s.location_lat, s.location_lng
       FROM rfq_replies rr
       JOIN shops s ON rr.shop_id = s.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY rr.created_at`,
      queryParams
    );

    const replies = result.rows.map(reply => ({
      ...reply,
      shop: {
        id: reply.shop_id,
        name: reply.shop_name,
        verified: reply.shop_verified,
        rating_average: reply.rating_average,
        location_lat: reply.location_lat,
        location_lng: reply.location_lng
      }
    }));

    res.json({
      replies
    });
  } catch (error) {
    console.error('Get RFQ replies error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/rfqs/:rfq_id/replies - Submit reply to RFQ (Shop owners)
app.post('/api/rfqs/:rfq_id/replies', authenticateToken, async (req, res) => {
  try {
    const { rfq_id } = req.params;
    const { total_price, delivery_fee = 0, delivery_days = 0, notes, terms_conditions, valid_until, line_items } = req.body;

    if (!total_price || !line_items || !Array.isArray(line_items)) {
      return res.status(400).json(createErrorResponse('total_price and line_items are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    // Check if user has a shop and was invited to this RFQ
    const shopResult = await pool.query('SELECT id FROM shops WHERE user_id = $1', [req.user.id]);
    if (shopResult.rows.length === 0) {
      return res.status(403).json(createErrorResponse('User has no shop', null, 'NO_SHOP'));
    }

    const shopId = shopResult.rows[0].id;

    const inviteCheck = await pool.query(
      'SELECT id FROM rfq_shop_invites WHERE rfq_id = $1 AND shop_id = $2',
      [rfq_id, shopId]
    );

    if (inviteCheck.rows.length === 0) {
      return res.status(403).json(createErrorResponse('Shop not invited to this RFQ', null, 'NOT_INVITED'));
    }

    // Check if shop already replied
    const existingReply = await pool.query(
      'SELECT id FROM rfq_replies WHERE rfq_id = $1 AND shop_id = $2',
      [rfq_id, shopId]
    );

    const replyId = generateUUID();
    const timestamp = Date.now();

    if (existingReply.rows.length > 0) {
      // Update existing reply
      const result = await pool.query(
        `UPDATE rfq_replies SET total_price = $1, delivery_fee = $2, delivery_days = $3, notes = $4, terms_conditions = $5, valid_until = $6, line_items = $7, updated_at = $8
         WHERE rfq_id = $9 AND shop_id = $10 RETURNING *`,
        [total_price, delivery_fee, delivery_days, notes, terms_conditions, valid_until, JSON.stringify(line_items), timestamp, rfq_id, shopId]
      );

      res.json(result.rows[0]);
    } else {
      // Create new reply
      const result = await pool.query(
        `INSERT INTO rfq_replies (id, rfq_id, shop_id, total_price, delivery_fee, delivery_days, notes, terms_conditions, valid_until, status, line_items, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [replyId, rfq_id, shopId, total_price, delivery_fee, delivery_days, notes, terms_conditions, valid_until, 'pending', JSON.stringify(line_items), timestamp, timestamp]
      );

      // Update RFQ response count
      await pool.query(
        'UPDATE rfqs SET responses_count = responses_count + 1, updated_at = $1 WHERE id = $2',
        [timestamp, rfq_id]
      );

      // Mark invitation as responded
      await pool.query(
        'UPDATE rfq_shop_invites SET responded_at = $1 WHERE rfq_id = $2 AND shop_id = $3',
        [timestamp, rfq_id, shopId]
      );

      res.status(201).json(result.rows[0]);
    }
  } catch (error) {
    console.error('Create RFQ reply error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PUT /api/rfqs/:rfq_id/replies/:reply_id - Update RFQ reply
app.put('/api/rfqs/:rfq_id/replies/:reply_id', authenticateToken, async (req, res) => {
  try {
    const { rfq_id, reply_id } = req.params;

    // Check ownership/access
    let hasAccess = false;
    
    if (req.user.user_type === 'seller') {
      // Shop owner updating their reply
      const shopResult = await pool.query('SELECT id FROM shops WHERE user_id = $1', [req.user.id]);
      if (shopResult.rows.length > 0) {
        const replyCheck = await pool.query(
          'SELECT id FROM rfq_replies WHERE id = $1 AND rfq_id = $2 AND shop_id = $3',
          [reply_id, rfq_id, shopResult.rows[0].id]
        );
        hasAccess = replyCheck.rows.length > 0;
      }
    } else if (req.user.user_type === 'buyer') {
      // Buyer updating reply status (accept/reject)
      const rfqCheck = await pool.query(
        'SELECT id FROM rfqs WHERE id = $1 AND user_id = $2',
        [rfq_id, req.user.id]
      );
      hasAccess = rfqCheck.rows.length > 0;
    }

    if (!hasAccess) {
      return res.status(403).json(createErrorResponse('Access denied to this reply', null, 'REPLY_ACCESS_DENIED'));
    }

    const updateData = req.body;
    let updateFields = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    const allowedFields = ['status', 'total_price', 'delivery_fee', 'delivery_days', 'notes', 'terms_conditions', 'valid_until'];
    
    Object.entries(updateData).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        queryParams.push(value as any);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    queryParams.push(Date.now());

    paramCount++;
    queryParams.push(reply_id as any);

    const result = await pool.query(
      `UPDATE rfq_replies SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      queryParams
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Reply not found', null, 'REPLY_NOT_FOUND'));
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update RFQ reply error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Message management endpoints for RFQ chat threads.
  Supports real-time messaging, file attachments, and read status tracking.
*/

// GET /api/rfqs/:rfq_id/messages - Get messages for RFQ
app.get('/api/rfqs/:rfq_id/messages', authenticateToken, async (req, res) => {
  try {
    const { rfq_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Check RFQ access
    const rfqResult = await pool.query('SELECT user_id FROM rfqs WHERE id = $1', [rfq_id]);
    if (rfqResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('RFQ not found', null, 'RFQ_NOT_FOUND'));
    }

    let hasAccess = false;
    if (req.user.user_type === 'buyer' && rfqResult.rows[0].user_id === req.user.id) {
      hasAccess = true;
    } else if (req.user.user_type === 'seller') {
      const shopAccess = await pool.query(
        `SELECT 1 FROM rfq_shop_invites rsi 
         JOIN shops s ON rsi.shop_id = s.id 
         WHERE rsi.rfq_id = $1 AND s.user_id = $2`,
        [rfq_id, req.user.id]
      );
      hasAccess = shopAccess.rows.length > 0;
    }

    if (!hasAccess) {
      return res.status(403).json(createErrorResponse('Access denied to this RFQ', null, 'RFQ_ACCESS_DENIED'));
    }

    // Get messages with sender info
    const result = await pool.query(
      `SELECT 
        m.*,
        u.name as sender_name, u.user_type as sender_type,
        s.name as shop_name
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN shops s ON u.id = s.user_id
       WHERE m.rfq_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [rfq_id, parseInt(limit as any), parseInt(offset as any)]
    );

    const messages = result.rows.map(row => ({
      id: row.id,
      rfq_id: row.rfq_id,
      sender_id: row.sender_id,
      message: row.message,
      message_type: row.message_type,
      attachments: row.attachments,
      read_at: row.read_at,
      created_at: row.created_at,
      sender: {
        id: row.sender_id,
        name: row.sender_name,
        user_type: row.sender_type,
        shop_name: row.shop_name
      }
    }));

    res.json({
      messages: messages.reverse() // Return in chronological order
    });
  } catch (error) {
    console.error('Get RFQ messages error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/rfqs/:rfq_id/messages - Send message in RFQ thread
app.post('/api/rfqs/:rfq_id/messages', authenticateToken, async (req, res) => {
  try {
    const { rfq_id } = req.params;
    const { message, message_type = 'text', attachments } = req.body;

    if (!message) {
      return res.status(400).json(createErrorResponse('Message content is required', null, 'MISSING_MESSAGE'));
    }

    // Check RFQ access
    const rfqResult = await pool.query('SELECT user_id FROM rfqs WHERE id = $1', [rfq_id]);
    if (rfqResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('RFQ not found', null, 'RFQ_NOT_FOUND'));
    }

    let hasAccess = false;
    if (req.user.user_type === 'buyer' && rfqResult.rows[0].user_id === req.user.id) {
      hasAccess = true;
    } else if (req.user.user_type === 'seller') {
      const shopAccess = await pool.query(
        `SELECT 1 FROM rfq_shop_invites rsi 
         JOIN shops s ON rsi.shop_id = s.id 
         WHERE rsi.rfq_id = $1 AND s.user_id = $2`,
        [rfq_id, req.user.id]
      );
      hasAccess = shopAccess.rows.length > 0;
    }

    if (!hasAccess) {
      return res.status(403).json(createErrorResponse('Access denied to this RFQ', null, 'RFQ_ACCESS_DENIED'));
    }

    const messageId = generateUUID();
    const timestamp = Date.now();

    const result = await pool.query(
      `INSERT INTO messages (id, rfq_id, sender_id, message, message_type, attachments, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [messageId, rfq_id, req.user.id, message, message_type, JSON.stringify(attachments || []), timestamp]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Send RFQ message error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PUT /api/messages/:message_id/read - Mark message as read
app.put('/api/messages/:message_id/read', authenticateToken, async (req, res) => {
  try {
    const { message_id } = req.params;

    // Check if message exists and user has access
    const messageResult = await pool.query(
      `SELECT m.rfq_id, r.user_id 
       FROM messages m 
       JOIN rfqs r ON m.rfq_id = r.id 
       WHERE m.id = $1`,
      [message_id]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Message not found', null, 'MESSAGE_NOT_FOUND'));
    }

    const message = messageResult.rows[0];

    // Check access to RFQ
    let hasAccess = false;
    if (req.user.user_type === 'buyer' && message.user_id === req.user.id) {
      hasAccess = true;
    } else if (req.user.user_type === 'seller') {
      const shopAccess = await pool.query(
        `SELECT 1 FROM rfq_shop_invites rsi 
         JOIN shops s ON rsi.shop_id = s.id 
         WHERE rsi.rfq_id = $1 AND s.user_id = $2`,
        [message.rfq_id, req.user.id]
      );
      hasAccess = shopAccess.rows.length > 0;
    }

    if (!hasAccess) {
      return res.status(403).json(createErrorResponse('Access denied', null, 'ACCESS_DENIED'));
    }

    await pool.query(
      'UPDATE messages SET read_at = $1 WHERE id = $2',
      [Date.now(), message_id]
    );

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Alert management endpoints - handles user-defined price and stock monitoring.
  Implements threshold-based notifications and alert lifecycle management.
*/

// GET /api/alerts - Get user's price and stock alerts
app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const { type, active, variant_id, shop_id, limit = 20, offset = 0 } = req.query;

    let whereConditions = [`user_id = $1`];
    let queryParams: any[] = [req.user.id];
    let paramCount = 1;

    if (type) {
      paramCount++;
      whereConditions.push(`type = $${paramCount}`);
      queryParams.push(type as any);
    }

    if (active !== undefined) {
      paramCount++;
      whereConditions.push(`active = $${paramCount}`);
      queryParams.push(active === 'true');
    }

    if (variant_id) {
      paramCount++;
      whereConditions.push(`variant_id = $${paramCount}`);
      queryParams.push(variant_id as any);
    }

    if (shop_id) {
      paramCount++;
      whereConditions.push(`shop_id = $${paramCount}`);
      queryParams.push(shop_id as any);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM alerts WHERE ${whereClause}`,
      queryParams
    );

    // Get alerts with related data
    const result = await pool.query(
      `SELECT 
        a.*,
        pv.brand, pv.grade, pv.size,
        p.canonical_name, p.base_unit,
        s.name as shop_name
       FROM alerts a
       LEFT JOIN product_variants pv ON a.variant_id = pv.id
       LEFT JOIN products p ON pv.product_id = p.id
       LEFT JOIN shops s ON a.shop_id = s.id
       WHERE ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, parseInt(limit as any), parseInt(offset as any)]
    );

    const alerts = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      variant_id: row.variant_id,
      shop_id: row.shop_id,
      threshold_value: row.threshold_value,
      condition_type: row.condition_type,
      notification_methods: row.notification_methods,
      active: row.active,
      triggered_count: row.triggered_count,
      last_triggered_at: row.last_triggered_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      variant: row.variant_id ? {
        brand: row.brand,
        grade: row.grade,
        size: row.size
      } : null,
      product: row.canonical_name ? {
        canonical_name: row.canonical_name,
        base_unit: row.base_unit
      } : null,
      shop: row.shop_name ? {
        name: row.shop_name
      } : null
    }));

    res.json({
      alerts,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/alerts - Create new price or stock alert
app.post('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const { type, variant_id, shop_id, threshold_value, condition_type, notification_methods = ['push'] } = req.body;

    if (!type || !condition_type) {
      return res.status(400).json(createErrorResponse('type and condition_type are required', null, 'MISSING_REQUIRED_FIELDS'));
    }

    // Validate combinations
    if (type === 'price_drop' && (!threshold_value || !variant_id)) {
      return res.status(400).json(createErrorResponse('Price alerts require threshold_value and variant_id', null, 'INVALID_PRICE_ALERT'));
    }

    if (type === 'stock_available' && !variant_id) {
      return res.status(400).json(createErrorResponse('Stock alerts require variant_id', null, 'INVALID_STOCK_ALERT'));
    }

    const alertId = generateUUID();
    const timestamp = Date.now();

    const result = await pool.query(
      `INSERT INTO alerts (id, user_id, type, variant_id, shop_id, threshold_value, condition_type, notification_methods, active, triggered_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [alertId, req.user.id, type, variant_id, shop_id, threshold_value, condition_type, JSON.stringify(notification_methods), true, 0, timestamp, timestamp]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/alerts/:alert_id - Get alert details
app.get('/api/alerts/:alert_id', authenticateToken, async (req, res) => {
  try {
    const { alert_id } = req.params;

    const result = await pool.query(
      'SELECT * FROM alerts WHERE id = $1 AND user_id = $2',
      [alert_id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Alert not found', null, 'ALERT_NOT_FOUND'));
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get alert error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PUT /api/alerts/:alert_id - Update alert settings
app.put('/api/alerts/:alert_id', authenticateToken, async (req, res) => {
  try {
    const { alert_id } = req.params;

    // Check ownership
    const alertOwner = await pool.query('SELECT user_id FROM alerts WHERE id = $1', [alert_id]);
    if (alertOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Alert not found', null, 'ALERT_NOT_FOUND'));
    }

    if (alertOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot update other user alerts', null, 'FORBIDDEN'));
    }

    const { threshold_value, condition_type, notification_methods, active } = req.body;

    let updateFields = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    if (threshold_value !== undefined) {
      paramCount++;
      updateFields.push(`threshold_value = $${paramCount}`);
      queryParams.push(threshold_value as any);
    }

    if (condition_type !== undefined) {
      paramCount++;
      updateFields.push(`condition_type = $${paramCount}`);
      queryParams.push(condition_type as any);
    }

    if (notification_methods !== undefined) {
      paramCount++;
      updateFields.push(`notification_methods = $${paramCount}`);
      queryParams.push(JSON.stringify(notification_methods));
    }

    if (active !== undefined) {
      paramCount++;
      updateFields.push(`active = $${paramCount}`);
      queryParams.push(active as any);
    }

    if (updateFields.length === 0) {
      return res.status(400).json(createErrorResponse('No fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    queryParams.push(Date.now());

    paramCount++;
    queryParams.push(alert_id as any);

    const result = await pool.query(
      `UPDATE alerts SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      queryParams
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// DELETE /api/alerts/:alert_id - Delete alert
app.delete('/api/alerts/:alert_id', authenticateToken, async (req, res) => {
  try {
    const { alert_id } = req.params;

    // Check ownership
    const alertOwner = await pool.query('SELECT user_id FROM alerts WHERE id = $1', [alert_id]);
    if (alertOwner.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Alert not found', null, 'ALERT_NOT_FOUND'));
    }

    if (alertOwner.rows[0].user_id !== req.user.id) {
      return res.status(403).json(createErrorResponse('Cannot delete other user alerts', null, 'FORBIDDEN'));
    }

    await pool.query('DELETE FROM alerts WHERE id = $1', [alert_id]);

    res.status(204).send();
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Notification management endpoints - handles user notification delivery and read status.
  Supports multiple notification types with priority levels and action URLs.
*/

// GET /api/notifications - Get user notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const params = searchNotificationsInputSchema.parse({ user_id: req.user.id, ...req.query });
    const { type, is_read, priority, limit, offset, sort_by, sort_order } = params;

    let whereConditions = [`user_id = $1`];
    let queryParams: any[] = [req.user.id];
    let paramCount = 1;

    if (type) {
      paramCount++;
      whereConditions.push(`type = $${paramCount}`);
      queryParams.push(type as any);
    }

    if (is_read !== undefined) {
      if (is_read) {
        whereConditions.push(`read_at IS NOT NULL`);
      } else {
        whereConditions.push(`read_at IS NULL`);
      }
    }

    if (priority) {
      paramCount++;
      whereConditions.push(`priority = $${paramCount}`);
      queryParams.push(priority as any);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count and unread count
    const countResult = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE read_at IS NULL) as unread
       FROM notifications WHERE ${whereClause}`,
      queryParams
    );

    // Get notifications
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE ${whereClause}
       ORDER BY ${sort_by} ${sort_order}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    res.json({
      notifications: result.rows,
      unread_count: parseInt(countResult.rows[0].unread),
      total: parseInt(countResult.rows[0].total)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PUT /api/notifications/:notification_id/read - Mark notification as read
app.put('/api/notifications/:notification_id/read', authenticateToken, async (req, res) => {
  try {
    const { notification_id } = req.params;

    const result = await pool.query(
      'UPDATE notifications SET read_at = $1 WHERE id = $2 AND user_id = $3 RETURNING id',
      [Date.now(), notification_id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Notification not found', null, 'NOTIFICATION_NOT_FOUND'));
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// PUT /api/notifications/mark-all-read - Mark all notifications as read
app.put('/api/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET read_at = $1 WHERE user_id = $2 AND read_at IS NULL',
      [Date.now(), req.user.id]
    );

    res.json({
      marked_count: result.rowCount
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Review and rating management endpoints - handles user-generated content for shops and products.
  Implements review helpfulness voting and moderation features.
*/

// GET /api/reviews - Get product and shop reviews
app.get('/api/reviews', optionalAuth, async (req, res) => {
  try {
    const params = searchReviewsInputSchema.parse(req.query);
    const { shop_id, variant_id, user_id, min_rating, max_rating, verified_purchase, status, limit, offset, sort_by, sort_order } = params;

    let whereConditions = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    if (shop_id) {
      paramCount++;
      whereConditions.push(`shop_id = $${paramCount}`);
      queryParams.push(shop_id as any);
    }

    if (variant_id) {
      paramCount++;
      whereConditions.push(`variant_id = $${paramCount}`);
      queryParams.push(variant_id as any);
    }

    if (user_id) {
      paramCount++;
      whereConditions.push(`user_id = $${paramCount}`);
      queryParams.push(user_id as any);
    }

    if (min_rating !== undefined) {
      paramCount++;
      whereConditions.push(`rating >= $${paramCount}`);
      queryParams.push(min_rating as any);
    }

    if (max_rating !== undefined) {
      paramCount++;
      whereConditions.push(`rating <= $${paramCount}`);
      queryParams.push(max_rating as any);
    }

    if (verified_purchase !== undefined) {
      paramCount++;
      whereConditions.push(`verified_purchase = $${paramCount}`);
      queryParams.push(verified_purchase as any);
    }

    if (status) {
      paramCount++;
      whereConditions.push(`status = $${paramCount}`);
      queryParams.push(status as any);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count and rating summary
    const countResult = await pool.query(
      `SELECT 
        COUNT(*) as total,
        AVG(rating) as average_rating,
        COUNT(*) FILTER (WHERE rating = 1) as rating_1,
        COUNT(*) FILTER (WHERE rating = 2) as rating_2,
        COUNT(*) FILTER (WHERE rating = 3) as rating_3,
        COUNT(*) FILTER (WHERE rating = 4) as rating_4,
        COUNT(*) FILTER (WHERE rating = 5) as rating_5
       FROM reviews ${whereClause}`,
      queryParams
    );

    // Get reviews with user info
    const result = await pool.query(
      `SELECT 
        r.*,
        u.name as user_name, u.user_type
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       ${whereClause}
       ORDER BY r.${sort_by} ${sort_order}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    const reviews = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      shop_id: row.shop_id,
      variant_id: row.variant_id,
      rating: row.rating,
      review_text: row.review_text,
      images: row.images,
      verified_purchase: row.verified_purchase,
      helpful_votes: row.helpful_votes,
      total_votes: row.total_votes,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        name: row.user_name,
        user_type: row.user_type
      }
    }));

    const countRow = countResult.rows[0];
    
    res.json({
      reviews,
      total: parseInt(countRow.total),
      rating_summary: {
        average_rating: parseFloat(countRow.average_rating) || 0,
        total_reviews: parseInt(countRow.total),
        rating_distribution: {
          "1": parseInt(countRow.rating_1),
          "2": parseInt(countRow.rating_2),
          "3": parseInt(countRow.rating_3),
          "4": parseInt(countRow.rating_4),
          "5": parseInt(countRow.rating_5)
        }
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/reviews - Create product or shop review
app.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const validatedData = createReviewInputSchema.parse({ user_id: req.user.id, ...req.body });
    const { user_id, shop_id, variant_id, rating, review_text, images, verified_purchase } = validatedData;

    if (!shop_id && !variant_id) {
      return res.status(400).json(createErrorResponse('Either shop_id or variant_id must be provided', null, 'MISSING_TARGET'));
    }

    // Check for existing review
    let existingReviewQuery = 'SELECT id FROM reviews WHERE user_id = $1';
    const queryParams = [user_id];
    
    if (shop_id) {
      existingReviewQuery += ' AND shop_id = $2';
      queryParams.push(shop_id as any);
    } else {
      existingReviewQuery += ' AND variant_id = $2';
      queryParams.push(variant_id as any);
    }

    const existingReview = await pool.query(existingReviewQuery, queryParams);
    if (existingReview.rows.length > 0) {
      return res.status(409).json(createErrorResponse('User has already reviewed this item', null, 'REVIEW_EXISTS'));
    }

    const reviewId = generateUUID();
    const timestamp = Date.now();

    const result = await pool.query(
      `INSERT INTO reviews (id, user_id, shop_id, variant_id, rating, review_text, images, verified_purchase, helpful_votes, total_votes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [reviewId, user_id, shop_id, variant_id, rating, review_text, JSON.stringify(images), verified_purchase, 0, 0, 'active', timestamp, timestamp]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create review error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Validation error', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/reviews/:review_id/vote - Vote on review helpfulness
app.post('/api/reviews/:review_id/vote', authenticateToken, async (req, res) => {
  try {
    const { review_id } = req.params;
    const { helpful } = req.body;

    if (typeof helpful !== 'boolean') {
      return res.status(400).json(createErrorResponse('helpful must be a boolean', null, 'INVALID_VOTE'));
    }

    // Check if review exists
    const reviewResult = await pool.query('SELECT id, helpful_votes, total_votes FROM reviews WHERE id = $1', [review_id]);
    if (reviewResult.rows.length === 0) {
      return res.status(404).json(createErrorResponse('Review not found', null, 'REVIEW_NOT_FOUND'));
    }

    const review = reviewResult.rows[0];

    // For simplicity, we'll just increment counters (in production, you'd track individual votes)
    const newTotalVotes = review.total_votes + 1;
    const newHelpfulVotes = helpful ? review.helpful_votes + 1 : review.helpful_votes;

    const result = await pool.query(
      'UPDATE reviews SET helpful_votes = $1, total_votes = $2, updated_at = $3 WHERE id = $4 RETURNING helpful_votes, total_votes',
      [newHelpfulVotes, newTotalVotes, Date.now(), review_id]
    );

    res.json({
      helpful_votes: result.rows[0].helpful_votes,
      total_votes: result.rows[0].total_votes
    });
  } catch (error) {
    console.error('Vote on review error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Favorites management endpoints - handles user bookmarking of shops, products, and BOMs.
  Supports different favorite types with unified access patterns.
*/

// GET /api/favorites - Get user's favorite items
app.get('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const { favorite_type, limit = 20, offset = 0 } = req.query;

    let whereConditions = [`user_id = $1`];
    let queryParams: any[] = [req.user.id];
    let paramCount = 1;

    if (favorite_type) {
      paramCount++;
      whereConditions.push(`favorite_type = $${paramCount}`);
      queryParams.push(favorite_type as any);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM user_favorites WHERE ${whereClause}`,
      queryParams
    );

    // Get favorites with related data
    const result = await pool.query(
      `SELECT 
        uf.*,
        s.name as shop_name, s.verified as shop_verified, s.rating_average,
        pv.brand, pv.grade, pv.size,
        p.canonical_name, p.base_unit,
        b.title as bom_title, b.project_type, b.item_count
       FROM user_favorites uf
       LEFT JOIN shops s ON uf.shop_id = s.id
       LEFT JOIN product_variants pv ON uf.variant_id = pv.id
       LEFT JOIN products p ON pv.product_id = p.id
       LEFT JOIN boms b ON uf.bom_id = b.id
       WHERE ${whereClause}
       ORDER BY uf.created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, parseInt(limit as any), parseInt(offset as any)]
    );

    const favorites = result.rows.map(row => {
      const favorite: any = {
        id: row.id,
        user_id: row.user_id,
        favorite_type: row.favorite_type,
        shop_id: row.shop_id,
        variant_id: row.variant_id,
        bom_id: row.bom_id,
        created_at: row.created_at
      };

      if (row.shop_id && row.shop_name) {
        favorite.shop = {
          id: row.shop_id,
          name: row.shop_name,
          verified: row.shop_verified,
          rating_average: row.rating_average
        };
      }

      if (row.variant_id && row.brand) {
        favorite.variant = {
          id: row.variant_id,
          brand: row.brand,
          grade: row.grade,
          size: row.size
        };
        
        if (row.canonical_name) {
          favorite.product = {
            canonical_name: row.canonical_name,
            base_unit: row.base_unit
          };
        }
      }

      if (row.bom_id && row.bom_title) {
        favorite.bom = {
          id: row.bom_id,
          title: row.bom_title,
          project_type: row.project_type,
          item_count: row.item_count
        };
      }

      return favorite;
    });

    res.json({
      favorites,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/favorites - Add item to favorites
app.post('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const { favorite_type, shop_id, variant_id, bom_id } = req.body;

    if (!favorite_type) {
      return res.status(400).json(createErrorResponse('favorite_type is required', null, 'MISSING_FAVORITE_TYPE'));
    }

    // Validate combination
    if (favorite_type === 'shop' && !shop_id) {
      return res.status(400).json(createErrorResponse('shop_id required for shop favorites', null, 'MISSING_SHOP_ID'));
    }

    if (favorite_type === 'variant' && !variant_id) {
      return res.status(400).json(createErrorResponse('variant_id required for variant favorites', null, 'MISSING_VARIANT_ID'));
    }

    if (favorite_type === 'bom' && !bom_id) {
      return res.status(400).json(createErrorResponse('bom_id required for BOM favorites', null, 'MISSING_BOM_ID'));
    }

    // Check if already favorited
    let existingQuery = 'SELECT id FROM user_favorites WHERE user_id = $1 AND favorite_type = $2';
    const queryParams = [req.user.id, favorite_type];

    if (shop_id) {
      existingQuery += ' AND shop_id = $3';
      queryParams.push(shop_id as any);
    } else if (variant_id) {
      existingQuery += ' AND variant_id = $3';
      queryParams.push(variant_id as any);
    } else if (bom_id) {
      existingQuery += ' AND bom_id = $3';
      queryParams.push(bom_id as any);
    }

    const existing = await pool.query(existingQuery, queryParams);
    if (existing.rows.length > 0) {
      return res.status(409).json(createErrorResponse('Item already in favorites', null, 'ALREADY_FAVORITED'));
    }

    const favoriteId = generateUUID();
    const timestamp = Date.now();

    const result = await pool.query(
      `INSERT INTO user_favorites (id, user_id, favorite_type, shop_id, variant_id, bom_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [favoriteId, req.user.id, favorite_type, shop_id, variant_id, bom_id, timestamp]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add to favorites error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// DELETE /api/favorites/:favorite_id - Remove item from favorites
app.delete('/api/favorites/:favorite_id', authenticateToken, async (req, res) => {
  try {
    const { favorite_id } = req.params;

    const result = await pool.query(
      'DELETE FROM user_favorites WHERE id = $1 AND user_id = $2',
      [favorite_id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json(createErrorResponse('Favorite not found', null, 'FAVORITE_NOT_FOUND'));
    }

    res.status(204).send();
  } catch (error) {
    console.error('Remove from favorites error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Universal search endpoints - handles cross-entity search with intelligent suggestions.
  Implements full-text search across products, shops, and categories with relevance ranking.
*/

// GET /api/search - Universal search across products, shops, and categories
app.get('/api/search', optionalAuth, async (req, res) => {
  try {
    const { q, type = 'all', location_lat, location_lng, radius = 10, limit = 20, offset = 0 } = req.query;

    if (!q) {
      return res.status(400).json(createErrorResponse('Search query (q) is required', null, 'MISSING_QUERY'));
    }

    const limitNum = parseInt(limit as any) || 20;
    const radiusNum = parseFloat(radius as any) || 10;
    const searchTerm = `%${q}%`;
    const results = {
      products: [],
      shops: [],
      categories: []
    };

    let totalCount = 0;

    // Search products
    if (type === 'all' || type === 'products') {
      const productsResult = await pool.query(
        `SELECT p.*, c.name as category_name
         FROM products p
         JOIN categories c ON p.category_id = c.id
         WHERE (p.canonical_name ILIKE $1 OR p.description ILIKE $1 OR p.synonyms::text ILIKE $1)
         AND p.is_active = true
         ORDER BY 
           CASE 
             WHEN p.canonical_name ILIKE $1 THEN 1
             WHEN p.description ILIKE $1 THEN 2
             ELSE 3
           END,
           p.canonical_name
         LIMIT $2`,
        [searchTerm, Math.ceil(limitNum / (type === 'all' ? 3 : 1))]
      );

      results.products = productsResult.rows;
      totalCount += productsResult.rows.length;
    }

    // Search shops
    if (type === 'all' || type === 'shops') {
      let shopQuery = `
        SELECT s.*${location_lat && location_lng ? 
          `, (6371 * acos(cos(radians($${location_lat && location_lng ? 3 : 2})) * cos(radians(s.location_lat)) * cos(radians(s.location_lng) - radians($${location_lat && location_lng ? 4 : 3})) + sin(radians($${location_lat && location_lng ? 3 : 2})) * sin(radians(s.location_lat)))) as distance_km` : ''
        }
        FROM shops s
        WHERE (s.name ILIKE $1 OR s.address ILIKE $1)
      `;

      const shopParams: any[] = [searchTerm];
      let paramCount = 1;

      if (location_lat && location_lng) {
        paramCount++;
        shopParams.push(parseFloat(location_lat as any));
        paramCount++;
        shopParams.push(parseFloat(location_lng as any));

        shopQuery += ` AND (6371 * acos(cos(radians($${paramCount - 1})) * cos(radians(s.location_lat)) * cos(radians(s.location_lng) - radians($${paramCount})) + sin(radians($${paramCount - 1})) * sin(radians(s.location_lat)))) <= ${radiusNum}`;
      }

      shopQuery += ` ORDER BY s.verified DESC, s.rating_average DESC LIMIT $${paramCount + 1}`;
      shopParams.push(Math.ceil(limitNum / (type === 'all' ? 3 : 1)));

      const shopsResult = await pool.query(shopQuery, shopParams);
      results.shops = shopsResult.rows;
      totalCount += shopsResult.rows.length;
    }

    // Search categories
    if (type === 'all' || type === 'categories') {
      const categoriesResult = await pool.query(
        `SELECT *
         FROM categories
         WHERE (name ILIKE $1 OR description ILIKE $1)
         AND is_active = true
         ORDER BY sort_order, name
         LIMIT $2`,
        [searchTerm, Math.ceil(limitNum / (type === 'all' ? 3 : 1))]
      );

      results.categories = categoriesResult.rows;
      totalCount += categoriesResult.rows.length;
    }

    // Generate search suggestions
    const suggestions = [];
    if (results.products.length > 0) {
      suggestions.push(...results.products.slice(0, 3).map(p => p.canonical_name));
    }
    if (results.shops.length > 0) {
      suggestions.push(...results.shops.slice(0, 2).map(s => s.name));
    }

    res.json({
      results: type === 'all' ? results : results[type as string] || [],
      total_count: totalCount,
      suggestions: [...new Set(suggestions)].slice(0, 5)
    });
  } catch (error) {
    console.error('Universal search error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/search/suggestions - Get search autocomplete suggestions
app.get('/api/search/suggestions', optionalAuth, async (req, res) => {
  try {
    const { q, type = 'products', limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json(createErrorResponse('Search query (q) is required', null, 'MISSING_QUERY'));
    }

    const searchTerm = `%${q}%`;
    const suggestions = [];

    if (type === 'products') {
      const result = await pool.query(
        `SELECT canonical_name as text, 'product' as type, id, 
                json_build_object('category', c.name, 'base_unit', p.base_unit) as metadata
         FROM products p
         JOIN categories c ON p.category_id = c.id
         WHERE p.canonical_name ILIKE $1 AND p.is_active = true
         ORDER BY p.canonical_name
         LIMIT $2`,
        [searchTerm, limit]
      );

      suggestions.push(...result.rows);
    } else if (type === 'shops') {
      const result = await pool.query(
        `SELECT name as text, 'shop' as type, id,
                json_build_object('verified', verified, 'rating', rating_average, 'shop_type', shop_type) as metadata
         FROM shops
         WHERE name ILIKE $1
         ORDER BY verified DESC, rating_average DESC, name
         LIMIT $2`,
        [searchTerm, limit]
      );

      suggestions.push(...result.rows);
    } else if (type === 'categories') {
      const result = await pool.query(
        `SELECT name as text, 'category' as type, id,
                json_build_object('parent_id', parent_id, 'category_path', category_path) as metadata
         FROM categories
         WHERE name ILIKE $1 AND is_active = true
         ORDER BY sort_order, name
         LIMIT $2`,
        [searchTerm, limit]
      );

      suggestions.push(...result.rows);
    }

    res.json({
      suggestions
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// GET /api/search/history - Get user's search history
app.get('/api/search/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT DISTINCT q as query, 
              json_build_object('category', category, 'brand', brand, 'location_lat', location_lat, 'location_lng', location_lng) as filters,
              created_at, results_count
       FROM search_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit as any), parseInt(offset as any)]
    );

    res.json({
      searches: result.rows
    });
  } catch (error) {
    console.error('Get search history error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// POST /api/search/history - Save search query to history
app.post('/api/search/history', authenticateToken, async (req, res) => {
  try {
    const { query, filters, results_count = 0 } = req.body;

    if (!query) {
      return res.status(400).json(createErrorResponse('Query is required', null, 'MISSING_QUERY'));
    }

    const historyId = generateUUID();
    const timestamp = Date.now();

    await pool.query(
      `INSERT INTO search_history (id, user_id, q, category, brand, location_lat, location_lng, results_count, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        historyId,
        req.user.id,
        query,
        filters?.category || null,
        filters?.brand || null,
        filters?.location_lat || null,
        filters?.location_lng || null,
        results_count,
        timestamp
      ]
    );

    res.status(201).json({ message: 'Search saved to history' });
  } catch (error) {
    console.error('Save search history error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Map integration endpoints - handles geospatial queries for shop discovery and route planning.
  Supports clustering, bounds-based filtering, and location-aware features.
*/

// GET /api/map/shops - Get shops with coordinates for map display
app.get('/api/map/shops', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, zoom = 12, shop_type, product_search, bounds } = req.query;

    if (!lat || !lng) {
      return res.status(400).json(createErrorResponse('Latitude and longitude are required', null, 'MISSING_COORDINATES'));
    }

    let whereConditions = ['location_lat IS NOT NULL', 'location_lng IS NOT NULL'];
    let queryParams: any[] = [];
    let paramCount = 0;

    // Handle bounds filtering
    if (bounds) {
      const [north, south, east, west] = (bounds as string).split(',').map(parseFloat);
      whereConditions.push(`location_lat BETWEEN $${paramCount + 1} AND $${paramCount + 2}`);
      whereConditions.push(`location_lng BETWEEN $${paramCount + 3} AND $${paramCount + 4}`);
      queryParams.push(south, north, west, east);
      paramCount += 4;
    }

    if (shop_type) {
      paramCount++;
      whereConditions.push(`shop_type = $${paramCount}`);
      queryParams.push(shop_type as any);
    }

    let shopQuery = `
      SELECT 
        id, name, location_lat, location_lng, shop_type, 
        rating_average, verified,
        (SELECT COUNT(DISTINCT variant_id) FROM prices WHERE shop_id = shops.id) as product_count
      FROM shops
      WHERE ${whereConditions.join(' AND ')}
    `;

    // Filter by product search if provided
    if (product_search) {
      shopQuery = `
        SELECT DISTINCT 
          s.id, s.name, s.location_lat, s.location_lng, s.shop_type,
          s.rating_average, s.verified,
          COUNT(DISTINCT pr.variant_id) as product_count
        FROM shops s
        JOIN prices pr ON s.id = pr.shop_id
        JOIN product_variants pv ON pr.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE ${whereConditions.join(' AND ')}
        AND (p.canonical_name ILIKE $${paramCount + 1} OR p.synonyms::text ILIKE $${paramCount + 1})
        GROUP BY s.id, s.name, s.location_lat, s.location_lng, s.shop_type, s.rating_average, s.verified
      `;
      queryParams.push(`%${product_search}%`);
    }

    shopQuery += ' ORDER BY rating_average DESC, verified DESC LIMIT 100';

    const result = await pool.query(shopQuery, queryParams);

    // Simple clustering based on zoom level
    const clusters = [];
    const shops = result.rows;

    if (parseInt(zoom as any) < 13) {
      // Perform basic clustering for lower zoom levels
      const clusterRadius = 0.01; // Roughly 1km at equator
      const processed = new Set();

      shops.forEach((shop, index) => {
        if (processed.has(index)) return;

        const nearby = [];
        const shopLat = parseFloat(shop.location_lat);
        const shopLng = parseFloat(shop.location_lng);

        shops.forEach((otherShop, otherIndex) => {
          if (processed.has(otherIndex)) return;

          const otherLat = parseFloat(otherShop.location_lat);
          const otherLng = parseFloat(otherShop.location_lng);

          const distance = Math.sqrt(
            Math.pow(shopLat - otherLat, 2) + Math.pow(shopLng - otherLng, 2)
          );

          if (distance <= clusterRadius) {
            nearby.push(otherIndex);
            processed.add(otherIndex);
          }
        });

        if (nearby.length > 1) {
          clusters.push({
            lat: shopLat,
            lng: shopLng,
            count: nearby.length,
            radius: clusterRadius * 111320 // Convert to meters
          });
        }
      });
    }

    res.json({
      shops: shops.map(shop => ({
        id: shop.id,
        name: shop.name,
        location_lat: parseFloat(shop.location_lat),
        location_lng: parseFloat(shop.location_lng),
        shop_type: shop.shop_type,
        rating_average: parseFloat(shop.rating_average),
        verified: shop.verified,
        product_count: parseInt(shop.product_count)
      })),
      clusters
    });
  } catch (error) {
    console.error('Map shops error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Mock external API function for trip route optimization
  @@need:external-api: Advanced route optimization service with real-time traffic data, delivery scheduling, and multi-objective optimization (cost, time, distance)
*/
async function optimizeTripRoute(bomItems, shopIds, startLocation, returnToStart) {
  // Mock implementation returns optimized route
  const mockRoute = {
    total_distance_km: 0,
    estimated_duration_minutes: 0,
    stops: []
  };

  // Mock optimization logic
  for (let i = 0; i < shopIds.length; i++) {
    const shopId = shopIds[i];
    
    // Mock shop location and items
    const mockShop = {
      id: shopId,
      name: `Shop ${i + 1}`,
      location_lat: (25.2 + (i * 0.05)),
      location_lng: (55.3 + (i * 0.05)),
      verified: true,
      rating_average: (4.2 + (i * 0.1))
    };

    const mockItems = bomItems.slice(
      Math.floor(i * bomItems.length / shopIds.length),
      Math.floor((i + 1) * bomItems.length / shopIds.length)
    );

    const stopDistance = i === 0 ? 8.5 : (6.2 + (i * 2.1));
    const stopDuration = 45 + (mockItems.length * 5);
    const stopCost = mockItems.reduce((sum, item) => sum + (item.quantity * 25.5), 0);

    mockRoute.stops.push({
      shop: mockShop,
      items: mockItems,
      distance_from_previous_km: stopDistance,
      estimated_duration_minutes: stopDuration,
      estimated_cost: stopCost
    });

    mockRoute.total_distance_km += stopDistance;
    mockRoute.estimated_duration_minutes += stopDuration;
  }

  if (returnToStart) {
    mockRoute.total_distance_km += 5.3;
    mockRoute.estimated_duration_minutes += 25;
  }

  return mockRoute;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export { app, pool };
export default app;