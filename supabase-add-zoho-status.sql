-- Add zoho_status column to store the actual Zoho CRM status
-- Run this in your Supabase SQL Editor

ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS zoho_status TEXT;

-- Add index for filtering by Zoho status
CREATE INDEX IF NOT EXISTS idx_appointments_zoho_status ON appointments(zoho_status);

-- Add comment
COMMENT ON COLUMN appointments.zoho_status IS 'Actual Zoho CRM status (e.g., Ready For Pickup, In Progress, etc.)';
