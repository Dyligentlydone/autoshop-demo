-- =====================================================
-- FIX: Add missing columns to appointments table
-- =====================================================
-- The appointments table needs appointment_type and zoho_status
-- columns plus a composite unique constraint to support both
-- "estimated_completion" and "scheduled_drop_off" entries per RO.
-- =====================================================

-- Add appointment_type column
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS appointment_type TEXT DEFAULT 'estimated_completion';

-- Add ro_status column (repair order status snapshot)
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS ro_status TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(appointment_type);
CREATE INDEX IF NOT EXISTS idx_appointments_ro_status ON appointments(ro_status);

-- Drop old unique constraint on repair_order_id alone
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_repair_order_id_key;

-- Add composite unique constraint (allows 2 rows per RO: one drop-off, one completion)
ALTER TABLE appointments 
  DROP CONSTRAINT IF EXISTS appointments_repair_order_type_unique;
ALTER TABLE appointments 
  ADD CONSTRAINT appointments_repair_order_type_unique 
  UNIQUE (repair_order_id, appointment_type);

-- Comments
COMMENT ON COLUMN appointments.appointment_type IS 'Type of appointment: estimated_completion (green) or scheduled_drop_off (blue)';
COMMENT ON COLUMN appointments.ro_status IS 'Repair order status snapshot (e.g., Ready For Pickup, In Progress)';

-- =====================================================
-- LINE ITEMS / ESTIMATES: Missing columns
-- =====================================================

-- Part condition (New, Used, Reman) - MI law compliance
ALTER TABLE estimate_items   ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE line_items       ADD COLUMN IF NOT EXISTS condition TEXT;

-- Per-item tax flag
ALTER TABLE estimate_preset_items ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE estimate_items        ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE line_items            ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT TRUE;

-- =====================================================
-- DONE! Now retry creating a repair order or estimate item
-- =====================================================
