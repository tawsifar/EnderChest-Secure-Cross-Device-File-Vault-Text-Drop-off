import { createClient } from '@supabase/supabase-js';
import { createSessionToken } from './server/security.ts';
import { db } from './server/db.ts';

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('room_files').select('*').eq('id', 'acd5b70d-6232-4bff-8d65-b56a8555205c').single();
  const driveConnection = await db.getDriveConnection(data.room_id);
  
  // Need to get access token, just mocking for now since I can't easily call getValidDriveAccessToken outside
}
test();
