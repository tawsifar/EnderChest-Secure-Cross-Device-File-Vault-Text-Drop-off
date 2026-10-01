import https from 'https';
import fs from 'fs';

function downloadWithRedirect(url: string, token: string, depth = 0) {
  if (depth > 5) return;
  const parsed = new URL(url);
  const options = {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: {
      'Accept-Encoding': 'identity'
    } as any
  };
  
  if (depth === 0) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  const req = https.request(options, (res) => {
    console.log(`Status at depth ${depth}:`, res.statusCode);
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      downloadWithRedirect(res.headers.location, token, depth + 1);
      return;
    }
    
    console.log('Headers:', res.headers);
    res.pipe(fs.createWriteStream(`out-manual-${depth}.pdf`));
  });
  req.end();
}
// I won't run this without a token, just sketching the logic.
