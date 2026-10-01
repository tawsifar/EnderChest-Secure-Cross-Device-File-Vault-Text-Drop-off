import { createClient } from '@supabase/supabase-js';
import { createSessionToken } from './server/security.ts';
async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Set password
  await supabase.from('rooms').update({ password_hash: 'somehash' }).eq('id', '03df4af6-6775-46a4-97fc-cd90a16b91d8');
  
  // Fetch file
  const { data } = await supabase.from('room_files').select('*').eq('id', 'acd5b70d-6232-4bff-8d65-b56a8555205c').single();
  const realToken = createSessionToken(data.room_id);
  const dlUrl = `http://localhost:3000/api/drive/download/${data.id}?token=${realToken}`;
  const res = await fetch(dlUrl);
  console.log('Status with lock:', res.status);
  const text = await res.text();
  console.log('Body length:', text.length, 'Body snippet:', text.substring(0, 100));
  
  // Remove password
  await supabase.from('rooms').update({ password_hash: null }).eq('id', '03df4af6-6775-46a4-97fc-cd90a16b91d8');
}
test();
