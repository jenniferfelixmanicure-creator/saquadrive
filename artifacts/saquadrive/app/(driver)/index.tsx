import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppMap from "@/components/AppMap";
import { LinearGradient } from "expo-linear-gradient";
import SubscriptionLock from "@/components/SubscriptionLock";
import SOSButton from "@/components/SOSButton";

import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { useColors } from "@/hooks/useColors";
import RideChat, { ChatMessage } from "@/components/RideChat";
import { getRoute } from "@/lib/google-maps";
import { sendLocalNotification } from "@/lib/notifications";

type RideLocation = { address: string; lat: number; lng: number };

type RideRequest = {
  rideId: string;
  passenger: string;
  origin: RideLocation | string;
  destination: RideLocation | string;
  distance: string;
  price: number;
  rideType: string;
  eta: number;
};

function parseLocation(field: RideLocation | string): RideLocation | undefined {
  if (typeof field === "object" && field !== null && field.lat && field.lng) return field;
  return undefined;
}

function getAddressText(field: RideLocation | string): string {
  if (typeof field === "object" && field !== null) return field.address;
  return field as string;
}


// ─── Ilustração Conta em Análise ────────────────────────────────────────────
function NotApprovedIllustration({ floatY }: { floatY: Animated.AnimatedInterpolation<number> }) {
  return (
    <Animated.View style={[naStyles.illRoot, { transform: [{ translateY: floatY }] }]}>
      {/* Glow orb de fundo */}
      <View style={naStyles.glowOrb} />

      {/* Cartão de documento principal */}
      <View style={naStyles.docCard}>
        {/* Clipe do clipboard no topo */}
        <View style={naStyles.clipTop}>
          <View style={naStyles.clipHole} />
        </View>

        {/* Avatar do motorista */}
        <View style={naStyles.avatarRing}>
          <View style={naStyles.avatarInner}>
            <Feather name="user" size={22} color="#fff" />
          </View>
        </View>

        {/* Linhas de documento */}
        <View style={naStyles.docLinesFull} />
        <View style={naStyles.docLinesMid} />

        {/* Linha de item com check */}
        <View style={naStyles.docItemRow}>
          <View style={naStyles.docCheckGreen}>
            <Feather name="check" size={9} color="#fff" />
          </View>
          <View style={naStyles.docLineShort} />
        </View>
        <View style={naStyles.docItemRow}>
          <View style={naStyles.docCheckGreen}>
            <Feather name="check" size={9} color="#fff" />
          </View>
          <View style={naStyles.docLineShort} />
        </View>
        <View style={naStyles.docItemRow}>
          <View style={naStyles.docCheckOrange}>
            <Feather name="clock" size={9} color="#fff" />
          </View>
          <View style={[naStyles.docLineShort, { width: 48 }]} />
        </View>
      </View>

      {/* Badge escudo verde — canto inferior esquerdo */}
      <View style={naStyles.badgeShield}>
        <LinearGradient colors={["#34C759","#28A846"]} style={naStyles.badgeGrad}>
          <Feather name="shield" size={14} color="#fff" />
        </LinearGradient>
      </View>

      {/* Badge lupa azul — canto superior direito */}
      <View style={naStyles.badgeLupa}>
        <LinearGradient colors={["#00C4FF","#2563EB"]} style={naStyles.badgeGrad}>
          <Feather name="search" size={14} color="#fff" />
        </LinearGradient>
      </View>

      {/* Estrelinhas decorativas */}
      <View style={[naStyles.star, { top: 0, left: 10, width: 8, height: 8, borderRadius: 2, backgroundColor: "#4F8EF7", opacity: 0.8 }]} />
      <View style={[naStyles.star, { top: 8, right: 4, width: 5, height: 5, borderRadius: 1, backgroundColor: "#00C4FF", opacity: 0.6 }]} />
      <View style={[naStyles.star, { bottom: 20, right: 14, width: 6, height: 6, borderRadius: 1, backgroundColor: "#4F8EF7", opacity: 0.5 }]} />
      <View style={[naStyles.star, { bottom: 30, left: 2, width: 4, height: 4, borderRadius: 1, backgroundColor: "#34C759", opacity: 0.7 }]} />
    </Animated.View>
  );
}

