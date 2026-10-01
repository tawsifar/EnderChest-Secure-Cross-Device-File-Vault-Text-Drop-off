import { createClient } from '@supabase/supabase-js';
import https from 'https';
import fs from 'fs';

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data: file } = await supabase.from('room_files').select('*').eq('id', 'acd5b70d-6232-4bff-8d65-b56a8555205c').single();
  const { data: driveConnection } = await supabase.from('drive_connections').select('*').eq('room_id', file.room_id).single();
  
  // We mock the DB token fetch - just manually getting a valid token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
     method: 'POST',
     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
     body: new URLSearchParams({
       client_id: process.env.GOOGLE_CLIENT_ID!,
       client_secret: process.env.GOOGLE_CLIENT_SECRET!,
       refresh_token: driveConnection.refresh_token,
       grant_type: 'refresh_token',
     }),
  });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  
  const options = {
    hostname: 'www.googleapis.com',
    path: `/drive/v3/files/${file.drive_file_id}?alt=media&acknowledgeAbuse=true&supportsAllDrives=true`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept-Encoding': 'identity'
    }
  };
  
  const req = https.request(options, (res) => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', res.headers);
    
    let downloaded = 0;
    res.on('data', (chunk) => {
      downloaded += chunk.length;
    });
    res.on('end', () => {
      console.log('Total Downloaded:', downloaded, 'Expected:', file.file_size);
    });
  });
  
  req.on('error', (e) => {
    console.error(e);
  });
  req.end();
}
test();
