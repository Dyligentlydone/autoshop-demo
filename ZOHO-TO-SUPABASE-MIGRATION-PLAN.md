# Zoho to Supabase Migration Plan

## Executive Summary

This document outlines a complete, safe migration from Zoho CRM to Supabase for the ACME TIRE application. The migration is designed to be:
- **Zero-downtime** - Deploy with feature flag, test, then switch
- **Reversible** - Keep Zoho data as backup for 30 days
- **Tested** - Comprehensive local testing before production
- **Safe** - No data loss, all functionality preserved

---

## Current Zoho Usage Analysis

### 1. Data Stored in Zoho

#### **Customers (Contacts Module)**
- Fields: `id`, `First_Name`, `Last_Name`, `Phone`, `Email`, `Preferred_Contact_Method`, `Description`
- Count: ~XXX customers (need to check)
- Used by: Customer pages, Voiceflow agent, search

#### **Vehicles (Vehicles Module)**
- Fields: `id`, `Name` (year), `Make`, `Model`, `Vin`, `License_Plate`, `Engine_Size`, `Owner1` (customer), `Color`, `Note`
- Count: ~XXX vehicles
- Used by: Vehicle pages, repair orders, Voiceflow agent

#### **Repair Orders (Repair_Orders Module)**
- Fields: `id`, `Name` (service type), `Status`, `Job_Description`, `Note`, `Estimated_Total`, `Final_Charge_Total`, `Estimated_Completion`, `Scheduled_drop_off`, `Vehicle`, `Customer`, `Created_Time`, `Modified_Time`
- Count: ~XXX repair orders
- Used by: Repair order pages, calendar, Voiceflow agent, dashboard

#### **Attachments (Files)**
- Photos uploaded to repair orders
- Stored in Zoho's file system
- Count: ~XXX files
- Used by: Repair order detail pages

---

### 2. API Endpoints Using Zoho

#### **CRM Endpoints (17 files)**
1. `/api/crm/customers` - List/create customers
2. `/api/crm/customers/[id]` - Get/update customer
3. `/api/crm/customers/search` - Search customers
4. `/api/crm/vehicles` - List/create vehicles
5. `/api/crm/vehicles/[id]` - Get/update vehicle
6. `/api/crm/vehicles/[id]/repair-orders` - Get vehicle's repair orders
7. `/api/crm/vehicles/by-customer` - Get customer's vehicles
8. `/api/crm/vehicles/search` - Search vehicles
9. `/api/crm/repair-orders` - List/create repair orders
10. `/api/crm/repair-orders/[id]` - Get/update repair order
11. `/api/crm/repair-orders/[id]/check-in-vin` - VIN check-in
12. `/api/crm/repair-orders/[id]/attachments` - List/upload attachments
13. `/api/crm/repair-orders/[id]/attachments/[id]` - Delete attachment
14. `/api/crm/repair-orders/[id]/attachments/[id]/download` - Download attachment
15. `/api/crm/repair-orders/enriched` - Get repair orders with vehicle/customer data
16. `/api/crm/dashboard/active-repair-orders` - Dashboard stats
17. `/api/crm/search` - Global search

#### **Voiceflow Agent Endpoints (6 files)**
1. `/api/agent/customer/lookup` - Find customer by phone/email/name
2. `/api/agent/customer/recall` - Find customer's recent repair orders
3. `/api/agent/repair-orders/create` - Create repair order
4. `/api/agent/repair-orders/lookup` - Find repair orders
5. `/api/agent/repair-orders/update` - Update repair order
6. `/api/agent/repair-orders/add-note` - Add notes to repair order

#### **Integration Endpoints (3 files)**
1. `/api/appointments/sync-from-zoho` - Sync appointments from Zoho
2. `/api/line-items/sync-to-zoho` - Sync estimates to Zoho
3. `/api/webhooks/zoho/repair-order-updated` - Webhook for Zoho updates

#### **Other (2 files)**
1. `/api/dashboard/crm-backup` - Backup Zoho data
2. `/api/zoho/[...path]` - Proxy for Zoho API

**Total: 28 API endpoint files to update**

---

### 3. Frontend Components Using Zoho Data

- Customer list/detail pages
- Vehicle list/detail pages
- Repair order list/detail pages
- Dashboard (active repair orders)
- Calendar (appointments from repair orders)
- Global search
- Estimate calculator (syncs to Zoho)

**Note:** Frontend doesn't call Zoho directly - all goes through API endpoints above

---

## Supabase Schema Design

### Table: `customers`

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_id TEXT UNIQUE, -- For migration tracking
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  email TEXT,
  preferred_contact_method TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_zoho_id ON customers(zoho_id);

