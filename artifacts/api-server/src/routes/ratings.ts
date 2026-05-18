import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ratingsTable, usersTable } from "@workspace/db";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

router.post("/ratings", authenticate, async (req: AuthRequest, res) => {
  try {
    const { rideId, ratedId, stars, role } = req.body as {
      rideId: string; ratedId: number; stars: number; role: string;
    };
    if (!rideId || !ratedId || !stars || !role) {
      res.status(400).json({ message: "Campos obrigatórios faltando" }); return;
    }
    if (stars < 1 || stars > 5) {
      res.status(400).json({ message: "Avaliação deve ser entre 1 e 5" }); return;
    }
    const [existing] = await db.select({ id: ratingsTable.id })
      .from(ratingsTable)
      .where(sql`${ratingsTable.rideId} = ${rideId} AND ${ratingsTable.raterId} = ${req.user!.userId}`)
      .limit(1);
    if (existing) {
      res.status(409).json({ message: "Você já avaliou esta corrida" }); return;
    }
    await db.insert(ratingsTable).values({
      rideId, ratedId, raterId: req.user!.userId, stars, role,
    });
    const [avg] = await db.select({
      avg: sql<number>`round(avg(${ratingsTable.stars})::numeric, 2)`,
    }).from(ratingsTable).where(eq(ratingsTable.ratedId, ratedId));
    const newRating = avg?.avg ?? 5.0;
    if (role === "passenger") {
      await db.update(usersTable).set({ driverRating: newRating })
        .where(eq(usersTable.id, ratedId));
    } else {
      await db.update(usersTable).set({ passengerRating: newRating })
        .where(eq(usersTable.id, ratedId));
    }
    res.status(201).json({ message: "Avaliação registrada", rating: newRating });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

export default router;
