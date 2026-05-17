import { Server, Socket } from "socket.io";
import { db } from "@workspace/db";
import { chatMessagesTable, ridesTable, driversTable, usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"];
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET deve ser definido nas variáveis de ambiente");
}

// Preços por km por tipo de corrida (fonte única de verdade — no servidor)
const RIDE_PRICES: Record<string, number> = {
  moto: 1.20,
  basico: 1.70,
  intermediario: 2.20,
  vip: 3.90,
};
const BASE_FEE = 5.5;
const PEAK_HOURS = [{ start: 7, end: 9 }, { start: 17, end: 19 }];

function calculatePrice(distanceKm: number, rideType: string): { total: number; surgeMultiplier: number } {
  const perKm = RIDE_PRICES[rideType] ?? 1.70;
  const hour = new Date().getHours();
  const isPeak = PEAK_HOURS.some((p) => hour >= p.start && hour <= p.end);
  const surge = isPeak ? 1.5 : 1.0;
  const total = Math.round((BASE_FEE + distanceKm * perKm) * surge * 100) / 100;
  return { total, surgeMultiplier: surge };
}

type DriverInfo = {
  socketId: string;
  driverId: string;
  name: string;
  car: string;
  plate: string;
  color: string;
  rating: number;
  photo: string;
  eta: number;
  latitude: number;
  longitude: number;
  vehicleYear: number;
  vehicleType: "car" | "moto";
};

type RideOriginDest = { address: string; lat: number; lng: number };

type RideRequest = {
  rideId: string;
  passengerId: string;
  passengerName: string;
  passengerSocketId: string;
  origin: RideOriginDest;
  destination: RideOriginDest;
  rideType: string;
  price: number;
  distance: string;
  distanceKm: number;
  duration: string;
  pin?: string;
};

type ChatMessage = {
  msgId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
};

const onlineDrivers = new Map<string, DriverInfo>();
const pendingRides = new Map<string, RideRequest>();
const activeRides = new Map<string, {
  passengerId: string;
  driverId: string;
  passengerSocketId: string;
  driverSocketId: string;
}>();

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearbyDrivers(lat: number, lng: number, rideType: string, radius = 10) {
  const available: (DriverInfo & { distanceToPassenger: number })[] = [];
  for (const driver of onlineDrivers.values()) {
    if (Array.from(activeRides.values()).some((r) => r.driverId === driver.driverId)) continue;
    if (rideType === "moto") {
      if (driver.vehicleType !== "moto") continue;
    } else {
      if (driver.vehicleType !== "car") continue;
      const y = driver.vehicleYear;
      if (!y) continue;
      if (rideType === "basico" && (y < 2005 || y > 2010)) continue;
      if (rideType === "intermediario" && (y < 2011 || y > 2019)) continue;
      if (rideType === "vip" && y < 2020) continue;
    }
    const dist = getDistanceKm(lat, lng, driver.latitude, driver.longitude);
    if (dist <= radius) available.push({ ...driver, distanceToPassenger: dist });
  }
  return available.sort((a, b) => a.distanceToPassenger - b.distanceToPassenger);
}

// Restaura corridas em andamento do banco de dados após reinicialização do servidor
async function loadActiveRides() {
  try {
    const rides = await db
      .select({ id: ridesTable.id, passengerId: ridesTable.passengerId, driverId: ridesTable.driverId })
      .from(ridesTable)
      .where(eq(ridesTable.status, "in_progress"));
    for (const ride of rides) {
      if (ride.passengerId && ride.driverId) {
        activeRides.set(ride.id, {
          passengerId: String(ride.passengerId),
          driverId: String(ride.driverId),
          passengerSocketId: "",
          driverSocketId: "",
        });
      }
    }
    if (rides.length > 0) {
      logger.info({ count: rides.length }, "Corridas ativas restauradas do banco após reinicialização");
    }
  } catch (err) {
    logger.error({ err }, "Falha ao restaurar corridas ativas do banco");
  }
}

