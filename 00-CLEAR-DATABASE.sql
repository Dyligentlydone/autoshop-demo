-- =====================================================
-- CLEAR ALL TABLES - AutoShop Demo
-- =====================================================
-- WARNING: This will delete ALL data and tables
-- Run this FIRST to clean your existing Supabase project
-- =====================================================

-- Drop all tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS migration_log CASCADE;
DROP TABLE IF EXISTS sms_templates CASCADE;
DROP TABLE IF EXISTS sms_messages CASCADE;
DROP TABLE IF EXISTS estimate_preset_items CASCADE;
DROP TABLE IF EXISTS estimate_presets CASCADE;
DROP TABLE IF EXISTS estimate_items CASCADE;
DROP TABLE IF EXISTS estimates CASCADE;
DROP TABLE IF EXISTS line_items CASCADE;
DROP TABLE IF EXISTS shop_settings CASCADE;
DROP TABLE IF EXISTS repair_order_attachments CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS repair_orders CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS repair_order_status CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_appointments_updated_at() CASCADE;
DROP FUNCTION IF EXISTS search_customer_by_phone(TEXT) CASCADE;
DROP FUNCTION IF EXISTS search_customer_by_email(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_enriched_repair_orders(repair_order_status, INTEGER) CASCADE;

-- Drop storage bucket (if exists)
-- Note: You may need to manually delete the bucket in Supabase Dashboard > Storage
-- DELETE FROM storage.buckets WHERE name = 'repair-order-attachments';

-- =====================================================
-- DATABASE CLEARED
-- =====================================================
-- Next step: Run 01-FRESH-SETUP.sql to create new schema