-- Full text search
CREATE INDEX idx_customers_search ON customers USING gin(
  to_tsvector('english', 
    COALESCE(first_name, '') || ' ' || 
    COALESCE(last_name, '') || ' ' || 
    COALESCE(phone, '') || ' ' || 
    COALESCE(email, '')
  )
);
```

### Table: `vehicles`

```sql
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_id TEXT UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  year TEXT NOT NULL DEFAULT '',
  make TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  vin TEXT,
  license_plate TEXT,
  engine_size TEXT,
  color TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_vehicles_vin ON vehicles(vin);
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_vehicles_zoho_id ON vehicles(zoho_id);

-- Full text search
CREATE INDEX idx_vehicles_search ON vehicles USING gin(
  to_tsvector('english', 
    COALESCE(year, '') || ' ' || 
    COALESCE(make, '') || ' ' || 
    COALESCE(model, '') || ' ' || 
    COALESCE(vin, '') || ' ' || 
    COALESCE(license_plate, '')
  )
);
```

### Table: `repair_orders`

```sql
CREATE TYPE repair_order_status AS ENUM (
  'New',
  'Scheduled',
  'Dropped Off',
  'Diagnosing',
  'Waiting Approval',
  'Repair Approved',
  'In Progress',
  'Ready For Pickup',
  'Completed'
);

CREATE TABLE repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_id TEXT UNIQUE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status repair_order_status NOT NULL DEFAULT 'New',
  service_type TEXT,
  job_description TEXT,
  note TEXT,
  estimated_total DECIMAL(10, 2),
  final_charge_total DECIMAL(10, 2),
  estimated_completion TIMESTAMPTZ,
  scheduled_drop_off DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_repair_orders_vehicle_id ON repair_orders(vehicle_id);
CREATE INDEX idx_repair_orders_customer_id ON repair_orders(customer_id);
CREATE INDEX idx_repair_orders_status ON repair_orders(status);
CREATE INDEX idx_repair_orders_created_at ON repair_orders(created_at DESC);
CREATE INDEX idx_repair_orders_zoho_id ON repair_orders(zoho_id);

-- Full text search
CREATE INDEX idx_repair_orders_search ON repair_orders USING gin(
  to_tsvector('english', 
    COALESCE(service_type, '') || ' ' || 
    COALESCE(job_description, '') || ' ' || 
    COALESCE(note, '')
  )
);
```

### Table: `repair_order_attachments`

```sql
CREATE TABLE repair_order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoho_id TEXT UNIQUE,
  repair_order_id UUID REFERENCES repair_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Supabase Storage path
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_attachments_repair_order_id ON repair_order_attachments(repair_order_id);
CREATE INDEX idx_attachments_zoho_id ON repair_order_attachments(zoho_id);
```

### Updated Triggers

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repair_orders_updated_at BEFORE UPDATE ON repair_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_order_attachments ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for service role)
CREATE POLICY "Allow all for service role" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON vehicles FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON repair_orders FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON repair_order_attachments FOR ALL USING (true);
```

---

## Data Migration Strategy

### Phase 1: Export Data from Zoho

Create script: `/scripts/export-zoho-data.ts`

```typescript
// Fetch all customers, vehicles, repair orders from Zoho
// Save to JSON files for backup
// Track IDs for mapping
```

### Phase 2: Import Data to Supabase

Create script: `/scripts/import-to-supabase.ts`

```typescript
// Read JSON files
// Insert into Supabase with zoho_id preserved
// Create ID mapping (Zoho ID -> Supabase UUID)
// Verify counts match
```

### Phase 3: Migrate File Attachments

Create script: `/scripts/migrate-attachments.ts`

```typescript
// Download all attachments from Zoho
// Upload to Supabase Storage (bucket: 'repair-order-attachments')
// Create records in repair_order_attachments table
// Verify all files migrated
```

---

## Code Migration Strategy

### Step 1: Create Supabase Helper Functions

File: `/src/lib/supabase-crm.ts`

```typescript
// Mirror all Zoho functions but use Supabase
export const supabaseLookupCustomerByPhone = async (phone: string) => { ... }
export const supabaseCreateCustomer = async (data: any) => { ... }
export const supabaseUpdateCustomer = async (id: string, data: any) => { ... }
// ... etc for vehicles and repair orders
```

### Step 2: Create Feature Flag

File: `/src/lib/feature-flags.ts`

```typescript
export const USE_SUPABASE_CRM = process.env.USE_SUPABASE_CRM === 'true';
```

### Step 3: Update API Endpoints (Dual Mode)

Each endpoint will support both Zoho and Supabase:

```typescript
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { zohoLookupCustomer } from '@/lib/zoho/service';
import { supabaseLookupCustomer } from '@/lib/supabase-crm';

export const GET = async (req: NextRequest) => {
  if (USE_SUPABASE_CRM) {
    return supabaseLookupCustomer(req);
  } else {
    return zohoLookupCustomer(req);
  }
};
```

### Step 4: Update All 28 Endpoint Files