const naStyles = StyleSheet.create({
  illRoot: { width: 160, height: 170, alignItems: "center", justifyContent: "center" },
  glowOrb: {
    position: "absolute", width: 130, height: 130, borderRadius: 65,
    backgroundColor: "#00C4FF", opacity: 0.08,
    shadowColor: "#00C4FF", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 40, elevation: 0,
  },
  docCard: {
    width: 100, height: 130, borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center", paddingTop: 22, paddingHorizontal: 12,
    gap: 7,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 18, elevation: 14,
  },
  clipTop: {
    position: "absolute", top: -10,
    width: 40, height: 20, borderRadius: 6,
    backgroundColor: "#2563EB",
    alignItems: "center", justifyContent: "center",
  },
  clipHole: { width: 18, height: 8, borderRadius: 4, backgroundColor: "#1A3A8F" },
  avatarRing: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 3, borderColor: "#E8F0FE",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#EEF2FF",
  },
  avatarInner: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#2563EB",
    alignItems: "center", justifyContent: "center",
  },
  docLinesFull: { width: 68, height: 5, borderRadius: 3, backgroundColor: "#E2E8F0" },
  docLinesMid: { width: 52, height: 5, borderRadius: 3, backgroundColor: "#EDF2F7" },
  docItemRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  docCheckGreen: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#34C759", alignItems: "center", justifyContent: "center" },
  docCheckOrange: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#FF9500", alignItems: "center", justifyContent: "center" },
  docLineShort: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0" },
  badgeShield: {
    position: "absolute", bottom: 18, left: 0,
    borderRadius: 20, overflow: "hidden",
    shadowColor: "#34C759", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  badgeLupa: {
    position: "absolute", top: 8, right: 0,
    borderRadius: 20, overflow: "hidden",
    shadowColor: "#00C4FF", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  badgeGrad: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  star: { position: "absolute", transform: [{ rotate: "45deg" }] },
});

