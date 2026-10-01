import { google } from 'googleapis';

async function test() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.MASTER_GOOGLE_DRIVE_REFRESH_TOKEN });
  const drive = google.drive({ version: 'v3', auth });

  try {
    const driveRes = await drive.files.get(
      { 
        fileId: '17g-LJwf8WIL3tRLyUMWWebU_3Sk2QsNw', 
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
      if (bytes > 500) break;
    }
    const str = Buffer.concat(chunks).toString('utf-8');
    console.log(str.substring(0, 300));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}
test();
