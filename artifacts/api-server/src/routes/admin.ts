import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";
import { db } from "@workspace/db";
import { usersTable, driversTable, ridesTable } from "@workspace/db/schema";
import { eq, and, count, desc } from "drizzle-orm";

const router = Router();

const ADMIN_SECRET = process.env["ADMIN_SECRET"] ?? "saquadrive_admin_2025";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (!secret || secret !== ADMIN_SECRET) {
    res.status(401).json({ message: "Acesso negado" });
    return;
  }
  next();
}

// GET /api/admin/stats — resumo geral
router.get("/stats", requireAdmin, async (_req, res: Response) => {
  try {
    const [totalUsers] = await db.select({ count: count() }).from(usersTable);
    const [totalDrivers] = await db.select({ count: count() }).from(driversTable);
    const [pendingUsers] = await db.select({ count: count() }).from(usersTable)
      .where(and(eq(usersTable.rgStatus, "pending"), eq(usersTable.isApproved, false)));
    const [pendingDrivers] = await db.select({ count: count() }).from(driversTable)
      .where(and(eq(driversTable.cnhStatus, "pending"), eq(driversTable.isApproved, false)));
    const [totalRides] = await db.select({ count: count() }).from(ridesTable);
    const [completedRides] = await db.select({ count: count() }).from(ridesTable)
      .where(eq(ridesTable.status, "completed"));

    res.json({
      totalUsers: totalUsers.count,
      totalDrivers: totalDrivers.count,
      pendingUsers: pendingUsers.count,
      pendingDrivers: pendingDrivers.count,
      totalRides: totalRides.count,
      completedRides: completedRides.count,
    });
  } catch (error) {
    logger.error({ error }, "Erro ao buscar stats");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// GET /api/admin/users/pending — passageiros pendentes de aprovação
router.get("/users/pending", requireAdmin, async (_req, res: Response) => {
  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.rgStatus, "pending"))
      .orderBy(desc(usersTable.createdAt))
      .limit(100);
    res.json(users);
  } catch (error) {
    logger.error({ error }, "Erro ao buscar usuários pendentes");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// GET /api/admin/users/all — todos os usuários
router.get("/users/all", requireAdmin, async (_req, res: Response) => {
  try {
    const users = await db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(200);
    res.json(users);
  } catch (error) {
    logger.error({ error }, "Erro ao buscar usuários");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// GET /api/admin/drivers/pending — motoristas pendentes de aprovação
router.get("/drivers/pending", requireAdmin, async (_req, res: Response) => {
  try {
    const drivers = await db
      .select({
        driver: driversTable,
        user: usersTable,
      })
      .from(driversTable)
      .innerJoin(usersTable, eq(driversTable.userId, usersTable.id))
      .where(eq(driversTable.isApproved, false))
      .orderBy(desc(driversTable.createdAt))
      .limit(100);

    res.json(drivers);
  } catch (error) {
    logger.error({ error }, "Erro ao buscar motoristas pendentes");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// GET /api/admin/drivers/all — todos os motoristas
router.get("/drivers/all", requireAdmin, async (_req, res: Response) => {
  try {
    const drivers = await db
      .select({
        driver: driversTable,
        user: usersTable,
      })
      .from(driversTable)
      .innerJoin(usersTable, eq(driversTable.userId, usersTable.id))
      .orderBy(desc(driversTable.createdAt))
      .limit(200);

    res.json(drivers);
  } catch (error) {
    logger.error({ error }, "Erro ao buscar motoristas");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// POST /api/admin/users/:userId/approve — aprovar passageiro
router.post("/users/:userId/approve", requireAdmin, async (req, res: Response) => {
  const userId = parseInt(req.params["userId"] as string);
  try {
    await db.update(usersTable)
      .set({ rgStatus: "approved", isApproved: true, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));
    logger.info({ userId }, "Usuário aprovado pelo admin");
    res.json({ message: "Passageiro aprovado com sucesso." });
  } catch (error) {
    logger.error({ error }, "Erro ao aprovar usuário");
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// POST /api/admin/users/:userId/reject — rejeitar passageiro
router.post("/users/:userId/reject", requireAdmin, async (req, res: Response) => {
  const userId = parseInt(req.params["userId"] as string);
  const { reason } = req.body as { reason?: string };
  try {
    await db.update(usersTable)
      .set({ rgStatus: "rejected", isApproved: false, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));
    logger.info({ userId, reason }, "Usuário rejeitado pelo admin");
    res.json({ message: "Passageiro rejeitado." });
  } catch (error) {
    logger.error({ error }, "Erro ao rejeitar usuário");
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// POST /api/admin/drivers/:driverId/approve — aprovar motorista
router.post("/drivers/:driverId/approve", requireAdmin, async (req, res: Response) => {
  const driverId = parseInt(req.params["driverId"] as string);
  try {
    const [driver] = await db
      .select({ userId: driversTable.userId })
      .from(driversTable)
      .where(eq(driversTable.id, driverId))
      .limit(1);

    await db.update(driversTable)
      .set({ cnhStatus: "approved", crlvStatus: "approved", isApproved: true, updatedAt: new Date() })
      .where(eq(driversTable.id, driverId));

    if (driver) {
      await db.update(usersTable)
        .set({ isApproved: true, updatedAt: new Date() })
        .where(eq(usersTable.id, driver.userId));
    }

    logger.info({ driverId }, "Motorista aprovado pelo admin");
    res.json({ message: "Motorista aprovado com sucesso." });
  } catch (error) {
    logger.error({ error }, "Erro ao aprovar motorista");
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// POST /api/admin/drivers/:driverId/reject — rejeitar motorista
router.post("/drivers/:driverId/reject", requireAdmin, async (req, res: Response) => {
  const driverId = parseInt(req.params["driverId"] as string);
  const { reason } = req.body as { reason?: string };
  try {
    await db.update(driversTable)
      .set({ cnhStatus: "rejected", crlvStatus: "rejected", isApproved: false, updatedAt: new Date() })
      .where(eq(driversTable.id, driverId));
    logger.info({ driverId, reason }, "Motorista rejeitado pelo admin");
    res.json({ message: "Motorista rejeitado." });
  } catch (error) {
    logger.error({ error }, "Erro ao rejeitar motorista");
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// GET /api/admin/rides — últimas corridas
router.get("/rides", requireAdmin, async (_req, res: Response) => {
  try {
    const rides = await db
      .select()
      .from(ridesTable)
      .orderBy(desc(ridesTable.createdAt))
      .limit(100);
    res.json(rides);
  } catch (error) {
    logger.error({ error }, "Erro ao buscar corridas");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

export default router;
