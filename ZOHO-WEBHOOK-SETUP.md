# 🔔 Zoho Webhook Setup Guide - Real-time Appointment Sync

## Overview
This webhook enables **real-time** appointment calendar updates whenever a repair order's `estimated_completion` or `status` changes in Zoho CRM.

**Strategic Design:**
- ✅ Only triggers on `Estimated_Completion` or `Status` field changes (not every edit)
- ✅ Single API call per webhook (efficient, won't hit rate limits)
- ✅ Automatic sync - no manual intervention needed
- ✅ Handles deletions (removes appointment if `estimated_completion` is cleared)

---

## 🚀 Setup Instructions

### Step 1: Get Your Webhook URL

Your webhook endpoint is:
```
https://acmetire.up.railway.app/api/webhooks/zoho/repair-order-updated
```

**For localhost testing:**
```
http://localhost:3000/api/webhooks/zoho/repair-order-updated
```

> **Note:** For localhost testing, you'll need a tool like [ngrok](https://ngrok.com/) to expose your local server to the internet.

---

### Step 2: Configure Webhook in Zoho CRM

1. **Go to Zoho CRM Settings**
   - Click the gear icon (⚙️) in the top right
   - Navigate to **Automation** → **Actions** → **Webhooks**

2. **Create New Webhook**
   - Click **+ Configure Webhook**
   - Name: `Repair Order Appointment Sync`
   - Module: `Repair_Orders` (or whatever your module is called)
   - URL to Notify: `https://acmetire.up.railway.app/api/webhooks/zoho/repair-order-updated`
   - Method: `POST`

3. **Configure Trigger Conditions** (IMPORTANT - saves API calls!)
   - Trigger: **On Update**
   - **Field-level tracking:** Enable this!
   - **Watch these fields only:**
     - ✅ `Estimated_Completion`
     - ✅ `Status`
   
   This ensures the webhook only fires when these specific fields change, not on every edit.

4. **Request Format**
   - Format: `JSON`
   - Include: `Record ID` (check this box)

5. **Save the Webhook**

---

### Step 3: Create Workflow Rule to Trigger Webhook

1. **Go to Workflow Rules**
   - Settings → Automation → Workflow Rules
   - Click **+ Create Rule**

2. **Configure Rule**
   - Module: `Repair_Orders`
   - Rule Name: `Sync Appointment on Estimated Completion Change`
   - Description: `Triggers webhook when estimated_completion or status changes`
   - When: **Record Action** → **is edited**

3. **Set Conditions** (CRITICAL for efficiency!)
   ```
   (Estimated_Completion is not empty)
   OR
   (Status is changed)
   ```

4. **Add Action**
   - Action Type: **Webhook**
   - Select the webhook you created: `Repair Order Appointment Sync`

5. **Save and Activate**

---

## 🔧 How It Works

```
User updates RO in Zoho
    ↓
Estimated_Completion or Status changes?
    ↓ YES
Zoho triggers webhook
    ↓
POST /api/webhooks/zoho/repair-order-updated
    ↓
Fetch RO details from Zoho (1 API call)
    ↓
Fetch vehicle + customer (2 API calls)
    ↓
Update Supabase appointment
    ↓
Calendar auto-refreshes (30s or on page load)
```

**Total API calls per update:** 3 (very efficient!)

---

## 📊 Webhook Behavior

| Scenario | Action |
|----------|--------|
| `estimated_completion` is set | Creates/updates appointment |
| `estimated_completion` is changed | Updates appointment datetime |
| `estimated_completion` is cleared | Deletes appointment |
| `status` changes to "Completed" | Updates appointment status to `completed` |
| `status` changes to "In Progress" | Updates appointment status to `in_progress` |
| `status` changes to "Cancelled" | Updates appointment status to `cancelled` |
| Other fields change (e.g., notes) | **No webhook trigger** (saves API calls) |

---

## 🧪 Testing the Webhook

### Test 1: Update Estimated Completion
1. Open a repair order in Zoho
2. Set or change `Estimated_Completion` date
3. Save
4. Check your calendar - appointment should appear/update within 30 seconds

### Test 2: Change Status
1. Open a repair order with `Estimated_Completion` set
2. Change `Status` to "In Progress"
3. Save
4. Check calendar - status badge should change to yellow

### Test 3: Clear Estimated Completion
1. Open a repair order with an appointment
2. Clear the `Estimated_Completion` field
3. Save
4. Check calendar - appointment should disappear

---

## 🐛 Troubleshooting

### Webhook not firing
- Check Zoho webhook logs: Settings → Automation → Webhooks → View logs
- Verify workflow rule is **Active**
- Ensure field-level tracking is enabled for `Estimated_Completion` and `Status`

### Appointment not updating
- Check Railway logs for webhook endpoint
- Verify Supabase connection
- Run manual sync to compare: `POST /api/appointments/sync-from-zoho`

### Too many API calls
- Verify webhook is **only** watching `Estimated_Completion` and `Status` fields
- Check Zoho webhook execution logs to see trigger frequency

---

## 📈 API Usage Estimate

**Without webhook (manual sync every hour):**
- 200 repair orders × 3 API calls = 600 calls/hour
- 14,400 calls/day

**With webhook (field-specific triggers):**
- ~10-20 updates/day × 3 API calls = 30-60 calls/day
- **99.6% reduction in API calls!** 🎉

---

## 🔐 Security (Optional Enhancement)

For production, you can add webhook authentication:

1. **Add secret token to .env.local:**
   ```
   ZOHO_WEBHOOK_SECRET=your-secret-token-here
   ```

2. **Update webhook endpoint to verify token:**
   ```typescript
   const authHeader = req.headers.get('authorization');
   if (authHeader !== `Bearer ${process.env.ZOHO_WEBHOOK_SECRET}`) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   ```

3. **Configure in Zoho webhook:**
   - Add custom header: `Authorization: Bearer your-secret-token-here`

---

## ✅ You're All Set!

Once configured, your calendar will automatically sync in real-time whenever repair orders are updated in Zoho. No more manual syncing needed! 🎉
