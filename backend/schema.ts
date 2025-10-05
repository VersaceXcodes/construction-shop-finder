import { z } from 'zod';

// ===============================
// USERS SCHEMAS
// ===============================

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  password_hash: z.string(),
  name: z.string(),
  user_type: z.string(),
  location_lat: z.number().nullable(),
  location_lng: z.number().nullable(),
  address: z.string().nullable(),
  preferences: z.record(z.unknown()).nullable(),
  is_verified: z.boolean(),
  verification_token: z.string().nullable(),
  reset_token: z.string().nullable(),
  reset_token_expires: z.number().nullable(),
  last_login: z.number().nullable(),
  created_at: z.number(),
  updated_at: z.number()
});

export const createUserInputSchema = z.object({
  email: z.string().email().min(1).max(255),
  phone: z.string().min(1).max(255).nullable(),
  password_hash: z.string().min(1),
  name: z.string().min(1).max(255),
  user_type: z.enum(['buyer', 'seller']).default('buyer'),
  location_lat: z.number().min(-90).max(90).nullable(),
  location_lng: z.number().min(-180).max(180).nullable(),
  address: z.string().nullable(),
  preferences: z.record(z.unknown()).default({}).nullable()
});

export const updateUserInputSchema = z.object({
  id: z.string(),
  email: z.string().email().min(1).max(255).optional(),
  phone: z.string().min(1).max(255).nullable().optional(),
  name: z.string().min(1).max(255).optional(),
  user_type: z.enum(['buyer', 'seller']).optional(),
  location_lat: z.number().min(-90).max(90).nullable().optional(),
  location_lng: z.number().min(-180).max(180).nullable().optional(),
  address: z.string().nullable().optional(),
  preferences: z.record(z.unknown()).nullable().optional(),
  is_verified: z.boolean().optional()
});

export const searchUsersInputSchema = z.object({
  query: z.string().optional(),
  user_type: z.enum(['buyer', 'seller']).optional(),
  is_verified: z.boolean().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'created_at', 'email']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ===============================
// SHOPS SCHEMAS
// ===============================

export const shopSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  phones: z.array(z.string()),
  location_lat: z.number(),
  location_lng: z.number(),
  address: z.string(),
  hours: z.record(z.string()).nullable(),
  verified: z.boolean(),
  business_license: z.string().nullable(),
  shop_type: z.string().nullable(),
  delivery_available: z.boolean(),
  delivery_radius: z.number().nullable(),
  delivery_fee_base: z.number().nullable(),
  delivery_fee_per_km: z.number().nullable(),
  minimum_order: z.number().nullable(),
  cash_discount_percentage: z.number().nullable(),
  rating_average: z.number(),
  rating_count: z.number().int(),
  response_time_hours: z.number().nullable(),
  stock_accuracy_score: z.number(),
  created_at: z.number(),
  updated_at: z.number()
});

export const createShopInputSchema = z.object({
  user_id: z.string(),
  name: z.string().min(1).max(255),
  phones: z.array(z.string()).default([]),
  location_lat: z.number().min(-90).max(90),
  location_lng: z.number().min(-180).max(180),
  address: z.string().min(1),
  hours: z.record(z.string()).nullable(),
  business_license: z.string().nullable(),
  shop_type: z.string().nullable(),
  delivery_available: z.boolean().default(false),
  delivery_radius: z.number().positive().nullable(),
  delivery_fee_base: z.number().nonnegative().nullable(),
  delivery_fee_per_km: z.number().nonnegative().nullable(),
  minimum_order: z.number().positive().nullable(),
  cash_discount_percentage: z.number().min(0).max(100).nullable()
});

export const updateShopInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  phones: z.array(z.string()).optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  address: z.string().min(1).optional(),
  hours: z.record(z.string()).nullable().optional(),
  business_license: z.string().nullable().optional(),
  shop_type: z.string().nullable().optional(),
  delivery_available: z.boolean().optional(),
  delivery_radius: z.number().positive().nullable().optional(),
  delivery_fee_base: z.number().nonnegative().nullable().optional(),
  delivery_fee_per_km: z.number().nonnegative().nullable().optional(),
  minimum_order: z.number().positive().nullable().optional(),
  cash_discount_percentage: z.number().min(0).max(100).nullable().optional(),
  verified: z.boolean().optional()
});

