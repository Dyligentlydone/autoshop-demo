-- Per-item tax control.
-- Adds a `taxable` flag to preset items, estimate items, and line items so individual
-- line items can be excluded from tax (e.g. tires, certain services) while the global
-- tax setting stays enabled.
--
-- Defaults to TRUE so existing rows continue to be taxed exactly as before.

ALTER TABLE estimate_preset_items
  ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT TRUE;
