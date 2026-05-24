# 📅 Appointment Scheduling Feature - Implementation Guide

## Overview
This feature adds a visual calendar to the main page that syncs with Zoho CRM repair orders' `estimated_completion` field. Appointments are stored in Supabase for real-time updates and fast querying.

---

## 🗄️ Database Setup

### Step 1: Run the SQL Migration
Open your Supabase SQL Editor and run:
```bash
supabase-appointments-schema.sql
```

This creates:
- `appointments` table with all necessary fields
- Indexes for performance
- Auto-updating `updated_at` trigger
- Row Level Security policies

---

## 🔄 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Updates RO                          │
│          (sets estimated_completion in web app)             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Zoho CRM Repair Order                          │
│         estimated_completion: "2026-03-25T14:00:00Z"        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Sync API (manual or automated)                    │
│       POST /api/appointments/sync-from-zoho                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Appointments Table                    │
│    - repair_order_id (Zoho ID)                              │
│    - scheduled_datetime (from estimated_completion)         │
│    - customer_name, vehicle_display, service_type           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Calendar UI (Main Page)                        │
│         Real-time display with auto-refresh                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Features Implemented

### 1. **Calendar UI Component** (`/components/appointment-calendar.tsx`)
- ✅ Month view with previous/next navigation
- ✅ "Today" button to jump to current date
- ✅ Color-coded appointment badges
- ✅ Click day to see all appointments
- ✅ Click appointment to open repair order
- ✅ Shows appointment count per day
- ✅ Status indicators (scheduled, in_progress, completed, cancelled)

### 2. **API Endpoints**
- ✅ `GET /api/appointments` - List appointments (with date range filter)
- ✅ `POST /api/appointments` - Create appointment
- ✅ `PATCH /api/appointments/[id]` - Update appointment
- ✅ `DELETE /api/appointments/[id]` - Delete appointment
- ✅ `POST /api/appointments/sync-from-zoho` - Sync from Zoho repair orders

### 3. **React Hooks** (`/hooks/use-appointments.ts`)
- ✅ `useAppointments(options)` - Fetch appointments with date range
- ✅ `useCreateAppointment()` - Create new appointment
- ✅ `useUpdateAppointment()` - Update existing appointment
- ✅ `useDeleteAppointment()` - Delete appointment
- ✅ Auto-refresh every 30 seconds
- ✅ React Query caching and invalidation

---

## 🚀 How to Use

### Initial Setup

1. **Run the SQL migration** in Supabase:
   ```sql
   -- Copy contents of supabase-appointments-schema.sql
   ```

2. **Sync existing repair orders** (one-time):
   ```bash
   curl -X POST http://localhost:3000/api/appointments/sync-from-zoho
   ```

3. **View the calendar** on the main page:
   ```
   http://localhost:3000
   ```

### Daily Workflow

1. **Create/Update Repair Order** with `estimated_completion` date
2. **Sync to calendar** (manual or automated):
   - Manual: Call sync API endpoint
   - Automated: Add cron job or webhook (future enhancement)
3. **View appointments** on main page calendar
4. **Click appointment** to open repair order details

---

## 🔧 Next Steps (Optional Enhancements)

### Phase 2: Bi-directional Sync
- When appointment is updated → update Zoho `estimated_completion`
- When Zoho `estimated_completion` changes → update appointment
- Webhook from Zoho to trigger real-time sync

### Phase 3: Advanced Features
- Drag-and-drop to reschedule appointments
- Week/day view toggle
- Appointment conflicts detection
- SMS reminders for upcoming appointments
- Customer-facing appointment booking

### Phase 4: Real-time Updates
- Supabase real-time subscriptions
- Live calendar updates when other staff make changes
- Notification badges for new/changed appointments

---

## 📊 Database Schema

```sql
appointments (
  id UUID PRIMARY KEY,
  repair_order_id TEXT UNIQUE,      -- Links to Zoho repair order
  customer_name TEXT,
  customer_phone TEXT,
  vehicle_display TEXT,             -- "2006 Audi A3"
  service_type TEXT,                -- "diagnostic", "oil change", etc.
  scheduled_datetime TIMESTAMPTZ,   -- When the appointment is scheduled
  duration_minutes INTEGER,         -- Default 60 minutes
  status TEXT,                      -- scheduled, in_progress, completed, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

---

## 🎯 Key Benefits

1. **Visual Overview** - See all appointments at a glance
2. **Fast Performance** - Supabase queries are instant (no Zoho API rate limits)
3. **Real-time Ready** - Built for Supabase subscriptions (future)
4. **Flexible** - Easy to add custom fields without modifying Zoho
5. **Synced** - Always reflects Zoho `estimated_completion` field

---

## 🐛 Troubleshooting

### Calendar shows "Loading appointments..."
- Check Supabase connection in `.env.local`
- Verify `appointments` table exists
- Check browser console for errors

### Appointments not syncing from Zoho
- Run sync endpoint manually: `POST /api/appointments/sync-from-zoho`
- Check that repair orders have `estimated_completion` set
- Verify Zoho API credentials

### TypeScript errors
- Run `npm install` to ensure all dependencies are installed
- Check that `@supabase/supabase-js` is up to date

---

## 📝 Files Created/Modified

### New Files:
- `src/app/api/appointments/route.ts`
- `src/app/api/appointments/[id]/route.ts`
- `src/app/api/appointments/sync-from-zoho/route.ts`
- `src/hooks/use-appointments.ts`
- `src/components/appointment-calendar.tsx`
- `supabase-appointments-schema.sql`

### Modified Files:
- `src/app/page.tsx` - Added calendar component
- `src/lib/api-client.ts` - Added delete method

---

## 🎉 You're All Set!

The appointment scheduling feature is now live on your localhost. Visit **http://localhost:3000** to see the calendar in action!
