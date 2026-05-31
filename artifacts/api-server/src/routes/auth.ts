import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import twilio from "twilio";
import { db } from "@workspace/db";
import { usersTable, refreshTokensTable } from "@workspace/db";
import { signAccessToken, signRefreshToken } from "../lib/auth.js";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!client || !from) {
    return false;
  }
  try {
    await client.messages.create({ body, from, to });
    return true;
  } catch (err) {
    return false;
  }
}

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000, // Aumentado para testes do usuário
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Tente novamente em 15 minutos." },
  skip: () => process.env.NODE_ENV === "test",
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Limite de cadastros atingido. Tente novamente em 1 hora." },
  skip: () => process.env.NODE_ENV === "test",
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Muitas tentativas de recuperação. Tente novamente em 1 hora." },
  skip: () => process.env.NODE_ENV === "test",
});

router.post("/auth/register", registerLimiter, async (req, res) => {
  try {
    const { name, email, phone, password, role: rawRole } = req.body as {
      name: string; email: string; phone: string; password: string; role?: string;
    };
    if (!name || !email || !phone || !password) {
      res.status(400).json({ message: "Todos os campos são obrigatórios" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: "Senha deve ter no mínimo 6 caracteres" });
      return;
    }
    const role = rawRole === "driver" ? "driver" : "passenger";
    const existing = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ message: "E-mail já cadastrado" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      name, email: email.toLowerCase(), phone, passwordHash, role, isApproved: false,
    }).returning();
    const token = signAccessToken({ userId: user.id, role: user.role });
    const { token: refreshToken, expiresAt } = signRefreshToken();
    await db.insert(refreshTokensTable).values({ userId: user.id, token: refreshToken, expiresAt });
    res.status(201).json({
      token, refreshToken,
      user: { id: String(user.id), name: user.name, email: user.email, phone: user.phone, isApproved: user.isApproved, rgStatus: user.rgStatus },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ message: "E-mail e senha são obrigatórios" });
      return;
    }
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user) {
      res.status(401).json({ message: "E-mail ou senha incorretos" });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "E-mail ou senha incorretos" });
      return;
    }
    const token = signAccessToken({ userId: user.id, role: user.role });
    const { token: refreshToken, expiresAt } = signRefreshToken();
    await db.insert(refreshTokensTable).values({ userId: user.id, token: refreshToken, expiresAt });
    res.json({
      token, refreshToken,
      user: { id: String(user.id), name: user.name, email: user.email, phone: user.phone, isApproved: user.isApproved, rgStatus: user.rgStatus, profilePhotoUrl: user.profilePhotoUrl },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/auth/refresh", authLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) { res.status(400).json({ message: "refreshToken obrigatório" }); return; }
    const [stored] = await db.select().from(refreshTokensTable)
      .where(eq(refreshTokensTable.token, refreshToken)).limit(1);
    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ message: "Token de refresh inválido ou expirado" }); return;
    }
    const [user] = await db.select({ id: usersTable.id, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, stored.userId)).limit(1);
    if (!user) { res.status(401).json({ message: "Usuário não encontrado" }); return; }
    const newToken = signAccessToken({ userId: user.id, role: user.role });
    const { token: newRefresh, expiresAt } = signRefreshToken();
    await db.delete(refreshTokensTable).where(eq(refreshTokensTable.token, refreshToken));
    await db.insert(refreshTokensTable).values({ userId: user.id, token: newRefresh, expiresAt });
    res.json({ token: newToken, refreshToken: newRefresh });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/auth/change-password", authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Senha atual e nova senha são obrigatórias" }); return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ message: "Nova senha deve ter no mínimo 6 caracteres" }); return;
    }
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ message: "Usuário não encontrado" }); return; }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ message: "Senha atual incorreta" }); return; }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
    await db.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, user.id));
    res.json({ message: "Senha alterada com sucesso" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/auth/forgot-password", forgotLimiter, async (req, res) => {
  try {
    const { email, phone } = req.body as { email: string; phone?: string };
    if (!email) {
      res.status(400).json({ message: "E-mail é obrigatório" });
      return;
    }

    const [user] = await db.select({ id: usersTable.id, phone: usersTable.phone })
      .from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);

    // Always respond generically to avoid user enumeration
    const genericOk = { message: "Identidade verificada. Você pode redefinir sua senha.", verified: true };
    const genericFail = { message: "E-mail ou telefone incorretos.", verified: false };

    if (!user) {
      // Introduce artificial delay to prevent timing attacks
      await new Promise(r => setTimeout(r, 400));
      res.json(genericFail);
      return;
    }

    // If phone provided, verify it matches (digits only comparison)
    if (phone !== undefined) {
      const normalize = (p: string) => p.replace(/\D/g, "").slice(-9);
      if (normalize(phone) !== normalize(user.phone)) {
        req.log.warn({ userId: user.id }, "Tentativa de recuperação com telefone incorreto");
        res.json(genericFail);
        return;
      }
    }

    // Generate a secure reset token
    const resetToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const resetHash = await bcrypt.hash(resetToken, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.update(usersTable).set({
      passwordResetToken: resetHash,
      passwordResetExpiresAt: expiresAt,
    }).where(eq(usersTable.id, user.id));

    req.log.info({ userId: user.id }, "Token de recuperação gerado via verificação de telefone");
    res.json({ ...genericOk, resetToken });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/auth/reset-password", forgotLimiter, async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body as {
      email: string; resetToken: string; newPassword: string;
    };
    if (!email || !resetToken || !newPassword) {
      res.status(400).json({ message: "Dados incompletos para redefinição de senha" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ message: "Nova senha deve ter no mínimo 6 caracteres" });
      return;
    }
    const [user] = await db.select({
      id: usersTable.id,
      passwordResetToken: usersTable.passwordResetToken,
      passwordResetExpiresAt: usersTable.passwordResetExpiresAt,
    }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);

    if (!user || !user.passwordResetToken || !user.passwordResetExpiresAt) {
      res.status(400).json({ message: "Solicitação de recuperação inválida ou expirada" });
      return;
    }
    if (user.passwordResetExpiresAt < new Date()) {
      res.status(400).json({ message: "Sessão expirada (15 min). Inicie o processo novamente." });
      return;
    }
    const tokenValid = await bcrypt.compare(resetToken, user.passwordResetToken);
    if (!tokenValid) {
      res.status(400).json({ message: "Token inválido. Inicie o processo novamente." });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    }).where(eq(usersTable.id, user.id));
    await db.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, user.id));
    req.log.info({ userId: user.id }, "Senha redefinida via verificação de telefone");
    res.json({ message: "Senha redefinida com sucesso. Faça login com a nova senha." });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

export default router;
