-- =====================================================
-- AUTOSHOP DEMO - Complete Fresh Database Setup
-- =====================================================
-- Run this AFTER clearing the database with 00-CLEAR-DATABASE.sql
-- This creates all tables, indexes, and default data
-- =====================================================

-- =====================================================
-- HELPER FUNCTIONS (Create First)
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CUSTOMERS TABLE
-- =====================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_id TEXT UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  email TEXT,
  preferred_contact_method TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_customers_zoho_id ON customers(zoho_id) WHERE zoho_id IS NOT NULL;
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- Full-text search
CREATE INDEX idx_customers_search ON customers USING gin(
  to_tsvector('english', 
    COALESCE(first_name, '') || ' ' || 
    COALESCE(last_name, '') || ' ' || 
    COALESCE(phone, '') || ' ' || 
    COALESCE(email, '')
  )
);

-- Trigger
CREATE TRIGGER update_customers_updated_at 
  BEFORE UPDATE ON customers
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role - customers" 
  ON customers FOR ALL USING (true);

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

-- Indexes
CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_vehicles_vin ON vehicles(vin) WHERE vin IS NOT NULL;
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate) WHERE license_plate IS NOT NULL;
CREATE INDEX idx_vehicles_zoho_id ON vehicles(zoho_id) WHERE zoho_id IS NOT NULL;
CREATE INDEX idx_vehicles_created_at ON vehicles(created_at DESC);

-- Full-text search
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
  to_tsvector('english', 
    COALESCE(year, '') || ' ' || 
    COALESCE(make, '') || ' ' || 
    COALESCE(model, '') || ' ' || 
    COALESCE(vin, '') || ' ' || 
    COALESCE(license_plate, '')
  )
);

-- Trigger
CREATE TRIGGER update_vehicles_updated_at 
  BEFORE UPDATE ON vehicles
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role - vehicles" 
  ON vehicles FOR ALL USING (true);

-- =====================================================
-- REPAIR ORDERS TABLE
-- =====================================================

-- Create enum for status
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

-- Indexes
CREATE INDEX idx_repair_orders_vehicle_id ON repair_orders(vehicle_id);
CREATE INDEX idx_repair_orders_customer_id ON repair_orders(customer_id);
CREATE INDEX idx_repair_orders_status ON repair_orders(status);
CREATE INDEX idx_repair_orders_created_at ON repair_orders(created_at DESC);
CREATE INDEX idx_repair_orders_updated_at ON repair_orders(updated_at DESC);
CREATE INDEX idx_repair_orders_estimated_completion ON repair_orders(estimated_completion) WHERE estimated_completion IS NOT NULL;
CREATE INDEX idx_repair_orders_zoho_id ON repair_orders(zoho_id) WHERE zoho_id IS NOT NULL;

-- Full-text search
CREATE INDEX idx_repair_orders_search ON repair_orders USING gin(
  to_tsvector('english', 
    COALESCE(service_type, '') || ' ' || 
    COALESCE(job_description, '') || ' ' || 
    COALESCE(note, '')
  )
);

-- Trigger
CREATE TRIGGER update_repair_orders_updated_at 
  BEFORE UPDATE ON repair_orders
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role - repair_orders" 
  ON repair_orders FOR ALL USING (true);

-- =====================================================
-- REPAIR ORDER ATTACHMENTS TABLE
-- =====================================================
CREATE TABLE repair_order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_id TEXT UNIQUE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_attachments_repair_order_id ON repair_order_attachments(repair_order_id);
CREATE INDEX idx_attachments_zoho_id ON repair_order_attachments(zoho_id) WHERE zoho_id IS NOT NULL;
CREATE INDEX idx_attachments_created_at ON repair_order_attachments(created_at DESC);

-- RLS
ALTER TABLE repair_order_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role - attachments" 
  ON repair_order_attachments FOR ALL USING (true);

