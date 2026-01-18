/**
 * =========================================================
 * Clinic Note - BASIC Authentication (Pseudo Implementation)
 * Path: /backend/auth.js
 *
 * Purpose:
 * - Minimal, deterministic BASIC Auth
 * - No external dependencies
 * - Safe for beginner understanding
 * =========================================================
 */

export function basicAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      error: 'Authorization header missing'
    });
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const decoded = Buffer.from(base64Credentials, 'base64')
      .toString('utf-8');

    const [username, password] = decoded.split(':');

    /**
     * NOTE:
     * In production, credentials must be stored as hashed values
     * (e.g., bcrypt) in PostgreSQL.
     * This is intentionally deterministic and simple.
     */
    if (
      username === process.env.BASIC_USER &&
      password === process.env.BASIC_PASSWORD
    ) {
      req.user = { username };
      return next();
    }

    return res.status(403).json({
      error: 'Invalid credentials'
    });

  } catch (err) {
    return res.status(400).json({
      error: 'Invalid Authorization format'
    });
  }
}
