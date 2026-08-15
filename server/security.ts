import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'bridge-secure-fallback-secret-key-4cda51ee';

/**
 * Hashes a room code using SHA-256 before it ever touches the database.
 * Never store, compare, or transmit plain-text room codes.
 */
export function hashRoomCode(code: string): string {
  const normalized = code.trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Creates a cryptographically signed room session token.
 * Contains roomId, timestamp, and HMAC signature so browser never receives raw code or code hash.
 */
export function createSessionToken(roomId: string): string {
  const payload = {
    roomId,
    createdAt: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${hmac}`;
}

/**
 * Verifies a room session token and extracts the roomId.
 */
export function verifySessionToken(token: string): { roomId: string; createdAt: number } | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [data, signature] = parts;
    const expectedHmac = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

    // Constant-time string comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (!payload.roomId) return null;

    return {
      roomId: payload.roomId,
      createdAt: payload.createdAt
    };
  } catch {
    return null;
  }
}
