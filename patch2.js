const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the redirect fetch to NOT include the authorization header if it's already in the URL or if it's googleusercontent
code = code.replace(
  "headers: { Authorization: `Bearer ${accessToken}` },",
  "headers: targetUrl.includes('googleusercontent.com') ? {} : { Authorization: `Bearer ${accessToken}` },"
);
// wait, I have two of these in the file. I will just replace all instances!

// Let's check how many instances exist.
