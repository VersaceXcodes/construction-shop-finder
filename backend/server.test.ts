import request from 'supertest';
import { app, pool } from './server.ts';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import { createHash } from 'crypto';

// ===============================
// TEST SETUP AND UTILITIES
// ===============================

beforeAll(async () => {
  // Initialize test database connection
  await pool.connect();
});

afterAll(async () => {
  // Close database connections
  await pool.end();
});

beforeEach(async () => {
  // Start transaction for test isolation
  await pool.query('BEGIN');
});

afterEach(async () => {
  // Rollback transaction to clean up test data
  await pool.query('ROLLBACK');
});

// Test helper functions
const createTestUser = async (userData = {}) => {
  const defaultUser = {
    email: 'test@example.com',
    password: 'password123', // Plain text for testing
    name: 'Test User',
    user_type: 'buyer',
    location_lat: 25.2048,
    location_lng: 55.2708,
    address: 'Test Address'
  };
  
  const user = { ...defaultUser, ...userData };
  
  const result = await pool.query(`
    INSERT INTO users (id, email, password_hash, name, user_type, location_lat, location_lng, address, is_verified, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    `usr_${Date.now()}`,
    user.email,
    user.password, // Store plain text for testing
    user.name,
    user.user_type,
    user.location_lat,
    user.location_lng,
    user.address,
    true,
    Date.now(),
    Date.now()
  ]);
  
  return result.rows[0];
};

const createTestShop = async (userData, shopData = {}) => {
  const defaultShop = {
    name: 'Test Shop',
    phones: ['971501234567'],
    location_lat: 25.2582,
    location_lng: 55.3047,
    address: 'Test Shop Address',
    verified: true,
    delivery_available: true
  };
  
  const shop = { ...defaultShop, ...shopData };
  
  const result = await pool.query(`
    INSERT INTO shops (id, user_id, name, phones, location_lat, location_lng, address, verified, delivery_available, rating_average, rating_count, stock_accuracy_score, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *
  `, [
    `shp_${Date.now()}`,
    userData.id,
    shop.name,
    JSON.stringify(shop.phones),
    shop.location_lat,
    shop.location_lng,
    shop.address,
    shop.verified,
    shop.delivery_available,
    4.5,
    100,
    95,
    Date.now(),
    Date.now()
  ]);
  
  return result.rows[0];
};

const generateTestToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
};

// ===============================
// AUTHENTICATION TESTS
// ===============================

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        user_type: 'buyer'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User',
        user_type: 'buyer'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with existing email', async () => {
      const existingUser = await createTestUser();
      
      const userData = {
        email: existingUser.email,
        password: 'password123',
        name: 'Test User',
        user_type: 'buyer'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
    });

    it('should register a seller with shop creation', async () => {
      const userData = {
        email: 'seller@example.com',
        password: 'password123',
        name: 'Seller User',
        user_type: 'seller',
        location_lat: 25.2582,
        location_lng: 55.3047
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.user.user_type).toBe('seller');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const user = await createTestUser({
        email: 'login@example.com',
        password: 'password123'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(user.email);
    });

    it('should reject login with invalid password', async () => {
      const user = await createTestUser({
        email: 'login@example.com',
        password: 'password123'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user profile', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe(user.email);
      expect(response.body).not.toHaveProperty('password_hash');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should initiate password reset for existing email', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);
    });

    it('should handle password reset for non-existent email gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200); // Don't reveal if email exists
    });
  });
});

// ===============================
// USER MANAGEMENT TESTS
// ===============================

describe('User Management Endpoints', () => {
  describe('GET /api/users', () => {
    it('should return paginated user list', async () => {
      const user1 = await createTestUser({ email: 'user1@example.com' });
      const user2 = await createTestUser({ email: 'user2@example.com' });
      const token = generateTestToken(user1.id);

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('should filter users by user_type', async () => {
      const buyer = await createTestUser({ email: 'buyer@example.com', user_type: 'buyer' });
      const seller = await createTestUser({ email: 'seller@example.com', user_type: 'seller' });
      const token = generateTestToken(buyer.id);

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .query({ user_type: 'seller' })
        .expect(200);

      expect(response.body.users.every(user => user.user_type === 'seller')).toBe(true);
    });
  });

  describe('GET /api/users/:user_id', () => {
    it('should return specific user details', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .get(`/api/users/${user.id}`)
        .expect(200);

      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe(user.email);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/nonexistent')
        .expect(404);
    });
  });

  describe('PUT /api/users/:user_id', () => {
    it('should update user profile successfully', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id);

      const updateData = {
        name: 'Updated Name',
        address: 'Updated Address'
      };

      const response = await request(app)
        .put(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.address).toBe(updateData.address);
    });

    it('should reject update of other user\'s profile', async () => {
      const user1 = await createTestUser({ email: 'user1@example.com' });
      const user2 = await createTestUser({ email: 'user2@example.com' });
      const token = generateTestToken(user1.id);

      const response = await request(app)
        .put(`/api/users/${user2.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Name' })
        .expect(403);
    });
  });
});

