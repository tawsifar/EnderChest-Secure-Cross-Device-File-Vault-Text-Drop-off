import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { hashRoomCode, createSessionToken, verifySessionToken } from './server/security.ts';
import { db, SUPABASE_SCHEMA_SQL } from './server/db.ts';

// Configure multer for file uploads (in-memory for buffer handling)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  },
});

interface AuthenticatedRequest extends Request {
  roomId?: string;
}

// Authentication middleware using Room Session Token
function requireRoomAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.query.token as string);

  if (!token) {
    res.status(401).json({ error: 'Missing room session token. Please re-enter room code.' });
    return;
  }

  const verified = verifySessionToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Invalid or expired room session token. Please re-enter room code.' });
    return;
  }

  req.roomId = verified.roomId;
  next();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // =========================================================================
  // API ROUTES
  // =========================================================================

  // Health & DB status
  app.get('/api/health', async (req, res) => {
    res.json({
      status: 'ok',
      db: db.getStatus(),
    });
  });

  app.get('/api/db/schema', (req, res) => {
    res.json({
      schemaSql: SUPABASE_SCHEMA_SQL,
      isConfigured: db.getStatus().isSupabaseConnected,
    });
  });

  app.post('/api/room/enter', async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string' || !code.trim()) {
        res.status(400).json({ error: 'Please enter a valid room code.' });
        return;
      }

      const codeHash = hashRoomCode(code);
      const room = await db.findOrCreateRoomByHash(codeHash);
      const sessionToken = createSessionToken(room.id);
      const driveConnection = await db.getDriveConnection(room.id);
      const files = await db.getRoomFiles(room.id);

      res.json({
        success: true,
        sessionToken,
        room: {
          id: room.id,
          savedText: room.saved_text || '',
          updatedAt: room.updated_at,
          isDriveConnected: !!driveConnection,
          driveAccount: driveConnection
            ? {
                email: 'Secure Storage',
                folderName: 'EnderChest Secure Storage',
                connectedAt: driveConnection.created_at,
              }
            : null,
          files: files.map((f) => ({
            id: f.id,
            name: f.file_name,
            size: f.file_size,
            mimeType: f.mime_type,
            driveFileId: f.drive_file_id,
            downloadUrl: `/api/drive/download/${f.id}`,
            createdAt: f.created_at,
          })),
        },
      });
    } catch (err: any) {
      console.error('[API /room/enter error]:', err);
      res.status(500).json({ error: err.message || 'Failed to enter room.' });
    }
  });

  app.get('/api/room/status', requireRoomAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roomId = req.roomId!;
      const room = await db.getRoomById(roomId);

      if (!room) {
        res.status(404).json({ error: 'Room not found. Please re-enter room code.' });
        return;
      }

      const driveConnection = await db.getDriveConnection(roomId);
      const files = await db.getRoomFiles(roomId);

      res.json({
        success: true,
        room: {
          id: room.id,
          savedText: room.saved_text || '',
          updatedAt: room.updated_at,
          isDriveConnected: !!driveConnection,
          driveAccount: driveConnection
            ? {
                email: 'Secure Storage',
                folderName: 'EnderChest Secure Storage',
                connectedAt: driveConnection.created_at,
              }
            : null,
          files: files.map((f) => ({
            id: f.id,
            name: f.file_name,
            size: f.file_size,
            mimeType: f.mime_type,
            driveFileId: f.drive_file_id,
            downloadUrl: `/api/drive/download/${f.id}`,
            createdAt: f.created_at,
          })),
        },
      });
    } catch (err: any) {
      console.error('[API /room/status error]:', err);
      res.status(500).json({ error: err.message || 'Failed to get room status.' });
    }
  });

  app.post('/api/room/text', requireRoomAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roomId = req.roomId!;
      const { text } = req.body;

      if (typeof text !== 'string') {
        res.status(400).json({ error: 'Invalid text payload.' });
        return;
      }

      const result = await db.updateRoomText(roomId, text);
      res.json({
        success: true,
        savedText: text,
        updatedAt: result.updatedAt,
      });
    } catch (err: any) {
      console.error('[API /room/text error]:', err);
      res.status(500).json({ error: err.message || 'Failed to save room text.' });
    }
  });

  app.get('/api/drive/connect', requireRoomAuth, (req: AuthenticatedRequest, res: Response) => {
    const roomId = req.roomId!;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || ''}/api/drive/callback`;

    if (!clientId) {
      res.json({
        placeholder: true,
        message: 'Google OAuth credentials not configured yet.',
        instructions: 'Provide GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in next step.',
        roomId,
        targetRedirectUri: redirectUri,
      });
      return;
    }

    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file email profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${roomId}`;

    res.redirect(authUrl);
  });

  app.get('/api/drive/callback', async (req: Request, res: Response) => {
    const { code, state: roomId, error } = req.query;

    if (error) {
      res.status(400).send(`Secure Vault authorization failed: ${error}`);
      return;
    }
    if (!code || !roomId) {
      res.status(400).send('Missing authorization code or room state.');
      return;
    }

    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code as string,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/drive/callback`,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange token');
      }

      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`
        }
      });
      const userData = await userResponse.json();

      const isMasterAdmin = roomId === 'master';
      await db.saveDriveConnection({
        room_id: String(roomId),
        google_account_email: userData.email || 'Central 5TB Vault Storage',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || '',
        token_expiry: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        drive_folder_name: 'EnderChest Master Vault',
      });

      res.send(`
        <!DOCTYPE html>
        <html>
          <body style="font-family: system-ui, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#0b0f17; color:#f1f5f9;">
            <div style="background:#131a26; border:2px solid #2e3b52; padding:2rem; border-radius:12px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.5); text-align:center; max-width:400px;">
              <h2 style="color:#2dd4bf; margin-top:0;">5TB Central Vault Connected</h2>
              <p style="color:#94a3b8; font-size:14px;">The central backend storage is now active for all rooms.</p>
              <p style="color:#64748b; font-size:12px; margin-top: 10px;">Users can now drop off and retrieve files automatically without needing to connect individual accounts.</p>
              <script>
                setTimeout(() => {
                  window.location.href = '/';
                }, 2000);
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error('[API /drive/callback error]:', err);
      res.status(500).send('Failed to process Secure Vault connection callback: ' + err.message);
    }
  });

  app.post('/api/drive/disconnect', requireRoomAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roomId = req.roomId!;
      await db.deleteDriveConnection(roomId);
      res.json({ success: true, message: 'Secure Storage disconnected.' });
    } catch (err: any) {
      console.error('[API /drive/disconnect error]:', err);
      res.status(500).json({ error: err.message || 'Failed to disconnect Drive.' });
    }
  });

  // Helper to ensure valid Google Drive access token
  async function getValidDriveAccessToken(driveConn: any): Promise<string> {
    const isExpiredOrClose =
      !driveConn.access_token ||
      !driveConn.token_expiry ||
      new Date(driveConn.token_expiry).getTime() - 120000 < Date.now();

    if (isExpiredOrClose && driveConn.refresh_token) {
      try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
            refresh_token: driveConn.refresh_token,
            grant_type: 'refresh_token',
          }),
        });
        const tokenData = await tokenResponse.json();
        if (tokenResponse.ok && tokenData.access_token) {
          const expiryTimeMs = Date.now() + (tokenData.expires_in * 1000);
          if (driveConn.id === 'central-master-drive') {
            db.updateMasterDriveToken(tokenData.access_token, expiryTimeMs);
          } else {
            await db.saveDriveConnection({
              ...driveConn,
              access_token: tokenData.access_token,
              token_expiry: new Date(expiryTimeMs).toISOString(),
            });
          }
          driveConn.access_token = tokenData.access_token;
          return tokenData.access_token;
        } else {
          console.warn('[Drive Token Refresh Failed]:', tokenData);
        }
      } catch (err) {
        console.error('[Drive Token Refresh Error]:', err);
      }
    }
    return driveConn.access_token || '';
  }

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
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': mimeType || 'application/octet-stream',
          'X-Upload-Content-Length': fileSize.toString(),
          'Origin': req.headers.origin || 'http://localhost:3000'
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
        await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
          downloadUrl: `/api/drive/download/${savedFile.id}`,
          createdAt: savedFile.created_at,
        },
      });
    } catch (err: any) {
      console.error('[API /drive/upload-finish error]:', err);
      res.status(500).json({ error: err.message || 'Failed to finalize upload.' });
    }
  });

    app.get('/api/drive/list', requireRoomAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roomId = req.roomId!;
      const files = await db.getRoomFiles(roomId);

      res.json({
        success: true,
        files: files.map((f) => ({
          id: f.id,
          name: f.file_name,
          size: f.file_size,
          mimeType: f.mime_type,
          driveFileId: f.drive_file_id,
          downloadUrl: `/api/drive/download/${f.id}`,
          createdAt: f.created_at,
        })),
      });
    } catch (err: any) {
      console.error('[API /drive/list error]:', err);
      res.status(500).json({ error: err.message || 'Failed to list files.' });
    }
  });

  app.get('/api/drive/download/:fileId', requireRoomAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const fileId = req.params.fileId;
      const file = await db.getRoomFileById(fileId);

      if (!file || file.room_id !== req.roomId) {
        res.status(404).send('File not found or unauthorized for this chest.');
        return;
      }

      // 1. High-speed cache: Serve directly from server memory buffer if available
      const cachedBuffer = db.getFileBuffer(fileId);
      if (cachedBuffer) {
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}"`);
        res.setHeader('Content-Length', cachedBuffer.length);
        res.send(cachedBuffer);
        return;
      }

      // 2. Stream from Google Drive with robust token management
      let driveConnection = await db.getDriveConnection(req.roomId);
      if (driveConnection && file.drive_file_id) {
        let accessToken = await getValidDriveAccessToken(driveConnection);

        let driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`, {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });

        // If 401 Unauthorized, force refresh token and retry
        if (driveRes.status === 401 && driveConnection.refresh_token) {
          console.warn('[Drive Download]: 401 Unauthorized, refreshing token and retrying...');
          driveConnection.token_expiry = new Date(0).toISOString();
          accessToken = await getValidDriveAccessToken(driveConnection);
          driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`, {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
        }

        if (driveRes.ok) {
          const arrayBuffer = await driveRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Cache in memory for subsequent downloads from other devices
          db.saveFileBuffer(fileId, buffer);

          res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}"`);
          res.setHeader('Content-Length', buffer.length);
          res.send(buffer);
          return;
        } else {
          const errorBody = await driveRes.text();
          console.error(`[Drive Media Download Failed ${driveRes.status}]:`, errorBody);
        }
      }

      // 3. Fallback: If direct download URL is available
      if (file.download_url && file.download_url.startsWith('http')) {
        res.redirect(file.download_url);
        return;
      }

      res.status(404).send('File content not available.');
    } catch (err: any) {
      console.error('[API /drive/download error]:', err);
      res.status(500).send('Failed to download file.');
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EnderChest Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
