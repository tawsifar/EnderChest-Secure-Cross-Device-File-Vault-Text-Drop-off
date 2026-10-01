import express, { Request, Response, NextFunction } from 'express';
import { google } from 'googleapis';
import crypto from 'crypto';
import path from 'path';
import https from 'https';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { hashRoomCode, createSessionToken, verifySessionToken } from './server/security.ts';
import { db, SUPABASE_SCHEMA_SQL } from './server/db.ts';

// Configure multer for file uploads (in-memory for buffer handling)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
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
      const roomInfo = await db.findOrCreateRoomByHash(codeHash);
      const room = roomInfo.room;
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

    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive email profile');
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

      if (fileSize > 25 * 1024 * 1024) {
        res.status(413).json({ error: 'File size exceeds the 25 MB limit.' });
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

      const driveConnection = await db.getDriveConnection(req.roomId!);
      if (!driveConnection || !file.drive_file_id) {
        res.status(404).send('File content not available.');
        return;
      }

      // Check max file size limit (25MB)
      if (file.file_size && file.file_size > 25 * 1024 * 1024) {
        res.status(413).send('File size exceeds the 25 MB limit.');
        return;
      }

      const accessToken = await getValidDriveAccessToken(driveConnection);

      const downloadFileWithRedirect = (token: string, fileIdStr: string, depth = 0): Promise<boolean> => {
        return new Promise((resolve) => {
          if (depth > 5) {
            console.error('Too many redirects');
            resolve(false);
            return;
          }

          let requestOptions: any;
          
          if (depth === 0) {
            requestOptions = {
              hostname: 'www.googleapis.com',
              path: `/drive/v3/files/${fileIdStr}?alt=media&acknowledgeAbuse=true&supportsAllDrives=true`,
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept-Encoding': 'identity'
              }
            };
          } else {
            const parsedUrl = new URL(fileIdStr); // At depth > 0, fileIdStr is the redirect URL
            requestOptions = {
              hostname: parsedUrl.hostname,
              path: parsedUrl.pathname + parsedUrl.search,
              method: 'GET',
              headers: {
                'Accept-Encoding': 'identity'
              }
            };
            // Do NOT forward Authorization header to the redirected googleusercontent domain
            // as it can cause 401/403 errors on the signed URL.
          }

          const driveReq = https.request(requestOptions, (driveRes: any) => {
            // Handle 401 on initial request (needs token refresh)
            if (driveRes.statusCode === 401 && depth === 0) {
              resolve(false);
              return;
            }

            // Handle Redirects
            if (driveRes.statusCode >= 300 && driveRes.statusCode < 400 && driveRes.headers.location) {
              downloadFileWithRedirect(token, driveRes.headers.location, depth + 1).then(resolve);
              return;
            }

            if (driveRes.statusCode >= 400) {
              console.error('[Drive Download HTTP Error]:', driveRes.statusCode);
              if (!res.headersSent) res.status(driveRes.statusCode).send('Failed to fetch from Google Drive');
              resolve(true); 
              return;
            }

            // Successfully reached the final file payload
            const safeAsciiName = (file.file_name || 'file')
              .replace(/["\\]/g, '_')
              .replace(/[^\x20-\x7E]/g, '_');
            const encodedName = encodeURIComponent(file.file_name || 'file');

            res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodedName}`
            );
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            
            // Set Content-Length if provided by the final storage server
            if (driveRes.headers['content-length']) {
              res.setHeader('Content-Length', driveRes.headers['content-length']);
            } else if (file.file_size) {
               // Fallback to DB size if streaming directly
               res.setHeader('Content-Length', file.file_size.toString());
            }
            res.setHeader('Accept-Ranges', 'none'); 

            driveRes.pipe(res);
            driveRes.on('end', () => resolve(true));
            driveRes.on('error', (err: any) => {
              console.error('[Drive Download Stream Error]:', err);
              if (!res.headersSent) res.status(500).send('Stream error during download.');
              else res.end();
              resolve(true);
            });
          });

          driveReq.on('error', (err: any) => {
            console.error('[Drive Download Request Error]:', err);
            if (!res.headersSent) res.status(500).send('Request error');
            resolve(false);
          });

          driveReq.end();
        });
      };

      let success = await downloadFileWithRedirect(accessToken, file.drive_file_id);
      
      // If unauthorized on the very first try, refresh token and retry once
      if (!success && driveConnection.refresh_token) {
        console.warn('[Drive Download]: 401 Unauthorized or request error, refreshing token and retrying...');
        driveConnection.token_expiry = new Date(0).toISOString();
        const freshToken = await getValidDriveAccessToken(driveConnection);
        success = await downloadFileWithRedirect(freshToken, file.drive_file_id);
      }

      if (!success && !res.headersSent) {
        res.status(502).send('Unable to retrieve file from secure storage.');
      }

    } catch (err: any) {
      console.error('[API /drive/download error]:', err.stack || err);
      if (!res.headersSent) res.status(500).send('Failed to download file.');
    }
  });

  app.delete('/api/drive/file/:fileId', requireRoomAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const fileId = req.params.fileId;
      const roomId = req.roomId!;
      const file = await db.getRoomFileById(fileId);

      if (!file || file.room_id !== roomId) {
        res.status(404).json({ error: 'File not found or unauthorized.' });
        return;
      }

      // 1. Delete from Google Drive if driveFileId exists
      if (file.drive_file_id) {
        const driveConnection = await db.getDriveConnection(roomId);
        if (driveConnection) {
          try {
            const accessToken = await getValidDriveAccessToken(driveConnection);
            const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.drive_file_id}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
            console.log(`[Drive File Delete ${file.drive_file_id}]: status ${driveRes.status}`);
          } catch (driveErr) {
            console.warn('[Drive Delete Warning]:', driveErr);
          }
        }
      }

      // 2. Delete from DB and memory buffers
      const deleted = await db.deleteRoomFile(fileId, roomId);
      if (!deleted) {
        res.status(500).json({ error: 'Failed to delete file from database.' });
        return;
      }

      res.json({ success: true, deletedFileId: fileId, message: 'File deleted from vault and storage.' });
    } catch (err: any) {
      console.error('[API /drive/file DELETE error]:', err);
      res.status(500).json({ error: err.message || 'Failed to delete file.' });
    }
  });

  app.delete('/api/room', requireRoomAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roomId = req.roomId!;
      const files = await db.getRoomFiles(roomId);
      const driveConnection = await db.getDriveConnection(roomId);

      // 1. Delete all room files from Google Drive
      if (driveConnection) {
        try {
          const accessToken = await getValidDriveAccessToken(driveConnection);
          if (accessToken) {
            for (const file of files) {
              if (file.drive_file_id) {
                try {
                  const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.drive_file_id}`, {
                    method: 'DELETE',
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                    },
                  });
                  console.log(`[Drive Room File Delete ${file.drive_file_id}]: status ${driveRes.status}`);
                } catch (driveErr) {
                  console.warn(`[Drive Delete File ${file.drive_file_id} failed]:`, driveErr);
                }
              }
            }
          }
        } catch (tokenErr) {
          console.warn('[Drive Token Fetch on Room Delete Error]:', tokenErr);
        }
      }

      // 2. Permanently delete room from DB
      await db.deleteRoom(roomId);

      res.json({ success: true, message: 'Vault and all associated files permanently deleted.' });
    } catch (err: any) {
      console.error('[API /room DELETE error]:', err);
      res.status(500).json({ error: err.message || 'Failed to delete room.' });
    }
  });

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File exceeds the 25 MB maximum size.' });
    }
    next(err);
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
