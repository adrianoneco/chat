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
  if (req.session && (req.session as any).userId) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
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
