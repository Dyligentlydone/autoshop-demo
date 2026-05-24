# SMS Integration Setup Guide

## Overview
The SMS integration allows techs to send repair order estimates to customers via text message, including photos, pricing, and completion dates. It also provides a Communications section to view all SMS conversations.

## Features Implemented

### ✅ Send Estimate from Repair Orders
- Click "📱 Send Estimate" button on any repair order detail page
- Preview and edit the message before sending
- Automatically includes:
  - Customer name
  - Service type
  - Estimated total
  - Estimated completion date
  - Attached photos (up to 10 via MMS)
- Edit message text before sending
- Toggle photo attachments on/off

### ✅ Communications Section
- View all SMS conversations grouped by customer
- See message history for each customer
- Unread message indicators
- Link to customer profiles
- Message timestamps

### ✅ Database Integration
- All SMS messages saved to Supabase
- Linked to repair orders and customers
- Track message status and direction (inbound/outbound)
- Template system for common messages

## Setup Instructions

### Step 1: Get Twilio Credentials

1. **Sign up for Twilio** (if you don't have an account)
   - Go to https://www.twilio.com/try-twilio
   - Create a free trial account
   - You'll get $15 in trial credit

2. **Get a Phone Number**
   - In Twilio Console, go to Phone Numbers → Buy a Number
   - Select a number with SMS capabilities
   - Note: Trial accounts can only send to verified numbers

3. **Get Your Credentials**
   - Go to Twilio Console Dashboard
   - Copy your **Account SID**
   - Copy your **Auth Token** (click "Show" to reveal it)
   - Copy your **Phone Number** (format: +1234567890)

### Step 2: Add Credentials to .env.local

Add these three lines to your `.env.local` file:

```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

**Important:** Restart your dev server after adding credentials!

### Step 3: Run Database Migration

1. **Open Supabase SQL Editor**
   - Go to your Supabase project
   - Click "SQL Editor" in the left sidebar

2. **Run the Migration**
   - Open the file `supabase-sms-schema.sql` in this project
   - Copy all the SQL code
   - Paste it into the Supabase SQL Editor
   - Click "Run" to execute

3. **Verify Tables Created**
   - Go to "Table Editor" in Supabase
   - You should see two new tables:
     - `sms_messages` - stores all SMS messages
     - `sms_templates` - stores message templates

### Step 4: Test SMS Sending

1. **Navigate to a Repair Order**
   - Go to http://localhost:3000/repair-orders
   - Click on any repair order

2. **Send a Test Estimate**
   - Click the "📱 Send Estimate" button
   - Verify the preview looks correct
   - Edit the message if needed
   - Toggle photos on/off
   - Enter your phone number (must be verified in Twilio trial)
   - Click "Send Estimate"

3. **Check Results**
   - You should receive the SMS within seconds
   - Check the Communications page to see the sent message
   - Verify the message was saved to the database

## Twilio Trial Account Limitations

⚠️ **Important Trial Restrictions:**
- Can only send SMS to **verified phone numbers**
- To verify a number: Twilio Console → Phone Numbers → Verified Caller IDs
- All messages include trial account disclaimer
- $15 credit limit

To remove restrictions, upgrade to a paid Twilio account.

## Message Format

Example estimate message:
```
Hi John Doe!

Your tires estimate is ready:

💰 Estimated Total: $450.00
📅 Est. Completion: Thu, Apr 10, 2:00 PM

📸 3 photo(s) attached

Questions? Reply to this message or call us!

- ACME TIRE
```

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── sms/
│   │       ├── send/route.ts              # Send SMS endpoint
│   │       └── conversations/route.ts     # Get conversations
│   └── communications/
│       └── page.tsx                       # Communications UI
├── components/
│   └── SendEstimateModal.tsx              # Send estimate modal
├── hooks/
│   ├── use-send-sms.ts                    # Send SMS hook
│   └── use-sms-conversations.ts           # Fetch conversations hook
└── lib/
    └── twilio.ts                          # Twilio helper functions

supabase-sms-schema.sql                    # Database migration
```

## API Endpoints

### POST /api/sms/send
Send an SMS message (estimate or custom)

**Request:**
```json
{
  "type": "estimate",
  "to": "+1234567890",
  "repairOrderId": "uuid",
  "customerId": "uuid",
  "estimateData": {
    "customerName": "John Doe",
    "serviceType": "tires",
    "estimatedTotal": 450.00,
    "estimatedCompletion": "2026-04-10T14:00:00Z",
    "photoUrls": ["https://..."]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sid": "SM...",
    "status": "queued",
    "to": "+1234567890"
  }
}
```

### GET /api/sms/conversations
Get all SMS conversations or for a specific customer

**Query Parameters:**
- `customerId` (optional): Filter by customer ID

**Response:**
```json
{
  "data": [
    {
      "customer": { "id": "...", "first_name": "John", ... },
      "messages": [...],
      "lastMessage": {...},
      "unreadCount": 2
    }
  ]
}
```

## Troubleshooting

### SMS Not Sending
1. Check Twilio credentials in `.env.local`
2. Verify phone number is in E.164 format (+1234567890)
3. For trial accounts, verify recipient number in Twilio Console
4. Check server logs for error messages

### Database Errors
1. Verify `sms_messages` table exists in Supabase
2. Check Supabase connection in `.env.local`
3. Run the migration SQL again if needed

### Photos Not Attaching
1. Verify photo URLs are publicly accessible
2. Twilio supports max 10 media attachments per MMS
3. Check file size limits (max 5MB per image)

## Next Steps

### Incoming SMS (Future Enhancement)
To receive SMS replies from customers:
1. Set up Twilio webhook URL
2. Create `/api/sms/webhook` endpoint
3. Configure webhook in Twilio Console
4. Handle incoming messages and save to database

### Templates (Future Enhancement)
- Create custom message templates
- Quick reply buttons
- Automated follow-ups

## Support

For Twilio issues: https://www.twilio.com/docs/sms
For Supabase issues: https://supabase.com/docs
