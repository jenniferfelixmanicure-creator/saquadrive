import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

router.get("/users/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, req.user!.userId)).limit(1);
    if (!user) { res.status(404).json({ message: "Usuário não encontrado" }); return; }
    const { passwordHash, ...safe } = user;
    res.json({ ...safe, id: String(safe.id) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.put("/users/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, phone, vehiclePlate, vehicleModel, vehicleYear, vehicleType } = req.body as {
      name?: string; phone?: string; vehiclePlate?: string;
      vehicleModel?: string; vehicleYear?: number; vehicleType?: string;
    };
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (vehiclePlate !== undefined) updates.vehiclePlate = vehiclePlate;
    if (vehicleModel !== undefined) updates.vehicleModel = vehicleModel;
    if (vehicleYear !== undefined) updates.vehicleYear = vehicleYear;
    if (vehicleType !== undefined) updates.vehicleType = vehicleType;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "Nenhum campo para atualizar" }); return;
    }
    const [updated] = await db.update(usersTable).set(updates)
      .where(eq(usersTable.id, req.user!.userId)).returning();
    const { passwordHash, ...safe } = updated;
    res.json({ ...safe, id: String(safe.id) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

// ── Registrar token Expo Push ──────────────────────────────────────────────────

router.post("/users/me/expo-token", authenticate, async (req: AuthRequest, res) => {
  try {
    const { expoPushToken } = req.body as { expoPushToken?: string };
    if (!expoPushToken?.trim()) {
      res.status(400).json({ message: "expoPushToken é obrigatório" }); return;
    }
    await db.update(usersTable)
      .set({ expoPushToken: expoPushToken.trim() })
      .where(eq(usersTable.id, req.user!.userId));
    res.json({ message: "Token registrado com sucesso" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

export default router;
