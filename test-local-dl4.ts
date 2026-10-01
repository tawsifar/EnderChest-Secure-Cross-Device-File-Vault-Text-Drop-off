import { createClient } from '@supabase/supabase-js';
import { createSessionToken } from './server/security.ts';
import fs from 'fs';

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('room_files').select('*').eq('file_name', 'large.txt').order('created_at', { ascending: false }).limit(1).single();
  
  const realToken = createSessionToken(data.room_id);
  const dlUrl = `http://localhost:3000/api/drive/download/${data.id}?token=${realToken}`;
  console.log("URL:", dlUrl);
}
test();
