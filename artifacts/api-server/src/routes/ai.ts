import { Router } from "express";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";
import {
  askZeroRiscoIA,
  getSupportResponse,
  assessRideRisk,
  detectFraud,
  getDriverSuggestions,
  getAdminInsights,
  analyzeDriverBehavior,
} from "../lib/ai.js";
import { db } from "@workspace/db";
import { ridesTable, usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.post("/ai/chat", authenticate, async (req: AuthRequest, res) => {
  try {
    const { message, context } = req.body as { message?: string; context?: string };
    if (!message?.trim()) {
      res.status(400).json({ error: "Mensagem obrigatória" });
      return;
    }
    const answer = await askZeroRiscoIA(message, context ?? "");
    res.json({ answer, from: "ZeroRisco IA" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "ZeroRisco IA indisponível no momento" });
  }
});

router.post("/ai/support", authenticate, async (req: AuthRequest, res) => {
  try {
    const { question } = req.body as { question?: string };
    if (!question?.trim()) {
      res.status(400).json({ error: "Pergunta obrigatória" });
      return;
    }
    const role = (req.user?.role as "passenger" | "driver" | "admin") ?? "passenger";
    const result = await getSupportResponse(question, role);
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Suporte IA indisponível" });
  }
});

router.post("/ai/risk", authenticate, async (req: AuthRequest, res) => {
  try {
    const { neighborhood, passengerRating, driverRating, rideType, distanceKm, passengerCancellations } = req.body as {
      neighborhood?: string;
      passengerRating?: number;
      driverRating?: number;
      rideType?: string;
      distanceKm?: number;
      passengerCancellations?: number;
    };
    const result = await assessRideRisk({
      hour: new Date().getHours(),
      neighborhood: neighborhood ?? "não informado",
      passengerRating: passengerRating ?? 5,
      driverRating: driverRating ?? 5,
      rideType: rideType ?? "basico",
      distanceKm: distanceKm ?? 5,
      passengerCancellations: passengerCancellations ?? 0,
    });
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Avaliação de risco indisponível" });
  }
});

router.post("/ai/fraud", authenticate, async (req: AuthRequest, res) => {
  try {
    const { passengerId, driverId, rideId, cancelCount, multipleAccounts, suspiciousGPS, emulator } = req.body as {
      passengerId?: string;
      driverId?: string;
      rideId?: string;
      cancelCount?: number;
      multipleAccounts?: boolean;
      suspiciousGPS?: boolean;
      emulator?: boolean;
    };
    if (!passengerId || !rideId) {
      res.status(400).json({ error: "passengerId e rideId obrigatórios" });
      return;
    }
    const result = await detectFraud({
      passengerId,
      driverId,
      rideId,
      cancelCount,
      multipleAccounts,
      suspiciousGPS,
      emulator,
    });
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Verificação antifraude indisponível" });
  }
});

router.get("/ai/driver/suggestions", authenticate, async (req: AuthRequest, res) => {
  try {
    const driverId = req.user!.userId;
    const [driver] = await db
      .select({ totalRides: usersTable.totalRides, driverRating: usersTable.driverRating })
      .from(usersTable)
      .where(eq(usersTable.id, driverId));

    const [earnings] = await db
      .select({ weekEarnings: sql<number>`coalesce(sum(${ridesTable.price}), 0)` })
      .from(ridesTable)
      .where(
        sql`${ridesTable.driverId} = ${driverId} AND ${ridesTable.status} = 'completed' AND ${ridesTable.createdAt} >= now() - interval '7 days'`
      );

    const result = await getDriverSuggestions({
      totalRides: driver?.totalRides ?? 0,
      weekEarnings: Number(earnings?.weekEarnings ?? 0),
      currentHour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      rideType: "basico",
    });
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Sugestões IA indisponíveis" });
  }
});

router.post("/ai/behavior", authenticate, async (req: AuthRequest, res) => {
  try {
    const { driverId, avgSpeed, hardBrakes, suddenAccelerations, phoneUsageEvents } = req.body as {
      driverId?: string;
      avgSpeed?: number;
      hardBrakes?: number;
      suddenAccelerations?: number;
      phoneUsageEvents?: number;
    };
    if (!driverId) {
      res.status(400).json({ error: "driverId obrigatório" });
      return;
    }

    const id = parseInt(driverId);
    const [driver] = await db
      .select({ totalRides: usersTable.totalRides, driverRating: usersTable.driverRating })
      .from(usersTable)
      .where(eq(usersTable.id, id));

    const result = await analyzeDriverBehavior({
      driverId,
      avgSpeed: avgSpeed ?? 40,
      hardBrakes: hardBrakes ?? 0,
      suddenAccelerations: suddenAccelerations ?? 0,
      phoneUsageEvents: phoneUsageEvents ?? 0,
      totalRides: driver?.totalRides ?? 0,
      rating: driver?.driverRating ?? 5,
    });
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Análise comportamental indisponível" });
  }
});

router.get("/ai/admin/insights", authenticate, async (req: AuthRequest, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [ridesStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        earnings: sql<number>`coalesce(sum(case when ${ridesTable.status} = 'completed' then ${ridesTable.price} else 0 end), 0)`,
        cancelled: sql<number>`count(case when ${ridesTable.status} = 'cancelled' then 1 end)::int`,
      })
      .from(ridesTable)
      .where(sql`${ridesTable.createdAt} >= ${today}`);

    const [driverStats] = await db
      .select({ active: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(sql`${usersTable.role} = 'driver' AND ${usersTable.isApproved} = true`);

    const [pendingDocs] = await db
      .select({ pending: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(sql`${usersTable.role} = 'driver' AND ${usersTable.isApproved} = false`);

    const result = await getAdminInsights({
      totalRidesToday: ridesStats?.total ?? 0,
      totalEarningsToday: Number(ridesStats?.earnings ?? 0),
      cancelledRides: ridesStats?.cancelled ?? 0,
      activeDrivers: driverStats?.active ?? 0,
      pendingDocuments: pendingDocs?.pending ?? 0,
      suspiciousActivities: 0,
    });
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Insights administrativos indisponíveis" });
  }
});

export default router;
