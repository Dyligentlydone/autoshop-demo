#!/bin/bash

# Load environment variables from .env.local
export $(grep -v '^#' .env.local | xargs)

# Run the verify script
npx tsx scripts/verify-import.ts
