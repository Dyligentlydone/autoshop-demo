# ✅ Combined Parts & Labor Update

## What Changed

**Before:** Each line item was EITHER a "Part" OR "Labor" (had to choose)

**Now:** Each line item can have BOTH parts AND labor together!

---

## New Design

### Example Line Items:

**Oil Change:**
```
Description: Oil Change
Quantity: 1
├─ Parts: $25 cost → $35 price
├─ Labor: 0.5 hrs @ $100/hr → $50
└─ Total: $85 (profit: $35)
```

**Brake Job:**
```
Description: Front Brake Service
Quantity: 1
├─ Parts: $150 cost → $200 price
├─ Labor: 2 hrs @ $100/hr → $200
└─ Total: $400 (profit: $250)
```

**Diagnostic (Labor Only):**
```
Description: Engine Diagnostic
Quantity: 1
├─ Parts: $0
├─ Labor: 1 hr @ $100/hr → $100
└─ Total: $100 (profit: $100)
```

---

## Database Changes

**New Schema:**
```sql
line_items (
  description TEXT,
  quantity DECIMAL,
  
  -- Parts (optional)
  parts_cost DECIMAL,
  parts_price DECIMAL,
  
  -- Labor (optional)
  labor_hours DECIMAL,
  labor_rate DECIMAL,
  labor_cost DECIMAL,
  labor_price DECIMAL
)
```

**No more `type` field!** Each item can have both parts and labor.

---

## UI Changes

### Add/Edit Modal:
- **Description** field (e.g., "Oil Change")
- **Quantity** field
- **Parts Section** (blue):
  - Cost & Price inputs
  - Markup calculator (30%, 50%)
- **Labor Section** (green):
  - Hours & Rate inputs
  - Auto-calculates cost/price
- **Total Profit Preview** at bottom

### Table Display:
| Description | Qty | Parts | Labor | Total | Profit |
|-------------|-----|-------|-------|-------|--------|
| Oil Change  | 1   | $35   | $50   | $85   | $35    |

Shows cost under each price in small text.

---

## How to Test

### 1. Run Updated SQL Migration

**IMPORTANT:** You need to drop and recreate the table since the structure changed.

Run this in Supabase SQL Editor:

```sql
-- Drop old table
DROP TABLE IF EXISTS line_items CASCADE;

-- Run the new schema from supabase-line-items-schema.sql
```

Then run the full contents of `supabase-line-items-schema.sql`.

### 2. Test Combined Parts + Labor

1. Go to any repair order estimate page
2. Click "Add Item"
3. Enter:
   - Description: "Oil Change"
   - Quantity: 1
   - **Parts:** Cost $25, Price $35
   - **Labor:** 0.5 hours @ $100/hr (auto-fills $50)
4. Click "Add Item"

**Expected Result:**
- Shows both parts ($35) and labor ($50) in separate columns
- Total: $85
- Profit: $35

### 3. Test Parts Only

1. Add item with only parts, leave labor at 0
2. Should show parts price, labor shows "—"

### 4. Test Labor Only

1. Add item with only labor hours, leave parts at 0
2. Should show labor price, parts shows "—"

---

## Benefits

✅ **More realistic** - matches how auto shops actually work  
✅ **Flexible** - can have parts only, labor only, or both  
✅ **Clearer** - customer sees parts vs. labor breakdown  
✅ **Better tracking** - separate profit on parts vs. labor  

---

## Next Steps

1. **Run SQL migration** (drop old table, create new one)
2. **Test locally** with combined parts + labor
3. **Confirm it works** as expected
4. **Then we'll add:**
   - PDF generation
   - Zoho sync
   - Advanced features

---

## Files Changed

- `supabase-line-items-schema.sql` - New database schema
- `src/types/index.ts` - Updated TypeScript types
- `src/app/api/line-items/route.ts` - Updated API endpoints
- `src/hooks/use-line-items.ts` - Updated hooks
- `src/components/estimate-calculator.tsx` - Completely rebuilt UI

---

**Ready to test!** 🚀

Let me know if the combined parts + labor design works better for you!
