import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface RoomRecord {
  id: string;
  code_hash: string;
  saved_text: string;
  password_hash?: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

export interface DriveConnectionRecord {
  id: string;
  room_id: string;
  google_account_email?: string;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: string;
  drive_folder_id?: string;
  drive_folder_name?: string;
  created_at: string;
  updated_at: string;
}

export interface RoomFileRecord {
  id: string;
  room_id: string;
  file_name: string;
  file_size: number;
  mime_type?: string;
  drive_file_id?: string;
  download_url?: string;
  created_at: string;
  data_buffer?: string; // Base64 encoded for fallback storage
}

// SQL Schema for Supabase setup
export const SUPABASE_SCHEMA_SQL = `
-- =========================================================
-- EnderChest: Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- =========================================================

-- 1. Rooms table (Stores only SHA-256 hashes of room codes)
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT UNIQUE NOT NULL,
  saved_text TEXT DEFAULT '',
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_code_hash ON rooms(code_hash);

-- 2. Drive Connections table (Per-room Google Drive connection)
CREATE TABLE IF NOT EXISTS drive_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  google_account_email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  drive_folder_id TEXT,
  drive_folder_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_drive_connections_room UNIQUE(room_id)
);

-- 3. Room Files table (Metadata for uploaded files)
CREATE TABLE IF NOT EXISTS room_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  drive_file_id TEXT,
  download_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_files_room_id ON room_files(room_id);

-- Disable Row Level Security (RLS) or enable with strict service-role only access
-- All queries MUST go through the server-side API proxy using the SERVICE_ROLE key.
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_files ENABLE ROW LEVEL SECURITY;
`;

interface SerializedStorage {
  rooms: Record<string, RoomRecord>;
  driveConnections: Record<string, DriveConnectionRecord>;
  files: Record<string, RoomFileRecord>;
}

class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private isConfigured: boolean = false;
  private isSupabaseOnline: boolean = false;
  private lastSupabaseCheckTime: number = 0;
  private storageFilePath: string;

  // In-memory & disk-backed persistent storage
  private memoryRooms: Map<string, RoomRecord> = new Map();
  private memoryDriveConnections: Map<string, DriveConnectionRecord> = new Map();
  private memoryFiles: Map<string, RoomFileRecord> = new Map();
  private memoryFileBuffers: Map<string, Buffer> = new Map();

  // Cache for master drive access token
  private masterDriveAccessToken: string | null = null;
  private masterDriveTokenExpiry: number = 0;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.error('[DB] Failed to create data directory:', err);
      }
    }
    this.storageFilePath = path.join(dataDir, 'vault-storage.json');

    // 1. Load persistent local storage first so data is never lost
    this.loadLocalStorage();

    // 2. Initialize Supabase if credentials are provided
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        this.isConfigured = true;
        // Probe connectivity asynchronously
        this.checkSupabaseConnectivity(supabaseUrl);
      } catch (err) {
        console.error('[DB] Failed to initialize Supabase client:', err);
        this.supabase = null;
        this.isConfigured = false;
        this.isSupabaseOnline = false;
      }
    } else {
      console.log('[DB] Supabase credentials not set. Running with persistent local vault storage.');
      this.isConfigured = false;
      this.isSupabaseOnline = false;
    }
  }

  private loadLocalStorage(): void {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const parsed: SerializedStorage = JSON.parse(raw);
        if (parsed.rooms) {
          for (const [id, room] of Object.entries(parsed.rooms)) {
            this.memoryRooms.set(id, room);
          }
        }
        if (parsed.driveConnections) {
          for (const [id, conn] of Object.entries(parsed.driveConnections)) {
            this.memoryDriveConnections.set(id, conn);
          }
        }
        if (parsed.files) {
          for (const [id, file] of Object.entries(parsed.files)) {
            this.memoryFiles.set(id, file);
          }
        }
        console.log(`[DB] Loaded persistent local vault storage (${this.memoryRooms.size} rooms, ${this.memoryFiles.size} files).`);
      } else {
        // Initialize clean persistent storage
        this.persistLocalData();
      }
    } catch (err) {
      console.error('[DB] Error loading local storage:', err);
    }
  }

  private persistLocalData(): void {
    try {
      const data: SerializedStorage = {
        rooms: Object.fromEntries(this.memoryRooms.entries()),
        driveConnections: Object.fromEntries(this.memoryDriveConnections.entries()),
        files: Object.fromEntries(this.memoryFiles.entries()),
      };
      const tmpPath = `${this.storageFilePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.storageFilePath);
    } catch (err) {
      console.error('[DB] Error persisting local storage:', err);
    }
  }

  private async checkSupabaseConnectivity(url: string): Promise<boolean> {
    const now = Date.now();
    this.lastSupabaseCheckTime = now;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      }).catch((e) => {
        return null;
      });

      clearTimeout(timeoutId);

      if (res && res.status >= 200 && res.status < 500) {
        this.isSupabaseOnline = true;
        console.log('[DB] Supabase health check passed. Online status: TRUE.');
        return true;
      } else {
        this.isSupabaseOnline = false;
        console.warn(`[DB] Supabase endpoint not reachable (${url}). Operating smoothly via persistent local vault storage.`);
        return false;
      }
    } catch (err: any) {
      this.isSupabaseOnline = false;
      console.warn(`[DB] Supabase endpoint unreachable (${err?.message || 'network error'}). Operating smoothly via persistent local vault storage.`);
      return false;
    }
  }

  private markSupabaseOffline(err?: any): void {
    if (this.isSupabaseOnline) {
      console.warn(`[DB] Supabase error encountered (${err?.message || 'fetch failed'}). Shifting to persistent local vault storage.`);
    }
    this.isSupabaseOnline = false;
  }

  public getStatus() {
    return {
      isSupabaseConnected: this.isConfigured && this.isSupabaseOnline,
      schemaAvailable: true,
      storageMode: this.isConfigured && this.isSupabaseOnline ? 'supabase' : 'local_persistent',
      localRoomsCount: this.memoryRooms.size,
      localFilesCount: this.memoryFiles.size,
    };
  }

  /**
   * Finds or creates a room by SHA-256 hash.
   * Never accepts plain-text code.
   * Completely resilient: if Supabase is offline/paused or fetch fails, falls back immediately to local storage.
   */
  public async findOrCreateRoomByHash(codeHash: string): Promise<{ room: RoomRecord, isNew: boolean }> {
    const now = new Date().toISOString();

    // 1. Try Supabase if configured and online
    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        const { data: existing, error: findError } = await this.supabase
          .from('rooms')
          .select('*')
          .eq('code_hash', codeHash)
          .maybeSingle();

        if (findError) {
          throw findError;
        }

        if (existing) {
          // Update last_accessed_at in Supabase (non-blocking)
          this.supabase
            .from('rooms')
            .update({ last_accessed_at: now })
            .eq('id', existing.id)
            .then(
              () => {},
              () => {}
            );

          this.memoryRooms.set(existing.id, existing as RoomRecord);
          this.persistLocalData();
          return { room: existing as RoomRecord, isNew: false };
        }

        // Create new room in Supabase
        const { data: created, error: createError } = await this.supabase
          .from('rooms')
          .insert({
            code_hash: codeHash,
            saved_text: '',
            created_at: now,
            updated_at: now,
            last_accessed_at: now,
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        this.memoryRooms.set(created.id, created as RoomRecord);
        this.persistLocalData();
        return { room: created as RoomRecord, isNew: true };
      } catch (err: any) {
        this.markSupabaseOffline(err);
        // Seamlessly fall through to persistent local storage below!
      }
    }

    // 2. Persistent Local Storage Fallback
    for (const room of this.memoryRooms.values()) {
      if (room.code_hash === codeHash) {
        room.last_accessed_at = now;
        this.persistLocalData();
        return { room, isNew: false };
      }
    }

    const newRoom: RoomRecord = {
      id: crypto.randomUUID(),
      code_hash: codeHash,
      saved_text: '',
      created_at: now,
      updated_at: now,
      last_accessed_at: now,
    };
    this.memoryRooms.set(newRoom.id, newRoom);
    this.persistLocalData();
    return { room: newRoom, isNew: true };
  }

  /**
   * Retrieves a room by its ID.
   */
  public async getRoomById(roomId: string): Promise<RoomRecord | null> {
    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        const { data, error } = await this.supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .maybeSingle();

        if (!error && data) {
          this.memoryRooms.set(roomId, data as RoomRecord);
          this.persistLocalData();
          return data as RoomRecord;
        }
      } catch (err: any) {
        this.markSupabaseOffline(err);
      }
    }

    return this.memoryRooms.get(roomId) || null;
  }

  /**
   * Updates saved text for a room.
   */
  public async updateRoomText(roomId: string, text: string): Promise<{ success: boolean; updatedAt: string }> {
    const now = new Date().toISOString();

    // Always update local persistent storage
    const localRoom = this.memoryRooms.get(roomId);
    if (localRoom) {
      localRoom.saved_text = text;
      localRoom.updated_at = now;
      localRoom.last_accessed_at = now;
      this.persistLocalData();
    }

    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        const { error } = await this.supabase
          .from('rooms')
          .update({
            saved_text: text,
            updated_at: now,
            last_accessed_at: now,
          })
          .eq('id', roomId);

        if (error) {
          console.warn('[DB] Supabase updateRoomText warning:', error.message);
        }
      } catch (err: any) {
        this.markSupabaseOffline(err);
      }
    }

    return { success: true, updatedAt: now };
  }

  /**
   * Gets Google Drive connection details for a room or falls back to master central connection.
   */
  public async getDriveConnection(roomId?: string): Promise<DriveConnectionRecord | null> {
    // 1. Check if MASTER / CENTRAL Drive Connection exists in environment
    if (process.env.MASTER_GOOGLE_DRIVE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      return {
        id: 'central-master-drive',
        room_id: roomId || 'master',
        google_account_email: process.env.MASTER_GOOGLE_DRIVE_EMAIL || 'Central 5TB Vault Storage',
        access_token: this.masterDriveAccessToken || process.env.MASTER_GOOGLE_DRIVE_ACCESS_TOKEN || '',
        refresh_token: process.env.MASTER_GOOGLE_DRIVE_REFRESH_TOKEN,
        token_expiry: new Date(this.masterDriveTokenExpiry).toISOString(),
        drive_folder_name: 'EnderChest Master Vault',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        if (roomId) {
          const { data: roomConn, error } = await this.supabase
            .from('drive_connections')
            .select('*')
            .eq('room_id', roomId)
            .maybeSingle();

          if (!error && roomConn) {
            return roomConn as DriveConnectionRecord;
          }
        }

        const { data: masterConn } = await this.supabase
          .from('drive_connections')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (masterConn) {
          return masterConn as DriveConnectionRecord;
        }
      } catch (err: any) {
        this.markSupabaseOffline(err);
      }
    }

    if (roomId && this.memoryDriveConnections.has(roomId)) {
      return this.memoryDriveConnections.get(roomId) || null;
    }

    if (this.memoryDriveConnections.size > 0) {
      return this.memoryDriveConnections.values().next().value || null;
    }

    return null;
  }

  public updateMasterDriveToken(accessToken: string, expiryTimeMs: number) {
    this.masterDriveAccessToken = accessToken;
    this.masterDriveTokenExpiry = expiryTimeMs;
  }

  /**
   * Sets or updates Google Drive connection for a room.
   */
  public async saveDriveConnection(connection: Omit<DriveConnectionRecord, 'id' | 'created_at' | 'updated_at'>): Promise<DriveConnectionRecord> {
    const now = new Date().toISOString();

    const existing = this.memoryDriveConnections.get(connection.room_id);
    const saved: DriveConnectionRecord = {
      id: existing ? existing.id : crypto.randomUUID(),
      created_at: existing ? existing.created_at : now,
      updated_at: now,
      ...connection,
    };
    this.memoryDriveConnections.set(connection.room_id, saved);
    this.persistLocalData();

    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        const { data: remoteExisting } = await this.supabase
          .from('drive_connections')
          .select('id')
          .eq('room_id', connection.room_id)
          .maybeSingle();

        if (remoteExisting) {
          await this.supabase
            .from('drive_connections')
            .update({
              ...connection,
              updated_at: now,
            })
            .eq('room_id', connection.room_id);
        } else {
          await this.supabase
            .from('drive_connections')
            .insert({
              ...connection,
              created_at: now,
              updated_at: now,
            });
        }
      } catch (err: any) {
        this.markSupabaseOffline(err);
      }
    }

    return saved;
  }

  /**
   * Removes Google Drive connection for a room.
   */
  public async deleteDriveConnection(roomId: string): Promise<boolean> {
    this.memoryDriveConnections.delete(roomId);
    this.persistLocalData();

    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        await this.supabase
          .from('drive_connections')
          .delete()
          .eq('room_id', roomId);
      } catch (err: any) {
        this.markSupabaseOffline(err);
      }
    }

    return true;
  }

  /**
   * Lists files for a room.
   */
  public async getRoomFiles(roomId: string): Promise<RoomFileRecord[]> {
    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        const { data, error } = await this.supabase
          .from('room_files')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          for (const f of data) {
            this.memoryFiles.set(f.id, f as RoomFileRecord);
          }
          this.persistLocalData();
          return data as RoomFileRecord[];
        }
      } catch (err: any) {
        this.markSupabaseOffline(err);
      }
    }

    const files: RoomFileRecord[] = [];
    for (const file of this.memoryFiles.values()) {
      if (file.room_id === roomId) {
        files.push(file);
      }
    }
    return files.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Adds a file record.
   */
  public async addRoomFile(file: Omit<RoomFileRecord, 'id' | 'created_at'>): Promise<RoomFileRecord> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newFile: RoomFileRecord = {
      id,
      created_at: now,
      ...file,
    };
    this.memoryFiles.set(id, newFile);
    this.persistLocalData();

    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        const { data, error } = await this.supabase
          .from('room_files')
          .insert({
            id: newFile.id,
            room_id: file.room_id,
            file_name: file.file_name,
            file_size: file.file_size,
            mime_type: file.mime_type || 'application/octet-stream',
            drive_file_id: file.drive_file_id || null,
            download_url: file.download_url || null,
            created_at: now,
          })
          .select()
          .single();

        if (!error && data) {
          this.memoryFiles.set(data.id, data as RoomFileRecord);
          this.persistLocalData();
          return data as RoomFileRecord;
        }
      } catch (err: any) {
        this.markSupabaseOffline(err);
      }
    }

    return newFile;
  }

  /**
   * Gets a specific file by ID.
   */
  public async getRoomFileById(fileId: string): Promise<RoomFileRecord | null> {
    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        const { data, error } = await this.supabase
          .from('room_files')
          .select('*')
          .eq('id', fileId)
          .maybeSingle();

        if (!error && data) {
          this.memoryFiles.set(data.id, data as RoomFileRecord);
          this.persistLocalData();
          return data as RoomFileRecord;
        }
      } catch (err: any) {
        this.markSupabaseOffline(err);
      }
    }

    return this.memoryFiles.get(fileId) || null;
  }

  /**
   * Deletes a specific file by ID and roomId.
   */
  public async deleteRoomFile(fileId: string, roomId: string): Promise<boolean> {
    this.memoryFileBuffers.delete(fileId);
    this.memoryFiles.delete(fileId);
    this.persistLocalData();

    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        await this.supabase
          .from('room_files')
          .delete()
          .eq('id', fileId)
          .eq('room_id', roomId);
      } catch (err: any) {
        this.markSupabaseOffline(err);
      }
    }

    return true;
  }

  /**
   * Deletes all files for a room.
   */
  public async deleteRoomFiles(roomId: string): Promise<boolean> {
    for (const [id, f] of this.memoryFiles.entries()) {
      if (f.room_id === roomId) {
        this.memoryFiles.delete(id);
        this.memoryFileBuffers.delete(id);
      }
    }
    this.persistLocalData();

    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        await this.supabase
          .from('room_files')
          .delete()
          .eq('room_id', roomId);
      } catch (err: any) {
        this.markSupabaseOffline(err);
      }
    }

    return true;
  }

  /**
   * Permanently deletes a room and its associated records.
   */
  public async deleteRoom(roomId: string): Promise<boolean> {
    await this.deleteRoomFiles(roomId);
    await this.deleteDriveConnection(roomId);
    this.memoryRooms.delete(roomId);
    this.persistLocalData();

    if (this.supabase && this.isConfigured && this.isSupabaseOnline) {
      try {
        await this.supabase
          .from('rooms')
          .delete()
          .eq('id', roomId);
      } catch (err: any) {
        this.markSupabaseOffline(err);
      }
    }

    return true;
  }

  /**
   * Save file buffer in memory cache
   */
  public saveFileBuffer(fileId: string, buffer: Buffer): void {
    this.memoryFileBuffers.set(fileId, buffer);
  }

  /**
   * Get file buffer from memory cache
   */
  public getFileBuffer(fileId: string): Buffer | null {
    return this.memoryFileBuffers.get(fileId) || null;
  }
}

export const db = new DatabaseService();

