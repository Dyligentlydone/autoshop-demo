#!/bin/bash

# Load environment variables from .env.local
export $(grep -v '^#' .env.local | xargs)

# Run the attachment migration script
npx tsx scripts/migrate-attachments.ts
