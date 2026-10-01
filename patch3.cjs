const fs = require('fs');

const code = `
      // 1. Stream from Google Drive using manual fetch to bypass the 100MB HTML warning page
      let driveConnection = await db.getDriveConnection(req.roomId);
      if (driveConnection && file.drive_file_id) {
        let accessToken = await getValidDriveAccessToken(driveConnection);

        let targetUrl = \`https://www.googleapis.com/drive/v3/files/\${file.drive_file_id}?alt=media&acknowledgeAbuse=true&supportsAllDrives=true\`;
        
        let driveRes = await fetch(targetUrl, {
          headers: { Authorization: \`Bearer \${accessToken}\` },
          redirect: 'manual'
        });

        // Handle redirects manually. Node fetch drops Authorization headers on cross-origin redirects.
        // MORE IMPORTANTLY: Google Drive's redirect URL for large files often drops the virus bypass flags,
        // causing the final server to return a 10kb HTML warning page instead of the binary file.
        let redirectCount = 0;
        while (driveRes.status >= 300 && driveRes.status < 400 && driveRes.headers.get('location') && redirectCount < 5) {
          targetUrl = driveRes.headers.get('location');
          
          // CRITICAL: Re-append bypass flags to the redirect URL so the download server doesn't serve the HTML warning!
          if (!targetUrl.includes('acknowledgeAbuse')) {
            targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'acknowledgeAbuse=true';
          }
          if (!targetUrl.includes('confirm=')) {
            targetUrl += '&confirm=t';
          }

          // Fetch the redirect URL. We omit the Authorization header for googleusercontent.com because
          // the URL already contains a short-lived download token ('e=download&uuid=...'), and passing 
          // a Bearer token to the content server can sometimes cause 401/403 conflicts.
          const headers = targetUrl.includes('googleusercontent.com') ? {} : { Authorization: \`Bearer \${accessToken}\` };

          driveRes = await fetch(targetUrl, {
            headers,
            redirect: 'manual'
          });
          redirectCount++;
        }

        // If 401 Unauthorized on googleapis, force refresh token and retry
        if (driveRes.status === 401 && driveConnection.refresh_token && targetUrl.includes('googleapis.com')) {
          console.warn('[Drive Download]: 401 Unauthorized, refreshing token and retrying...');
          driveConnection.token_expiry = new Date(0).toISOString();
          accessToken = await getValidDriveAccessToken(driveConnection);
          
          targetUrl = \`https://www.googleapis.com/drive/v3/files/\${file.drive_file_id}?alt=media&acknowledgeAbuse=true&supportsAllDrives=true\`;
          driveRes = await fetch(targetUrl, {
            headers: { Authorization: \`Bearer \${accessToken}\` },
            redirect: 'manual'
          });
          
          redirectCount = 0;
          while (driveRes.status >= 300 && driveRes.status < 400 && driveRes.headers.get('location') && redirectCount < 5) {
            targetUrl = driveRes.headers.get('location');
            if (!targetUrl.includes('acknowledgeAbuse')) targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'acknowledgeAbuse=true';
            if (!targetUrl.includes('confirm=')) targetUrl += '&confirm=t';
            
            const headers = targetUrl.includes('googleusercontent.com') ? {} : { Authorization: \`Bearer \${accessToken}\` };
            driveRes = await fetch(targetUrl, { headers, redirect: 'manual' });
            redirectCount++;
          }
        }

        if (driveRes.ok) {
          res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
          res.setHeader('Content-Disposition', \`attachment; filename="\${encodeURIComponent(file.file_name)}"\`);
          
          const contentLength = driveRes.headers.get('content-length');
          if (contentLength) {
             res.setHeader('Content-Length', contentLength);
          }

          if (driveRes.body) {
             const { Readable } = await import('stream');
             // @ts-ignore
             Readable.fromWeb(driveRes.body).pipe(res);
             return;
          }
        } else {
          const errorBody = await driveRes.text();
          console.error(\`[Drive Media Download Failed \${driveRes.status}]:\`, errorBody);
        }
      }
`;

// Now replace the block in server.ts
let content = fs.readFileSync('server.ts', 'utf8');
const startIdx = content.indexOf('// 1. Stream from Google Drive using official googleapis');
const endString = `        }
      }

      // 2. Fallback: Stream from Database chunk storage (if implemented in future)`;
const endIdx = content.indexOf(endString);
if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find block to replace!');
    process.exit(1);
}

const newContent = content.slice(0, startIdx) + code.trim() + '\n      }\n\n      // 2. Fallback: Stream from Database chunk storage (if implemented in future)' + content.slice(endIdx + endString.length);
fs.writeFileSync('server.ts', newContent);
console.log('Replaced successfully');
