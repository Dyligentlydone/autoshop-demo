-- Migration: Change scheduled_drop_off from DATE to TIMESTAMPTZ
-- This fixes timezone issues where dates appear one day earlier

-- Step 1: Add new column with TIMESTAMPTZ type
ALTER TABLE repair_orders ADD COLUMN scheduled_drop_off_new TIMESTAMPTZ;

-- Step 2: Copy data from old column to new column (converting DATE to TIMESTAMPTZ at midnight UTC)
UPDATE repair_orders 
SET scheduled_drop_off_new = scheduled_drop_off::TIMESTAMPTZ 
WHERE scheduled_drop_off IS NOT NULL;

-- Step 3: Drop old column
ALTER TABLE repair_orders DROP COLUMN scheduled_drop_off;

-- Step 4: Rename new column to original name
ALTER TABLE repair_orders RENAME COLUMN scheduled_drop_off_new TO scheduled_drop_off;

-- Done! scheduled_drop_off is now TIMESTAMPTZ instead of DATE
