import { verifyToken } from '../utils/jwt.js';

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Token missing' });

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyToken(token);
    req.user = payload; // make sure to define req.user type globally
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token', details: err });
  }
};
