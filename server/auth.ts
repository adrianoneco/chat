import argon2 from 'argon2';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  // Allow session-based auth
  if (req.session && (req.session as any).userId) {
    return next();
  }

  // Allow global API key via header `x-api-key` or `Authorization: Bearer <key>`
  const globalKey = process.env.GLOBAL_API_KEY;
  if (globalKey) {
    const headerKey = (req.headers['x-api-key'] as string) || undefined;
    const authHeader = (req.headers['authorization'] as string) || undefined;
    let token: string | undefined;
    if (headerKey) token = headerKey.trim();
    else if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) token = authHeader.slice(7).trim();

    if (token && token === globalKey) {
      // mark request as using global key so downstream handlers can detect it if needed
      (req as any).globalApiKey = true;
      return next();
    }
  }

  return res.status(401).json({ message: 'Unauthorized' });
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // If using global API key, treat as admin
    const globalKey = process.env.GLOBAL_API_KEY;
    if (globalKey) {
      const headerKey = (req.headers['x-api-key'] as string) || undefined;
      const authHeader = (req.headers['authorization'] as string) || undefined;
      let token: string | undefined;
      if (headerKey) token = headerKey.trim();
      else if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) token = authHeader.slice(7).trim();
      if (token && token === globalKey) {
        // global key should be considered as admin
        if (!roles.includes('admin')) {
          // route does not require admin specifically, but global key is powerful
        }
        return next();
      }
    }

    if (!req.session || !(req.session as any).userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const userRole = (req.session as any).userRole;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    
    return next();
  };
}
