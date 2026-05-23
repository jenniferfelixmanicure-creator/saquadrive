import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type TokenPayload } from "../lib/auth.js";

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token não fornecido" });
    return;
  }
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Acesso negado" });
      return;
    }
    next();
  };
}

export function authenticateAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const adminSecret = process.env.ADMIN_SECRET;

  const headerSecret = req.headers["x-admin-secret"] as string | undefined;
  if (adminSecret && headerSecret === adminSecret) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = verifyAccessToken(authHeader.slice(7));
      if (payload.role === "admin") {
        req.user = payload;
        next();
        return;
      }
    } catch {}
  }

  res.status(401).json({ message: "Acesso não autorizado" });
}
