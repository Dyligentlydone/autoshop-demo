-- Add appointment_type field to distinguish between estimated_completion and scheduled_drop_off
-- Run this in your Supabase SQL Editor

ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS appointment_type TEXT DEFAULT 'estimated_completion';

-- Add index for filtering by appointment type
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(appointment_type);

-- Add comment
COMMENT ON COLUMN appointments.appointment_type IS 'Type of appointment: estimated_completion (green) or scheduled_drop_off (blue)';

-- Update constraint to allow multiple appointments per repair order (one for each type)
-- First, drop the unique constraint on repair_order_id
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_repair_order_id_key;

-- Add a unique constraint on the combination of repair_order_id and appointment_type
ALTER TABLE appointments ADD CONSTRAINT appointments_repair_order_type_unique 
  UNIQUE (repair_order_id, appointment_type);
