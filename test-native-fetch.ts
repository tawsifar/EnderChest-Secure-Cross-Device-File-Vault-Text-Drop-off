import { createClient } from '@supabase/supabase-js';
import { createSessionToken } from './server/security.ts';

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('room_files').select('*').eq('id', 'acd5b70d-6232-4bff-8d65-b56a8555205c').single();
  
  const realToken = createSessionToken(data.room_id);
  console.log(`curl -I "http://localhost:3000/api/drive/download/${data.id}?token=${realToken}"`);
}
test();
