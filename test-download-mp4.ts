import { createClient } from '@supabase/supabase-js';
import { createSessionToken } from './server/security.ts';
import fs from 'fs';

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('room_files').select('*').eq('id', 'cc91e4f1-f92f-4a57-8f58-d12c65c31d9a').single();
  
  const realToken = createSessionToken(data.room_id);
  const dlUrl = `http://localhost:3000/api/drive/download/${data.id}?token=${realToken}`;
  console.log("Fetching URL:", dlUrl);
  
  const res = await fetch(dlUrl);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync('test.mp4', Buffer.from(buffer));
  console.log('Saved test.mp4, size:', buffer.byteLength);
}
test();
