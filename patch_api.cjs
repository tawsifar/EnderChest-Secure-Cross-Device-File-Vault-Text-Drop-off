const fs = require('fs');
const content = fs.readFileSync('src/services/api.ts', 'utf8');

const targetStart = "  async uploadFile(token: string, file: File, onProgress?: (pct: number) => void): Promise<RoomFile> {";
const targetEnd = "  /**\n   * Disconnect Secure Storage from room.";

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find boundaries");
  process.exit(1);
}

const replacement = `  async uploadFile(token: string, file: File, onProgress?: (pct: number) => void): Promise<RoomFile> {
    // 1. Get resumable upload URL from backend
    const initRes = await fetch('/api/drive/upload-init', {
      method: 'POST',
      headers: {
        Authorization: \`Bearer \${token}\`,
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
          reject(new Error(\`Drive upload failed with status \${xhr.status}\`));
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
        Authorization: \`Bearer \${token}\`,
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

`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync('src/services/api.ts', newContent, 'utf8');
console.log("Successfully patched api.ts");
