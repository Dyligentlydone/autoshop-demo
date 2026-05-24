-- =====================================================
-- ACME TIRE - Supabase CRM Schema
-- Migration from Zoho CRM to Supabase
-- =====================================================

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS repair_order_attachments CASCADE;
DROP TABLE IF EXISTS repair_orders CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TYPE IF EXISTS repair_order_status CASCADE;

-- =====================================================
-- CUSTOMERS TABLE
-- =====================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_id TEXT UNIQUE, -- Preserve Zoho ID for migration tracking
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  email TEXT,
  preferred_contact_method TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_customers_zoho_id ON customers(zoho_id) WHERE zoho_id IS NOT NULL;
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- Full-text search index
CREATE INDEX idx_customers_search ON customers USING gin(
  to_tsvector('english', 
    COALESCE(first_name, '') || ' ' || 
    COALESCE(last_name, '') || ' ' || 
    COALESCE(phone, '') || ' ' || 
    COALESCE(email, '')
  )
);

-- Comments
COMMENT ON TABLE customers IS 'Customer contact information migrated from Zoho CRM Contacts module';
COMMENT ON COLUMN customers.zoho_id IS 'Original Zoho CRM Contact ID for migration tracking';
COMMENT ON COLUMN customers.phone IS 'Primary phone number (10 digits, no formatting)';
COMMENT ON COLUMN customers.preferred_contact_method IS 'Preferred way to contact customer';
COMMENT ON COLUMN customers.description IS 'Additional notes about the customer';

-- =====================================================
-- VEHICLES TABLE
-- =====================================================
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_id TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  year TEXT NOT NULL DEFAULT '',
  make TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  vin TEXT,
  license_plate TEXT,
  engine_size TEXT,
  color TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_vehicles_vin ON vehicles(vin) WHERE vin IS NOT NULL;
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate) WHERE license_plate IS NOT NULL;
CREATE INDEX idx_vehicles_zoho_id ON vehicles(zoho_id) WHERE zoho_id IS NOT NULL;
CREATE INDEX idx_vehicles_created_at ON vehicles(created_at DESC);

-- Full-text search index
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
  to_tsvector('english', 
    COALESCE(year, '') || ' ' || 
    COALESCE(make, '') || ' ' || 
    COALESCE(model, '') || ' ' || 
    COALESCE(vin, '') || ' ' || 
    COALESCE(license_plate, '')
  )
);

-- Comments
COMMENT ON TABLE vehicles IS 'Vehicle information migrated from Zoho CRM Vehicles module';
COMMENT ON COLUMN vehicles.zoho_id IS 'Original Zoho CRM Vehicle ID for migration tracking';
COMMENT ON COLUMN vehicles.customer_id IS 'Vehicle owner (references customers table)';
COMMENT ON COLUMN vehicles.year IS 'Vehicle year (stored as text to match Zoho)';
COMMENT ON COLUMN vehicles.vin IS 'Vehicle Identification Number';
COMMENT ON COLUMN vehicles.license_plate IS 'License plate number';

-- =====================================================
-- REPAIR ORDERS TABLE
-- =====================================================

-- Create enum for repair order status
CREATE TYPE repair_order_status AS ENUM (
  'New',
  'Scheduled',
  'Dropped Off',
  'Diagnosing',
  'Waiting Approval',
  'Repair Approved',
  'In Progress',
  'Ready For Pickup',
  'Completed'
);

CREATE TABLE repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_id TEXT UNIQUE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status repair_order_status NOT NULL DEFAULT 'New',
  service_type TEXT,
  job_description TEXT,
  note TEXT,
  estimated_total DECIMAL(10, 2),
  final_charge_total DECIMAL(10, 2),
  estimated_completion TIMESTAMPTZ,
  scheduled_drop_off DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_repair_orders_vehicle_id ON repair_orders(vehicle_id);