// ===============================
// SHOP MANAGEMENT TESTS
// ===============================

describe('Shop Management Endpoints', () => {
  describe('GET /api/shops', () => {
    it('should return shops with location filtering', async () => {
      const seller = await createTestUser({ user_type: 'seller' });
      const shop = await createTestShop(seller);

      const response = await request(app)
        .get('/api/shops')
        .query({
          location_lat: 25.2048,
          location_lng: 55.2708,
          radius_km: 10
        })
        .expect(200);

      expect(response.body).toHaveProperty('shops');
      expect(Array.isArray(response.body.shops)).toBe(true);
    });

    it('should filter shops by delivery availability', async () => {
      const seller = await createTestUser({ user_type: 'seller' });
      const shop = await createTestShop(seller, { delivery_available: true });

      const response = await request(app)
        .get('/api/shops')
        .query({ delivery_available: true })
        .expect(200);

      expect(response.body.shops.every(shop => shop.delivery_available === true)).toBe(true);
    });

    it('should sort shops by rating', async () => {
      const response = await request(app)
        .get('/api/shops')
        .query({ sort_by: 'rating_average', sort_order: 'desc' })
        .expect(200);

      const ratings = response.body.shops.map(shop => shop.rating_average);
      const sortedRatings = [...ratings].sort((a, b) => b - a);
      expect(ratings).toEqual(sortedRatings);
    });
  });

  describe('POST /api/shops', () => {
    it('should create new shop for seller', async () => {
      const seller = await createTestUser({ user_type: 'seller' });
      const token = generateTestToken(seller.id);

      const shopData = {
        name: 'New Test Shop',
        phones: ['971501234567'],
        location_lat: 25.2582,
        location_lng: 55.3047,
        address: 'New Shop Address',
        delivery_available: true
      };

      const response = await request(app)
        .post('/api/shops')
        .set('Authorization', `Bearer ${token}`)
        .send(shopData)
        .expect(201);

      expect(response.body.name).toBe(shopData.name);
      expect(response.body.user_id).toBe(seller.id);
    });

    it('should reject shop creation for buyer', async () => {
      const buyer = await createTestUser({ user_type: 'buyer' });
      const token = generateTestToken(buyer.id);

      const shopData = {
        name: 'Unauthorized Shop',
        location_lat: 25.2582,
        location_lng: 55.3047,
        address: 'Test Address'
      };

      const response = await request(app)
        .post('/api/shops')
        .set('Authorization', `Bearer ${token}`)
        .send(shopData)
        .expect(403);
    });
  });

  describe('GET /api/shops/near-me', () => {
    it('should return nearby shops with distances', async () => {
      const seller = await createTestUser({ user_type: 'seller' });
      const shop = await createTestShop(seller);

      const response = await request(app)
        .get('/api/shops/near-me')
        .query({
          lat: 25.2048,
          lng: 55.2708,
          radius: 20
        })
        .expect(200);

      expect(response.body).toHaveProperty('shops');
      response.body.shops.forEach(shop => {
        expect(shop).toHaveProperty('distance_km');
        expect(typeof shop.distance_km).toBe('number');
      });
    });
  });
});

// ===============================
// PRODUCT AND CATALOG TESTS
// ===============================