export default function DriverHomeScreen() {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [isOnline, setIsOnline] = useState(false);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [ridePhase, setRidePhase] = useState<"idle" | "picking_up" | "in_progress">("idle");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [showNotApprovedModal, setShowNotApprovedModal] = useState(false);
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Floating animation for modal illustration
  useEffect(() => {
    if (showNotApprovedModal) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: -10, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ])
      ).start();
    } else {
      floatAnim.stopAnimation();
      floatAnim.setValue(0);
    }
  }, [showNotApprovedModal]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const phaseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 60;

  // GPS do motorista
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || !mounted) return;

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (loc) => {
          const { latitude, longitude } = loc.coords;
          if (!mounted) return;
          setDriverLocation({ latitude, longitude });
          if (socket && connected && user) {
            socket.emit("driver:update_location", { driverId: user.id, latitude, longitude });
          }
        }
      );
      locationSub.current = sub;
    })();

    return () => {
      mounted = false;
      locationSub.current?.remove();
      locationSub.current = null;
    };
  }, [socket, connected, user]);

  // Ficar online/offline
  useEffect(() => {
    if (isOnline && !activeRide) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();

      if (socket && connected && user && driverLocation) {
        socket.emit("driver:online", {
          driverId: user.id,
          name: user.name,
          car: user.vehicleModel ?? "Toyota Corolla",
          color: "Prata",
          plate: user.vehiclePlate ?? "ABC-1234",
          rating: user.driverRating ?? 4.9,
          photo: user.name.slice(0, 2).toUpperCase(),
          eta: 4,
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          vehicleYear: user.vehicleYear,
          vehicleType: user.vehicleType ?? "car",
        });
      }
    } else {
      dotAnim.stopAnimation();
      dotAnim.setValue(0);
      if (!isOnline) {
        setRequests([]);
        if (socket && connected) socket.emit("driver:offline");
      }
    }
  }, [isOnline, activeRide, socket, connected, user, driverLocation]);

  // Eventos de socket
  useEffect(() => {
    if (!socket) return;

    socket.on("driver:ride_request", (data: RideRequest) => {
      if (!isOnline || activeRide) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      sendLocalNotification(
        "🚕 Nova Corrida!",
        `Passageiro: ${data.passenger} está aguardando a ${data.distance} de você.`,
        data
      );
      setRequests((prev) => {
        const exists = prev.find((r) => r.rideId === data.rideId);
        return exists ? prev : [...prev, data];
      });
    });

    socket.on("driver:ride_cancelled", ({ rideId }: { rideId: string }) => {
      setRequests((prev) => prev.filter((r) => r.rideId !== rideId));
      if (activeRide?.rideId === rideId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        phaseTimers.current.forEach(clearTimeout);
        phaseTimers.current = [];
        setActiveRide(null);
        setRidePhase("idle");
        setRouteCoords([]);
      }
    });

    socket.on("driver:ride_accepted_by_other", ({ rideId }: { rideId: string }) => {
      setRequests((prev) => prev.filter((r) => r.rideId !== rideId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    });

    socket.on("driver:ride_cancelled_for_others", ({ rideId }: { rideId: string }) => {
      setRequests((prev) => prev.filter((r) => r.rideId !== rideId));
    });

    socket.on("passenger:ride_cancelled_by_driver", ({ rideId }: { rideId: string }) => {
      if (activeRide?.rideId === rideId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        phaseTimers.current.forEach(clearTimeout);
        phaseTimers.current = [];
        setActiveRide(null);
        setRidePhase("idle");
        setRouteCoords([]);
      }
    });

    const chatHandler = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!chatOpen) {
        setUnreadCount((n) => n + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };
    socket.on("chat:message", chatHandler);

    socket.on("driver:pin_invalid", ({ message }: { rideId: string; message: string }) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setRidePhase("picking_up");
      setShowPinModal(true);
      setPinError(message);
    });

    socket.on("driver:error", ({ message }: { code: string; message: string }) => {
      Alert.alert("Atenção", message);
      setIsOnline(false);
    });

    return () => {
      socket.off("driver:ride_request");
      socket.off("driver:ride_cancelled");
      socket.off("driver:ride_accepted_by_other");
      socket.off("driver:ride_cancelled_for_others");
      socket.off("passenger:ride_cancelled_by_driver");
      socket.off("chat:message", chatHandler);
      socket.off("driver:pin_invalid");
      socket.off("driver:error");
    };
  }, [socket, isOnline, activeRide, chatOpen]);

  // Gerar rota quando fase muda
  useEffect(() => {
    if (!activeRide || !driverLocation) {
      setRouteCoords([]);
      return;
    }

    async function buildRoute() {
      if (!activeRide || !driverLocation) return;
      const pickupLoc = parseLocation(activeRide.origin);

      if (ridePhase === "picking_up" && pickupLoc) {
        const result = await getRoute(
          { lat: driverLocation.latitude, lng: driverLocation.longitude },
          { lat: pickupLoc.lat, lng: pickupLoc.lng }
        );
        if (result) setRouteCoords(result.polylineCoords);
      } else if (ridePhase === "in_progress") {
        const destLoc = parseLocation(activeRide.destination);
        if (pickupLoc && destLoc) {
          const result = await getRoute(
            { lat: pickupLoc.lat, lng: pickupLoc.lng },
            { lat: destLoc.lat, lng: destLoc.lng }
          );
          if (result) setRouteCoords(result.polylineCoords);
        }
      }
    }

    buildRoute();
  }, [activeRide?.rideId, ridePhase, driverLocation?.latitude, driverLocation?.longitude]);

  function handleToggle() {
    if (!isOnline && !user?.isApproved) {
      setShowNotApprovedModal(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const next = !isOnline;
    setIsOnline(next);
    if (!next) {
      setRequests([]);
      setActiveRide(null);
      setRidePhase("idle");
      setRouteCoords([]);
      phaseTimers.current.forEach(clearTimeout);
      phaseTimers.current = [];
    }
  }

  function handleAccept(req: RideRequest) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActiveRide(req);
    setRidePhase("picking_up");
    setRequests([]);
    if (socket && connected) {
      socket.emit("driver:accept", { rideId: req.rideId });
    }
  }

  function handleArrived() {
    if (!activeRide) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (socket && connected) socket.emit("driver:arrived", { rideId: activeRide.rideId });
    setShowPinModal(true);
    setPinInput("");
    setPinError("");
  }

  function handleStartTrip() {
    if (!activeRide) return;
    if (pinInput.length !== 4) {
      setPinError("Digite o código de 4 dígitos mostrado ao passageiro.");
      return;
    }
    if (socket && connected) {
      socket.emit("driver:start_trip", { rideId: activeRide.rideId, pin: pinInput });
    }
    setShowPinModal(false);
    setRidePhase("in_progress");
  }

  function handleReject(rideId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (socket && connected) socket.emit("driver:reject", { rideId });
    setRequests((prev) => prev.filter((r) => r.rideId !== rideId));
  }

  function handleFinishRide() {
    if (!activeRide) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (socket && connected) socket.emit("driver:complete_trip", { rideId: activeRide.rideId });
    phaseTimers.current.forEach(clearTimeout);
    phaseTimers.current = [];
    setActiveRide(null);
    setRidePhase("idle");
    setRouteCoords([]);
    setChatMessages([]);
    setUnreadCount(0);
  }

  function handleCancelActiveRide() {
    if (!activeRide) return;
    Alert.alert(
      "Cancelar corrida",
      "Tem certeza que deseja cancelar esta corrida? O passageiro será notificado.",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Cancelar corrida",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            if (socket && connected) socket.emit("driver:cancel", { rideId: activeRide.rideId });
            phaseTimers.current.forEach(clearTimeout);
            phaseTimers.current = [];
            setActiveRide(null);
            setRidePhase("idle");
            setRouteCoords([]);
            setChatMessages([]);
            setUnreadCount(0);
          },
        },
      ]
    );
  }

  const dotOpacity = dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  // Determinar o que mostrar no mapa
  const mapOrigin = driverLocation
    ? { address: "Minha localização", lat: driverLocation.latitude, lng: driverLocation.longitude }
    : undefined;

  const mapDestination = activeRide
    ? ridePhase === "picking_up"
      ? parseLocation(activeRide.origin)
      : parseLocation(activeRide.destination)
    : undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {user?.mode === "driver" && user?.subscriptionActive === false && (
        <SubscriptionLock expiresAt={user?.subscriptionExpiresAt} />
      )}
      {activeRide && (
        <SOSButton onPress={() => socket?.emit("driver:sos", { rideId: activeRide.rideId })} />
      )}
      <AppMap
        isOnline={isOnline}
        mode="driver"
        origin={mapOrigin}
        destination={mapDestination}
        originColor={colors.success}
        destColor={ridePhase === "picking_up" ? colors.primary : colors.accent}
        routeCoordinates={routeCoords}
        markerColor={isOnline ? colors.accent : colors.border}
      />

      {/* Barra de status */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <View style={[styles.statusPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Animated.View style={[styles.statusDot, {
            backgroundColor: isOnline ? colors.success : colors.mutedForeground,
            opacity: isOnline ? dotOpacity : 1,
          }]} />
          <Text style={[styles.statusText, { color: colors.foreground }]}>
            {isOnline ? "Online" : "Offline"}
          </Text>
          {connected ? (
            <View style={[styles.wsBadge, { backgroundColor: colors.success + "22" }]}>
              <Feather name="wifi" size={10} color={colors.success} />
            </View>
          ) : null}
          <Switch
            value={isOnline}
            onValueChange={handleToggle}
            trackColor={{ false: colors.muted, true: colors.success + "88" }}
            thumbColor={isOnline ? colors.success : colors.mutedForeground}
          />
        </View>

        {/* Badge de fase da corrida */}
        {activeRide && (
          <View style={[styles.phaseBadge, {
            backgroundColor: ridePhase === "in_progress" ? colors.success + "22" : colors.accent + "22",
            borderColor: ridePhase === "in_progress" ? colors.success + "55" : colors.accent + "55",
          }]}>
            <Feather
              name={ridePhase === "in_progress" ? "navigation" : "map-pin"}
              size={12}
              color={ridePhase === "in_progress" ? colors.success : colors.accent}
            />
            <Text style={[styles.phaseBadgeText, {
              color: ridePhase === "in_progress" ? colors.success : colors.accent,
            }]}>
              {ridePhase === "picking_up"
                ? `Buscando: ${getAddressText(activeRide.origin)}`
                : `Destino: ${getAddressText(activeRide.destination)}`}
            </Text>
          </View>
        )}
      </View>

      {/* Painel inferior */}
      <View style={[styles.bottomPanel, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        paddingBottom: botPad + 16,
      }]}>

        {/* OFFLINE */}
        {!isOnline && !activeRide && (
          <View style={styles.centerMsg}>
            <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
              <Feather name="power" size={28} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Você está offline</Text>
            <Text style={[styles.panelDesc, { color: colors.mutedForeground }]}>
              Ative o botão para receber corridas
            </Text>
          </View>
        )}

        {/* ONLINE, aguardando */}
        {isOnline && requests.length === 0 && !activeRide && (
          <View style={styles.centerMsg}>
            <Animated.View style={{ opacity: dotOpacity }}>
              <View style={[styles.iconBox, { backgroundColor: colors.accent + "22" }]}>
                <Feather name="radio" size={28} color={colors.accent} />
              </View>
            </Animated.View>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>
              {connected ? "Aguardando corridas…" : "Conectando…"}
            </Text>
            <Text style={[styles.panelDesc, { color: colors.mutedForeground }]}>
              {connected
                ? "Você receberá solicitações em tempo real"
                : "Reconectando ao servidor"}
            </Text>
          </View>
        )}

        {/* SOLICITAÇÕES */}
        {isOnline && requests.length > 0 && !activeRide && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Corridas disponíveis
            </Text>
            {requests.map((item) => (
              <View
                key={item.rideId}
                style={[styles.requestCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
              >
                <View style={styles.requestHeader}>
                  <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                    <Text style={styles.avatarText}>{(item.passenger ?? 'P')[0]}</Text>
                  </View>
                  <View style={styles.requestInfo}>
                    <Text style={[styles.passengerName, { color: colors.foreground }]}>
                      {item.passenger ?? "Passageiro"}
                    </Text>
                    <Text style={[styles.requestMeta, { color: colors.mutedForeground }]}>
                      {item.distance} · {item.eta} min para buscar
                    </Text>
                  </View>
                  <Text style={[styles.price, { color: colors.primary }]}>
                    R$ {item.price.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.requestRoute, { borderTopColor: colors.border }]}>
                  <View style={styles.routeLine}>
                    <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.routeText, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {getAddressText(item.origin)}
                    </Text>
                  </View>
                  <View style={styles.routeLine}>
                    <View style={[styles.routeDot, { backgroundColor: colors.accent }]} />
                    <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>
                      {getAddressText(item.destination)}
                    </Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.rejectBtn, { borderColor: colors.border }]}
                    onPress={() => handleReject(item.rideId)}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleAccept(item)}
                    activeOpacity={0.85}
                  >
                    <Feather name="check" size={18} color="#fff" />
                    <Text style={styles.acceptText}>Aceitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {/* CORRIDA ATIVA */}
        {activeRide && (
          <View>
            <View style={[styles.activeHeader, {
              backgroundColor: ridePhase === "in_progress"
                ? colors.success + "22"
                : colors.accent + "22",
            }]}>
              <Feather
                name={ridePhase === "in_progress" ? "navigation" : "user-check"}
                size={18}
                color={ridePhase === "in_progress" ? colors.success : colors.accent}
              />
              <Text style={[styles.activeStatus, {
                color: ridePhase === "in_progress" ? colors.success : colors.accent,
              }]}>
                {ridePhase === "picking_up" ? "A caminho do passageiro" : "Corrida em andamento"}
              </Text>
            </View>

            <View style={styles.activeRideRow}>
              <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                <Text style={styles.avatarText}>{activeRide.passenger[0]}</Text>
              </View>
              <View style={styles.requestInfo}>
                <Text style={[styles.passengerName, { color: colors.foreground }]}>
                  {activeRide.passenger}
                </Text>
                <Text style={[styles.requestMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {ridePhase === "picking_up"
                    ? `Buscar em: ${getAddressText(activeRide.origin)}`
                    : `Destino: ${getAddressText(activeRide.destination)}`}
                </Text>
              </View>
              <Text style={[styles.price, { color: colors.primary }]}>
                R$ {activeRide.price.toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.chatFullBtn, {
                backgroundColor: colors.accent + "22",
                borderColor: colors.accent + "55",
                borderWidth: 1,
                marginBottom: 10,
              }]}
              onPress={() => { setChatOpen(true); setUnreadCount(0); }}
              activeOpacity={0.8}
            >
              <Feather name="message-circle" size={18} color={colors.accent} />
              <Text style={[styles.chatBtnText, { color: colors.accent }]}>
                Falar com o passageiro
              </Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {ridePhase === "picking_up" && (
              <>
                <TouchableOpacity
                  style={[styles.arrivedBtn, { backgroundColor: colors.primary }]}
                  onPress={handleArrived}
                  activeOpacity={0.85}
                >
                  <Feather name="map-pin" size={18} color="#fff" />
                  <Text style={styles.finishText}>Cheguei ao local</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelRideBtn, { borderColor: colors.border }]}
                  onPress={handleCancelActiveRide}
                  activeOpacity={0.7}
                >
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.cancelRideBtnText, { color: colors.mutedForeground }]}>
                    Cancelar corrida
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {ridePhase === "in_progress" && (
              <TouchableOpacity
                style={[styles.finishBtn, { backgroundColor: colors.success }]}
                onPress={handleFinishRide}
                activeOpacity={0.85}
              >
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={styles.finishText}>Finalizar corrida</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {activeRide && user && (
        <RideChat
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          rideId={activeRide.rideId}
          myId={user.id}
          myName={user.name}
          otherName={activeRide.passenger}
          socket={socket}
          messages={chatMessages}
          onNewMessage={(msg) => setChatMessages((prev) => [...prev, msg])}
        />
      )}

      {/* Modal de verificação de PIN */}
      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.pinOverlay}>
          <View style={[styles.pinModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.pinIconBox, { backgroundColor: colors.primary + "22" }]}>
              <Feather name="shield" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.pinTitle, { color: colors.foreground }]}>Verificar passageiro</Text>
            <Text style={[styles.pinDesc, { color: colors.mutedForeground }]}>
              Peça o código de 4 dígitos ao passageiro e digite abaixo para iniciar a corrida
            </Text>
            <TextInput
              style={[styles.pinInputField, { backgroundColor: colors.muted, color: colors.foreground, borderColor: pinError ? "#FF453A" : colors.border }]}
              placeholder="0000"
              placeholderTextColor={colors.mutedForeground}
              value={pinInput}
              onChangeText={(t) => { setPinInput(t.replace(/\D/g, "").slice(0, 4)); setPinError(""); }}
              keyboardType="numeric"
              maxLength={4}
              textAlign="center"
              autoFocus
            />
            {pinError ? (
              <Text style={styles.pinError}>{pinError}</Text>
            ) : null}
            <View style={styles.pinActions}>
              <TouchableOpacity
                style={[styles.pinCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowPinModal(false)}
              >
                <Text style={[styles.pinCancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pinConfirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleStartTrip}
              >
                <Text style={styles.pinConfirmText}>Iniciar corrida</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Conta em Análise ──────────────────────────────── */}
      <Modal
        visible={showNotApprovedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotApprovedModal(false)}
      >
        <View style={styles.naOverlay}>
          <LinearGradient
            colors={["#0F1E38", "#0D1628", "#080E1C"]}
            style={[styles.naCard, { borderColor: "rgba(0,196,255,0.15)" }]}
          >
            {/* Glow topo */}
            <View style={styles.naTopGlow} />

            {/* Ilustração animada */}
            <View style={styles.naIllustration}>
              <NotApprovedIllustration
                floatY={floatAnim.interpolate({ inputRange: [-10, 0], outputRange: [-10, 0] })}
              />
            </View>

            {/* Content */}
            <Text style={styles.naTitle}>Conta em Análise</Text>

            {/* Barra de progresso de 3 passos */}
            <View style={styles.naStepsRow}>
              <View style={styles.naStepDone}>
                <Feather name="check" size={11} color="#fff" />
              </View>
              <View style={[styles.naStepLine, { backgroundColor: "#00C4FF" }]} />
              <View style={[styles.naStepActive, { borderColor: "#00C4FF" }]}>
                <View style={[styles.naStepActiveDot, { backgroundColor: "#00C4FF" }]} />
              </View>
              <View style={[styles.naStepLine, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
              <View style={styles.naStepPending}>
                <Feather name="award" size={11} color="rgba(255,255,255,0.4)" />
              </View>
            </View>
            <View style={styles.naStepsLabels}>
              <Text style={styles.naStepLabelDone}>Enviado</Text>
              <Text style={styles.naStepLabelActive}>Em análise</Text>
              <Text style={styles.naStepLabelPending}>Aprovado</Text>
            </View>

            <Text style={styles.naDesc}>
              Estamos revisando seus documentos.{"\n"}Em breve você poderá começar a dirigir!
            </Text>

            {/* Verificar Status button */}
            <TouchableOpacity
              onPress={() => {
                setShowNotApprovedModal(false);
                router.push("/(driver)/upload-documents");
              }}
              activeOpacity={0.85}
              style={styles.naVerifyOuter}
            >
              <LinearGradient
                colors={["#00C4FF", "#1A6AFF"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.naVerifyBtn}
              >
                <View style={styles.naVerifyIcon}>
                  <Feather name="activity" size={16} color="#fff" />
                </View>
                <Text style={styles.naVerifyText}>Verificar Status</Text>
                <Feather name="arrow-right" size={16} color="rgba(255,255,255,0.8)" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Entendido button */}
            <TouchableOpacity
              style={[styles.naUnderstoodBtn, { borderColor: "rgba(52,199,89,0.35)" }]}
              onPress={() => setShowNotApprovedModal(false)}
              activeOpacity={0.85}
            >
              <View style={styles.naUnderstoodIcon}>
                <Feather name="check-circle" size={16} color="#34C759" />
              </View>
              <Text style={styles.naUnderstoodText}>Entendido</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 8, gap: 8,
  },
  statusPill: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 30, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  wsBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  phaseBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  phaseBadgeText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", flex: 1,
  },
  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, paddingHorizontal: 20, paddingTop: 20,
    maxHeight: "55%",
  },
  centerMsg: { alignItems: "center", gap: 10, paddingVertical: 12 },
  iconBox: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  panelTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  panelDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  sectionTitle: {
    fontSize: 15, fontFamily: "Inter_700Bold",
    marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5,
  },
  requestCard: { borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  requestHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  requestInfo: { flex: 1 },
  passengerName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  requestMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  price: { fontSize: 17, fontFamily: "Inter_700Bold" },
  requestRoute: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, gap: 6 },
  routeLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  requestActions: { flexDirection: "row", gap: 10, padding: 12 },
  rejectBtn: {
    width: 46, height: 46, borderRadius: 12,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  acceptBtn: {
    flex: 1, height: 46, borderRadius: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  acceptText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  activeHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  activeStatus: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  activeRideRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  finishBtn: {
    height: 50, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  finishText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  chatFullBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    height: 46, borderRadius: 12, paddingHorizontal: 16,
  },
  chatBtnText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  badge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#FF6B00", alignItems: "center", justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  arrivedBtn: {
    height: 50, borderRadius: 14, marginBottom: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  cancelRideBtn: {
    height: 42, borderRadius: 12, borderWidth: 1, marginBottom: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  cancelRideBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  pinOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center",
  },
  pinModal: {
    width: "86%", borderRadius: 24, borderWidth: 1,
    padding: 28, gap: 14, alignItems: "center",
  },
  pinIconBox: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  pinTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  pinDesc: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    textAlign: "center", lineHeight: 20,
  },
  pinInputField: {
    width: "100%", fontSize: 40, fontFamily: "Inter_700Bold",
    height: 76, borderRadius: 16, borderWidth: 2,
    letterSpacing: 18,
  },
  pinError: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "#FF453A", textAlign: "center",
  },
  pinActions: { flexDirection: "row", gap: 12, width: "100%", marginTop: 4 },
  pinCancelBtn: {
    flex: 1, height: 50, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  pinCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  pinConfirmBtn: {
    flex: 1, height: 50, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  pinConfirmText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // ── Not Approved Modal ──────────────────────────────────────────────────────
  naOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  naCard: {
    width: "100%", borderRadius: 32, borderWidth: 1,
    paddingHorizontal: 28, paddingTop: 40, paddingBottom: 28,
    alignItems: "center", gap: 0, overflow: "hidden",
    shadowColor: "#00C4FF", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 30, elevation: 24,
  },
  naTopGlow: {
    position: "absolute", top: -60, left: "10%", right: "10%",
    height: 120, borderRadius: 60,
    backgroundColor: "#00C4FF", opacity: 0.07,
  },
  naIllustration: { marginBottom: 24, alignItems: "center" },
  naTitle: {
    fontSize: 26, fontFamily: "Inter_700Bold",
    color: "#FFFFFF", textAlign: "center", marginBottom: 10,
    letterSpacing: -0.5,
  },
  naDesc: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "rgba(200,220,255,0.65)", textAlign: "center",
    lineHeight: 22, marginBottom: 28,
  },
  naVerifyOuter: {
    width: "100%", marginBottom: 12,
    shadowColor: "#00C4FF", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  naVerifyBtn: {
    width: "100%", height: 56, borderRadius: 16,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, gap: 12,
  },
  naVerifyIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  naVerifyText: {
    flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff",
  },
  naUnderstoodBtn: {
    width: "100%", height: 54, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, flexDirection: "row",
    alignItems: "center", paddingHorizontal: 20, gap: 12,
  },
  naUnderstoodIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "rgba(52,199,89,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  naUnderstoodText: {
    flex: 1, fontSize: 16, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.75)",
  },

  // Step progress bar
  naStepsRow: {
    flexDirection: "row", alignItems: "center", marginBottom: 6, width: "80%",
  },
  naStepDone: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#34C759", alignItems: "center", justifyContent: "center",
  },
  naStepActive: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,196,255,0.1)",
  },
  naStepActiveDot: { width: 10, height: 10, borderRadius: 5 },
  naStepPending: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center",
  },
  naStepLine: { flex: 1, height: 2, marginHorizontal: 4 },
  naStepsLabels: {
    flexDirection: "row", width: "88%", justifyContent: "space-between",
    marginBottom: 20,
  },
  naStepLabelDone: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#34C759", textAlign: "center", flex: 1 },
  naStepLabelActive: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#00C4FF", textAlign: "center", flex: 1 },
  naStepLabelPending: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.35)", textAlign: "center", flex: 1 },
});