CREATE INDEX idx_repair_orders_customer_id ON repair_orders(customer_id);
CREATE INDEX idx_repair_orders_status ON repair_orders(status);
CREATE INDEX idx_repair_orders_created_at ON repair_orders(created_at DESC);
CREATE INDEX idx_repair_orders_updated_at ON repair_orders(updated_at DESC);
CREATE INDEX idx_repair_orders_estimated_completion ON repair_orders(estimated_completion) WHERE estimated_completion IS NOT NULL;
CREATE INDEX idx_repair_orders_zoho_id ON repair_orders(zoho_id) WHERE zoho_id IS NOT NULL;

-- Full-text search index
CREATE INDEX idx_repair_orders_search ON repair_orders USING gin(
  to_tsvector('english', 
    COALESCE(service_type, '') || ' ' || 
    COALESCE(job_description, '') || ' ' || 
    COALESCE(note, '')
  )
);

-- Comments
COMMENT ON TABLE repair_orders IS 'Repair orders migrated from Zoho CRM Repair_Orders module';
COMMENT ON COLUMN repair_orders.zoho_id IS 'Original Zoho CRM Repair Order ID for migration tracking';
COMMENT ON COLUMN repair_orders.vehicle_id IS 'Vehicle being repaired';
COMMENT ON COLUMN repair_orders.customer_id IS 'Customer who owns the vehicle';
COMMENT ON COLUMN repair_orders.service_type IS 'Type of service (e.g., Oil Change, Brake Repair)';
COMMENT ON COLUMN repair_orders.job_description IS 'Detailed description of work to be done';
COMMENT ON COLUMN repair_orders.note IS 'Additional notes about the repair order';
COMMENT ON COLUMN repair_orders.estimated_total IS 'Estimated cost of repairs';
COMMENT ON COLUMN repair_orders.final_charge_total IS 'Final amount charged to customer';
COMMENT ON COLUMN repair_orders.estimated_completion IS 'When the repair is expected to be completed';
COMMENT ON COLUMN repair_orders.scheduled_drop_off IS 'When the customer is scheduled to drop off the vehicle';

-- =====================================================
-- REPAIR ORDER ATTACHMENTS TABLE
-- =====================================================
CREATE TABLE repair_order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_id TEXT UNIQUE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Path in Supabase Storage
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_attachments_repair_order_id ON repair_order_attachments(repair_order_id);
CREATE INDEX idx_attachments_zoho_id ON repair_order_attachments(zoho_id) WHERE zoho_id IS NOT NULL;
CREATE INDEX idx_attachments_created_at ON repair_order_attachments(created_at DESC);

-- Comments
COMMENT ON TABLE repair_order_attachments IS 'Photos and files attached to repair orders';
COMMENT ON COLUMN repair_order_attachments.zoho_id IS 'Original Zoho attachment ID for migration tracking';
COMMENT ON COLUMN repair_order_attachments.file_path IS 'Path in Supabase Storage bucket (repair-order-attachments)';
COMMENT ON COLUMN repair_order_attachments.file_size IS 'File size in bytes';

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to customers
CREATE TRIGGER update_customers_updated_at 
  BEFORE UPDATE ON customers
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to vehicles
CREATE TRIGGER update_vehicles_updated_at 
  BEFORE UPDATE ON vehicles
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to repair_orders
CREATE TRIGGER update_repair_orders_updated_at 
  BEFORE UPDATE ON repair_orders
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_order_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for service role)
-- Note: In production, you might want more granular policies

CREATE POLICY "Allow all for service role - customers" 
  ON customers 
  FOR ALL 
  USING (true);

CREATE POLICY "Allow all for service role - vehicles" 
  ON vehicles 
  FOR ALL 
  USING (true);

CREATE POLICY "Allow all for service role - repair_orders" 
  ON repair_orders 
  FOR ALL 
  USING (true);

CREATE POLICY "Allow all for service role - attachments" 
  ON repair_order_attachments 
  FOR ALL 
  USING (true);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to search customers by phone (normalized)
CREATE OR REPLACE FUNCTION search_customer_by_phone(phone_input TEXT)
RETURNS SETOF customers AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM customers
  WHERE phone = regexp_replace(phone_input, '\D', '', 'g')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to search customers by email
CREATE OR REPLACE FUNCTION search_customer_by_email(email_input TEXT)
RETURNS SETOF customers AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM customers
  WHERE LOWER(email) = LOWER(email_input)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get repair orders with enriched data (vehicle + customer)
