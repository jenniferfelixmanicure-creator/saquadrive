import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(
      `[ZeroRisco] Variável de ambiente obrigatória ausente: ${key}. ` +
      `Configure-a antes de iniciar o servidor.`
    );
  }
  return val;
}

const JWT_SECRET = requireEnv("JWT_SECRET");
const ACCESS_TTL = "2h";
const REFRESH_TTL_DAYS = 30;

export type TokenPayload = { userId: number; role: string };

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(): { token: string; expiresAt: Date } {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);
  return { token, expiresAt };
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
