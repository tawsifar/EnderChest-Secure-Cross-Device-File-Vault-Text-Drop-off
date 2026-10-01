const fs = require('fs');
async function test() {
  const token = 'eyJyb29tSWQiOiJhMWNkNGE0Ni03OGM2LTQzNDMtODg5Zi0xOTUzNjM4YTMyMzEiLCJjcmVhdGVkQXQiOjE3ODc0NzI3MTk4MDgsIm5vbmNlIjoiYzY4MzcyNmZjNDZkOWE1OWU3MGQyNjNiYTNmM2IyMmYifQ.sIPBo2amGpgdZ3XQUHlf_RXDXMhU6QIv40lMW07A3Go';
  
  const initRes = await fetch('http://localhost:3000/api/drive/upload-init', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName: 'test.txt',
      fileSize: 12,
      mimeType: 'text/plain'
    })
  });
  
  const initData = await initRes.json();
  console.log('Init:', initData);
  
  if (!initData.uploadUrl) return;
  
  const uploadRes = await fetch(initData.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/plain',
      'Content-Length': '12'
    },
    body: 'Hello World!'
  });
  
  const gdriveData = await uploadRes.json();
  console.log('Upload:', gdriveData);
  
  const finishRes = await fetch('http://localhost:3000/api/drive/upload-finish', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName: 'test.txt',
      fileSize: 12,
      mimeType: 'text/plain',
      driveFileId: gdriveData.id,
      webViewLink: gdriveData.webViewLink,
      webContentLink: gdriveData.webContentLink
    })
  });
  
  const finishData = await finishRes.json();
  console.log('Finish:', finishData);
}
test();
