-- Add 'condition' column to estimate_items and line_items tables
-- For Michigan law compliance: must disclose if parts are New, Used, or Remanufactured

ALTER TABLE estimate_items ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE line_items ADD COLUMN IF NOT EXISTS condition TEXT;

COMMENT ON COLUMN estimate_items.condition IS 'Part condition: new, used, or remanufactured (MI law compliance)';
COMMENT ON COLUMN line_items.condition IS 'Part condition: new, used, or remanufactured (MI law compliance)';
