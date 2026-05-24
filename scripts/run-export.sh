#!/bin/bash

# Load environment variables from .env.local
export $(grep -v '^#' .env.local | xargs)

# Run the export script
npx tsx scripts/export-zoho-data.ts
