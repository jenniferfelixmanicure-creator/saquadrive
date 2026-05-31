import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  Alert, Animated, Easing, FlatList, Image, Linking, Modal, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
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
import AIMonitoringPopup from "@/components/AIMonitoringPopup";
import { getRoute, getRouteWithSteps, NavStep } from "@/lib/google-maps";
import { sendLocalNotification } from "@/lib/notifications";
import * as Speech from "expo-speech";
import NavigationOverlay from "@/components/NavigationOverlay";

type RideLocation = { address: string; lat: number; lng: number };

type RideRequest = {
  rideId: string;
  passenger: string;
  passengerId?: string;
  passengerRating?: number;
  passengerTotalRides?: number;
  passengerPhotoUrl?: string | null;
  origin: RideLocation | string;
  destination: RideLocation | string;
  distance: string;
  distanceToPassenger?: string;
  price: number;
  rideType: string;
  eta: number;
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseLocation(field: RideLocation | string): RideLocation | undefined {
  if (typeof field === "object" && field !== null && field.lat && field.lng) return field;
  return undefined;
}

function getAddressText(field: RideLocation | string): string {
  if (typeof field === "object" && field !== null) return field.address;
  return field as string;
}

function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  const full = Math.floor(rating);
  const colors = { filled: "#FFD60A", empty: "#334155" };
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text key={s} style={{ fontSize: size, color: s <= full ? colors.filled : colors.empty }}>★</Text>
      ))}
    </View>
  );
}

function NotApprovedIllustration({ floatY }: { floatY: Animated.AnimatedInterpolation<number> }) {
  return (
    <Animated.View style={[naStyles.illRoot, { transform: [{ translateY: floatY }] }]}>
      <View style={naStyles.glowOrb} />
      <View style={naStyles.docCard}>
        <View style={naStyles.clipTop}><View style={naStyles.clipHole} /></View>
        <View style={naStyles.avatarRing}><View style={naStyles.avatarInner}><Feather name="user" size={22} color="#fff" /></View></View>
        <View style={naStyles.docLinesFull} /><View style={naStyles.docLinesMid} />
        <View style={naStyles.docItemRow}><View style={naStyles.docCheckGreen}><Feather name="check" size={9} color="#fff" /></View><View style={naStyles.docLineShort} /></View>
        <View style={naStyles.docItemRow}><View style={naStyles.docCheckGreen}><Feather name="check" size={9} color="#fff" /></View><View style={naStyles.docLineShort} /></View>
        <View style={naStyles.docItemRow}><View style={naStyles.docCheckOrange}><Feather name="clock" size={9} color="#fff" /></View><View style={[naStyles.docLineShort, { width: 48 }]} /></View>
      </View>
      <View style={naStyles.badgeShield}><LinearGradient colors={["#34C759","#28A846"]} style={naStyles.badgeGrad}><Feather name="shield" size={14} color="#fff" /></LinearGradient></View>
      <View style={naStyles.badgeLupa}><LinearGradient colors={["#00C4FF","#2563EB"]} style={naStyles.badgeGrad}><Feather name="search" size={14} color="#fff" /></LinearGradient></View>
    </Animated.View>
  );
}

