import jwt from 'jsonwebtoken';
import { loadConfig } from '../config.js';

export interface TokenPayload {
  userId: string;
  email?: string;
  role: string;
}

export function signToken(payload: TokenPayload): string {
  const config = loadConfig();
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
  const config = loadConfig();
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}