-- =====================================================
-- APPOINTMENTS TABLE
-- =====================================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  vehicle_display TEXT,
  service_type TEXT,
  scheduled_datetime TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT DEFAULT 'scheduled',
  appointment_type TEXT DEFAULT 'estimated_completion',
  ro_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT appointments_repair_order_type_unique UNIQUE (repair_order_id, appointment_type)
);

-- Indexes
CREATE INDEX idx_appointments_datetime ON appointments(scheduled_datetime);
CREATE INDEX idx_appointments_repair_order ON appointments(repair_order_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_type ON appointments(appointment_type);
CREATE INDEX idx_appointments_ro_status ON appointments(ro_status);

-- Trigger
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users - appointments" 
  ON appointments FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- ESTIMATES & LINE ITEMS
-- =====================================================

-- Estimates table
CREATE TABLE estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  repair_order_id UUID REFERENCES repair_orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'ordered')),
  notes TEXT,
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estimate items
CREATE TABLE estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  parts_cost NUMERIC(10,2) DEFAULT 0,
  parts_price NUMERIC(10,2) DEFAULT 0,
  labor_hours NUMERIC(10,2) DEFAULT 0,
  labor_rate NUMERIC(10,2) DEFAULT 0,
  labor_cost NUMERIC(10,2) DEFAULT 0,
  labor_price NUMERIC(10,2) DEFAULT 0,
  part_number TEXT,
  supplier TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('aftermarket', 'oem', 'manual')),
  order_status TEXT DEFAULT 'not_ordered' CHECK (order_status IN ('not_ordered', 'to_order', 'ordered', 'received')),
  condition TEXT,
  taxable BOOLEAN NOT NULL DEFAULT TRUE,
  category TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Estimate presets
CREATE TABLE estimate_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preset items
CREATE TABLE estimate_preset_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID NOT NULL REFERENCES estimate_presets(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  parts_cost NUMERIC(10,2) DEFAULT 0,
  parts_price NUMERIC(10,2) DEFAULT 0,
  labor_hours NUMERIC(10,2) DEFAULT 0,
  labor_rate NUMERIC(10,2) DEFAULT 0,
  labor_cost NUMERIC(10,2) DEFAULT 0,
  labor_price NUMERIC(10,2) DEFAULT 0,
  part_number TEXT,
  supplier TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('aftermarket', 'oem', 'manual')),
  taxable BOOLEAN NOT NULL DEFAULT TRUE,
  category TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Line items (legacy support)
CREATE TABLE line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  parts_cost DECIMAL(10,2) DEFAULT 0,
  parts_price DECIMAL(10,2) DEFAULT 0,
  labor_hours DECIMAL(10,2) DEFAULT 0,
  labor_rate DECIMAL(10,2) DEFAULT 0,
  labor_cost DECIMAL(10,2) DEFAULT 0,
  labor_price DECIMAL(10,2) DEFAULT 0,
  part_number TEXT,
  supplier TEXT,
  source TEXT DEFAULT 'manual',
  order_status TEXT DEFAULT 'not_ordered',
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  condition TEXT,
  taxable BOOLEAN NOT NULL DEFAULT TRUE,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for estimates
CREATE INDEX idx_estimates_customer_id ON estimates(customer_id);
CREATE INDEX idx_estimates_vehicle_id ON estimates(vehicle_id);
CREATE INDEX idx_estimates_repair_order_id ON estimates(repair_order_id);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimate_items_estimate_id ON estimate_items(estimate_id);
CREATE INDEX idx_estimate_items_order_status ON estimate_items(order_status);
CREATE INDEX idx_estimate_presets_active ON estimate_presets(is_active);
CREATE INDEX idx_estimate_preset_items_preset_id ON estimate_preset_items(preset_id);
CREATE INDEX idx_line_items_repair_order ON line_items(repair_order_id);
CREATE INDEX idx_line_items_category ON line_items(category);

