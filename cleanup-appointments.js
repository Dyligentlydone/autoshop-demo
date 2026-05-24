const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupOrphanedAppointments() {
  console.log('Cleaning up orphaned appointments...');
  
  // Delete appointments for the specific repair order
  const { error: deleteError } = await supabase
    .from('appointments')
    .delete()
    .eq('repair_order_id', 'dc7e9540-230a-4438-9e8b-360eb53bd0f5');

  if (deleteError) {
    console.error('Error deleting appointments:', deleteError);
    process.exit(1);
  }

  console.log('✓ Deleted appointments for repair order dc7e9540-230a-4438-9e8b-360eb53bd0f5');

  // Also clean up any other orphaned appointments (where repair order doesn't exist)
  const { data: allAppointments } = await supabase
    .from('appointments')
    .select('id, repair_order_id');

  if (allAppointments && allAppointments.length > 0) {
    console.log(`\nChecking ${allAppointments.length} appointments for orphans...`);
    
    const repairOrderIds = [...new Set(allAppointments.map(a => a.repair_order_id))];
    
    const { data: existingROs } = await supabase
      .from('repair_orders')
      .select('id')
      .in('id', repairOrderIds);

    const existingIds = new Set(existingROs?.map(ro => ro.id) || []);
    const orphanedAppointments = allAppointments.filter(a => !existingIds.has(a.repair_order_id));

    if (orphanedAppointments.length > 0) {
      console.log(`Found ${orphanedAppointments.length} orphaned appointments. Deleting...`);
      
      const orphanedIds = orphanedAppointments.map(a => a.id);
      const { error: cleanupError } = await supabase
        .from('appointments')
        .delete()
        .in('id', orphanedIds);

      if (cleanupError) {
        console.error('Error cleaning up orphaned appointments:', cleanupError);
      } else {
        console.log(`✓ Cleaned up ${orphanedAppointments.length} orphaned appointments`);
      }
    } else {
      console.log('✓ No orphaned appointments found');
    }
  }

  console.log('\nCleanup complete!');
}

cleanupOrphanedAppointments().catch(console.error);
