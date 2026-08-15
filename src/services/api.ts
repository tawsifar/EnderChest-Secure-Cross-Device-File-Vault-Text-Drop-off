import { RoomData, RoomFile } from '../types.ts';

class ApiService {
  private getHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Enter or create room with a plain room code.
   * The server will immediately compute SHA-256 and return a session token.
   */
  async enterRoom(code: string): Promise<{ sessionToken: string; room: any }> {
    const res = await fetch('/api/room/enter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to enter room');
    }
    return data;
  }

  /**
   * Fetch current room state, saved text, and files.
   */
  async getRoomStatus(token: string): Promise<RoomData> {
    const res = await fetch('/api/room/status', {
      headers: this.getHeaders(token),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch room status');
    }
    return data.room;
  }

  /**
   * Save text for the room.
   */
  async saveRoomText(token: string, text: string): Promise<{ savedText: string; updatedAt: string }> {
    const res = await fetch('/api/room/text', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save text');
    }
    return data;
  }

  /**
   * Upload a file to the room's connected Secure Storage.
   */
  async uploadFile(token: string, file: File, onProgress?: (pct: number) => void): Promise<RoomFile> {
    // 1. Get resumable upload URL from backend
    const initRes = await fetch('/api/drive/upload-init', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream'
      })
    });
    
    if (!initRes.ok) {
      const data = await initRes.json();
      throw new Error(data.error || 'Failed to initialize upload');
    }
    
    const { uploadUrl } = await initRes.json();

    // 2. Upload directly to Google Drive via XMLHttpRequest
    const gdriveData = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          // Keep it to 99% max during Drive upload, 100% is when DB finishes
          const percentComplete = Math.round((event.loaded / event.total) * 99);
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('Invalid response from Google Drive'));
          }
        } else {
          reject(new Error(`Drive upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during Google Drive upload'));
      };

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });

    // 3. Finalize upload with backend to save DB record
    const finishRes = await fetch('/api/drive/upload-finish', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        driveFileId: gdriveData.id,
        webViewLink: gdriveData.webViewLink,
        webContentLink: gdriveData.webContentLink
      })
    });

    if (!finishRes.ok) {
      const data = await finishRes.json();
      throw new Error(data.error || 'Failed to finalize upload');
    }
    
    const { file: savedFile } = await finishRes.json();
    if (onProgress) onProgress(100);
    return savedFile;
  }

  /**
   * Disconnect Secure Storage from room.
   */
  async disconnectDrive(token: string): Promise<void> {
    const res = await fetch('/api/drive/disconnect', {
      method: 'POST',
      headers: this.getHeaders(token),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to disconnect Secure Storage');
    }
  }

  /**
   * Connect Secure Storage (placeholder or simulation).
   */
  async mockConnectDrive(token: string, email?: string): Promise<void> {
    const res = await fetch('/api/drive/mock-connect', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        email: email || 'bridge.user@gmail.com',
        folderName: 'Bridge Drop-offs',
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to connect Secure Storage');
    }
  }

  /**
   * Fetch Supabase schema SQL helper.
   */
  async getSchema(): Promise<{ schemaSql: string; isConfigured: boolean }> {
    const res = await fetch('/api/db/schema');
    return res.json();
  }

  /**
   * Health check.
   */
  async checkHealth(): Promise<{ status: string; db: { isSupabaseConnected: boolean } }> {
    const res = await fetch('/api/health');
    return res.json();
  }
}

export const api = new ApiService();