-- Triggers
CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimate_items_updated_at
  BEFORE UPDATE ON estimate_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimate_presets_updated_at
  BEFORE UPDATE ON estimate_presets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimate_preset_items_updated_at
  BEFORE UPDATE ON estimate_preset_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_items_updated_at
  BEFORE UPDATE ON line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on line_items" 
  ON line_items FOR ALL USING (true);

-- =====================================================
-- SHOP SETTINGS
-- =====================================================
CREATE TABLE shop_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings for AutoShop Demo
INSERT INTO shop_settings (key, value) VALUES
  ('labor_rates', '{"hourly_rate": 100, "default_hours": 1}'::jsonb),
  ('tax', '{"enabled": true, "rate": 6.0}'::jsonb),
  ('markup_presets', '{"standard": 30, "premium": 50}'::jsonb),
  ('company_info', '{
    "name": "AutoShop Demo",
    "address": "",
    "phone": "",
    "email": "",
    "logo_url": ""
  }'::jsonb),
  ('quote_settings', '{
    "valid_days": 30,
    "terms": "All work guaranteed for 90 days or 3,000 miles.",
    "payment_terms": "Payment due upon completion."
  }'::jsonb);

-- Trigger
CREATE TRIGGER update_shop_settings_updated_at
  BEFORE UPDATE ON shop_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on shop_settings" 
  ON shop_settings FOR ALL USING (true);

-- =====================================================
-- SMS MESSAGES & TEMPLATES
-- =====================================================

-- SMS messages table
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id UUID REFERENCES repair_orders(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  message_body TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('estimate', 'update', 'general', 'reply')),
  twilio_sid TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS templates table
CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sms_messages_customer_id ON sms_messages(customer_id);
CREATE INDEX idx_sms_messages_repair_order_id ON sms_messages(repair_order_id);
CREATE INDEX idx_sms_messages_created_at ON sms_messages(created_at DESC);
CREATE INDEX idx_sms_messages_direction ON sms_messages(direction);
CREATE INDEX idx_sms_messages_twilio_sid ON sms_messages(twilio_sid);

-- Insert default template
INSERT INTO sms_templates (name, template_type, content, variables) VALUES
(
  'Estimate Ready',
  'estimate',
  'Hi {customerName}!

Your {serviceType} estimate is ready:

💰 Estimated Total: ${estimatedTotal}
📅 Est. Completion: {estimatedCompletion}

{photoCount} photo(s) attached

Questions? Reply to this message or call us!

- AutoShop Demo',
  '{"customerName": "string", "serviceType": "string", "estimatedTotal": "number", "estimatedCompletion": "string", "photoCount": "number"}'::jsonb
);

-- Triggers
CREATE TRIGGER update_sms_messages_updated_at
  BEFORE UPDATE ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sms_templates_updated_at
  BEFORE UPDATE ON sms_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATION LOG (for tracking)
-- =====================================================
CREATE TABLE migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_type TEXT NOT NULL,
  zoho_id TEXT NOT NULL,
  supabase_id UUID NOT NULL,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_migration_log_type ON migration_log(migration_type);
CREATE INDEX idx_migration_log_zoho_id ON migration_log(zoho_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Search customer by phone
CREATE OR REPLACE FUNCTION search_customer_by_phone(phone_input TEXT)
RETURNS SETOF customers AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM customers
  WHERE phone = regexp_replace(phone_input, '\D', '', 'g')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Search customer by email
CREATE OR REPLACE FUNCTION search_customer_by_email(email_input TEXT)
RETURNS SETOF customers AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM customers
  WHERE LOWER(email) = LOWER(email_input)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Get enriched repair orders
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
-- SETUP COMPLETE!
-- =====================================================
-- Your AutoShop Demo database is ready to use.
-- 
-- Next steps:
-- 1. Update your .env.local with Supabase credentials
-- 2. (Optional) Create storage bucket 'repair-order-attachments' in Supabase Dashboard
-- 3. Start using the app!
