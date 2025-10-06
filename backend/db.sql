-- Create tables in dependency order

-- Users table
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS trip_plans CASCADE;
DROP TABLE IF EXISTS saved_searches CASCADE;
DROP TABLE IF EXISTS price_verifications CASCADE;
DROP TABLE IF EXISTS user_favorites CASCADE;
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS rfq_replies CASCADE;
DROP TABLE IF EXISTS rfq_shop_invites CASCADE;
DROP TABLE IF EXISTS rfqs CASCADE;
DROP TABLE IF EXISTS bom_items CASCADE;
DROP TABLE IF EXISTS boms CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS prices CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS shops CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL DEFAULT 'buyer',
    location_lat NUMERIC,
    location_lng NUMERIC,
    address TEXT,
    preferences JSONB DEFAULT '{}',
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires BIGINT,
    last_login BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Shops table
CREATE TABLE shops (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    phones JSONB NOT NULL DEFAULT '[]',
    location_lat NUMERIC NOT NULL,
    location_lng NUMERIC NOT NULL,
    address TEXT NOT NULL,
    hours JSONB DEFAULT '{}',
    verified BOOLEAN NOT NULL DEFAULT false,
    business_license VARCHAR(255),
    shop_type VARCHAR(100),
    delivery_available BOOLEAN NOT NULL DEFAULT false,
    delivery_radius NUMERIC,
    delivery_fee_base NUMERIC,
    delivery_fee_per_km NUMERIC,
    minimum_order NUMERIC,
    cash_discount_percentage NUMERIC,
    rating_average NUMERIC NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    response_time_hours NUMERIC,
    stock_accuracy_score NUMERIC NOT NULL DEFAULT 100,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Categories table
CREATE TABLE categories (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id VARCHAR(255) REFERENCES categories(id),
    category_path VARCHAR(500) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Products table
CREATE TABLE products (
    id VARCHAR(255) PRIMARY KEY,
    canonical_name VARCHAR(255) NOT NULL,
    category_id VARCHAR(255) NOT NULL REFERENCES categories(id),
    subcategory VARCHAR(255),
    base_unit VARCHAR(50) NOT NULL,
    description TEXT,
    specifications JSONB DEFAULT '{}',
    synonyms JSONB DEFAULT '[]',
    image_url VARCHAR(500),
    waste_factor_percentage NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Product variants table
CREATE TABLE product_variants (
    id VARCHAR(255) PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL REFERENCES products(id),
    brand VARCHAR(255),
    grade VARCHAR(100),
    size VARCHAR(100),
    pack_quantity NUMERIC,
    pack_unit VARCHAR(50),
    unit_to_base_factor NUMERIC NOT NULL DEFAULT 1,
    sku VARCHAR(255),
    barcode VARCHAR(255),
    image_url VARCHAR(500),
    specifications JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Prices table
CREATE TABLE prices (
    id VARCHAR(255) PRIMARY KEY,
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(id),
    variant_id VARCHAR(255) NOT NULL REFERENCES product_variants(id),
    price NUMERIC NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'AED',
    price_per_base_unit NUMERIC NOT NULL,
    bulk_pricing_tiers JSONB DEFAULT '[]',
    promotional_price NUMERIC,
    promotion_start_date BIGINT,
    promotion_end_date BIGINT,
    source VARCHAR(50) NOT NULL DEFAULT 'shop',
    verified BOOLEAN NOT NULL DEFAULT false,
    verifications_count INTEGER NOT NULL DEFAULT 0,
    last_verified_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Price history table
CREATE TABLE price_history (
    id VARCHAR(255) PRIMARY KEY,
    variant_id VARCHAR(255) NOT NULL REFERENCES product_variants(id),
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(id),
    date BIGINT NOT NULL,
    price NUMERIC NOT NULL,
    price_per_base_unit NUMERIC NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'AED',
    source VARCHAR(50) NOT NULL,
    created_at BIGINT NOT NULL
);

-- Inventory table (composite primary key)
CREATE TABLE inventory (
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(id),
    variant_id VARCHAR(255) NOT NULL REFERENCES product_variants(id),
    in_stock BOOLEAN NOT NULL DEFAULT true,
    stock_quantity NUMERIC,
    low_stock_threshold NUMERIC,
    lead_time_days INTEGER NOT NULL DEFAULT 0,
    minimum_order_quantity NUMERIC NOT NULL DEFAULT 1,
    maximum_order_quantity NUMERIC,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (shop_id, variant_id)
);

-- BOMs table
CREATE TABLE boms (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    project_type VARCHAR(100),
    template VARCHAR(100),
    total_cost NUMERIC NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    shared_token VARCHAR(255),
    is_public BOOLEAN NOT NULL DEFAULT false,
    duplicate_source_id VARCHAR(255) REFERENCES boms(id),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- BOM items table
CREATE TABLE bom_items (
    id VARCHAR(255) PRIMARY KEY,
    bom_id VARCHAR(255) NOT NULL REFERENCES boms(id),
    variant_id VARCHAR(255) NOT NULL REFERENCES product_variants(id),
    quantity NUMERIC NOT NULL,
    unit VARCHAR(50) NOT NULL,
    waste_factor NUMERIC NOT NULL DEFAULT 0,
    total_quantity_needed NUMERIC NOT NULL,
    estimated_price_per_unit NUMERIC,
    total_estimated_cost NUMERIC,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- RFQs table
CREATE TABLE rfqs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    bom_id VARCHAR(255) NOT NULL REFERENCES boms(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    deadline BIGINT,
    delivery_location_lat NUMERIC,
    delivery_location_lng NUMERIC,
    delivery_address TEXT,
    special_requirements TEXT,
    budget_limit NUMERIC,
    responses_count INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- RFQ shop invites table
CREATE TABLE rfq_shop_invites (
    id VARCHAR(255) PRIMARY KEY,
    rfq_id VARCHAR(255) NOT NULL REFERENCES rfqs(id),
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(id),
    invited_at BIGINT NOT NULL,
    viewed_at BIGINT,
    responded_at BIGINT
);

-- RFQ replies table
CREATE TABLE rfq_replies (
    id VARCHAR(255) PRIMARY KEY,
    rfq_id VARCHAR(255) NOT NULL REFERENCES rfqs(id),
    shop_id VARCHAR(255) NOT NULL REFERENCES shops(id),
    total_price NUMERIC NOT NULL,
    delivery_fee NUMERIC NOT NULL DEFAULT 0,
    delivery_days INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    terms_conditions TEXT,
    valid_until BIGINT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    line_items JSONB NOT NULL DEFAULT '[]',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Messages table
CREATE TABLE messages (
    id VARCHAR(255) PRIMARY KEY,
    rfq_id VARCHAR(255) NOT NULL REFERENCES rfqs(id),
    sender_id VARCHAR(255) NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'text',
    attachments JSONB DEFAULT '[]',
    read_at BIGINT,
    created_at BIGINT NOT NULL
);

-- Alerts table
CREATE TABLE alerts (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    type VARCHAR(100) NOT NULL,
    variant_id VARCHAR(255) REFERENCES product_variants(id),
    shop_id VARCHAR(255) REFERENCES shops(id),
    threshold_value NUMERIC,
    condition_type VARCHAR(50) NOT NULL,
    notification_methods JSONB NOT NULL DEFAULT '[]',
    active BOOLEAN NOT NULL DEFAULT true,
    triggered_count INTEGER NOT NULL DEFAULT 0,
    last_triggered_at BIGINT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Notifications table
CREATE TABLE notifications (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    read_at BIGINT,
    action_url VARCHAR(500),
    priority VARCHAR(50) NOT NULL DEFAULT 'normal',
    created_at BIGINT NOT NULL
);

-- Reviews table
CREATE TABLE reviews (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    shop_id VARCHAR(255) REFERENCES shops(id),
    variant_id VARCHAR(255) REFERENCES product_variants(id),
    rating INTEGER NOT NULL,
    review_text TEXT,
    images JSONB DEFAULT '[]',
    verified_purchase BOOLEAN NOT NULL DEFAULT false,
    helpful_votes INTEGER NOT NULL DEFAULT 0,
    total_votes INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Search history table
CREATE TABLE search_history (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id),
    session_id VARCHAR(255),
    q VARCHAR(500),
    category VARCHAR(255),
    brand VARCHAR(255),
    price_min NUMERIC,
    price_max NUMERIC,
    location_lat NUMERIC,
    location_lng NUMERIC,
    radius NUMERIC,
    in_stock BOOLEAN,
    sort VARCHAR(100),
    results_count INTEGER NOT NULL DEFAULT 0,
    clicked_product_id VARCHAR(255),
    created_at BIGINT NOT NULL
);

-- User favorites table
CREATE TABLE user_favorites (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    favorite_type VARCHAR(50) NOT NULL,
    shop_id VARCHAR(255) REFERENCES shops(id),
    variant_id VARCHAR(255) REFERENCES product_variants(id),
    bom_id VARCHAR(255) REFERENCES boms(id),
    created_at BIGINT NOT NULL
);

-- Price verifications table
CREATE TABLE price_verifications (
    id VARCHAR(255) PRIMARY KEY,
    price_id VARCHAR(255) NOT NULL REFERENCES prices(id),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    verification_type VARCHAR(50) NOT NULL,
    proof_image_url VARCHAR(500),
    notes TEXT,
    confidence_score INTEGER NOT NULL DEFAULT 100,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reviewed_by VARCHAR(255) REFERENCES users(id),
    reviewed_at BIGINT,
    created_at BIGINT NOT NULL
);

-- Saved searches table
CREATE TABLE saved_searches (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    search_params JSONB NOT NULL,
    alert_enabled BOOLEAN NOT NULL DEFAULT false,
    last_run_at BIGINT,
    results_count INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- Trip plans table
CREATE TABLE trip_plans (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    bom_id VARCHAR(255) REFERENCES boms(id),
    title VARCHAR(255) NOT NULL,
    shop_ids JSONB NOT NULL DEFAULT '[]',
    route_data JSONB,
    total_distance_km NUMERIC,
    estimated_duration_minutes INTEGER,
    total_cash_needed NUMERIC,
    status VARCHAR(50) NOT NULL DEFAULT 'planned',
    shared_token VARCHAR(255),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- User sessions table
CREATE TABLE user_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    expires_at BIGINT NOT NULL,
    last_activity BIGINT NOT NULL,
    created_at BIGINT NOT NULL
);

-- System settings table
CREATE TABLE system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by VARCHAR(255) REFERENCES users(id),
    updated_at BIGINT NOT NULL
);

-- Analytics events table
CREATE TABLE analytics_events (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id),
    session_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    page_url VARCHAR(1000),
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at BIGINT NOT NULL
);

-- SEED DATA

-- Insert users
INSERT INTO users (id, email, phone, password_hash, name, user_type, location_lat, location_lng, address, preferences, is_verified, created_at, updated_at) VALUES
('usr_001', 'john.buyer@example.com', '+971501234567', 'password123', 'John Smith', 'buyer', 25.2048, 55.2708, 'Dubai Marina, Dubai, UAE', '{"currency": "AED", "notifications": true}', true, 1672531200, 1672531200),
('usr_002', 'sarah.contractor@example.com', '+971507654321', 'contractor123', 'Sarah Ahmed', 'buyer', 25.2697, 55.3095, 'Business Bay, Dubai, UAE', '{"currency": "AED", "project_alerts": true}', true, 1672531200, 1672531200),
('usr_003', 'shop.owner1@example.com', '+971509876543', 'shop123', 'Ahmed Al Mansoori', 'seller', 25.2582, 55.3047, 'DIFC, Dubai, UAE', '{"currency": "AED", "auto_respond": false}', true, 1672531200, 1672531200),
('usr_004', 'materials.depot@example.com', '+971502345678', 'depot123', 'Materials Depot LLC', 'seller', 25.1171, 55.2001, 'Al Qusais, Dubai, UAE', '{"currency": "AED", "bulk_discount": true}', true, 1672531200, 1672531200),
('usr_005', 'mary.builder@example.com', '+971505432109', 'builder123', 'Mary Johnson', 'buyer', 25.0764, 55.1390, 'Jumeirah, Dubai, UAE', '{"currency": "AED", "delivery_preferred": true}', false, 1672531200, 1672531200),
('usr_006', 'tools.warehouse@example.com', '+971508765432', 'tools123', 'Tools Warehouse', 'seller', 25.1836, 55.2486, 'Deira, Dubai, UAE', '{"currency": "AED", "express_delivery": true}', true, 1672531200, 1672531200);

-- Insert shops
INSERT INTO shops (id, user_id, name, phones, location_lat, location_lng, address, hours, verified, business_license, shop_type, delivery_available, delivery_radius, delivery_fee_base, delivery_fee_per_km, minimum_order, cash_discount_percentage, rating_average, rating_count, response_time_hours, stock_accuracy_score, created_at, updated_at) VALUES
('shp_001', 'usr_003', 'Dubai Building Materials Co.', '["971509876543", "97143334567"]', 25.2582, 55.3047, 'Shop 15, Building Materials Souk, DIFC, Dubai', '{"monday": "08:00-18:00", "tuesday": "08:00-18:00", "wednesday": "08:00-18:00", "thursday": "08:00-18:00", "friday": "14:00-18:00", "saturday": "08:00-18:00", "sunday": "closed"}', true, 'BL-2023-DBM-001', 'building_materials', true, 25, 50, 2.5, 500, 3, 4.5, 127, 2, 95, 1672531200, 1672531200),
('shp_002', 'usr_004', 'Al Mansoori Hardware Store', '["971502345678"]', 25.1171, 55.2001, 'Building 42, Al Qusais Industrial Area 2, Dubai', '{"monday": "07:00-19:00", "tuesday": "07:00-19:00", "wednesday": "07:00-19:00", "thursday": "07:00-19:00", "friday": "14:00-19:00", "saturday": "07:00-19:00", "sunday": "08:00-17:00"}', true, 'BL-2023-AMH-002', 'hardware', true, 30, 40, 2, 300, 5, 4.2, 89, 1.5, 92, 1672531200, 1672531200),
('shp_003', 'usr_006', 'Premium Tools Outlet', '["971508765432", "97144567890"]', 25.1836, 55.2486, 'Shop 8, Tools Market, Deira, Dubai', '{"monday": "09:00-21:00", "tuesday": "09:00-21:00", "wednesday": "09:00-21:00", "thursday": "09:00-21:00", "friday": "15:00-21:00", "saturday": "09:00-21:00", "sunday": "10:00-20:00"}', true, 'BL-2023-PTO-003', 'tools', true, 15, 30, 3, 200, 2, 4.7, 234, 0.5, 98, 1672531200, 1672531200);

-- Insert categories
INSERT INTO categories (id, name, parent_id, category_path, description, image_url, sort_order, is_active, created_at, updated_at) VALUES
('cat_001', 'Building Materials', NULL, 'building-materials', 'All types of construction and building materials', 'https://picsum.photos/200/200?random=1', 1, true, 1672531200, 1672531200),
('cat_002', 'Cement & Concrete', 'cat_001', 'building-materials/cement-concrete', 'Cement, concrete mixes, and related products', 'https://picsum.photos/200/200?random=2', 1, true, 1672531200, 1672531200),
('cat_003', 'Steel & Rebar', 'cat_001', 'building-materials/steel-rebar', 'Steel bars, rebar, and structural steel', 'https://picsum.photos/200/200?random=3', 2, true, 1672531200, 1672531200),
('cat_004', 'Tools & Equipment', NULL, 'tools-equipment', 'Construction tools and equipment', 'https://picsum.photos/200/200?random=4', 2, true, 1672531200, 1672531200),
('cat_005', 'Hand Tools', 'cat_004', 'tools-equipment/hand-tools', 'Manual tools for construction work', 'https://picsum.photos/200/200?random=5', 1, true, 1672531200, 1672531200),
('cat_006', 'Power Tools', 'cat_004', 'tools-equipment/power-tools', 'Electric and battery powered tools', 'https://picsum.photos/200/200?random=6', 2, true, 1672531200, 1672531200),
('cat_007', 'Hardware', NULL, 'hardware', 'Bolts, screws, fasteners and hardware items', 'https://picsum.photos/200/200?random=7', 3, true, 1672531200, 1672531200),
('cat_008', 'Fasteners', 'cat_007', 'hardware/fasteners', 'Bolts, screws, nuts, washers', 'https://picsum.photos/200/200?random=8', 1, true, 1672531200, 1672531200);

-- Insert products
INSERT INTO products (id, canonical_name, category_id, subcategory, base_unit, description, specifications, synonyms, image_url, waste_factor_percentage, is_active, created_at, updated_at) VALUES
('prd_001', 'Portland Cement', 'cat_002', 'Ordinary Portland Cement', 'kg', 'Standard Portland cement for general construction', '{"type": "OPC", "grade": "42.5", "setting_time": "30min"}', '["OPC", "cement", "portland cement"]', 'https://picsum.photos/300/300?random=11', 5, true, 1672531200, 1672531200),
('prd_002', 'Steel Rebar', 'cat_003', 'Reinforcement Steel', 'kg', 'High strength deformed steel bars for concrete reinforcement', '{"grade": "Grade 60", "yield_strength": "420 MPa"}', '["rebar", "steel bar", "reinforcement bar"]', 'https://picsum.photos/300/300?random=12', 3, true, 1672531200, 1672531200),
('prd_003', 'Hammer Drill', 'cat_006', 'Rotary Hammer', 'piece', 'Heavy duty hammer drill for concrete and masonry', '{"power": "800W", "max_drilling": "26mm"}', '["hammer drill", "rotary hammer", "concrete drill"]', 'https://picsum.photos/300/300?random=13', 0, true, 1672531200, 1672531200),
('prd_004', 'Hex Bolt', 'cat_008', 'Machine Bolts', 'piece', 'High tensile hex head bolts with nuts', '{"material": "steel", "finish": "zinc plated"}', '["hex bolt", "machine bolt", "bolt"]', 'https://picsum.photos/300/300?random=14', 2, true, 1672531200, 1672531200),
('prd_005', 'Screwdriver Set', 'cat_005', 'Manual Tools', 'set', 'Professional screwdriver set with multiple sizes', '{"pieces": "12", "material": "chrome vanadium"}', '["screwdriver", "driver set", "hand tools"]', 'https://picsum.photos/300/300?random=15', 0, true, 1672531200, 1672531200);

-- Insert product variants
INSERT INTO product_variants (id, product_id, brand, grade, size, pack_quantity, pack_unit, unit_to_base_factor, sku, barcode, image_url, specifications, is_active, created_at, updated_at) VALUES
('var_001', 'prd_001', 'Emirates Cement', 'Grade 42.5', '50kg', 50, 'kg', 1, 'EC-OPC-50', '1234567890123', 'https://picsum.photos/300/300?random=21', '{"bag_weight": "50kg", "bags_per_pallet": "40"}', true, 1672531200, 1672531200),
('var_002', 'prd_001', 'Dubai Cement', 'Grade 42.5', '25kg', 25, 'kg', 1, 'DC-OPC-25', '1234567890124', 'https://picsum.photos/300/300?random=22', '{"bag_weight": "25kg", "bags_per_pallet": "80"}', true, 1672531200, 1672531200),
('var_003', 'prd_002', 'Emirates Steel', 'Grade 60', '12mm x 12m', 1, 'bar', 12.8, 'ES-RB12-12', '1234567890125', 'https://picsum.photos/300/300?random=23', '{"diameter": "12mm", "length": "12m", "weight_per_m": "0.89kg"}', true, 1672531200, 1672531200),
('var_004', 'prd_002', 'Al Ghurair Steel', 'Grade 60', '16mm x 12m', 1, 'bar', 18.9, 'AG-RB16-12', '1234567890126', 'https://picsum.photos/300/300?random=24', '{"diameter": "16mm", "length": "12m", "weight_per_m": "1.58kg"}', true, 1672531200, 1672531200),
('var_005', 'prd_003', 'Bosch', 'Professional', 'GBH 2-26 DRE', 1, 'piece', 1, 'BSH-GBH226', '1234567890127', 'https://picsum.photos/300/300?random=25', '{"power": "800W", "impact_energy": "2.7J", "weight": "2.9kg"}', true, 1672531200, 1672531200),
('var_006', 'prd_004', 'DIN Standards', 'Grade 8.8', 'M12 x 50mm', 1, 'piece', 1, 'DIN-M12-50', '1234567890128', 'https://picsum.photos/300/300?random=26', '{"thread": "M12", "length": "50mm", "material": "carbon steel"}', true, 1672531200, 1672531200),
('var_007', 'prd_005', 'Stanley', 'Professional', '12-piece set', 1, 'set', 1, 'STN-SD12', '1234567890129', 'https://picsum.photos/300/300?random=27', '{"pieces": "12", "case_included": true, "lifetime_warranty": true}', true, 1672531200, 1672531200);

-- Insert prices
INSERT INTO prices (id, shop_id, variant_id, price, currency, price_per_base_unit, bulk_pricing_tiers, promotional_price, promotion_start_date, promotion_end_date, source, verified, verifications_count, last_verified_at, created_at, updated_at) VALUES
('prc_001', 'shp_001', 'var_001', 25.50, 'AED', 0.51, '[{"min_qty": 100, "price": 24.50}, {"min_qty": 500, "price": 23.50}]', 23.00, 1672531200, 1675123200, 'shop', true, 3, 1672617600, 1672531200, 1672531200),
('prc_002', 'shp_001', 'var_002', 15.75, 'AED', 0.63, '[{"min_qty": 200, "price": 15.25}]', NULL, NULL, NULL, 'shop', true, 2, 1672617600, 1672531200, 1672531200),
('prc_003', 'shp_002', 'var_003', 45.80, 'AED', 3.58, '[{"min_qty": 50, "price": 44.00}, {"min_qty": 100, "price": 42.50}]', NULL, NULL, NULL, 'shop', true, 1, 1672617600, 1672531200, 1672531200),
('prc_004', 'shp_002', 'var_004', 72.30, 'AED', 3.83, '[{"min_qty": 50, "price": 70.00}]', NULL, NULL, NULL, 'shop', false, 0, NULL, 1672531200, 1672531200),
('prc_005', 'shp_003', 'var_005', 890.00, 'AED', 890.00, '[{"min_qty": 3, "price": 850.00}]', 799.00, 1672531200, 1674950400, 'shop', true, 5, 1672617600, 1672531200, 1672531200),
('prc_006', 'shp_001', 'var_006', 8.50, 'AED', 8.50, '[{"min_qty": 100, "price": 7.50}, {"min_qty": 500, "price": 6.50}]', NULL, NULL, NULL, 'shop', true, 2, 1672617600, 1672531200, 1672531200),
('prc_007', 'shp_003', 'var_007', 145.00, 'AED', 145.00, '[]', 129.99, 1672531200, 1675123200, 'shop', true, 1, 1672617600, 1672531200, 1672531200);

-- Insert price history
INSERT INTO price_history (id, variant_id, shop_id, date, price, price_per_base_unit, currency, source, created_at) VALUES
('ph_001', 'var_001', 'shp_001', 1672444800, 24.50, 0.49, 'AED', 'shop', 1672531200),
('ph_002', 'var_001', 'shp_001', 1672531200, 25.50, 0.51, 'AED', 'shop', 1672531200),
('ph_003', 'var_005', 'shp_003', 1672444800, 920.00, 920.00, 'AED', 'shop', 1672531200),
('ph_004', 'var_005', 'shp_003', 1672531200, 890.00, 890.00, 'AED', 'shop', 1672531200);

-- Insert inventory
INSERT INTO inventory (shop_id, variant_id, in_stock, stock_quantity, low_stock_threshold, lead_time_days, minimum_order_quantity, maximum_order_quantity, updated_at) VALUES
('shp_001', 'var_001', true, 500, 50, 1, 1, 1000, 1672531200),
('shp_001', 'var_002', true, 300, 30, 1, 1, 500, 1672531200),
('shp_001', 'var_006', true, 2000, 200, 0, 10, 5000, 1672531200),
('shp_002', 'var_003', true, 150, 20, 2, 5, 200, 1672531200),
('shp_002', 'var_004', true, 80, 15, 2, 5, 150, 1672531200),
('shp_003', 'var_005', true, 12, 3, 7, 1, 10, 1672531200),
('shp_003', 'var_007', true, 25, 5, 3, 1, 50, 1672531200);

-- Insert BOMs
INSERT INTO boms (id, user_id, title, description, project_type, template, total_cost, item_count, status, shared_token, is_public, duplicate_source_id, created_at, updated_at) VALUES
('bom_001', 'usr_001', 'Villa Foundation Project', 'Materials needed for 3-bedroom villa foundation', 'residential', 'foundation', 15750.80, 5, 'active', 'share_abc123', true, NULL, 1672531200, 1672531200),
('bom_002', 'usr_002', 'Office Building Renovation', 'Materials for office space renovation - floors 1-3', 'commercial', 'renovation', 45200.25, 8, 'draft', NULL, false, NULL, 1672531200, 1672531200),
('bom_003', 'usr_005', 'Home Workshop Setup', 'Tools and materials for setting up home workshop', 'personal', 'workshop', 2890.50, 4, 'active', 'share_def456', true, NULL, 1672531200, 1672531200);

-- Insert BOM items
INSERT INTO bom_items (id, bom_id, variant_id, quantity, unit, waste_factor, total_quantity_needed, estimated_price_per_unit, total_estimated_cost, notes, sort_order, created_at, updated_at) VALUES
('bom_item_001', 'bom_001', 'var_001', 200, 'bags', 5, 210, 25.50, 5355.00, 'Foundation concrete mix', 1, 1672531200, 1672531200),
('bom_item_002', 'bom_001', 'var_003', 50, 'bars', 3, 51.5, 45.80, 2358.70, '12mm rebar for foundation', 2, 1672531200, 1672531200),
('bom_item_003', 'bom_001', 'var_004', 30, 'bars', 3, 30.9, 72.30, 2234.07, '16mm rebar for main structure', 3, 1672531200, 1672531200),
('bom_item_004', 'bom_002', 'var_002', 500, 'bags', 5, 525, 15.75, 8268.75, 'Cement for floor screed', 1, 1672531200, 1672531200),
('bom_item_005', 'bom_003', 'var_005', 1, 'piece', 0, 1, 890.00, 890.00, 'Main hammer drill for workshop', 1, 1672531200, 1672531200),
('bom_item_006', 'bom_003', 'var_007', 2, 'sets', 0, 2, 145.00, 290.00, 'Screwdriver sets for assembly work', 2, 1672531200, 1672531200);

-- Insert RFQs
INSERT INTO rfqs (id, user_id, bom_id, title, description, status, priority, deadline, delivery_location_lat, delivery_location_lng, delivery_address, special_requirements, budget_limit, responses_count, created_at, updated_at) VALUES
('rfq_001', 'usr_001', 'bom_001', 'Foundation Materials for Villa Project', 'Need competitive quotes for foundation materials. Quality is important.', 'active', 'high', 1675123200, 25.2048, 55.2708, 'Construction Site - Dubai Marina Plot 15B', 'Materials must meet Dubai Municipality standards. Delivery required within 3 days of order.', 16000.00, 2, 1672531200, 1672531200),
('rfq_002', 'usr_002', 'bom_002', 'Commercial Renovation Materials', 'Seeking quotes for office renovation project - 3 floors', 'pending', 'medium', 1677542400, 25.2697, 55.3095, 'Business Bay Tower, Floor 1 Lobby', 'Weekend delivery preferred. Bulk discount expected.', 50000.00, 1, 1672531200, 1672531200);

-- Insert RFQ shop invites
INSERT INTO rfq_shop_invites (id, rfq_id, shop_id, invited_at, viewed_at, responded_at) VALUES
('inv_001', 'rfq_001', 'shp_001', 1672531200, 1672534800, 1672538400),
('inv_002', 'rfq_001', 'shp_002', 1672531200, 1672535700, 1672539300),
('inv_003', 'rfq_002', 'shp_001', 1672531200, 1672536600, NULL),
('inv_004', 'rfq_002', 'shp_003', 1672531200, NULL, NULL);

-- Insert RFQ replies
INSERT INTO rfq_replies (id, rfq_id, shop_id, total_price, delivery_fee, delivery_days, notes, terms_conditions, valid_until, status, line_items, created_at, updated_at) VALUES
('reply_001', 'rfq_001', 'shp_001', 14850.50, 200.00, 2, 'We can provide premium quality materials with fast delivery', 'Payment: 50% advance, 50% on delivery. Warranty: 1 year on all materials.', 1673740800, 'active', '[{"variant_id": "var_001", "quantity": 210, "unit_price": 24.50, "total": 5145.00}, {"variant_id": "var_003", "quantity": 52, "unit_price": 44.00, "total": 2288.00}]', 1672538400, 1672538400),
('reply_002', 'rfq_001', 'shp_002', 15200.30, 150.00, 3, 'Quality materials with competitive pricing', 'Payment: Net 30 days. Free storage for 1 week.', 1673740800, 'active', '[{"variant_id": "var_003", "quantity": 52, "unit_price": 45.80, "total": 2381.60}, {"variant_id": "var_004", "quantity": 31, "unit_price": 70.00, "total": 2170.00}]', 1672539300, 1672539300);

-- Insert messages
INSERT INTO messages (id, rfq_id, sender_id, message, message_type, attachments, read_at, created_at) VALUES
('msg_001', 'rfq_001', 'usr_001', 'When can you start delivery if I confirm the order?', 'text', '[]', 1672545600, 1672542000),
('msg_002', 'rfq_001', 'usr_003', 'We can start delivery within 24 hours of order confirmation', 'text', '[]', 1672546500, 1672545600),
('msg_003', 'rfq_001', 'usr_001', 'Please see attached site plan for delivery location', 'text', '[{"type": "image", "url": "https://picsum.photos/800/600?random=31", "name": "site_plan.pdf"}]', 1672547400, 1672546800);

-- Insert alerts
INSERT INTO alerts (id, user_id, type, variant_id, shop_id, threshold_value, condition_type, notification_methods, active, triggered_count, last_triggered_at, created_at, updated_at) VALUES
('alr_001', 'usr_001', 'price_drop', 'var_001', NULL, 24.00, 'below', '["email", "push"]', true, 2, 1672617600, 1672531200, 1672531200),
('alr_002', 'usr_002', 'stock_available', 'var_005', 'shp_003', NULL, 'in_stock', '["email"]', true, 0, NULL, 1672531200, 1672531200),
('alr_003', 'usr_005', 'price_change', 'var_007', NULL, 5.00, 'percentage_change', '["push"]', true, 1, 1672617600, 1672531200, 1672531200);

-- Insert notifications
INSERT INTO notifications (id, user_id, type, title, message, data, read_at, action_url, priority, created_at) VALUES
('not_001', 'usr_001', 'price_alert', 'Price Drop Alert', 'Portland Cement 50kg is now 23.00 AED - down from 25.50 AED', '{"variant_id": "var_001", "old_price": 25.50, "new_price": 23.00}', 1672617600, '/products/var_001', 'high', 1672614000),
('not_002', 'usr_002', 'rfq_response', 'New RFQ Response', 'Dubai Building Materials Co. responded to your RFQ', '{"rfq_id": "rfq_001", "shop_name": "Dubai Building Materials Co."}', NULL, '/rfqs/rfq_001', 'normal', 1672538400),
('not_003', 'usr_003', 'new_rfq', 'New RFQ Invitation', 'You''ve been invited to quote for Foundation Materials', '{"rfq_id": "rfq_001", "title": "Foundation Materials for Villa Project"}', 1672535000, '/rfqs/rfq_001', 'normal', 1672531200);

-- Insert reviews
INSERT INTO reviews (id, user_id, shop_id, variant_id, rating, review_text, images, verified_purchase, helpful_votes, total_votes, status, created_at, updated_at) VALUES
('rev_001', 'usr_001', 'shp_001', 'var_001', 5, 'Excellent quality cement, delivered on time. Highly recommend!', '[{"url": "https://picsum.photos/400/300?random=41", "caption": "Cement bags delivered"}]', true, 12, 15, 'active', 1672617600, 1672617600),
('rev_002', 'usr_002', 'shp_003', 'var_005', 4, 'Great hammer drill, very powerful. Good value for money.', '[]', true, 8, 10, 'active', 1672704000, 1672704000),
('rev_003', 'usr_005', 'shp_002', 'var_003', 5, 'Perfect rebar quality, exactly as specified. Fast delivery.', '[{"url": "https://picsum.photos/400/300?random=42", "caption": "Rebar quality check"}]', false, 3, 4, 'active', 1672790400, 1672790400);

-- Insert search history
INSERT INTO search_history (id, user_id, session_id, q, category, brand, price_min, price_max, location_lat, location_lng, radius, in_stock, sort, results_count, clicked_product_id, created_at) VALUES
('sch_001', 'usr_001', 'sess_abc123', 'cement 50kg', 'cat_002', NULL, 20.00, 30.00, 25.2048, 55.2708, 10, true, 'price_asc', 15, 'var_001', 1672531200),
('sch_002', 'usr_002', 'sess_def456', 'hammer drill bosch', 'cat_006', 'Bosch', 500.00, 1000.00, 25.2697, 55.3095, 25, true, 'rating_desc', 8, 'var_005', 1672617600),
('sch_003', NULL, 'sess_ghi789', 'steel rebar 12mm', 'cat_003', NULL, NULL, NULL, 25.1171, 55.2001, 15, NULL, 'relevance', 12, NULL, 1672704000);

-- Insert user favorites
INSERT INTO user_favorites (id, user_id, favorite_type, shop_id, variant_id, bom_id, created_at) VALUES
('fav_001', 'usr_001', 'shop', 'shp_001', NULL, NULL, 1672531200),
('fav_002', 'usr_001', 'product', NULL, 'var_005', NULL, 1672617600),
('fav_003', 'usr_002', 'bom', NULL, NULL, 'bom_001', 1672704000),
('fav_004', 'usr_005', 'shop', 'shp_003', NULL, NULL, 1672790400);

-- Insert price verifications
INSERT INTO price_verifications (id, price_id, user_id, verification_type, proof_image_url, notes, confidence_score, status, reviewed_by, reviewed_at, created_at) VALUES
('ver_001', 'prc_001', 'usr_002', 'receipt_photo', 'https://picsum.photos/600/400?random=51', 'Purchased 5 bags at this price yesterday', 95, 'approved', 'usr_003', 1672617600, 1672531200),
('ver_002', 'prc_005', 'usr_001', 'store_visit', 'https://picsum.photos/600/400?random=52', 'Visited store, price confirmed on shelf tag', 100, 'approved', 'usr_006', 1672704000, 1672617600),
('ver_003', 'prc_003', 'usr_005', 'phone_inquiry', NULL, 'Called store and confirmed price over phone', 85, 'pending', NULL, NULL, 1672704000);

-- Insert saved searches
INSERT INTO saved_searches (id, user_id, name, search_params, alert_enabled, last_run_at, results_count, created_at, updated_at) VALUES
('sav_001', 'usr_001', 'Cement Deals Under 25 AED', '{"q": "cement", "category": "cat_002", "price_max": 25, "location_lat": 25.2048, "location_lng": 55.2708, "radius": 15}', true, 1672617600, 8, 1672531200, 1672617600),
('sav_002', 'usr_002', 'Bosch Power Tools', '{"brand": "Bosch", "category": "cat_006", "sort": "price_asc"}', false, 1672704000, 12, 1672617600, 1672704000);

-- Insert trip plans
INSERT INTO trip_plans (id, user_id, bom_id, title, shop_ids, route_data, total_distance_km, estimated_duration_minutes, total_cash_needed, status, shared_token, created_at, updated_at) VALUES
('trip_001', 'usr_001', 'bom_001', 'Foundation Materials Shopping Trip', '["shp_001", "shp_002"]', '{"start": {"lat": 25.2048, "lng": 55.2708}, "stops": [{"shop_id": "shp_001", "lat": 25.2582, "lng": 55.3047}, {"shop_id": "shp_002", "lat": 25.1171, "lng": 55.2001}]}', 28.5, 75, 8500.00, 'planned', 'trip_share_123', 1672531200, 1672531200),
('trip_002', 'usr_005', 'bom_003', 'Workshop Tools Purchase', '["shp_003"]', '{"start": {"lat": 25.0764, "lng": 55.1390}, "stops": [{"shop_id": "shp_003", "lat": 25.1836, "lng": 55.2486}]}', 12.3, 35, 1200.00, 'completed', NULL, 1672617600, 1672704000);

-- Insert user sessions
INSERT INTO user_sessions (id, user_id, token, device_info, ip_address, expires_at, last_activity, created_at) VALUES
('sess_001', 'usr_001', 'token_abc123xyz789', '{"device": "iPhone 14", "os": "iOS 16.2", "app_version": "1.2.0"}', '192.168.1.100', 1675123200, 1672617600, 1672531200),
('sess_002', 'usr_002', 'token_def456uvw012', '{"device": "Samsung Galaxy S23", "os": "Android 13", "app_version": "1.2.0"}', '192.168.1.101', 1675123200, 1672704000, 1672617600),
('sess_003', 'usr_003', 'token_ghi789rst345', '{"device": "MacBook Pro", "os": "macOS 13.1", "browser": "Chrome 108"}', '192.168.1.102', 1675123200, 1672790400, 1672704000);

-- Insert system settings
INSERT INTO system_settings (key, value, description, updated_by, updated_at) VALUES
('app_version', '"1.2.0"', 'Current application version', 'usr_003', 1672531200),
('maintenance_mode', 'false', 'Whether the app is in maintenance mode', 'usr_003', 1672531200),
('max_file_upload_size', '10485760', 'Maximum file upload size in bytes (10MB)', 'usr_003', 1672531200),
('default_currency', '"AED"', 'Default currency for the application', 'usr_003', 1672531200),
('price_verification_threshold', '3', 'Number of verifications needed for price approval', 'usr_003', 1672531200);

-- Insert analytics events
INSERT INTO analytics_events (id, user_id, session_id, event_type, event_data, page_url, user_agent, ip_address, created_at) VALUES
('evt_001', 'usr_001', 'sess_001', 'product_view', '{"variant_id": "var_001", "shop_id": "shp_001", "price": 25.50}', '/products/var_001', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X)', '192.168.1.100', 1672531200),
('evt_002', 'usr_001', 'sess_001', 'price_comparison', '{"variant_id": "var_001", "shops_compared": ["shp_001", "shp_002"], "lowest_price": 25.50}', '/compare/var_001', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X)', '192.168.1.100', 1672531800),
('evt_003', 'usr_002', 'sess_002', 'rfq_created', '{"rfq_id": "rfq_001", "bom_id": "bom_001", "estimated_value": 15750.80}', '/rfqs/create', 'Mozilla/5.0 (Linux; Android 13; SM-S918B)', '192.168.1.101', 1672531200),
('evt_004', 'usr_003', 'sess_003', 'shop_dashboard_view', '{"shop_id": "shp_001", "pending_rfqs": 2, "active_prices": 15}', '/dashboard', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', '192.168.1.102', 1672704000),
('evt_005', NULL, 'sess_anonymous_001', 'search', '{"query": "cement", "results_count": 15, "category": "cat_002"}', '/search', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '192.168.1.105', 1672790400);