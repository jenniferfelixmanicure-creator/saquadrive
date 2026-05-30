import { Server, Socket } from "socket.io";
import { db } from "@workspace/db";
import { ridesTable, usersTable, promoCodesTable } from "@workspace/db/schema";
import { eq, sql, and, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import {
  askZeroRiscoIA,
  calculateSmartPrice,
  moderateChat,
  analyzeAccident,
  detectRouteDeviation,
  assessRideRisk,
} from "../lib/ai.js";
import { sendPushNotification } from "../lib/expoPush.js";
import jwt from "jsonwebtoken";
import {
  LATE_CANCEL_FEE,
  WAIT_FREE_MINUTES,
  WAIT_FEE_PER_MIN,
  calculateFare,
  getSurgeMultiplier,
  canDriverHandleRide,
  getDriverCategory,
} from "@workspace/pricing";

const JWT_SECRET = process.env["JWT_SECRET"]!;

type DriverInfo = {
  socketId: string; driverId: string; name: string; car: string;
  plate: string; color: string; rating: number; photo: string;
  eta: number; latitude: number; longitude: number;
  vehicleYear: number; vehicleType: "car" | "moto";
};

type RideOriginDest = { address: string; lat: number; lng: number };

type RideRequest = {
  rideId: string; passengerId: string; passengerName: string;
  passengerSocketId: string; origin: RideOriginDest; destination: RideOriginDest;
  rideType: string; price: number; distance: string; distanceKm: number;
  duration: string; pin?: string;
  passengerRating?: number; passengerTotalRides?: number; passengerPhotoUrl?: string | null;
  promoCode?: string; promoDiscount?: number;
};

type ChatMessage = { msgId: string; senderId: string; senderName: string; text: string; timestamp: number };

type ActiveRide = {
  passengerId: string;
  driverId: string;
  passengerSocketId: string;
  driverSocketId: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  rideType?: string;
  startedAt?: number;
  protectionMode?: boolean;
  promoCode?: string;
  promoDiscount?: number;
  driverName?: string;
  driverCar?: string;
  driverPlate?: string;
  driverColor?: string;
  driverRating?: number;
  driverPhoto?: string;
  rideStatus?: string;
};

const onlineDrivers = new Map<string, DriverInfo>();
const pendingRides = new Map<string, RideRequest>();
const waitingRides = new Map<string, { ride: RideRequest; timeoutId: ReturnType<typeof setTimeout> }>();
const rideRejections = new Map<string, Set<string>>();
const activeRides = new Map<string, ActiveRide>();
const rideArrivedAt = new Map<string, Date>();
const waitTimers = new Map<string, ReturnType<typeof setTimeout>>();

const deviationThrottle = new Map<string, number>();
const DEVIATION_THROTTLE_MS = 30_000;

const socketRateLimits = new Map<string, Map<string, number[]>>();

function checkRateLimit(socketId: string, event: string, maxPerWindow: number, windowMs: number): boolean {
  if (!socketRateLimits.has(socketId)) socketRateLimits.set(socketId, new Map());
  const socketLimits = socketRateLimits.get(socketId)!;
  const now = Date.now();
  const timestamps = (socketLimits.get(event) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxPerWindow) return false;
  timestamps.push(now);
  socketLimits.set(event, timestamps);
  return true;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearbyDrivers(lat: number, lng: number, rideType: string, radius = 10) {
  const available: (DriverInfo & { distanceToPassenger: number })[] = [];
  for (const driver of onlineDrivers.values()) {
    if (Array.from(activeRides.values()).some((r) => r.driverId === driver.driverId)) continue;
    if (!canDriverHandleRide(driver.vehicleType, driver.vehicleYear, rideType)) continue;
    const dist = getDistanceKm(lat, lng, driver.latitude, driver.longitude);
    if (dist <= radius) available.push({ ...driver, distanceToPassenger: dist });
  }
  return available.sort((a, b) => a.distanceToPassenger - b.distanceToPassenger);
}

async function notifyOfflineDrivers(
  lat: number, lng: number, rideType: string, rideId: string, price: number
): Promise<void> {
  try {
    const onlineIds = Array.from(onlineDrivers.keys()).map(Number).filter(Boolean);
    const drivers = await db.select({
      id: usersTable.id,
      expoPushToken: usersTable.expoPushToken,
      vehicleType: usersTable.vehicleType,
      vehicleYear: usersTable.vehicleYear,
    }).from(usersTable)
      .where(
        and(
          eq(usersTable.role, "driver"),
          eq(usersTable.isApproved, true),
          isNotNull(usersTable.expoPushToken)
        )
      );

    const eligible = drivers.filter((d) => {
      if (onlineIds.includes(d.id)) return false;
      if (!d.vehicleType || !d.vehicleYear) return false;
      return canDriverHandleRide(d.vehicleType as "car" | "moto", d.vehicleYear, rideType);
    });

    const typeLabel: Record<string, string> = {
      moto: "Moto", basico: "Básico", intermediario: "Intermediário", vip: "VIP",
    };

    await Promise.all(
      eligible.slice(0, 30).map((d) =>
        sendPushNotification(
          d.expoPushToken,
          "Nova corrida disponível!",
          `Categoria ${typeLabel[rideType] ?? rideType} — R$ ${price.toFixed(2)}. Abra o app para aceitar.`,
          { type: "new_ride", rideId, rideType, price }
        ).catch(() => {})
      )
    );
  } catch (err) {
    logger.error({ err }, "Erro ao notificar motoristas offline");
  }
}

async function loadActiveRides() {
  try {
    const rides = await db.select({
      id: ridesTable.id, passengerId: ridesTable.passengerId, driverId: ridesTable.driverId,
      promoCode: ridesTable.promoCode, promoDiscount: ridesTable.promoDiscount,
    }).from(ridesTable).where(eq(ridesTable.status, "in_progress"));
    for (const ride of rides) {
      if (ride.passengerId && ride.driverId) {
        activeRides.set(ride.id, {
          passengerId: String(ride.passengerId),
          driverId: String(ride.driverId),
          passengerSocketId: "",
          driverSocketId: "",
          promoCode: ride.promoCode ?? undefined,
          promoDiscount: ride.promoDiscount ?? undefined,
          rideStatus: "in_progress",
        });
      }
    }
    if (rides.length > 0) logger.info({ count: rides.length }, "Corridas ativas restauradas");
  } catch (err) { logger.error({ err }, "Falha ao restaurar corridas ativas"); }
}

export function registerRideSocket(io: Server) {
  loadActiveRides();

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next();
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
      (socket as unknown as { userId: number }).userId = payload.userId;
      next();
    } catch { next(new Error("Token inválido")); }
  });

  io.on("connection", async (socket: Socket) => {
    const userId = (socket as unknown as { userId?: number }).userId;
    logger.info({ socketId: socket.id, userId }, "Socket connected");

    if (userId) {
      for (const [rideId, activeRide] of activeRides.entries()) {
        if (activeRide.passengerId === String(userId)) {
          activeRides.set(rideId, { ...activeRide, passengerSocketId: socket.id });

          try {
            const [rideData] = await db.select({
              status: ridesTable.status,
              driverId: ridesTable.driverId,
              originAddress: ridesTable.originAddress,
              originLat: ridesTable.originLat,
              originLng: ridesTable.originLng,
              destinationAddress: ridesTable.destinationAddress,
              destinationLat: ridesTable.destinationLat,
              destinationLng: ridesTable.destinationLng,
              rideType: ridesTable.rideType,
              price: ridesTable.price,
              distance: ridesTable.distance,
              duration: ridesTable.duration,
              pin: ridesTable.pin,
              promoCode: ridesTable.promoCode,
              promoDiscount: ridesTable.promoDiscount,
              waitTimeFee: ridesTable.waitTimeFee,
            }).from(ridesTable).where(eq(ridesTable.id, rideId));

            const driver = Array.from(onlineDrivers.values()).find((d) => d.driverId === activeRide.driverId);

            socket.emit("passenger:session_restored", {
              rideId,
              status: rideData?.status ?? "in_progress",
              driver: driver ? {
                id: driver.driverId, name: driver.name, rating: driver.rating,
                car: driver.car, color: driver.color, plate: driver.plate,
                eta: driver.eta, photo: driver.photo,
              } : null,
              origin: rideData ? { address: rideData.originAddress, lat: rideData.originLat, lng: rideData.originLng } : null,
              destination: rideData ? { address: rideData.destinationAddress, lat: rideData.destinationLat, lng: rideData.destinationLng } : null,
              price: rideData?.price,
              pin: rideData?.pin,
              rideType: rideData?.rideType,
              distance: rideData?.distance,
              duration: rideData?.duration,
            });
          } catch {
            socket.emit("passenger:session_restored", { rideId });
          }
        } else if (activeRide.driverId === String(userId)) {
          activeRides.set(rideId, { ...activeRide, driverSocketId: socket.id });
          socket.emit("driver:session_restored", { rideId });
        }
      }
    }

    socket.on("driver:online", async (data: Omit<DriverInfo, "socketId">) => {
      try {
        const driverUserId = parseInt(data.driverId);
        if (!isNaN(driverUserId)) {
          const [driver] = await db.select({ isApproved: usersTable.isApproved }).from(usersTable).where(eq(usersTable.id, driverUserId));
          if (!driver?.isApproved) {
            socket.emit("driver:error", { code: "NOT_APPROVED", message: "Seus documentos ainda estão em análise." });
            return;
          }
        }
      } catch (err) { logger.error({ err }, "Erro ao verificar aprovação"); return; }

      onlineDrivers.set(data.driverId, { ...data, socketId: socket.id });
      logger.info({ driverId: data.driverId, total: onlineDrivers.size }, "Driver online");

      for (const [waitRideId, waiting] of waitingRides.entries()) {
        const { ride: waitRide, timeoutId: waitTimeout } = waiting;
        const nearbyForWaiting = getNearbyDrivers(waitRide.origin.lat, waitRide.origin.lng, waitRide.rideType);
        if (nearbyForWaiting.length > 0) {
          clearTimeout(waitTimeout);
          waitingRides.delete(waitRideId);
          nearbyForWaiting.forEach((driver) => dispatchToDriver(io, waitRide, driver));
          const passSocket = io.sockets.sockets.get(waitRide.passengerSocketId);
          if (passSocket) passSocket.emit("passenger:price_confirmed", { rideId: waitRideId, price: waitRide.price, pin: waitRide.pin });
          setTimeout(async () => {
            if (pendingRides.has(waitRideId)) {
              const ps = io.sockets.sockets.get(waitRide.passengerSocketId);
              if (ps) ps.emit("passenger:no_drivers", { rideId: waitRideId });
              pendingRides.delete(waitRideId);
              rideRejections.delete(waitRideId);
              deviationThrottle.delete(waitRideId);
              nearbyForWaiting.forEach((d) => io.to(d.socketId).emit("driver:ride_cancelled_for_others", { rideId: waitRideId }));
              await db.update(ridesTable).set({ status: "cancelled" }).where(eq(ridesTable.id, waitRideId)).catch(() => {});
            }
          }, 15000);
        }
      }
    });

    socket.on("driver:offline", () => {
      for (const [id, d] of onlineDrivers.entries()) {
        if (d.socketId === socket.id) { onlineDrivers.delete(id); logger.info({ driverId: id }, "Driver offline"); break; }
      }
    });

    socket.on("passenger:request_ride", async (data: Omit<RideRequest, "passengerSocketId"> & { promoCode?: string }) => {
      if (!checkRateLimit(socket.id, "passenger:request_ride", 5, 60_000)) {
        socket.emit("passenger:error", { code: "RATE_LIMITED", message: "Muitas solicitações. Aguarde um momento." });
        return;
      }

      if (userId && String(userId) !== String(data.passengerId)) {
        socket.emit("passenger:error", { code: "FORBIDDEN", message: "Identificação inválida." });
        return;
      }

      let passengerRating = 5.0, passengerTotalRides = 0, passengerPhotoUrl: string | null = null, passengerNameFromDb: string | null = null;
      try {
        const passengerId = parseInt(data.passengerId);
        if (!isNaN(passengerId)) {
          const [passenger] = await db.select({
            isApproved: usersTable.isApproved,
            suspended: usersTable.suspended,
            cancellationFeeOwed: usersTable.cancellationFeeOwed,
            name: usersTable.name,
            passengerRating: usersTable.passengerRating,
            totalRides: usersTable.totalRides,
            profilePhotoUrl: usersTable.profilePhotoUrl,
          }).from(usersTable).where(eq(usersTable.id, passengerId));

          if (!passenger?.isApproved) {
            socket.emit("passenger:error", { code: "NOT_APPROVED", message: "Sua conta ainda não foi aprovada." });
            return;
          }
          if (passenger?.suspended) {
            socket.emit("passenger:error", {
              code: "SUSPENDED",
              message: `Sua conta está suspensa por cancelamento tardio. Taxa pendente: R$ ${(passenger.cancellationFeeOwed ?? LATE_CANCEL_FEE).toFixed(2)}. Entre em contato com o suporte para regularizar.`,
              fee: passenger.cancellationFeeOwed ?? LATE_CANCEL_FEE,
            });
            return;
          }
          passengerRating = passenger?.passengerRating ?? 5.0;
          passengerTotalRides = passenger?.totalRides ?? 0;
          passengerPhotoUrl = passenger?.profilePhotoUrl ?? null;
          if (passenger?.name) passengerNameFromDb = passenger.name;
        }
      } catch (err) { logger.error({ err }, "Erro ao verificar passageiro"); }

      const origin = data.origin as RideOriginDest;
      const destination = data.destination as RideOriginDest;
      const distanceKm = data.distanceKm ?? getDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
      const hour = new Date().getHours();
      const surgeMultiplier = getSurgeMultiplier(hour);
      const basePrice = calculateFare(distanceKm, data.rideType, surgeMultiplier);

      const aiResult = await calculateSmartPrice({ distanceKm, rideType: data.rideType, hour, surgeMultiplier }).catch(() => null);
      let serverPrice = aiResult?.suggestedFare ?? basePrice;

      const rideRisk = await assessRideRisk({
        hour,
        neighborhood: origin.address ?? "não informado",
        passengerRating,
        driverRating: 5,
        rideType: data.rideType,
        distanceKm,
      }).catch(() => null);

      if (rideRisk && (rideRisk.level === "alto" || rideRisk.level === "critico")) {
        socket.emit("passenger:risk_alert", {
          level: rideRisk.level,
          message: `ZeroRisco IA: ${rideRisk.recommendation}`,
          reasons: rideRisk.reasons,
        });
      }

      let appliedPromoCode: string | null = null;
      let appliedPromoDiscount = 0;
      if (data.promoCode) {
        try {
          const [promo] = await db.select().from(promoCodesTable)
            .where(eq(promoCodesTable.code, data.promoCode.toUpperCase())).limit(1);
          if (promo && promo.isActive &&
            (!promo.expiresAt || promo.expiresAt > new Date()) &&
            (!promo.maxUses || promo.usedCount < promo.maxUses)) {
            appliedPromoCode = promo.code;
            if (promo.discountType === "percent") {
              appliedPromoDiscount = Math.round(serverPrice * promo.discountValue / 100 * 100) / 100;
            } else {
              appliedPromoDiscount = Math.min(promo.discountValue, serverPrice);
            }
            serverPrice = Math.max(0, serverPrice - appliedPromoDiscount);
            logger.info({ rideId: data.rideId, promoCode: appliedPromoCode, discount: appliedPromoDiscount }, "Cupom aplicado");
          }
        } catch (err) { logger.error({ err }, "Erro ao validar cupom"); }
      }

      const ridePin = data.pin ?? Math.floor(1000 + Math.random() * 9000).toString();

      const ride: RideRequest = {
        ...data,
        passengerName: passengerNameFromDb ?? data.passengerName,
        price: serverPrice, distanceKm, passengerSocketId: socket.id, pin: ridePin,
        passengerRating, passengerTotalRides, passengerPhotoUrl,
        promoCode: appliedPromoCode ?? undefined,
        promoDiscount: appliedPromoDiscount > 0 ? appliedPromoDiscount : undefined,
      };

      pendingRides.set(data.rideId, ride);
      logger.info({ rideId: data.rideId, price: serverPrice }, "Corrida solicitada");

      try {
        await db.insert(ridesTable).values({
          id: data.rideId,
          passengerId: parseInt(data.passengerId) || null,
          originAddress: origin.address, originLat: origin.lat, originLng: origin.lng,
          destinationAddress: destination.address, destinationLat: destination.lat, destinationLng: destination.lng,
          rideType: data.rideType as "moto" | "basico" | "intermediario" | "vip",
          price: serverPrice, distance: data.distance, duration: data.duration,
          status: "finding", pin: ridePin,
          promoCode: appliedPromoCode,
          promoDiscount: appliedPromoDiscount,
        }).onConflictDoNothing();
      } catch (err) { logger.error({ err }, "Erro ao persistir corrida"); }

      const nearbyDrivers = getNearbyDrivers(origin.lat, origin.lng, data.rideType);
      if (nearbyDrivers.length === 0) {
        socket.emit("passenger:waiting_for_driver", { rideId: data.rideId, waitSeconds: 60 });
        notifyOfflineDrivers(origin.lat, origin.lng, data.rideType, data.rideId, serverPrice).catch(() => {});
        const waitTimeoutId = setTimeout(async () => {
          if (waitingRides.has(data.rideId)) {
            waitingRides.delete(data.rideId);
            pendingRides.delete(data.rideId);
            rideRejections.delete(data.rideId);
            socket.emit("passenger:no_drivers", { rideId: data.rideId });
            await db.update(ridesTable).set({ status: "cancelled" }).where(eq(ridesTable.id, data.rideId)).catch(() => {});
          }
        }, 60000);
        waitingRides.set(data.rideId, { ride, timeoutId: waitTimeoutId });
        return;
      }

      nearbyDrivers.forEach((driver) => dispatchToDriver(io, ride, driver));
      socket.emit("passenger:price_confirmed", {
        rideId: data.rideId,
        price: serverPrice,
        pin: ridePin,
        promoDiscount: appliedPromoDiscount > 0 ? appliedPromoDiscount : undefined,
      });

      setTimeout(async () => {
        if (pendingRides.has(data.rideId)) {
          socket.emit("passenger:no_drivers", { rideId: data.rideId });
          pendingRides.delete(data.rideId);
          rideRejections.delete(data.rideId);
          deviationThrottle.delete(data.rideId);
          nearbyDrivers.forEach((d) => io.to(d.socketId).emit("driver:ride_cancelled_for_others", { rideId: data.rideId }));
          await db.update(ridesTable).set({ status: "cancelled" }).where(eq(ridesTable.id, data.rideId)).catch(() => {});
        }
      }, 15000);
    });

    socket.on("driver:accept", async ({ rideId }: { rideId: string }) => {
      if (!checkRateLimit(socket.id, "driver:accept", 10, 60_000)) return;
      const ride = pendingRides.get(rideId);
      if (!ride) return;
      let acceptingDriver: DriverInfo | null = null;
      for (const d of onlineDrivers.values()) { if (d.socketId === socket.id) { acceptingDriver = d; break; } }
      if (!acceptingDriver) return;
      pendingRides.delete(rideId);
      rideRejections.delete(rideId);
      activeRides.set(rideId, {
        passengerId: ride.passengerId,
        driverId: acceptingDriver.driverId,
        passengerSocketId: ride.passengerSocketId,
        driverSocketId: socket.id,
        originLat: ride.origin.lat,
        originLng: ride.origin.lng,
        destLat: ride.destination.lat,
        destLng: ride.destination.lng,
        rideType: ride.rideType,
        startedAt: Date.now(),
        protectionMode: false,
        promoCode: ride.promoCode,
        promoDiscount: ride.promoDiscount,
        driverName: acceptingDriver.name,
        driverCar: acceptingDriver.car,
        driverPlate: acceptingDriver.plate,
        driverColor: acceptingDriver.color,
        driverRating: acceptingDriver.rating,
        driverPhoto: acceptingDriver.photo,
        rideStatus: "accepted",
      });
      try {
        await db.update(ridesTable).set({ driverId: parseInt(acceptingDriver.driverId) || null, status: "accepted" }).where(eq(ridesTable.id, rideId));
      } catch (err) { logger.error({ err }, "Erro ao atualizar corrida aceita"); }
      logger.info({ rideId, driverId: acceptingDriver.driverId }, "Corrida aceita");
      io.to(ride.passengerSocketId).emit("passenger:driver_found", {
        rideId, driver: { id: acceptingDriver.driverId, name: acceptingDriver.name, rating: acceptingDriver.rating, car: acceptingDriver.car, color: acceptingDriver.color, plate: acceptingDriver.plate, eta: acceptingDriver.eta, photo: acceptingDriver.photo },
      });
      for (const d of onlineDrivers.values()) {
        if (d.driverId !== acceptingDriver.driverId) io.to(d.socketId).emit("driver:ride_accepted_by_other", { rideId });
      }
    });

    socket.on("driver:reject", ({ rideId }: { rideId: string }) => {
      const ride = pendingRides.get(rideId);
      if (!ride) return;
      let rejectedSet = rideRejections.get(rideId);
      if (!rejectedSet) { rejectedSet = new Set(); rideRejections.set(rideId, rejectedSet); }
      let rejectingDriverId: string | undefined;
      for (const [id, d] of onlineDrivers.entries()) { if (d.socketId === socket.id) { rejectingDriverId = id; break; } }
      if (rejectingDriverId) rejectedSet.add(rejectingDriverId);
      const remaining = getNearbyDrivers(ride.origin.lat, ride.origin.lng, ride.rideType).filter(d => !rejectedSet!.has(d.driverId));
      if (remaining.length === 0) {
        const ps = io.sockets.sockets.get(ride.passengerSocketId);
        if (ps) ps.emit("passenger:no_drivers", { rideId });
        pendingRides.delete(rideId); rideRejections.delete(rideId);
      } else {
        const alreadyNotified = new Set(Array.from(rideRejections.get(rideId) ?? []));
        const newDrivers = remaining.filter(d => !alreadyNotified.has(d.driverId));
        if (newDrivers.length > 0) newDrivers.forEach(d => dispatchToDriver(io, ride, d));
      }
    });

    socket.on("driver:arrived", async ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      const now = new Date();
      rideArrivedAt.set(rideId, now);
      activeRides.set(rideId, { ...active, rideStatus: "picking_up" });
      logger.info({ rideId }, "Motorista chegou ao local");
      io.to(active.passengerSocketId).emit("passenger:driver_arrived", { rideId });
      await db.update(ridesTable).set({ arrivedAt: now }).where(eq(ridesTable.id, rideId)).catch(() => {});
      const warningTimer = setTimeout(() => {
        io.to(active.passengerSocketId).emit("passenger:wait_fee_warning", {
          rideId, feePerMin: WAIT_FEE_PER_MIN,
          message: `Tempo de espera gratuito esgotado. Será cobrado R$ ${WAIT_FEE_PER_MIN.toFixed(2)}/min a partir de agora.`,
        });
        io.to(active.driverSocketId).emit("driver:wait_fee_started", { rideId, feePerMin: WAIT_FEE_PER_MIN });
      }, WAIT_FREE_MINUTES * 60 * 1000);
      waitTimers.set(rideId, warningTimer);
    });

    socket.on("driver:start_trip", async ({ rideId, pin }: { rideId: string; pin?: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      if (waitTimers.has(rideId)) { clearTimeout(waitTimers.get(rideId)!); waitTimers.delete(rideId); }
      let waitTimeFee = 0;
      const arrivedTime = rideArrivedAt.get(rideId);
      if (arrivedTime) {
        const waitMin = (Date.now() - arrivedTime.getTime()) / 60000;
        const chargeableMin = Math.max(0, waitMin - WAIT_FREE_MINUTES);
        waitTimeFee = Math.round(chargeableMin * WAIT_FEE_PER_MIN * 100) / 100;
        rideArrivedAt.delete(rideId);
      }
      if (pin) {
        try {
          const [ride] = await db.select({ pin: ridesTable.pin }).from(ridesTable).where(eq(ridesTable.id, rideId));
          if (ride?.pin && pin !== ride.pin) {
            socket.emit("driver:pin_invalid", { rideId, message: "PIN incorreto. Peça o código de 4 dígitos ao passageiro." });
            return;
          }
        } catch (err) { logger.error({ err }, "Erro ao verificar PIN"); }
      }
      if (waitTimeFee > 0) {
        io.to(active.passengerSocketId).emit("passenger:wait_fee_charged", { rideId, waitTimeFee, message: `Taxa de espera adicionada: R$ ${waitTimeFee.toFixed(2)}` });
        io.to(active.driverSocketId).emit("driver:wait_fee_info", { rideId, waitTimeFee });
      }
      activeRides.set(rideId, { ...active, startedAt: Date.now(), rideStatus: "in_progress" });
      await db.update(ridesTable).set({ status: "in_progress", waitTimeFee }).where(eq(ridesTable.id, rideId)).catch(() => {});
      logger.info({ rideId, waitTimeFee }, "Viagem iniciada");
      io.to(active.passengerSocketId).emit("passenger:trip_started", { rideId, waitTimeFee });
    });

    socket.on("driver:complete_trip", async ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      if (waitTimers.has(rideId)) { clearTimeout(waitTimers.get(rideId)!); waitTimers.delete(rideId); }
      rideArrivedAt.delete(rideId);
      deviationThrottle.delete(rideId);
      logger.info({ rideId }, "Viagem concluída");
      io.to(active.passengerSocketId).emit("passenger:trip_completed", { rideId });
      activeRides.delete(rideId);
      try {
        await db.update(ridesTable).set({ status: "completed", completedAt: new Date() }).where(eq(ridesTable.id, rideId));

        const driverUserId = parseInt(active.driverId);
        if (!isNaN(driverUserId)) {
          await db.update(usersTable)
            .set({ totalRides: sql`${usersTable.totalRides} + 1` })
            .where(eq(usersTable.id, driverUserId));
        }

        const passengerUserId = parseInt(active.passengerId);
        if (!isNaN(passengerUserId)) {
          await db.update(usersTable)
            .set({ totalRides: sql`${usersTable.totalRides} + 1` })
            .where(eq(usersTable.id, passengerUserId));
        }

        if (active.promoCode) {
          await db.update(promoCodesTable)
            .set({ usedCount: sql`${promoCodesTable.usedCount} + 1` })
            .where(eq(promoCodesTable.code, active.promoCode))
            .catch(() => {});
          logger.info({ rideId, promoCode: active.promoCode }, "Cupom usedCount incrementado");
        }
      } catch (err) { logger.error({ err }, "Erro ao finalizar corrida"); }
    });

    socket.on("driver:cancel", async ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      if (waitTimers.has(rideId)) { clearTimeout(waitTimers.get(rideId)!); waitTimers.delete(rideId); }
      rideArrivedAt.delete(rideId);
      deviationThrottle.delete(rideId);
      io.to(active.passengerSocketId).emit("passenger:ride_cancelled_by_driver", { rideId });
      activeRides.delete(rideId);
      await db.update(ridesTable).set({ status: "cancelled", driverId: null }).where(eq(ridesTable.id, rideId)).catch(() => {});
    });

    socket.on("passenger:cancel", async ({ rideId }: { rideId: string }) => {
      if (waitingRides.has(rideId)) { const { timeoutId } = waitingRides.get(rideId)!; clearTimeout(timeoutId); waitingRides.delete(rideId); }
      if (pendingRides.has(rideId)) {
        pendingRides.delete(rideId);
        rideRejections.delete(rideId);
        deviationThrottle.delete(rideId);
      }
      const active = activeRides.get(rideId);
      const isLate = active && rideArrivedAt.has(rideId);
      if (waitTimers.has(rideId)) { clearTimeout(waitTimers.get(rideId)!); waitTimers.delete(rideId); }
      rideArrivedAt.delete(rideId);
      deviationThrottle.delete(rideId);
      if (active) {
        io.to(active.driverSocketId).emit("driver:ride_cancelled", { rideId });
        activeRides.delete(rideId);
        if (isLate) {
          logger.warn({ rideId, passengerId: active.passengerId }, "Cancelamento tardio — cobrando taxa");
          const passengerId = parseInt(active.passengerId);
          if (!isNaN(passengerId)) {
            await db.update(usersTable).set({
              suspended: true,
              cancellationFeeOwed: sql`${usersTable.cancellationFeeOwed} + ${LATE_CANCEL_FEE}`,
            }).where(eq(usersTable.id, passengerId)).catch(() => {});
            io.to(active.passengerSocketId).emit("passenger:account_suspended", {
              reason: "late_cancellation", fee: LATE_CANCEL_FEE,
              message: `Sua conta foi suspensa por cancelamento tardio. Taxa de R$ ${LATE_CANCEL_FEE.toFixed(2)} aplicada.`,
            });
          }
          await db.update(ridesTable).set({ status: "cancelled", cancelledLate: true, cancelledAt: new Date() }).where(eq(ridesTable.id, rideId)).catch(() => {});
        } else {
          await db.update(ridesTable).set({ status: "cancelled" }).where(eq(ridesTable.id, rideId)).catch(() => {});
        }
      } else {
        await db.update(ridesTable).set({ status: "cancelled" }).where(eq(ridesTable.id, rideId)).catch(() => {});
      }
    });

    socket.on("driver:update_location", async ({ driverId, latitude, longitude }: { driverId: string; latitude: number; longitude: number }) => {
      const driver = onlineDrivers.get(driverId);
      if (driver) {
        driver.latitude = latitude; driver.longitude = longitude;
        onlineDrivers.set(driverId, driver);
        for (const [rideId, activeRide] of activeRides.entries()) {
          if (activeRide.driverId === driverId) {
            io.to(activeRide.passengerSocketId).emit("driver:location_update", { rideId, latitude, longitude });

            if (activeRide.destLat && activeRide.destLng && activeRide.originLat && activeRide.originLng) {
              const now = Date.now();
              const lastCheck = deviationThrottle.get(rideId) ?? 0;
              if (now - lastCheck < DEVIATION_THROTTLE_MS) continue;
              deviationThrottle.set(rideId, now);

              const elapsedMin = activeRide.startedAt ? (now - activeRide.startedAt) / 60000 : 0;
              const deviation = await detectRouteDeviation({
                rideId,
                currentLat: latitude,
                currentLng: longitude,
                destLat: activeRide.destLat,
                destLng: activeRide.destLng,
                originLat: activeRide.originLat,
                originLng: activeRide.originLng,
                elapsedMinutes: elapsedMin,
              }).catch(() => null);

              if (deviation?.deviated) {
                io.to(activeRide.passengerSocketId).emit("ride:route_deviation", {
                  rideId,
                  suspicious: deviation.suspicious,
                  deviationKm: deviation.deviationKm,
                  message: deviation.message ?? "Desvio de rota detectado.",
                  from: "ZeroRisco IA",
                });
                if (deviation.suspicious) {
                  io.to(activeRide.driverSocketId).emit("driver:route_warning", { rideId, message: "ZeroRisco IA: Desvio de rota detectado. Retorne ao trajeto original." });
                  logger.warn({ rideId, driverId, deviationKm: deviation.deviationKm }, "Desvio de rota suspeito");
                }
              }
            }
          }
        }
      }
    });

    socket.on("chat:send", async ({ rideId, senderId, senderName, text, msgId }: { rideId: string; senderId: string; senderName: string; text: string; msgId: string }) => {
      if (!checkRateLimit(socket.id, "chat:send", 30, 60_000)) {
        socket.emit("chat:blocked", { rideId, msgId, reason: "Você está enviando mensagens muito rápido. Aguarde um momento." });
        return;
      }
      const active = activeRides.get(rideId);
      if (!active) return;
      const isParticipant = socket.id === active.passengerSocketId || socket.id === active.driverSocketId;
      if (!isParticipant) { logger.warn({ rideId, senderId }, "Chat bloqueado: não-participante"); return; }

      const moderation = await moderateChat(text).catch(() => null);

      if (moderation?.action === "block") {
        socket.emit("chat:blocked", {
          rideId, msgId,
          reason: moderation.message ?? "Mensagem bloqueada pela ZeroRisco IA por violar os termos de uso.",
        });
        logger.warn({ rideId, senderId, text: text.substring(0, 50) }, "Mensagem bloqueada pela IA");
        return;
      }

      if (moderation?.action === "warn") {
        socket.emit("chat:warning", {
          rideId,
          message: moderation.message ?? "ZeroRisco IA: Mantenha o respeito durante a corrida.",
        });
      }

      const msg: ChatMessage = { msgId, senderId, senderName, text, timestamp: Date.now() };
      const isPassenger = socket.id === active.passengerSocketId;
      io.to(isPassenger ? active.driverSocketId : active.passengerSocketId).emit("chat:message", msg);

      const lower = text.toLowerCase();
      if (lower.includes("ajuda") || lower.includes("ia") || lower.includes("zerorisco") || lower.includes("suporte")) {
        try {
          const aiResponse = await askZeroRiscoIA(text, `Corrida ID: ${rideId}`);
          const aiMsg: ChatMessage = {
            msgId: `ai-${Date.now()}`,
            senderId: "0",
            senderName: "ZeroRisco IA",
            text: aiResponse,
            timestamp: Date.now(),
          };
          io.to(active.passengerSocketId).emit("chat:message", aiMsg);
          io.to(active.driverSocketId).emit("chat:message", aiMsg);
        } catch { }
      }
    });

    socket.on("passenger:sensor_data", async ({ rideId, accelerometerX, accelerometerY, accelerometerZ, speedKmh, previousSpeedKmh }: {
      rideId: string; accelerometerX: number; accelerometerY: number; accelerometerZ: number; speedKmh: number; previousSpeedKmh: number;
    }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      try {
        const result = await analyzeAccident({ accelerometerX, accelerometerY, accelerometerZ, speedKmh, previousSpeedKmh, rideId });
        if (result.detected && result.severity !== "none") {
          logger.warn({ rideId, severity: result.severity, confidence: result.confidence }, "Possível acidente detectado pela IA");
          io.to(active.passengerSocketId).emit("ride:accident_detected", {
            rideId, severity: result.severity, confidence: result.confidence,
            actions: result.actions,
            message: "ZeroRisco IA detectou um possível acidente. Você está bem?",
          });
          io.to(active.driverSocketId).emit("ride:accident_detected", {
            rideId, severity: result.severity,
            message: "ZeroRisco IA: Possível acidente detectado. O passageiro foi notificado.",
          });
        }
      } catch { }
    });

    socket.on("ride:protection_mode", ({ rideId, enabled }: { rideId: string; enabled: boolean }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      activeRides.set(rideId, { ...active, protectionMode: enabled });
      socket.emit("ride:protection_confirmed", {
        rideId, enabled,
        message: enabled
          ? "Modo Proteção ativado. ZeroRisco IA está monitorando sua corrida em tempo real."
          : "Modo Proteção desativado.",
      });
      logger.info({ rideId, enabled }, "Modo Proteção alterado");
    });

    socket.on("ride:protection_heartbeat", async ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active?.protectionMode) return;
      socket.emit("ride:protection_check", {
        rideId,
        message: "ZeroRisco IA: Tudo bem com você? Se precisar de ajuda, use o botão SOS.",
        timestamp: Date.now(),
      });
    });

    socket.on("passenger:silent_sos", async ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      logger.error({ rideId, passengerId: active.passengerId }, "SOS SILENCIOSO ATIVADO — protocolo de segurança");
      io.to(active.driverSocketId).emit("driver:silent_sos_alert", {
        rideId,
        message: "Alerta de segurança recebido. Mantenha a calma e siga o protocolo.",
      });
      socket.emit("passenger:silent_sos_confirmed", {
        rideId,
        message: "ZeroRisco IA ativou o protocolo de segurança silencioso. Sua localização está sendo monitorada.",
      });
    });

    socket.on("ride:emergency", ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      logger.warn({ rideId }, "SOS ativado pelo passageiro");
      io.to(active.driverSocketId).emit("ride:emergency_alert", { rideId });
      io.to(active.passengerSocketId).emit("ride:emergency_confirmed", { rideId });
    });

    socket.on("driver:sos", ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      logger.warn({ rideId }, "SOS ativado pelo motorista");
      io.to(active.passengerSocketId).emit("ride:emergency_alert", { rideId });
      io.to(active.driverSocketId).emit("ride:emergency_confirmed", { rideId });
    });

    socket.on("disconnect", () => {
      socketRateLimits.delete(socket.id);
      for (const [id, d] of onlineDrivers.entries()) {
        if (d.socketId === socket.id) { onlineDrivers.delete(id); logger.info({ driverId: id }, "Motorista desconectado"); break; }
      }
    });
  });
}

function dispatchToDriver(io: Server, ride: RideRequest, driver: DriverInfo & { distanceToPassenger: number }) {
  const distKm = driver.distanceToPassenger;
  const eta = Math.max(1, Math.round(distKm / 0.5));
  io.to(driver.socketId).emit("driver:new_ride", {
    rideId: ride.rideId,
    passengerName: ride.passengerName,
    passengerRating: ride.passengerRating ?? 5,
    passengerTotalRides: ride.passengerTotalRides ?? 0,
    passengerPhotoUrl: ride.passengerPhotoUrl ?? null,
    origin: ride.origin,
    destination: ride.destination,
    rideType: ride.rideType,
    price: ride.price,
    distance: ride.distance,
    duration: ride.duration,
    distanceToPassenger: `${distKm.toFixed(1)} km`,
    eta,
    pin: ride.pin,
  });
}
