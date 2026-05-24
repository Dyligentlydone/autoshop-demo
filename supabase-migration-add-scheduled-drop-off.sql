-- Add scheduled_drop_off column to crm_backup table
-- Run this in your Supabase SQL Editor

ALTER TABLE crm_backup 
ADD COLUMN IF NOT EXISTS scheduled_drop_off TEXT;

-- Add comment for documentation
COMMENT ON COLUMN crm_backup.scheduled_drop_off IS 'ISO 8601 datetime string for scheduled vehicle drop-off';
