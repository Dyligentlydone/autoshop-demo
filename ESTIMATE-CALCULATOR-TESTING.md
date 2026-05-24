# Parts & Labor Calculator - Local Testing Guide

## ✅ What's Been Built

### 1. **Database Schema**
- `line_items` table for parts and labor
- `shop_settings` table for configuration
- File: `supabase-line-items-schema.sql`

### 2. **API Endpoints**
- `GET/POST /api/line-items` - Fetch/create line items
- `PATCH/DELETE /api/line-items/[id]` - Update/delete line items
- `GET/POST /api/settings` - Fetch/update shop settings

### 3. **UI Components**
- **EstimateCalculator** - Main calculator with line items table
- **Estimate Page** - `/repair-orders/[id]/estimate`
- **Settings Page** - `/settings`

### 4. **Features**
✅ Add parts and labor line items  
✅ Edit quantities, costs, and prices  
✅ Quick markup calculator (30%, 50%, custom)  
✅ Live profit calculation and margin display  
✅ Delete line items  
✅ Settings page for customization  
✅ Navigation integration  

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

1. Go to your Supabase project
2. Open SQL Editor
3. Copy and paste the contents of `supabase-line-items-schema.sql`
4. Click "Run"

This creates:
- `line_items` table
- `shop_settings` table with default values
- Indexes and triggers

### Step 2: Start Development Server

The server is already running on: **http://localhost:3001**

If you need to restart:
```bash
npm run dev
```

---

## 🧪 Testing the Calculator

### Test 1: Access Estimate Page

1. Go to http://localhost:3001/repair-orders
2. Find any repair order
3. Click the **"Estimate"** button
4. You should see the Parts & Labor Estimate calculator

### Test 2: Add a Part

1. Click **"Add Item"**
2. Select **"Part"**
3. Fill in:
   - Description: "Oil Filter"
   - Quantity: 1
   - Cost: $8.00
   - Price: $15.00
4. Click **"Add Item"**

**Expected Result:**
- Item appears in table
- Profit shows: $7.00
- Summary updates with totals

### Test 3: Add Labor

1. Click **"Add Item"**
2. Select **"Labor"**
3. Fill in:
   - Description: "Oil Change Service"
   - Quantity: 0.5 (hours)
   - Cost: $50.00
   - Price: $50.00
4. Click **"Add Item"**

**Expected Result:**
- Labor item appears with green badge
- Total profit and margin update

### Test 4: Use Markup Calculator

1. Click **"Add Item"**
2. Enter Cost: $25.00
3. Enter Markup: 30
4. Click **"Apply"**

**Expected Result:**
- Price auto-fills to $32.50

### Test 5: Edit Line Item

1. Click the **edit icon** (pencil) on any item
2. Change quantity or price
3. Click **"Update Item"**

**Expected Result:**
- Item updates
- Totals recalculate

### Test 6: Delete Line Item

1. Click the **trash icon** on any item
2. Confirm deletion

**Expected Result:**
- Item removed
- Totals recalculate

---

## ⚙️ Testing Settings Page

### Test 1: Access Settings

1. Click **"Settings"** in the left sidebar
2. You should see all configuration options

### Test 2: Update Labor Rate

1. Change "Hourly Rate" to $125.00
2. Click **"Save Settings"**

**Expected Result:**
- "Settings saved!" message appears
- Settings persist on page refresh

### Test 3: Configure Tax

1. Enable/disable tax checkbox
2. Set tax rate (e.g., 7.5%)
3. Save settings

**Expected Result:**
- Tax settings saved
- (Will be used in PDF generation later)

### Test 4: Update Company Info

1. Fill in:
   - Company Name
   - Address
   - Phone
   - Email
2. Save settings

**Expected Result:**
- Company info saved
- (Will appear on PDF quotes later)

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch line items"

**Solution:**
- Make sure you ran the SQL migration in Supabase
- Check Supabase connection in `.env.local`
- Check browser console for errors

### Issue: Calculator not loading

**Solution:**
- Make sure dev server is running on port 3001
- Check for TypeScript errors in terminal
- Clear browser cache and refresh

### Issue: Settings not saving

**Solution:**
- Check Supabase SQL migration ran successfully
- Verify `shop_settings` table exists
- Check API route logs in terminal

### Issue: "Estimate" button not showing

**Solution:**
- Make sure you're on the repair orders page
- Refresh the page
- Check that Link component is imported correctly

---

## 📋 What's Next (Not Built Yet)

### Phase 2: PDF Generation
- Install `@react-pdf/renderer`
- Create PDF quote template
- Add "Generate PDF" button
- Email quote functionality

### Phase 3: Enhancements
- Parts catalog with search
- Labor rate templates
- Estimate versions
- Customer approval workflow
- Profit analytics dashboard

---

## 🎯 Current Status

**✅ READY TO TEST:**
- Database schema
- API endpoints
- Calculator UI
- Settings page
- Navigation

**⏳ TODO:**
- PDF generation
- Email quotes
- Sync totals to Zoho
- Advanced features

---

## 💡 Quick Tips

1. **Markup Shortcuts:** Use the 30% and 50% buttons for quick pricing
2. **Profit Preview:** Shows profit before adding the item
3. **Live Calculations:** All totals update automatically
4. **Settings Persist:** Your shop settings are saved in Supabase

---

## 🔗 Important URLs

- **Repair Orders:** http://localhost:3001/repair-orders
- **Settings:** http://localhost:3001/settings
- **Example Estimate:** http://localhost:3001/repair-orders/[any-repair-order-id]/estimate

---

## 📝 Notes

- All data is stored in Supabase (not Zoho yet)
- Totals are calculated in real-time
- Settings apply globally to all estimates
- Ready for PDF generation next phase

**Test it out and let me know what you think!** 🚀
