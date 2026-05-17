import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ridesTable, usersTable } from "@workspace/db";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

router.get("/rides/history", authenticate, async (req: AuthRequest, res) => {
  try {
    const rides = await db.select().from(ridesTable)
      .where(eq(ridesTable.passengerId, req.user!.userId))
      .orderBy(desc(ridesTable.createdAt))
      .limit(50);
    res.json(rides);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.get("/rides/driver/history", authenticate, async (req: AuthRequest, res) => {
  try {
    const rides = await db.select().from(ridesTable)
      .where(eq(ridesTable.driverId, req.user!.userId))
      .orderBy(desc(ridesTable.createdAt))
      .limit(50);
    res.json(rides);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.get("/rides/driver/stats", authenticate, async (req: AuthRequest, res) => {
  try {
    const driverId = req.user!.userId;
    const [totals] = await db.select({
      totalRides: sql<number>`count(*)::int`,
      totalEarnings: sql<number>`coalesce(sum(${ridesTable.price}), 0)`,
    }).from(ridesTable).where(eq(ridesTable.driverId, driverId));

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [weekly] = await db.select({
      weekRides: sql<number>`count(*)::int`,
      weekEarnings: sql<number>`coalesce(sum(${ridesTable.price}), 0)`,
    }).from(ridesTable).where(
      sql`${ridesTable.driverId} = ${driverId} AND ${ridesTable.createdAt} >= ${startOfWeek}`
    );

    const [monthly] = await db.select({
      monthRides: sql<number>`count(*)::int`,
      monthEarnings: sql<number>`coalesce(sum(${ridesTable.price}), 0)`,
    }).from(ridesTable).where(
      sql`${ridesTable.driverId} = ${driverId} AND ${ridesTable.createdAt} >= ${startOfMonth}`
    );

    const [driver] = await db.select({ driverRating: usersTable.driverRating })
      .from(usersTable).where(eq(usersTable.id, driverId)).limit(1);

    res.json({
      totalRides: totals?.totalRides ?? 0,
      totalEarnings: totals?.totalEarnings ?? 0,
      weekRides: weekly?.weekRides ?? 0,
      weekEarnings: weekly?.weekEarnings ?? 0,
      monthRides: monthly?.monthRides ?? 0,
      monthEarnings: monthly?.monthEarnings ?? 0,
      rating: driver?.driverRating ?? 5.0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

export default router;
