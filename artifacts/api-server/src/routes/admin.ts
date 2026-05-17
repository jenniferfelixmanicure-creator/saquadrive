import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, ridesTable } from "@workspace/db";
import { authenticate, requireRole, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();

router.use(authenticate, requireRole("admin"));

router.get("/admin/stats", async (req: AuthRequest, res) => {
  try {
    const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
    const [totalRides] = await db.select({ count: sql<number>`count(*)::int` }).from(ridesTable);
    const [pendingDrivers] = await db.select({ count: sql<number>`count(*)::int` })
      .from(usersTable).where(
        sql`${usersTable.role} = 'driver' AND (${usersTable.rgStatus} = 'pending' OR ${usersTable.cnhStatus} = 'pending' OR ${usersTable.crlvStatus} = 'pending')`
      );
    const [revenue] = await db.select({
      total: sql<number>`coalesce(sum(${ridesTable.price}), 0)`,
    }).from(ridesTable);
    res.json({
      totalUsers: totalUsers?.count ?? 0,
      totalRides: totalRides?.count ?? 0,
      pendingDrivers: pendingDrivers?.count ?? 0,
      totalRevenue: revenue?.total ?? 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.get("/admin/drivers/all", async (req: AuthRequest, res) => {
  try {
    const drivers = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      phone: usersTable.phone, isApproved: usersTable.isApproved,
      rgStatus: usersTable.rgStatus, cnhStatus: usersTable.cnhStatus,
      crlvStatus: usersTable.crlvStatus, rgUrl: usersTable.rgUrl,
      cnhUrl: usersTable.cnhUrl, crlvUrl: usersTable.crlvUrl,
      vehiclePlate: usersTable.vehiclePlate, vehicleModel: usersTable.vehicleModel,
      driverRating: usersTable.driverRating, totalRides: usersTable.totalRides,
      profilePhotoUrl: usersTable.profilePhotoUrl, createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.role, "driver"));
    res.json(drivers.map(d => ({ ...d, id: String(d.id) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.get("/admin/drivers/pending", async (req: AuthRequest, res) => {
  try {
    const drivers = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      phone: usersTable.phone, isApproved: usersTable.isApproved,
      rgStatus: usersTable.rgStatus, cnhStatus: usersTable.cnhStatus,
      crlvStatus: usersTable.crlvStatus, rgUrl: usersTable.rgUrl,
      cnhUrl: usersTable.cnhUrl, crlvUrl: usersTable.crlvUrl,
      vehiclePlate: usersTable.vehiclePlate, vehicleModel: usersTable.vehicleModel,
      profilePhotoUrl: usersTable.profilePhotoUrl,
    }).from(usersTable).where(
      sql`${usersTable.role} = 'driver' AND ${usersTable.isApproved} = false`
    );
    res.json(drivers.map(d => ({ ...d, id: String(d.id) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.patch("/admin/drivers/:id/approve", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { rgStatus, cnhStatus, crlvStatus, isApproved } = req.body as {
      rgStatus?: string; cnhStatus?: string; crlvStatus?: string; isApproved?: boolean;
    };
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (rgStatus !== undefined) updates.rgStatus = rgStatus;
    if (cnhStatus !== undefined) updates.cnhStatus = cnhStatus;
    if (crlvStatus !== undefined) updates.crlvStatus = crlvStatus;
    if (isApproved !== undefined) updates.isApproved = isApproved;
    const [updated] = await db.update(usersTable).set(updates)
      .where(eq(usersTable.id, id)).returning({
        id: usersTable.id, isApproved: usersTable.isApproved,
        rgStatus: usersTable.rgStatus, cnhStatus: usersTable.cnhStatus, crlvStatus: usersTable.crlvStatus,
      });
    res.json({ ...updated, id: String(updated.id) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/admin/drivers/:id/approve", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db.update(usersTable)
      .set({ isApproved: true, rgStatus: "approved", cnhStatus: "approved", crlvStatus: "approved" })
      .where(eq(usersTable.id, id)).returning({ id: usersTable.id, isApproved: usersTable.isApproved });
    res.json({ ...updated, id: String(updated.id) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/admin/drivers/:id/reject", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body as { reason?: string };
    const [updated] = await db.update(usersTable)
      .set({ isApproved: false, rgStatus: "rejected" })
      .where(eq(usersTable.id, id)).returning({ id: usersTable.id, isApproved: usersTable.isApproved });
    req.log.info({ id, reason }, "Driver rejected");
    res.json({ ...updated, id: String(updated.id) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erro interno" });
  }
});

export default router;