describe('Product Catalog Endpoints', () => {
  let testCategory, testProduct, testVariant, testShop, seller;

  beforeEach(async () => {
    // Create test data
    seller = await createTestUser({ user_type: 'seller' });
    testShop = await createTestShop(seller);

    const categoryResult = await pool.query(`
      INSERT INTO categories (id, name, category_path, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [`cat_${Date.now()}`, 'Test Category', 'test-category', Date.now(), Date.now()]);
    testCategory = categoryResult.rows[0];

    const productResult = await pool.query(`
      INSERT INTO products (id, canonical_name, category_id, base_unit, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [`prd_${Date.now()}`, 'Test Product', testCategory.id, 'kg', Date.now(), Date.now()]);
    testProduct = productResult.rows[0];

    const variantResult = await pool.query(`
      INSERT INTO product_variants (id, product_id, brand, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [`var_${Date.now()}`, testProduct.id, 'Test Brand', Date.now(), Date.now()]);
    testVariant = variantResult.rows[0];
  });

  describe('GET /api/categories', () => {
    it('should return category hierarchy', async () => {
      const response = await request(app)
        .get('/api/categories')
        .expect(200);

      expect(response.body).toHaveProperty('categories');
      expect(Array.isArray(response.body.categories)).toBe(true);
    });

    it('should filter categories by parent_id', async () => {
      const response = await request(app)
        .get('/api/categories')
        .query({ parent_id: testCategory.id })
        .expect(200);

      response.body.categories.forEach(category => {
        expect(category.parent_id).toBe(testCategory.id);
      });
    });
  });

  describe('GET /api/products', () => {
    it('should search products with query', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ q: 'Test' })
        .expect(200);

      expect(response.body).toHaveProperty('products');
      expect(response.body).toHaveProperty('total');
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({ category_id: testCategory.id })
        .expect(200);

      response.body.products.forEach(product => {
        expect(product.category_id).toBe(testCategory.id);
      });
    });
  });

  describe('GET /api/products/:product_id', () => {
    it('should return product with variants and prices', async () => {
      // Add price for the variant
      await pool.query(`
        INSERT INTO prices (id, shop_id, variant_id, price, price_per_base_unit, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [`prc_${Date.now()}`, testShop.id, testVariant.id, 25.50, 0.51, Date.now(), Date.now()]);

      const response = await request(app)
        .get(`/api/products/${testProduct.id}`)
        .expect(200);

      expect(response.body.id).toBe(testProduct.id);
      expect(response.body).toHaveProperty('variants');
      expect(Array.isArray(response.body.variants)).toBe(true);
    });

    it('should include location-based shop filtering', async () => {
      const response = await request(app)
        .get(`/api/products/${testProduct.id}`)
        .query({
          location_lat: 25.2048,
          location_lng: 55.2708,
          radius: 10
        })
        .expect(200);

      expect(response.body).toHaveProperty('variants');
    });
  });
});

// ===============================
// PRICE COMPARISON TESTS
// ===============================

