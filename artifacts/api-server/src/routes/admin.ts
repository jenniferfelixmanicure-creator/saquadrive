import { Router } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, ridesTable, promoCodesTable } from "@workspace/db";
import { authenticateAdmin, type AuthRequest } from "../middlewares/authenticate.js";

const router = Router();
router.use(authenticateAdmin);

router.get("/admin/stats", async (req: AuthRequest, res) => {
  try {
    const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
    const [totalRides] = await db.select({ count: sql<number>`count(*)::int` }).from(ridesTable);
    const [pendingDrivers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable)
      .where(sql`${usersTable.role} = 'driver' AND ${usersTable.isApproved} = false`);
    const [revenue] = await db.select({ total: sql<number>`coalesce(sum(${ridesTable.price}), 0)` }).from(ridesTable);
    const [suspended] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable)
      .where(eq(usersTable.suspended, true));
    res.json({
      totalUsers: totalUsers?.count ?? 0, totalRides: totalRides?.count ?? 0,
      pendingDrivers: pendingDrivers?.count ?? 0, totalRevenue: revenue?.total ?? 0,
      suspendedUsers: suspended?.count ?? 0,
    });
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.get("/admin/drivers/all", async (req: AuthRequest, res) => {
  try {
    const drivers = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email, phone: usersTable.phone,
      isApproved: usersTable.isApproved, rgStatus: usersTable.rgStatus, cnhStatus: usersTable.cnhStatus,
      crlvStatus: usersTable.crlvStatus, rgUrl: usersTable.rgUrl, cnhUrl: usersTable.cnhUrl,
      crlvUrl: usersTable.crlvUrl, vehiclePlate: usersTable.vehiclePlate, vehicleModel: usersTable.vehicleModel,
      vehicleColor: usersTable.vehicleColor, vehicleType: usersTable.vehicleType, vehicleYear: usersTable.vehicleYear,
      driverRating: usersTable.driverRating, totalRides: usersTable.totalRides,
      profilePhotoUrl: usersTable.profilePhotoUrl, createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.role, "driver"));
    res.json(drivers.map(d => ({ ...d, id: String(d.id) })));
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.get("/admin/drivers/pending", async (req: AuthRequest, res) => {
  try {
    const drivers = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email, phone: usersTable.phone,
      isApproved: usersTable.isApproved, rgStatus: usersTable.rgStatus, cnhStatus: usersTable.cnhStatus,
      crlvStatus: usersTable.crlvStatus, rgUrl: usersTable.rgUrl, cnhUrl: usersTable.cnhUrl,
      crlvUrl: usersTable.crlvUrl, vehiclePlate: usersTable.vehiclePlate, vehicleModel: usersTable.vehicleModel,
      vehicleColor: usersTable.vehicleColor, vehicleType: usersTable.vehicleType, vehicleYear: usersTable.vehicleYear,
      profilePhotoUrl: usersTable.profilePhotoUrl,
    }).from(usersTable).where(sql`${usersTable.role} = 'driver' AND ${usersTable.isApproved} = false`);
    res.json(drivers.map(d => ({ ...d, id: String(d.id) })));
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.patch("/admin/drivers/:id/approve", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { rgStatus, cnhStatus, crlvStatus, isApproved } = req.body as Record<string, unknown>;
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (rgStatus !== undefined) updates.rgStatus = rgStatus as string;
    if (cnhStatus !== undefined) updates.cnhStatus = cnhStatus as string;
    if (crlvStatus !== undefined) updates.crlvStatus = crlvStatus as string;
    if (isApproved !== undefined) updates.isApproved = isApproved as boolean;
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, isApproved: usersTable.isApproved, rgStatus: usersTable.rgStatus, cnhStatus: usersTable.cnhStatus, crlvStatus: usersTable.crlvStatus });
    res.json({ ...updated, id: String(updated.id) });
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/admin/drivers/:id/approve", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db.update(usersTable)
      .set({ isApproved: true, rgStatus: "approved", cnhStatus: "approved", crlvStatus: "approved" })
      .where(eq(usersTable.id, id)).returning({ id: usersTable.id, isApproved: usersTable.isApproved });
    res.json({ ...updated, id: String(updated.id) });
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.patch("/admin/drivers/:id/vehicle", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { vehicleModel, vehiclePlate, vehicleColor, vehicleType, vehicleYear } = req.body as Record<string, unknown>;
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (vehicleModel !== undefined) updates.vehicleModel = vehicleModel as string;
    if (vehiclePlate !== undefined) updates.vehiclePlate = vehiclePlate as string;
    if (vehicleColor !== undefined) updates.vehicleColor = vehicleColor as string;
    if (vehicleType !== undefined) updates.vehicleType = vehicleType as string;
    if (vehicleYear !== undefined) updates.vehicleYear = vehicleYear as number;
    if (Object.keys(updates).length === 0) { res.status(400).json({ message: "Nenhum campo fornecido" }); return; }
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, vehicleModel: usersTable.vehicleModel, vehiclePlate: usersTable.vehiclePlate, vehicleColor: usersTable.vehicleColor, vehicleType: usersTable.vehicleType, vehicleYear: usersTable.vehicleYear });
    res.json({ ...updated, id: String(updated.id) });
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/admin/drivers/:id/reject", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db.update(usersTable)
      .set({ isApproved: false, rgStatus: "rejected", cnhStatus: "rejected", crlvStatus: "rejected" })
      .where(eq(usersTable.id, id)).returning({ id: usersTable.id, isApproved: usersTable.isApproved });
    res.json({ ...updated, id: String(updated.id) });
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.get("/admin/users", async (req: AuthRequest, res) => {
  try {
    const users = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email, phone: usersTable.phone,
      role: usersTable.role, isApproved: usersTable.isApproved, suspended: usersTable.suspended,
      cancellationFeeOwed: usersTable.cancellationFeeOwed,
      profilePhotoUrl: usersTable.profilePhotoUrl, totalRides: usersTable.totalRides,
      driverRating: usersTable.driverRating, passengerRating: usersTable.passengerRating,
      rgStatus: usersTable.rgStatus, cnhStatus: usersTable.cnhStatus, crlvStatus: usersTable.crlvStatus,
      vehiclePlate: usersTable.vehiclePlate, vehicleModel: usersTable.vehicleModel,
      vehicleType: usersTable.vehicleType, vehicleColor: usersTable.vehicleColor, vehicleYear: usersTable.vehicleYear,
      subscriptionActive: usersTable.subscriptionActive, subscriptionExpiresAt: usersTable.subscriptionExpiresAt,
      createdAt: usersTable.createdAt,
    }).from(usersTable).orderBy(usersTable.createdAt);
    res.json(users.map(u => ({ ...u, id: String(u.id) })));
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// ── Taxas de cancelamento tardio ──────────────────────────────────────────────

router.get("/admin/cancellation-fees", async (req: AuthRequest, res) => {
  try {
    const suspended = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email, phone: usersTable.phone,
      cancellationFeeOwed: usersTable.cancellationFeeOwed, suspended: usersTable.suspended,
      totalRides: usersTable.totalRides, profilePhotoUrl: usersTable.profilePhotoUrl,
    }).from(usersTable)
      .where(sql`${usersTable.suspended} = true OR ${usersTable.cancellationFeeOwed} > 0`)
      .orderBy(desc(usersTable.cancellationFeeOwed));
    res.json(suspended.map(u => ({ ...u, id: String(u.id) })));
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/admin/users/:id/release-suspension", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db.update(usersTable)
      .set({ suspended: false, cancellationFeeOwed: 0 })
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id, suspended: usersTable.suspended, cancellationFeeOwed: usersTable.cancellationFeeOwed });
    req.log.info({ id }, "Suspensão liberada pelo admin");
    res.json({ ...updated, id: String(updated.id) });
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// ── Códigos promocionais ───────────────────────────────────────────────────────

router.get("/admin/promo-codes", async (req: AuthRequest, res) => {
  try {
    const codes = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt));
    res.json(codes);
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/admin/promo-codes", async (req: AuthRequest, res) => {
  try {
    const { code, description, discountType, discountValue, maxUses, expiresAt } = req.body as Record<string, unknown>;
    if (!code || !discountValue) { res.status(400).json({ message: "code e discountValue são obrigatórios" }); return; }
    const [created] = await db.insert(promoCodesTable).values({
      code: (code as string).toUpperCase().trim(),
      description: description as string | undefined,
      discountType: (discountType as string) ?? "fixed",
      discountValue: Number(discountValue),
      maxUses: maxUses ? Number(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt as string) : null,
      isActive: true,
    }).returning();
    res.status(201).json(created);
  } catch (err: unknown) {
    req.log.error(err);
    const msg = err instanceof Error && err.message.includes("unique") ? "Código já existe" : "Erro interno";
    res.status(msg === "Código já existe" ? 409 : 500).json({ message: msg });
  }
});

router.patch("/admin/promo-codes/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { description, discountType, discountValue, isActive, maxUses, expiresAt } = req.body as Record<string, unknown>;
    const updates: Partial<typeof promoCodesTable.$inferInsert> = {};
    if (description !== undefined) updates.description = description as string;
    if (discountType !== undefined) updates.discountType = discountType as string;
    if (discountValue !== undefined) updates.discountValue = Number(discountValue);
    if (isActive !== undefined) updates.isActive = isActive as boolean;
    if (maxUses !== undefined) updates.maxUses = maxUses ? Number(maxUses) : null;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt as string) : null;
    const [updated] = await db.update(promoCodesTable).set(updates).where(eq(promoCodesTable.id, id)).returning();
    res.json(updated);
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.delete("/admin/promo-codes/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id));
    res.json({ message: "Deletado" });
  } catch (err) { req.log.error(err); res.status(500).json({ message: "Erro interno" }); }
});

export default router;
