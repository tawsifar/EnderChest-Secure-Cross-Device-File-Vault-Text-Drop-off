const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const targetStart = "  app.post('/api/drive/upload', requireRoomAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {";
const targetEnd = "  app.get('/api/drive/list', requireRoomAuth, async (req: AuthenticatedRequest, res: Response) => {";

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find boundaries");
  process.exit(1);
}

const replacement = `
  // 1. Initialize resumable upload directly to Google Drive
  app.post('/api/drive/upload-init', requireRoomAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roomId = req.roomId!;
      const { fileName, fileSize, mimeType } = req.body;

      if (!fileName || !fileSize) {
        res.status(400).json({ error: 'File name and size are required.' });
        return;
      }

      let driveConnection = await db.getDriveConnection(roomId);
      if (!driveConnection) {
        res.status(400).json({ error: 'Secure Storage must be configured by an administrator before uploading files.' });
        return;
      }

      const accessToken = await getValidDriveAccessToken(driveConnection);

      const metadata = {
        name: fileName,
        parents: [driveConnection.drive_folder_id || 'root']
      };

      const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink,webContentLink', {
        method: 'POST',
        headers: {
          Authorization: \`Bearer \${accessToken}\`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType || 'application/octet-stream',
          'X-Upload-Content-Length': fileSize.toString()
        },
        body: JSON.stringify(metadata)
      });

      if (!initRes.ok) {
        const errData = await initRes.json().catch(() => ({}));
        console.error('[Google Drive Upload Init Error]:', errData);
        throw new Error(errData.error?.message || 'Failed to initiate Secure Storage upload');
      }

      const uploadUrl = initRes.headers.get('Location');
      if (!uploadUrl) {
        throw new Error('No upload URL returned from Secure Storage');
      }

      res.json({ uploadUrl });
    } catch (err: any) {
      console.error('[API /drive/upload-init error]:', err);
      res.status(500).json({ error: err.message || 'Failed to initialize upload.' });
    }
  });

  // 2. Finalize upload after client uploads directly to Google Drive
  app.post('/api/drive/upload-finish', requireRoomAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roomId = req.roomId!;
      const { fileName, fileSize, mimeType, driveFileId, webViewLink, webContentLink } = req.body;

      if (!fileName || !driveFileId) {
        res.status(400).json({ error: 'Missing required file data.' });
        return;
      }

      let driveConnection = await db.getDriveConnection(roomId);
      if (!driveConnection) {
        throw new Error('Secure Storage connection lost.');
      }

      const accessToken = await getValidDriveAccessToken(driveConnection);

      // Ensure file has public reader permissions so cross-device download links always succeed
      try {
        await fetch(\`https://www.googleapis.com/drive/v3/files/\${driveFileId}/permissions\`, {
          method: 'POST',
          headers: {
            Authorization: \`Bearer \${accessToken}\`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            role: 'reader',
            type: 'anyone'
          })
        });
      } catch (permErr) {
        console.warn('[Drive Permission Warning]:', permErr);
      }

      const savedFile = await db.addRoomFile({
        room_id: roomId,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        drive_file_id: driveFileId,
        download_url: webContentLink || webViewLink || '',
      });

      res.json({
        success: true,
        file: {
          id: savedFile.id,
          name: savedFile.file_name,
          size: savedFile.file_size,
          mimeType: savedFile.mime_type,
          driveFileId: savedFile.drive_file_id,
          downloadUrl: \`/api/drive/download/\${savedFile.id}\`,
          createdAt: savedFile.created_at,
        },
      });
    } catch (err: any) {
      console.error('[API /drive/upload-finish error]:', err);
      res.status(500).json({ error: err.message || 'Failed to finalize upload.' });
    }
  });

`;

const newContent = content.substring(0, startIndex) + replacement.trim() + "\n\n  " + content.substring(endIndex);
fs.writeFileSync('server.ts', newContent, 'utf8');
console.log("Successfully patched server.ts");
