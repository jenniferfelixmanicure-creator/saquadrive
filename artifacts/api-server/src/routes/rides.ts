import { Router } from "express";
import type { Response } from "express";
import { db } from "@workspace/db";
import { ridesTable, chatMessagesTable } from "@workspace/db/schema";
import { eq, desc, asc, and, or, count, gte } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middlewares/auth.js";
import type { AuthRequest } from "../middlewares/auth.js";

const router = Router();

// GET /api/rides/history — histórico de corridas do passageiro
router.get("/history", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const rides = await db
      .select()
      .from(ridesTable)
      .where(eq(ridesTable.passengerId, req.userId!))
      .orderBy(desc(ridesTable.createdAt))
      .limit(50);

    res.json(rides);
  } catch (error) {
    logger.error({ error }, "Erro ao buscar histórico do passageiro");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// GET /api/rides/driver/history — histórico de corridas do motorista
router.get("/driver/history", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const rides = await db
      .select()
      .from(ridesTable)
      .where(eq(ridesTable.driverId, req.userId!))
      .orderBy(desc(ridesTable.createdAt))
      .limit(50);

    res.json(rides);
  } catch (error) {
    logger.error({ error }, "Erro ao buscar histórico do motorista");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// GET /api/rides/driver/stats — estatísticas do motorista (metas e recompensas)
router.get("/driver/stats", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [todayRidesResult] = await db
      .select({ count: count(ridesTable.id) })
      .from(ridesTable)
      .where(and(
        eq(ridesTable.driverId, req.userId!),
        eq(ridesTable.status, "completed"),
        gte(ridesTable.createdAt, startOfDay)
      ));

    const [todayFiveStarsResult] = await db
      .select({ count: count(ridesTable.id) })
      .from(ridesTable)
      .where(and(
        eq(ridesTable.driverId, req.userId!),
        eq(ridesTable.status, "completed"),
        eq(ridesTable.passengerRating, 5),
        gte(ridesTable.createdAt, startOfDay)
      ));

    const [totalRidesResult] = await db
      .select({ count: count(ridesTable.id) })
      .from(ridesTable)
      .where(and(
        eq(ridesTable.driverId, req.userId!),
        eq(ridesTable.status, "completed")
      ));

    res.json({
      todayRides: Number(todayRidesResult?.count ?? 0),
      todayFiveStars: Number(todayFiveStarsResult?.count ?? 0),
      totalRides: Number(totalRidesResult?.count ?? 0),
    });
  } catch (error) {
    logger.error({ error }, "Erro ao buscar stats do motorista");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// GET /api/rides/:rideId/chat — histórico de mensagens de uma corrida
router.get("/:rideId/chat", requireAuth, async (req: AuthRequest, res: Response) => {
  const { rideId } = req.params as { rideId: string };
  try {
    const [ride] = await db
      .select({ passengerId: ridesTable.passengerId, driverId: ridesTable.driverId })
      .from(ridesTable)
      .where(eq(ridesTable.id, rideId))
      .limit(1);

    if (!ride) {
      res.status(404).json({ message: "Corrida não encontrada" });
      return;
    }

    const isParticipant = ride.passengerId === req.userId || ride.driverId === req.userId;
    if (!isParticipant) {
      res.status(403).json({ message: "Acesso negado" });
      return;
    }

    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.rideId, rideId))
      .orderBy(asc(chatMessagesTable.timestamp));

    res.json(messages.map((m) => ({
      id: m.id.toString(),
      senderId: m.senderId,
      senderName: m.senderName,
      text: m.message,
      timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now(),
    })));
  } catch (error) {
    logger.error({ error }, "Erro ao buscar mensagens da corrida");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// GET /api/rides/:rideId — detalhes de uma corrida
router.get("/:rideId", requireAuth, async (req: AuthRequest, res: Response) => {
  const { rideId } = req.params as { rideId: string };
  try {
    const [ride] = await db
      .select()
      .from(ridesTable)
      .where(eq(ridesTable.id, rideId))
      .limit(1);

    if (!ride) {
      res.status(404).json({ message: "Corrida não encontrada" });
      return;
    }

    res.json(ride);
  } catch (error) {
    logger.error({ error }, "Erro ao buscar corrida");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

export default router;
