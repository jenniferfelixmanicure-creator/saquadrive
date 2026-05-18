import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ridesTable, usersTable, promoCodesTable, ratingsTable } from "@workspace/db";
import { authenticate, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

router.get("/rides/history", authenticate, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select({
      id: ridesTable.id,
      originAddress: ridesTable.originAddress,
      originLat: ridesTable.originLat,
      originLng: ridesTable.originLng,
      destAddress: ridesTable.destinationAddress,
      destLat: ridesTable.destinationLat,
      destLng: ridesTable.destinationLng,
      rideType: ridesTable.rideType,
      price: ridesTable.price,
      status: ridesTable.status,
      distance: ridesTable.distance,
      duration: ridesTable.duration,
      waitTimeFee: ridesTable.waitTimeFee,
      promoCode: ridesTable.promoCode,
      promoDiscount: ridesTable.promoDiscount,
      createdAt: ridesTable.createdAt,
      completedAt: ridesTable.completedAt,
      driverName: usersTable.name,
      driverRating: usersTable.driverRating,
      vehicleModel: usersTable.vehicleModel,
      vehiclePlate: usersTable.vehiclePlate,
      vehicleColor: usersTable.vehicleColor,
    }).from(ridesTable)
      .leftJoin(usersTable, eq(ridesTable.driverId, usersTable.id))
      .where(eq(ridesTable.passengerId, req.user!.userId))
      .orderBy(desc(ridesTable.createdAt)).limit(50);

    res.json(rows.map(r => ({
      id: r.id,
      originAddress: r.originAddress,
      originLat: r.originLat,
      originLng: r.originLng,
      destAddress: r.destAddress,
      destLat: r.destLat,
      destLng: r.destLng,
      rideType: r.rideType,
      price: r.price,
      status: r.status,
      distance: r.distance,
      duration: r.duration,
      waitTimeFee: r.waitTimeFee,
      promoCode: r.promoCode,
      promoDiscount: r.promoDiscount,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      driver: r.driverName ? {
        name: r.driverName,
        rating: r.driverRating,
        vehicleModel: r.vehicleModel,
        vehiclePlate: r.vehiclePlate,
        vehicleColor: r.vehicleColor ?? null,
      } : null,
    })));
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.get("/rides/driver/history", authenticate, async (req: AuthRequest, res) => {
  try {
    const rides = await db.select({
      id: ridesTable.id,
      originAddress: ridesTable.originAddress,
      destAddress: ridesTable.destinationAddress,
      rideType: ridesTable.rideType,
      price: ridesTable.price,
      status: ridesTable.status,
      distance: ridesTable.distance,
      duration: ridesTable.duration,
      createdAt: ridesTable.createdAt,
      passengerStars: ratingsTable.stars,
    }).from(ridesTable)
      .leftJoin(
        ratingsTable,
        sql`${ratingsTable.rideId} = ${ridesTable.id} AND ${ratingsTable.ratedId} = ${ridesTable.driverId} AND ${ratingsTable.role} = 'passenger'`
      )
      .where(eq(ridesTable.driverId, req.user!.userId))
      .orderBy(desc(ridesTable.createdAt)).limit(50);
    res.json(rides.map(r => ({
      id: r.id,
      originAddress: r.originAddress,
      destAddress: r.destAddress,
      rideType: r.rideType,
      price: r.price,
      status: r.status,
      distance: r.distance,
      duration: r.duration,
      driverRating: r.passengerStars ?? null,
      createdAt: r.createdAt,
    })));
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.get("/rides/driver/stats", authenticate, async (req: AuthRequest, res) => {
  try {
    const driverId = req.user!.userId;
    const [totals] = await db.select({
      totalRides: sql<number>`count(*)::int`,
      totalEarnings: sql<number>`coalesce(sum(${ridesTable.price}), 0)`,
    }).from(ridesTable).where(sql`${ridesTable.driverId} = ${driverId} AND ${ridesTable.status} = 'completed'`);

    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [weekly] = await db.select({
      weekRides: sql<number>`count(*)::int`,
      weekEarnings: sql<number>`coalesce(sum(${ridesTable.price}), 0)`,
    }).from(ridesTable).where(sql`${ridesTable.driverId} = ${driverId} AND ${ridesTable.status} = 'completed' AND ${ridesTable.createdAt} >= ${startOfWeek}`);

    const [monthly] = await db.select({
      monthRides: sql<number>`count(*)::int`,
      monthEarnings: sql<number>`coalesce(sum(${ridesTable.price}), 0)`,
    }).from(ridesTable).where(sql`${ridesTable.driverId} = ${driverId} AND ${ridesTable.status} = 'completed' AND ${ridesTable.createdAt} >= ${startOfMonth}`);

    const [today] = await db.select({
      todayRides: sql<number>`count(*)::int`,
    }).from(ridesTable).where(sql`${ridesTable.driverId} = ${driverId} AND ${ridesTable.status} = 'completed' AND ${ridesTable.createdAt} >= ${startOfDay}`);

    const [driver] = await db.select({
      driverRating: usersTable.driverRating,
      totalRides: usersTable.totalRides,
    }).from(usersTable).where(eq(usersTable.id, driverId)).limit(1);

    res.json({
      totalRides: totals?.totalRides ?? 0,
      totalEarnings: totals?.totalEarnings ?? 0,
      weekRides: weekly?.weekRides ?? 0,
      weekEarnings: weekly?.weekEarnings ?? 0,
      monthRides: monthly?.monthRides ?? 0,
      monthEarnings: monthly?.monthEarnings ?? 0,
      todayRides: today?.todayRides ?? 0,
      rating: driver?.driverRating ?? 5.0,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/rides/promo/validate", authenticate, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body as { code?: string };
    if (!code?.trim()) { res.status(400).json({ message: "Código não informado" }); return; }
    const [promo] = await db.select().from(promoCodesTable)
      .where(eq(promoCodesTable.code, code.trim().toUpperCase())).limit(1);
    if (!promo) { res.status(404).json({ message: "Código não encontrado" }); return; }
    if (!promo.isActive) { res.status(400).json({ message: "Este código promocional foi desativado" }); return; }
    if (promo.expiresAt && new Date() > promo.expiresAt) { res.status(400).json({ message: "Este código expirou" }); return; }
    if (promo.maxUses && promo.usedCount >= promo.maxUses) { res.status(400).json({ message: "Este código atingiu o limite de usos" }); return; }
    res.json({
      valid: true, code: promo.code, description: promo.description,
      discountType: promo.discountType, discountValue: promo.discountValue,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.get("/rides/promo/active", authenticate, async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const codes = await db.select({
      code: promoCodesTable.code, description: promoCodesTable.description,
      discountType: promoCodesTable.discountType, discountValue: promoCodesTable.discountValue,
      expiresAt: promoCodesTable.expiresAt,
    }).from(promoCodesTable)
      .where(sql`${promoCodesTable.isActive} = true AND (${promoCodesTable.expiresAt} IS NULL OR ${promoCodesTable.expiresAt} > ${now}) AND (${promoCodesTable.maxUses} IS NULL OR ${promoCodesTable.usedCount} < ${promoCodesTable.maxUses})`);
    res.json(codes);
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

export default router;
