const { google } = require('googleapis');
async function test() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.MASTER_GOOGLE_DRIVE_REFRESH_TOKEN });
  
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    const res = await drive.files.get({ fileId: '1cFDiZXa-5VRK5jHimFM2s0Yab7qgu_g2', fields: 'size, name' });
    console.log(res.data);
  } catch(e) { console.log(e.message); }
}
test();
