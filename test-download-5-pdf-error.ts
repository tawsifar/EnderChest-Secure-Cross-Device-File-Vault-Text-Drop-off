import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('room_files').select('*').eq('id', '5d761d27-7a69-4c64-97a2-31ddc5f22af8').single();
  
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
    console.log("Success streaming.");
  } catch (err: any) {
    console.error('Error fetching from Drive directly:', err.message, err.response?.status, err.response?.data);
  }
}
test();
