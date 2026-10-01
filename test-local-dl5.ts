import { createClient } from '@supabase/supabase-js';
import { createSessionToken } from './server/security.ts';
import fs from 'fs';

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('room_files').select('*').eq('id', '19a43b3a-c111-4830-b97a-7edd65ddb55c').single();
  
  const realToken = createSessionToken(data.room_id);
  const dlUrl = `http://localhost:3000/api/drive/download/${data.id}?token=${realToken}`;
  const res = await fetch(dlUrl);
  
  let chunks = [];
  let bytes = 0;
  // @ts-ignore
  for await (const chunk of res.body) {
    if (bytes === 0) chunks.push(chunk);
    bytes += chunk.length;
    if (bytes > 15000) break;
  }
  const str = Buffer.concat(chunks).toString('utf-8');
  if (str.includes('<html')) console.log('HTML detected!');
  else console.log('Snippet:', str.substring(0, 50));
}
test();
