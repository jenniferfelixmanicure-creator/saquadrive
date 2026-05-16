import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, driversTable, ridesTable, ratingsTable } from "@workspace/db/schema";
import { eq, count, avg, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middlewares/auth.js";
import type { Response } from "express";
import type { AuthRequest } from "../middlewares/auth.js";

const router = Router();

// GET /api/users/me
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);

    if (!user) {
      res.status(404).json({ message: "Usuário não encontrado" });
      return;
    }

    // Buscar dados de motorista se existir
    const [driver] = await db.select()
      .from(driversTable)
      .where(eq(driversTable.userId, user.id))
      .limit(1);

    let totalRides = 0;
    let driverRating: number | null = null;

    if (driver) {
      // Contagem real de corridas concluídas (não campo cacheado que pode ter bugs)
      const [rideCount] = await db
        .select({ count: count(ridesTable.id) })
        .from(ridesTable)
        .where(and(
          eq(ridesTable.driverId, user.id),
          eq(ridesTable.status, "completed")
        ));
      totalRides = rideCount?.count ?? 0;

      // Média real de avaliações recebidas pelo motorista
      const [ratingResult] = await db
        .select({ avg: avg(ratingsTable.stars) })
        .from(ratingsTable)
        .where(and(
          eq(ratingsTable.ratedId, user.id),
          eq(ratingsTable.role, "passenger")
        ));
      driverRating = ratingResult?.avg != null ? Math.round(parseFloat(String(ratingResult.avg)) * 10) / 10 : null;
    }

    res.json({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      isApproved: user.isApproved,
      rgStatus: user.rgStatus,
      rgUrl: user.rgUrl,
      profilePhotoUrl: user.profilePhotoUrl,
      ...(driver ? {
        cnhStatus: driver.cnhStatus,
        cnhUrl: driver.cnhUrl,
        crlvStatus: driver.crlvStatus,
        crlvUrl: driver.crlvUrl,
        vehiclePlate: driver.vehiclePlate,
        vehicleModel: driver.vehicleModel,
        vehicleYear: driver.vehicleYear,
        vehicleType: driver.vehicleType,
        vehicleColor: driver.vehicleColor,
        driverApproved: driver.isApproved,
        totalRides,
        driverRating,
      } : {}),
    });
  } catch (error) {
    logger.error({ error }, "Erro ao buscar perfil");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// PUT /api/users/me
router.put("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  const { name, phone } = req.body as { name?: string; phone?: string };

  try {
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;

    if (Object.keys(updates).length > 0) {
      await db.update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, req.userId!));
    }

    const [user] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);

    res.json({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
    });
  } catch (error) {
    logger.error({ error }, "Erro ao atualizar perfil");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

export default router;
