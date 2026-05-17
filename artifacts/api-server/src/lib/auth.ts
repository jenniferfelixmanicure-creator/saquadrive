import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const JWT_SECRET = process.env.JWT_SECRET ?? "zerorisco_jwt_secret_dev";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "zerorisco_refresh_secret_dev";
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

export function verifyRefreshTokenJwt(token: string): TokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
}
