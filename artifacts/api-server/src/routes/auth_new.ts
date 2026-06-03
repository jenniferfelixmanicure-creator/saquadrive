import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, refreshTokensTable } from "@workspace/db";
import { signAccessToken, signRefreshToken } from "../lib/auth.js";

const router = Router();

// Nova lógica de recuperação de senha: Email + Celular
router.post("/auth/forgot-password-direct", async (req, res) => {
  try {
    const { email, phone } = req.body as { email: string; phone: string };
    
    if (!email || !phone) {
      res.status(400).json({ message: "E-mail e celular são obrigatórios" });
      return;
    }

    // Normalizar telefone (apenas números, últimos 9 dígitos)
    const normalize = (p: string) => p.replace(/\D/g, "").slice(-9);
    const normalizedPhone = normalize(phone);

    // Buscar usuário que coincida com e-mail e telefone
    const [user] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user || normalize(user.phone) !== normalizedPhone) {
      res.status(404).json({ message: "Dados incorretos. Verifique o e-mail e o celular." });
      return;
    }

    // Se os dados estiverem corretos, retornamos sucesso e permitimos avançar
    res.json({ 
      message: "Identidade verificada com sucesso.", 
      verified: true,
      userId: user.id 
    });
  } catch (err: any) {
    res.status(500).json({ message: `Erro interno: ${err.message}` });
  }
});

router.post("/auth/reset-password-direct", async (req, res) => {
  try {
    const { userId, newPassword } = req.body as { userId: number; newPassword: string };
    
    if (!userId || !newPassword) {
      res.status(400).json({ message: "Dados incompletos" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: "A senha deve ter no mínimo 6 caracteres" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    await db.update(usersTable)
      .set({ password: passwordHash })
      .where(eq(usersTable.id, userId));

    // Invalida sessões antigas
    await db.delete(refreshTokensTable).where(eq(refreshTokensTable.userId, userId));

    res.json({ message: "Senha redefinida com sucesso!" });
  } catch (err: any) {
    res.status(500).json({ message: `Erro interno: ${err.message}` });
  }
});

export default router;