export function registerRideSocket(io: Server) {
  loadActiveRides();

  // Autenticação do socket via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next();
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
      (socket as unknown as { userId: number }).userId = payload.userId;
      next();
    } catch {
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as unknown as { userId?: number }).userId;
    logger.info({ socketId: socket.id, userId }, "Socket connected");

    // Restaurar sessão de corrida ativa (ex: após reconexão ou reinicialização do servidor)
    if (userId) {
      for (const [rideId, activeRide] of activeRides.entries()) {
        if (activeRide.passengerId === String(userId)) {
          activeRides.set(rideId, { ...activeRide, passengerSocketId: socket.id });
          socket.emit("passenger:session_restored", { rideId });
          logger.info({ rideId, userId }, "Sessão de corrida restaurada para passageiro");
        } else if (activeRide.driverId === String(userId)) {
          activeRides.set(rideId, { ...activeRide, driverSocketId: socket.id });
          socket.emit("driver:session_restored", { rideId });
          logger.info({ rideId, userId }, "Sessão de corrida restaurada para motorista");
        }
      }
    }

    // ─── MOTORISTA ─────────────────────────────────────────────────────────────

    socket.on("driver:online", async (data: Omit<DriverInfo, "socketId">) => {
      // Verificar aprovação do motorista antes de permitir ficar online
      try {
        const driverUserId = parseInt(data.driverId);
        if (!isNaN(driverUserId)) {
          const [driver] = await db
            .select({ isApproved: driversTable.isApproved })
            .from(driversTable)
            .where(eq(driversTable.userId, driverUserId));
          if (!driver?.isApproved) {
            socket.emit("driver:error", {
              code: "NOT_APPROVED",
              message: "Seus documentos ainda estão em análise. Aguarde aprovação para ficar online.",
            });
            logger.warn({ driverId: data.driverId }, "Driver bloqueado: não aprovado");
            return;
          }
        }
      } catch (err) {
        logger.error({ err }, "Erro ao verificar aprovação do motorista");
      }
      const info: DriverInfo = { ...data, socketId: socket.id };
      onlineDrivers.set(data.driverId, info);
      logger.info({ driverId: data.driverId, total: onlineDrivers.size }, "Driver online");
    });

    socket.on("driver:offline", () => {
      for (const [id, d] of onlineDrivers.entries()) {
        if (d.socketId === socket.id) {
          onlineDrivers.delete(id);
          logger.info({ driverId: id }, "Driver offline");
          break;
        }
      }
    });

    // ─── PASSAGEIRO ────────────────────────────────────────────────────────────

    socket.on("passenger:request_ride", async (data: Omit<RideRequest, "passengerSocketId">) => {
      // Verificar que o passageiro autenticado é o mesmo que está solicitando (anti-spoofing)
      if (userId && String(userId) !== String(data.passengerId)) {
        socket.emit("passenger:error", {
          code: "FORBIDDEN",
          message: "Identificação inválida. Por favor, reinicie o aplicativo.",
        });
        logger.warn({ userId, claimedId: data.passengerId }, "Tentativa de spoofing de passageiro bloqueada");
        return;
      }

      // Verificar se o passageiro tem documentos aprovados
      try {
        const passengerId = parseInt(data.passengerId);
        if (!isNaN(passengerId)) {
          const [passenger] = await db
            .select({ isApproved: usersTable.isApproved })
            .from(usersTable)
            .where(eq(usersTable.id, passengerId));
          if (!passenger?.isApproved) {
            socket.emit("passenger:error", {
              code: "NOT_APPROVED",
              message: "Sua conta ainda não foi aprovada. Aguarde a verificação dos seus documentos.",
            });
            logger.warn({ passengerId }, "Corrida bloqueada: passageiro não aprovado");
            return;
          }
        }
      } catch (err) {
        logger.error({ err }, "Erro ao verificar aprovação do passageiro");
      }

      const origin = data.origin as RideOriginDest;
      const destination = data.destination as RideOriginDest;

      // Calcular preço no servidor (fonte de verdade)
      const distanceKm = data.distanceKm ?? getDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
      const { total: serverPrice } = calculatePrice(distanceKm, data.rideType);

      // Usar PIN enviado pelo cliente (já mostrado ao passageiro) ou gerar um novo
      const ridePin = data.pin ?? Math.floor(1000 + Math.random() * 9000).toString();

      const ride: RideRequest = {
        ...data,
        price: serverPrice,
        distanceKm,
        passengerSocketId: socket.id,
        pin: ridePin,
      };

      pendingRides.set(data.rideId, ride);
      logger.info({ rideId: data.rideId, passengerId: data.passengerId, price: serverPrice }, "Corrida solicitada");

      // Persistir corrida no banco
      try {
        await db.insert(ridesTable).values({
          id: data.rideId,
          passengerId: parseInt(data.passengerId) || null,
          originAddress: origin.address,
          originLat: String(origin.lat),
          originLng: String(origin.lng),
          destAddress: destination.address,
          destLat: String(destination.lat),
          destLng: String(destination.lng),
          rideType: data.rideType as "moto" | "basico" | "intermediario" | "vip",
          price: String(serverPrice),
          distance: data.distance,
          duration: data.duration,
          status: "finding",
          pin: ridePin,
        }).onConflictDoNothing();
      } catch (err) {
        logger.error({ err }, "Erro ao persistir corrida");
      }

      const nearbyDrivers = getNearbyDrivers(origin.lat, origin.lng, data.rideType);

      if (nearbyDrivers.length === 0) {
        socket.emit("passenger:no_drivers", { rideId: data.rideId });
        pendingRides.delete(data.rideId);
        await db.update(ridesTable).set({ status: "cancelled" }).where(eq(ridesTable.id, data.rideId)).catch(() => {});
        return;
      }

      nearbyDrivers.forEach((driver) => dispatchToDriver(io, ride, driver));

      // Confirmar preço e PIN ao passageiro (preço calculado pelo servidor)
      socket.emit("passenger:price_confirmed", { rideId: data.rideId, price: serverPrice, pin: ridePin });

      setTimeout(async () => {
        if (pendingRides.has(data.rideId)) {
          socket.emit("passenger:no_drivers", { rideId: data.rideId });
          pendingRides.delete(data.rideId);
          nearbyDrivers.forEach((d) => io.to(d.socketId).emit("driver:ride_cancelled_for_others", { rideId: data.rideId }));
          await db.update(ridesTable).set({ status: "cancelled" }).where(eq(ridesTable.id, data.rideId)).catch(() => {});
        }
      }, 15000);
    });

    socket.on("driver:accept", async ({ rideId }: { rideId: string }) => {
      const ride = pendingRides.get(rideId);
      if (!ride) return;

      let acceptingDriver: DriverInfo | null = null;
      for (const d of onlineDrivers.values()) {
        if (d.socketId === socket.id) { acceptingDriver = d; break; }
      }
      if (!acceptingDriver) return;

      pendingRides.delete(rideId);
      activeRides.set(rideId, {
        passengerId: ride.passengerId,
        driverId: acceptingDriver.driverId,
        passengerSocketId: ride.passengerSocketId,
        driverSocketId: socket.id,
      });

      try {
        await db.update(ridesTable).set({
          driverId: parseInt(acceptingDriver.driverId) || null,
          status: "accepted",
          updatedAt: new Date(),
        }).where(eq(ridesTable.id, rideId));
      } catch (err) {
        logger.error({ err }, "Erro ao atualizar corrida aceita");
      }

      logger.info({ rideId, driverId: acceptingDriver.driverId }, "Corrida aceita");

      io.to(ride.passengerSocketId).emit("passenger:driver_found", {
        rideId,
        driver: {
          id: acceptingDriver.driverId,
          name: acceptingDriver.name,
          rating: acceptingDriver.rating,
          car: acceptingDriver.car,
          color: acceptingDriver.color,
          plate: acceptingDriver.plate,
          eta: acceptingDriver.eta,
          photo: acceptingDriver.photo,
        },
      });

      for (const d of onlineDrivers.values()) {
        if (d.driverId !== acceptingDriver.driverId) {
          io.to(d.socketId).emit("driver:ride_accepted_by_other", { rideId });
        }
      }
    });

    socket.on("driver:reject", ({ rideId }: { rideId: string }) => {
      logger.info({ rideId }, "Motorista recusou corrida");
    });

    socket.on("driver:arrived", ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      logger.info({ rideId }, "Motorista chegou ao local");
      io.to(active.passengerSocketId).emit("passenger:driver_arrived", { rideId });
    });

    socket.on("driver:start_trip", async ({ rideId, pin }: { rideId: string; pin?: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;

      // Verificar PIN antes de iniciar a viagem
      if (pin) {
        try {
          const [ride] = await db.select({ pin: ridesTable.pin }).from(ridesTable).where(eq(ridesTable.id, rideId));
          if (ride?.pin && pin !== ride.pin) {
            socket.emit("driver:pin_invalid", {
              rideId,
              message: "PIN incorreto. Peça o código de 4 dígitos ao passageiro.",
            });
            logger.warn({ rideId }, "PIN inválido fornecido pelo motorista");
            return;
          }
        } catch (err) {
          logger.error({ err }, "Erro ao verificar PIN");
        }
      }

      logger.info({ rideId }, "Viagem iniciada");
      io.to(active.passengerSocketId).emit("passenger:trip_started", { rideId });
      await db.update(ridesTable).set({ status: "in_progress", updatedAt: new Date() }).where(eq(ridesTable.id, rideId)).catch(() => {});
    });

    socket.on("driver:complete_trip", async ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      logger.info({ rideId }, "Viagem concluída");
      io.to(active.passengerSocketId).emit("passenger:trip_completed", { rideId });
      activeRides.delete(rideId);

      try {
        await db.update(ridesTable).set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(ridesTable.id, rideId));

        const driverUserId = parseInt(active.driverId);
        if (!isNaN(driverUserId)) {
          await db.update(driversTable)
            .set({ totalRides: sql`COALESCE(total_rides, 0) + 1` })
            .where(eq(driversTable.userId, driverUserId))
            .catch(() => {});
        }
      } catch (err) {
        logger.error({ err }, "Erro ao finalizar corrida no banco");
      }
    });

    socket.on("driver:cancel", async ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      io.to(active.passengerSocketId).emit("passenger:ride_cancelled_by_driver", { rideId });
      activeRides.delete(rideId);
      logger.info({ rideId }, "Corrida cancelada pelo motorista");
      await db.update(ridesTable).set({ status: "cancelled", driverId: null, updatedAt: new Date() }).where(eq(ridesTable.id, rideId)).catch(() => {});
    });

    socket.on("passenger:cancel", async ({ rideId }: { rideId: string }) => {
      if (pendingRides.has(rideId)) {
        pendingRides.delete(rideId);
        logger.info({ rideId }, "Corrida cancelada (pendente)");
      }
      const active = activeRides.get(rideId);
      if (active) {
        io.to(active.driverSocketId).emit("driver:ride_cancelled", { rideId });
        activeRides.delete(rideId);
        logger.info({ rideId }, "Corrida cancelada (ativa)");
      }
      await db.update(ridesTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(ridesTable.id, rideId)).catch(() => {});
    });

    socket.on("driver:update_location", ({ driverId, latitude, longitude }: { driverId: string; latitude: number; longitude: number }) => {
      const driver = onlineDrivers.get(driverId);
      if (driver) {
        driver.latitude = latitude;
        driver.longitude = longitude;
        onlineDrivers.set(driverId, driver);
        for (const [rideId, activeRide] of activeRides.entries()) {
          if (activeRide.driverId === driverId) {
            io.to(activeRide.passengerSocketId).emit("driver:location_update", { rideId, latitude, longitude });
          }
        }
      }
    });

    socket.on("chat:send", async ({ rideId, senderId, senderName, text, msgId }: { rideId: string; senderId: string; senderName: string; text: string; msgId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;

      // Verificar que quem envia é realmente participante desta corrida
      const isParticipant =
        socket.id === active.passengerSocketId ||
        socket.id === active.driverSocketId;
      if (!isParticipant) {
        logger.warn({ rideId, senderId, socketId: socket.id }, "Tentativa de chat por não-participante bloqueada");
        return;
      }

      const msg: ChatMessage = { msgId, senderId, senderName, text, timestamp: Date.now() };

      try {
        await db.insert(chatMessagesTable).values({ senderId, senderName, message: text, rideId });
      } catch (err) {
        logger.error({ err }, "Erro ao persistir mensagem");
      }

      const isPassenger = socket.id === active.passengerSocketId;
      const targetSocketId = isPassenger ? active.driverSocketId : active.passengerSocketId;
      io.to(targetSocketId).emit("chat:message", msg);
    });

    socket.on("ride:emergency", ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      logger.warn({ rideId }, "EMERGÊNCIA SOS ativado pelo passageiro");
      io.to(active.driverSocketId).emit("ride:emergency_alert", { rideId });
      io.to(active.passengerSocketId).emit("ride:emergency_confirmed", { rideId });
    });

    // SOS emitido pelo motorista — mesma lógica do passageiro
    socket.on("driver:sos", ({ rideId }: { rideId: string }) => {
      const active = activeRides.get(rideId);
      if (!active) return;
      logger.warn({ rideId }, "EMERGÊNCIA SOS ativado pelo motorista");
      io.to(active.passengerSocketId).emit("ride:emergency_alert", { rideId });
      io.to(active.driverSocketId).emit("ride:emergency_confirmed", { rideId });
    });

    socket.on("disconnect", () => {
      for (const [id, d] of onlineDrivers.entries()) {
        if (d.socketId === socket.id) {
          onlineDrivers.delete(id);
          logger.info({ driverId: id }, "Motorista desconectado");
          break;
        }
      }
    });
  });
}

function dispatchToDriver(io: Server, ride: RideRequest, driver: DriverInfo) {
  io.to(driver.socketId).emit("driver:ride_request", {
    rideId: ride.rideId,
    passenger: ride.passengerName,
    origin: ride.origin,
    destination: ride.destination,
    distance: ride.distance,
    price: ride.price,
    rideType: ride.rideType,
    eta: driver.eta,
  });
}
