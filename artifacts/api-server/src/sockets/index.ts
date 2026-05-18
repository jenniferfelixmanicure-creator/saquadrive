import { Server } from "socket.io";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ridesTable, usersTable } from "@workspace/db";
import { verifyAccessToken } from "../lib/auth.js";
import type { Logger } from "pino";

type Coords = { latitude: number; longitude: number };

interface OnlineDriver {
  socketId: string;
  userId: string;
  name: string;
  rating: number;
  car: string;
  color: string;
  plate: string;
  photo: string;
  location?: Coords;
}

interface RideRequest {
  rideId: string;
  passengerId: string;
  passengerName: string;
  origin: { address: string; lat: number; lng: number };
  destination: { address: string; lat: number; lng: number };
  rideType: string;
  price: number;
  distance: string;
  distanceKm: number;
  duration: string;
  pin: string;
}

const onlineDrivers = new Map<string, OnlineDriver>();
const pendingRides = new Map<string, RideRequest & { passengerSocketId: string; notifiedDrivers: string[] }>();
const activeRides = new Map<string, {
  driverSocketId: string;
  passengerSocketId: string;
  driverUserId: string;
  passengerId: string;
  pin: string;
}>();

export function initSockets(io: Server, logger: Logger) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        (socket as unknown as { userId: number; role: string }).userId = payload.userId;
        (socket as unknown as { userId: number; role: string }).role = payload.role;
      } catch {
        logger.warn("Socket: invalid token, connecting as guest");
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    const s = socket as unknown as { userId?: number; role?: string };
    logger.info({ socketId: socket.id, userId: s.userId }, "Socket connected");

    if (s.role === "admin") {
      socket.join("admins");
    }

    socket.on("driver:online", async (data: { driverId: string; name: string; rating: number; car: string; color: string; plate: string; photo: string }) => {
      try {
        let rating = data.rating;
        let color = data.color;
        if (s.userId) {
          const [user] = await db.select({ driverRating: usersTable.driverRating, vehicleColor: usersTable.vehicleColor })
            .from(usersTable).where(eq(usersTable.id, s.userId)).limit(1);
          if (user) {
            rating = user.driverRating;
            if (user.vehicleColor) color = user.vehicleColor;
          }
        }
        onlineDrivers.set(socket.id, {
          socketId: socket.id, userId: data.driverId, name: data.name,
          rating, car: data.car, color, plate: data.plate, photo: data.photo,
        });
        logger.info({ driverId: data.driverId, total: onlineDrivers.size }, "Driver online");
      } catch (err) {
        logger.error(err, "driver:online error");
      }
    });

    socket.on("driver:offline", () => {
      onlineDrivers.delete(socket.id);
      logger.info({ socketId: socket.id }, "Driver offline");
    });

    socket.on("driver:update_location", (data: { driverId: string; latitude: number; longitude: number }) => {
      const driver = onlineDrivers.get(socket.id);
      if (driver) driver.location = { latitude: data.latitude, longitude: data.longitude };
      for (const [rideId, ride] of activeRides.entries()) {
        if (ride.driverSocketId === socket.id) {
          io.to(ride.passengerSocketId).emit("driver:location_update", {
            rideId, latitude: data.latitude, longitude: data.longitude,
          });
        }
      }
    });

    socket.on("passenger:request_ride", async (data: RideRequest) => {
      try {
        await db.insert(ridesTable).values({
          id: data.rideId,
          passengerId: parseInt(data.passengerId),
          originAddress: data.origin.address,
          originLat: data.origin.lat,
          originLng: data.origin.lng,
          destAddress: data.destination.address,
          destLat: data.destination.lat,
          destLng: data.destination.lng,
          rideType: data.rideType,
          price: data.price,
          distance: data.distance,
          duration: data.duration,
          status: "finding",
          pin: data.pin,
        });
      } catch (err) {
        logger.error(err, "passenger:request_ride DB insert error");
      }
      const available = [...onlineDrivers.values()].filter(d => !isDriverBusy(d.socketId));
      if (available.length === 0) {
        socket.emit("passenger:no_drivers", { rideId: data.rideId });
        return;
      }
      const ride = { ...data, passengerSocketId: socket.id, notifiedDrivers: [] as string[] };
      pendingRides.set(data.rideId, ride);
      let passengerNameFromDb = data.passengerName;
      let passengerPhotoUrl: string | null = null;
      let passengerRating = 5.0;
      let passengerTotalRides = 0;
      try {
        const [passenger] = await db.select({
          name: usersTable.name,
          profilePhotoUrl: usersTable.profilePhotoUrl,
          passengerRating: usersTable.passengerRating,
          totalRides: usersTable.totalRides,
        }).from(usersTable).where(eq(usersTable.id, parseInt(data.passengerId))).limit(1);
        if (passenger) {
          passengerNameFromDb = passenger.name;
          passengerPhotoUrl = passenger.profilePhotoUrl ?? null;
          passengerRating = passenger.passengerRating;
          passengerTotalRides = passenger.totalRides;
        }
      } catch (err) {
        logger.warn(err, "Failed to fetch passenger details from DB");
      }
      const driverData = {
        rideId: data.rideId, passengerId: data.passengerId, passengerName: passengerNameFromDb,
        passengerPhotoUrl, passengerRating, passengerTotalRides,
        origin: data.origin, destination: data.destination, rideType: data.rideType,
        price: data.price, distance: data.distance, distanceKm: data.distanceKm, duration: data.duration,
      };
      for (const driver of available) {
        io.to(driver.socketId).emit("driver:ride_request", driverData);
        ride.notifiedDrivers.push(driver.socketId);
      }
      logger.info({ rideId: data.rideId, notified: available.length }, "Ride broadcast");
    });

    socket.on("driver:accept", async (data: { rideId: string }) => {
      const ride = pendingRides.get(data.rideId);
      if (!ride) { socket.emit("driver:error", { code: "NOT_FOUND", message: "Corrida não disponível" }); return; }
      const driver = onlineDrivers.get(socket.id);
      if (!driver) { socket.emit("driver:error", { code: "NOT_DRIVER", message: "Motorista não identificado" }); return; }
      pendingRides.delete(data.rideId);
      activeRides.set(data.rideId, {
        driverSocketId: socket.id,
        passengerSocketId: ride.passengerSocketId,
        driverUserId: driver.userId,
        passengerId: ride.passengerId,
        pin: ride.pin,
      });
      try {
        await db.update(ridesTable).set({
          driverId: parseInt(driver.userId),
          status: "accepted",
        }).where(eq(ridesTable.id, data.rideId));
      } catch (err) {
        logger.error(err, "driver:accept DB update error");
      }
      const eta = Math.floor(Math.random() * 8) + 2;
      io.to(ride.passengerSocketId).emit("passenger:driver_found", {
        rideId: data.rideId,
        driver: { id: driver.userId, name: driver.name, rating: driver.rating, car: driver.car, color: driver.color, plate: driver.plate, eta, photo: driver.photo },
      });
      io.to(ride.passengerSocketId).emit("passenger:price_confirmed", { rideId: data.rideId, price: ride.price, pin: ride.pin });
      for (const otherId of ride.notifiedDrivers) {
        if (otherId !== socket.id) {
          io.to(otherId).emit("driver:ride_accepted_by_other", { rideId: data.rideId });
          io.to(otherId).emit("driver:ride_cancelled_for_others", { rideId: data.rideId });
        }
      }
      logger.info({ rideId: data.rideId, driver: driver.userId }, "Ride accepted");
    });

    socket.on("driver:reject", (data: { rideId: string }) => {
      const ride = pendingRides.get(data.rideId);
      if (ride) {
        ride.notifiedDrivers = ride.notifiedDrivers.filter(id => id !== socket.id);
        if (ride.notifiedDrivers.length === 0) {
          pendingRides.delete(data.rideId);
          io.to(ride.passengerSocketId).emit("passenger:no_drivers", { rideId: data.rideId });
        }
      }
    });

    socket.on("driver:arrived", (data: { rideId: string }) => {
      const ride = activeRides.get(data.rideId);
      if (ride) io.to(ride.passengerSocketId).emit("passenger:driver_arrived", { rideId: data.rideId });
    });

    socket.on("driver:start_trip", async (data: { rideId: string; pin: string }) => {
      const ride = activeRides.get(data.rideId);
      if (!ride) return;
      if (ride.pin && data.pin !== ride.pin) {
        socket.emit("driver:pin_invalid", { rideId: data.rideId, message: "PIN inválido. Peça o PIN ao passageiro." });
        return;
      }
      try {
        await db.update(ridesTable).set({ status: "in_progress" }).where(eq(ridesTable.id, data.rideId));
      } catch (err) {
        logger.error(err, "driver:start_trip DB update error");
      }
      io.to(ride.passengerSocketId).emit("passenger:trip_started", { rideId: data.rideId });
      logger.info({ rideId: data.rideId }, "Trip started");
    });

    socket.on("driver:complete_trip", async (data: { rideId: string }) => {
      const ride = activeRides.get(data.rideId);
      if (!ride) return;
      io.to(ride.passengerSocketId).emit("passenger:trip_completed", { rideId: data.rideId });
      activeRides.delete(data.rideId);
      try {
        await db.update(ridesTable).set({
          status: "completed",
          completedAt: new Date(),
        }).where(eq(ridesTable.id, data.rideId));
        const driverNumId = parseInt(ride.driverUserId);
        const passengerNumId = parseInt(ride.passengerId);
        if (!isNaN(driverNumId)) {
          await db.update(usersTable).set({
            totalRides: sql`${usersTable.totalRides} + 1`,
          }).where(eq(usersTable.id, driverNumId));
        }
        if (!isNaN(passengerNumId)) {
          await db.update(usersTable).set({
            totalRides: sql`${usersTable.totalRides} + 1`,
          }).where(eq(usersTable.id, passengerNumId));
        }
      } catch (err) {
        logger.error(err, "driver:complete_trip DB update error");
      }
      logger.info({ rideId: data.rideId }, "Trip completed");
    });

    socket.on("driver:cancel", async (data: { rideId: string }) => {
      const ride = activeRides.get(data.rideId);
      if (ride) {
        io.to(ride.passengerSocketId).emit("passenger:ride_cancelled_by_driver", { rideId: data.rideId });
        activeRides.delete(data.rideId);
        try {
          await db.update(ridesTable).set({ status: "cancelled" }).where(eq(ridesTable.id, data.rideId));
        } catch (err) {
          logger.error(err, "driver:cancel DB update error");
        }
      }
      const pending = pendingRides.get(data.rideId);
      if (pending) {
        io.to(pending.passengerSocketId).emit("passenger:ride_cancelled_by_driver", { rideId: data.rideId });
        pendingRides.delete(data.rideId);
        try {
          await db.update(ridesTable).set({ status: "cancelled" }).where(eq(ridesTable.id, data.rideId));
        } catch (err) {
          logger.error(err, "driver:cancel (pending) DB update error");
        }
      }
    });

    socket.on("passenger:cancel", async (data: { rideId: string }) => {
      const pending = pendingRides.get(data.rideId);
      if (pending) {
        for (const driverId of pending.notifiedDrivers) io.to(driverId).emit("driver:ride_cancelled", { rideId: data.rideId });
        pendingRides.delete(data.rideId);
      }
      const active = activeRides.get(data.rideId);
      if (active) {
        io.to(active.driverSocketId).emit("driver:ride_cancelled", { rideId: data.rideId });
        activeRides.delete(data.rideId);
      }
      if (pending || active) {
        try {
          await db.update(ridesTable).set({ status: "cancelled" }).where(eq(ridesTable.id, data.rideId));
        } catch (err) {
          logger.error(err, "passenger:cancel DB update error");
        }
      }
    });

    socket.on("ride:emergency", (data: { rideId: string }) => {
      logger.warn({ rideId: data.rideId, socketId: socket.id }, "SOS EMERGENCY TRIGGERED");
      io.to("admins").emit("admin:emergency_alert", {
        rideId: data.rideId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("chat:message", (data: { rideId: string; message: string; senderId: string; senderName: string }) => {
      const ride = activeRides.get(data.rideId);
      if (!ride) return;
      const isDriver = ride.driverSocketId === socket.id;
      const targetSocket = isDriver ? ride.passengerSocketId : ride.driverSocketId;
      io.to(targetSocket).emit("chat:message", data);
    });

    socket.on("disconnect", () => {
      onlineDrivers.delete(socket.id);
      for (const [rideId, ride] of pendingRides.entries()) {
        ride.notifiedDrivers = ride.notifiedDrivers.filter(id => id !== socket.id);
        if (ride.notifiedDrivers.length === 0) {
          io.to(ride.passengerSocketId).emit("passenger:no_drivers", { rideId });
          pendingRides.delete(rideId);
        }
      }
      logger.info({ socketId: socket.id }, "Socket disconnected");
    });
  });
}

function isDriverBusy(socketId: string): boolean {
  for (const ride of activeRides.values()) {
    if (ride.driverSocketId === socketId) return true;
  }
  return false;
}
