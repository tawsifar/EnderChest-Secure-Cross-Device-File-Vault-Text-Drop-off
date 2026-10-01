import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('room_files').select('*').eq('id', 'acd5b70d-6232-4bff-8d65-b56a8555205c').single();

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.MASTER_GOOGLE_DRIVE_REFRESH_TOKEN });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const res = await drive.files.get({ fileId: data.drive_file_id, fields: 'size, name' });
    console.log("Drive API reported size:", res.data.size, "bytes for", res.data.name);
  } catch(e) {
    console.error(e);
  }
}
test();
