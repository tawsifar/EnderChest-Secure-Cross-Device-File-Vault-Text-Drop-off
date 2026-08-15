import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface RoomRecord {
  id: string;
  code_hash: string;
  saved_text: string;
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

class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private isConfigured: boolean = false;

  // In-memory fallback storage when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not yet configured
  private memoryRooms: Map<string, RoomRecord> = new Map();
  private memoryDriveConnections: Map<string, DriveConnectionRecord> = new Map();
  private memoryFiles: Map<string, RoomFileRecord> = new Map();
  private memoryFileBuffers: Map<string, Buffer> = new Map();

  // Cache for master drive access token
  private masterDriveAccessToken: string | null = null;
  private masterDriveTokenExpiry: number = 0;

  constructor() {
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
        console.log('[DB] Connected to Supabase client with service_role privileges.');
      } catch (err) {
        console.error('[DB] Failed to initialize Supabase client:', err);
        this.supabase = null;
        this.isConfigured = false;
      }
    } else {
      console.log('[DB] Supabase credentials not set in .env. Running in local in-memory fallback mode.');
      this.isConfigured = false;
    }
  }

  public getStatus() {
    return {
      isSupabaseConnected: this.isConfigured,
      schemaAvailable: true,
    };
  }

  /**
   * Finds or creates a room by SHA-256 hash.
   * Never accepts plain-text code.
   */
  public async findOrCreateRoomByHash(codeHash: string): Promise<RoomRecord> {
    const now = new Date().toISOString();

    if (this.supabase && this.isConfigured) {
      // 1. Try to find existing
      const { data: existing, error: findError } = await this.supabase
        .from('rooms')
        .select('*')
        .eq('code_hash', codeHash)
        .maybeSingle();

      if (findError) {
        console.error('[DB] Error querying room from Supabase:', findError);
      }

      if (existing) {
        // Update last_accessed_at
        await this.supabase
          .from('rooms')
          .update({ last_accessed_at: now })
          .eq('id', existing.id);
        return existing as RoomRecord;
      }

      // 2. Create new room
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
        console.error('[DB] Error creating room in Supabase:', createError);
        throw new Error(`Failed to create room in database: ${createError.message}`);
      }

      return created as RoomRecord;
    }

    // In-memory fallback
    for (const room of this.memoryRooms.values()) {
      if (room.code_hash === codeHash) {
        room.last_accessed_at = now;
        return room;
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
    return newRoom;
  }

  /**
   * Retrieves a room by its ID.
   */
  public async getRoomById(roomId: string): Promise<RoomRecord | null> {
    if (this.supabase && this.isConfigured) {
      const { data, error } = await this.supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();

      if (error) {
        console.error('[DB] Error fetching room:', error);
        return null;
      }
      return data as RoomRecord | null;
    }

    return this.memoryRooms.get(roomId) || null;
  }

  /**
   * Updates saved text for a room.
   */
  public async updateRoomText(roomId: string, text: string): Promise<{ success: boolean; updatedAt: string }> {
    const now = new Date().toISOString();

    if (this.supabase && this.isConfigured) {
      const { error } = await this.supabase
        .from('rooms')
        .update({
          saved_text: text,
          updated_at: now,
          last_accessed_at: now,
        })
        .eq('id', roomId);

      if (error) {
        console.error('[DB] Error updating room text:', error);
        throw new Error(`Failed to save room text: ${error.message}`);
      }
      return { success: true, updatedAt: now };
    }

    const room = this.memoryRooms.get(roomId);
    if (!room) throw new Error('Room not found');
    room.saved_text = text;
    room.updated_at = now;
    room.last_accessed_at = now;
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

    if (this.supabase && this.isConfigured) {
      // 1. Try room-specific connection
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

      // 2. Try global/master connection stored in DB (where room_id is NULL or marked master)
      const { data: masterConn } = await this.supabase
        .from('drive_connections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (masterConn) {
        return masterConn as DriveConnectionRecord;
      }

      return null;
    }

    if (roomId && this.memoryDriveConnections.has(roomId)) {
      return this.memoryDriveConnections.get(roomId) || null;
    }

    // Fallback: Return any available memory drive connection as master
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

    if (this.supabase && this.isConfigured) {
      const { data: existing } = await this.supabase
        .from('drive_connections')
        .select('id')
        .eq('room_id', connection.room_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await this.supabase
          .from('drive_connections')
          .update({
            ...connection,
            updated_at: now,
          })
          .eq('room_id', connection.room_id)
          .select()
          .single();

        if (error) throw error;
        return data as DriveConnectionRecord;
      } else {
        const { data, error } = await this.supabase
          .from('drive_connections')
          .insert({
            ...connection,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (error) throw error;
        return data as DriveConnectionRecord;
      }
    }

    const existing = this.memoryDriveConnections.get(connection.room_id);
    const saved: DriveConnectionRecord = {
      id: existing ? existing.id : crypto.randomUUID(),
      created_at: existing ? existing.created_at : now,
      updated_at: now,
      ...connection,
    };
    this.memoryDriveConnections.set(connection.room_id, saved);
    return saved;
  }

  /**
   * Removes Google Drive connection for a room.
   */
  public async deleteDriveConnection(roomId: string): Promise<boolean> {
    if (this.supabase && this.isConfigured) {
      const { error } = await this.supabase
        .from('drive_connections')
        .delete()
        .eq('room_id', roomId);
      return !error;
    }

    return this.memoryDriveConnections.delete(roomId);
  }

  /**
   * Lists files for a room.
   */
  public async getRoomFiles(roomId: string): Promise<RoomFileRecord[]> {
    if (this.supabase && this.isConfigured) {
      const { data, error } = await this.supabase
        .from('room_files')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DB] Error fetching room files:', error);
        return [];
      }
      return (data || []) as RoomFileRecord[];
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

    if (this.supabase && this.isConfigured) {
      const { data, error } = await this.supabase
        .from('room_files')
        .insert({
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

      if (error) throw error;
      return data as RoomFileRecord;
    }

    const id = crypto.randomUUID();
    const newFile: RoomFileRecord = {
      id,
      created_at: now,
      ...file,
    };
    this.memoryFiles.set(id, newFile);
    return newFile;
  }

  /**
   * Gets a specific file by ID.
   */
  public async getRoomFileById(fileId: string): Promise<RoomFileRecord | null> {
    if (this.supabase && this.isConfigured) {
      const { data, error } = await this.supabase
        .from('room_files')
        .select('*')
        .eq('id', fileId)
        .maybeSingle();

      if (error) return null;
      return data as RoomFileRecord | null;
    }

    return this.memoryFiles.get(fileId) || null;
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
