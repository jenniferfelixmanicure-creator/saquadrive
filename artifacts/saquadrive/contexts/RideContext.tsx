import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext, useContext, useEffect, useRef, useState,
} from "react";
import { Alert } from "react-native";
import * as Location from "expo-location";
import { useSocket } from "./SocketContext";
import { useAuth } from "./AuthContext";
import { getRoute } from "../lib/google-maps";

export type RideStatus =
  | "idle" | "confirming" | "finding" | "driver_coming"
  | "in_progress" | "completed" | "rating";

export type RideType = "moto" | "basico" | "intermediario" | "vip";

export type Location2 = { address: string; lat: number; lng: number };

export type Driver = {
  id: string; name: string; rating: number; car: string;
  color: string; plate: string; eta: number; photo: string;
};

export type Ride = {
  id: string; origin: Location2; destination: Location2;
  status: RideStatus; driver?: Driver; rideType: RideType;
  price: number; distance: string; duration: string;
  createdAt: string; rating?: number; pin?: string;
  isEmergencyActive?: boolean;
};

export type { Location2 as Location };

const RIDE_PRICES: Record<RideType, number> = {
  moto: 1.20, basico: 1.70, intermediario: 2.20, vip: 3.90,
};
const BASE_FEE = 5.5;
const PEAK_HOURS = [{ start: 7, end: 9 }, { start: 17, end: 19 }];

type RideContextType = {
  currentRide: Ride | null;
  rideStatus: RideStatus;
  history: Ride[];
  requestRide: (
    origin: Location2, destination: Location2, rideType: RideType,
    distanceKm: number, passengerId: string, passengerName: string
  ) => void;
  cancelRide: () => void;
  rateDriver: (stars: number) => Promise<void>;
  resetRide: () => void;
  calculatePrice: (distanceKm: number, rideType: RideType) => {
    total: number; surgeMultiplier: number; isPeakHour: boolean;
  };
  calculateDuration: (distanceKm: number) => string;
  calculateDistance: (distanceKm: number) => string;
  triggerSOS: () => void;
  verifyPIN: (inputPin: string) => boolean;
  userLocation: Location2 | null;
  routeCoordinates: { latitude: number; longitude: number }[];
  driverRealtimeLocation: { latitude: number; longitude: number } | null;
};

const RideContext = createContext<RideContextType>({} as RideContextType);
const HISTORY_KEY = "zerorisco_history";

