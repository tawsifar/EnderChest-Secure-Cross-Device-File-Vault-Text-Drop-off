export interface RoomFile {
  id: string;
  name: string;
  size: number;
  mimeType?: string;
  driveFileId?: string;
  downloadUrl: string;
  createdAt: string;
}

export interface DriveAccountInfo {
  email: string;
  folderName: string;
  connectedAt: string;
}

export interface RoomData {
  id: string;
  savedText: string;
  updatedAt: string;
  isDriveConnected: boolean;
  driveAccount?: DriveAccountInfo | null;
  files: RoomFile[];
}

export interface RoomSession {
  token: string;
  roomCode: string; // Stored in client memory/sessionStorage for display only
  roomId: string;
}
