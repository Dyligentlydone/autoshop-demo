-- =============================================================
-- Estimates & Quick Quote Presets Schema
-- =============================================================

-- Standalone estimates (can exist before linking to a repair order)
CREATE TABLE IF NOT EXISTS estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Estimate line items with part-specific fields
CREATE TABLE IF NOT EXISTS estimate_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  -- Parts pricing
  parts_cost NUMERIC(10,2) DEFAULT 0,
  parts_price NUMERIC(10,2) DEFAULT 0,
  -- Labor pricing
  labor_hours NUMERIC(10,2) DEFAULT 0,
  labor_rate NUMERIC(10,2) DEFAULT 0,
  labor_cost NUMERIC(10,2) DEFAULT 0,
  labor_price NUMERIC(10,2) DEFAULT 0,
  -- Part-specific details
  part_number TEXT,
  supplier TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('aftermarket', 'oem', 'manual')),
  order_status TEXT DEFAULT 'not_ordered' CHECK (order_status IN ('not_ordered', 'to_order', 'ordered', 'received')),
  -- Metadata
  category TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quick Quote presets (e.g. "Oil Change", "Brake Pad Replacement")
CREATE TABLE IF NOT EXISTS estimate_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items within each preset
CREATE TABLE IF NOT EXISTS estimate_preset_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  category TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add part-specific columns to existing line_items table (backwards compatible)
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS part_number TEXT;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'not_ordered';
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_estimates_customer_id ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_vehicle_id ON estimates(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_estimates_repair_order_id ON estimates(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_order_status ON estimate_items(order_status);
CREATE INDEX IF NOT EXISTS idx_estimate_presets_active ON estimate_presets(is_active);
CREATE INDEX IF NOT EXISTS idx_estimate_preset_items_preset_id ON estimate_preset_items(preset_id);

-- Auto-update timestamps
DROP TRIGGER IF EXISTS update_estimates_updated_at ON estimates;
CREATE TRIGGER update_estimates_updated_at
    BEFORE UPDATE ON estimates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estimate_items_updated_at ON estimate_items;
CREATE TRIGGER update_estimate_items_updated_at
    BEFORE UPDATE ON estimate_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estimate_presets_updated_at ON estimate_presets;
CREATE TRIGGER update_estimate_presets_updated_at
    BEFORE UPDATE ON estimate_presets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_estimate_preset_items_updated_at ON estimate_preset_items;
CREATE TRIGGER update_estimate_preset_items_updated_at
    BEFORE UPDATE ON estimate_preset_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
