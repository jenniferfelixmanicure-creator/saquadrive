import { Router } from "express";
import type { Response } from "express";
import { db } from "@workspace/db";
import { ratingsTable, ridesTable, driversTable, usersTable } from "@workspace/db/schema";
import { eq, avg, count, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireAuth } from "../middlewares/auth.js";
import type { AuthRequest } from "../middlewares/auth.js";

const router = Router();

// POST /api/ratings — criar avaliação (passageiro avalia motorista ou motorista avalia passageiro)
router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { rideId, ratedId, stars, comment, role } = req.body as {
    rideId?: string;
    ratedId?: number;
    stars?: number;
    comment?: string;
    role?: "passenger" | "driver";
  };

  if (!rideId || !ratedId || !stars || !role) {
    res.status(400).json({ message: "rideId, ratedId, stars e role são obrigatórios" });
    return;
  }

  if (stars < 1 || stars > 5) {
    res.status(400).json({ message: "Stars deve ser entre 1 e 5" });
    return;
  }

  try {
    // Verificar se já avaliou esta corrida com este role
    const existing = await db
      .select({ id: ratingsTable.id })
      .from(ratingsTable)
      .where(and(eq(ratingsTable.rideId, rideId), eq(ratingsTable.raterId, req.userId!), eq(ratingsTable.role, role)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ message: "Você já avaliou esta corrida" });
      return;
    }

    const [rating] = await db.insert(ratingsTable).values({
      rideId,
      raterId: req.userId!,
      ratedId,
      stars,
      comment,
      role,
    }).returning();

    // Atualizar nota média do motorista na tabela drivers
    if (role === "passenger") {
      const result = await db
        .select({ avg: avg(ratingsTable.stars) })
        .from(ratingsTable)
        .where(and(eq(ratingsTable.ratedId, ratedId), eq(ratingsTable.role, "passenger")));

      const newAvg = result[0]?.avg ?? "5.0";
      await db.update(driversTable).set({ rating: String(newAvg) }).where(eq(driversTable.userId, ratedId));

      // Atualizar status da corrida com a avaliação do passageiro
      await db.update(ridesTable).set({ passengerRating: stars }).where(eq(ridesTable.id, rideId));
    } else {
      // Motorista avaliou passageiro
      await db.update(ridesTable).set({ driverRating: stars }).where(eq(ridesTable.id, rideId));
    }

    logger.info({ rideId, raterId: req.userId, ratedId, stars, role }, "Avaliação registrada");
    res.status(201).json(rating);
  } catch (error) {
    logger.error({ error }, "Erro ao registrar avaliação");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// GET /api/ratings/driver/:userId — média de um motorista
router.get("/driver/:userId", async (req, res: Response) => {
  const userId = parseInt(req.params["userId"]);
  try {
    const result = await db
      .select({ avg: avg(ratingsTable.stars), total: count(ratingsTable.id) })
      .from(ratingsTable)
      .where(and(eq(ratingsTable.ratedId, userId), eq(ratingsTable.role, "passenger")));

    res.json({ average: result[0]?.avg ?? "5.0", total: result[0]?.total ?? 0 });
  } catch (error) {
    logger.error({ error }, "Erro ao buscar avaliação do motorista");
    res.status(500).json({ message: "Erro interno do servidor" });
  }
});

export default router;
