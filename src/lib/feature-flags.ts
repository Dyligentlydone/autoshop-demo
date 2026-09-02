/**
 * Feature Flags for Demo Auto Shop
 * 
 * USE_SUPABASE_CRM: Defaults to true (Supabase). Set to 'false' to use Zoho CRM.
 * 
 * To rollback to Zoho CRM:
 * 1. Set environment variable: USE_SUPABASE_CRM=false
 * 2. Restart the application
 * 
 * Default behavior: Uses Supabase CRM (no environment variable needed)
 */

// Default to Supabase CRM (set to 'false' to use Zoho)
export const USE_SUPABASE_CRM = process.env.USE_SUPABASE_CRM !== 'false';

// Log the current CRM mode on startup
if (typeof window === 'undefined') {
  console.log(`🔧 CRM Mode: ${USE_SUPABASE_CRM ? 'SUPABASE' : 'ZOHO'}`);
}