1. `/api/crm/*` - 17 files
2. `/api/agent/*` - 6 files
3. `/api/appointments/sync-from-zoho` - Remove (appointments already in Supabase)
4. `/api/line-items/sync-to-zoho` - Remove (no longer needed)
5. `/api/webhooks/zoho/*` - Remove (no longer needed)

---

## Testing Plan

### Local Testing Checklist

**Before Migration:**
- [ ] Export all Zoho data to JSON
- [ ] Count records: customers, vehicles, repair orders, attachments
- [ ] Backup Zoho data

**After Migration:**
- [ ] Verify record counts match
- [ ] Test customer CRUD operations
- [ ] Test vehicle CRUD operations
- [ ] Test repair order CRUD operations
- [ ] Test file upload/download
- [ ] Test global search
- [ ] Test Voiceflow agent endpoints
- [ ] Test calendar sync
- [ ] Test estimate calculator
- [ ] Test dashboard stats

### Production Testing Checklist

**Phase 1: Deploy with Feature Flag OFF**
- [ ] Deploy code to Railway
- [ ] Verify Zoho still works
- [ ] No errors in logs

**Phase 2: Run Migration Scripts**
- [ ] Run export script
- [ ] Run import script
- [ ] Run attachment migration
- [ ] Verify data in Supabase

**Phase 3: Enable Feature Flag**
- [ ] Set `USE_SUPABASE_CRM=true` in Railway
- [ ] Restart app
- [ ] Test all features
- [ ] Monitor error logs

**Phase 4: Verify Voiceflow**
- [ ] Make test call
- [ ] Create repair order
- [ ] Update repair order
- [ ] Verify data in Supabase

---

## Rollback Plan

If anything goes wrong:

1. **Immediate Rollback:**
   - Set `USE_SUPABASE_CRM=false` in Railway
   - Restart app
   - App reverts to Zoho

2. **Data Sync:**
   - If data was created in Supabase during testing, manually sync back to Zoho
   - Or discard and continue with Zoho

3. **Keep Zoho Active:**
   - Don't cancel Zoho subscription for 30 days
   - Keep as backup

---

## Timeline

### Week 1: Preparation
- **Day 1-2:** Create Supabase schema
- **Day 3:** Create migration scripts
- **Day 4:** Create Supabase helper functions
- **Day 5:** Test locally

### Week 2: Migration
- **Day 1:** Update all API endpoints with feature flag
- **Day 2:** Test locally with Supabase
- **Day 3:** Deploy to production (flag OFF)
- **Day 4:** Run migration scripts
- **Day 5:** Enable feature flag, test

### Week 3: Monitoring
- Monitor for issues
- Fix any bugs
- Verify Voiceflow agent works

### Week 4: Cleanup
- Remove Zoho code
- Cancel Zoho subscription
- Celebrate! 🎉

---

## Risk Mitigation

### Risk 1: Data Loss During Migration
**Mitigation:**
- Export all Zoho data to JSON before migration
- Keep Zoho active for 30 days
- Verify record counts match

### Risk 2: Voiceflow Agent Breaks
**Mitigation:**
- Test all agent endpoints locally
- Use feature flag for gradual rollout
- Keep Zoho as fallback

### Risk 3: File Attachments Don't Migrate
**Mitigation:**
- Download all files before migration
- Verify file counts match
- Keep Zoho files accessible for 30 days

### Risk 4: Performance Issues
**Mitigation:**
- Supabase is faster than Zoho
- Add proper indexes
- Monitor query performance

### Risk 5: Bugs in New Code
**Mitigation:**
- Comprehensive local testing
- Feature flag for easy rollback
- Monitor error logs closely

---

## Success Criteria

Migration is successful when:

1. ✅ All data migrated (customers, vehicles, repair orders, attachments)
2. ✅ All features work (CRUD, search, calendar, dashboard)
3. ✅ Voiceflow agent works (create/update repair orders)
4. ✅ No errors in production logs
5. ✅ App is faster than before
6. ✅ No rate limiting issues

---

## Post-Migration Benefits

1. **10x faster** - No API delays
2. **No rate limits** - No more "data won't load" issues
3. **Save $168-600/year** - No Zoho subscription
4. **Better developer experience** - SQL queries vs API calls
5. **Real-time features** - Supabase subscriptions
6. **Full control** - Your data, your rules

---

## Estimated Effort

- **Schema creation:** 2 hours
- **Migration scripts:** 3 hours
- **Helper functions:** 4 hours
- **Update endpoints:** 8 hours
- **Testing:** 4 hours
- **Deployment:** 2 hours
- **Monitoring:** 4 hours

**Total: ~27 hours** (spread over 2-3 weeks for safety)

---

## Next Steps

1. Review this plan
2. Approve migration
3. Start with schema creation
4. Test locally
5. Deploy with feature flag
6. Migrate data
7. Switch to Supabase
8. Monitor and celebrate!
