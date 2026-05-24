#!/bin/bash

# Load environment variables from .env.local
export $(grep -v '^#' .env.local | xargs)

# Run the import script
npx tsx scripts/import-to-supabase.ts