describe('Price Comparison Endpoints', () => {
  let testProduct, testVariant, testShop1, testShop2, seller1, seller2;

  beforeEach(async () => {
    // Create test shops and products
    seller1 = await createTestUser({ email: 'seller1@example.com', user_type: 'seller' });
    seller2 = await createTestUser({ email: 'seller2@example.com', user_type: 'seller' });
    testShop1 = await createTestShop(seller1);
    testShop2 = await createTestShop(seller2, {
      location_lat: 25.1171,
      location_lng: 55.2001
    });

    const categoryResult = await pool.query(`
      INSERT INTO categories (id, name, category_path, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [`cat_${Date.now()}`, 'Test Category', 'test-category', Date.now(), Date.now()]);

    const productResult = await pool.query(`
      INSERT INTO products (id, canonical_name, category_id, base_unit, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [`prd_${Date.now()}`, 'Test Product', categoryResult.rows[0].id, 'kg', Date.now(), Date.now()]);
    testProduct = productResult.rows[0];

    const variantResult = await pool.query(`
      INSERT INTO product_variants (id, product_id, brand, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [`var_${Date.now()}`, testProduct.id, 'Test Brand', Date.now(), Date.now()]);
    testVariant = variantResult.rows[0];

    // Add prices
    await pool.query(`
      INSERT INTO prices (id, shop_id, variant_id, price, price_per_base_unit, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7), ($8, $9, $10, $11, $12, $13, $14)
    `, [
      `prc_${Date.now()}_1`, testShop1.id, testVariant.id, 25.50, 0.51, Date.now(), Date.now(),
      `prc_${Date.now()}_2`, testShop2.id, testVariant.id, 24.75, 0.495, Date.now(), Date.now()
    ]);
  });

  describe('GET /api/prices/compare', () => {
    it('should compare prices across multiple shops', async () => {
      const response = await request(app)
        .get('/api/prices/compare')
        .query({
          variant_ids: testVariant.id,
          quantity: 10
        })
        .expect(200);

      expect(response.body).toHaveProperty('comparison');
      expect(response.body).toHaveProperty('optimization');
      expect(Array.isArray(response.body.comparison)).toBe(true);
    });

    it('should include delivery cost calculations', async () => {
      const response = await request(app)
        .get('/api/prices/compare')
        .query({
          variant_ids: testVariant.id,
          quantity: 10,
          include_delivery: true,
          location_lat: 25.2048,
          location_lng: 55.2708
        })
        .expect(200);

      response.body.comparison.forEach(item => {
        item.shop_prices.forEach(shopPrice => {
          expect(shopPrice).toHaveProperty('delivery_fee');
          expect(shopPrice).toHaveProperty('distance_km');
        });
      });
    });

    it('should optimize for multi-shop purchases', async () => {
      const response = await request(app)
        .get('/api/prices/compare')
        .query({
          variant_ids: testVariant.id,
          quantity: 100
        })
        .expect(200);

      expect(response.body.optimization).toHaveProperty('cheapest_single_shop');
      expect(response.body.optimization).toHaveProperty('optimized_multi_shop');
    });
  });

  describe('GET /api/prices', () => {
    it('should return prices with filtering', async () => {
      const response = await request(app)
        .get('/api/prices')
        .query({
          variant_id: testVariant.id,
          min_price: 20,
          max_price: 30
        })
        .expect(200);

      expect(response.body).toHaveProperty('prices');
      response.body.prices.forEach(price => {
        expect(price.price).toBeGreaterThanOrEqual(20);
        expect(price.price).toBeLessThanOrEqual(30);
      });
    });

    it('should sort prices correctly', async () => {
      const response = await request(app)
        .get('/api/prices')
        .query({
          variant_id: testVariant.id,
          sort_by: 'price',
          sort_order: 'asc'
        })
        .expect(200);

      const prices = response.body.prices.map(p => p.price);
      const sortedPrices = [...prices].sort((a, b) => a - b);
      expect(prices).toEqual(sortedPrices);
    });
  });
});

// ===============================
// BOM MANAGEMENT TESTS
// ===============================

describe('BOM Management Endpoints', () => {
  let testUser, testProduct, testVariant;

  beforeEach(async () => {
    testUser = await createTestUser();

    const categoryResult = await pool.query(`
      INSERT INTO categories (id, name, category_path, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [`cat_${Date.now()}`, 'Test Category', 'test-category', Date.now(), Date.now()]);

    const productResult = await pool.query(`
      INSERT INTO products (id, canonical_name, category_id, base_unit, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [`prd_${Date.now()}`, 'Test Product', categoryResult.rows[0].id, 'kg', Date.now(), Date.now()]);
    testProduct = productResult.rows[0];

    const variantResult = await pool.query(`
      INSERT INTO product_variants (id, product_id, brand, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [`var_${Date.now()}`, testProduct.id, 'Test Brand', Date.now(), Date.now()]);
    testVariant = variantResult.rows[0];
  });

  describe('POST /api/boms', () => {
    it('should create new BOM successfully', async () => {
      const token = generateTestToken(testUser.id);

      const bomData = {
        title: 'Test Project BOM',
        description: 'Test project materials list',
        project_type: 'residential'
      };

      const response = await request(app)
        .post('/api/boms')
        .set('Authorization', `Bearer ${token}`)
        .send(bomData)
        .expect(201);

      expect(response.body.title).toBe(bomData.title);
      expect(response.body.user_id).toBe(testUser.id);
      expect(response.body.status).toBe('draft');
    });

    it('should reject BOM creation without authentication', async () => {
      const bomData = {
        title: 'Unauthorized BOM'
      };

      const response = await request(app)
        .post('/api/boms')
        .send(bomData)
        .expect(401);
    });
  });

  describe('POST /api/boms/:bom_id/items', () => {
    it('should add items to BOM', async () => {
      const token = generateTestToken(testUser.id);

      // Create BOM first
      const bomResult = await pool.query(`
        INSERT INTO boms (id, user_id, title, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [`bom_${Date.now()}`, testUser.id, 'Test BOM', Date.now(), Date.now()]);
      const bom = bomResult.rows[0];

      const itemData = {
        variant_id: testVariant.id,
        quantity: 50,
        unit: 'kg',
        waste_factor: 0.1,
        notes: 'Test item'
      };

      const response = await request(app)
        .post(`/api/boms/${bom.id}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send(itemData)
        .expect(201);

      expect(response.body.variant_id).toBe(itemData.variant_id);
      expect(response.body.quantity).toBe(itemData.quantity);
      expect(response.body.total_quantity_needed).toBe(55); // 50 + 10% waste
    });

    it('should reject adding items to non-owned BOM', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const token = generateTestToken(otherUser.id);

      const bomResult = await pool.query(`
        INSERT INTO boms (id, user_id, title, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [`bom_${Date.now()}`, testUser.id, 'Test BOM', Date.now(), Date.now()]);
      const bom = bomResult.rows[0];

      const itemData = {
        variant_id: testVariant.id,
        quantity: 50,
        unit: 'kg'
      };

      const response = await request(app)
        .post(`/api/boms/${bom.id}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send(itemData)
        .expect(403);
    });
  });

  describe('GET /api/boms/:bom_id/cost-analysis', () => {
    it('should return comprehensive cost analysis', async () => {
      const token = generateTestToken(testUser.id);

      // Create BOM with items
      const bomResult = await pool.query(`
        INSERT INTO boms (id, user_id, title, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [`bom_${Date.now()}`, testUser.id, 'Test BOM', Date.now(), Date.now()]);
      const bom = bomResult.rows[0];

      await pool.query(`
        INSERT INTO bom_items (id, bom_id, variant_id, quantity, unit, waste_factor, total_quantity_needed, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [`item_${Date.now()}`, bom.id, testVariant.id, 50, 'kg', 0.1, 55, Date.now(), Date.now()]);

      const response = await request(app)
        .get(`/api/boms/${bom.id}/cost-analysis`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('total_cost');
      expect(response.body).toHaveProperty('item_count');
      expect(response.body).toHaveProperty('shop_breakdown');
      expect(response.body).toHaveProperty('optimization_suggestions');
    });
  });
});

// ===============================
// RFQ SYSTEM TESTS
// ===============================

describe('RFQ System Endpoints', () => {
  let buyer, seller, testShop, testBom;

  beforeEach(async () => {
    buyer = await createTestUser({ email: 'buyer@example.com', user_type: 'buyer' });
    seller = await createTestUser({ email: 'seller@example.com', user_type: 'seller' });
    testShop = await createTestShop(seller);

    const bomResult = await pool.query(`
      INSERT INTO boms (id, user_id, title, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [`bom_${Date.now()}`, buyer.id, 'Test BOM', 'active', Date.now(), Date.now()]);
    testBom = bomResult.rows[0];
  });

  describe('POST /api/rfqs', () => {
    it('should create RFQ successfully', async () => {
      const token = generateTestToken(buyer.id);

      const rfqData = {
        bom_id: testBom.id,
        title: 'Test RFQ',
        description: 'Need quotes for materials',
        priority: 'medium',
        deadline: Date.now() + 86400000, // 24 hours from now
        budget_limit: 10000
      };

      const response = await request(app)
        .post('/api/rfqs')
        .set('Authorization', `Bearer ${token}`)
        .send(rfqData)
        .expect(201);

      expect(response.body.title).toBe(rfqData.title);
      expect(response.body.user_id).toBe(buyer.id);
      expect(response.body.bom_id).toBe(testBom.id);
      expect(response.body.status).toBe('pending');
    });

    it('should reject RFQ for non-owned BOM', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const token = generateTestToken(otherUser.id);

      const rfqData = {
        bom_id: testBom.id,
        title: 'Unauthorized RFQ'
      };

      const response = await request(app)
        .post('/api/rfqs')
        .set('Authorization', `Bearer ${token}`)
        .send(rfqData)
        .expect(403);
    });
  });

  describe('POST /api/rfqs/:rfq_id/replies', () => {
    it('should submit quote reply successfully', async () => {
      const token = generateTestToken(seller.id);

      // Create RFQ first
      const rfqResult = await pool.query(`
        INSERT INTO rfqs (id, user_id, bom_id, title, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [`rfq_${Date.now()}`, buyer.id, testBom.id, 'Test RFQ', 'active', Date.now(), Date.now()]);
      const rfq = rfqResult.rows[0];

      const replyData = {
        total_price: 8500,
        delivery_fee: 200,
        delivery_days: 3,
        notes: 'Quality materials, competitive pricing',
        line_items: [
          {
            variant_id: 'var_123',
            quantity: 50,
            unit_price: 170,
            total_price: 8500
          }
        ]
      };

      const response = await request(app)
        .post(`/api/rfqs/${rfq.id}/replies`)
        .set('Authorization', `Bearer ${token}`)
        .send(replyData)
        .expect(201);

      expect(response.body.total_price).toBe(replyData.total_price);
      expect(response.body.shop_id).toBe(testShop.id);
      expect(response.body.status).toBe('pending');
    });

    it('should reject quote from buyer', async () => {
      const token = generateTestToken(buyer.id);

      const rfqResult = await pool.query(`
        INSERT INTO rfqs (id, user_id, bom_id, title, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [`rfq_${Date.now()}`, buyer.id, testBom.id, 'Test RFQ', 'active', Date.now(), Date.now()]);
      const rfq = rfqResult.rows[0];

      const replyData = {
        total_price: 8500,
        line_items: []
      };

      const response = await request(app)
        .post(`/api/rfqs/${rfq.id}/replies`)
        .set('Authorization', `Bearer ${token}`)
        .send(replyData)
        .expect(403);
    });
  });

  describe('POST /api/rfqs/:rfq_id/messages', () => {
    it('should send message in RFQ thread', async () => {
      const buyerToken = generateTestToken(buyer.id);

      const rfqResult = await pool.query(`
        INSERT INTO rfqs (id, user_id, bom_id, title, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [`rfq_${Date.now()}`, buyer.id, testBom.id, 'Test RFQ', 'active', Date.now(), Date.now()]);
      const rfq = rfqResult.rows[0];

      const messageData = {
        message: 'When can you deliver these materials?',
        message_type: 'text'
      };

      const response = await request(app)
        .post(`/api/rfqs/${rfq.id}/messages`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send(messageData)
        .expect(201);

      expect(response.body.message).toBe(messageData.message);
      expect(response.body.sender_id).toBe(buyer.id);
      expect(response.body.rfq_id).toBe(rfq.id);
    });
  });
});

// ===============================
// ALERTS AND NOTIFICATIONS TESTS
// ===============================

describe('Alerts and Notifications', () => {
  let testUser, testVariant;

  beforeEach(async () => {
    testUser = await createTestUser();

    const categoryResult = await pool.query(`
      INSERT INTO categories (id, name, category_path, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [`cat_${Date.now()}`, 'Test Category', 'test-category', Date.now(), Date.now()]);

    const productResult = await pool.query(`
      INSERT INTO products (id, canonical_name, category_id, base_unit, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [`prd_${Date.now()}`, 'Test Product', categoryResult.rows[0].id, 'kg', Date.now(), Date.now()]);

    const variantResult = await pool.query(`
      INSERT INTO product_variants (id, product_id, brand, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [`var_${Date.now()}`, productResult.rows[0].id, 'Test Brand', Date.now(), Date.now()]);
    testVariant = variantResult.rows[0];
  });

  describe('POST /api/alerts', () => {
    it('should create price alert successfully', async () => {
      const token = generateTestToken(testUser.id);

      const alertData = {
        type: 'price_drop',
        variant_id: testVariant.id,
        threshold_value: 25.00,
        condition_type: 'below',
        notification_methods: ['push', 'email']
      };

      const response = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send(alertData)
        .expect(201);

      expect(response.body.type).toBe(alertData.type);
      expect(response.body.user_id).toBe(testUser.id);
      expect(response.body.threshold_value).toBe(alertData.threshold_value);
      expect(response.body.active).toBe(true);
    });

    it('should create stock availability alert', async () => {
      const token = generateTestToken(testUser.id);

      const alertData = {
        type: 'stock_available',
        variant_id: testVariant.id,
        condition_type: 'in_stock',
        notification_methods: ['push']
      };

      const response = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send(alertData)
        .expect(201);

      expect(response.body.type).toBe(alertData.type);
      expect(response.body.threshold_value).toBeNull();
    });
  });

  describe('GET /api/alerts', () => {
    it('should return user alerts with filtering', async () => {
      const token = generateTestToken(testUser.id);

      // Create test alert
      await pool.query(`
        INSERT INTO alerts (id, user_id, type, variant_id, threshold_value, condition_type, notification_methods, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [`alr_${Date.now()}`, testUser.id, 'price_drop', testVariant.id, 25.00, 'below', JSON.stringify(['push']), Date.now(), Date.now()]);

      const response = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${token}`)
        .query({ type: 'price_drop' })
        .expect(200);

      expect(response.body).toHaveProperty('alerts');
      response.body.alerts.forEach(alert => {
        expect(alert.type).toBe('price_drop');
        expect(alert.user_id).toBe(testUser.id);
      });
    });
  });

  describe('GET /api/notifications', () => {
    it('should return user notifications', async () => {
      const token = generateTestToken(testUser.id);

      // Create test notification
      await pool.query(`
        INSERT INTO notifications (id, user_id, type, title, message, priority, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [`not_${Date.now()}`, testUser.id, 'price_alert', 'Price Drop Alert', 'Test product price dropped', 'normal', Date.now()]);

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('notifications');
      expect(response.body).toHaveProperty('unread_count');
    });
  });
});

// ===============================
// WEBSOCKET TESTS
// ===============================

describe('WebSocket Events', () => {
  let wsClient;
  let testUser, testShop, testVariant;

  beforeEach(async () => {
    testUser = await createTestUser();
    const seller = await createTestUser({ user_type: 'seller' });
    testShop = await createTestShop(seller);

    // Setup test product and variant
    const categoryResult = await pool.query(`
      INSERT INTO categories (id, name, category_path, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [`cat_${Date.now()}`, 'Test Category', 'test-category', Date.now(), Date.now()]);

    const productResult = await pool.query(`
      INSERT INTO products (id, canonical_name, category_id, base_unit, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [`prd_${Date.now()}`, 'Test Product', categoryResult.rows[0].id, 'kg', Date.now(), Date.now()]);

    const variantResult = await pool.query(`
      INSERT INTO product_variants (id, product_id, brand, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [`var_${Date.now()}`, productResult.rows[0].id, 'Test Brand', Date.now(), Date.now()]);
    testVariant = variantResult.rows[0];

    // Create WebSocket connection
    const token = generateTestToken(testUser.id);
    wsClient = new WebSocket(`ws://localhost:3000/ws?token=${token}`);
  });

  afterEach(() => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
  });

  describe('Price Update Events', () => {
    it('should receive price update events', (done) => {
      wsClient.on('open', () => {
        // Subscribe to price updates
        wsClient.send(JSON.stringify({
          action: 'subscribe',
          channel: 'prices/updates'
        }));

        // Simulate price update
        const priceUpdate = {
          event_type: 'price_updated',
          price_data: {
            id: `prc_${Date.now()}`,
            shop_id: testShop.id,
            variant_id: testVariant.id,
            price: 23.50,
            price_per_base_unit: 0.47,
            updated_at: Date.now()
          },
          previous_price: 25.00,
          timestamp: Date.now()
        };

        wsClient.send(JSON.stringify({
          action: 'publish',
          channel: 'prices/updates',
          data: priceUpdate
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.channel === 'prices/updates') {
          expect(message.data.event_type).toBe('price_updated');
          expect(message.data.price_data.price).toBe(23.50);
          done();
        }
      });
    });
  });

  describe('RFQ Message Events', () => {
    it('should handle RFQ chat messages', (done) => {
      const rfqId = `rfq_${Date.now()}`;

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          action: 'subscribe',
          channel: `rfq/${rfqId}/messages`
        }));

        // Send test message
        const message = {
          message_data: {
            id: `msg_${Date.now()}`,
            rfq_id: rfqId,
            sender_id: testUser.id,
            message: 'Test message',
            message_type: 'text',
            created_at: Date.now()
          },
          sender_info: {
            user_id: testUser.id,
            name: testUser.name,
            user_type: testUser.user_type
          },
          timestamp: Date.now()
        };

        wsClient.send(JSON.stringify({
          action: 'publish',
          channel: `rfq/${rfqId}/messages`,
          data: message
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.channel === `rfq/${rfqId}/messages`) {
          expect(message.data.message_data.message).toBe('Test message');
          expect(message.data.sender_info.user_id).toBe(testUser.id);
          done();
        }
      });
    });
  });

  describe('Typing Indicator Events', () => {
    it('should handle typing indicators', (done) => {
      const rfqId = `rfq_${Date.now()}`;

      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          action: 'subscribe',
          channel: `rfq/${rfqId}/typing`
        }));

        const typingIndicator = {
          rfq_id: rfqId,
          user_id: testUser.id,
          user_name: testUser.name,
          is_typing: true,
          timestamp: Date.now()
        };

        wsClient.send(JSON.stringify({
          action: 'publish',
          channel: `rfq/${rfqId}/typing`,
          data: typingIndicator
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.channel === `rfq/${rfqId}/typing`) {
          expect(message.data.is_typing).toBe(true);
          expect(message.data.user_id).toBe(testUser.id);
          done();
        }
      });
    });
  });

  describe('Alert Triggered Events', () => {
    it('should receive triggered alert notifications', (done) => {
      wsClient.on('open', () => {
        wsClient.send(JSON.stringify({
          action: 'subscribe',
          channel: 'alerts/triggered'
        }));

        const alertTriggered = {
          event_type: 'price_alert_triggered',
          alert_data: {
            id: `alr_${Date.now()}`,
            user_id: testUser.id,
            type: 'price_drop',
            threshold_value: 25.00,
            condition_type: 'below',
            active: true,
            triggered_count: 1
          },
          trigger_data: {
            current_value: 23.50,
            previous_value: 25.00,
            percentage_change: -6.0,
            trigger_reason: 'Price dropped below threshold'
          },
          timestamp: Date.now()
        };

        wsClient.send(JSON.stringify({
          action: 'publish',
          channel: 'alerts/triggered',
          data: alertTriggered
        }));
      });

      wsClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.channel === 'alerts/triggered') {
          expect(message.data.event_type).toBe('price_alert_triggered');
          expect(message.data.trigger_data.current_value).toBe(23.50);
          done();
        }
      });
    });
  });
});

// ===============================
// ERROR HANDLING TESTS
// ===============================

describe('Error Handling', () => {
  describe('Authentication Errors', () => {
    it('should handle invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle expired JWT tokens', async () => {
      const expiredToken = jwt.sign({ userId: 'test' }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '-1h' });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Validation Errors', () => {
    it('should handle invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
          user_type: 'buyer'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com'
          // Missing password, name, user_type
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid coordinate values', async () => {
      const user = await createTestUser({ user_type: 'seller' });
      const token = generateTestToken(user.id);

      const response = await request(app)
        .post('/api/shops')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Shop',
          location_lat: 100, // Invalid latitude
          location_lng: 200, // Invalid longitude
          address: 'Test Address'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Database Constraint Errors', () => {
    it('should handle foreign key constraint violations', async () => {
      const user = await createTestUser();
      const token = generateTestToken(user.id);

      const response = await request(app)
        .post('/api/boms/nonexistent-bom/items')
        .set('Authorization', `Bearer ${token}`)
        .send({
          variant_id: 'nonexistent-variant',
          quantity: 10,
          unit: 'kg'
        })
        .expect(404);
    });
  });

  describe('Authorization Errors', () => {
    it('should handle unauthorized shop access', async () => {
      const user1 = await createTestUser({ user_type: 'seller' });
      const user2 = await createTestUser({ email: 'user2@example.com', user_type: 'seller' });
      const shop = await createTestShop(user1);
      const token = generateTestToken(user2.id);

      const response = await request(app)
        .put(`/api/shops/${shop.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Shop' })
        .expect(403);
    });

    it('should handle buyer trying seller operations', async () => {
      const buyer = await createTestUser({ user_type: 'buyer' });
      const token = generateTestToken(buyer.id);

      const response = await request(app)
        .post('/api/shops')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Unauthorized Shop',
          location_lat: 25.2582,
          location_lng: 55.3047,
          address: 'Test Address'
        })
        .expect(403);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting on login attempts', async () => {
      const promises = [];
      
      // Attempt multiple rapid logins
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // Should eventually get rate limited (429 status)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Not Found', () => {
    it('should handle non-existent resource requests', async () => {
      const response = await request(app)
        .get('/api/products/nonexistent-product')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle non-existent user profiles', async () => {
      const response = await request(app)
        .get('/api/users/nonexistent-user')
        .expect(404);
    });
  });
});

// ===============================
// PERFORMANCE TESTS
// ===============================

describe('Performance Tests', () => {
  describe('Database Query Performance', () => {
    it('should handle large product searches efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/products')
        .query({ limit: 100 })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within 2 seconds
      expect(responseTime).toBeLessThan(2000);
      expect(response.body.products.length).toBeLessThanOrEqual(100);
    });

    it('should handle complex price comparisons efficiently', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/prices/compare')
        .query({
          variant_ids: 'var_001,var_002,var_003',
          quantity: 100,
          include_delivery: true
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within 3 seconds for complex comparisons
      expect(responseTime).toBeLessThan(3000);
    });
  });

  describe('Concurrent User Handling', () => {
    it('should handle multiple simultaneous requests', async () => {
      const promises = [];

      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .get('/api/categories')
            .expect(200)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should handle 20 concurrent requests within 5 seconds
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});

// ===============================
// SEARCH AND FILTERING TESTS
// ===============================

describe('Search and Filtering', () => {
  describe('Universal Search', () => {
    it('should search across products, shops, and categories', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'cement', type: 'all' })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toHaveProperty('products');
      expect(response.body.results).toHaveProperty('shops');
      expect(response.body.results).toHaveProperty('categories');
    });

    it('should provide search suggestions', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ q: 'cem', limit: 5 })
        .expect(200);

      expect(response.body).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
      expect(response.body.suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Location-Based Filtering', () => {
    it('should filter shops by location radius', async () => {
      const response = await request(app)
        .get('/api/shops')
        .query({
          location_lat: 25.2048,
          location_lng: 55.2708,
          radius_km: 5
        })
        .expect(200);

      // All returned shops should be within the specified radius
      response.body.shops.forEach(shop => {
        if (shop.distance_km !== undefined) {
          expect(shop.distance_km).toBeLessThanOrEqual(5);
        }
      });
    });
  });

  describe('Advanced Product Filtering', () => {
    it('should filter products by multiple criteria', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({
          q: 'cement',
          category_id: 'cat_002',
          is_active: true
        })
        .expect(200);

      response.body.products.forEach(product => {
        expect(product.is_active).toBe(true);
        if (product.category_id) {
          expect(product.category_id).toBe('cat_002');
        }
      });
    });
  });
});