export default function DriverHomeScreen() {
  const { user, apiFetch } = useAuth();
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
  const [requestCountdowns, setRequestCountdowns] = useState<Record<string, number>>({});
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [arrivedAt, setArrivedAt] = useState<Date | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [waitFeeStarted, setWaitFeeStarted] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedStars, setSelectedStars] = useState(5);
  const [pendingRating, setPendingRating] = useState<{ rideId: string; passengerId: string; passengerName: string } | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [showMonitoringPopup, setShowMonitoringPopup] = useState(false);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const waitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Turn-by-turn navigation state
  const [navModeActive, setNavModeActive] = useState(false);
  const [currentNavStep, setCurrentNavStep] = useState<NavStep | null>(null);
  const [nextNavStep, setNextNavStep] = useState<NavStep | null>(null);
  const [distToNextStep, setDistToNextStep] = useState(0);
  const [totalNavRemaining, setTotalNavRemaining] = useState(0);
  const [durationNavRemaining, setDurationNavRemaining] = useState(0);
  const navStepsRef = useRef<NavStep[]>([]);
  const currentStepIdxRef = useRef(0);
  const navModeRef = useRef(false);
  const lastSpokenRef = useRef(-1); // step index * 10 + (0=step, 1=200m warning)

  useEffect(() => {
    if (requests.length === 0) {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      setRequestCountdowns({});
      return;
    }
    if (countdownRef.current) return;
    countdownRef.current = setInterval(() => {
      setRequestCountdowns((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id of Object.keys(next)) {
          if (next[id] > 0) { next[id] -= 1; changed = true; }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
  }, [requests.length]);

  const WAIT_FREE_MINUTES = 2;
  const WAIT_FEE_PER_MIN = 0.30;

  useEffect(() => {
    if (showNotApprovedModal) {
      Animated.loop(Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])).start();
    } else { floatAnim.stopAnimation(); floatAnim.setValue(0); }
  }, [showNotApprovedModal]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const phaseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 84 : insets.bottom + 60;

  // Tempo de espera timer
  useEffect(() => {
    if (arrivedAt) {
      waitTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - arrivedAt.getTime()) / 1000);
        setWaitSeconds(elapsed);
        if (elapsed >= WAIT_FREE_MINUTES * 60 && !waitFeeStarted) setWaitFeeStarted(true);
      }, 1000);
    } else {
      if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
      setWaitSeconds(0);
      setWaitFeeStarted(false);
    }
    return () => { if (waitTimerRef.current) clearInterval(waitTimerRef.current); };
  }, [arrivedAt]);

  // GPS
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || !mounted) return;
      const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 8 }, (loc) => {
        const { latitude, longitude } = loc.coords;
        if (!mounted) return;
        setDriverLocation({ latitude, longitude });
        if (socket && connected && user) socket.emit("driver:update_location", { driverId: user.id, latitude, longitude });

        // Turn-by-turn step tracking
        if (navModeRef.current && navStepsRef.current.length > 0) {
          const idx = currentStepIdxRef.current;
          const step = navStepsRef.current[idx];
          if (!step) return;

          const dist = haversineMeters(latitude, longitude, step.coordinate.latitude, step.coordinate.longitude);
          setDistToNextStep(dist);

          // 200m warning
          const warn200Key = idx * 10 + 1;
          if (dist <= 220 && dist > 60 && lastSpokenRef.current !== warn200Key) {
            lastSpokenRef.current = warn200Key;
            const d = Math.round(dist / 10) * 10;
            Speech.speak(`Em ${d} metros, ${step.instruction}`, { language: "pt-BR", rate: 0.9 });
          }

          // Advance to next step
          if (dist < 40 && idx < navStepsRef.current.length - 1) {
            const nextIdx = idx + 1;
            const nextStep = navStepsRef.current[nextIdx];
            currentStepIdxRef.current = nextIdx;
            lastSpokenRef.current = -1;
            setCurrentNavStep(nextStep);
            setNextNavStep(navStepsRef.current[nextIdx + 1] ?? null);
            setTotalNavRemaining(nextStep.remainingDistance);
            setDurationNavRemaining(nextStep.remainingDuration);
            Speech.speak(nextStep.instruction, { language: "pt-BR", rate: 0.9 });
          }
        }
      });
      locationSub.current = sub;
    })();
    return () => { mounted = false; locationSub.current?.remove(); locationSub.current = null; };
  }, [socket, connected, user]);

  // Online/Offline
  useEffect(() => {
    if (isOnline && !activeRide) {
      Animated.loop(Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])).start();
      if (socket && connected && user && driverLocation) {
        socket.emit("driver:online", {
          driverId: user.id, name: user.name, car: user.vehicleModel ?? "Veículo",
          color: (user as any).vehicleColor ?? "Prata", plate: user.vehiclePlate ?? "ABC-1234",
          rating: user.driverRating ?? 4.9, photo: user.profilePhotoUrl ?? user.name.slice(0, 2).toUpperCase(), eta: 4,
          latitude: driverLocation.latitude, longitude: driverLocation.longitude,
          vehicleYear: user.vehicleYear, vehicleType: user.vehicleType ?? "car",
        });
      }
    } else {
      dotAnim.stopAnimation(); dotAnim.setValue(0);
      if (!isOnline) { setRequests([]); if (socket && connected) socket.emit("driver:offline"); }
    }
  }, [isOnline, activeRide, socket, connected, user, driverLocation]);

  // Eventos socket
  useEffect(() => {
    if (!socket) return;
    socket.on("driver:ride_request", (data: RideRequest) => {
      if (!isOnline || activeRide) return;
      const safeData: RideRequest = { ...data, passenger: data.passenger ?? "Passageiro" };
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      sendLocalNotification("🚕 Nova Corrida!", `${safeData.passenger} — ${safeData.distanceToPassenger ?? safeData.distance}`, safeData);
      setRequests((prev) => { const exists = prev.find((r) => r.rideId === safeData.rideId); return exists ? prev : [...prev, safeData]; });
      setRequestCountdowns((prev) => ({ ...prev, [safeData.rideId]: 30 }));
    });
    socket.on("driver:ride_cancelled", ({ rideId }: { rideId: string }) => {
      setRequests((prev) => prev.filter((r) => r.rideId !== rideId));
      if (activeRide?.rideId === rideId) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); phaseTimers.current.forEach(clearTimeout); phaseTimers.current = []; setActiveRide(null); setRidePhase("idle"); setRouteCoords([]); setArrivedAt(null); }
    });
    socket.on("driver:ride_accepted_by_other", ({ rideId }: { rideId: string }) => { setRequests((prev) => prev.filter((r) => r.rideId !== rideId)); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); });
    socket.on("driver:ride_cancelled_for_others", ({ rideId }: { rideId: string }) => { setRequests((prev) => prev.filter((r) => r.rideId !== rideId)); });
    socket.on("passenger:ride_cancelled_by_driver", ({ rideId }: { rideId: string }) => {
      if (activeRide?.rideId === rideId) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); phaseTimers.current.forEach(clearTimeout); phaseTimers.current = []; setActiveRide(null); setRidePhase("idle"); setRouteCoords([]); setArrivedAt(null); }
    });
    const chatHandler = (msg: ChatMessage) => { setChatMessages((prev) => [...prev, msg]); if (!chatOpen) { setUnreadCount((n) => n + 1); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } };
    socket.on("chat:message", chatHandler);
    socket.on("driver:pin_invalid", ({ message }: { rideId: string; message: string }) => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); setRidePhase("picking_up"); setShowPinModal(true); setPinError(message); });
    socket.on("driver:error", ({ message }: { code: string; message: string }) => { Alert.alert("Atenção", message); setIsOnline(false); });
    socket.on("driver:wait_fee_started", ({ feePerMin }: { rideId: string; feePerMin: number }) => {
      setWaitFeeStarted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("⏱ Taxa de espera ativa", `R$ ${feePerMin.toFixed(2)}/min sendo adicionado ao total do passageiro.`);
    });
    socket.on("driver:wait_fee_info", ({ waitTimeFee }: { rideId: string; waitTimeFee: number }) => {
      if (waitTimeFee > 0) Alert.alert("Taxa de espera cobrada", `R$ ${waitTimeFee.toFixed(2)} adicionados ao total da corrida.`);
    });
    return () => {
      socket.off("driver:ride_request"); socket.off("driver:ride_cancelled"); socket.off("driver:ride_accepted_by_other");
      socket.off("driver:ride_cancelled_for_others"); socket.off("passenger:ride_cancelled_by_driver");
      socket.off("chat:message", chatHandler); socket.off("driver:pin_invalid"); socket.off("driver:error");
      socket.off("driver:wait_fee_started"); socket.off("driver:wait_fee_info");
    };
  }, [socket, isOnline, activeRide, chatOpen]);

  // Rota (e steps de navegação quando in_progress)
  useEffect(() => {
    if (!activeRide || !driverLocation) { setRouteCoords([]); return; }
    const pickupLoc = parseLocation(activeRide.origin);
    const destLoc = parseLocation(activeRide.destination);
    const origin = { lat: driverLocation.latitude, lng: driverLocation.longitude };

    if (ridePhase === "picking_up" && pickupLoc) {
      getRoute(origin, { lat: pickupLoc.lat, lng: pickupLoc.lng }).then((r) => {
        if (r) setRouteCoords(r.polylineCoords);
      });
    } else if (ridePhase === "in_progress" && destLoc) {
      // Fetch com steps para turn-by-turn
      getRouteWithSteps(origin, { lat: destLoc.lat, lng: destLoc.lng }).then((r) => {
        if (!r) return;
        setRouteCoords(r.polylineCoords);
        if (r.steps.length > 0) {
          navStepsRef.current = r.steps;
          currentStepIdxRef.current = 0;
          navModeRef.current = true;
          lastSpokenRef.current = -1;
          setNavModeActive(true);
          setCurrentNavStep(r.steps[0]);
          setNextNavStep(r.steps[1] ?? null);
          setDistToNextStep(r.steps[0].distance);
          setTotalNavRemaining(r.distance * 1000);
          setDurationNavRemaining(r.totalDurationSec);
          // Announce first instruction
          Speech.speak(r.steps[0].instruction, { language: "pt-BR", rate: 0.9 });
        }
      });
    }
  }, [activeRide?.rideId, ridePhase]);

  function openNavigation(lat: number, lng: number, label: string) {
    const wazeUrl = `waze://?ll=${lat},${lng}&navigate=yes`;
    const googleMapsUrl = `geo:${lat},${lng}?q=${encodeURIComponent(label)}`;
    const appleMapsUrl = `maps://maps.apple.com/?daddr=${lat},${lng}`;
    Linking.canOpenURL(wazeUrl).then((supported) => {
      if (supported) { Linking.openURL(wazeUrl); return; }
      if (Platform.OS === "ios") { Linking.openURL(appleMapsUrl); } else { Linking.openURL(googleMapsUrl); }
    }).catch(() => { Linking.openURL(googleMapsUrl); });
  }

    function resetNavState() {
    navStepsRef.current = [];
    currentStepIdxRef.current = 0;
    navModeRef.current = false;
    lastSpokenRef.current = -1;
    setNavModeActive(false);
    setCurrentNavStep(null);
    setNextNavStep(null);
    setDistToNextStep(0);
    setTotalNavRemaining(0);
    setDurationNavRemaining(0);
    Speech.stop();
  }

  function handleToggle() {
    if (!isOnline && !user?.isApproved) { setShowNotApprovedModal(true); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const next = !isOnline; setIsOnline(next);
    if (!next) { setRequests([]); setActiveRide(null); setRidePhase("idle"); setRouteCoords([]); phaseTimers.current.forEach(clearTimeout); phaseTimers.current = []; setArrivedAt(null); resetNavState(); }
  }

  function handleAccept(req: RideRequest) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActiveRide(req); setRidePhase("picking_up"); setRequests([]);
    if (socket && connected) socket.emit("driver:accept", { rideId: req.rideId });
  }

  function handleArrived() {
    if (!activeRide) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setArrivedAt(new Date());
    if (socket && connected) socket.emit("driver:arrived", { rideId: activeRide.rideId });
    setShowPinModal(true); setPinInput(""); setPinError("");
  }

  function handleStartTrip() {
    if (!activeRide) return;
    if (pinInput.length !== 4) { setPinError("Digite o código de 4 dígitos mostrado ao passageiro."); return; }
    if (socket && connected) socket.emit("driver:start_trip", { rideId: activeRide.rideId, pin: pinInput });
    setShowPinModal(false); setRidePhase("in_progress"); setArrivedAt(null); setShowMonitoringPopup(true);
    // Navigation will start automatically via the route building effect
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
    phaseTimers.current.forEach(clearTimeout); phaseTimers.current = [];
    const finishedRideId = activeRide.rideId;
    const finishedPassengerId = activeRide.passengerId;
    const finishedPassengerName = activeRide.passenger ?? "Passageiro";
    resetNavState();
    setActiveRide(null); setRidePhase("idle"); setRouteCoords([]); setChatMessages([]); setUnreadCount(0); setArrivedAt(null);
    if (finishedPassengerId) {
      setPendingRating({ rideId: finishedRideId, passengerId: finishedPassengerId, passengerName: finishedPassengerName });
      setSelectedStars(5);
      setShowRatingModal(true);
    }
  }

  async function handleSubmitRating() {
    if (!pendingRating || !user) return;
    setRatingSubmitting(true);
    try {
      await apiFetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: pendingRating.rideId,
          ratedId: parseInt(pendingRating.passengerId),
          stars: selectedStars,
          role: "driver",
        }),
      });
    } catch {}
    setRatingSubmitting(false);
    setShowRatingModal(false);
    setPendingRating(null);
  }

  function handleCancelActiveRide() {
    if (!activeRide) return;
    Alert.alert("Cancelar corrida", "Tem certeza que deseja cancelar?", [
      { text: "Não", style: "cancel" },
      { text: "Cancelar corrida", style: "destructive", onPress: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (socket && connected) socket.emit("driver:cancel", { rideId: activeRide.rideId });
        phaseTimers.current.forEach(clearTimeout); phaseTimers.current = [];
        resetNavState();
        setActiveRide(null); setRidePhase("idle"); setRouteCoords([]); setChatMessages([]); setUnreadCount(0); setArrivedAt(null);
      }},
    ]);
  }

  function formatWaitTime(seconds: number) {
    const m = Math.floor(seconds / 60); const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function getWaitFee(seconds: number) {
    const chargeableSec = Math.max(0, seconds - WAIT_FREE_MINUTES * 60);
    return (chargeableSec / 60) * WAIT_FEE_PER_MIN;
  }

  const dotOpacity = dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const mapOrigin = driverLocation ? { address: "Minha localização", lat: driverLocation.latitude, lng: driverLocation.longitude } : undefined;
  const mapDestination = activeRide ? (ridePhase === "picking_up" ? parseLocation(activeRide.origin) : parseLocation(activeRide.destination)) : undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {user?.mode === "driver" && user?.subscriptionActive === false && <SubscriptionLock expiresAt={user?.subscriptionExpiresAt} />}
      {activeRide && <SOSButton onPress={() => socket?.emit("driver:sos", { rideId: activeRide.rideId })} />}
      <AppMap
        isOnline={isOnline}
        mode="driver"
        origin={mapOrigin}
        destination={mapDestination}
        originColor={colors.success}
        destColor={ridePhase === "picking_up" ? colors.primary : colors.accent}
        routeCoordinates={routeCoords}
        markerColor={isOnline ? colors.accent : colors.border}
        navigationMode={navModeActive}
      />
      {navModeActive && currentNavStep && (
        <NavigationOverlay
          step={currentNavStep}
          nextStep={nextNavStep}
          distanceToStep={distToNextStep}
          totalRemaining={totalNavRemaining}
          durationRemaining={durationNavRemaining}
          onClose={resetNavState}
        />
      )}

      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <View style={[styles.statusPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Animated.View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.mutedForeground, opacity: isOnline ? dotOpacity : 1 }]} />
          <Text style={[styles.statusText, { color: colors.foreground }]}>{isOnline ? "Online" : "Offline"}</Text>
          {connected ? <View style={[styles.wsBadge, { backgroundColor: colors.success + "22" }]}><Feather name="wifi" size={10} color={colors.success} /></View> : null}
          <Switch value={isOnline} onValueChange={handleToggle} trackColor={{ false: colors.muted, true: colors.success + "88" }} thumbColor={isOnline ? colors.success : colors.mutedForeground} />
        </View>
        {activeRide && (
          <View style={[styles.phaseBadge, { backgroundColor: ridePhase === "in_progress" ? colors.success + "22" : colors.accent + "22", borderColor: ridePhase === "in_progress" ? colors.success + "55" : colors.accent + "55" }]}>
            <Feather name={ridePhase === "in_progress" ? "navigation" : "map-pin"} size={12} color={ridePhase === "in_progress" ? colors.success : colors.accent} />
            <Text style={[styles.phaseBadgeText, { color: ridePhase === "in_progress" ? colors.success : colors.accent }]} numberOfLines={1}>
              {ridePhase === "picking_up" ? `Buscando: ${getAddressText(activeRide.origin)}` : `Destino: ${getAddressText(activeRide.destination)}`}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.bottomPanel, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: botPad + 16 }]}>

        {!isOnline && !activeRide && (
          <View style={styles.centerMsg}>
            <View style={[styles.iconBox, { backgroundColor: colors.muted }]}><Feather name="power" size={28} color={colors.mutedForeground} /></View>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Você está offline</Text>
            <Text style={[styles.panelDesc, { color: colors.mutedForeground }]}>Ative o botão para receber corridas</Text>
          </View>
        )}

        {isOnline && requests.length === 0 && !activeRide && (
          <View style={styles.centerMsg}>
            <Animated.View style={{ opacity: dotOpacity }}>
              <View style={[styles.iconBox, { backgroundColor: colors.accent + "22" }]}><Feather name="radio" size={28} color={colors.accent} /></View>
            </Animated.View>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>{connected ? "Aguardando corridas…" : "Conectando…"}</Text>
            <Text style={[styles.panelDesc, { color: colors.mutedForeground }]}>{connected ? "Você receberá solicitações em tempo real" : "Reconectando ao servidor"}</Text>
          </View>
        )}

        {isOnline && requests.length > 0 && !activeRide && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Corridas disponíveis</Text>
            {requests.map((item) => (
              <View key={item.rideId} style={[styles.requestCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                {(() => {
                  const countdown = requestCountdowns[item.rideId] ?? 30;
                  const urgent = countdown <= 10;
                  return (
                    <View style={[styles.countdownBar, { backgroundColor: urgent ? "#FF3B3022" : colors.primary + "18", borderColor: urgent ? "#FF3B30" : colors.primary + "44" }]}>
                      <Feather name="clock" size={12} color={urgent ? "#FF3B30" : colors.primary} />
                      <Text style={[styles.countdownText, { color: urgent ? "#FF3B30" : colors.primary }]}>
                        {countdown > 0 ? `Aceite em ${countdown}s` : "Expirado"}
                      </Text>
                      <View style={[styles.countdownTrack, { backgroundColor: colors.border }]}>
                        <View style={[styles.countdownFill, { width: `${(countdown / 30) * 100}%`, backgroundColor: urgent ? "#FF3B30" : colors.primary }]} />
                      </View>
                    </View>
                  );
                })()}
                <View style={styles.requestHeader}>
                  {item.passengerPhotoUrl ? (
                    <Image source={{ uri: item.passengerPhotoUrl }} style={[styles.avatar, { borderRadius: 22 }]} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                      <Text style={styles.avatarText}>{(item.passenger ?? "P")[0]}</Text>
                    </View>
                  )}
                  <View style={styles.requestInfo}>
                    <Text style={[styles.passengerName, { color: colors.foreground }]}>{item.passenger ?? "Passageiro"}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <StarRating rating={item.passengerRating ?? 5} />
                      <Text style={[styles.requestMeta, { color: colors.mutedForeground }]}>
                        {(item.passengerRating ?? 5.0).toFixed(1)} · {item.passengerTotalRides ?? 0} corridas
                      </Text>
                    </View>
                    <Text style={[styles.requestMeta, { color: colors.mutedForeground }]}>{item.distanceToPassenger ?? item.distance} · {item.eta} min para buscar</Text>
                  </View>
                  <Text style={[styles.price, { color: colors.primary }]}>R$ {(item.price ?? 0).toFixed(2)}</Text>
                </View>
                <View style={[styles.requestRoute, { borderTopColor: colors.border }]}>
                  <View style={styles.routeLine}>
                    <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.routeText, { color: colors.mutedForeground }]} numberOfLines={1}>{getAddressText(item.origin)}</Text>
                  </View>
                  <View style={styles.routeLine}>
                    <View style={[styles.routeDot, { backgroundColor: colors.accent }]} />
                    <Text style={[styles.routeText, { color: colors.foreground }]} numberOfLines={1}>{getAddressText(item.destination)}</Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity style={[styles.rejectBtn, { borderColor: colors.border }]} onPress={() => handleReject(item.rideId)} activeOpacity={0.7}>
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.primary }]} onPress={() => handleAccept(item)} activeOpacity={0.85}>
                    <Feather name="check" size={18} color="#fff" />
                    <Text style={styles.acceptText}>Aceitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {activeRide && (
          <View>
            <View style={[styles.activeHeader, { backgroundColor: ridePhase === "in_progress" ? colors.success + "22" : colors.accent + "22" }]}>
              <Feather name={ridePhase === "in_progress" ? "navigation" : "user-check"} size={18} color={ridePhase === "in_progress" ? colors.success : colors.accent} />
              <Text style={[styles.activeStatus, { color: ridePhase === "in_progress" ? colors.success : colors.accent }]}>
                {ridePhase === "picking_up" ? "A caminho do passageiro" : "Corrida em andamento"}
              </Text>
            </View>

            <View style={styles.activeRideRow}>
              {activeRide.passengerPhotoUrl ? (
                <Image source={{ uri: activeRide.passengerPhotoUrl }} style={[styles.avatar, { borderRadius: 22 }]} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                  <Text style={styles.avatarText}>{(activeRide.passenger ?? "P")[0]}</Text>
                </View>
              )}
              <View style={styles.requestInfo}>
                <Text style={[styles.passengerName, { color: colors.foreground }]}>{activeRide.passenger ?? "Passageiro"}</Text>
                <Text style={[styles.requestMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {ridePhase === "picking_up" ? `Buscar em: ${getAddressText(activeRide.origin)}` : `Destino: ${getAddressText(activeRide.destination)}`}
                </Text>
              </View>
              <Text style={[styles.price, { color: colors.primary }]}>R$ {(activeRide.price ?? 0).toFixed(2)}</Text>
            </View>

            {/* Timer de espera */}
            {arrivedAt && (
              <View style={[styles.waitTimerBox, { backgroundColor: waitFeeStarted ? "#FF3B3022" : colors.muted, borderColor: waitFeeStarted ? "#FF3B30" : colors.border }]}>
                <Feather name="clock" size={16} color={waitFeeStarted ? "#FF3B30" : colors.mutedForeground} />
                <Text style={[styles.waitTimerText, { color: waitFeeStarted ? "#FF3B30" : colors.foreground }]}>
                  Espera: {formatWaitTime(waitSeconds)}
                  {waitFeeStarted ? `  ·  +R$ ${getWaitFee(waitSeconds).toFixed(2)}` : `  ·  ${Math.max(0, WAIT_FREE_MINUTES * 60 - waitSeconds)}s grátis restantes`}
                </Text>
              </View>
            )}

            <TouchableOpacity style={[styles.chatFullBtn, { backgroundColor: colors.accent + "22", borderColor: colors.accent + "55", borderWidth: 1, marginBottom: 10 }]} onPress={() => { setChatOpen(true); setUnreadCount(0); }} activeOpacity={0.8}>
              <Feather name="message-circle" size={18} color={colors.accent} />
              <Text style={[styles.chatBtnText, { color: colors.accent }]}>Falar com o passageiro</Text>
              {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
            </TouchableOpacity>

            {ridePhase === "picking_up" && (
              <>
                {(() => {
                  const pickupLoc = activeRide ? parseLocation(activeRide.origin) : undefined;
                  return pickupLoc ? (
                    <TouchableOpacity
                      style={[styles.navBtn, { backgroundColor: colors.accent + "22", borderColor: colors.accent + "55" }]}
                      onPress={() => openNavigation(pickupLoc.lat, pickupLoc.lng, getAddressText(activeRide!.origin))}
                      activeOpacity={0.85}
                    >
                      <Feather name="navigation" size={16} color={colors.accent} />
                      <Text style={[styles.navBtnText, { color: colors.accent }]}>Navegar até o passageiro</Text>
                    </TouchableOpacity>
                  ) : null;
                })()}
                <TouchableOpacity style={[styles.arrivedBtn, { backgroundColor: colors.primary }]} onPress={handleArrived} activeOpacity={0.85}>
                  <Feather name="map-pin" size={18} color="#fff" />
                  <Text style={styles.finishText}>Cheguei ao local</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cancelRideBtn, { borderColor: colors.border }]} onPress={handleCancelActiveRide} activeOpacity={0.7}>
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.cancelRideBtnText, { color: colors.mutedForeground }]}>Cancelar corrida</Text>
                </TouchableOpacity>
              </>
            )}

            {ridePhase === "in_progress" && (
              <>
              {/* Navigation controls */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                {!navModeActive && (
                  <TouchableOpacity
                    style={[styles.navBtn, { flex: 1, backgroundColor: colors.success + "22", borderColor: colors.success + "55" }]}
                    onPress={() => {
                      const destLoc = parseLocation(activeRide!.destination);
                      if (destLoc && driverLocation) {
                        getRouteWithSteps(
                          { lat: driverLocation.latitude, lng: driverLocation.longitude },
                          { lat: destLoc.lat, lng: destLoc.lng }
                        ).then((r) => {
                          if (!r || r.steps.length === 0) return;
                          navStepsRef.current = r.steps;
                          currentStepIdxRef.current = 0;
                          navModeRef.current = true;
                          lastSpokenRef.current = -1;
                          setNavModeActive(true);
                          setCurrentNavStep(r.steps[0]);
                          setNextNavStep(r.steps[1] ?? null);
                          setDistToNextStep(r.steps[0].distance);
                          setTotalNavRemaining(r.distance * 1000);
                          setDurationNavRemaining(r.totalDurationSec);
                          Speech.speak(r.steps[0].instruction, { language: "pt-BR", rate: 0.9 });
                        });
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Feather name="navigation" size={15} color={colors.success} />
                    <Text style={[styles.navBtnText, { color: colors.success }]}>Nav. no app</Text>
                  </TouchableOpacity>
                )}
                {(() => {
                  const destLoc = activeRide ? parseLocation(activeRide.destination) : undefined;
                  return destLoc ? (
                    <TouchableOpacity
                      style={[styles.navBtn, { flex: navModeActive ? 1 : undefined, width: navModeActive ? undefined : 46, backgroundColor: "rgba(255,255,255,0.06)", borderColor: colors.border }]}
                      onPress={() => openNavigation(destLoc.lat, destLoc.lng, getAddressText(activeRide!.destination))}
                      activeOpacity={0.85}
                    >
                      <Feather name="map" size={15} color={colors.mutedForeground} />
                      {navModeActive && <Text style={[styles.navBtnText, { color: colors.mutedForeground }]}>Waze / Maps</Text>}
                    </TouchableOpacity>
                  ) : null;
                })()}
              </View>
              <TouchableOpacity style={[styles.finishBtn, { backgroundColor: colors.success }]} onPress={handleFinishRide} activeOpacity={0.85}>
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={styles.finishText}>Finalizar corrida</Text>
              </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      {activeRide && user && (
        <RideChat visible={chatOpen} onClose={() => setChatOpen(false)} rideId={activeRide.rideId} myId={user.id} myName={user.name} otherName={activeRide.passenger} socket={socket} messages={chatMessages} onNewMessage={(msg) => setChatMessages((prev) => [...prev, msg])} />
      )}

      <AIMonitoringPopup visible={showMonitoringPopup} onClose={() => setShowMonitoringPopup(false)} variant="driver" />

      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.pinOverlay}>
          <View style={[styles.pinModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.pinIconBox, { backgroundColor: colors.primary + "22" }]}><Feather name="shield" size={28} color={colors.primary} /></View>
            <Text style={[styles.pinTitle, { color: colors.foreground }]}>Verificar passageiro</Text>
            <Text style={[styles.pinDesc, { color: colors.mutedForeground }]}>
              Peça o código de 4 dígitos ao passageiro para confirmar o embarque.{"\n"}O tempo de espera começa a contar agora.
            </Text>
            <TextInput style={[styles.pinInputField, { color: colors.foreground, borderColor: pinError ? colors.error : colors.border, backgroundColor: colors.muted, textAlign: "center" }]} value={pinInput} onChangeText={setPinInput} maxLength={4} keyboardType="number-pad" placeholder="0000" placeholderTextColor={colors.mutedForeground} />
            {!!pinError && <Text style={styles.pinError}>{pinError}</Text>}
            <View style={styles.pinActions}>
              <TouchableOpacity style={[styles.pinCancelBtn, { borderColor: colors.border }]} onPress={() => setShowPinModal(false)} activeOpacity={0.7}>
                <Text style={[styles.pinCancelText, { color: colors.mutedForeground }]}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pinConfirmBtn, { backgroundColor: colors.primary }]} onPress={handleStartTrip} activeOpacity={0.85}>
                <Text style={styles.pinConfirmText}>Iniciar corrida</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRatingModal} transparent animationType="slide" onRequestClose={() => { setShowRatingModal(false); setPendingRating(null); }}>
        <View style={styles.pinOverlay}>
          <View style={[styles.pinModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.pinIconBox, { backgroundColor: colors.accent + "22" }]}><Feather name="star" size={28} color={colors.accent} /></View>
            <Text style={[styles.pinTitle, { color: colors.foreground }]}>Avaliar passageiro</Text>
            <Text style={[styles.pinDesc, { color: colors.mutedForeground }]}>
              Como foi a corrida com {pendingRating?.passengerName ?? "o passageiro"}?
            </Text>
            <View style={ratingStyles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setSelectedStars(s)} activeOpacity={0.7} style={ratingStyles.starBtn}>
                  <Text style={[ratingStyles.starIcon, { color: s <= selectedStars ? "#F59E0B" : colors.mutedForeground }]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[ratingStyles.starLabel, { color: colors.mutedForeground }]}>
              {selectedStars === 1 ? "Muito ruim" : selectedStars === 2 ? "Ruim" : selectedStars === 3 ? "Regular" : selectedStars === 4 ? "Bom" : "Excelente"}
            </Text>
            <View style={styles.pinActions}>
              <TouchableOpacity style={[styles.pinCancelBtn, { borderColor: colors.border }]} onPress={() => { setShowRatingModal(false); setPendingRating(null); }} activeOpacity={0.7}>
                <Text style={[styles.pinCancelText, { color: colors.mutedForeground }]}>Pular</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pinConfirmBtn, { backgroundColor: colors.accent, opacity: ratingSubmitting ? 0.6 : 1 }]} onPress={handleSubmitRating} activeOpacity={0.85} disabled={ratingSubmitting}>
                <Text style={styles.pinConfirmText}>{ratingSubmitting ? "Enviando…" : "Enviar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNotApprovedModal} transparent animationType="fade" onRequestClose={() => setShowNotApprovedModal(false)}>
        <View style={naStyles.naOverlay}>
          <LinearGradient colors={["#0D1B2A","#112240","#0D1B2A"]} style={naStyles.naCard}>
            <View style={naStyles.naTopGlow} />
            <View style={naStyles.naIllustration}><NotApprovedIllustration floatY={floatAnim.interpolate({ inputRange: [-10, 0], outputRange: [-10, 0] })} /></View>
            <Text style={naStyles.naTitle}>Cadastro em análise</Text>
            <Text style={naStyles.naDesc}>Seus documentos estão sendo verificados pela equipe Zerorisco. Você receberá uma notificação assim que aprovado.</Text>
            <TouchableOpacity style={naStyles.naVerifyOuter} onPress={() => { setShowNotApprovedModal(false); router.push("/(driver)/upload-documents"); }} activeOpacity={0.9}>
              <LinearGradient colors={["#00C4FF","#2563EB"]} style={naStyles.naVerifyBtn}>
                <View style={naStyles.naVerifyIcon}><Feather name="upload" size={16} color="#fff" /></View>
                <Text style={naStyles.naVerifyText}>Enviar documentos</Text>
                <Feather name="chevron-right" size={18} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={naStyles.naUnderstoodBtn} onPress={() => setShowNotApprovedModal(false)} activeOpacity={0.85}>
              <View style={naStyles.naUnderstoodIcon}><Feather name="check-circle" size={16} color="#34C759" /></View>
              <Text style={naStyles.naUnderstoodText}>Entendido</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

const naStyles = StyleSheet.create({
  illRoot: { width: 160, height: 170, alignItems: "center", justifyContent: "center" },
  glowOrb: { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: "#00C4FF", opacity: 0.08 },
  docCard: { width: 100, height: 130, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", paddingTop: 22, paddingHorizontal: 12, gap: 7, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18, elevation: 14 },
  clipTop: { position: "absolute", top: -10, width: 40, height: 20, borderRadius: 6, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" },
  clipHole: { width: 18, height: 8, borderRadius: 4, backgroundColor: "#1A3A8F" },
  avatarRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: "#E8F0FE", alignItems: "center", justifyContent: "center", backgroundColor: "#EEF2FF" },
  avatarInner: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center" },
  docLinesFull: { width: 68, height: 5, borderRadius: 3, backgroundColor: "#E2E8F0" },
  docLinesMid: { width: 52, height: 5, borderRadius: 3, backgroundColor: "#EDF2F7" },
  docItemRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  docCheckGreen: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#34C759", alignItems: "center", justifyContent: "center" },
  docCheckOrange: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#FF9500", alignItems: "center", justifyContent: "center" },
  docLineShort: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0" },
  badgeShield: { position: "absolute", bottom: 18, left: 0, borderRadius: 20, overflow: "hidden" },
  badgeLupa: { position: "absolute", top: 8, right: 0, borderRadius: 20, overflow: "hidden" },
  badgeGrad: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  naOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)", alignItems: "center", justifyContent: "center", padding: 24 },
  naCard: { width: "100%", borderRadius: 32, borderWidth: 1, borderColor: "rgba(0,196,255,0.15)", paddingHorizontal: 28, paddingTop: 40, paddingBottom: 28, alignItems: "center", gap: 0, overflow: "hidden" },
  naTopGlow: { position: "absolute", top: -60, left: "10%", right: "10%", height: 120, borderRadius: 60, backgroundColor: "#00C4FF", opacity: 0.07 },
  naIllustration: { marginBottom: 24, alignItems: "center" },
  naTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#FFFFFF", textAlign: "center", marginBottom: 10, letterSpacing: -0.5 },
  naDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(200,220,255,0.65)", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  naVerifyOuter: { width: "100%", marginBottom: 12 },
  naVerifyBtn: { width: "100%", height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 12 },
  naVerifyIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  naVerifyText: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  naUnderstoodBtn: { width: "100%", height: 54, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 12 },
  naUnderstoodIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(52,199,89,0.12)", alignItems: "center", justifyContent: "center" },
  naUnderstoodText: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.75)" },
});

const ratingStyles = StyleSheet.create({
  starsRow: { flexDirection: "row", gap: 8, marginVertical: 4 },
  starBtn: { padding: 4 },
  starIcon: { fontSize: 40 },
  starLabel: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  statusPill: { flexDirection: "row", alignItems: "center", borderRadius: 30, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  wsBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  phaseBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  phaseBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", flex: 1 },
  bottomPanel: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingHorizontal: 20, paddingTop: 20, maxHeight: "55%" },
  centerMsg: { alignItems: "center", gap: 10, paddingVertical: 12 },
  iconBox: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  panelTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  panelDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  requestCard: { borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  countdownBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  countdownText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  countdownTrack: { width: 80, height: 4, borderRadius: 2, overflow: "hidden" },
  countdownFill: { height: 4, borderRadius: 2 },
  requestHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  requestInfo: { flex: 1 },
  passengerName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  requestMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  price: { fontSize: 17, fontFamily: "Inter_700Bold" },
  requestRoute: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, gap: 6 },
  routeLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  requestActions: { flexDirection: "row", gap: 10, padding: 12 },
  rejectBtn: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  acceptBtn: { flex: 1, height: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  acceptText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  activeHeader: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12, marginBottom: 12 },
  activeStatus: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  activeRideRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  waitTimerBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 10 },
  waitTimerText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  finishBtn: { height: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  finishText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  chatFullBtn: { flexDirection: "row", alignItems: "center", gap: 10, height: 46, borderRadius: 12, paddingHorizontal: 16 },
  chatBtnText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  badge: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FF6B00", alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  arrivedBtn: { height: 50, borderRadius: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  cancelRideBtn: { height: 42, borderRadius: 12, borderWidth: 1, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  cancelRideBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  navBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 46, borderRadius: 12, borderWidth: 1, gap: 8, marginBottom: 10 },
  navBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  pinOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center" },
  pinModal: { width: "86%", borderRadius: 24, borderWidth: 1, padding: 28, gap: 14, alignItems: "center" },
  pinIconBox: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  pinTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  pinDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  pinInputField: { width: "100%", fontSize: 40, fontFamily: "Inter_700Bold", height: 76, borderRadius: 16, borderWidth: 2, letterSpacing: 18 },
  pinError: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#FF453A", textAlign: "center" },
  pinActions: { flexDirection: "row", gap: 12, width: "100%", marginTop: 4 },
  pinCancelBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pinCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  pinConfirmBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pinConfirmText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
