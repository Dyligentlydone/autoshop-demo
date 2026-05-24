-- Appointments table for scheduling feature
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_order_id TEXT NOT NULL UNIQUE,  -- Zoho repair order ID (one appointment per RO)
  customer_name TEXT,
  customer_phone TEXT,
  vehicle_display TEXT,
  service_type TEXT,
  scheduled_datetime TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT DEFAULT 'scheduled',  -- scheduled, in_progress, completed, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments(scheduled_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_repair_order ON appointments(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Enable Row Level Security (optional - for future customer portal)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (your staff)
CREATE POLICY "Allow all for authenticated users" ON appointments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS appointments_updated_at ON appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_appointments_updated_at();

-- Add comment for documentation
COMMENT ON TABLE appointments IS 'Appointment scheduling synced with Zoho repair orders estimated_completion field';