CREATE OR REPLACE FUNCTION get_enriched_repair_orders(
  status_filter repair_order_status DEFAULT NULL,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  repair_order_id UUID,
  repair_order_status repair_order_status,
  service_type TEXT,
  job_description TEXT,
  note TEXT,
  estimated_total DECIMAL,
  final_charge_total DECIMAL,
  estimated_completion TIMESTAMPTZ,
  scheduled_drop_off DATE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  vehicle_id UUID,
  vehicle_year TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_vin TEXT,
  vehicle_license_plate TEXT,
  customer_id UUID,
  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_phone TEXT,
  customer_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ro.id,
    ro.status,
    ro.service_type,
    ro.job_description,
    ro.note,
    ro.estimated_total,
    ro.final_charge_total,
    ro.estimated_completion,
    ro.scheduled_drop_off,
    ro.created_at,
    ro.updated_at,
    v.id,
    v.year,
    v.make,
    v.model,
    v.vin,
    v.license_plate,
    c.id,
    c.first_name,
    c.last_name,
    c.phone,
    c.email
  FROM repair_orders ro
  LEFT JOIN vehicles v ON ro.vehicle_id = v.id
  LEFT JOIN customers c ON ro.customer_id = c.id
  WHERE (status_filter IS NULL OR ro.status = status_filter)
  ORDER BY ro.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STORAGE BUCKET SETUP (Run this in Supabase Dashboard)
-- =====================================================

-- Note: This needs to be run in the Supabase Dashboard SQL Editor
-- or via the Supabase Storage UI

-- CREATE STORAGE BUCKET:
-- Bucket name: repair-order-attachments
-- Public: false (requires authentication)
-- File size limit: 50MB
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- STORAGE POLICY (allow authenticated uploads/downloads):
-- CREATE POLICY "Allow authenticated uploads"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (bucket_id = 'repair-order-attachments');

-- CREATE POLICY "Allow authenticated downloads"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (bucket_id = 'repair-order-attachments');

-- CREATE POLICY "Allow authenticated deletes"
-- ON storage.objects FOR DELETE
-- TO authenticated
-- USING (bucket_id = 'repair-order-attachments');

-- =====================================================
-- MIGRATION TRACKING
-- =====================================================

-- Table to track migration progress
CREATE TABLE IF NOT EXISTS migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_type TEXT NOT NULL, -- 'customers', 'vehicles', 'repair_orders', 'attachments'
  zoho_id TEXT NOT NULL,
  supabase_id UUID NOT NULL,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_migration_log_type ON migration_log(migration_type);
CREATE INDEX idx_migration_log_zoho_id ON migration_log(zoho_id);

COMMENT ON TABLE migration_log IS 'Tracks which Zoho records have been migrated to Supabase';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these after migration to verify data integrity:

-- Count records by type
-- SELECT 'customers' as type, COUNT(*) as count FROM customers
-- UNION ALL
-- SELECT 'vehicles', COUNT(*) FROM vehicles
-- UNION ALL
-- SELECT 'repair_orders', COUNT(*) FROM repair_orders
-- UNION ALL
-- SELECT 'attachments', COUNT(*) FROM repair_order_attachments;

-- Check for orphaned records
-- SELECT COUNT(*) as orphaned_vehicles FROM vehicles WHERE customer_id IS NOT NULL AND customer_id NOT IN (SELECT id FROM customers);
-- SELECT COUNT(*) as orphaned_repair_orders_vehicle FROM repair_orders WHERE vehicle_id IS NOT NULL AND vehicle_id NOT IN (SELECT id FROM vehicles);
-- SELECT COUNT(*) as orphaned_repair_orders_customer FROM repair_orders WHERE customer_id IS NOT NULL AND customer_id NOT IN (SELECT id FROM customers);

-- =====================================================
-- COMPLETE!
-- =====================================================

-- Schema creation complete. Next steps:
-- 1. Run this SQL in your Supabase project
-- 2. Create storage bucket 'repair-order-attachments' in Supabase Dashboard
-- 3. Run migration scripts to import data from Zoho
