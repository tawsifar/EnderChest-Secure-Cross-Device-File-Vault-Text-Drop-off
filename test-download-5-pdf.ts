import { createClient } from '@supabase/supabase-js';
import { createSessionToken } from './server/security.ts';
import fs from 'fs';

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('room_files').select('*').eq('id', 'acd5b70d-6232-4bff-8d65-b56a8555205c').single();
  
  const realToken = createSessionToken(data.room_id);
  const dlUrl = `http://localhost:3000/api/drive/download/${data.id}?token=${realToken}`;
  console.log("Fetching URL:", dlUrl);
  
  const res = await fetch(dlUrl);
  console.log('Status:', res.status, res.headers.get('content-type'), res.headers.get('content-length'));
  
  let bytes = 0;
  let chunks = [];
  // @ts-ignore
  for await (const chunk of res.body) {
    if (bytes === 0) chunks.push(chunk);
    bytes += chunk.length;
    if (bytes > 15000) break;
  }
  const str = Buffer.concat(chunks).toString('utf-8');
  console.log('Total bytes received in this snippet:', bytes);
  if (str.includes('<html')) {
     console.log('HTML detected!');
     console.log(str.substring(0, 500));
  } else {
     console.log('Snippet:', Buffer.concat(chunks).toString('hex').substring(0, 50));
  }
}
test();
