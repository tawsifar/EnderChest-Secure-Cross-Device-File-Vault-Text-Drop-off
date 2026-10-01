const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  "headers: { Authorization: `Bearer ${accessToken}` },",
  "headers: { Authorization: `Bearer ${accessToken}` },\n            // DEBUG\n"
);
// I can just edit the file using edit_file!
