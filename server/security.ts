import crypto from 'crypto';

// Use environment secret if provided; otherwise generate a cryptographically strong random secret for the server lifecycle
const SERVER_INSTANCE_SECRET = crypto.randomBytes(32).toString('hex');
const SECRET = process.env.SESSION_SECRET || SERVER_INSTANCE_SECRET;

// Session token valid for 48 hours to prevent infinite token lifespan while preserving smooth user experience
const SESSION_EXPIRY_MS = 48 * 60 * 60 * 1000;

/**
 * Hashes a room code using SHA-256 before it ever touches the database.
 * Never store, compare, or transmit plain-text room codes.
 */
export function hashRoomCode(code: string): string {
  const normalized = (code || '').trim().toLowerCase();
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
 * Enforces cryptographic HMAC signature, constant-time comparison, and 48h expiration.
 */
export function verifySessionToken(token: string): { roomId: string; createdAt: number } | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [data, signature] = parts;
    const expectedHmac = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedHmac);

    // Constant-time comparison with length matching to prevent timing attacks and crashes
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (!payload.roomId || typeof payload.roomId !== 'string') return null;
    if (typeof payload.createdAt !== 'number') return null;

    // Reject expired tokens
    if (Date.now() - payload.createdAt > SESSION_EXPIRY_MS) {
      return null;
    }

    return {
      roomId: payload.roomId,
      createdAt: payload.createdAt
    };
  } catch {
    return null;
  }
}

