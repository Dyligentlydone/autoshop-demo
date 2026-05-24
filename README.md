# AutoShop Demo

A demo auto repair shop CRM application duplicated from ACME TIRE.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **SMS**: Twilio Integration
- **AI**: Voiceflow Agent Integration

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:
- `VOICEFLOW_AGENT_KEY`
- `OWNER_APP_PIN`
- `AUTH_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Features

- Customer Management (CRM)
- Appointment Scheduling
- Estimate Calculator with PDF Generation
- SMS Integration for Customer Communication
- AI-Powered Phone Assistant
- Quote Management
- Settings & Configuration

## Database

Uses Supabase with the following schemas:
- CRM (customers, vehicles)
- Appointments
- Estimates & Line Items
- SMS Logs
- Call Logs

SQL schema files are included in the root directory.
