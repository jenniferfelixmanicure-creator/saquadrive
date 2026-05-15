import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { signToken, signRefreshToken, verifyRefreshToken, requireAuth } from "../middlewares/auth.js";
import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth.js";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { name, email, phone, password, role } = req.body as {
    name?: string; email?: string; phone?: string; password?: string; role?: string;
  };

  if (!name || !email || !phone || !password) {
    res.status(400).json({ message: "Todos os campos são obrigatórios" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
    return;
  }

  try {
    const existing = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (existing.length > 0) {
      res.status(409).json({ message: "E-mail já cadastrado" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role === "driver" ? "driver" : "passenger";

    const [user] = await db.insert(usersTable)
      .values({ name, email, phone, passwordHash, role: userRole })
      .returning();

    const token = signToken(user.id);
    const refreshToken = signRefreshToken(user.id);
    logger.info({ userId: user.id }, "User registered");

    res.status(201).json({
      token,
      refreshToken,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isApproved: user.isApproved,
        rgStatus: user.rgStatus,
      },
    });
  } catch (error) {
    logger.error({ error }, "Erro ao registrar usuário");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: "E-mail e senha são obrigatórios" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (!user) {
      res.status(401).json({ message: "Credenciais inválidas" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Credenciais inválidas" });
      return;
    }

    const token = signToken(user.id);
    const refreshToken = signRefreshToken(user.id);
    logger.info({ userId: user.id }, "User logged in");

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isApproved: user.isApproved,
        rgStatus: user.rgStatus,
      },
    });
  } catch (error) {
    logger.error({ error }, "Erro ao fazer login");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// POST /api/auth/refresh — renovar token
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    res.status(400).json({ message: "refreshToken é obrigatório" });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);

    if (!user) {
      res.status(401).json({ message: "Usuário não encontrado" });
      return;
    }

    const newToken = signToken(user.id);
    const newRefreshToken = signRefreshToken(user.id);

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ message: "Refresh token inválido ou expirado" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

    if (!user) {
      res.status(404).json({ message: "Usuário não encontrado" });
      return;
    }

    res.json({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isApproved: user.isApproved,
      rgStatus: user.rgStatus,
      rgUrl: user.rgUrl,
    });
  } catch (error) {
    logger.error({ error }, "Erro ao buscar usuário");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// POST /api/auth/change-password
router.post("/change-password", requireAuth, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ message: "Senha atual e nova senha são obrigatórias" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ message: "A nova senha deve ter pelo menos 6 caracteres" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);

    if (!user) {
      res.status(404).json({ message: "Usuário não encontrado" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Senha atual incorreta" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(usersTable.id, req.userId!));

    res.json({ message: "Senha alterada com sucesso" });
  } catch (error) {
    logger.error({ error }, "Erro ao alterar senha");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

export default router;
