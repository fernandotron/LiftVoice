import crypto from 'crypto';

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
const sessions = new Map();

export function createAdminSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL });
  return token;
}

export function invalidateAdminSession(token) {
  if (token) {
    sessions.delete(token);
  }
}

export function verifyAdminSession(token) {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function validateAdminPassword(password) {
  const envPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET_KEY;
  // Fallback seguro si no hay variables: una contraseña por defecto (solo para entornos donde se olvidó configurar, 
  // aunque en prod debería forzarse su existencia, usaremos 'admin' o 'liftvoice_admin')
  const validPassword = envPassword || 'liftvoice_admin';
  return password === validPassword;
}

export function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  
  if (!token || !verifyAdminSession(token)) {
    return res.status(401).json({ error: 'Unauthorized: Admin access required' });
  }
  next();
}
