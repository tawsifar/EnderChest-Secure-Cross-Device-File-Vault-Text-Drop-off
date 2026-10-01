import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('room_files').select('*').eq('id', '19a43b3a-c111-4830-b97a-7edd65ddb55c').single();
  
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.MASTER_GOOGLE_DRIVE_REFRESH_TOKEN });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const driveRes = await drive.files.get(
      { 
        fileId: data.drive_file_id, 
        alt: 'media', 
        acknowledgeAbuse: true, 
        supportsAllDrives: true 
      },
      { responseType: 'stream' }
    );
    
    let bytes = 0;
    let chunks = [];
    for await (const chunk of driveRes.data) {
      chunks.push(chunk);
      bytes += chunk.length;
      if (bytes > 15000) break;
    }
    const str = Buffer.concat(chunks).toString('utf-8');
    if (str.includes('<html')) {
        console.log('HTML DETECTED!');
        console.log(str.substring(0, 500));
    } else {
        console.log('Binary detected.');
        console.log(str.substring(0, 50));
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}
test();
