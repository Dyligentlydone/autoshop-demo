# Remaining API Endpoints to Update

## ✅ COMPLETED
1. `/api/agent/customer/lookup` - Updated with feature flag

## 📋 REMAINING VOICEFLOW AGENT ENDPOINTS (5 files)

2. `/api/agent/customer/recall/route.ts`
3. `/api/agent/repair-orders/create/route.ts`
4. `/api/agent/repair-orders/lookup/route.ts`
5. `/api/agent/repair-orders/update/route.ts`
6. `/api/agent/repair-orders/add-note/route.ts`

## 📋 CRM ENDPOINTS (17 files)

7. `/api/crm/customers/route.ts` - List/create
8. `/api/crm/customers/[id]/route.ts` - Get/update
9. `/api/crm/customers/search/route.ts` - Search
10. `/api/crm/vehicles/route.ts` - List/create
11. `/api/crm/vehicles/[id]/route.ts` - Get/update
12. `/api/crm/vehicles/[id]/repair-orders/route.ts` - Get vehicle's ROs
13. `/api/crm/vehicles/by-customer/route.ts` - Get customer's vehicles
14. `/api/crm/vehicles/search/route.ts` - Search
15. `/api/crm/repair-orders/route.ts` - List/create
16. `/api/crm/repair-orders/[id]/route.ts` - Get/update
17. `/api/crm/repair-orders/[id]/check-in-vin/route.ts` - VIN check-in
18. `/api/crm/repair-orders/[id]/attachments/route.ts` - List/upload
19. `/api/crm/repair-orders/[id]/attachments/[id]/route.ts` - Delete
20. `/api/crm/repair-orders/[id]/attachments/[id]/download/route.ts` - Download
21. `/api/crm/repair-orders/enriched/route.ts` - Get with joins
22. `/api/crm/dashboard/active-repair-orders/route.ts` - Dashboard
23. `/api/crm/search/route.ts` - Global search

## 📋 INTEGRATION ENDPOINTS (3 files - REMOVE/SIMPLIFY)

24. `/api/appointments/sync-from-zoho/route.ts` - **REMOVE** (appointments already in Supabase)
25. `/api/line-items/sync-to-zoho/route.ts` - **UPDATE** (sync to repair_orders table instead)
26. `/api/webhooks/zoho/repair-order-updated/route.ts` - **REMOVE** (no longer needed)

## 📋 OTHER (2 files)

27. `/api/dashboard/crm-backup/route.ts` - **UPDATE** (backup from Supabase)
28. `/api/zoho/[...path]/route.ts` - **KEEP AS IS** (proxy still needed for now)

---

## Strategy

Due to the large number of files, I'll:

1. ✅ Update the most critical Voiceflow agent endpoints first (done: 1/6)
2. Update remaining Voiceflow endpoints (5 files)
3. Update CRM endpoints systematically (17 files)
4. Remove/update integration endpoints (3 files)
5. Test locally with `USE_SUPABASE_CRM=true`
6. Deploy to production

---

## Pattern for Updates

Each endpoint needs:
```typescript
import { USE_SUPABASE_CRM } from '@/lib/feature-flags';
import { supabase... } from '@/lib/supabase-crm';

// In handler:
if (USE_SUPABASE_CRM) {
  // Use Supabase functions
} else {
  // Use Zoho functions
}
```
