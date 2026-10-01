fetch('http://localhost:3000/api/room/enter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'test_upload' })
}).then(r => r.json()).then(console.log);