export function RideProvider({ children }: { children: React.ReactNode }) {
  const { socket, connected } = useSocket();
  const { apiFetch } = useAuth();
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus>("idle");
  const [history, setHistory] = useState<Ride[]>([]);
  const [userLocation, setUserLocation] = useState<Location2 | null>(null);
  const [driverRealtimeLocation, setDriverRealtimeLocation] = useState<{
    latitude: number; longitude: number;
  } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const currentRideRef = useRef<Ride | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    loadHistory();
    initLocation();
    return () => {
      timersRef.current.forEach(clearTimeout);
      locationSubRef.current?.remove();
    };
  }, []);

  async function initLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setUserLocation({ address: "Saquarema, RJ", lat: -22.9200, lng: -42.5100 });
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { latitude, longitude } = loc.coords;
    setUserLocation({ address: "Sua localização", lat: latitude, lng: longitude });

    const sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10 },
      (update) => {
        setUserLocation({
          address: "Sua localização",
          lat: update.coords.latitude,
          lng: update.coords.longitude,
        });
      }
    );
    locationSubRef.current = sub;
  }

  async function generateRoute(start: Location2, end: Location2) {
    const result = await getRoute(
      { lat: start.lat, lng: start.lng },
      { lat: end.lat, lng: end.lng }
    );
    if (result) {
      setRouteCoordinates(result.polylineCoords);
      return result;
    }
    const coords: { latitude: number; longitude: number }[] = [];
    for (let i = 0; i <= 30; i++) {
      coords.push({
        latitude: start.lat + (end.lat - start.lat) * (i / 30),
        longitude: start.lng + (end.lng - start.lng) * (i / 30),
      });
    }
    setRouteCoordinates(coords);
    return null;
  }

  useEffect(() => { currentRideRef.current = currentRide; }, [currentRide]);

  useEffect(() => {
    if (!socket) return;

    socket.on("passenger:driver_found", ({ rideId, driver }: { rideId: string; driver: Driver }) => {
      setCurrentRide((prev) => {
        if (!prev || prev.id !== rideId) return prev;
        const updated = { ...prev, driver, status: "driver_coming" as RideStatus };
        currentRideRef.current = updated;
        return updated;
      });
      setRideStatus("driver_coming");
    });

    socket.on("passenger:driver_arrived", ({ rideId }: { rideId: string }) => {
      if (currentRideRef.current?.id !== rideId) return;
      setCurrentRide((prev) => prev ? { ...prev, driver: prev.driver ? { ...prev.driver, eta: 0 } : prev.driver } : prev);
    });

    socket.on("passenger:trip_started", ({ rideId }: { rideId: string }) => {
      if (currentRideRef.current?.id !== rideId) return;
      setCurrentRide((prev) => prev ? { ...prev, status: "in_progress" } : prev);
      setRideStatus("in_progress");
      if (currentRideRef.current) {
        generateRoute(currentRideRef.current.origin, currentRideRef.current.destination);
      }
    });

    socket.on("passenger:trip_completed", ({ rideId }: { rideId: string }) => {
      if (currentRideRef.current?.id !== rideId) return;
      setCurrentRide((prev) => prev ? { ...prev, status: "completed" } : prev);
      setRideStatus("rating");
    });

    socket.on("passenger:waiting_for_driver", ({ rideId }: { rideId: string; waitSeconds: number }) => {
      if (currentRideRef.current?.id !== rideId) return;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    });

    socket.on("passenger:no_drivers", ({ rideId }: { rideId: string }) => {
      if (currentRideRef.current?.id !== rideId) return;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setRideStatus("idle");
      setCurrentRide(null);
      currentRideRef.current = null;
      setRouteCoordinates([]);
      setDriverRealtimeLocation(null);
      Alert.alert("Sem motoristas", "Nenhum motorista disponível na sua região agora. Tente novamente em alguns instantes.");
    });

    socket.on("passenger:price_confirmed", ({ rideId, price, pin }: { rideId: string; price: number; pin: string }) => {
      setCurrentRide((prev) => {
        if (!prev || prev.id !== rideId) return prev;
        const updated = { ...prev, price, pin };
        currentRideRef.current = updated;
        return updated;
      });
    });

    socket.on("passenger:error", ({ message }: { code: string; message: string }) => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setRideStatus("idle");
      setCurrentRide(null);
      currentRideRef.current = null;
      Alert.alert("Atenção", message);
    });

    socket.on("passenger:session_restored", ({ rideId }: { rideId: string }) => {
      if (!currentRideRef.current || currentRideRef.current.id !== rideId) return;
      setRideStatus(currentRideRef.current.status);
    });

    socket.on("passenger:ride_cancelled_by_driver", ({ rideId }: { rideId: string }) => {
      if (currentRideRef.current?.id !== rideId) return;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setCurrentRide(null);
      currentRideRef.current = null;
      setRideStatus("idle");
      setRouteCoordinates([]);
      setDriverRealtimeLocation(null);
      Alert.alert(
        "Corrida cancelada",
        "O motorista cancelou a corrida. Por favor, solicite uma nova.",
        [{ text: "OK" }]
      );
    });

    socket.on("driver:location_update", ({
      rideId, latitude, longitude,
    }: { rideId: string; latitude: number; longitude: number }) => {
      if (currentRideRef.current?.id === rideId) {
        setDriverRealtimeLocation({ latitude, longitude });
      }
    });

    return () => {
      socket.off("passenger:driver_found");
      socket.off("passenger:driver_arrived");
      socket.off("passenger:trip_started");
      socket.off("passenger:trip_completed");
      socket.off("passenger:waiting_for_driver");
      socket.off("passenger:no_drivers");
      socket.off("passenger:price_confirmed");
      socket.off("passenger:error");
      socket.off("passenger:session_restored");
      socket.off("passenger:ride_cancelled_by_driver");
      socket.off("driver:location_update");
    };
  }, [socket]);

  async function loadHistory() {
    try {
      const stored = await AsyncStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }

  async function saveHistory(rides: Ride[]) {
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(rides));
    } catch {}
  }

  function getSurgeMultiplier(): { multiplier: number; isPeakHour: boolean } {
    const hour = new Date().getHours();
    const isPeakHour = PEAK_HOURS.some((p) => hour >= p.start && hour <= p.end);
    const multiplier = isPeakHour ? 1.5 : 1.0;
    return { multiplier, isPeakHour };
  }

  function calculatePrice(distanceKm: number, rideType: RideType) {
    const perKm = RIDE_PRICES[rideType];
    const { multiplier: surgeMultiplier, isPeakHour } = getSurgeMultiplier();
    const total = Math.round((BASE_FEE + distanceKm * perKm) * surgeMultiplier * 100) / 100;
    return { total, surgeMultiplier, isPeakHour };
  }

  function calculateDuration(distanceKm: number): string {
    const minutes = Math.round(distanceKm * 2.5);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : `${minutes} min`;
  }

  function calculateDistance(distanceKm: number): string {
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
    return `${(distanceKm * 1.1).toFixed(1)} km`;
  }

  async function requestRide(
    origin: Location2, destination: Location2, rideType: RideType,
    distanceKm: number, passengerId: string, passengerName: string,
  ) {
    const routeData = await generateRoute(origin, destination);
    const finalDistance = routeData ? routeData.distance : distanceKm;
    const finalDuration = routeData ? routeData.duration : calculateDuration(distanceKm);

    const { total: price } = calculatePrice(finalDistance, rideType);
    const rideId = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

    const ride: Ride = {
      id: rideId, origin, destination, status: "finding",
      rideType, price,
      distance: calculateDistance(finalDistance),
      duration: finalDuration,
      createdAt: new Date().toISOString(),
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
    };

    if (!socket || !connected) {
      Alert.alert("Sem conexão", "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.");
      return;
    }

    setCurrentRide(ride);
    currentRideRef.current = ride;
    setRideStatus("finding");

    (socket as { emit: (event: string, data: unknown) => void }).emit("passenger:request_ride", {
      rideId, passengerId, passengerName,
      origin: { address: origin.address, lat: origin.lat, lng: origin.lng },
      destination: { address: destination.address, lat: destination.lat, lng: destination.lng },
      rideType, price,
      distance: calculateDistance(finalDistance),
      distanceKm: finalDistance,
      duration: finalDuration,
      pin: ride.pin,
    });

    const fallbackTimer = setTimeout(() => {
      if (currentRideRef.current?.status === "finding") {
        setRideStatus("idle");
        setCurrentRide(null);
        currentRideRef.current = null;
        setRouteCoordinates([]);
        setDriverRealtimeLocation(null);
        Alert.alert("Sem motoristas", "Nenhum motorista disponível na sua região agora. Tente novamente em alguns instantes.");
      }
    }, 70000);
    timersRef.current.push(fallbackTimer);
  }

  function cancelRide() {
    if (currentRideRef.current && socket && connected) {
      socket.emit("passenger:cancel", { rideId: currentRideRef.current.id });
    }
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setCurrentRide(null);
    currentRideRef.current = null;
    setRideStatus("idle");
    setRouteCoordinates([]);
    setDriverRealtimeLocation(null);
  }

  async function rateDriver(stars: number) {
    if (!currentRide) return;
    try {
      if (currentRide.driver?.id) {
        await apiFetch("/api/ratings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rideId: currentRide.id,
            ratedId: parseInt(currentRide.driver.id),
            stars,
            role: "passenger",
          }),
        });
      }
    } catch {
    }
    const rated = { ...currentRide, rating: stars, status: "completed" as RideStatus };
    const newHistory = [rated, ...history].slice(0, 50);
    setHistory(newHistory);
    await saveHistory(newHistory);
    setCurrentRide(null);
    currentRideRef.current = null;
    setRideStatus("idle");
    setRouteCoordinates([]);
    setDriverRealtimeLocation(null);
  }

  function triggerSOS() {
    if (!currentRide) return;
    setCurrentRide((prev) => prev ? { ...prev, isEmergencyActive: true } : prev);
    if (socket && connected) {
      socket.emit("ride:emergency", { rideId: currentRide.id });
    }
  }

  function verifyPIN(inputPin: string): boolean {
    return !!currentRide?.pin && inputPin === currentRide.pin;
  }

  function resetRide() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setCurrentRide(null);
    currentRideRef.current = null;
    setRideStatus("idle");
    setRouteCoordinates([]);
    setDriverRealtimeLocation(null);
  }

  return (
    <RideContext.Provider value={{
      currentRide, rideStatus, history, requestRide, cancelRide,
      rateDriver, resetRide, calculatePrice, calculateDuration,
      calculateDistance, triggerSOS, verifyPIN, userLocation,
      routeCoordinates, driverRealtimeLocation,
    }}>
      {children}
    </RideContext.Provider>
  );
}

export const useRide = () => useContext(RideContext);
