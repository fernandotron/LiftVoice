import crypto from 'crypto';

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in ms
const ATTEMPTS_WINDOW = 15 * 60 * 1000; // 15 minutes in ms

const sessions = new Map();
// Structure: Map<ip, { count: number, firstAttemptAt: number, lockedUntil: number | null }>
const loginAttempts = new Map();

/**
 * Extracts normalized client IP from request (handling proxies and local interfaces)
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

/**
 * Checks if client IP is currently blocked by rate limiter
 */
export function checkRateLimit(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return { isLocked: false, remainingSeconds: 0 };

  const now = Date.now();

  // Active lockout check
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  // Lockout expired or time window expired: reset state
  if (record.lockedUntil && now >= record.lockedUntil) {
    loginAttempts.delete(ip);
    return { isLocked: false, remainingSeconds: 0 };
  }

  if (now - record.firstAttemptAt > ATTEMPTS_WINDOW) {
    loginAttempts.delete(ip);
    return { isLocked: false, remainingSeconds: 0 };
  }

  return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Records a failed login attempt and applies temporary IP lockout if limit exceeded
 */
export function recordFailedAttempt(ip) {
  const now = Date.now();
  let record = loginAttempts.get(ip);

  if (!record || (now - record.firstAttemptAt > ATTEMPTS_WINDOW && !record.lockedUntil)) {
    record = { count: 1, firstAttemptAt: now, lockedUntil: null };
  } else {
    record.count += 1;
  }

  const isoTime = new Date().toISOString();
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION;
    console.warn(`[Security Audit] IP ${ip} BLOQUEADA durante 15 minutos por alcanzar ${record.count} intentos fallidos a las ${isoTime}.`);
  } else {
    console.warn(`[Security Audit] Intento fallido #${record.count}/${MAX_FAILED_ATTEMPTS} de login admin desde IP ${ip} a las ${isoTime}.`);
  }

  loginAttempts.set(ip, record);

  const remainingSeconds = record.lockedUntil ? Math.ceil((record.lockedUntil - now) / 1000) : 0;
  return {
    attemptsCount: record.count,
    maxAttempts: MAX_FAILED_ATTEMPTS,
    isLocked: Boolean(record.lockedUntil),
    remainingSeconds
  };
}

/**
 * Clears failed attempts upon successful authentication
 */
export function recordSuccessfulAttempt(ip) {
  loginAttempts.delete(ip);
  console.log(`[Security Audit] Autenticación administrativa exitosa desde IP ${ip} a las ${new Date().toISOString()}.`);
}

const HMAC_SECRET = process.env.ADMIN_SECRET_KEY || process.env.ADMIN_PASSWORD || 'liftvoice_admin_master_secret_jwt_2026';

export function createAdminSession(userData = {}) {
  const email = (userData && userData.email) ? userData.email : 'admin@liftvoice.ai';
  const payload = {
    email,
    name: email.split('@')[0],
    role: 'admin_master',
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(payloadB64).digest('base64url');
  const token = `${payloadB64}.${sig}`;
  
  sessions.set(token, { 
    expiresAt: payload.exp,
    user: {
      email: payload.email,
      name: payload.name,
      role: payload.role
    }
  });
  return token;
}

export function invalidateAdminSession(token) {
  if (token) {
    sessions.delete(token);
  }
}

export function getAdminSession(token) {
  if (!token || typeof token !== 'string') return null;
  
  // 1. Check in-memory cache
  const cached = sessions.get(token);
  if (cached) {
    if (Date.now() > cached.expiresAt) {
      sessions.delete(token);
      return null;
    }
    return cached;
  }

  // 2. Validate stateless HMAC signature (resilient across server restarts)
  const dotIndex = token.indexOf('.');
  if (dotIndex > 0) {
    const payloadB64 = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);
    const expectedSig = crypto.createHmac('sha256', HMAC_SECRET).update(payloadB64).digest('base64url');
    
    try {
      const sigBuf = Buffer.from(sig);
      const expectedBuf = Buffer.from(expectedSig);
      if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (payload && payload.exp && Date.now() <= payload.exp) {
          const sessionObj = {
            expiresAt: payload.exp,
            user: {
              email: payload.email || 'admin@liftvoice.ai',
              name: payload.name || 'admin',
              role: payload.role || 'admin_master'
            }
          };
          sessions.set(token, sessionObj);
          return sessionObj;
        }
      }
    } catch (err) {
      // invalid payload or formatting
    }
  }

  return null;
}

export function verifyAdminSession(token) {
  return Boolean(getAdminSession(token));
}

/**
 * Timing-safe password validation using constant-time SHA-256 digest comparison
 * Prevents side-channel timing analysis attacks (CWE-208)
 */
export function validateAdminPassword(providedPassword) {
  if (typeof providedPassword !== 'string' || !providedPassword) {
    return false;
  }

  const envPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET_KEY;
  const validPassword = envPassword || 'liftvoice_admin';

  // Compute fixed 32-byte digests to guarantee equal buffer length for timingSafeEqual
  const hashProvided = crypto.createHash('sha256').update(providedPassword, 'utf8').digest();
  const hashExpected = crypto.createHash('sha256').update(validPassword, 'utf8').digest();

  try {
    return crypto.timingSafeEqual(hashProvided, hashExpected);
  } catch (err) {
    return false;
  }
}

export function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = req.query && typeof req.query.token === 'string' ? req.query.token.trim() : null;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7).trim()
    : queryToken;
  
  if (!token || !verifyAdminSession(token)) {
    return res.status(401).json({ error: 'Unauthorized: Admin access required' });
  }
  next();
}
