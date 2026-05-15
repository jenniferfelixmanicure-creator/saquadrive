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
      Alert.alert(
        "Conta não aprovada",
        "Seus documentos ainda estão em análise. Você só pode ficar online após aprovação pelo administrador.",
        [{ text: "Ver documentos", onPress: () => router.push("/(driver)/upload-documents") }, { text: "OK" }]
      );
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
                    <Text style={styles.avatarText}>{item.passenger[0]}</Text>
                  </View>
                  <View style={styles.requestInfo}>
                    <Text style={[styles.passengerName, { color: colors.foreground }]}>
                      {item.passenger}
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
              <TouchableOpacity
                style={[styles.arrivedBtn, { backgroundColor: colors.primary }]}
                onPress={handleArrived}
                activeOpacity={0.85}
              >
                <Feather name="map-pin" size={18} color="#fff" />
                <Text style={styles.finishText}>Cheguei ao local</Text>
              </TouchableOpacity>
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
});
