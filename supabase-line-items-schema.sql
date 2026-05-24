-- Line Items for Parts & Labor Calculator
-- Run this in Supabase SQL Editor

-- Table: line_items
CREATE TABLE IF NOT EXISTS line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_order_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  
  -- Parts pricing (optional)
  parts_cost DECIMAL(10,2) DEFAULT 0,
  parts_price DECIMAL(10,2) DEFAULT 0,
  
  -- Labor pricing (optional)
  labor_hours DECIMAL(10,2) DEFAULT 0,
  labor_rate DECIMAL(10,2) DEFAULT 0,
  labor_cost DECIMAL(10,2) DEFAULT 0,
  labor_price DECIMAL(10,2) DEFAULT 0,
  
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by repair order
CREATE INDEX IF NOT EXISTS idx_line_items_repair_order ON line_items(repair_order_id);

-- Index for analytics by category
CREATE INDEX IF NOT EXISTS idx_line_items_category ON line_items(category);

-- RLS Policies (if needed)
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust based on your auth setup)
CREATE POLICY "Allow all operations on line_items" ON line_items
  FOR ALL USING (true);

-- Table: shop_settings
CREATE TABLE IF NOT EXISTS shop_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO shop_settings (key, value) VALUES
  ('labor_rates', '{"hourly_rate": 100, "default_hours": 1}'::jsonb),
  ('tax', '{"enabled": true, "rate": 6.0}'::jsonb),
  ('markup_presets', '{"standard": 30, "premium": 50}'::jsonb),
  ('company_info', '{
    "name": "ACME TIRE",
    "address": "",
    "phone": "",
    "email": "",
    "logo_url": ""
  }'::jsonb),
  ('quote_settings', '{
    "valid_days": 30,
    "terms": "All work guaranteed for 90 days or 3,000 miles.",
    "payment_terms": "Payment due upon completion."
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS for settings
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on shop_settings" ON shop_settings
  FOR ALL USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for line_items
CREATE TRIGGER update_line_items_updated_at
  BEFORE UPDATE ON line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for shop_settings
CREATE TRIGGER update_shop_settings_updated_at
  BEFORE UPDATE ON shop_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