export const searchShopsInputSchema = z.object({
  query: z.string().optional(),
  shop_type: z.string().optional(),
  verified: z.boolean().optional(),
  delivery_available: z.boolean().optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  radius_km: z.number().positive().default(10),
  min_rating: z.number().min(0).max(5).optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'rating_average', 'created_at', 'distance']).default('rating_average'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ===============================
// CATEGORIES SCHEMAS
// ===============================

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  parent_id: z.string().nullable(),
  category_path: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  sort_order: z.number().int(),
  is_active: z.boolean(),
  created_at: z.number(),
  updated_at: z.number()
});

export const createCategoryInputSchema = z.object({
  name: z.string().min(1).max(255),
  parent_id: z.string().nullable(),
  category_path: z.string().min(1).max(500),
  description: z.string().nullable(),
  image_url: z.string().url().nullable(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true)
});

export const updateCategoryInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255).optional(),
  parent_id: z.string().nullable().optional(),
  category_path: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

export const searchCategoriesInputSchema = z.object({
  query: z.string().optional(),
  parent_id: z.string().optional(),
  is_active: z.boolean().default(true),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'sort_order', 'created_at']).default('sort_order'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

// ===============================
// PRODUCTS SCHEMAS
// ===============================

export const productSchema = z.object({
  id: z.string(),
  canonical_name: z.string(),
  category_id: z.string(),
  subcategory: z.string().nullable(),
  base_unit: z.string(),
  description: z.string().nullable(),
  specifications: z.record(z.unknown()).nullable(),
  synonyms: z.array(z.string()).nullable(),
  image_url: z.string().nullable(),
  waste_factor_percentage: z.number(),
  is_active: z.boolean(),
  created_at: z.number(),
  updated_at: z.number()
});

export const createProductInputSchema = z.object({
  canonical_name: z.string().min(1).max(255),
  category_id: z.string(),
  subcategory: z.string().nullable(),
  base_unit: z.string().min(1).max(50),
  description: z.string().nullable(),
  specifications: z.record(z.unknown()).default({}).nullable(),
  synonyms: z.array(z.string()).default([]).nullable(),
  image_url: z.string().url().nullable(),
  waste_factor_percentage: z.number().min(0).max(100).default(0),
  is_active: z.boolean().default(true)
});

export const updateProductInputSchema = z.object({
  id: z.string(),
  canonical_name: z.string().min(1).max(255).optional(),
  category_id: z.string().optional(),
  subcategory: z.string().nullable().optional(),
  base_unit: z.string().min(1).max(50).optional(),
  description: z.string().nullable().optional(),
  specifications: z.record(z.unknown()).nullable().optional(),
  synonyms: z.array(z.string()).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  waste_factor_percentage: z.number().min(0).max(100).optional(),
  is_active: z.boolean().optional()
});

export const searchProductsInputSchema = z.object({
  query: z.string().optional(),
  category_id: z.string().optional(),
  subcategory: z.string().optional(),
  is_active: z.boolean().default(true),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['canonical_name', 'created_at', 'category_id']).default('canonical_name'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

// ===============================
// PRODUCT VARIANTS SCHEMAS
// ===============================

export const productVariantSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  brand: z.string().nullable(),
  grade: z.string().nullable(),
  size: z.string().nullable(),
  pack_quantity: z.number().nullable(),
  pack_unit: z.string().nullable(),
  unit_to_base_factor: z.number(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  image_url: z.string().nullable(),
  specifications: z.record(z.unknown()).nullable(),
  is_active: z.boolean(),
  created_at: z.number(),
  updated_at: z.number()
});

export const createProductVariantInputSchema = z.object({
  product_id: z.string(),
  brand: z.string().nullable(),
  grade: z.string().nullable(),
  size: z.string().nullable(),
  pack_quantity: z.number().positive().nullable(),
  pack_unit: z.string().nullable(),
  unit_to_base_factor: z.number().positive().default(1),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  image_url: z.string().url().nullable(),
  specifications: z.record(z.unknown()).default({}).nullable(),
  is_active: z.boolean().default(true)
});

export const updateProductVariantInputSchema = z.object({
  id: z.string(),
  brand: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  pack_quantity: z.number().positive().nullable().optional(),
  pack_unit: z.string().nullable().optional(),
  unit_to_base_factor: z.number().positive().optional(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  specifications: z.record(z.unknown()).nullable().optional(),
  is_active: z.boolean().optional()
});

export const searchProductVariantsInputSchema = z.object({
  query: z.string().optional(),
  product_id: z.string().optional(),
  brand: z.string().optional(),
  grade: z.string().optional(),
  is_active: z.boolean().default(true),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['brand', 'created_at', 'pack_quantity']).default('brand'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

// ===============================
// PRICES SCHEMAS
// ===============================

export const priceSchema = z.object({
  id: z.string(),
  shop_id: z.string(),
  variant_id: z.string(),
  price: z.number(),
  currency: z.string(),
  price_per_base_unit: z.number(),
  bulk_pricing_tiers: z.array(z.record(z.unknown())).nullable(),
  promotional_price: z.number().nullable(),
  promotion_start_date: z.number().nullable(),
  promotion_end_date: z.number().nullable(),
  source: z.string(),
  verified: z.boolean(),
  verifications_count: z.number().int(),
  last_verified_at: z.number().nullable(),
  created_at: z.number(),
  updated_at: z.number()
});

export const createPriceInputSchema = z.object({
  shop_id: z.string(),
  variant_id: z.string(),
  price: z.number().positive(),
  currency: z.string().length(3).default('AED'),
  price_per_base_unit: z.number().positive(),
  bulk_pricing_tiers: z.array(z.object({
    min_qty: z.number().positive(),
    price: z.number().positive()
  })).default([]).nullable(),
  promotional_price: z.number().positive().nullable(),
  promotion_start_date: z.number().nullable(),
  promotion_end_date: z.number().nullable(),
  source: z.enum(['shop', 'user', 'system']).default('shop')
});

export const updatePriceInputSchema = z.object({
  id: z.string(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  price_per_base_unit: z.number().positive().optional(),
  bulk_pricing_tiers: z.array(z.object({
    min_qty: z.number().positive(),
    price: z.number().positive()
  })).nullable().optional(),
  promotional_price: z.number().positive().nullable().optional(),
  promotion_start_date: z.number().nullable().optional(),
  promotion_end_date: z.number().nullable().optional(),
  verified: z.boolean().optional()
});

export const searchPricesInputSchema = z.object({
  shop_id: z.string().optional(),
  variant_id: z.string().optional(),
  min_price: z.number().positive().optional(),
  max_price: z.number().positive().optional(),
  currency: z.string().length(3).default('AED'),
  verified: z.boolean().optional(),
  has_promotion: z.boolean().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['price', 'price_per_base_unit', 'created_at', 'verified']).default('price'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

// ===============================
// INVENTORY SCHEMAS
// ===============================

export const inventorySchema = z.object({
  shop_id: z.string(),
  variant_id: z.string(),
  in_stock: z.boolean(),
  stock_quantity: z.number().nullable(),
  low_stock_threshold: z.number().nullable(),
  lead_time_days: z.number().int(),
  minimum_order_quantity: z.number(),
  maximum_order_quantity: z.number().nullable(),
  updated_at: z.number()
});

export const createInventoryInputSchema = z.object({
  shop_id: z.string(),
  variant_id: z.string(),
  in_stock: z.boolean().default(true),
  stock_quantity: z.number().nonnegative().nullable(),
  low_stock_threshold: z.number().positive().nullable(),
  lead_time_days: z.number().int().nonnegative().default(0),
  minimum_order_quantity: z.number().positive().default(1),
  maximum_order_quantity: z.number().positive().nullable()
});

export const updateInventoryInputSchema = z.object({
  shop_id: z.string(),
  variant_id: z.string(),
  in_stock: z.boolean().optional(),
  stock_quantity: z.number().nonnegative().nullable().optional(),
  low_stock_threshold: z.number().positive().nullable().optional(),
  lead_time_days: z.number().int().nonnegative().optional(),
  minimum_order_quantity: z.number().positive().optional(),
  maximum_order_quantity: z.number().positive().nullable().optional()
});

export const searchInventoryInputSchema = z.object({
  shop_id: z.string().optional(),
  variant_id: z.string().optional(),
  in_stock: z.boolean().optional(),
  low_stock_only: z.boolean().default(false),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['updated_at', 'stock_quantity']).default('updated_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ===============================
// BOMS SCHEMAS
// ===============================

export const bomSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  project_type: z.string().nullable(),
  template: z.string().nullable(),
  total_cost: z.number(),
  item_count: z.number().int(),
  status: z.string(),
  shared_token: z.string().nullable(),
  is_public: z.boolean(),
  duplicate_source_id: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number()
});

export const createBomInputSchema = z.object({
  user_id: z.string(),
  title: z.string().min(1).max(255),
  description: z.string().nullable(),
  project_type: z.string().nullable(),
  template: z.string().nullable(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).default('draft'),
  is_public: z.boolean().default(false),
  duplicate_source_id: z.string().nullable()
});

export const updateBomInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  project_type: z.string().nullable().optional(),
  template: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  is_public: z.boolean().optional()
});

export const searchBomsInputSchema = z.object({
  user_id: z.string().optional(),
  query: z.string().optional(),
  project_type: z.string().optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  is_public: z.boolean().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['title', 'created_at', 'updated_at', 'total_cost']).default('updated_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ===============================
// RFQ SCHEMAS
// ===============================

export const rfqSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  bom_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  priority: z.string(),
  deadline: z.number().nullable(),
  delivery_location_lat: z.number().nullable(),
  delivery_location_lng: z.number().nullable(),
  delivery_address: z.string().nullable(),
  special_requirements: z.string().nullable(),
  budget_limit: z.number().nullable(),
  responses_count: z.number().int(),
  created_at: z.number(),
  updated_at: z.number()
});

export const createRfqInputSchema = z.object({
  user_id: z.string(),
  bom_id: z.string(),
  title: z.string().min(1).max(255),
  description: z.string().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  deadline: z.number().nullable(),
  delivery_location_lat: z.number().min(-90).max(90).nullable(),
  delivery_location_lng: z.number().min(-180).max(180).nullable(),
  delivery_address: z.string().nullable(),
  special_requirements: z.string().nullable(),
  budget_limit: z.number().positive().nullable()
});

export const updateRfqInputSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['pending', 'active', 'closed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  deadline: z.number().nullable().optional(),
  delivery_location_lat: z.number().min(-90).max(90).nullable().optional(),
  delivery_location_lng: z.number().min(-180).max(180).nullable().optional(),
  delivery_address: z.string().nullable().optional(),
  special_requirements: z.string().nullable().optional(),
  budget_limit: z.number().positive().nullable().optional()
});

export const searchRfqsInputSchema = z.object({
  user_id: z.string().optional(),
  query: z.string().optional(),
  status: z.enum(['pending', 'active', 'closed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  has_deadline: z.boolean().optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  radius_km: z.number().positive().default(50),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'deadline', 'priority', 'budget_limit']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ===============================
// NOTIFICATIONS SCHEMAS
// ===============================

export const notificationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  data: z.record(z.unknown()).nullable(),
  read_at: z.number().nullable(),
  action_url: z.string().nullable(),
  priority: z.string(),
  created_at: z.number()
});

export const createNotificationInputSchema = z.object({
  user_id: z.string(),
  type: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  data: z.record(z.unknown()).default({}).nullable(),
  action_url: z.string().url().nullable(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal')
});

export const updateNotificationInputSchema = z.object({
  id: z.string(),
  read_at: z.number().nullable().optional()
});

export const searchNotificationsInputSchema = z.object({
  user_id: z.string().optional(),
  type: z.string().optional(),
  is_read: z.boolean().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'priority']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ===============================
// REVIEWS SCHEMAS
// ===============================

export const reviewSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  shop_id: z.string().nullable(),
  variant_id: z.string().nullable(),
  rating: z.number().int(),
  review_text: z.string().nullable(),
  images: z.array(z.record(z.string())).nullable(),
  verified_purchase: z.boolean(),
  helpful_votes: z.number().int(),
  total_votes: z.number().int(),
  status: z.string(),
  created_at: z.number(),
  updated_at: z.number()
});

export const createReviewInputSchema = z.object({
  user_id: z.string(),
  shop_id: z.string().nullable(),
  variant_id: z.string().nullable(),
  rating: z.number().int().min(1).max(5),
  review_text: z.string().nullable(),
  images: z.array(z.object({
    url: z.string().url(),
    caption: z.string().optional()
  })).default([]).nullable(),
  verified_purchase: z.boolean().default(false)
});

export const updateReviewInputSchema = z.object({
  id: z.string(),
  rating: z.number().int().min(1).max(5).optional(),
  review_text: z.string().nullable().optional(),
  images: z.array(z.object({
    url: z.string().url(),
    caption: z.string().optional()
  })).nullable().optional(),
  status: z.enum(['active', 'hidden', 'flagged']).optional()
});

export const searchReviewsInputSchema = z.object({
  shop_id: z.string().optional(),
  variant_id: z.string().optional(),
  user_id: z.string().optional(),
  min_rating: z.number().int().min(1).max(5).optional(),
  max_rating: z.number().int().min(1).max(5).optional(),
  verified_purchase: z.boolean().optional(),
  status: z.enum(['active', 'hidden', 'flagged']).default('active'),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'rating', 'helpful_votes']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ===============================
// ANALYTICS EVENTS SCHEMAS
// ===============================

export const analyticsEventSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable(),
  session_id: z.string().nullable(),
  event_type: z.string(),
  event_data: z.record(z.unknown()).nullable(),
  page_url: z.string().nullable(),
  user_agent: z.string().nullable(),
  ip_address: z.string().nullable(),
  created_at: z.number()
});

export const createAnalyticsEventInputSchema = z.object({
  user_id: z.string().nullable(),
  session_id: z.string().nullable(),
  event_type: z.string().min(1).max(100),
  event_data: z.record(z.unknown()).default({}).nullable(),
  page_url: z.string().url().nullable(),
  user_agent: z.string().nullable(),
  ip_address: z.string().ip().nullable()
});

export const searchAnalyticsEventsInputSchema = z.object({
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  event_type: z.string().optional(),
  date_from: z.number().optional(),
  date_to: z.number().optional(),
  limit: z.number().int().positive().default(100),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'event_type']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ===============================
// SYSTEM SETTINGS SCHEMAS
// ===============================

export const systemSettingSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  description: z.string().nullable(),
  updated_by: z.string().nullable(),
  updated_at: z.number()
});

export const createSystemSettingInputSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.unknown(),
  description: z.string().nullable(),
  updated_by: z.string().nullable()
});

export const updateSystemSettingInputSchema = z.object({
  key: z.string(),
  value: z.unknown().optional(),
  description: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional()
});

// ===============================
// TYPE EXPORTS
// ===============================

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type SearchUsersInput = z.infer<typeof searchUsersInputSchema>;

export type Shop = z.infer<typeof shopSchema>;
export type CreateShopInput = z.infer<typeof createShopInputSchema>;
export type UpdateShopInput = z.infer<typeof updateShopInputSchema>;
export type SearchShopsInput = z.infer<typeof searchShopsInputSchema>;

export type Category = z.infer<typeof categorySchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;
export type SearchCategoriesInput = z.infer<typeof searchCategoriesInputSchema>;

export type Product = z.infer<typeof productSchema>;
export type CreateProductInput = z.infer<typeof createProductInputSchema>;
export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;
export type SearchProductsInput = z.infer<typeof searchProductsInputSchema>;

export type ProductVariant = z.infer<typeof productVariantSchema>;
export type CreateProductVariantInput = z.infer<typeof createProductVariantInputSchema>;
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantInputSchema>;
export type SearchProductVariantsInput = z.infer<typeof searchProductVariantsInputSchema>;

export type Price = z.infer<typeof priceSchema>;
export type CreatePriceInput = z.infer<typeof createPriceInputSchema>;
export type UpdatePriceInput = z.infer<typeof updatePriceInputSchema>;
export type SearchPricesInput = z.infer<typeof searchPricesInputSchema>;

export type Inventory = z.infer<typeof inventorySchema>;
export type CreateInventoryInput = z.infer<typeof createInventoryInputSchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventoryInputSchema>;
export type SearchInventoryInput = z.infer<typeof searchInventoryInputSchema>;

export type Bom = z.infer<typeof bomSchema>;
export type CreateBomInput = z.infer<typeof createBomInputSchema>;
export type UpdateBomInput = z.infer<typeof updateBomInputSchema>;
export type SearchBomsInput = z.infer<typeof searchBomsInputSchema>;

export type Rfq = z.infer<typeof rfqSchema>;
export type CreateRfqInput = z.infer<typeof createRfqInputSchema>;
export type UpdateRfqInput = z.infer<typeof updateRfqInputSchema>;
export type SearchRfqsInput = z.infer<typeof searchRfqsInputSchema>;

export type Notification = z.infer<typeof notificationSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationInputSchema>;
export type SearchNotificationsInput = z.infer<typeof searchNotificationsInputSchema>;

export type Review = z.infer<typeof reviewSchema>;
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewInputSchema>;
export type SearchReviewsInput = z.infer<typeof searchReviewsInputSchema>;

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type CreateAnalyticsEventInput = z.infer<typeof createAnalyticsEventInputSchema>;
export type SearchAnalyticsEventsInput = z.infer<typeof searchAnalyticsEventsInputSchema>;

export type SystemSetting = z.infer<typeof systemSettingSchema>;
export type CreateSystemSettingInput = z.infer<typeof createSystemSettingInputSchema>;
export type UpdateSystemSettingInput = z.infer<typeof updateSystemSettingInputSchema>;